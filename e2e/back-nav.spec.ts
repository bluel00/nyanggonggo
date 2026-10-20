import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { isCardInView, loadNextListPage, openedDetail, scrollTop, SPECIES_COOKIE } from "./helpers";

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

/** 카드 위쪽이 스크롤 영역 위에서 80px 아래에 오게 내린다(가운데 맞춤과 다른 위치) */
async function placeCardNearTop(page: Page, animalId: string) {
  await page.evaluate((id) => {
    const scroll = document.querySelector<HTMLElement>('[data-slot="app-scroll"]')!;
    const card = document.querySelector<HTMLElement>(`[data-animal-id="${id}"]`)!;
    scroll.scrollTop += card.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 80;
  }, animalId);
}

/** 카드를 누르는 순간의 목록 scrollTop을 남긴다(누르기 전 Playwright가 스크롤해도 실제로 떠난 위치를 본다) */
async function watchLeaveScroll(page: Page) {
  await page.evaluate(() => {
    document.addEventListener(
      "click",
      () => {
        const w = window as unknown as { __leaveScroll: number };
        w.__leaveScroll = document.querySelector<HTMLElement>('[data-slot="app-scroll"]')!.scrollTop;
      },
      { capture: true, once: true },
    );
  });
}
const leaveScroll = (page: Page) => page.evaluate(() => (window as unknown as { __leaveScroll: number }).__leaveScroll);

