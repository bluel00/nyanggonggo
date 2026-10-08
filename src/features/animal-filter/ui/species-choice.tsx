"use client";

import Link from "next/link";
import { useRef } from "react";
import {
  ANIMAL_COPY,
  SPECIES_LABEL,
  SpeciesCharacter,
  type AnimalListFilter,
  type CharacterHandle,
  type CharacterSpecies,
} from "@/entities/animal";
import { DEFAULT_ANIMAL_FILTER, toFilterHref, type AnimalArea, type AnimalSpecies } from "../model/filter";
import { rememberSpecies } from "../model/species-cookie";

/**
 * 홈에서 축종을 고른다(PRD-v1.1 3절 7)·8), 시안 "냥공고 홈 · 축종 선택"의 Main).
 *
 * 고양이·강아지는 캐릭터 + 라벨의 테두리 카드 두 개, 기타는 그 아래 작은 텍스트 링크다(기타는 전체 공고의 2%대라
 * 같은 무게로 두면 빈 목록에 가깝다, 12.A P12). 시안은 button이지만 고르면 목록으로 **이동**하므로 링크다.
 * 고른 축종은 쿠키에 기억해 다음 `/` 진입에서 홈을 건너뛴다.
 * 지역은 목록에서 넘겨받은 값을 그대로 다음 목록에 실어 보내고, 기억하지는 않는다(결정 G2).
 *
 * 누름 피드백은 카드 누름(100ms, scale .98)이고 reduced-motion이면 줄어들지 않는다(`motion-safe:`).
 *
 * 캐릭터는 Rive로 움직인다(greet → idle, 정지 SVG에서 교체). 카드를 누르는 순간(pointerdown, 키보드 Enter) 그 캐릭터에
 * press 신호를 보낸다. 이동은 늦추지 않는다(반응이 다 보이기 전에 화면이 바뀌어도 된다, characters.md 모션 절).
 */
const BIG_CHOICES: readonly CharacterSpecies[] = ["cat", "dog"];

export function SpeciesChoice({ area }: { area: AnimalArea }) {
  const catRef = useRef<CharacterHandle>(null);
  const dogRef = useRef<CharacterHandle>(null);
  const characterRef = { cat: catRef, dog: dogRef } as const;
  const press = (species: CharacterSpecies) => characterRef[species].current?.press();
  const listHref = (species: AnimalSpecies) => {
    const filter: AnimalListFilter = {
      species,
      region: area.region,
      district: area.district,
      status: DEFAULT_ANIMAL_FILTER.status,
      sort: DEFAULT_ANIMAL_FILTER.sort,
    };
    return toFilterHref("/", filter);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="grid grid-cols-2 gap-3">
        {BIG_CHOICES.map((species) => (
          <Link
            key={species}
            href={listHref(species)}
            onClick={() => rememberSpecies(species)}
            onPointerDown={() => press(species)}
            onKeyDown={(event) => {
              if (event.key === "Enter") press(species);
            }}
            className="flex flex-col items-center gap-3 rounded-card border border-border bg-bg pt-6 pb-4 text-card-title text-text transition-transform duration-press ease-out motion-safe:active:scale-press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            <SpeciesCharacter species={species} animated ref={characterRef[species]} />
            {SPECIES_LABEL[species]}
          </Link>
        ))}
      </div>
      <Link
        href={listHref("other")}
        onClick={() => rememberSpecies("other")}
        className="flex min-h-touch items-center self-center px-2 text-body text-text-2 underline underline-offset-[3px] hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {ANIMAL_COPY.homeOtherLink}
      </Link>
    </div>
  );
}
