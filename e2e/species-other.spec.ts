import { expect, test } from "@playwright/test";
import { isCardInView, loadRealItems, mockList, watchConsoleErrors, type ListItem } from "./helpers";

/**
 * 기타 축종(upkind=429900). 기타 공고는 `kindNm`이 늘 "기타축종"이라 어떤 동물인지는
 * `kindFullNm`에서 뽑은 `kindText`에만 있다(architecture.md 12.A P12).
 * 목록은 page.route로 고정하지만, 상세는 서버 렌더라 실제 기타 공고 id가 필요하다.
 */

let otherItems: ListItem[];
test.beforeAll(async ({ request }) => {
  // 전국 기타·보호중(시군구를 좁히면 건수가 모자랄 수 있다)
  otherItems = await loadRealItems(request, "", "other");
  const named = otherItems.find((item) => item.kindText);
  expect(named, "동물 이름이 있는 기타 공고가 있어야 한다").toBeTruthy();
});

const consoleWatch = watchConsoleErrors();
test.beforeEach(({ page }) => consoleWatch.attach(page));
test.afterEach(() => consoleWatch.assertNone());

test("실제 목록 API가 기타 축종을 돌려주고 어떤 동물인지 담겨 있다", async () => {
  expect(otherItems.length).toBeGreaterThan(0);
  expect(otherItems.every((item) => item.species === "other")).toBe(true);
  // 실측에서 kindFullNm은 늘 "[기타축종] <동물>"이라 대부분 이름이 뽑힌다
  expect(otherItems.filter((item) => item.kindText).length).toBeGreaterThan(otherItems.length / 2);
});

test("필터에서 기타를 고르면 기타 조건으로 조회하고 카드에 동물 이름이 보인다", async ({ page }) => {
  const requests = await mockList(page, otherItems);
  await page.goto("/");
  await expect(page.locator("[data-animal-id]").first()).toBeVisible();

  await page.getByRole("button", { name: "필터" }).click();
  await page.getByRole("radio", { name: "기타 동물" }).click();
  await page.getByRole("button", { name: "적용하기" }).click();

  await expect(page).toHaveURL(/species=other/);
  await expect(page.getByRole("heading", { name: "기타 동물 공고" })).toBeVisible();
  expect(requests.filter((url) => url.searchParams.get("species") === "other").length).toBeGreaterThan(0);

  // 카드 1줄은 "<동물> · <지역>"이다
  const target = otherItems.find((item) => item.kindText)!;
  const card = page.locator(`[data-animal-id="${target.id}"]`);
  await expect(card).toBeVisible();
  await expect(card).toContainText(`${target.kindText} · ${target.regionText}`);
});

test("공유 링크로 들어온 기타 공고는 상세에 동물 이름이 보이고 뒤로가면 기타 목록이다", async ({ page }) => {
  await mockList(page, otherItems);
  const target = otherItems.find((item) => item.kindText)!;

  await page.goto(`/animals/${target.id}`);
  // 상세는 서버 렌더다(목킹 아님). 타이틀에 어떤 동물인지가 들어 있다
  await expect(page.getByRole("heading", { name: `${target.kindText} · ${target.regionText}` })).toBeVisible();

  await page.getByRole("button", { name: "뒤로가기" }).click();
  await expect(page).toHaveURL(/species=other/);
  await expect(page).not.toHaveURL(/focus=/);
  await expect(page.getByRole("heading", { name: "기타 동물 공고" })).toBeVisible();
  expect(await isCardInView(page, target.id)).toBe(true);
});
