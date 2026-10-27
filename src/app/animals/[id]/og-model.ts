import {
  animalSubtitle,
  animalTitle,
  dDayText,
  getDDay,
  getStatusVariant,
  statusBadgeText,
  type Animal,
  type AnimalStatusVariant,
} from "@/entities/animal";
import { buildShareContent, type ShareContent } from "@/features/animal-share";
import { siteOrigin } from "@/shared/config/site-origin";

/**
 * 링크 미리보기(OG 메타·OG 이미지)의 어댑터(#73). Domain 파생값(상태, D-day)을 쓰므로 서버가 아니라 app 계층에 둔다.
 * 제목 바탕·공유 요약·사진·주소는 공유 내용 계약(`buildShareContent`)에서 받는다. 여기서 덧붙이는 것은 링크 미리보기에만 필요한 것이다:
 * OG 메타 제목의 " 공고 | 서비스 이름"(`buildOgText`), OG 이미지의 제목(`animalTitle`: 지역, 기타 축종만 "<동물> · <지역>"),
 * 보조 줄(보호소, 없으면 발견 장소), 상태 칩(상태만)과 D-N(종료가 아니고 있을 때만).
 */
export type OgModel = {
  /** OG 이미지에 그리는 제목(카드 1줄과 같은 규칙) */
  title: string;
  sub: string | null;
  variant: AnimalStatusVariant;
  badgeText: string;
  dDayText: string | null;
  /** OG 이미지 바탕 사진(공유 내용의 사진) */
  imageSrc: string | null;
  ended: boolean;
  /** 공유 내용. OG 메타의 제목 바탕·설명(공유 요약)·주소가 여기서 온다 */
  share: ShareContent;
};

/** now는 서버가 요청을 받은 시각이다(공유 카드는 기기 시각, #57). origin은 공유 내용의 절대 주소 기준(서버 siteOrigin) */
export function buildOgModel(animal: Animal, now: Date, origin: string = siteOrigin().origin): OgModel {
  const variant = getStatusVariant(animal, now);
  const ended = variant === "ended";
  const dDay = getDDay(animal, now);
  const share = buildShareContent(animal, { origin, now });
  return {
    title: animalTitle(animal),
    sub: animalSubtitle(animal),
    variant,
    badgeText: statusBadgeText(animal, now, { dDay: false }),
    dDayText: dDay === null ? null : dDayText(dDay),
    imageSrc: share.photoSrc,
    ended,
    share,
  };
}

/** OG 메타 제목/설명(링크 미리보기). 제목은 공유 내용의 제목 바탕 + " 공고 | 서비스 이름", 설명은 공유 요약 */
export function buildOgText(model: OgModel, serviceName: string) {
  return {
    title: `${model.share.title} 공고 | ${serviceName}`,
    description: model.share.summary,
  };
}

/**
 * satori는 CSS 변수를 지원하지 않아 토큰 값(docs/design/tokens.css)을 hex로 옮겨 쓴다. 키는 토큰 이름이다.
 * 사진 위 흰 카드는 앱의 카드 정보 칸과 같은 surface다(bg는 화면 바탕이라 사진 위 카드에 쓰지 않는다, #64)
 */
export const OG_COLORS = {
  surface: "#FFFFFF",
  canvas: "#F5F5F5",
  text: "#2B211B",
  text2: "#6B5A4C",
  photoPill: "rgba(255,255,255,0.9)",
  status: {
    protected: { dot: "#2E9F6B", bg: "#E6F6EE", text: "#1F7A50" },
    nearDeadline: { dot: "#F08A24", bg: "#FDF0E1", text: "#A85508" },
    ended: { dot: "#8A8A8A", bg: "#EFEFEF", text: "#666666" },
  },
} as const;
