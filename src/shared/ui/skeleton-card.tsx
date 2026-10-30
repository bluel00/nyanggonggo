import type { ReactNode } from "react";
import { cn } from "@/shared/lib/utils";

/**
 * 카드 모양 스켈레톤(bundle.css .cn-skel). 흰 카드 + shadow-card-ended, 사진 1:1(AnimalCard와 같은 칸) + 글줄 셋(좌우 12px).
 * 글줄은 AnimalCard 글자 칸과 같은 줄 상자(위 10px, card-title 24px · body 20px · caption 16px, 사이 2px, 아래 12px)이고
 * 막대(14px · 12px · 12px)는 줄 상자 가운데에 둔다. 셋째 줄은 공고 번호 줄 자리다(#84). 그래서 공고 번호가 있는 카드와 높이가 같아
 * 사진이 와도 아래가 밀리지 않는다.
 * 사진 칸과 막대에는 첫 프레임부터 로딩 시머가 지나간다(handoff (j) L1, `data-shimmer`는 app/globals.css). 등장 효과는 없다.
 * wait: 사진 칸 가운데, 시머 위에 둘 것(목록 첫 페이지의 로딩 캐릭터, L2). 이것이 있으면 카드 전체를 읽기에서 숨기지 않고
 * 그림·막대만 숨긴다(문구가 읽히도록. 문구는 나타나기 전까지 visibility: hidden이다).
 */
/** 스켈레톤 카드 자리(data-slot). 목록 위젯이 첫 화면 카드 수를 잴 때 이 셀렉터로 찾는다(이슈 #31) */
const SKELETON_CARD_SLOT = "skeleton-card";
export const SKELETON_CARD_SELECTOR = `[data-slot="${SKELETON_CARD_SLOT}"]`;

export function SkeletonCard({ wait, className }: { wait?: ReactNode; className?: string }) {
  return (
    <div
      aria-hidden={wait ? undefined : true}
      data-slot={SKELETON_CARD_SLOT}
      className={cn("overflow-hidden rounded-card bg-surface shadow-card-ended", className)}
    >
      <div data-slot="skeleton-photo" data-shimmer="" className="aspect-square bg-status-ended-bg">
        {wait && <div className="absolute inset-0 z-1 flex items-center justify-center">{wait}</div>}
      </div>
      <div aria-hidden className="px-3 pt-2.5 pb-3">
        <div data-slot="skeleton-line" className="flex h-6 items-center">
          <div data-shimmer="" className="h-3.5 w-full rounded-[7px] bg-status-ended-bg" />
        </div>
        <div data-slot="skeleton-line" className="mt-0.5 flex h-5 items-center">
          <div data-shimmer="" className="h-3 w-3/5 rounded-[6px] bg-status-ended-bg" />
        </div>
        <div data-slot="skeleton-line" className="mt-0.5 flex h-4 items-center">
          <div data-shimmer="" className="h-3 w-1/2 rounded-[6px] bg-status-ended-bg" />
        </div>
      </div>
    </div>
  );
}
