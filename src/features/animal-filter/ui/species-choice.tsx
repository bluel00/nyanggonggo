"use client";

import Link from "next/link";
import { ANIMAL_COPY, SPECIES_LABEL, type AnimalListFilter } from "@/entities/animal";
import { DEFAULT_ANIMAL_FILTER, toFilterHref, type AnimalArea, type AnimalSpecies } from "../model/filter";
import { rememberSpecies } from "../model/species-cookie";

/**
 * 홈에서 축종을 고른다(PRD-v1.1 3절 7)·8)).
 *
 * 고양이·강아지는 큰 선택지 두 개, 기타는 그 아래 작은 텍스트 링크다(기타는 전체 공고의 2%대라
 * 같은 무게로 두면 빈 목록에 가깝다, 12.A P12). 고른 축종은 쿠키에 기억해 다음 `/` 진입에서 홈을 건너뛴다.
 * 지역은 목록에서 넘겨받은 값을 그대로 다음 목록에 실어 보내고, 기억하지는 않는다(결정 G2).
 *
 * TODO(디자인): 캐릭터 일러스트와 선택지 레이아웃은 시안이 없어 임시다. 시안이 나오면 교체한다(architecture.md 12절).
 */
const BIG_CHOICES: readonly AnimalSpecies[] = ["cat", "dog"];

export function SpeciesChoice({ area }: { area: AnimalArea }) {
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
    <div className="mt-6 flex flex-col gap-4">
      <div className="flex gap-3">
        {BIG_CHOICES.map((species) => (
          <Link
            key={species}
            href={listHref(species)}
            onClick={() => rememberSpecies(species)}
            className="flex min-h-[180px] flex-1 items-center justify-center rounded-card bg-canvas text-card-title text-text transition-transform duration-press ease-out active:scale-press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            {/* TODO(디자인): 여기에 캐릭터가 들어간다 */}
            {SPECIES_LABEL[species]}
          </Link>
        ))}
      </div>
      <Link
        href={listHref("other")}
        onClick={() => rememberSpecies("other")}
        className="inline-flex min-h-touch items-center justify-center self-center px-3 text-body text-text-2 underline underline-offset-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        {ANIMAL_COPY.homeOtherLink}
      </Link>
    </div>
  );
}
