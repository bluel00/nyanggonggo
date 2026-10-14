import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { isCardInView, openedDetail, scrollListToBottom, SPECIES_COOKIE } from "./helpers";

/**
 * 상세에서 뒤로가기(PRD-v1.4 R1·R2, 4절 완료 기준). production 빌드를 스텁 서버(e2e/upstream-stub.mjs)로 띄워 본다:
 * 목록 API·상세·사진이 모두 고정 데이터라(실제 공공 API 요청 없음) 페이지 크기(20건)와 커서가 실제 서버 그대로다.
 *
 * 스텁의 고정 목록은 개·세종 120건(6페이지)이고, 최신순으로 id가 990000202601000부터 하나씩 는다.
 * 다른 조합의 목록은 빈 결과다. 아래 값은 스텁과 같아야 한다.
 */
const LIST_URL = "/?species=dog&region=5690000";
const PAGE_SIZE = 20;
const listItemId = (index: number) => String(990000202601000 + index);

const REGION_COOKIE = "nyanggonggo.region";
const CARDS = "[data-animal-id]";

/** 목록 API 요청을 센다(상세·RSC 요청은 세지 않는다) */
function countListRequests(page: Page) {
  const urls: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).pathname === "/api/animals") urls.push(request.url());
  });
  return urls;
}

/** 목록 스켈레톤 카드가 화면에 붙은 횟수를 센다. 문서가 바뀌지 않는 앱 안 이동 동안 이어서 센다 */
async function watchSkeletons(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __skeletons: number };
    w.__skeletons = 0;
    new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.addedNodes) {
          if (!(node instanceof Element)) continue;
          if (node.matches('[data-slot="skeleton-card"]')) w.__skeletons += 1;
          w.__skeletons += node.querySelectorAll('[data-slot="skeleton-card"]').length;
        }
      }
    }).observe(document, { childList: true, subtree: true });
  });
}
const skeletonCount = (page: Page) => page.evaluate(() => (window as unknown as { __skeletons: number }).__skeletons);
const resetSkeletons = (page: Page) => page.evaluate(() => ((window as unknown as { __skeletons: number }).__skeletons = 0));

/** 목록을 pages페이지까지 내린다 */
async function loadPages(page: Page, pages: number) {
  for (let loaded = 1; loaded < pages; loaded += 1) {
    await expect(page.locator(CARDS)).toHaveCount(loaded * PAGE_SIZE);
    await scrollListToBottom(page);
  }
  await expect(page.locator(CARDS)).toHaveCount(pages * PAGE_SIZE);
}

async function openCard(page: Page, animalId: string) {
  await page.locator(`[data-animal-id="${animalId}"] a`).click();
  await expect(page).toHaveURL(new RegExp(`/animals/${animalId}$`));
  await openedDetail(page);
}

async function filterCookies(context: BrowserContext) {
  return (await context.cookies())
    .filter((cookie) => cookie.name === SPECIES_COOKIE || cookie.name === REGION_COOKIE)
    .map(({ name, value }) => ({ name, value }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

test.describe("R1: 목록 → 상세 → 뒤로가기", () => {
  // 5페이지(81~100번째)의 앞쪽 카드. 맨 아래가 아니라서 돌아와도 6페이지를 미리 받지 않는다
  const target = listItemId(4 * PAGE_SIZE + 2);

  for (const how of ["화면 안", "브라우저"] as const) {
    test(`5페이지까지 내린 목록 → 상세 → ${how} 뒤로가기: 요청 0건, 스켈레톤 없음, 열었던 카드가 화면 안`, async ({ page, context }) => {
      await watchSkeletons(page);
      const requests = countListRequests(page);
      await page.goto(LIST_URL);
      await loadPages(page, 5);
      await openCard(page, target);

      const mark = requests.length;
      await resetSkeletons(page);
      if (how === "화면 안") await page.getByRole("button", { name: "뒤로가기" }).click();
      else await page.goBack();

      await expect(page).toHaveURL(LIST_URL);
      await expect(page.locator(`[data-animal-id="${target}"]`)).toBeVisible();
      await expect.poll(() => isCardInView(page, target), { message: "열었던 카드가 화면 안" }).toBe(true);
      await expect(page.locator(CARDS)).toHaveCount(5 * PAGE_SIZE);
      // 뒤늦게 나가는 요청이나 스켈레톤까지 본다
      await page.waitForTimeout(1000);
      expect(requests.slice(mark), "뒤로가기로 목록 요청이 나가지 않는다").toEqual([]);
      expect(await skeletonCount(page), "스켈레톤이 보이지 않는다").toBe(0);
      expect(await filterCookies(context), "기억(쿠키)을 쓰지 않는다").toEqual([]);
    });
  }

  test("목록 → 상세 → 새로고침 → 화면 안 뒤로가기: 원래 목록 주소(쿼리 포함)로 간다", async ({ page, context }) => {
    const listUrl = `${LIST_URL}&sort=endingSoon`;
    await page.goto(listUrl);
    await expect(page.locator(CARDS)).toHaveCount(PAGE_SIZE);
    const first = (await page.locator(CARDS).first().getAttribute("data-animal-id"))!;
    await openCard(page, first);

    await page.reload();
    await openedDetail(page);
    await page.getByRole("button", { name: "뒤로가기" }).click();

    await expect(page).toHaveURL(listUrl);
    await expect(page.locator(CARDS).first()).toBeVisible();
    expect(await filterCookies(context), "기억(쿠키)을 쓰지 않는다").toEqual([]);
  });
});

test.describe("R2: 공유 링크 → 상세 → 뒤로가기", () => {
  // 공유받은 공고는 세종 개 공고다. 뒤로가기는 그 공고의 지역이 아니라 내 평소 화면으로 간다
  const shared = listItemId(30);

  test("쿠키가 없으면(처음 온 사람) 홈으로 가고, 쿠키는 생기지 않는다", async ({ page, context }) => {
    await page.goto(`/animals/${shared}`);
    await openedDetail(page);
    await page.getByRole("button", { name: "뒤로가기" }).click();

    await expect(page).toHaveURL("/home");
    expect(await filterCookies(context)).toEqual([]);
  });

  test("쿠키가 있으면(쓰던 사람) 쿠키의 축종·지역 목록 맨 위로 가고, 쿠키는 바뀌지 않는다", async ({ page, context }) => {
    // 기억: 고양이, 제주. 공유받은 공고(개, 세종)와 축종·지역이 모두 다르다
    const remembered = [
      { name: REGION_COOKIE, value: "6500000" },
      { name: SPECIES_COOKIE, value: "cat" },
    ];
    await context.addCookies(remembered.map((cookie) => ({ ...cookie, url: "http://localhost:3101" })));

    await page.goto(`/animals/${shared}`);
    await openedDetail(page);
    await page.getByRole("button", { name: "뒤로가기" }).click();

    await expect(page).toHaveURL("/?species=cat&region=6500000");
    await expect(page.getByRole("status")).toBeVisible(); // 스텁에서 제주 고양이는 빈 목록(빈 상태 문구)
    expect(await filterCookies(context)).toEqual(remembered);
  });
});
