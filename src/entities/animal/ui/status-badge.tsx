import { cn } from "@/shared/lib/utils";
import type { AnimalStatusVariant } from "../model/status";

/**
 * 상태 배지(bundle.css .cn-badge). 높이 24px, 점 6px, 좌우 8/10px, 텍스트는 badge 스타일.
 * 문구는 bundle.js badgeText와 같다: 종료 → "종료", 그 외 → "보호중|임박" + (dDay가 있으면 " · D-n" / 당일 "D-day").
 * 점 색은 포인트 색(status-*), 글자는 대비를 맞춘 -text 토큰만 쓴다.
 */
const VARIANT_CLASS: Record<AnimalStatusVariant, { badge: string; dot: string }> = {
  protected: { badge: "bg-status-protected-bg text-status-protected-text", dot: "bg-status-protected" },
  soon: { badge: "bg-status-soon-bg text-status-soon-text", dot: "bg-status-soon" },
  ended: { badge: "bg-status-ended-bg text-status-ended-text", dot: "bg-status-ended" },
};

export function statusBadgeText(variant: AnimalStatusVariant, dDay: number | null): string {
  if (variant === "ended") return "종료";
  const label = variant === "soon" ? "임박" : "보호중";
  if (dDay === null) return label;
  return `${label} · ${dDay === 0 ? "D-day" : `D-${dDay}`}`;
}

export function StatusBadge({
  variant,
  dDay,
  onPhoto = false,
  className,
}: {
  variant: AnimalStatusVariant;
  dDay: number | null;
  /** 사진 위에 올릴 때 흰 90% 배경(photo-pill) */
  onPhoto?: boolean;
  className?: string;
}) {
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
      {statusBadgeText(variant, dDay)}
    </span>
  );
}
