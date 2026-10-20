import { expect, test, type Page } from "@playwright/test";
import { loadNextListPage, openedDetail } from "./helpers";

/**
 * 시험판(spike-stack-nav): 목록 위에 상세를 얹는 구조(intercepting + parallel routes)의 확인.
 * - 뒤로가기 뒤 목록 DOM이 새로 만들어지지 않는다(카드 요소가 같은 요소), 스크롤 위치가 그대로다(첫 프레임부터)
 * - 상세를 얹은 동안 아래 목록이 스크롤되거나 눌리지 않는다
 * - 직접 진입·새로고침은 원래 상세 전체 페이지다
 * 스텁 서버(e2e/upstream-stub.mjs)의 개·세종 목록을 쓴다.
 */
const LIST_URL = "/?species=dog&region=5690000";
const listItemId = (index: number) => String(990000202601000 + index);
const CARDS = "[data-animal-id]";
const LIST_SCROLL = '[data-slot="app-scroll"]';
const OVERLAY = '[data-slot="app-overlay"]';
const OVERLAY_SCROLL = '[data-slot="app-overlay-scroll"]';

const scrollOf = (page: Page, selector: string) =>
  page.evaluate((s) => document.querySelector<HTMLElement>(s)?.scrollTop ?? -1, selector);

/** 목록 2페이지까지 받고 카드를 위쪽(스크롤 영역 위 80px 아래)에 둔 뒤, 카드 요소들을 기억해 둔다 */
async function prepareList(page: Page, card: string) {
  await page.goto(LIST_URL);
  await expect(page.locator(CARDS)).toHaveCount(20);
  await loadNextListPage(page);
  await expect(page.locator(CARDS)).toHaveCount(40);
  await page.evaluate(
    ({ id, scroll }) => {
      const container = document.querySelector<HTMLElement>(scroll)!;
      const el = document.querySelector<HTMLElement>(`[data-animal-id="${id}"]`)!;
      container.scrollTop += el.getBoundingClientRect().top - container.getBoundingClientRect().top - 80;
      (window as unknown as { __cards: Element[] }).__cards = [...document.querySelectorAll("[data-animal-id]")];
    },
    { id: card, scroll: LIST_SCROLL },
  );
  return scrollOf(page, LIST_SCROLL);
}

/** 기억해 둔 카드 요소가 지금 문서의 카드와 같은 요소인지(새로 만들어지지 않았는지) */
const sameCardElements = (page: Page) =>
  page.evaluate(() => {
    const before = (window as unknown as { __cards: Element[] }).__cards;
    const now = [...document.querySelectorAll("[data-animal-id]")];
    return before.length === now.length && before.every((el, i) => el === now[i] && el.isConnected);
  });

