import { expect, test } from "@playwright/test";
import { isCardInView, loadRealItems, mockList, openedDetail, scrollTop, watchConsoleErrors, type ListItem } from "./helpers";

/**
 * 공유 링크로 상세에 바로 들어온 사람의 뒤로가기: 그 공고가 들어 있는 목록(공고의 지역·종·상태)으로 가고,
 * focus 파라미터로 그 카드까지 스크롤한다(architecture.md 7절).
 */

let seoulItems: ListItem[];
let gyeonggiItems: ListItem[];
test.beforeAll(async ({ request }) => {
  seoulItems = await loadRealItems(request, "region=6110000");
  gyeonggiItems = await loadRealItems(request, "region=6410000");
});

const consoleWatch = watchConsoleErrors();
test.beforeEach(({ page }) => consoleWatch.attach(page));
test.afterEach(() => consoleWatch.assertNone());

test("상세로 바로 들어와 뒤로가면 그 공고의 목록으로 가고 카드가 보인다", async ({ page }) => {
  await mockList(page, seoulItems);
  const target = seoulItems[1]!;

  await page.goto(`/animals/${target.id}`);
  await openedDetail(page);
  await page.getByRole("button", { name: "뒤로가기" }).click();

  // 그 공고 기준 필터(서울 + 시군구)가 URL에 들어간다
  await expect(page).toHaveURL(/\/\?/); // 목록 주소 + 쿼리
  await expect(page).toHaveURL(/region=6110000/);
  await expect(page).toHaveURL(/district=\d{7}/);
  // 처리가 끝나면 focus는 사라진다
  await expect(page).not.toHaveURL(/focus=/);
  expect(await isCardInView(page, target.id)).toBe(true);
});

test("3페이지에 있는 공고면 이어 받아서 찾아낸다", async ({ page }) => {
  await mockList(page, seoulItems);
  const target = seoulItems[14]!; // 6건씩 나누면 3페이지

  await page.goto(`/animals/${target.id}`);
  await openedDetail(page);
  await page.getByRole("button", { name: "뒤로가기" }).click();

  await expect(page.locator(`[data-animal-id="${target.id}"]`)).toBeVisible();
  await expect(page).not.toHaveURL(/focus=/);
  expect(await isCardInView(page, target.id)).toBe(true);
  expect(await scrollTop(page), "맨 위가 아니라 그 카드까지 내려가 있다").toBeGreaterThan(0);
});

test("목록에 없는 공고면 오류 없이 맨 위에 둔다", async ({ page }) => {
  // 목록은 서울 공고만 주고, 상세는 경기 공고로 들어간다(그 공고는 목록에 없다)
  await mockList(page, seoulItems);
  const target = gyeonggiItems[0]!;

  await page.goto(`/animals/${target.id}`);
  await openedDetail(page);
  await page.getByRole("button", { name: "뒤로가기" }).click();

  await expect(page).toHaveURL(/region=6410000/);
  await expect(page).not.toHaveURL(/focus=/);
  await expect(page.locator("[data-animal-id]").first()).toBeVisible();
  expect(await scrollTop(page)).toBe(0);
});

test("기본 지역이 아닌 공고도 그 지역 목록으로 간다", async ({ page }) => {
  await mockList(page, gyeonggiItems);
  const target = gyeonggiItems[2]!;

  await page.goto(`/animals/${target.id}`);
  await openedDetail(page);
  await page.getByRole("button", { name: "뒤로가기" }).click();

  await expect(page).toHaveURL(/region=6410000/);
  await expect(page).not.toHaveURL(/focus=/);
  expect(await isCardInView(page, target.id)).toBe(true);
});
