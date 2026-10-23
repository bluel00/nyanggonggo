import type { Animal } from "../model/animal";
import { getDDay } from "../model/dDay";
import { getStatusVariant } from "../model/status";

/*
 * 상태 표기 규칙(이슈 #29·#41·#49). 배지 모양(status-badge.tsx)과 따로 둔다: 문구만 쓰는 곳(공유·링크 미리보기 요약, OG, 글꼴 예열)이
 * 컴포넌트 파일을 import하지 않게 한다. React를 import하지 않는다.
 */

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