type Frame = { list: boolean; scrollTop: number };
/** 지금부터 매 프레임(rAF, 그리기 직전) 목록이 그려졌는지와 scrollTop을 남긴다 */
async function recordFrames(page: Page) {
  await page.evaluate(() => {
    const w = window as unknown as { __frames: Frame[] };
    w.__frames = [];
    const tick = () => {
      const scroll = document.querySelector<HTMLElement>('[data-slot="app-scroll"]');
      const list = !document.querySelector('[data-slot="animal-detail"]') && document.querySelector("[data-animal-id]") !== null;
      w.__frames.push({ list, scrollTop: scroll?.scrollTop ?? -1 });
      if (w.__frames.length < 180) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
/** 목록이 처음 그려진 프레임 */
async function firstListFrame(page: Page): Promise<Frame> {
  const frames = () => page.evaluate(() => (window as unknown as { __frames: Frame[] }).__frames);
  await expect.poll(async () => (await frames()).some((frame) => frame.list), { message: "목록이 그려진다" }).toBe(true);
  return (await frames()).find((frame) => frame.list)!;
}

/** 카드 가운데와 스크롤 영역 가운데의 차이(px) */
function offCenter(page: Page, animalId: string) {
  return page.evaluate((id) => {
    const scroll = document.querySelector<HTMLElement>('[data-slot="app-scroll"]')!.getBoundingClientRect();
    const card = document.querySelector<HTMLElement>(`[data-animal-id="${id}"]`)!.getBoundingClientRect();
    return card.top + card.height / 2 - (scroll.top + scroll.height / 2);
  }, animalId);
}

/** 카드 사진의 decoding 속성을 스크롤 영역 안·밖으로 나눠 모은다 */
function cardPhotoDecoding(page: Page) {
  return page.evaluate(() => {
    const scroll = document.querySelector<HTMLElement>('[data-slot="app-scroll"]')!.getBoundingClientRect();
    const inView: string[] = [];
    const outOfView: string[] = [];
    for (const card of document.querySelectorAll<HTMLElement>("[data-animal-id]")) {
      const box = card.getBoundingClientRect();
      const visible = box.bottom > scroll.top && box.top < scroll.bottom;
      for (const img of card.querySelectorAll("img")) (visible ? inView : outOfView).push(img.getAttribute("decoding") ?? "");
    }
    return { inView, outOfView };
  });
}

async function goBack(page: Page, how: "화면 안" | "브라우저") {
  if (how === "화면 안") await page.getByRole("button", { name: "뒤로가기" }).click();
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

  // 쓸어넘기기 깜빡임(architecture.md 12절 37): iOS 사파리는 쓸어넘기는 동안 떠날 때 화면의 스냅숏을 보여 주므로,
  // 목록의 첫 프레임이 떠날 때와 같은 scrollTop이어야 한다. 브라우저 뒤로가기(history.back)가 쓸어넘기기와 같은 경로다
  for (const depth of [1, 5]) {
    const card = depth === 1 ? listItemId(7) : target;
    for (const how of ["화면 안", "브라우저"] as const) {
      test(`${depth}페이지 깊이, ${how} 뒤로가기: 목록의 첫 프레임 scrollTop이 떠날 때와 ±1px`, async ({ page }) => {
        await page.goto(LIST_URL);
        await loadPages(page, depth);
        await placeCardNearTop(page, card);
        expect(new Set(Object.values(await cardPhotoDecoding(page)).flat()), "처음 들어올 때와 스크롤로 보인 카드").toEqual(
          new Set(["async"]),
        );
        await watchLeaveScroll(page);
        await openCard(page, card);
        const left = await leaveScroll(page);
        expect(left, "가운데 맞춤과 구분되도록 위쪽까지 내렸다").toBeGreaterThan(0);

        await recordFrames(page);
        await goBack(page, how);
        const first = await firstListFrame(page);
        expect(Math.abs(first.scrollTop - left), `첫 프레임 ${first.scrollTop}, 떠날 때 ${left}`).toBeLessThanOrEqual(1);
        await expect(page).toHaveURL(LIST_URL);
        // 그 뒤에도 움직이지 않는다
        await page.waitForTimeout(500);
        expect(Math.abs((await scrollTop(page)) - left)).toBeLessThanOrEqual(1);
        // 화면 안 카드 사진만 바로 디코드(12절 56), 나머지는 그대로 async
        const decoding = await cardPhotoDecoding(page);
        expect(decoding.inView.length).toBeGreaterThan(0);
        expect(new Set(decoding.inView), "화면 안 카드 사진").toEqual(new Set(["sync"]));
        expect(new Set(decoding.outOfView), "화면 밖 카드 사진").toEqual(new Set(["async"]));
      });
    }
  }

  // 상세에 머무는 동안 목록 캐시(gcTime 30분)가 지워지면 목록을 다시 받는다. 첫 화면이 뼈대라 스냅숏과 맞출 수 없고,
  // 다시 받은 목록은 순서·높이가 같다는 보장이 없으므로 카드 id로 찾아 가운데에 맞춘다(지금까지의 동작)
  for (const how of ["화면 안", "브라우저"] as const) {
    test(`캐시가 지워진 뒤 ${how} 뒤로가기: 열었던 카드를 가운데로 맞춘다`, async ({ page }) => {
      const card = listItemId(7);
      await page.clock.install();
      await watchSkeletons(page);
      await page.goto(LIST_URL);
      await expect(page.locator(CARDS)).toHaveCount(PAGE_SIZE);
      await placeCardNearTop(page, card);
      await openCard(page, card);
      // 목록이 언마운트돼 캐시의 gc 타이머가 걸린 뒤에 시간을 넘긴다(미리보기 상세가 보일 때는 아직일 수 있다)
      await expect(page.locator(CARDS)).toHaveCount(0);
      await expect(page.locator('[data-slot="detail-preview"]')).toHaveCount(0);

      await page.clock.fastForward("31:00");
      await resetSkeletons(page);
      await goBack(page, how);

      await expect(page).toHaveURL(LIST_URL);
      await expect(page.locator(`[data-animal-id="${card}"]`)).toBeVisible();
      await expect.poll(() => offCenter(page, card).then(Math.abs), { message: "카드 가운데가 스크롤 영역 가운데" }).toBeLessThanOrEqual(1);
      expect(await skeletonCount(page), "캐시가 지워져 뼈대부터 그렸다").toBeGreaterThan(0);
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
