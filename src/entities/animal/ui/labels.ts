import type { Animal } from "../model/animal";
import { getDDay } from "../model/dDay";
import { getStatusVariant } from "../model/status";
import { statusBadgeText } from "./status-badge";

/** 축종 표기. 필터 옵션, 사진 alt, 공유 제목이 함께 쓴다. */
export const SPECIES_LABEL: Record<Animal["species"], string> = {
  cat: "고양이",
  dog: "강아지",
  other: "기타 동물",
};

/**
 * 축종에 따라 달라지는 문구를 한곳에 모은다(architecture.md 7절).
 * 조사가 붙는 문장("…가 없어요", "…를 불러오지")은 라벨에 템플릿을 붙여 만들 수 없어
 * 축종별로 문장을 그대로 적는다.
 */
export type SpeciesCopy = {
  /** 목록 헤더 타이틀(handoff 화면 1~2) */
  listTitle: string;
  /** 조건에 맞는 공고가 없을 때(handoff 화면 6) */
  emptyTitle: string;
  /** 목록을 불러오지 못했을 때(handoff 화면 6) */
  errorTitle: string;
};

export const SPECIES_COPY: Record<Animal["species"], SpeciesCopy> = {
  cat: {
    listTitle: "고양이 공고",
    emptyTitle: "조건에 맞는 고양이가 없어요",
    errorTitle: "지금은 고양이를 불러오지 못했어요",
  },
  dog: {
    listTitle: "강아지 공고",
    emptyTitle: "조건에 맞는 강아지가 없어요",
    errorTitle: "지금은 강아지를 불러오지 못했어요",
  },
  other: {
    listTitle: "기타 동물 공고",
    emptyTitle: "조건에 맞는 기타 동물이 없어요",
    errorTitle: "지금은 기타 동물을 불러오지 못했어요",
  },
};

/**
 * 축종이 섞이는 화면(찜 목록), 축종을 알 수 없는 화면(상세 조회 실패), 축종을 고르는 화면(홈)의 문구. 축종 중립이다.
 * 찜 목록은 고양이, 강아지가 함께 들어오므로 명세 4.5.2의 "고양이" 문구를 "공고"로 바꿔 쓴다.
 */
export const ANIMAL_COPY = {
  /** 홈(축종 선택) 화면. 문구는 시안("냥공고 홈 · 축종 선택"의 Main) 그대로다 */
  homeTitle: "오늘은 누구를 보러 왔어요?",
  /** 시안의 줄바꿈을 지킨다. 화면은 `whitespace-pre-line`으로 그린다 */
  homeDescription: "한 번 고르면 기억해둘게요.\n목록에서 언제든 바꿀 수 있어요.",
  /** 기타 축종으로 가는 작은 텍스트 링크(고양이·강아지와 같은 무게로 두지 않는다) */
  homeOtherLink: "다른 동물들도 있어요",
  /** 목록 헤더의 홈 진입점 링크 이름(aria-label). 타이틀 뒤에 붙여 "고양이 공고, 다른 동물 고르기"로 읽힌다(시안 Header-A) */
  homeEntryLabel: (listTitle: string) => `${listTitle}, 다른 동물 고르기`,
  favoritesTitle: "찜한 공고",
  /** 목록 위에 얹은 상세 층의 이름. 상세 제목이 아직 없을 때(뼈대)만 쓰인다(PRD-v1.5) */
  detailLayerLabel: "공고 상세",
  favoritesEmptyTitle: "아직 찜한 공고가 없어요",
  /** 🐾는 README가 허용한 유일한 이모지(찜 빈 상태) */
  favoritesEmptyDescription: "마음에 드는 공고를 저장해보세요 🐾",
  favoritesErrorTitle: "지금은 찜한 공고를 불러오지 못했어요",
  detailErrorTitle: "지금은 공고를 불러오지 못했어요",
  /** 상세 정보 줄의 이름 */
  detailRowLabels: {
    foundPlace: "발견 장소",
    shelter: "보호소",
    shelterAddress: "주소",
    shelterTel: "전화",
    noticePeriod: "공고 기간",
    specialMark: "특이사항",
  },
  /** 주소·전화 줄 끝의 작은 글자 링크. text는 보이는 글자, label은 접근성 이름이다(이슈 #3) */
  detailContactActions: {
    map: { text: "지도", label: "지도에서 주소 보기(새 탭)" },
    tel: { text: "전화", label: "보호소에 전화" },
  },
  /** 나이를 모를 때 */
  ageUnknown: "나이 미상",
} as const;

