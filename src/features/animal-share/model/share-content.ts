import { toImageProxyUrl } from "@/contract/images";
import {
  getDDay,
  getPrimaryImage,
  getStatusVariant,
  SPECIES_LABEL,
  statusBadgeText,
  type Animal,
} from "@/entities/animal";
import type { ShareContent } from "./share";

/**
 * 공유 콘텐츠. 제목은 지역 기반(카드 1줄과 같은 규칙) + 축종, 설명은 상태 배지 문구와 보호소.
 * 썸네일은 대표 사진의 이미지 프록시 절대 URL(https 페이지에서 http 원본을 쓰지 않도록), 사진이 없으면 OG 이미지.
 */
export function buildShareContent(animal: Animal, origin: string, now: Date): ShareContent {
  const url = `${origin}/animals/${animal.id}`;
  const variant = getStatusVariant(animal, now);
  const badge = statusBadgeText(variant, variant === "ended" ? null : getDDay(animal, now));
  const primary = getPrimaryImage(animal);
  const proxied = primary ? toImageProxyUrl(primary) : null;
  return {
    url,
    title: `${animal.regionText} ${SPECIES_LABEL[animal.species]}`,
    description: [badge, animal.shelterName].filter(Boolean).join(" · "),
    imageUrl: proxied ? `${origin}${proxied}` : `${url}/opengraph-image`,
  };
}