/** 지금부터 매 프레임(rAF) 얹은 층이 있는지와 목록 scrollTop을 남긴다(층이 걷히고 30프레임까지) */
async function recordFrames(page: Page) {
  await page.evaluate((scroll) => {
    const w = window as unknown as { __frames: { overlay: boolean; scrollTop: number }[] };
    w.__frames = [];
    const tick = () => {
      w.__frames.push({
        overlay: document.querySelector('[data-slot="app-overlay"]') !== null,
        scrollTop: document.querySelector<HTMLElement>(scroll)!.scrollTop,
      });
      // 층이 걷히고 30프레임 더(최대 600프레임)
      const gone = w.__frames.filter((frame) => !frame.overlay).length;
      if (gone < 30 && w.__frames.length < 600) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, LIST_SCROLL);
}
const frames = (page: Page) =>
  page.evaluate(() => (window as unknown as { __frames: { overlay: boolean; scrollTop: number }[] }).__frames);

const card = listItemId(25); // 2페이지의 카드

for (const how of ["화면 안", "브라우저"] as const) {
  test(`카드 → 상세(목록 위에 얹음) → ${how} 뒤로가기: 목록은 같은 요소, 스크롤 그대로`, async ({ page }) => {
    const left = await prepareList(page, card);
    expect(left).toBeGreaterThan(0);

    await page.locator(`[data-animal-id="${card}"] a`).click();
    await expect(page).toHaveURL(new RegExp(`/animals/${card}$`));
    await expect(page.locator(OVERLAY)).toBeVisible();
    await openedDetail(page);
    // 상세는 얹은 층 안에 있고, 아래 목록은 그대로 문서에 남아 있다
    await expect(page.locator(`${OVERLAY} [data-slot="animal-detail"]`)).toHaveCount(1);
    expect(await sameCardElements(page), "얹은 동안 목록 요소가 그대로").toBe(true);
    expect(await scrollOf(page, LIST_SCROLL)).toBe(left);

    await recordFrames(page);
    if (how === "화면 안") await page.locator(OVERLAY).getByRole("button", { name: "뒤로가기" }).click();
    else await page.goBack();

    await expect(page).toHaveURL(LIST_URL);
    await expect(page.locator(OVERLAY)).toHaveCount(0);
    expect(await sameCardElements(page), "뒤로가기 뒤 카드가 같은 요소").toBe(true);
    expect(await scrollOf(page, LIST_SCROLL)).toBe(left);
    // 층을 걷기 전후 모든 프레임에서 목록 위치가 그대로다
    await expect.poll(async () => (await frames(page)).filter((frame) => !frame.overlay).length, { message: "층이 걷힌 프레임" }).toBeGreaterThanOrEqual(30);
    const recorded = await frames(page);
    expect(recorded.some((frame) => !frame.overlay), "층이 걷힌 프레임이 있다").toBe(true);
    expect(new Set(recorded.map((frame) => frame.scrollTop))).toEqual(new Set([left]));
  });
}

test("상세를 얹은 동안 아래 목록은 스크롤되거나 눌리지 않는다", async ({ page, browserName }) => {
  const left = await prepareList(page, card);
  await page.locator(`[data-animal-id="${card}"] a`).click();
  await openedDetail(page);
  await expect(page.locator(OVERLAY)).toBeVisible();

  // 화면 가운데를 눌러 보면 맞는 요소는 얹은 층 안이다(아래 목록의 카드가 아니다)
  const hit = await page.evaluate(() => {
    const el = document.elementFromPoint(innerWidth / 2, innerHeight / 2);
    return { inOverlay: !!el?.closest('[data-slot="app-overlay"]'), inList: !!el?.closest('[data-slot="app-scroll"]') };
  });
  expect(hit).toEqual({ inOverlay: true, inList: false });

  // 아래 목록은 스크롤 불가(overflow hidden)·누름 불가(pointer-events none)이고, 스크립트로 내려 보는 것 말고는 움직이지 않는다
  const style = await page.evaluate((s) => {
    const cs = getComputedStyle(document.querySelector(s)!);
    return { overflowY: cs.overflowY, pointerEvents: cs.pointerEvents };
  }, LIST_SCROLL);
  expect(style).toEqual({ overflowY: "hidden", pointerEvents: "none" });

  // 휠 스크롤은 얹은 층이 받는다(Chromium만: Playwright는 모바일 WebKit에서 휠을 지원하지 않는다).
  // 스텁 상세는 화면보다 짧아 층에 빈 높이를 더해 스크롤할 거리를 만든다
  if (browserName === "chromium") {
    await page.evaluate((s) => {
      const spacer = document.createElement("div");
      spacer.style.height = "2000px";
      document.querySelector(s)!.append(spacer);
    }, OVERLAY_SCROLL);
    const box = (await page.locator(OVERLAY).boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.wheel(0, 600);
    await expect.poll(() => scrollOf(page, OVERLAY_SCROLL)).toBeGreaterThan(0);
  }
  expect(await scrollOf(page, LIST_SCROLL)).toBe(left);

  await page.goBack();
  await expect(page.locator(OVERLAY)).toHaveCount(0);
  // 걷은 뒤에는 목록이 다시 스크롤된다
  const after = await page.evaluate((s) => getComputedStyle(document.querySelector(s)!).overflowY, LIST_SCROLL);
  expect(after).toBe("auto");
});

test("직접 진입과 새로고침은 상세 전체 페이지(얹은 층 없음)다", async ({ page }) => {
  await page.goto(`/animals/${card}`);
  await openedDetail(page);
  await expect(page.locator(OVERLAY)).toHaveCount(0);
  await expect(page.locator(`${LIST_SCROLL} [data-slot="animal-detail"]`)).toHaveCount(1);

  // 목록에서 얹은 뒤 새로고침
  await prepareList(page, card);
  await page.locator(`[data-animal-id="${card}"] a`).click();
  await expect(page.locator(OVERLAY)).toBeVisible();
  await page.reload();
  await openedDetail(page);
  await expect(page.locator(OVERLAY)).toHaveCount(0);
  await expect(page.locator(CARDS)).toHaveCount(0);
});
