import { cn } from "@/shared/lib/utils";
import type { Animal } from "../model/animal";
import { getDDay } from "../model/dDay";
import { getStatusVariant, type AnimalStatusVariant } from "../model/status";

/**
 * 상태 배지(bundle.css .cn-badge). 높이 24px, 점 6px, 좌우 8/10px, 텍스트는 badge 스타일.
 * 문구는 `statusBadgeText`다. 점 색은 포인트 색(status-*), 글자는 대비를 맞춘 -text 토큰만 쓴다.
 * 종료 결과(입양, 자연사…)에 따라 색이나 모양을 바꾸지 않는다(이슈 #41).
 */
const VARIANT_CLASS: Record<AnimalStatusVariant, { badge: string; dot: string }> = {
  protected: { badge: "bg-status-protected-bg text-status-protected-text", dot: "bg-status-protected" },
  soon: { badge: "bg-status-soon-bg text-status-soon-text", dot: "bg-status-soon" },
  ended: { badge: "bg-status-ended-bg text-status-ended-text", dot: "bg-status-ended" },
};

/** D-day 표기(이슈 #29): 당일은 "D-day", 그 밖은 "D-n". 배지, 상세의 D-day, OG 이미지가 모두 이것을 쓴다 */
export function dDayText(dDay: number): string {
  return dDay === 0 ? "D-day" : `D-${dDay}`;
}

/** 상태 표기에 필요한 공고 값 */
export type StatusSubject = Pick<Animal, "status" | "noticeEndAt" | "endResultText">;

/**
 * 상태 표기(이슈 #29·#41). 카드 배지, 상세 배지, 공유 카드·링크 미리보기 요약, OG 이미지 배지가 모두 이것을 쓴다.
 * 표기를 바꿀 때는 이 함수만 고친다(부르는 곳은 공고와 기준 시각만 넘긴다).
 * - 종료: "종료 · <결과>"(결과는 processState 괄호 안 원문), 결과가 없으면 "종료". D-day는 붙이지 않는다.
 * - 그 외: "보호중|임박" + (dDay가 있으면 " · D-n" / 당일 " · D-day"). `dDay: false`면 D-day를 붙이지 않는다
 *   (상세와 OG 이미지는 D-day를 배지 옆에 따로 크게 그린다).
 */
export function statusBadgeText(animal: StatusSubject, now: Date, { dDay: withDDay = true }: { dDay?: boolean } = {}): string {
  const variant = getStatusVariant(animal, now);
  if (variant === "ended") return animal.endResultText ? `종료 · ${animal.endResultText}` : "종료";
  const label = variant === "soon" ? "임박" : "보호중";
  const dDay = withDDay ? getDDay(animal, now) : null;
  if (dDay === null) return label;
  return `${label} · ${dDayText(dDay)}`;
}

/** 상태 표기에 나올 수 있는 글자(상세 글꼴 예열용, architecture.md 14.2). 종료 결과는 공고마다 달라 그 공고의 것을 더한다 */
export function statusDisplayGlyphs(animal: Pick<Animal, "endResultText">): string {
  return ["보호중 임박 종료 · D-day 0123456789", animal.endResultText].filter(Boolean).join(" ");
}

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
