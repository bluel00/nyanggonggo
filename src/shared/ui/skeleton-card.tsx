import { cn } from "@/shared/lib/utils";

/**
 * 카드 모양 스켈레톤(bundle.css .cn-skel). 사진 4:5 + 14px/12px 두 줄.
 * 움직임 원칙(README Motion: 카드 누름, 시트, 토스트 외에는 움직이지 않음)에 따라 펄스 애니메이션은 넣지 않는다.
 */
export function SkeletonCard({ className }: { className?: string }) {
  return (
    <div aria-hidden data-slot="skeleton-card" className={cn("overflow-hidden rounded-card", className)}>
      <div className="aspect-4/5 rounded-card bg-status-ended-bg" />
      <div className="mt-3 h-3.5 rounded-[7px] bg-status-ended-bg" />
      <div className="mt-2 h-3 w-3/5 rounded-[6px] bg-status-ended-bg" />
    </div>
  );
}
