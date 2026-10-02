import { ChevronDown } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { ANIMAL_COPY, SPECIES_COPY, type AnimalListFilter } from "@/entities/animal";
import { homeHref } from "@/features/animal-filter";

/**
 * 목록 헤더(handoff 화면 1~2): 왼쪽 타이틀("고양이 공고" / "강아지 공고" / "기타 동물 공고"),
 * 오른쪽 액션(찜 목록 하트, 필터 버튼 순서). sticky, 세로 space-3 / 가로 space-4, 스크롤 구분선 없음.
 *
 * 타이틀 전체가 홈(축종 선택)으로 가는 링크다. 보고 있던 지역을 함께 넘겨 홈에서 고른 축종이 같은 지역의
 * 목록으로 가게 한다(결정 G2). 하트·필터 위치와 44px 터치 영역은 그대로다.
 *
 * TODO(디자인): 진입점의 모양(타이틀 옆 chevron)은 시안이 없어 임시다. 시안이 나오면 교체한다(architecture.md 12절).
 */
export function AnimalListHeader({ filter, actions }: { filter: AnimalListFilter; actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-bg px-page pt-[calc(var(--space-3)+env(safe-area-inset-top,0px))] pb-3">
      <Link
        href={homeHref({ region: filter.region, district: filter.district })}
        className="inline-flex min-h-touch items-center gap-1 text-text transition-transform duration-press ease-out active:scale-press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
      >
        <h1 className="text-title">{SPECIES_COPY[filter.species].listTitle}</h1>
        <ChevronDown aria-hidden className="size-5" strokeWidth={1.8} />
        <span className="sr-only">{ANIMAL_COPY.homeEntryLabel}</span>
      </Link>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
