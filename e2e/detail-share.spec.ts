import { expect, test, type Page } from "@playwright/test";
import { watchConsoleErrors } from "./helpers";

/**
 * 상세 하단 바의 두 번째 공유 버튼(#94). 공유 시트(Web Share)를 열 수 있는지를 navigator.share 스텁으로 정해 두 상태를 본다.
 * 스텁은 addInitScript라 <head> 판정 스크립트보다 먼저 돈다(첫 그림 전 이름표가 정해지는 실제 순서와 같다).
 */
const DETAIL = "/animals/990000202601000"; // 스텁의 보호 중 공고(세종 개)
const BAR = '[data-slot="bottom-cta"]';

const consoleWatch = watchConsoleErrors();
test.beforeEach(({ page }) => consoleWatch.attach(page));
test.afterEach(() => consoleWatch.assertNone());

type ShareWindow = Window & { __shared?: unknown[]; __copied?: string[] };

/** sheet: 공유 시트를 열 수 있음(share 기록), copy: 열 수 없음. 둘 다 클립보드에 쓴 값을 기록한다(실제 쓰기는 그대로) */
async function stubShare(page: Page, mode: "sheet" | "copy") {
  await page.addInitScript((mode) => {
    const w = window as ShareWindow;
    w.__shared = [];
    w.__copied = [];
    Object.defineProperty(navigator, "share", {
      configurable: true,
      value: mode === "sheet" ? (data: unknown) => (w.__shared!.push(data), Promise.resolve()) : undefined,
    });
    Object.defineProperty(navigator, "canShare", { configurable: true, value: mode === "sheet" ? () => true : undefined });
    const clipboard = navigator.clipboard;
    const write = clipboard?.writeText?.bind(clipboard);
    if (clipboard) {
      Object.defineProperty(clipboard, "writeText", {
        configurable: true,
        value: (text: string) => (w.__copied!.push(text), write ? write(text).catch(() => {}) : Promise.resolve()),
      });
    }
  }, mode);
}

const ogUrl = (page: Page) => page.locator('meta[property="og:url"]').getAttribute("content");

test("공유 시트를 열 수 있으면 '다른 앱으로 공유'이고, 누르면 제목과 og:url과 같은 주소로 공유 시트를 연다(토스트 없음)", async ({ page }) => {
  await stubShare(page, "sheet");
  await page.goto(DETAIL);
  const button = page.locator(BAR).getByRole("button", { name: "다른 앱으로 공유", exact: true });
  await expect(button).toBeVisible();
  await expect(page.locator(BAR).getByRole("button", { name: "링크 복사" })).toHaveCount(0);
  await button.click();
  await expect.poll(() => page.evaluate(() => (window as ShareWindow).__shared)).toHaveLength(1);
  const [shared] = (await page.evaluate(() => (window as ShareWindow).__shared)) as { title: string; url: string }[];
  expect(shared.url).toBe(await ogUrl(page));
  expect(Object.keys(shared).sort()).toEqual(["title", "url"]);
  await expect(page.locator("[data-sonner-toast]")).toHaveCount(0);
});

test("공유 시트를 열 수 없으면 '링크 복사'이고, 누르면 주소를 복사하고 '링크가 복사됐어요'", async ({ page, context, browserName }) => {
  if (browserName === "chromium") await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await stubShare(page, "copy");
  await page.goto(DETAIL);
  const button = page.locator(BAR).getByRole("button", { name: "링크 복사", exact: true });
  await expect(button).toBeVisible();
  await expect(page.locator(BAR).getByRole("button", { name: "다른 앱으로 공유" })).toHaveCount(0);
  await button.click();
  await expect(page.locator("[data-sonner-toast]")).toHaveText("링크가 복사됐어요");
  const url = await ogUrl(page);
  expect(await page.evaluate(() => (window as ShareWindow).__copied)).toEqual([url]);
  if (browserName === "chromium") expect(await page.evaluate(() => navigator.clipboard.readText())).toBe(url);
});

test("카카오톡을 열지 못하면 링크를 복사하고 '카카오톡을 열지 못해 링크를 복사했어요'", async ({ page }) => {
  // 스텁 서버에는 카카오 키가 없어 카카오톡 공유를 열지 못한다
  await stubShare(page, "sheet");
  await page.goto(DETAIL);
  await page.locator(BAR).getByRole("button", { name: "카카오톡 공유" }).click();
  await expect(page.locator("[data-sonner-toast]")).toHaveText("카카오톡을 열지 못해 링크를 복사했어요");
  expect(await page.evaluate(() => (window as ShareWindow).__copied)).toEqual([await ogUrl(page)]);
});

for (const width of [390, 375]) {
  for (const mode of ["sheet", "copy"] as const) {
    test(`${width} 폭(${mode === "sheet" ? "다른 앱으로 공유" : "링크 복사"})에서 바가 한 줄이다`, async ({ page }) => {
      await page.setViewportSize({ width, height: 844 });
      await stubShare(page, mode);
      await page.goto(DETAIL);
      const bar = page.locator(BAR);
      const buttons = bar.locator("button");
      await expect(buttons).toHaveCount(3);
      const boxes = await buttons.evaluateAll((elements) =>
        elements.map((element) => {
          const box = element.getBoundingClientRect();
          return { top: Math.round(box.top), height: Math.round(box.height), right: Math.round(box.right), scroll: element.scrollWidth - element.clientWidth };
        }),
      );
      // 세 버튼이 같은 줄에 44 높이로 있고, 글자가 넘치거나 줄바꿈되지 않는다
      expect(new Set(boxes.map((box) => box.top)).size).toBe(1);
      expect(boxes.map((box) => box.height)).toEqual([44, 44, 44]);
      expect(boxes.every((box) => box.scroll <= 0)).toBe(true);
      expect(boxes[2].right).toBeLessThanOrEqual(width - 16);
    });
  }
}
