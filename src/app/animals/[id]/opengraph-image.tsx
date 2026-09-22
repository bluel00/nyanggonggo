import { toAnimal } from "@/entities/animal";
import { getAnimalService } from "@/server/animals/container";
import { SERVER_TUNING } from "@/server/config";
import { consoleLogger } from "@/server/logger";
import { fetchOgImage, loadOgFonts } from "@/server/og/og-assets";
import { createHttpClient } from "@/shared/api/http-client";
import { SERVICE_NAME } from "@/shared/config/service";
import { OG_SIZE, renderOgImage } from "./og-image";
import { buildOgModel, type OgModel } from "./og-model";

/**
 * 상세 페이지별 OG 이미지. 사진 풀블리드, 좌상단 서비스명 pill, 좌하단 흰 카드(상태 배지 + D-day + 제목 + 보조).
 *
 * 캐시: 1시간(revalidate 3600, 응답 Cache-Control은 SERVER_TUNING.ogImageCacheControl). D-day는 KST 자정에 바뀌고
 * 상태는 서버 캐시(300초) 주기로 바뀌므로 최대 1시간 늦게 반영될 수 있다. 링크 미리보기용이라 이 지연을 받아들이고
 * 렌더 비용(원본 이미지 fetch + satori)을 줄인다. 조회나 사진이 실패해도 오류 대신 기본 이미지를 그린다.
 */
export const alt = `${SERVICE_NAME} 유기동물 공고`;
export const size = OG_SIZE;
export const contentType = "image/png";
export const revalidate = 3600;

const ID_PATTERN = /^\d{1,32}$/;
const fontsPromise = loadOgFonts(undefined, consoleLogger);

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const fonts = await fontsPromise;
  const model = ID_PATTERN.test(id) ? await loadModel(id) : null;
  const photo = model
    ? await fetchOgImage(model.imageSrc, createHttpClient(), { timeoutMs: SERVER_TUNING.imageProxyTimeoutMs, logger: consoleLogger })
    : null;
  return renderOgImage(model, photo, fonts, { "Cache-Control": SERVER_TUNING.ogImageCacheControl });
}

async function loadModel(id: string): Promise<OgModel | null> {
  try {
    return buildOgModel(toAnimal(await getAnimalService().getById(id)), new Date());
  } catch {
    return null;
  }
}
