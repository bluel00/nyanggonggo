"use client";

import { useEffect } from "react";
import { scrollAppToTop } from "@/shared/ui/app-column";
import { BackButton, useGoBack } from "@/shared/ui/back-button";

/**
 * 상세 뼈대(명세 7.1, 스켈레톤은 SkeletonCard와 같은 status-ended-bg 면, 움직임 없음).
 *
 * 두 곳이 같은 뼈대를 쓴다: 라우트 로딩 경계(`app/animals/[id]/loading.tsx`, 카드를 누른 즉시)와
 * 상세 위젯의 조회 대기(`useAnimal`이 pending). 그래서 뼈대 → 실제 상세로 바뀔 때 레이아웃이 튀지 않게
 * 실제 상세(`AnimalDetail`)와 같은 구조·치수로 둔다:
 * - 사진 4:5 + 캐러셀 점 줄 자리(pt-3 + 6px). 실제 공고는 모두 사진 2장 이상이라 점 줄이 늘 있다(12.A P7)
 * - 사진 위 Back 버튼(누를 수 있다. 공고를 아직 모르니 목록을 거치지 않았으면 기본 목록으로 간다)
 * - 상태 줄(D-day가 title 크기라 28px) · 제목(title 28px) · 성별/나이(body 20px) · 정보 줄
 * - 하단 CTA 바(sticky, 찜 44px 원 + 공유 버튼)
 */
export function AnimalDetailSkeleton() {
  const goBack = useGoBack("/");
  // 내부 스크롤 컨테이너는 화면을 옮겨도 유지되므로 뼈대부터 맨 위에서 보인다(실제 상세도 같은 처리를 한다)
  useEffect(() => scrollAppToTop(), []);

  return (
    <div data-slot="detail-skeleton" aria-busy="true" className="flex min-h-full flex-col">
      <div className="relative">
        <div aria-hidden className="aspect-4/5 bg-status-ended-bg" />
        <div aria-hidden className="pt-3">
          <div className="h-1.5" />
        </div>
        <div className="absolute top-[calc(var(--space-3)+env(safe-area-inset-top,0px))] left-page">
          <BackButton onClick={goBack} />
        </div>
      </div>

      <div aria-hidden className="flex-1 px-page pt-4 pb-6">
        <div className="flex h-7 items-center">
          <div className="h-6 w-24 rounded-pill bg-status-ended-bg" />
        </div>
        <div className="mt-3 h-7 w-2/3 rounded-[7px] bg-status-ended-bg" />
        <div className="mt-1 h-5 w-1/3 rounded-[6px] bg-status-ended-bg" />
        <div className="mt-6 flex flex-col gap-3">
          {["w-3/4", "w-2/3", "w-1/2"].map((width) => (
            <div key={width} className={`h-5 rounded-[6px] bg-status-ended-bg ${width}`} />
          ))}
        </div>
      </div>

      <div
        aria-hidden
        className="sticky bottom-0 z-10 flex gap-2 border-t border-border bg-bg px-page pt-3 pb-[calc(var(--space-3)+env(safe-area-inset-bottom,0px))]"
      >
        <div className="size-touch flex-none rounded-pill bg-status-ended-bg" />
        <div className="min-h-touch flex-1 rounded-pill bg-status-ended-bg" />
      </div>
    </div>
  );
}
