import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isAnimalId } from "@/contract/animals";
import { animalKeys, type Animal } from "@/entities/animal";
import { createQueryClient } from "@/shared/api/query-client";
import { SERVICE_NAME } from "@/shared/config/service";
import { AnimalDetailView } from "@/views/animal-detail";
import { getAnimalForRequest, getDetailPerf, getPhotoSizeForRequest } from "./animal-data";
import { detailPath, siteOpenGraph } from "../../site-metadata";
import { buildOgModel, buildOgText } from "./og-model";

/**
 * 링크 미리보기용 제목/설명(og 이미지는 같은 폴더의 opengraph-image.tsx가 붙인다).
 * 페이지와 같은 요청 단위 캐시(getAnimalForRequest)를 쓴다. 실패하면 기본 메타데이터. site_name·type·url은 빌더(app/site-metadata.ts, #69).
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!isAnimalId(id)) return {};
  try {
    const text = buildOgText(buildOgModel(await getAnimalForRequest(id), new Date()), SERVICE_NAME);
    return {
      title: text.title,
      description: text.description,
      openGraph: { ...siteOpenGraph(detailPath(id)), title: text.title, description: text.description },
    };
  } catch {
    return { openGraph: siteOpenGraph(detailPath(id)) };
  }
}

/**
 * 서버에서 조회한 공고(generateMetadata와 같은 캐시 결과)를 TanStack Query 캐시에 미리 채워 넘긴다.
 * 클라이언트 useAnimal은 같은 쿼리 키로 이 데이터를 쓰고(staleTime 안이라) /api를 다시 부르지 않는다.
 * 서버 조회가 실패하면 prefetch는 예외를 던지지 않고 실패한 쿼리는 넘기지 않으므로, 클라이언트가 직접 조회해 오류 화면을 보인다.
 *
 * 첫 사진의 가로·세로도 서버에서 읽어 넘긴다(PRD v1.3). 사진 칸 비율이 서버 HTML에 들어가 사진이 로드될 때 화면이 밀리지 않는다.
 * 시간 초과(300ms)나 실패면 null이고 칸은 1:1이다.
 *
 * 요청마다 공공 API·사진 크기 읽기·전체 시간을 로그 한 줄로 남긴다(architecture.md 12절 52). 동작에는 영향이 없다.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  // 형식이 다른 id는 조회하지 않고 404
  if (!isAnimalId(id)) notFound();
  const perf = getDetailPerf(id);
  const queryClient = createQueryClient();
  await queryClient.prefetchQuery({ queryKey: animalKeys.detail(id), queryFn: () => getAnimalForRequest(id) });
  const animal = queryClient.getQueryData<Animal>(animalKeys.detail(id));
  const firstPhoto = animal?.images[0];
  if (!firstPhoto) perf.skipImageSize();
  const firstPhotoSize = firstPhoto ? await getPhotoSizeForRequest(id, firstPhoto) : null;
  // 계측 로그 한 줄(architecture.md 12절 52). 여기까지가 데이터 준비이고 렌더는 포함하지 않는다
  perf.finish({ ok: animal !== undefined });
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AnimalDetailView id={id} firstPhotoSize={firstPhotoSize} />
    </HydrationBoundary>
  );
}
