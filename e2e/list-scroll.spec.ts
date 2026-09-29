import { expect, test } from "@playwright/test";
import {
  isCardInView,
  LIST_PAGE_SIZE,
  loadRealItems,
  mockList,
  scrollListToBottom,
  watchConsoleErrors,
  type ListItem,
} from "./helpers";

/**
 * 목록 → 상세 → 뒤로가기 때 열었던 카드로 돌아오는지 실제 브라우저에서 확인한다.
 * jsdom에는 레이아웃이 없어 스크롤을 검증할 수 없어서 이 흐름은 여기서만 제대로 확인된다.
 */

/** 2페이지까지 불러온 뒤 아래쪽 카드를 눌러 상세로 간다. 누른 카드 id를 돌려준다 */
async function openCardOnSecondPage(page: import("@playwright/test").Page) {
  await expect(page.locator("[data-animal-id]")).toHaveCount(LIST_PAGE_SIZE);
  await scrollListToBottom(page);
  await expect(page.locator("[data-animal-id]")).toHaveCount(LIST_PAGE_SIZE * 2);

  const target = page.locator("[data-animal-id]").nth(LIST_PAGE_SIZE + 2); // 2페이지의 카드
  const animalId = (await target.getAttribute("data-animal-id"))!;
  await target.locator("a").click();
  await expect(page).toHaveURL(new RegExp(`/animals/${animalId}$`));
  await expect(page.getByRole("button", { name: "뒤로가기" })).toBeVisible();
  return animalId;
}

let items: ListItem[];
test.beforeAll(async ({ request }) => {
  items = await loadRealItems(request);
});

const consoleWatch = watchConsoleErrors();
test.beforeEach(async ({ page }) => {
  consoleWatch.attach(page);
  await mockList(page, items);
});
test.afterEach(() => consoleWatch.assertNone());

test("화면 안 뒤로가기: 목록으로 돌아오면 열었던 카드가 보인다", async ({ page }) => {
  await page.goto("/");
  const animalId = await openCardOnSecondPage(page);

  await page.getByRole("button", { name: "뒤로가기" }).click();
  await expect(page).toHaveURL("/?region=6110000"); // 지역은 늘 주소에 있다(page.tsx가 채운다)
  await expect(page.locator(`[data-animal-id="${animalId}"]`)).toBeVisible();
  expect(await isCardInView(page, animalId)).toBe(true);
});

test("브라우저 뒤로가기: 목록으로 돌아오면 열었던 카드가 보인다", async ({ page }) => {
  await page.goto("/");
  const animalId = await openCardOnSecondPage(page);

  await page.goBack();
  await expect(page).toHaveURL("/?region=6110000");
  await expect(page.locator(`[data-animal-id="${animalId}"]`)).toBeVisible();
  expect(await isCardInView(page, animalId)).toBe(true);
});

test("기본값이 아닌 필터에서도 열었던 카드가 보인다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "필터" }).click();
  await page.getByRole("radio", { name: "종료임박순" }).click();
  await page.getByRole("button", { name: "적용하기" }).click();
  await expect(page).toHaveURL(/sort=endingSoon/);

  const animalId = await openCardOnSecondPage(page);
  await page.getByRole("button", { name: "뒤로가기" }).click();
  await expect(page).toHaveURL(/sort=endingSoon/);
  await expect(page.locator(`[data-animal-id="${animalId}"]`)).toBeVisible();
  expect(await isCardInView(page, animalId)).toBe(true);
});

// 공유 링크로 상세에 바로 들어온 경우의 뒤로가기는 focus.spec.ts가 다룬다(그 공고의 목록으로 간다)
