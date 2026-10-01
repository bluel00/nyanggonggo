import { toImageProxyUrl } from "@/contract/images";
import {
  getDDay,
  getPrimaryImage,
  getStatusVariant,
  speciesText,
  statusBadgeText,
  type Animal,
} from "@/entities/animal";
import { SITE_URL } from "@/shared/config/public-env";
import type { ShareContent } from "./share";

/**
 * 공유 링크의 기준 주소. NEXT_PUBLIC_SITE_URL이 있으면 그 값을, 없으면 현재 접속한 주소를 쓴다.
 * 배포 도메인은 카카오 개발자 콘솔 [플랫폼 > Web 사이트 도메인]에도 등록되어 있어야 카드의 링크가 동작한다.
 */
export function resolveShareOrigin(locationOrigin: string, siteUrl: string = SITE_URL): string {
  const configured = siteUrl.trim().replace(/\/+$/, "");
  return configured || locationOrigin;
}

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
    title: `${animal.regionText} ${speciesText(animal)}`,
    description: [badge, animal.shelterName].filter(Boolean).join(" · "),
    imageUrl: proxied ? `${origin}${proxied}` : `${url}/opengraph-image`,
  };
}
