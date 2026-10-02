import {
  animalTitle,
  getDDay,
  getPrimaryImage,
  getStatusVariant,
  speciesText,
  statusBadgeText,
  type Animal,
  type AnimalStatusVariant,
} from "@/entities/animal";

/**
 * OG 이미지와 상세 메타데이터에 쓰는 표시값. Domain 파생값(상태, D-day)을 쓰므로 서버가 아니라 app 계층에 둔다.
 * 문구 규칙은 카드/상세와 같다: 제목은 `animalTitle`(지역, 기타 축종만 "<동물> · <지역>"), 보조는 보호소(없으면 발견 장소),
 * 배지는 상태만, D-day는 종료가 아니고 있을 때만. 링크 미리보기 제목(`buildOgText`)은 "<지역> <동물> 공고" 형식이라 `region`을 따로 둔다.
 */
export type OgModel = {
  /** OG 이미지에 그리는 제목(카드 1줄과 같은 규칙) */
  title: string;
  /** 링크 미리보기 제목이 쓰는 지역. 이미지에는 쓰지 않는다 */
  region: string;
  sub: string | null;
  speciesLabel: string;
  variant: AnimalStatusVariant;
  badgeText: string;
  dDayText: string | null;
  imageSrc: string | null;
  ended: boolean;
};

export function buildOgModel(animal: Animal, now: Date): OgModel {
  const variant = getStatusVariant(animal, now);
  const ended = variant === "ended";
  const dDay = ended ? null : getDDay(animal, now);
  return {
    title: animalTitle(animal),
    region: animal.regionText,
    sub: animal.shelterName ?? animal.foundPlaceText,
    speciesLabel: speciesText(animal),
    variant,
    badgeText: statusBadgeText(variant, null),
    dDayText: dDay === null ? null : dDay === 0 ? "D-day" : `D-${dDay}`,
    imageSrc: getPrimaryImage(animal),
    ended,
  };
}

/** 메타데이터 제목/설명(카카오·SNS 링크 미리보기) */
export function buildOgText(model: OgModel, serviceName: string) {
  const status = model.dDayText ? `${model.badgeText} · ${model.dDayText}` : model.badgeText;
  return {
    title: `${model.region} ${model.speciesLabel} 공고 | ${serviceName}`,
    description: [status, model.sub].filter(Boolean).join(" · "),
  };
}

/** satori는 CSS 변수를 지원하지 않아 토큰 값(docs/design/tokens.css)을 hex로 옮겨 쓴다 */
export const OG_COLORS = {
  bg: "#FFFFFF",
  canvas: "#F5F5F5",
  text: "#111111",
  text2: "#666666",
  photoPill: "rgba(255,255,255,0.9)",
  status: {
    protected: { dot: "#2E9F6B", bg: "#E6F6EE", text: "#1F7A50" },
    soon: { dot: "#F08A24", bg: "#FDF0E1", text: "#A85508" },
    ended: { dot: "#8A8A8A", bg: "#EFEFEF", text: "#666666" },
  },
} as const;
