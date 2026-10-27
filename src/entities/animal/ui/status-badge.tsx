import { cn } from "@/shared/lib/utils";
import { getStatusVariant, type AnimalStatusVariant } from "../model/status";
import { statusBadgeText, type StatusSubject } from "./status-text";

/**
 * 상태 배지(bundle.css .cn-badge). 높이 24px, 점 6px, 좌우 8/10px, 텍스트는 badge 스타일.
 * 문구는 `statusBadgeText`(status-text.ts)다. 점 색은 포인트 색(status-*), 글자는 대비를 맞춘 -text 토큰만 쓴다.
 * 종료 결과(입양, 자연사…)에 따라 색이나 모양을 바꾸지 않는다(이슈 #41).
 */
const VARIANT_CLASS: Record<AnimalStatusVariant, { badge: string; dot: string }> = {
  protected: { badge: "bg-status-protected-bg text-status-protected-text", dot: "bg-status-protected" },
  nearDeadline: { badge: "bg-status-soon-bg text-status-soon-text", dot: "bg-status-soon" },
  ended: { badge: "bg-status-ended-bg text-status-ended-text", dot: "bg-status-ended" },
};

export function StatusBadge({
  animal,
  now,
  dDay = true,
  onPhoto = false,
  className,
}: {
  animal: StatusSubject;
  now: Date;
  /** false면 D-day를 붙이지 않는다(상세는 배지 옆에 따로 그린다) */
  dDay?: boolean;
  /** 사진 위에 올릴 때 흰 90% 배경(photo-pill) */
  onPhoto?: boolean;
  className?: string;
}) {
  const variant = getStatusVariant(animal, now);
  const style = VARIANT_CLASS[variant];
  return (
    <span
      data-slot="status-badge"
      data-variant={variant}
      className={cn(
        "inline-flex h-6 items-center gap-1 rounded-pill pr-2.5 pl-2 text-badge whitespace-nowrap",
        style.badge,
        onPhoto && "bg-photo-pill",
        className,
      )}
    >
      <i aria-hidden className={cn("block size-1.5 flex-none rounded-full", style.dot)} />
      {statusBadgeText(animal, now, { dDay })}
    </span>
  );
}
