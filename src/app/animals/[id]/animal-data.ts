import { cache } from "react";
import { toAnimal, type Animal } from "@/entities/animal";
import { getAnimalService } from "@/server/animals/container";
import { SERVER_TUNING } from "@/server/config";
import { createImageSizeReader, type ImageSize } from "@/server/images/image-size";
import { createNextImageSizeCache } from "@/server/images/next-image-size-cache";
import { consoleLogger } from "@/server/logger";
import { createRequestPerf } from "@/server/perf/request-perf";

/**
 * 상세 요청 계측(architecture.md 12절 52). React cache라 한 요청 안에서 generateMetadata와 페이지가 같은 기록을 쓰고,
 * 둘 중 먼저 부른 쪽이 시작 시각이 된다. 로그는 페이지가 데이터를 다 준비한 뒤 남긴다(page.tsx).
 */
export const getDetailPerf = cache((id: string) => createRequestPerf("detail", { id }));

/**
 * 상세 공고 조회(서버). React cache로 감싸 한 요청 안에서 generateMetadata와 페이지가 같은 결과를 쓴다(조회 1회).
 * 캐시 범위는 서버 요청 하나다. OG 이미지 라우트는 별도 요청이라 이 캐시를 공유하지 않는다(업스트림 페이지 캐시만 공유).
 */
export const getAnimalForRequest = cache(
  async (id: string): Promise<Animal> => toAnimal(await getAnimalService(getDetailPerf(id)).getById(id)),
);

const readImageSize = createImageSizeReader({
  timeoutMs: SERVER_TUNING.imageSizeTimeoutMs,
  maxBytes: SERVER_TUNING.imageSizeMaxBytes,
  cache: createNextImageSizeCache(SERVER_TUNING.imageSizeRevalidateSeconds),
  logger: consoleLogger,
});

/**
 * 상세 첫 사진의 가로·세로(PRD v1.3). 사진 칸 비율을 서버 HTML에 넣어 사진이 로드될 때 화면이 밀리지 않게 한다.
 * URL별 캐시(성공만), 시간 초과 300ms. 모르면 null(칸 1:1). architecture.md 12절 50.
 */
export const getPhotoSizeForRequest = cache(
  (id: string, src: string): Promise<ImageSize | null> =>
    getDetailPerf(id).measureImageSize((onResult) => readImageSize(src, onResult)),
);
