"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import {
  ANIMAL_COPY,
  SPECIES_LABEL,
  SpeciesCharacter,
  type CharacterHandle,
  type CharacterSpecies,
} from "@/entities/animal";
import { DEFAULT_ANIMAL_FILTER, toListHref, type AnimalArea, type AnimalSpecies } from "../model/filter";
import { animationsFinished, enterOrder } from "@/shared/lib/motion";
import { DisplayText } from "@/shared/ui/display-text";
import { rememberSpecies } from "../model/species-cookie";

/**
 * 홈에서 축종을 고른다(PRD-v1.1 3절 7)·8), 시안 "냥공고 홈 · 축종 선택"의 Main).
 *
 * 고양이·강아지는 캐릭터 + 라벨의 테두리 카드 두 개, 기타는 그 아래 작은 텍스트 링크다(기타는 전체 공고의 2%대라
 * 같은 무게로 두면 빈 목록에 가깝다, 12.A P12). 시안은 button이지만 고르면 목록으로 **이동**하므로 링크다.
 * 고른 축종은 쿠키에 기억해 다음 `/` 진입에서 홈을 건너뛴다.
 * 지역은 목록에서 넘겨받은 값을 그대로 다음 목록에 실어 보내고, 기억하지는 않는다(결정 G2).
 *
 * 누름 피드백은 카드 누름(100ms, scale .98)이고 reduced-motion이면 줄어들지 않는다(`motion-safe:`). 누르면 바로 목록으로 간다.
 * 등장(README 움직임 표): 고양이 → 강아지 → 링크가 차례로 올라오며 나타난다(globals.css [data-enter]). 순서는 화면이 정한
 * 시작 번호(enterFrom)부터 이어 붙인다(홈은 제목이 0이라 1부터).
 * 캐릭터 greet은 마지막 등장(링크)이 끝난 뒤 시작한다(Rive는 미리 받아 두고 인스턴스만 그때 만든다).
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
  useEffect(() => {
    const last = lastEnterRef.current;
    if (!last) return;
    let cancelled = false;
    void animationsFinished(last).then(() => {
      if (!cancelled) setEntered(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);
  // 지역은 넘겨받은 값 그대로다(전국 `{}`이면 region이 undefined여야 하므로 `...area`가 아니라 두 값을 직접 넣는다)
  const listHref = (species: AnimalSpecies) =>
    toListHref({ ...DEFAULT_ANIMAL_FILTER, species, region: area.region, district: area.district });

  return (
    <div className="flex flex-col gap-6">
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
            className="flex flex-col items-center gap-3 rounded-choice bg-surface pt-6 pb-4 shadow-card text-text transition-transform duration-press ease-out motion-safe:active:scale-press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {/* 캐릭터 뒤 104px 원형 후광(choice-halo → choice-halo-end 72%, README). 장식이라 사진 뒤에는 쓰지 않는다 */}
            <span className="relative grid place-items-center">
              <span
                aria-hidden
                className="absolute size-[104px] rounded-full bg-[radial-gradient(circle,var(--choice-halo)_0%,var(--choice-halo-end)_72%)]"
              />
              <span className="relative">
                <SpeciesCharacter species={species} animated play={entered} ref={characterRef[species]} />
              </span>
            </span>
            <DisplayText size="title">{SPECIES_LABEL[species]}</DisplayText>
          </Link>
        ))}
      </div>
      <Link
        ref={lastEnterRef}
        // app/globals.css의 [data-enter="home"]이 읽는다
        data-enter="home"
        style={enterOrder(enterFrom + BIG_CHOICES.length)}
        href={listHref("other")}
        onClick={() => rememberSpecies("other")}
        className="flex min-h-touch items-center self-center px-2 text-body text-text-2 underline underline-offset-[3px] hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {ANIMAL_COPY.homeOtherLink}
      </Link>
    </div>
  );
}
