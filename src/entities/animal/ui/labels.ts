import type { Animal } from "../model/animal";
import { statusShareText } from "./status-text";

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
  favoritesTitle: "관심 공고",
  /** 목록 위에 얹은 상세 층의 이름. 상세 제목이 아직 없을 때(뼈대)만 쓰인다(PRD-v1.5) */
  detailLayerLabel: "공고 상세",
  favoritesEmptyTitle: "아직 관심 공고가 없어요",
  /** 관심 목록 빈 상태 설명(용어 사전 "관심 목록", #58) */
  favoritesEmptyDescription: "하트를 눌러 관심 공고에 담아 보세요",
  favoritesErrorTitle: "지금은 관심 공고를 불러오지 못했어요",
  /** 찜 목록 위 한 줄. 일부 공고만 오류로 받지 못했을 때(이슈 #5) */
  favoritesPartialError: "일부 공고를 불러오지 못했어요",
  detailErrorTitle: "지금은 공고를 불러오지 못했어요",
  /* 상세 정보 줄의 이름과 줄 끝 링크 문구는 줄 규칙과 함께 ui/detail-rows.ts에 있다(이슈 #30) */
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

/** 공고 사진의 alt: "<축종> 사진, <지역>". 카드와 상세가 같이 쓴다(상세 캐러셀은 뒤에 사진 번호를 붙인다) */
export function photoAlt(animal: Pick<Animal, "species" | "kindText" | "regionText">): string {
  return `${speciesText(animal)} 사진, ${animal.regionText}`;
}

/** 카드 2줄과 OG 이미지 보조 줄: 보호소, 없으면 발견 장소. 둘 다 없으면 null(줄을 그리지 않는다) */
export function animalSubtitle(animal: Pick<Animal, "shelterName" | "foundPlaceText">): string | null {
  return animal.shelterName ?? animal.foundPlaceText;
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
 * 공유 요약(공고 한 줄 요약): 성별 · 나이 · 상태(· 공고 마감 M월 D일(요)) · 특이사항. 밖으로 나가는 것이라 마감은 날짜다(#57). 앱 안에서는 쓰지 않는다. 카카오 공유 카드 설명과 링크 미리보기(og·twitter) 설명이 같은 문자열을 쓴다(이슈 #2).
 * 상태는 statusShareText(종료는 "종료 · <결과>" 또는 "종료", 마감이 지났거나 마감일이 없으면 "보호중"). 특이사항은 원문 그대로이고 줄바꿈·연속 공백만 공백 하나로 바꾼다. 비어 있으면 뺀다.
 * 길이는 자르지 않는다: 카카오 피드 템플릿은 설명에 글자 수 제한이 없고 2줄을 넘으면 줄임표로 보인다(카카오 개발자 문서 메시지 템플릿 공통).
 */
export function animalSummaryText(animal: Animal, now: Date): string {
  const status = statusShareText(animal, now);
  const specialMark = animal.specialMarkText?.replace(/\s+/g, " ").trim() || null;
  return [sexAgeText(animal), status, specialMark].filter(Boolean).join(" · ");
}

