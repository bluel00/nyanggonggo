import { expect, test } from "@playwright/test";
import { openedDetail } from "./helpers";
import { LAYER } from "./stack";

/**
 * 모바일 첫 화면(이슈 #103): 홈 LCP 그림(헤더 로고)은 지연 로딩하지 않고, 홈·목록에 검색엔진 설명이 있고,
 * 상세에는 주 랜드마크(`<main>`)가 하나고, 공유 링크로 연 상세는 JS 없이도 첫 사진이 보인다. 스텁 서버(e2e/upstream-stub.mjs), Chromium·WebKit.
 */
const LIST_URL = "/?species=dog&region=5690000";
const DETAIL_ID = "990000202600001";
const DESCRIPTION = "보호 중인 아이들의 공고가 더 많은 사람에게 닿도록.";

test("홈 헤더 로고(LCP)는 지연 로딩 없이 먼저 받는다", async ({ page }) => {
  await page.goto("/home");
  const images = page.locator('header [data-slot="logo"] img');
  await expect(images.first()).toBeVisible();
  for (const img of await images.all()) {
    await expect(img).not.toHaveAttribute("loading", "lazy");
    await expect(img).toHaveAttribute("fetchpriority", "high");
  }
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

test.describe("JS 없이 연 상세", () => {
  test.use({ javaScriptEnabled: false });

  test("공유 링크로 바로 연 상세: 첫 사진이 서버 HTML 그대로 보이고, 칸은 첫 사진 비율이다", async ({ page }) => {
    await page.goto(`/animals/${DETAIL_ID}`);
    const photo = page.locator('[data-slot="image-carousel"] button').first().locator("img");
    await expect(photo).toBeVisible();
    await expect.poll(() => photo.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
    // 스텁의 첫 사진은 1600 × 1200(4:3, detail-photo.spec.ts와 같은 공고)
    const box = await page.locator('[data-slot="image-carousel"] button').first().boundingBox();
    expect(box!.width / box!.height).toBeCloseTo(4 / 3, 2);
    await expect(page.locator('[data-slot="detail-skeleton"]')).toHaveCount(0);
  });
});
