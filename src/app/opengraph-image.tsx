import { consoleLogger } from "@/server/logger";
import { loadOgFonts, loadOgLogo } from "@/server/og/og-assets";
import { OG_SIZE, renderOgImage } from "./animals/[id]/og-image";
import { SITE_OG_IMAGE } from "./site-metadata";

/**
 * 사이트 링크 미리보기 이미지(홈, 목록, 관심, #69). 새 그림을 만들지 않고 상세의 대체 이미지(서비스 이름 + "유기동물 공고")를
 * 그대로 다시 쓴다. 상세는 같은 폴더의 자기 opengraph-image가 앞선다. 페이지 메타데이터는 SITE_OG_IMAGE로 이 주소를 넣는다.
 */
export const alt = SITE_OG_IMAGE.alt;
export const size = OG_SIZE;
export const contentType = "image/png";

const assetsPromise = Promise.all([loadOgFonts(undefined, consoleLogger), loadOgLogo(undefined, consoleLogger)]);

export default async function Image() {
  const [fonts, logo] = await assetsPromise;
  return renderOgImage(null, null, fonts, logo);
}
