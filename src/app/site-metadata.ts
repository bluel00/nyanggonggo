import type { Metadata } from "next";
import {
  hasRegionParam,
  homeHref,
  parseAnimalArea,
  parseAnimalFilter,
  toListHref,
  type SearchParamsInput,
} from "@/features/animal-filter";
import { SERVICE_NAME, SERVICE_TAGLINE } from "@/shared/config/service";
import { routes } from "@/shared/config/routes";
import { siteOrigin } from "@/shared/config/site-origin";
import { OG_SIZE } from "./animals/[id]/og-image";

/*
 * 링크 미리보기(og·twitter) 메타데이터 빌더(#69). 페이지마다 openGraph를 정해야 하는 이유: Next는 openGraph를 얕게 합쳐
 * 자식 세그먼트가 openGraph를 정하면 부모 것이 통째로 대체된다. 그래서 공통 값(site_name, type, url)은 여기 한곳에서 만들고
 * 각 페이지는 이 함수만 부른다.
 *
 * 주소는 상대 경로로 넘기고, 루트 레이아웃의 metadataBase(SITE_METADATA_BASE)가 절대 주소로 푼다. 그 값은 shared/config/site-origin.ts가
 * Vercel 공개 시스템 환경변수로 만든다(Vercel 운영은 운영 주소, 미리보기는 미리보기 주소, 로컬은 localhost, #71). 상세 og:image가 쓰던
 * Next 기본 기준과 같은 순서다. Next는 metadataBase가 없으면 이미지에만 그 기준을 쓰고 og:url은 상대 경로로 두기 때문에 명시한다.
 * twitter는 정하지 않는다: Next가 openGraph(제목·설명·이미지)를 이어받고 이미지가 있으면 summary_large_image로 만든다(상세와 같다).
 * 사이트 og:image는 루트 opengraph-image.tsx(상세의 대체 이미지 재사용)다. 페이지가 openGraph를 정하면 루트의 파일 이미지가
 * 이어지지 않아 주소를 직접 넣는다.
 */

/** 링크 미리보기 절대 주소의 기준(루트 레이아웃 metadataBase) */
export const SITE_METADATA_BASE = siteOrigin();

/** 사이트 og:image(루트 opengraph-image.tsx가 그린다) */
export const SITE_OG_IMAGE = {
  url: routes.ogImage(),
  ...OG_SIZE,
  type: "image/png",
  alt: `${SERVICE_NAME} 유기동물 공고`,
} as const;

/** 모든 페이지의 og 공통 값: site_name, type, url */
export function siteOpenGraph(path: string): NonNullable<Metadata["openGraph"]> {
  return { siteName: SERVICE_NAME, type: "website", url: path };
}

/** 사이트 OG 설명: 한 줄 소개를 한 줄로(줄바꿈 자리를 공백으로) */
export const SITE_DESCRIPTION = SERVICE_TAGLINE.replace(/\s*\n\s*/g, " ");

/**
 * 상세가 아닌 페이지(홈, 목록, 관심)의 검색엔진 설명(`<meta name="description">`)과 링크 미리보기. 설명은 둘 다 한 줄 소개,
 * 미리보기 제목은 서비스 이름. `<title>`은 부르는 쪽이 정한다. 상세는 공고마다 설명을 따로 만든다(animals/[id]/page.tsx)
 */
export function siteMetadata(path: string): Pick<Metadata, "description" | "openGraph"> {
  return {
    description: SITE_DESCRIPTION,
    openGraph: { ...siteOpenGraph(path), title: SERVICE_NAME, description: SITE_DESCRIPTION, images: [SITE_OG_IMAGE] },
  };
}

/**
 * 목록 주소: 계약으로 해석한 필터 값만으로 쿼리를 다시 만든다. 계약에 없는 파라미터(utm_* 등)와 잘못된 값은 버린다.
 * 목록은 주소에 축종·지역이 있을 때만 그려지므로(없으면 리다이렉트) 기억 쿠키를 보지 않는다.
 */
export function listPath(params: SearchParamsInput): string {
  return toListHref(parseAnimalFilter(params));
}

/** 홈 주소: 목록에서 넘겨받은 지역이 주소에 있으면 그 지역만 남기고, 없으면 `/home` */
export function homePath(params: SearchParamsInput): string {
  return hasRegionParam(params) ? homeHref(parseAnimalArea(params)) : routes.home();
}
