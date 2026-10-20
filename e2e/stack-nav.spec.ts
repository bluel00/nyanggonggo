import { expect, test, type Page } from "@playwright/test";
import { openedDetail } from "./helpers";
import {
  BELOW_SCROLL,
  belowScrollTop,
  LAYER,
  LAYER_SCROLL,
  recordStackFrames,
  rememberCards,
  sameCards,
  stackFrames,
  stackFramesDone,
} from "./stack";

/**
 * 상세를 지금 화면 위에 얹기(PRD-v1.5). 목록에서 여는 경우의 뒤로가기는 back-nav.spec.ts가 본다. 여기서는 찜 목록에서 얹기(R1),
 * 얹은 동안(R3), 돌아온 직후 실제 스크롤(R4), 직접 진입·새로고침(R2)을 본다. 스텁 서버(e2e/upstream-stub.mjs), Chromium·WebKit.
 */
const LIST_URL = "/?species=dog&region=5690000";
const listItemId = (index: number) => String(990000202601000 + index);
const CARDS = "[data-animal-id]";
const FAVORITES_STORAGE_KEY = "nyanggonggo:favorites";

const scrollOf = (page: Page, selector: string) =>
  page.evaluate((s) => document.querySelector<HTMLElement>(s)!.scrollTop, selector);

/** 목록을 열고 카드가 위쪽(스크롤 영역 위 80px 아래)에 오게 내린다 */
async function openListAt(page: Page, card: string) {
  await page.goto(LIST_URL);
  await expect(page.locator(CARDS)).toHaveCount(20);
  await page.evaluate((id) => {
    const scroll = document.querySelector<HTMLElement>('[data-slot="app-scroll"]')!;
    const el = document.querySelector<HTMLElement>(`[data-animal-id="${id}"]`)!;
    scroll.scrollTop += el.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 80;
  }, card);
  return belowScrollTop(page);
}

async function openCard(page: Page, id: string) {
  await page.locator(`[data-animal-id="${id}"] a`).click();
  await expect(page).toHaveURL(new RegExp(`/animals/${id}$`));
  await expect(page.locator(LAYER)).toBeVisible();
  await openedDetail(page);
}

const card = listItemId(7);

test.describe("R1: 찜 목록에서도 상세를 얹는다", () => {
  // 찜 12개(스텁 공고). 위에서부터 최근 찜 순이다
  const favorites = Array.from({ length: 12 }, (_, i) => listItemId(i));
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(
      ({ key, ids }) => window.localStorage.setItem(key, JSON.stringify(ids)),
      { key: FAVORITES_STORAGE_KEY, ids: favorites },
    );
  });

  for (const how of ["화면 안", "브라우저"] as const) {
    test(`찜 → 상세 → ${how} 뒤로가기: 찜 목록은 같은 요소·같은 위치`, async ({ page }) => {
      await page.goto("/favorites");
      await expect(page.locator(CARDS)).toHaveCount(favorites.length);
      const target = favorites[6];
      await page.evaluate((id) => {
        const scroll = document.querySelector<HTMLElement>('[data-slot="app-scroll"]')!;
        const el = document.querySelector<HTMLElement>(`[data-animal-id="${id}"]`)!;
        scroll.scrollTop += el.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 80;
      }, target);
      const left = await belowScrollTop(page);
      expect(left).toBeGreaterThan(0);
      await rememberCards(page);

      await openCard(page, target);
      await recordStackFrames(page);
      // 찜 목록 머리글에도 뒤로가기가 있다(아래 화면은 inert지만 Playwright의 역할 찾기에는 잡힌다). 층의 것을 누른다
      if (how === "화면 안") await page.locator(LAYER).getByRole("button", { name: "뒤로가기" }).click();
      else await page.goBack();

      await expect(page).toHaveURL("/favorites");
      await expect.poll(() => stackFramesDone(page), { message: "층이 걷힌 뒤 30프레임" }).toBe(true);
      expect(await sameCards(page), "찜 카드가 다시 만들어지지 않았다").toBe(true);
      const frames = await stackFrames(page);
      expect(new Set(frames.map((frame) => frame.scrollTop))).toEqual(new Set([left]));
      expect(frames.filter((frame) => !frame.layer).every((frame) => frame.usable)).toBe(true);
    });
  }
});

