import { expect, test, type Page } from "@playwright/test";
import {
  expectListFrom,
  firstPageRequests,
  isCardInView,
  listOrder,
  loadNextListPage,
  rememberSpeciesCookie,
  watchConsoleErrors,
  watchList,
} from "./helpers";

/**
 * 목록 무한쿼리는 재요청하지 않는다(architecture.md 5절, 12절 42).
 * 무한쿼리 refetch는 쌓인 페이지를 **처음 커서부터 전부 순차로** 다시 받아서, 50페이지를 본 목록으로
 * 돌아오면 /api/animals가 51번 나갔다. staleTime을 늘리면 미뤄질 뿐이라 refetch 자체를 껐다.
 *
 * 목록 첫 페이지는 서버가 읽어 HTML·RSC로 온다(#109). 그래서 "다시 받는다/받지 않는다"는 /api/animals 요청과 목록 주소(`/`)의 RSC 요청을
 * 함께 본다. 정렬이 반영됐는지는 화면 카드 순서를 같은 조건·정렬의 목록 API 순서와 비교해 본다(스텁은 최신순과 마감순이 다르다).
 *
 * 시간은 `page.clock.setFixedTime`으로 옮긴다(Date.now만 바꾸고 타이머는 그대로 두므로 스크롤 복원의
 * requestAnimationFrame이 그대로 동작한다).
 */

/** 클라이언트 staleTime(60초)보다 넉넉히 긴 시간 */
const PAST_STALE_MS = 3 * 60_000;

/** 서버 목록 한 페이지 건수(SERVER_TUNING.listPageSize). 스텁 고양이·서울은 30건이라 두 페이지(20 + 10)다 */
const PAGE = 20;
const ALL = 30;
const SEOUL_CAT = { species: "cat", region: "6110000" } as const;

/** 목록 API로 나간 요청 중 마지막으로 본 시점 이후의 것 */
function requestsSince(requests: URL[], mark: number): string[] {
  return requests.slice(mark).map((url) => `${url.pathname}?${url.searchParams}`);
}

/** 목록 주소(`/`)로 나간 RSC 요청(prefetch 제외)의 쿼리. 서버가 목록 첫 페이지를 다시 읽는 요청이다 */
function watchListRsc(page: Page): string[] {
  const requests: string[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    const headers = request.headers();
    if (url.pathname === "/" && headers["rsc"] && !headers["next-router-prefetch"]) requests.push(url.search);
  });
  return requests;
}

/** 화면 카드 id 순서 */
const cardOrder = (page: Page) => page.locator("[data-animal-id]").evaluateAll((els) => els.map((el) => el.getAttribute("data-animal-id")!));

const consoleWatch = watchConsoleErrors();
test.beforeEach(async ({ page, context }) => {
  consoleWatch.attach(page);
  // 이 파일의 관심사는 축종이 아니다. 축종 기억을 심어 `/`가 홈을 건너뛰고 목록으로 가게 한다
  await rememberSpeciesCookie(context);
});
test.afterEach(() => consoleWatch.assertNone());

/** 2페이지까지 받아 둔 목록. 돌려주는 값은 목록 API 요청 기록과 목록 주소 RSC 요청 기록 */
async function loadTwoPages(page: Page, now: Date) {
  await page.clock.setFixedTime(now);
  const requests = await watchList(page);
  const rsc = watchListRsc(page);
  await page.goto("/");
  await expect(page.locator("[data-animal-id]")).toHaveCount(PAGE);
  // 첫 페이지는 서버가 읽어 브라우저가 부르지 않는다
  expect(firstPageRequests(requests)).toEqual([]);
  await loadNextListPage(page);
  await expect(page.locator("[data-animal-id]")).toHaveCount(ALL);
  return { requests, rsc };
}

test("staleTime이 지난 뒤 상세에서 돌아와도 목록을 다시 받지 않는다", async ({ page }) => {
  const now = new Date();
  const { requests, rsc } = await loadTwoPages(page, now);

  const target = page.locator("[data-animal-id]").nth(PAGE + 2); // 2페이지의 카드
  const animalId = (await target.getAttribute("data-animal-id"))!;
  await target.locator("a").click();
  await expect(page).toHaveURL(new RegExp(`/animals/${animalId}$`));
  await expect(page.getByRole("button", { name: "뒤로가기" })).toBeVisible();

  // 상세를 보는 동안 목록 데이터가 오래된다
  await page.clock.setFixedTime(new Date(now.getTime() + PAST_STALE_MS));
  const mark = requests.length;
  const rscMark = rsc.length;

  await page.getByRole("button", { name: "뒤로가기" }).click();
  await expect(page.locator(`[data-animal-id="${animalId}"]`)).toBeVisible();
  await expect(page.locator("[data-animal-id]")).toHaveCount(ALL);
  expect(await isCardInView(page, animalId), "열었던 카드가 보인다").toBe(true);

  // 뒤늦게 나가는 요청까지 본다(무한쿼리 refetch는 페이지를 순차로 받으므로 첫 요청만 막아도 여기서 드러난다)
  await page.waitForTimeout(1500);
  expect(requestsSince(requests, mark), "뒤로가기로 목록 요청이 나가지 않는다").toEqual([]);
  expect(rsc.slice(rscMark), "뒤로가기로 목록 페이지를 서버에 다시 요청하지 않는다").toEqual([]);
});

