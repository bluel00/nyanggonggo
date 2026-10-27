"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";
import { cn } from "@/shared/lib/utils";
import { describeError, warnClient } from "@/shared/lib/client-log";
import { prefersReducedMotion } from "@/shared/lib/use-reduced-motion";
import { CHARACTER_PRESS_TRIGGER, CHARACTER_STATE_MACHINE } from "../lib/character-animation-assets";
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

/** 앱 → 캐릭터 신호. 지금은 press 하나다(characters.md 모션 절) */
export type CharacterHandle = { press(): void };

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
 */
export function SpeciesCharacter({
  species,
  animated = false,
  play = true,
  ref,
}: {
  species: CharacterSpecies;
  animated?: boolean;
  /** false면 미리 받기만 하고 시작하지 않는다 */
  play?: boolean;
  ref?: Ref<CharacterHandle>;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const riveRef = useRef<RiveInstance | null>(null);
  const [ready, setReady] = useState(false);
  const [kit, setKit] = useState<CharacterAnimationKit | null>(null);

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!kit || !play || !canvas) return;
    let cancelled = false;
    let instance: RiveInstance | null = null;
    try {
      instance = new kit.runtime.Rive({
        buffer: kit.riv.slice(0),
        canvas,
        artboard: CHARACTER_ARTBOARD[species],
        stateMachine: CHARACTER_STATE_MACHINE,
        autoBind: true,
        autoplay: true,
        onLoad: () => {
          if (cancelled || !instance) return;
          instance.resizeDrawingSurfaceToCanvas();
          riveRef.current = instance;
          setReady(true);
        },
        onLoadError: (event) => warnClient("character-animation", ".riv를 열지 못해 정지 이미지를 쓴다", { species, type: event?.type }),
      });
    } catch (error) {
      warnClient("character-animation", "Rive를 시작하지 못해 정지 이미지를 쓴다", { species, ...describeError(error) });
    }
    return () => {
      cancelled = true;
      riveRef.current = null;
      instance?.cleanup();
    };
  }, [kit, play, species]);

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
          className={cn("absolute inset-0 size-full", !ready && "invisible")}
        />
      )}
    </span>
  );
}
