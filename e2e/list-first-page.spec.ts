import { expect, test, type Page } from "@playwright/test";
import { expectListFrom, firstPageRequests, loadNextListPage, watchConsoleErrors, watchList } from "./helpers";
import { comboLatestIds, FAILING_REGION, SLOW_REGIONS } from "./stub-combo.mjs";

/**
 * 목록 첫 페이지 서버 렌더(이슈 #109). production 빌드 + 스텁 서버, Chromium·WebKit.
 * - 첫 페이지는 서버가 읽어 HTML로 온다: 브라우저는 첫 페이지를 위해 /api/animals를 부르지 않고, 다음 페이지부터 부른다
 * - 서버가 기다리는 동안 뼈대 3장이 먼저 보이고 카드가 이어서 들어온다
 * - 첫 화면 등장은 뼈대가 실제로 보였을 때만 돈다(handoff "목록 첫 화면 등장")
 * - 서버가 첫 페이지를 읽지 못하면 목록 오류 화면(다시 시도)이다. 페이지는 깨지지 않는다
 */
const SEOUL = "6110000";
const BUSAN = "6260000";

const consoleWatch = watchConsoleErrors();
test.beforeEach(({ page }) => consoleWatch.attach(page));
test.afterEach(() => consoleWatch.assertNone());

/** 프로젝트(브라우저)마다 다른 늦은 조합. 늦는 것은 서버 캐시가 빈 첫 요청뿐이다 */
const slowRegion = (projectName: string) => (projectName.endsWith("webkit") ? SLOW_REGIONS[5] : SLOW_REGIONS[4]);

/**
 * 매 프레임 뼈대가 있었는지와 등장(enter-rise)이 시작된 카드를 기록한다. 뼈대가 "보였다"는 두 프레임 연속 있었다는 것이다
 * (첫 프레임의 그림이 칠해진 뒤에도 남아 있었다)
 */
async function watchSkeletonAndEntrance(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __frames: boolean[]; __entered: string[] };
    w.__frames = [];
    w.__entered = [];
    const tick = () => {
      w.__frames.push(document.querySelector('[data-slot="skeleton-card"]') !== null);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
    document.addEventListener(
      "animationstart",
      (event) => {
        const target = event.target as Element;
        if (event.animationName === "enter-rise" && target.matches('[data-slot="animal-card"]')) {
          w.__entered.push(target.getAttribute("data-animal-id")!);
        }
      },
      true,
    );
  });
  return async () => {
    const { frames, entered } = await page.evaluate(() => {
      const w = window as unknown as { __frames: boolean[]; __entered: string[] };
      return { frames: w.__frames, entered: w.__entered };
    });
    const skeletonSeen = frames.some((present, i) => present && frames[i + 1] === true);
    return { skeletonSeen, entered };
  };
}

test("첫 로드: 카드가 보이고 첫 페이지용 /api/animals 요청이 없다. 끝까지 내리면 다음 페이지는 /api/animals로 온다", async ({ page }) => {
  const requests = await watchList(page);
  const response = await page.goto(`/?species=cat&region=${SEOUL}`);
  await expectListFrom(page, { species: "cat", region: SEOUL });
  await expect(page.locator("[data-animal-id]")).toHaveCount(20);
  // 첫 페이지 카드는 문서(HTML)에 들어 있다
  const firstId = await page.locator("[data-animal-id]").first().getAttribute("data-animal-id");
  expect(await response!.text()).toContain(`data-animal-id="${firstId}"`);
  expect(firstPageRequests(requests), "첫 페이지는 브라우저가 부르지 않는다").toEqual([]);

  await loadNextListPage(page);
  await expect(page.locator("[data-animal-id]")).toHaveCount(30);
  expect(requests.map((url) => url.searchParams.has("cursor")), "브라우저 요청은 다음 페이지(커서) 한 번뿐이다").toEqual([true]);
  // 다음 페이지 요청도 같은 조건이다
  expect(requests[0]!.searchParams.get("species")).toBe("cat");
  expect(requests[0]!.searchParams.get("region")).toBe(SEOUL);
});

test("서버가 기다리는 동안 뼈대 3장이 먼저 보이고 카드가 이어서 들어온다(뼈대가 보였으니 첫 화면 카드가 등장한다)", async ({ page }, testInfo) => {
  const region = slowRegion(testInfo.project.name);
  const ids = comboLatestIds("cat", region, null);
  const result = await watchSkeletonAndEntrance(page);
  const requests = await watchList(page);
  await page.goto(`/?species=cat&region=${region}`, { waitUntil: "commit" });
  await expect(page.locator('[data-slot="skeleton-card"]')).toHaveCount(3);
  await expect(page.locator(`[data-animal-id="${ids[0]}"]`)).toBeVisible();
  await expect(page.locator('[data-slot="skeleton-card"]')).toHaveCount(0);
  await expectListFrom(page, { species: "cat", region });
  expect(firstPageRequests(requests)).toEqual([]);

  const { skeletonSeen, entered } = await result();
  expect(skeletonSeen).toBe(true);
  expect(entered[0], "첫 카드부터 등장한다").toBe(ids[0]);
  // 등장이 끝나면 표시를 지운다
  await expect.poll(() => page.evaluate(() => document.documentElement.hasAttribute("data-list-enter"))).toBe(false);
});

test("첫 화면 등장은 뼈대가 실제로 보였을 때만 돈다(서버 HTML에 카드가 바로 담기면 없다)", async ({ browser }) => {
  // 서버 캐시를 채워 두고(첫 방문) 새 탭에서 다시 연다. 뼈대가 보였는지와 등장 여부가 늘 같아야 한다
  const warm = await browser.newPage();
  await warm.goto(`/?species=cat&region=${BUSAN}`);
  await expect(warm.locator("[data-animal-id]").first()).toBeVisible();
  await warm.close();

  const page = await browser.newPage();
  consoleWatch.attach(page);
  const result = await watchSkeletonAndEntrance(page);
  await page.goto(`/?species=cat&region=${BUSAN}`);
  await expect(page.locator("[data-animal-id]").first()).toBeVisible();
  await page.waitForTimeout(600); // 등장(240ms + 간격)이 돌았다면 다 시작했을 시간
  const { skeletonSeen, entered } = await result();
  expect(entered.length > 0, `뼈대 보임 ${skeletonSeen}, 등장 ${entered.length}장`).toBe(skeletonSeen);
  await page.close();
});

test("서버가 첫 페이지를 읽지 못하면 목록 오류 화면(다시 시도)이고, 머리줄은 그대로다", async ({ page }) => {
  // 이 시도는 스텁 공공 API가 늘 실패한다(e2e/stub-combo.mjs). 서버가 실패하면 브라우저가 한 번 더 부르고, 그것도 실패해 오류 화면이다
  // 브라우저가 부른 목록 API의 실패 응답(502)은 의도한 것이다
  consoleWatch.expect(/Failed to load resource: the server responded with a status of 502/);
  const requests = await watchList(page);
  await page.goto(`/?species=cat&region=${FAILING_REGION}`);
  await expect(page.getByRole("heading", { name: "고양이 공고" })).toBeVisible();
  await expect(page.getByRole("button", { name: "다시 시도" })).toBeVisible();
  expect(firstPageRequests(requests).length, "서버가 읽지 못한 첫 페이지는 브라우저가 부른다").toBeGreaterThan(0);
});
