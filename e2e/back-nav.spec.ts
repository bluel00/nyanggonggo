import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { isCardInView, loadNextListPage, openedDetail, REGION_COOKIE, SPECIES_COOKIE } from "./helpers";
import { belowScrollTop, LAYER, recordStackFrames, rememberCards, sameCards, stackFrames, stackFramesDone } from "./stack";

/**
 * 상세에서 뒤로가기(PRD-v1.4 R1·R2, PRD-v1.5 R1·R2·R4). production 빌드를 스텁 서버(e2e/upstream-stub.mjs)로 띄워 본다:
 * 목록 API·상세·사진이 모두 고정 데이터라(실제 공공 API 요청 없음) 페이지 크기(20건)와 커서가 실제 서버 그대로다.
 * Chromium과 WebKit(아이폰 사파리 엔진) 둘 다 돈다(playwright.config.ts).
 *
 * 스텁의 고정 목록은 개·세종 120건(6페이지)이고, 최신순으로 id가 990000202601000부터 하나씩 는다.
 * 다른 조합의 목록은 빈 결과다. 아래 값은 스텁과 같아야 한다.
 */
const LIST_URL = "/?species=dog&region=5690000";
const PAGE_SIZE = 20;
const listItemId = (index: number) => String(990000202601000 + index);

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

/** 목록을 pages페이지까지 내린다. 페이지마다 다음 페이지 응답을 기다린 뒤 카드 수를 본다 */
async function loadPages(page: Page, pages: number) {
  for (let loaded = 1; loaded < pages; loaded += 1) {
    await expect(page.locator(CARDS)).toHaveCount(loaded * PAGE_SIZE);
    await loadNextListPage(page);
  }
  await expect(page.locator(CARDS)).toHaveCount(pages * PAGE_SIZE);
}

async function openCard(page: Page, animalId: string) {
  await page.locator(`[data-animal-id="${animalId}"] a`).click();
  await expect(page).toHaveURL(new RegExp(`/animals/${animalId}$`));
  await openedDetail(page);
}

/** 카드 위쪽이 스크롤 영역 위에서 80px 아래에 오게 내린다(떠날 때 위치가 0이 아니게) */
async function placeCardNearTop(page: Page, animalId: string) {
  await page.evaluate((id) => {
    const scroll = document.querySelector<HTMLElement>('[data-slot="app-scroll"]')!;
    const card = document.querySelector<HTMLElement>(`[data-animal-id="${id}"]`)!;
    scroll.scrollTop += card.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 80;
  }, animalId);
}

