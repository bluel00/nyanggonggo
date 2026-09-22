import type { ReactNode } from "react";
import { SPECIES_LABEL, type AnimalListFilter } from "@/entities/animal";

/**
 * 목록 헤더(handoff 화면 1~2): 왼쪽 타이틀("고양이 공고" / "강아지 공고"), 오른쪽 액션(필터 버튼).
 * sticky, 세로 space-3 / 가로 space-4, 스크롤 구분선 없음. 찜(하트) 버튼은 /favorites와 함께 다음 단계에서 넣는다.
 */
export function AnimalListHeader({ species, actions }: { species: AnimalListFilter["species"]; actions?: ReactNode }) {
  return (
    <header className="sticky top-0 z-10 flex items-center justify-between gap-2 bg-bg px-page pt-[calc(var(--space-3)+env(safe-area-inset-top,0px))] pb-3">
      <h1 className="text-title">{SPECIES_LABEL[species]} 공고</h1>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </header>
  );
}
