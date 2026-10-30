"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useLayoutEffect, useRef, useState } from "react";
import {
  OtherCharacters,
  SPECIES_LABEL,
  SpeciesCharacter,
  type CharacterHandle,
  type CharacterSpecies,
} from "@/entities/animal";
import { DEFAULT_ANIMAL_FILTER, toListHref, type AnimalArea, type AnimalSpecies } from "../model/filter";
import { animationsFinished, enterOrder } from "@/shared/lib/motion";
import { DisplayText } from "@/shared/ui/display-text";
import { rememberSpecies } from "../model/species-cookie";
import { decideHomeSceneFromApp, holdHomeScene, homeSceneState, startHomeScene, watchHomeScene } from "../model/home-scene";

/**
 * 홈에서 축종을 고른다(PRD-v1.1 3절 7)·8), 시안 "냥공고 홈 · 축종 선택"의 Main).
 *
 * 고양이·강아지는 캐릭터 + 라벨의 큰 카드 두 개, 기타는 그 아래 12px의 낮은 가로 카드다(기타는 전체 공고의 2%대라
 * 같은 무게로 두지 않는다, 12.A P12. 글자 링크는 버튼으로 보이지 않아 카드로 바꿨다, #86). 시안은 button이지만 고르면 목록으로 **이동**하므로 링크다.
 * 고른 축종은 쿠키에 기억해 다음 `/` 진입에서 홈을 건너뛴다.
 * 지역은 목록에서 넘겨받은 값을 그대로 다음 목록에 실어 보내고, 기억하지는 않는다(결정 G2).
 *
 * 누름 피드백은 카드 누름(100ms, scale .98 + shadow-card-pressed, 기타 동물 카드와 같다)이고 reduced-motion이면 반응이 없다(`motion-safe:`). 누르면 바로 목록으로 간다.
 * 등장(README 움직임 표): 고양이 → 강아지 → 기타 동물 카드가 차례로 올라오며 나타난다(globals.css [data-enter]). 순서는 화면이 정한
 * 시작 번호(enterFrom)부터 이어 붙인다(홈은 제목이 0이라 1부터).
 * 캐릭터 greet은 마지막 등장(기타 동물 카드)이 끝난 뒤 시작한다(Rive는 미리 받아 두고 인스턴스만 그때 만든다).
 *
 * 캐릭터는 늘 미리 그릴 준비까지 해 둔다(prepare, autoplay 없음. 시작 전에는 정지 이미지 그대로라 보이는 것은 같다).
 * 세션의 첫 홈 진입이면 첫인상 장면(handoff (k), model/home-scene.ts)이다: 두 캐릭터가 모두 준비되는
 * 순간 `<html data-home-scene="play">`(CSS 장면)와 Rive(firstVisit = true)를 같이 시작한다. 그 뒤의 박자(올려다보기 → 인사)는 Rive가
 * 맡는다. 0.3초 안에 준비되지 않으면 대체 타이머가 off로 바꾸고 지금 등장 + 인사(firstVisit = false)로 돈다.
 *
 * 캐릭터는 Rive로 움직인다(greet → idle, 정지 SVG에서 교체). 카드를 누르는 순간(pointerdown, 키보드 Enter) 그 캐릭터에
 * press 신호를 보낸다. 이동은 늦추지 않는다(반응이 다 보이기 전에 화면이 바뀌어도 된다, characters.md 모션 절).
 */
const BIG_CHOICES: readonly CharacterSpecies[] = ["cat", "dog"];