async function goBack(page: Page, how: "화면 안" | "브라우저") {
  // 층 안의 뒤로가기를 누른다(아래 화면은 inert지만 Playwright의 역할 찾기에는 잡힌다)
  if (how === "화면 안") await page.locator(LAYER).getByRole("button", { name: "뒤로가기" }).click();
  else await page.goBack();
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
      await goBack(page, how);

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

  // 상세는 목록 위에 얹히고 목록은 내려가지 않는다(PRD-v1.5 R1). 쓸어넘기기는 브라우저 뒤로가기(history.back)와 같은 경로다.
  // 층이 있는 동안과 걷힌 뒤 모든 프레임에서 목록 위치가 떠날 때와 같고, 층이 사라진 첫 프레임부터 목록이 스크롤·터치된다(R4)
  for (const depth of [1, 5]) {
    const card = depth === 1 ? listItemId(7) : target;
    for (const how of ["화면 안", "브라우저"] as const) {
      test(`${depth}페이지 깊이, ${how} 뒤로가기: 목록은 같은 요소·같은 위치이고, 층이 사라진 첫 프레임부터 스크롤·터치된다`, async ({ page }) => {
        await page.goto(LIST_URL);
        await loadPages(page, depth);
        await placeCardNearTop(page, card);
        const left = await belowScrollTop(page);
        expect(left, "위쪽까지 내렸다").toBeGreaterThan(0);
        await rememberCards(page);

        await openCard(page, card);
        await expect(page.locator(`${LAYER} [data-slot="animal-detail"]`)).toHaveCount(1);
        expect(await sameCards(page), "얹은 동안 목록이 그대로 있다").toBe(true);

        await recordStackFrames(page);
        await goBack(page, how);
        await expect(page).toHaveURL(LIST_URL);
        await expect(page.locator(LAYER)).toHaveCount(0);
        await expect.poll(() => stackFramesDone(page), { message: "층이 걷힌 뒤 30프레임" }).toBe(true);

        expect(await sameCards(page), "카드가 다시 만들어지지 않았다").toBe(true);
        const frames = await stackFrames(page);
        expect(new Set(frames.map((frame) => frame.scrollTop)), "모든 프레임에서 목록 위치 그대로").toEqual(new Set([left]));
        const firstGone = frames.findIndex((frame) => !frame.layer);
        expect(frames.slice(0, firstGone).every((frame) => !frame.usable), "층이 있는 동안 목록은 막혀 있다").toBe(true);
        expect(frames.slice(firstGone).every((frame) => frame.usable), "층이 사라진 첫 프레임부터 목록이 스크롤·터치된다").toBe(true);
      });
    }
  }

  // 목록이 내려가지 않아 목록 캐시가 쓰이는 중(관찰자 있음)이다. 상세에 오래 머물러도(목록 gcTime 30분) 목록이 사라지지 않는다
  test("상세에 31분 머문 뒤 뒤로가기: 목록은 같은 요소이고 다시 받지 않는다", async ({ page }) => {
    const card = listItemId(7);
    await page.clock.install();
    await watchSkeletons(page);
    const requests = countListRequests(page);
    await page.goto(LIST_URL);
    await expect(page.locator(CARDS)).toHaveCount(PAGE_SIZE);
    await placeCardNearTop(page, card);
    const left = await belowScrollTop(page);
    await rememberCards(page);
    await openCard(page, card);

    await page.clock.fastForward("31:00");
    const mark = requests.length;
    await resetSkeletons(page);
    await goBack(page, "브라우저");

    await expect(page.locator(LAYER)).toHaveCount(0);
    expect(await sameCards(page)).toBe(true);
    expect(await belowScrollTop(page)).toBe(left);
    await page.waitForTimeout(500);
    expect(requests.slice(mark)).toEqual([]);
    expect(await skeletonCount(page)).toBe(0);
  });

  // R2(PRD-v1.5): 얹은 상세에서 새로고침하면 상세 전체 페이지. 그 뒤 뒤로가기는 목록을 처음부터 부른다(위치는 보장하지 않는다)
  test("목록 → 상세 → 새로고침 → 화면 안 뒤로가기: 원래 목록 주소(쿼리 포함)로 간다", async ({ page, context }) => {
    const listUrl = `${LIST_URL}&sort=deadline`;
    await page.goto(listUrl);
    await expect(page.locator(CARDS)).toHaveCount(PAGE_SIZE);
    const first = (await page.locator(CARDS).first().getAttribute("data-animal-id"))!;
    await openCard(page, first);
    await expect(page.locator(LAYER)).toHaveCount(1);

    await page.reload();
    await openedDetail(page);
    await expect(page.locator(LAYER), "새로고침하면 상세 전체 페이지").toHaveCount(0);
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

  // 스텁이 이 공고의 조회를 8초 늦춰(e2e/upstream-stub.mjs SLOW_ID) 서버가 로딩 경계(스켈레톤)만 먼저 보낸 채 붙잡아 둔다
  const SLOW_ID = "990000202609999";
  const cases = [
    { name: "쿠키가 없으면 홈", cookies: [], expected: "/home" },
    {
      name: "쿠키가 있으면 쿠키의 축종·지역 목록",
      cookies: [
        { name: REGION_COOKIE, value: "6500000" },
        { name: SPECIES_COOKIE, value: "cat" },
      ],
      expected: "/?species=cat&region=6500000",
    },
  ];
  for (const { name, cookies, expected } of cases) {
    test(`로딩 화면(스켈레톤)에서 뒤로가기도 \`/\`로 간다: ${name}, 쿠키는 그대로`, async ({ page, context }) => {
      if (cookies.length) await context.addCookies(cookies.map((cookie) => ({ ...cookie, url: "http://localhost:3101" })));

      // 응답이 끝나지 않아 load 이벤트가 오지 않으므로 문서가 오기 시작하면 바로 본다
      await page.goto(`/animals/${SLOW_ID}`, { waitUntil: "commit" });
      const skeleton = page.locator('[data-slot="detail-skeleton"]');
      await expect(skeleton).toBeVisible();
      // 상세가 오지 않은 동안 뼈대는 하이드레이션되지 않는다(끝나지 않은 Suspense 경계의 대체 화면). 그래도 눌리는지 바로 누른다
      await skeleton.getByRole("link", { name: "뒤로가기" }).click();

      await expect(page).toHaveURL(expected);
      await expect(page.locator('[data-slot="animal-detail"]')).toHaveCount(0);
      expect(await filterCookies(context)).toEqual(cookies);
    });
  }
});
