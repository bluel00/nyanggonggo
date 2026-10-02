import { expect, test } from "@playwright/test";
import {
  isCardInView,
  LIST_PAGE_SIZE,
  loadRealItems,
  mockList,
  rememberSpeciesCookie,
  scrollListToBottom,
  watchConsoleErrors,
  type ListItem,
} from "./helpers";

/**
 * 목록 무한쿼리는 재요청하지 않는다(architecture.md 5절, 12절 42).
 * 무한쿼리 refetch는 쌓인 페이지를 **처음 커서부터 전부 순차로** 다시 받아서, 50페이지를 본 목록으로
 * 돌아오면 /api/animals가 51번 나갔다. staleTime을 늘리면 미뤄질 뿐이라 refetch 자체를 껐다.
 *
 * 시간은 `page.clock.setFixedTime`으로 옮긴다(Date.now만 바꾸고 타이머는 그대로 두므로 스크롤 복원의
 * requestAnimationFrame이 그대로 동작한다).
 */

/** 클라이언트 staleTime(60초)보다 넉넉히 긴 시간 */
const PAST_STALE_MS = 3 * 60_000;

/** 목록 API로 나간 요청 중 마지막으로 본 시점 이후의 것 */
function requestsSince(requests: URL[], mark: number): string[] {
  return requests.slice(mark).map((url) => `${url.pathname}?${url.searchParams}`);
}

let items: ListItem[];
test.beforeAll(async ({ request }) => {
  items = await loadRealItems(request);
});

const consoleWatch = watchConsoleErrors();
test.beforeEach(async ({ page, context }) => {
  consoleWatch.attach(page);
  // 이 파일의 관심사는 축종이 아니다. 축종 기억을 심어 `/`가 홈을 건너뛰고 목록으로 가게 한다
  await rememberSpeciesCookie(context);
});
test.afterEach(() => consoleWatch.assertNone());

/** 2페이지까지 받아 둔 목록. 돌려주는 값은 목록 요청 기록과 지금까지의 요청 수 */
async function loadTwoPages(page: import("@playwright/test").Page, now: Date) {
  await page.clock.setFixedTime(now);
  const requests = await mockList(page, items);
  await page.goto("/");
  await expect(page.locator("[data-animal-id]")).toHaveCount(LIST_PAGE_SIZE);
  await scrollListToBottom(page);
  await expect(page.locator("[data-animal-id]")).toHaveCount(LIST_PAGE_SIZE * 2);
  return requests;
}

test("staleTime이 지난 뒤 상세에서 돌아와도 목록을 다시 받지 않는다", async ({ page }) => {
  const now = new Date();
  const requests = await loadTwoPages(page, now);

  const target = page.locator("[data-animal-id]").nth(LIST_PAGE_SIZE + 2); // 2페이지의 카드
  const animalId = (await target.getAttribute("data-animal-id"))!;
  await target.locator("a").click();
  await expect(page).toHaveURL(new RegExp(`/animals/${animalId}$`));
  await expect(page.getByRole("button", { name: "뒤로가기" })).toBeVisible();

  // 상세를 보는 동안 목록 데이터가 오래된다
  await page.clock.setFixedTime(new Date(now.getTime() + PAST_STALE_MS));
  const mark = requests.length;

  await page.getByRole("button", { name: "뒤로가기" }).click();
  await expect(page.locator(`[data-animal-id="${animalId}"]`)).toBeVisible();
  await expect(page.locator("[data-animal-id]")).toHaveCount(LIST_PAGE_SIZE * 2);
  expect(await isCardInView(page, animalId), "열었던 카드가 보인다").toBe(true);

  // 뒤늦게 나가는 요청까지 본다(무한쿼리 refetch는 페이지를 순차로 받으므로 첫 요청만 막아도 여기서 드러난다)
  await page.waitForTimeout(1500);
  expect(requestsSince(requests, mark), "뒤로가기로 목록 요청이 나가지 않는다").toEqual([]);
});

test("목록에서 앱으로 복귀하거나 네트워크가 돌아와도 다시 받지 않는다", async ({ page }) => {
  const now = new Date();
  const requests = await loadTwoPages(page, now);

  await page.clock.setFixedTime(new Date(now.getTime() + PAST_STALE_MS));
  const mark = requests.length;

  // TanStack은 window의 visibilitychange로 focus를, online으로 재연결을 본다
  await page.evaluate(() => {
    window.dispatchEvent(new Event("visibilitychange"));
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
  });

  await page.waitForTimeout(1500);
  expect(requestsSince(requests, mark), "복귀/재연결로 목록 요청이 나가지 않는다").toEqual([]);
});

test("필터를 바꾸면 그 필터로 새로 받는다", async ({ page }) => {
  const requests = await mockList(page, items);
  await page.goto("/");
  await expect(page.locator("[data-animal-id]")).toHaveCount(LIST_PAGE_SIZE);
  const mark = requests.length;

  await page.getByRole("button", { name: "필터" }).click();
  await page.getByRole("radio", { name: "종료임박순" }).click();
  await page.getByRole("button", { name: "적용하기" }).click();
  await expect(page).toHaveURL(/sort=endingSoon/);
  await expect(page.locator("[data-animal-id]")).toHaveCount(LIST_PAGE_SIZE);

  const after = requests.slice(mark);
  expect(after.length, "새 필터로 요청이 나간다").toBeGreaterThan(0);
  expect(after.every((url) => url.searchParams.get("sort") === "endingSoon")).toBe(true);
});

test("새로고침하면 다시 받는다", async ({ page }) => {
  const requests = await mockList(page, items);
  await page.goto("/");
  await expect(page.locator("[data-animal-id]")).toHaveCount(LIST_PAGE_SIZE);
  const mark = requests.length;

  await page.reload();
  await expect(page.locator("[data-animal-id]")).toHaveCount(LIST_PAGE_SIZE);
  expect(requests.slice(mark).length, "새 문서라 캐시가 없어 첫 페이지를 받는다").toBeGreaterThan(0);
});