export function SpeciesChoice({ area, enterFrom }: { area: AnimalArea; enterFrom: number }) {
  const catRef = useRef<CharacterHandle>(null);
  const dogRef = useRef<CharacterHandle>(null);
  const characterRef = { cat: catRef, dog: dogRef } as const;
  const press = (species: CharacterSpecies) => characterRef[species].current?.press();
  const lastEnterRef = useRef<HTMLAnchorElement>(null);
  const [entered, setEntered] = useState(false);
  const loadedRef = useRef(new Set<CharacterSpecies>());

  // 첫 그림 전에 정한다(앱 안 이동). 문서로 연 홈은 인라인 스크립트가 이미 정했다
  useLayoutEffect(() => {
    decideHomeSceneFromApp();
    const release = holdHomeScene();
    let cancelled = false;
    let stopWatching = () => {};
    // 지금 등장(또는 대체)이 끝나면 인사를 시작한다(firstVisit = false)
    const greetAfterEntrance = () => {
      const last = lastEnterRef.current;
      if (!last) return;
      void animationsFinished(last).then(() => {
        if (!cancelled) setEntered(true);
      });
    };
    if (homeSceneState() === "pending") {
      // 장면이 시작되면(play) Rive가 이어 간다. 대체로 넘어가면(off) 지금 등장이 그때 시작되니 끝나기를 기다린다
      stopWatching = watchHomeScene((state) => {
        if (state === "pending") return;
        stopWatching();
        if (state === "off") greetAfterEntrance();
      });
    } else {
      greetAfterEntrance();
    }
    return () => {
      cancelled = true;
      stopWatching();
      release();
    };
  }, []);

  /** 장면을 기다리거나 시작했으면 캐릭터를 firstVisit = true로 연다(열 때 정해야 한다, SpeciesCharacter) */
  const sceneWanted = () => {
    const state = homeSceneState();
    return state === "pending" || state === "play";
  };

  /** 두 캐릭터가 모두 그릴 준비가 되면 장면 0초: CSS 장면과 Rive(firstVisit = true)를 같은 순간에 시작한다 */
  const onCharacterLoad = (species: CharacterSpecies) => {
    loadedRef.current.add(species);
    if (!BIG_CHOICES.every((each) => loadedRef.current.has(each))) return;
    if (!startHomeScene()) return;
    for (const each of BIG_CHOICES) characterRef[each].current?.start(true);
  };
  // 지역은 넘겨받은 값 그대로다(전국 `{}`이면 region이 undefined여야 하므로 `...area`가 아니라 두 값을 직접 넣는다)
  const listHref = (species: AnimalSpecies) =>
    toListHref({ ...DEFAULT_ANIMAL_FILTER, species, region: area.region, district: area.district });

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {BIG_CHOICES.map((species, index) => (
          <Link
            key={species}
            // app/globals.css의 [data-enter="home"]이 읽는다
            data-enter="home"
            style={enterOrder(enterFrom + index)}
            href={listHref(species)}
            onClick={() => rememberSpecies(species)}
            onPointerDown={() => press(species)}
            onKeyDown={(event) => {
              if (event.key === "Enter") press(species);
            }}
            className="flex flex-col items-center gap-3 rounded-choice bg-surface pt-6 pb-4 shadow-card text-text transition-[scale,box-shadow] duration-press ease-out motion-safe:active:scale-press motion-safe:active:shadow-card-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {/* 캐릭터 뒤 104px 원형 후광(choice-halo → choice-halo-end 72%, README). 장식이라 사진 뒤에는 쓰지 않는다 */}
            <span className="relative grid place-items-center">
              <span
                aria-hidden
                className="absolute size-[104px] rounded-full bg-[radial-gradient(circle,var(--choice-halo)_0%,var(--choice-halo-end)_72%)]"
              />
              <span className="relative">
                <SpeciesCharacter
                  species={species}
                  animated
                  play={entered}
                  prepare
                  onLoad={() => onCharacterLoad(species)}
                  firstVisitOnLoad={sceneWanted}
                  ref={characterRef[species]}
                />
              </span>
            </span>
            <DisplayText size="title">{SPECIES_LABEL[species]}</DisplayText>
          </Link>
        ))}
      </div>
      {/* 기타 동물: 큰 카드 아래 낮은 가로 카드(handoff (g) "홈 기타 동물 선택지"). 이름은 이름표 "기타 동물"이고 그림·chevron은 장식이다.
          누름은 카드 .98 + shadow-card-pressed, 캐릭터 셋 납작(바닥 가운데 기준). 눈(eyes-happy)은 바꾸지 않는다: 정지 SVG <img>라
          SVG 안의 그룹을 바꿀 수 없다(EL 결정, #86). 움직임 줄이기면 누름 반응이 없다(motion-safe:) */}
      <Link
        ref={lastEnterRef}
        // app/globals.css의 [data-enter="home"]이 읽는다
        data-enter="home"
        style={enterOrder(enterFrom + BIG_CHOICES.length)}
        href={listHref("other")}
        onClick={() => rememberSpecies("other")}
        className="group flex h-[72px] items-center gap-3 rounded-choice bg-surface pr-4 pl-[14px] shadow-card text-text transition-[scale,box-shadow] duration-press ease-out motion-safe:active:scale-press motion-safe:active:shadow-card-pressed focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <OtherCharacters characterClassName="origin-bottom transition-[scale] duration-press ease-out motion-safe:group-active:scale-char-press" />
        <DisplayText size="title" className="min-w-0 flex-1">
          {SPECIES_LABEL.other}
        </DisplayText>
        <ChevronRight aria-hidden className="size-5 shrink-0 text-text-2" />
      </Link>
    </div>
  );
}