test.describe("R3: 얹은 동안", () => {
  test("아래 목록은 눌리거나 스크롤되지 않고, 상세는 자기 층에서 스크롤된다", async ({ page, browserName }) => {
    const left = await openListAt(page, card);
    await openCard(page, card);

    // 화면 가운데를 누르면 맞는 것은 상세 층이다. 아래 목록은 inert(누름·초점·접근성 트리에서 빠짐)
    const hit = await page.evaluate(() => {
      const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
      return { layer: !!el?.closest('[data-slot="stack-layer"]'), below: !!el?.closest('[data-slot="app-scroll"]') };
    });
    expect(hit).toEqual({ layer: true, below: false });
    expect(await page.locator(BELOW_SCROLL).evaluate((el) => (el as HTMLElement).inert)).toBe(true);

    // 상세 층은 화면보다 짧아도 1px 더 길어 늘 스크롤되는 영역이다(맨 위에서 당겨도 문서로 넘어가지 않는다)
    // overscroll-behavior는 아이폰 사파리(16+)와 Chromium에 있고, Windows용 Playwright WebKit에는 없다(그때는 1px 스크롤만 본다)
    const overscroll = () =>
      page.evaluate((s) => {
        if (!CSS.supports("overscroll-behavior-y", "contain")) return null;
        const layerScroll = document.querySelector(s);
        return {
          layer: layerScroll ? getComputedStyle(layerScroll).overscrollBehaviorY : null,
          document: getComputedStyle(document.documentElement).overscrollBehaviorY,
        };
      }, LAYER_SCROLL);
    expect(await page.locator(LAYER_SCROLL).evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
    const during = await overscroll();
    // 층이 있는 동안 문서의 당김도 꺼진다. 목록 화면에서는 브라우저 기본값이다
    if (during) expect(during).toEqual({ layer: "contain", document: "none" });

    // 휠은 상세 층이 받고 아래 목록은 움직이지 않는다(Playwright는 모바일 WebKit에서 휠을 지원하지 않아 Chromium만)
    if (browserName === "chromium") {
      const box = (await page.locator(LAYER).boundingBox())!;
      await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
      await page.mouse.wheel(0, 400);
      await expect.poll(() => scrollOf(page, LAYER_SCROLL)).toBeGreaterThan(0);
      await page.mouse.wheel(0, -2000); // 맨 위에서 더 당겨도 바깥으로 이어지지 않는다
      await page.waitForTimeout(300);
    }
    expect(await belowScrollTop(page)).toBe(left);

    await page.goBack();
    await expect(page.locator(LAYER)).toHaveCount(0);
    const after = await overscroll();
    if (after) expect(after).toEqual({ layer: null, document: "auto" });
  });
});

test.describe("R4: 돌아온 직후", () => {
  // 프레임마다 막힘이 풀렸는지는 back-nav.spec.ts가 두 엔진에서 본다. 여기서는 실제 입력으로 확인한다
  test("층이 걷히자마자 목록이 입력을 받아 스크롤된다", async ({ page, browserName }) => {
    const left = await openListAt(page, card);
    await openCard(page, card);
    await page.goBack();
    await expect(page.locator(LAYER)).toHaveCount(0);
    const box = (await page.locator(BELOW_SCROLL).boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height / 2;
    if (browserName === "chromium") {
      // 층이 사라진 직후(기다리지 않고) 휠
      await page.mouse.move(x, y);
      await page.mouse.wheel(0, 300);
      await expect.poll(() => belowScrollTop(page)).toBeGreaterThan(left);
    } else {
      // Playwright는 모바일 WebKit에서 휠을 지원하지 않는다. 그 자리를 누르면 목록 카드가 맞는지로 본다
      const target = await page.evaluate(({ x, y }) => !!document.elementFromPoint(x, y)?.closest("[data-animal-id]"), { x, y });
      expect(target).toBe(true);
    }
  });
});

test.describe("R2: 직접 진입·새로고침", () => {
  test("공유 링크로 바로 들어오면 상세 전체 페이지(층 없음)", async ({ page }) => {
    await page.goto(`/animals/${card}`);
    await openedDetail(page);
    await expect(page.locator(LAYER)).toHaveCount(0);
    await expect(page.locator(`${BELOW_SCROLL} [data-slot="animal-detail"]`)).toHaveCount(1);
  });

  test("얹은 상세에서 새로고침하면 상세 전체 페이지(층 없음, 아래 목록 없음)", async ({ page }) => {
    await openListAt(page, card);
    await openCard(page, card);
    await page.reload();
    await openedDetail(page);
    await expect(page.locator(LAYER)).toHaveCount(0);
    await expect(page.locator(CARDS)).toHaveCount(0);
  });
});
