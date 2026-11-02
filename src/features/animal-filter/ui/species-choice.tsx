"use client";

import { ChevronRight } from "lucide-react";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  OtherCharacters,
  SPECIES_LABEL,
  SpeciesCharacter,
  type CharacterHandle,
  type CharacterSpecies,
} from "@/entities/animal";
import { DEFAULT_ANIMAL_FILTER, toListHref, type AnimalArea, type AnimalSpecies } from "../model/filter";
import { enterOrder } from "@/shared/lib/motion";
import { prefersReducedMotion } from "@/shared/lib/use-reduced-motion";
import { DisplayText } from "@/shared/ui/display-text";
import { rememberSpecies } from "../model/species-cookie";
import { homeSceneStartTime, LOOK_UP_AT_MS } from "../model/home-scene";

/**
 * 홈에서 축종을 고른다(PRD-v1.1 3절 7)·8), 시안 "냥공고 홈 · 축종 선택"의 Main).
 *
 * 고양이·강아지는 캐릭터 + 라벨의 큰 카드 두 개, 기타는 그 아래 12px의 낮은 가로 카드다(기타는 전체 공고의 2%대라
 * 같은 무게로 두지 않는다, 12.A P12. 글자 링크는 버튼으로 보이지 않아 카드로 바꿨다, #86). 시안은 button이지만 고르면 목록으로 **이동**하므로 링크다.
 * 고른 축종은 쿠키에 기억해 다음 `/` 진입에서 홈을 건너뛴다.
 * 지역은 목록에서 넘겨받은 값을 그대로 다음 목록에 실어 보내고, 기억하지는 않는다(결정 G2).
 *
 * 누름 피드백은 카드 누름(100ms, scale .98 + shadow-card-pressed, 기타 동물 카드와 같다)이고 reduced-motion이면 반응이 없다(`motion-safe:`). 누르면 바로 목록으로 간다.
 * 등장: 홈에 들어올 때마다 첫인상 장면(handoff (k), model/home-scene.ts)이 홈의 등장을 대신한다. 카드는 장면 0.52 / 0.58 / 0.64초에
 * 고양이 → 강아지 → 기타 동물 순서로 올라오며 나타나고(app/globals.css), 기타 동물 셋은 1.18초부터 차례로 까딱한다. 순서는 화면이 정한
 * 시작 번호(enterFrom)부터 이어 붙인다(홈은 제목이 0이라 1부터). CSS만으로 돌아 하이드레이션을 기다리지 않는다.
 *
 * 캐릭터 Rive는 미리 열어 두고(prepare, autoplay 없음. 재생 전에는 정면 정지 그림 그대로) 장면 0.92초에 두 캐릭터가 모두 준비돼 있으면
 * 그 순간 withLookUp = true로 같이 재생한다(올려다보기 → 인사). 0.92초까지 준비되지 않으면 준비되는 대로 withLookUp = false(지금 인사)다.
 * withLookUp은 Rive가 열리는 순간 정해야 해서(SpeciesCharacter), 열릴 때 아직 0.92초 전이면 true로 열고 그 뒤면 false로 연다.
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
  /** 장면 시계로 쓰는 카드(장면 CSS 애니메이션이 시작된 시각 = 장면 0초) */
  const sceneClockRef = useRef<HTMLAnchorElement>(null);
  /** 장면 0.92초(document timeline 시각). 정하기 전이면 null */
  const lookUpAtRef = useRef<number | null>(null);
  const loadedRef = useRef(new Set<CharacterSpecies>());
  /** 0.92초까지 둘 다 준비되지 않았다: 준비되는 대로 withLookUp = false로 재생한다 */
  const [late, setLate] = useState(false);

  useEffect(() => {
    // 움직임 줄이기면 장면도 인사도 없다(캐릭터는 Rive를 받지 않는다)
    if (prefersReducedMotion()) return;
    const lookUpAt = homeSceneStartTime(sceneClockRef.current) + LOOK_UP_AT_MS;
    lookUpAtRef.current = lookUpAt;
    const timer = setTimeout(
      () => {
        if (BIG_CHOICES.every((species) => loadedRef.current.has(species))) {
          catRef.current?.start(true);
          dogRef.current?.start(true);
        } else {
          setLate(true);
        }
      },
      Math.max(0, lookUpAt - performance.now()),
    );
    return () => clearTimeout(timer);
  }, []);

  /** 열리는 지금이 장면 0.92초 전이면 올려다보기를 붙일 수 있다(그때 재생한다) */
  const lookUpStillPossible = () => lookUpAtRef.current !== null && performance.now() < lookUpAtRef.current;
  const onCharacterLoad = (species: CharacterSpecies) => {
    loadedRef.current.add(species);
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
            ref={index === 0 ? sceneClockRef : undefined}
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
                  play={late}
                  prepare
                  onLoad={() => onCharacterLoad(species)}
                  withLookUpOnLoad={lookUpStillPossible}
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
