import type { Animal } from "./animal";

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const SOON_THRESHOLD_DAYS = 3;

/** KST 달력 기준 일 번호 */
const kstDayNumber = (date: Date) =>
  Math.floor((date.getTime() + KST_OFFSET_MS) / DAY_MS);

/**
 * 공고 종료일까지 남은 일수(KST 달력 기준). 당일은 0.
 * 종료 공고, 종료일이 없는 공고, 종료일이 지난 보호중 공고는 null(architecture.md 10절).
 */
export function getDDay(
  animal: Pick<Animal, "status" | "noticeEndAt">,
  now: Date,
): number | null {
  if (animal.status === "ended" || animal.noticeEndAt === null) return null;
  const days = kstDayNumber(animal.noticeEndAt) - kstDayNumber(now);
  return days < 0 ? null : days;
}

/** D-day가 있고 3 이하일 때만 임박. */
export function isSoon(animal: Pick<Animal, "status" | "noticeEndAt">, now: Date): boolean {
  const dDay = getDDay(animal, now);
  return dDay !== null && dDay <= SOON_THRESHOLD_DAYS;
}
