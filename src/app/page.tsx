import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  REGION_COOKIE,
  resolveAnimalListEntry,
  SPECIES_COOKIE,
  type SearchParamsInput,
} from "@/features/animal-filter";
import { AnimalListView } from "@/views/animal-list";

/**
 * 목록 화면. URL search params(단일 진실 소스)를 서버에서 파싱해 views에 넘긴다.
 * 필터 적용(router.replace)으로 URL이 바뀌면 이 컴포넌트가 새 searchParams로 다시 렌더되어 목록 쿼리 키가 바뀐다.
 * 클라이언트에서 useSearchParams로 다시 읽지 않으므로 Suspense 경계가 필요 없다.
 *
 * 무엇을 할지(그린다 / 리다이렉트한다)는 순수 함수 `resolveAnimalListEntry`가 정한다(architecture.md 7절).
 * 이 페이지는 쿠키 두 개를 읽어 넘기고 결과를 따르기만 한다. 축종 기억이 없으면 홈(`/home`)으로 간다.
 * 이 페이지는 searchParams 때문에 이미 동적 렌더다.
 */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  const entry = resolveAnimalListEntry(params, {
    species: cookieStore.get(SPECIES_COOKIE)?.value,
    region: cookieStore.get(REGION_COOKIE)?.value,
  });
  if (entry.kind === "redirect") redirect(entry.href);
  return <AnimalListView filter={entry.filter} focusId={entry.focusId} />;
}
