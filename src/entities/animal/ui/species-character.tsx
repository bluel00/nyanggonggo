"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { cn } from "@/shared/lib/utils";
import { describeError, warnClient } from "@/shared/lib/client-log";
import { prefersReducedMotion } from "@/shared/lib/use-reduced-motion";
import { CHARACTER_FIRST_VISIT_INPUT, CHARACTER_PRESS_TRIGGER, CHARACTER_STATE_MACHINE } from "../lib/character-animation-assets";
import { loadCharacterAnimation, type CharacterAnimationKit } from "../lib/character-animation";
import type { Animal } from "../model/animal";

/**
 * 한 마리 캐릭터가 있는 축종. 기타는 종이 분산되어 한 마리로 대표하지 않고, 새·토끼·거북이 셋을 묶은 정지 그림(OtherCharacters)을 쓴다
 * (docs/design/characters.md)
 */
export type CharacterSpecies = Exclude<Animal["species"], "other">;

/**
 * 앱이 쓰는 캐릭터 SVG 사본(`public/characters/`). 원본은 `docs/design/assets/characters/`이고,
 * 둘이 같은지는 `tests/design/characters-sync.test.ts`가 본다.
 */
export const CHARACTER_SRC: Record<CharacterSpecies, string> = {
  cat: "/characters/nyang-cat.svg",
  dog: "/characters/nyang-dog.svg",
};

/** Rive 아트보드 이름(rive/nyang-characters) */
const CHARACTER_ARTBOARD: Record<CharacterSpecies, string> = {
  cat: "nyang-cat",
  dog: "nyang-dog",
};

/** 원본 크기. 1:1에서 선이 1.8px로 아이콘과 같은 굵기다(characters.md 그리기 규칙) */
const CHARACTER_SIZE = 120;

/**
 * 앱 → 캐릭터 신호(characters.md 모션 절, handoff (k) "신호와 시간을 누가 맡나").
 * - press(): 실행 중 신호(뷰 모델 트리거 press)
 * - start(firstVisit): 미리 불러 둔(prepare) 캐릭터를 지금 시작한다. firstVisit(뷰 모델 불리언)은 시작 직전에 한 번 정한다.
 *   홈 첫인상 장면이 두 캐릭터와 CSS 장면을 같은 순간에 시작하려고 쓴다. 아직 로드 전이거나 이미 시작했으면 아무 일도 없다
 */
export type CharacterHandle = { press(): void; start(firstVisit: boolean): void };

type RiveInstance = InstanceType<typeof import("@rive-app/canvas-lite").Rive>;

/**
 * 고양이·강아지 캐릭터. 장식이라 `alt=""`·`aria-hidden`이고 의미는 옆의 텍스트 라벨이 전한다.
 *
 * - 서버 렌더와 첫 화면은 정지 SVG `<img>`다. 인라인 SVG가 아닌 이유: 두 SVG가 같은 그룹 id(`head`, `tail`…)를 써서
 *   한 페이지에 인라인하면 id가 겹친다.
 * - `animated`이면 클라이언트에서만 Rive를 지연 로드하고, 로드되면 같은 120×120 자리를 캔버스로 바꾼다(겹쳐 두고
 *   보이는 쪽만 바꿔 레이아웃 이동이 없다). greet → idle은 Rive 상태 머신이 알아서 한다.
 * - `play`가 false인 동안은 런타임·.riv만 미리 받아 두고 Rive를 시작하지 않는다(정지 이미지 그대로). true가 되면 그때 시작해
 *   greet이 바로 돈다. 홈은 등장이 끝난 뒤 true로 바꾼다(README 움직임 표: greet은 등장이 끝나고 0.3초 안에).
 * - 움직임을 줄이도록 설정했거나 로드가 실패하면 정지 이미지 그대로다(런타임·WASM·.riv를 받지 않거나, 로그만 남긴다).
 * - `ref`의 `press()`가 뷰 모델 트리거 `press`를 보낸다(카드를 누를 때). 아직 로드 전이면 아무 일도 없다.
 * - `prepare`이면 `play` 전에 인스턴스까지 만들어(autoplay 없이) 그릴 준비를 하고 `onLoad`로 알린다. 시작은 `play`가 true가 되거나
 *   `ref`의 `start(firstVisit)`로 한다(홈 첫인상, handoff (k)). `play`로 시작하면 firstVisit은 false(지금 인사 그대로)다.
 * - firstVisit은 인스턴스가 열리는 순간(onLoad)에 정해야 한다: autoplay가 없어도 런타임이 열자마자 첫 프레임을 그리며 상태 머신의
 *   Entry를 고른다. 그래서 열 때 `firstVisitOnLoad()`로 값을 정하고, 시작할 때 다른 값을 원하면 인스턴스를 다시 만든다
 *   (장면을 기다리다 대체로 넘어간 드문 경우).
 */
