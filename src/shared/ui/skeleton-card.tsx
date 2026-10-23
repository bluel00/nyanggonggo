import { cn } from "@/shared/lib/utils";

/**
 * 카드 모양 스켈레톤(bundle.css .cn-skel). 흰 카드 + shadow-card-ended, 사진 1:1(AnimalCard와 같은 칸) + 14px/12px 두 줄(좌우 12px).
 * 움직임 원칙(README Motion: 카드 누름, 시트, 토스트 외에는 움직이지 않음)에 따라 펄스 애니메이션은 넣지 않는다.
 */
/** 스켈레톤 카드 자리(data-slot). 목록 위젯이 첫 화면 카드 수를 잴 때 이 셀렉터로 찾는다(이슈 #31) */
const SKELETON_CARD_SLOT = "skeleton-card";
export const SKELETON_CARD_SELECTOR = `[data-slot="${SKELETON_CARD_SLOT}"]`;

export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div aria-hidden data-slot={SKELETON_CARD_SLOT} className={cn("overflow-hidden rounded-card bg-surface shadow-card-ended", className)}>
      <div className="aspect-square bg-status-ended-bg" />
      <div className="mx-3 mt-3 h-3.5 rounded-[7px] bg-status-ended-bg" />
      <div className="mx-3 mt-2 mb-3 h-3 w-3/5 rounded-[6px] bg-status-ended-bg" />
    </div>
  );
}
