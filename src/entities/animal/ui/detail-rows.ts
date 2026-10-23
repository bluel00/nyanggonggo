import type { Animal } from "../model/animal";
import { kakaoMapSearchUrl, telHref } from "../model/shelter-contact";
import { animalTitle, sexAgeText } from "./labels";

/** 정보 줄 끝 링크의 동작 종류(역할 이름). 링크 주소는 `detailRowHref`가 이 종류에서 만든다 */
export type DetailRowAction = "map" | "call";

/** 상세 정보 줄의 이름. 줄 규칙(detailRows)과 함께 바뀌어 같은 파일에 둔다 */
export const DETAIL_ROW_LABELS = {
  foundPlace: "발견 장소",
  shelter: "보호소",
  shelterAddress: "주소",
  shelterTel: "전화",
  noticePeriod: "공고 기간",
  specialMark: "특이사항",
} as const;

/** 줄 끝의 작은 글자 링크 문구(이슈 #3). text는 보이는 글자, label은 접근성 이름이다 */
export const DETAIL_ROW_ACTION_COPY: Record<DetailRowAction, { text: string; label: string }> = {
  map: { text: "지도", label: "지도에서 주소 보기(새 탭)" },
  call: { text: "전화", label: "보호소에 전화" },
};

/** 상세 정보 줄 하나. 값은 원문 그대로이고 비어 있지 않다 */
export type DetailRow = { label: string; value: string; action: DetailRowAction | null };

/**
 * 상세 정보 줄(명세 4.3, 이슈 #3·#30): 발견 장소 → 보호소 → 주소 → 전화 → 공고 기간 → 특이사항. 값이 없는 줄은 뺀다.
 * 줄을 더하거나 순서·이름을 바꿀 때는 이 파일만 고친다(상세 화면과 글꼴 예열이 모두 이 결과를 쓴다).
 * - 주소·전화: 종료 공고는 둘 다 숨긴다(보호소 이름은 그대로). 주소 줄 끝에는 지도, 전화 줄 끝에는 전화 링크.
 *   전화에 숫자가 없으면 줄은 두고 링크만 뺀다.
 */
export function detailRows(animal: Animal): DetailRow[] {
  const contact = animal.status !== "ended";
  const labels = DETAIL_ROW_LABELS;
  const tel = contact ? animal.shelterTelText : null;
  const rows: { label: string; value: string | null; action: DetailRowAction | null }[] = [
    { label: labels.foundPlace, value: animal.foundPlaceText, action: null },
    { label: labels.shelter, value: animal.shelterName, action: null },
    { label: labels.shelterAddress, value: contact ? animal.shelterAddressText : null, action: "map" },
    { label: labels.shelterTel, value: tel, action: tel !== null && telHref(tel) !== null ? "call" : null },
    { label: labels.noticePeriod, value: animal.noticePeriodText, action: null },
    { label: labels.specialMark, value: animal.specialMarkText, action: null },
  ];
  return rows.filter((row): row is DetailRow => row.value !== null && row.value !== "");
}

/** 줄 끝 링크의 주소. 지도는 주소 검색, 전화는 `tel:` 숫자만. 동작이 없으면 null */
export function detailRowHref(row: DetailRow): string | null {
  switch (row.action) {
    case "map":
      return kakaoMapSearchUrl(row.value);
    case "call":
      return telHref(row.value);
    case null:
      return null;
  }
}

/**
 * 상세 화면에 보일 글자(제목, 상태·D-day, 성별·나이, 정보 줄 이름·값, 링크 글자). 카드를 누를 때 이 글자의 글꼴 조각을 미리 받는 데 쓴다
 * (architecture.md 14.2 4단계): 카드 → 상세 전환은 새 화면의 글꼴을 다 받을 때까지 커밋을 기다려, 받지 않은 글자가 있으면 그만큼 늦게 떴다.
 * 줄 값은 `detailRows` 결과라 화면에 보이는 줄의 글자만 받는다(종료 공고는 숨기는 주소·전화를 받지 않는다, 이슈 #30).
 */
export function detailDisplayText(animal: Animal): string {
  return [
    animalTitle(animal),
    "보호중 임박 종료 · D-day 0123456789",
    sexAgeText(animal),
    ...Object.values(DETAIL_ROW_LABELS),
    ...Object.values(DETAIL_ROW_ACTION_COPY).map((action) => action.text),
    ...detailRows(animal).map((row) => row.value),
  ].join(" ");
}
