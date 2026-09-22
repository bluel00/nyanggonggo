import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { animalKeys } from "@/entities/animal";
import { createQueryClient } from "@/shared/api/query-client";
import { SERVICE_NAME } from "@/shared/config/service";
import { AnimalDetailView } from "@/views/animal-detail";
import { getAnimalForRequest } from "./animal-data";
import { buildOgModel, buildOgText } from "./og-model";

/** 공고 id는 숫자 문자열(desertionNo). 형식이 다르면 조회하지 않고 404 */
const ID_PATTERN = /^\d{1,32}$/;

/**
 * 링크 미리보기용 제목/설명(og 이미지는 같은 폴더의 opengraph-image.tsx가 붙인다).
 * 페이지와 같은 요청 단위 캐시(getAnimalForRequest)를 쓴다. 실패하면 기본 메타데이터.
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) return {};
  try {
    const text = buildOgText(buildOgModel(await getAnimalForRequest(id), new Date()), SERVICE_NAME);
    return { title: text.title, description: text.description, openGraph: { title: text.title, description: text.description } };
  } catch {
    return {};
  }
}

/**
 * 서버에서 조회한 공고(generateMetadata와 같은 캐시 결과)를 TanStack Query 캐시에 미리 채워 넘긴다.
 * 클라이언트 useAnimal은 같은 쿼리 키로 이 데이터를 쓰고(staleTime 안이라) /api를 다시 부르지 않는다.
 * 서버 조회가 실패하면 prefetch는 예외를 던지지 않고 실패한 쿼리는 넘기지 않으므로, 클라이언트가 직접 조회해 오류 화면을 보인다.
 */
export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) notFound();
  const queryClient = createQueryClient();
  await queryClient.prefetchQuery({ queryKey: animalKeys.detail(id), queryFn: () => getAnimalForRequest(id) });
  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <AnimalDetailView id={id} />
    </HydrationBoundary>
  );
}
