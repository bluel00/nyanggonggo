import { expect, test, type Page } from "@playwright/test";
import { openedDetail, REGION_COOKIE, rememberSpeciesCookie, SPECIES_COOKIE, watchConsoleErrors } from "./helpers";

/**
 * 목록의 성별 필터(이슈 #20). 목록은 고정하지 않고 스텁 서버(e2e/upstream-stub.mjs)가 거른 결과를 그대로 본다.
 * 고양이·서울 30건은 index % 3으로 암컷 / 수컷 / 미상이다(스텁과 같아야 한다). 최신순은 index 0이 맨 앞이다.
 */
const SEOUL = "6110000";
const seoulCatId = (index: number) => String(990000202602000 + index);
const FEMALE_IDS = Array.from({ length: 30 }, (_, i) => i)
  .filter((i) => i % 3 === 0)
  .map(seoulCatId);
const CARDS = "[data-animal-id]";

const cardIds = (page: Page) => page.locator(CARDS).evaluateAll((els) => els.map((el) => el.getAttribute("data-animal-id")));

async function chooseFemale(page: Page) {
  await page.getByRole("button", { name: "필터" }).click();
  await page.getByRole("group", { name: "성별" }).getByRole("button", { name: "암컷" }).click();
  await page.getByRole("button", { name: "적용하기" }).click();
}

const consoleWatch = watchConsoleErrors();
test.beforeEach(async ({ page, context }) => {
  consoleWatch.attach(page);
  await rememberSpeciesCookie(context);
});
test.afterEach(() => consoleWatch.assertNone());

test("암컷을 고르면 암컷만 남고 URL과 [필터] 버튼에 반영된다", async ({ page }) => {
  await page.goto(`/?species=cat&region=${SEOUL}`);
  await expect(page.locator(CARDS)).toHaveCount(20);

  await chooseFemale(page);
  await expect(page).toHaveURL(`/?species=cat&region=${SEOUL}&sex=female`);
  await expect.poll(() => cardIds(page)).toEqual(FEMALE_IDS);
  // 목록 위 필터 요약이 따로 없어 [필터] 버튼이 선택 모양 + 이름으로 알린다
  const trigger = page.getByRole("button", { name: "필터, 암컷" });
  await expect(trigger).toHaveAttribute("data-selected", "true");
});

test("상세에 갔다가 돌아와도 성별이 유지된다", async ({ page }) => {
  await page.goto(`/?species=cat&region=${SEOUL}&sex=female`);
  await expect.poll(() => cardIds(page)).toEqual(FEMALE_IDS);

  const target = FEMALE_IDS[2]!;
  await page.locator(`[data-animal-id="${target}"] a`).click();
  await expect(page).toHaveURL(new RegExp(`/animals/${target}$`));
  await openedDetail(page);
  await page.goBack();

  await expect(page).toHaveURL(`/?species=cat&region=${SEOUL}&sex=female`);
  expect(await cardIds(page)).toEqual(FEMALE_IDS);
  await expect(page.getByRole("button", { name: "필터, 암컷" })).toBeVisible();
});

test("새로 들어오면(쿼리 없이) 전체로 시작한다: 성별은 기억하지 않는다", async ({ page, context }) => {
  await page.goto(`/?species=cat&region=${SEOUL}`);
  await expect(page.locator(CARDS)).toHaveCount(20);
  await chooseFemale(page);
  await expect(page).toHaveURL(/sex=female/);

  // 지역·축종은 기억되고 성별 쿠키는 없다
  const cookies = await context.cookies();
  const ours = cookies.filter((c) => c.name.startsWith("nyanggonggo"));
  expect(ours.map((c) => c.name).sort()).toEqual([REGION_COOKIE, SPECIES_COOKIE].sort());
  expect(cookies.map((c) => `${c.name}=${c.value}`).join(" ")).not.toMatch(/female|sex/);

  const next = await context.newPage();
  consoleWatch.attach(next);
  await next.goto("/");
  await expect(next).toHaveURL(`/?species=cat&region=${SEOUL}`);
  await expect(next.locator(CARDS)).toHaveCount(20);
  // 수컷(index 1)과 성별 미상(index 2)도 보인다. 미상은 전체에서만 보인다
  expect((await cardIds(next)).slice(0, 3)).toEqual([seoulCatId(0), seoulCatId(1), seoulCatId(2)]);
  expect(await next.getByRole("button", { name: "필터" }).getAttribute("data-selected")).toBeNull();
});