export function SpeciesCharacter({
  species,
  animated = false,
  play = true,
  prepare = false,
  onLoad,
  firstVisitOnLoad,
  ref,
}: {
  species: CharacterSpecies;
  animated?: boolean;
  /** false면 미리 받기만 하고 시작하지 않는다 */
  play?: boolean;
  /** true면 시작 전에 인스턴스까지 만들어 둔다(그릴 준비) */
  prepare?: boolean;
  /** 인스턴스가 그릴 준비가 되면(Rive onLoad) 한 번 */
  onLoad?: () => void;
  /** 인스턴스가 열릴 때 정할 firstVisit(기본 false) */
  firstVisitOnLoad?: () => boolean;
  ref?: Ref<CharacterHandle>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const riveRef = useRef<RiveInstance | null>(null);
  const startedRef = useRef(false);
  /** 지금 인스턴스가 열릴 때 정한 firstVisit */
  const loadedWithRef = useRef(false);
  /** 열리기 전(또는 다시 만드는 중)에 받은 시작 요청 */
  const pendingStartRef = useRef<boolean | null>(null);
  const onLoadRef = useRef(onLoad);
  const firstVisitOnLoadRef = useRef(firstVisitOnLoad);
  const [ready, setReady] = useState(false);
  /** 시작할 때 정한 firstVisit(캔버스의 data-first-visit, 확인용) */
  const [startedWith, setStartedWith] = useState<boolean | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [generation, setGeneration] = useState(0);
  const [kit, setKit] = useState<CharacterAnimationKit | null>(null);

  useEffect(() => {
    onLoadRef.current = onLoad;
    firstVisitOnLoadRef.current = firstVisitOnLoad;
  });

  /** 불러 둔 인스턴스를 시작한다. firstVisit은 열 때 정한 값이어야 한다(다르면 다시 만들고 열리면 시작한다) */
  const startRef = useRef((firstVisit: boolean) => {
    if (startedRef.current) return;
    const instance = riveRef.current;
    if (!instance || loadedWithRef.current !== firstVisit) {
      pendingStartRef.current = firstVisit;
      if (instance) setGeneration((n) => n + 1);
      return;
    }
    startedRef.current = true;
    pendingStartRef.current = null;
    try {
      instance.play(CHARACTER_STATE_MACHINE);
      setStartedWith(firstVisit);
      setReady(true);
    } catch (error) {
      warnClient("character-animation", "Rive를 시작하지 못해 정지 이미지를 쓴다", { species, ...describeError(error) });
    }
  });

  useImperativeHandle(
    ref,
    () => ({
      press() {
        try {
          riveRef.current?.viewModelInstance?.trigger(CHARACTER_PRESS_TRIGGER)?.trigger();
        } catch (error) {
          warnClient("character-animation", "press를 보내지 못했다", describeError(error));
        }
      },
      start(firstVisit: boolean) {
        startRef.current(firstVisit);
      },
    }),
    [],
  );

  useEffect(() => {
    // 움직임을 줄이도록 설정했으면 런타임·WASM·.riv를 아예 받지 않는다(characters.md: 기본 포즈로 정지)
    if (!animated || prefersReducedMotion()) return;
    let cancelled = false;
    void loadCharacterAnimation().then((loaded) => {
      if (loaded && !cancelled) setKit(loaded);
    });
    return () => {
      cancelled = true;
    };
  }, [animated]);

  // 인스턴스는 시작할 때(play) 또는 미리(prepare) 만든다. 시작은 아래 effect나 start()가 한다(autoplay 없음)
  const create = play || prepare;
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!kit || !create || !canvas) return;
    let cancelled = false;
    let instance: RiveInstance | null = null;
    try {
      instance = new kit.runtime.Rive({
        buffer: kit.riv.slice(0),
        canvas,
        artboard: CHARACTER_ARTBOARD[species],
        stateMachine: CHARACTER_STATE_MACHINE,
        autoBind: true,
        autoplay: false,
        onLoad: () => {
          if (cancelled || !instance) return;
          instance.resizeDrawingSurfaceToCanvas();
          // 첫 프레임(상태 머신의 Entry)보다 먼저 정한다
          const firstVisit = pendingStartRef.current ?? firstVisitOnLoadRef.current?.() ?? false;
          try {
            const input = instance.viewModelInstance?.boolean(CHARACTER_FIRST_VISIT_INPUT);
            if (input) input.value = firstVisit;
          } catch (error) {
            warnClient("character-animation", "firstVisit을 정하지 못했다", { species, ...describeError(error) });
          }
          loadedWithRef.current = firstVisit;
          riveRef.current = instance;
          setLoaded(true);
          if (pendingStartRef.current !== null) startRef.current(pendingStartRef.current);
          else onLoadRef.current?.();
        },
        onLoadError: (event) => warnClient("character-animation", ".riv를 열지 못해 정지 이미지를 쓴다", { species, type: event?.type }),
      });
    } catch (error) {
      warnClient("character-animation", "Rive를 시작하지 못해 정지 이미지를 쓴다", { species, ...describeError(error) });
    }
    return () => {
      cancelled = true;
      riveRef.current = null;
      startedRef.current = false;
      setLoaded(false);
      setReady(false);
      setStartedWith(null);
      instance?.cleanup();
    };
  }, [kit, create, species, generation]);

  // play로 시작: 지금 인사 그대로(firstVisit = false)
  useEffect(() => {
    if (loaded && play) startRef.current(false);
  }, [loaded, play]);

  return (
    <span aria-hidden className="relative block shrink-0" style={{ width: CHARACTER_SIZE, height: CHARACTER_SIZE }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- 120px 고정 SVG라 next/image 최적화가 할 일이 없다 */}
      <img
        src={CHARACTER_SRC[species]}
        alt=""
        width={CHARACTER_SIZE}
        height={CHARACTER_SIZE}
        draggable={false}
        data-slot="character-image"
        className={cn("block select-none", ready && "invisible")}
      />
      {animated && (
        <canvas
          ref={canvasRef}
          data-slot="character-canvas"
          data-ready={ready}
          data-first-visit={startedWith ?? undefined}
          className={cn("absolute inset-0 size-full", !ready && "invisible")}
        />
      )}
    </span>
  );
}
