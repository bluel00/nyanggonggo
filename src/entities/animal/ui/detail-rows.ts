import type { Animal } from "../model/animal";
import { animalTitle, sexAgeText } from "./labels";
import { statusDisplayGlyphs } from "./status-text";

/**
 * 정보 줄 끝 동작의 종류(역할 이름). 지금은 보호소 줄 끝의 [보호소 정보] 하나다(이슈 #62). 무엇을 그릴지는 상세 위젯이 정한다
 * (보호소 정보 시트는 features/shelter-info).
 */
export type DetailRowAction = "shelterInfo";

/** 상세 정보 줄의 이름. 줄 규칙(detailRows)과 함께 바뀌어 같은 파일에 둔다 */
export const DETAIL_ROW_LABELS = {
  foundPlace: "발견 장소",
  shelter: "보호소",
  noticeNo: "공고 번호",
  noticePeriod: "공고 기간",
  endReason: "종료 사유",
  specialMark: "특이사항",
} as const;

/** 줄 끝 동작의 문구. text는 보이는 글자, label은 접근성 이름이다(용어 사전 "보호소 정보 시트") */
export const DETAIL_ROW_ACTION_COPY: Record<DetailRowAction, { text: string; label: string }> = {
  shelterInfo: { text: "보호소 정보", label: "보호소 정보 보기" },
};

/** 상세 정보 줄 하나. 값은 원문 그대로이고 비어 있지 않다 */
export type DetailRow = { label: string; value: string; action: DetailRowAction | null };

/**
 * 상세 정보 줄(명세 4.3, 이슈 #3·#30·#41·#59·#62): 발견 장소 → 보호소 → 공고 번호 → 공고 기간 → 종료 사유 → 특이사항. 값이 없는 줄은 뺀다.
 * 줄을 더하거나 순서·이름을 바꿀 때는 이 파일만 고친다(상세 화면과 글꼴 예열이 모두 이 결과를 쓴다).
 * - 보호소 주소·전화는 정보 줄에 두지 않고 보호소 정보 시트에 둔다(#62). 보호소 줄 끝에 시트를 여는 [보호소 정보]를 붙인다:
 *   종료 공고이거나 주소·전화가 모두 없으면 붙이지 않는다(보호소 이름 줄은 그대로).
 * - 종료 사유: 원문 그대로. 특이사항과 같은 문구면 서버 Mapper가 특이사항을 비워 종료 사유 줄 하나로 보인다.
 */
export function detailRows(animal: Animal): DetailRow[] {
  const labels = DETAIL_ROW_LABELS;
  const shelterInfo = animal.status !== "ended" && Boolean(animal.shelterAddressText || animal.shelterTelText);
  const rows: { label: string; value: string | null; action: DetailRowAction | null }[] = [
    { label: labels.foundPlace, value: animal.foundPlaceText, action: null },
    { label: labels.shelter, value: animal.shelterName, action: shelterInfo ? "shelterInfo" : null },
    // 공고 번호: 원문 그대로, 복사할 수 있는 보통 글자(구조 번호 id는 보이지 않는다, #59)
    { label: labels.noticeNo, value: animal.noticeNoText, action: null },
    { label: labels.noticePeriod, value: animal.noticePeriodText, action: null },
    { label: labels.endReason, value: animal.endReasonText, action: null },
    { label: labels.specialMark, value: animal.specialMarkText, action: null },
  ];
  return rows.filter((row): row is DetailRow => row.value !== null && row.value !== "");
}

/**
 * 상세 화면에 보일 글자(제목, 상태·D-day, 성별·나이, 정보 줄 이름·값, 링크 글자). 카드를 누를 때 이 글자의 글꼴 조각을 미리 받는 데 쓴다
 * (architecture.md 14.2 4단계): 카드 → 상세 전환은 새 화면의 글꼴을 다 받을 때까지 커밋을 기다려, 받지 않은 글자가 있으면 그만큼 늦게 떴다.
 * 줄 값은 `detailRows` 결과라 화면에 보이는 줄의 글자만 받는다(주소·전화는 보호소 정보 시트에 있어 받지 않는다, 이슈 #30·#62).
 */
export function detailDisplayText(animal: Animal): string {
  return [
    animalTitle(animal),
    statusDisplayGlyphs(animal),
    sexAgeText(animal),
    ...Object.values(DETAIL_ROW_LABELS),
    ...Object.values(DETAIL_ROW_ACTION_COPY).map((action) => action.text),
    ...detailRows(animal).map((row) => row.value),
  ].join(" ");
}
