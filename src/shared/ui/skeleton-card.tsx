import { cn } from "@/shared/lib/utils";

/**
 * 카드 모양 스켈레톤(bundle.css .cn-skel). 흰 카드 + shadow-card-ended, 사진 1:1(AnimalCard와 같은 칸) + 글줄 셋(좌우 12px).
 * 글줄은 AnimalCard 글자 칸과 같은 줄 상자(위 10px, card-title 24px · body 20px · caption 16px, 사이 2px, 아래 12px)이고
 * 막대(14px · 12px · 12px)는 줄 상자 가운데에 둔다. 셋째 줄은 공고 번호 줄 자리다(#84). 그래서 공고 번호가 있는 카드와 높이가 같아
 * 사진이 와도 아래가 밀리지 않는다.
 * 움직임 원칙(README Motion: 카드 누름, 시트, 토스트 외에는 움직이지 않음)에 따라 펄스 애니메이션은 넣지 않는다.
 */
/** 스켈레톤 카드 자리(data-slot). 목록 위젯이 첫 화면 카드 수를 잴 때 이 셀렉터로 찾는다(이슈 #31) */
const SKELETON_CARD_SLOT = "skeleton-card";
export const SKELETON_CARD_SELECTOR = `[data-slot="${SKELETON_CARD_SLOT}"]`;

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div aria-hidden data-slot={SKELETON_CARD_SLOT} className={cn("overflow-hidden rounded-card bg-surface shadow-card-ended", className)}>
      <div className="aspect-square bg-status-ended-bg" />
      <div className="px-3 pt-2.5 pb-3">
        <div data-slot="skeleton-line" className="flex h-6 items-center">
          <div className="h-3.5 w-full rounded-[7px] bg-status-ended-bg" />
        </div>
        <div data-slot="skeleton-line" className="mt-0.5 flex h-5 items-center">
          <div className="h-3 w-3/5 rounded-[6px] bg-status-ended-bg" />
        </div>
        <div data-slot="skeleton-line" className="mt-0.5 flex h-4 items-center">
          <div className="h-3 w-1/2 rounded-[6px] bg-status-ended-bg" />
        </div>
      </div>
    </div>
  );
}
