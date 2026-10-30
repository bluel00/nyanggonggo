import { expect, test } from "@playwright/test";
import { openedDetail } from "./helpers";
import { LAYER } from "./stack";

/**
 * 모바일 첫 화면(이슈 #103): 홈 헤더 로고는 서버 HTML에 인라인 SVG로 들어 있어 그림 요청을 기다리지 않고(#115), 홈·목록에 검색엔진 설명이 있고,
 * 상세에는 주 랜드마크(`<main>`)가 하나다. 스텁 서버(e2e/upstream-stub.mjs), Chromium·WebKit.
 */
const LIST_URL = "/?species=dog&region=5690000";
const DETAIL_ID = "990000202600001";
const DESCRIPTION = "보호 중인 아이들의 공고가 더 많은 사람에게 닿도록.";

test("홈 헤더 로고는 서버 HTML에 인라인 SVG로 들어 있어 그림 파일을 받지 않는다(#115)", async ({ page }) => {
  const logoRequests: string[] = [];
  page.on("request", (request) => {
    if (/myeongnyang-[\w-]*\.svg/.test(request.url())) logoRequests.push(new URL(request.url()).pathname);
  });
  const response = await page.goto("/home");
  const html = await response!.text();
  expect(html).toMatch(/data-slot="logo"[^>]*>\s*<svg[^>]*viewBox="0 0 130\.34 56"/);
  const logo = page.locator('header [data-slot="logo"]');
  await expect(logo.locator("svg")).toBeVisible();
  await expect(logo.locator("img")).toHaveCount(0);
  expect(logoRequests).toEqual([]);
});

for (const [name, url] of [
  ["홈", "/home"],
  ["목록", LIST_URL],
] as const) {
  test(`${name}: <head>에 검색엔진 설명(한 줄 소개)이 있다`, async ({ page }) => {
    await page.goto(url);
    await expect(page.locator('head meta[name="description"]')).toHaveAttribute("content", DESCRIPTION);
  });
}

test("공유 링크로 바로 연 상세: <main>이 하나다", async ({ page }) => {
  await page.goto(`/animals/${DETAIL_ID}`);
  await openedDetail(page);
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.getByRole("main").locator('[data-slot="animal-detail"]')).toBeVisible();
});

test("목록에서 얹은 상세: <main>은 아래 목록의 것 하나다(층에는 없다)", async ({ page }) => {
  await page.goto(LIST_URL);
  await page.locator("[data-animal-id] a").first().click();
  await expect(page.locator(LAYER)).toBeVisible();
  await openedDetail(page);
  await expect(page.locator("main")).toHaveCount(1);
  await expect(page.locator(LAYER).locator("main")).toHaveCount(0);
});