test("목록에서 앱으로 복귀하거나 네트워크가 돌아와도 다시 받지 않는다", async ({ page }) => {
  const now = new Date();
  const { requests, rsc } = await loadTwoPages(page, now);

  await page.clock.setFixedTime(new Date(now.getTime() + PAST_STALE_MS));
  const mark = requests.length;
  const rscMark = rsc.length;

  // TanStack은 window의 visibilitychange로 focus를, online으로 재연결을 본다
  await page.evaluate(() => {
    window.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
  });

  await page.waitForTimeout(1500);
  expect(requestsSince(requests, mark), "복귀/재연결로 목록 요청이 나가지 않는다").toEqual([]);
  expect(rsc.slice(rscMark), "복귀/재연결로 목록 페이지를 서버에 다시 요청하지 않는다").toEqual([]);
});

test("필터를 바꾸면 그 필터로 새로 받는다", async ({ page, request }) => {
  const [latest, deadline] = await Promise.all([listOrder(request, SEOUL_CAT), listOrder(request, SEOUL_CAT, "sort=deadline")]);
  expect(deadline, "스텁은 최신순과 마감순이 다르다").not.toEqual(latest);
  const requests = await watchList(page);
  const rsc = watchListRsc(page);
  await page.goto("/");
  await expect(page.locator("[data-animal-id]")).toHaveCount(PAGE);
  expect(await cardOrder(page)).toEqual(latest);
  const rscMark = rsc.length;

  await page.getByRole("button", { name: "필터" }).click();
  await page.getByRole("radio", { name: "공고 마감 빠른순" }).click();
  await page.getByRole("button", { name: "적용하기" }).click();
  await expect(page).toHaveURL(/sort=deadline/);
  // 서버가 새 정렬(마감순)로 읽은 첫 페이지다. 화면 카드 순서가 같은 조건의 마감순 목록과 같다
  await expect.poll(() => cardOrder(page)).toEqual(deadline);
  await expectListFrom(page, SEOUL_CAT);

  // 새 필터의 첫 페이지는 목록 주소의 RSC 요청 한 번으로 오고, 브라우저가 /api/animals로 다시 받지 않는다(같은 데이터를 두 번 받지 않는다)
  expect(rsc.slice(rscMark).filter((search) => search.includes("sort=deadline"))).toHaveLength(1);
  expect(firstPageRequests(requests)).toEqual([]);
});

test("옛 정렬 링크(sort=endingSoon, #57에서 deadline으로 바뀜)는 기본 정렬(최신순)로 열린다", async ({ page, request }) => {
  const [latest, deadline] = await Promise.all([listOrder(request, SEOUL_CAT), listOrder(request, SEOUL_CAT, "sort=deadline")]);
  await watchList(page);
  await page.goto("/?species=cat&region=6110000&sort=endingSoon");
  await expect(page.locator("[data-animal-id]")).toHaveCount(PAGE);
  // 서버가 기본 정렬(최신순)로 읽었다(모르는 값은 기본값으로 읽는다. 별칭 해석 없음). 마감순이 아니다
  expect(await cardOrder(page)).toEqual(latest);
  expect(await cardOrder(page)).not.toEqual(deadline);
  await page.getByRole("button", { name: "필터" }).click();
  await expect(page.getByRole("radio", { name: "최신순" })).toBeChecked();
});

test("새로고침하면 다시 받는다", async ({ page }) => {
  await watchList(page);
  await page.goto("/");
  await expect(page.locator("[data-animal-id]")).toHaveCount(PAGE);
  const first = (await cardOrder(page))[0]!;

  const response = await page.reload();
  await expect(page.locator("[data-animal-id]")).toHaveCount(PAGE);
  // 새 문서라 캐시가 없어 서버가 첫 페이지를 다시 읽어 문서에 담아 보낸다
  expect(await response!.text(), "새로고침한 문서에 첫 페이지 카드가 들어 있다").toContain(`data-animal-id="${first}"`);
});
