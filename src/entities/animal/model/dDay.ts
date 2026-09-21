import type { Animal } from "./animal";

const DAY_MS = 24 * 60 * 60 * 1000;
const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const SOON_THRESHOLD_DAYS = 3;

/** KST 달력 기준 일 번호 */
const kstDayNumber = (date: Date) =>
  Math.floor((date.getTime() + KST_OFFSET_MS) / DAY_MS);

/**
 * 공고 종료일까지 남은 일수(KST 달력 기준). 당일은 0.
 * 종료일이 지난 경우도 0으로 clamp한다. 지남 처리 정책은 미정(architecture.md 12절 10).
 */
export function getDDay(noticeEndAt: Date, now: Date): number {
  return Math.max(0, kstDayNumber(noticeEndAt) - kstDayNumber(now));
}

/** 보호 중이고 D-day가 3 이하일 때만 임박. 종료 공고와 종료일 없는 공고는 false. */
export function isSoon(animal: Animal, now: Date): boolean {
  if (animal.status !== "protected" || animal.noticeEndAt === null) return false;
  return getDDay(animal.noticeEndAt, now) <= SOON_THRESHOLD_DAYS;
}
