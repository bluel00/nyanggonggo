import { parseAnimalFilter, type SearchParamsInput } from "@/features/animal-filter";
import { HomeView } from "@/views/home";

/**
 * 목록 화면. URL search params(단일 진실 소스)를 서버에서 파싱해 views에 넘긴다.
 * 필터 적용(router.replace)으로 URL이 바뀌면 이 컴포넌트가 새 searchParams로 다시 렌더되어 목록 쿼리 키가 바뀐다.
 * 클라이언트에서 useSearchParams로 다시 읽지 않으므로 Suspense 경계가 필요 없다.
 */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const filter = parseAnimalFilter(await searchParams);
  return <HomeView filter={filter} />;
}
