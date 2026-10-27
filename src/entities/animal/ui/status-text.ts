import type { Animal } from "../model/animal";
import { getDDay } from "../model/dDay";
import { getStatusVariant } from "../model/status";

/*
 * 상태·마감 표기 규칙(이슈 #29·#41·#49·#57). 배지 모양(status-badge.tsx)과 따로 둔다: 문구만 쓰는 곳(공유·링크 미리보기 요약, OG, 글꼴 예열)이
 * 컴포넌트 파일을 import하지 않게 한다. React를 import하지 않는다.
 *
 * 마감 표기는 앱 안은 상대 표기(D-N, 열 때마다 지금 시각으로 계산), 밖으로 나가는 것(공유 카드·링크 미리보기 설명·OG 이미지)은
 * 날짜다(용어 사전 "마감 표기", #57). 마감이 가까운 공고(nearDeadline)는 색으로만 구분하고 문구는 같다.
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000;
const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"] as const;

/** 카드 배지의 마감 부분: "마감 D-N", 당일 "오늘 마감" */
export function cardDeadlineText(dDay: number): string {
  return dDay === 0 ? "오늘 마감" : `마감 D-${dDay}`;
}

/** 상세의 마감 표기: "공고 마감 D-N", 당일 "오늘 마감" */
export function detailDeadlineText(dDay: number): string {
  return dDay === 0 ? "오늘 마감" : `공고 마감 D-${dDay}`;
}

/**
 * 밖으로 나가는 마감 표기: "공고 마감 M월 D일(요)". 월·일 앞에 0을 붙이지 않고, 요일은 한 글자, "일"과 "(" 사이에 공백이 없다.
 * 날짜는 KST로 자른다(getDDay와 같은 고정 +9시간). Intl/ICU의 공백 처리에 기대지 않고 직접 만든다.
 */
export function deadlineDateText(noticeEndAt: Date): string {
  const kst = new Date(noticeEndAt.getTime() + KST_OFFSET_MS);
  return `공고 마감 ${kst.getUTCMonth() + 1}월 ${kst.getUTCDate()}일(${WEEKDAYS[kst.getUTCDay()]})`;
}

/** 상태 표기에 필요한 공고 값 */
export type StatusSubject = Pick<Animal, "status" | "noticeEndAt" | "endResultText">;

/** 상태 낱말: 종료는 "종료 · <결과>"(결과가 없으면 "종료"), 그 밖은 "보호중"(마감이 가까워도 같다, 색으로만 구분) */
function statusLabel(animal: StatusSubject, now: Date): string {
  if (getStatusVariant(animal, now) === "ended") return animal.endResultText ? `종료 · ${animal.endResultText}` : "종료";
  return "보호중";
}

/**
 * 앱 안 상태 표기(카드 배지, 상세 배지). 표기를 바꿀 때는 이 함수만 고친다(부르는 곳은 공고와 기준 시각만 넘긴다).
 * - 종료: "종료 · <결과>"(결과는 processState 괄호 안 원문), 결과가 없으면 "종료". 마감 표기는 붙이지 않는다.
 * - 그 외: "보호중" + (마감 전이면 " · 마감 D-N" / 당일 " · 오늘 마감"). `dDay: false`면 마감 표기를 붙이지 않는다
 *   (상세는 마감 표기를 배지 옆에 따로 크게 그린다).
 */
export function statusBadgeText(animal: StatusSubject, now: Date, { dDay: withDDay = true }: { dDay?: boolean } = {}): string {
  const label = statusLabel(animal, now);
  const dDay = withDDay ? getDDay(animal, now) : null;
  return dDay === null ? label : `${label} · ${cardDeadlineText(dDay)}`;
}

/**
 * 밖으로 나가는 상태 표기(공유 요약 = 공유 카드 설명·링크 미리보기 설명). "보호중 · 공고 마감 M월 D일(요)", 마감이 지났거나
 * 마감일이 없으면 "보호중", 종료는 앱 안과 같다. now는 마감이 지났는지(날짜를 붙일지)를 가리는 데만 쓴다.
 */
export function statusShareText(animal: StatusSubject, now: Date): string {
  const label = statusLabel(animal, now);
  return getDDay(animal, now) === null || animal.noticeEndAt === null ? label : `${label} · ${deadlineDateText(animal.noticeEndAt)}`;
}

/**
 * 앱 안 상태 표기에 나올 수 있는 글자(상세 글꼴 예열용, architecture.md 14.2). 표기 함수에서 만들어 문구가 바뀌면 따라온다.
 * 밖으로 나가는 날짜 표기는 앱 화면에 나오지 않으니 넣지 않는다. 종료 결과는 공고마다 달라 그 공고의 것을 더한다.
 */
export function statusDisplayGlyphs(animal: Pick<Animal, "endResultText">): string {
  return ["보호중", "종료 ·", cardDeadlineText(0), detailDeadlineText(1), "0123456789", animal.endResultText].filter(Boolean).join(" ");
}