/**
 * 화면에 쓰는 축종 텍스트. 기타 축종은 "기타 동물"이 아니라 실제 동물 이름(토끼, 앵무새…)을 쓴다.
 * 업스트림 `kindFullNm`에서 뽑은 `kindText`가 그 이름이며, 뽑을 수 없으면 라벨("기타 동물")로 돌아간다.
 * 사진 alt, 공유 제목, OG 제목, 카드/상세 타이틀이 함께 쓴다.
 */
export function speciesText(animal: Pick<Animal, "species" | "kindText">): string {
  if (animal.species !== "other") return SPECIES_LABEL[animal.species];
  return animal.kindText ?? SPECIES_LABEL.other;
}

/**
 * 카드 1줄과 상세 타이틀. Domain에 이름이 없어 기본은 지역이고, 기타 축종은 어떤 동물인지를
 * 지역 앞에 붙인다("토끼 · 서울특별시 성동구"). 기타 공고의 카드/상세 디자인은 시안이 없어 임시다(12절 43).
 */
export function animalTitle(animal: Pick<Animal, "species" | "kindText" | "regionText">): string {
  return animal.species === "other" ? `${speciesText(animal)} · ${animal.regionText}` : animal.regionText;
}

/** 성별 표기(handoff 화면 3: 암컷 / 수컷 / 성별 미상, 임의 결정) */
export const SEX_LABEL: Record<Animal["sex"], string> = {
  female: "암컷",
  male: "수컷",
  unknown: "성별 미상",
};

/** 성별 · 나이. 상세 제목 아래 줄과 공유 설명이 같은 표기를 쓴다(모르면 "성별 미상", "나이 미상") */
export function sexAgeText(animal: Pick<Animal, "sex" | "ageText">): string {
  return `${SEX_LABEL[animal.sex]} · ${animal.ageText ?? ANIMAL_COPY.ageUnknown}`;
}

/**
 * 공고 한 줄 요약: 성별 · 나이 · 상태(· D-N) · 특이사항. 카카오 공유 카드 설명과 링크 미리보기(og·twitter) 설명이 같은 문자열을 쓴다(이슈 #2).
 * 상태는 배지와 같은 문구다(종료는 "종료"). 특이사항은 원문 그대로이고 줄바꿈·연속 공백만 공백 하나로 바꾼다. 비어 있으면 뺀다.
 * 길이는 자르지 않는다: 카카오 피드 템플릿은 설명에 글자 수 제한이 없고 2줄을 넘으면 줄임표로 보인다(카카오 개발자 문서 메시지 템플릿 공통).
 */
export function animalSummaryText(animal: Animal, now: Date): string {
  const variant = getStatusVariant(animal, now);
  const status = statusBadgeText(variant, variant === "ended" ? null : getDDay(animal, now));
  const specialMark = animal.specialMarkText?.replace(/\s+/g, " ").trim() || null;
  return [sexAgeText(animal), status, specialMark].filter(Boolean).join(" · ");
}

/**
 * 상세 화면에 보일 글자(제목, 상태·D-day, 성별·나이, 정보 줄 이름과 값). 카드를 누를 때 이 글자의 글꼴 조각을 미리 받는 데 쓴다
 * (architecture.md 14.2 4단계): 카드 → 상세 전환은 새 화면의 글꼴을 다 받을 때까지 커밋을 기다려, 받지 않은 글자가 있으면 그만큼 늦게 떴다.
 */
export function detailDisplayText(animal: Animal): string {
  return [
    animalTitle(animal),
    "보호중 임박 종료 · D-day 0123456789",
    sexAgeText(animal),
    ...Object.values(ANIMAL_COPY.detailRowLabels),
    ...Object.values(ANIMAL_COPY.detailContactActions).map((action) => action.text),
    animal.shelterName,
    animal.foundPlaceText,
    animal.shelterAddressText,
    animal.shelterTelText,
    animal.noticePeriodText,
    animal.specialMarkText,
  ]
    .filter(Boolean)
    .join(" ");
}
