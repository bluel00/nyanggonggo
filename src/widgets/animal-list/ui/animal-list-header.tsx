import { ChevronDown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ANIMAL_COPY, SPECIES_COPY, type AnimalListFilter } from "@/entities/animal";
import { homeHref } from "@/features/animal-filter";

/**
 * 목록 헤더(handoff 화면 1~2): 왼쪽 타이틀("고양이 공고" / "강아지 공고" / "기타 동물 공고"),
 * 오른쪽 액션(찜 목록 하트, 필터 버튼 순서). sticky, 세로 space-3 / 가로 space-4, 스크롤 구분선 없음.
 *
 * 타이틀 자체가 홈(축종 선택)으로 가는 버튼 모양의 링크다(시안 Header-A, h1 안에 링크): 타이틀 + chevron-down, 높이 44px,
 * 누름 피드백. 링크 이름은 aria-label로 "고양이 공고, 다른 동물 고르기"에 고정한다(sr-only 숨김 텍스트는
 * absolute라 Chrome이 "공고 , 다른…"처럼 공백을 끼웠다). 보이는 타이틀이 이름의 앞부분이라 음성 입력으로도 부를 수 있다.
 * 보고 있던 지역을 함께 넘겨 홈에서 고른 축종이 같은 지역의 목록으로 가게 한다(결정 G2). 하트·필터 위치는 그대로다.
 *
 * 링크 안쪽 여백(space-2)만큼 왼쪽으로 당겨 타이틀 글자는 page 여백 위치에 그대로 둔다.
 * chevron은 20px에서 선이 아이콘과 같은 1.8px로 보이게 `absoluteStrokeWidth`를 쓴다(24 기준 2.16).
 */
export function AnimalListHeader({ filter, actions }: { filter: AnimalListFilter; actions?: ReactNode }) {
  const listTitle = SPECIES_COPY[filter.species].listTitle;
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-bg px-page pt-[calc(var(--space-3)+env(safe-area-inset-top,0px))] pb-3">
      <h1 className="-ml-2 text-title">
        <Link
          href={homeHref({ region: filter.region, district: filter.district })}
          aria-label={ANIMAL_COPY.homeEntryLabel(listTitle)}
          className="inline-flex min-h-touch items-center gap-1 rounded-control px-2 text-text transition-transform duration-press ease-out motion-safe:active:scale-press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          {listTitle}
          <ChevronDown aria-hidden size={20} strokeWidth={1.8} absoluteStrokeWidth />
        </Link>
      </h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
