import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import {
  hasRegionParam,
  parseAnimalFilter,
  parseRegionCookie,
  readFocusId,
  REGION_COOKIE,
  toFilterHref,
  toSearchParams,
  type SearchParamsInput,
} from "@/features/animal-filter";
import { HomeView } from "@/views/home";

/**
 * 목록 화면. URL search params(단일 진실 소스)를 서버에서 파싱해 views에 넘긴다.
 * 필터 적용(router.replace)으로 URL이 바뀌면 이 컴포넌트가 새 searchParams로 다시 렌더되어 목록 쿼리 키가 바뀐다.
 * 클라이언트에서 useSearchParams로 다시 읽지 않으므로 Suspense 경계가 필요 없다.
 * focus(일회성)도 여기서 읽어 넘기고, 목록이 처리한 뒤 URL에서 지운다(architecture.md 7절).
 * URL에 지역이 없을 때만 쿠키의 기억된 지역을 쓰고(URL이 우선), 그 지역을 주소에 채워 리다이렉트한다.
 * 이 페이지는 searchParams 때문에 이미 동적 렌더다.
 */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  // URL에 지역이 없으면 마지막으로 고른 지역(쿠키)으로 그린다. 첫 렌더부터 그 지역이라 깜빡임과 중복 요청이 없다
  const rememberedArea = parseRegionCookie(cookieStore.get(REGION_COOKIE)?.value);
  const filter = parseAnimalFilter(params, { rememberedArea });

  // 보여 주는 목록에는 늘 URL에 지역이 있어야 한다(7절). 지역 없이(또는 모르는 코드로) 들어오면 주소를 채워 준다.
  // 채운 뒤에는 지역이 있으므로 다시 리다이렉트하지 않는다. focus 등 다른 파라미터는 그대로 옮긴다
  if (!hasRegionParam(params)) redirect(toFilterHref("/", filter, toSearchParams(params)));

  // focus는 필터가 아니다. 공유 링크로 들어온 상세에서 뒤로 왔을 때 그 공고로 스크롤하기 위한 일회성 값이다
  return <HomeView filter={filter} focusId={readFocusId(params)} />;
}
