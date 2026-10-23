import { expect, test, type Page } from "@playwright/test";
import { openedDetail, watchConsoleErrors } from "./helpers";

/**
 * 종료 공고의 결과와 종료 사유(이슈 #41). 스텁(e2e/upstream-stub.mjs)의 종료 공고는 processState가 "종료(입양)"이고,
 * 하나(ENDED_REASONS)에만 종료 사유가 있다. 카드 배지와 상세 배지는 "종료 · 입양"이고, 종료 사유가 있으면 상세에 "종료 사유" 줄이 있다.
 */
/** e2e/upstream-stub.mjs의 ENDED_CASES·ENDED_REASONS와 같다 */
const WITH_REASON = "990000202600011";
const WITHOUT_REASON = "990000202600012";
const REASON = "E2E 입양 완료";
const FAVORITES_STORAGE_KEY = "nyanggonggo:favorites";

const consoleWatch = watchConsoleErrors();
test.beforeEach(({ page }) => consoleWatch.attach(page));
test.afterEach(() => consoleWatch.assertNone());

async function openDetail(page: Page, id: string) {
  await page.goto(`/animals/${id}`);
  await openedDetail(page);
  return page.locator('[data-slot="animal-detail"]');
}

test("종료 공고 카드(찜 목록): 배지가 '종료 · 입양'이다", async ({ page }) => {
  await page.addInitScript(
    ([key, ids]) => window.localStorage.setItem(key, JSON.stringify(ids)),
    [FAVORITES_STORAGE_KEY, [WITH_REASON, WITHOUT_REASON]] as const,
  );
  await page.goto("/favorites");
  for (const id of [WITH_REASON, WITHOUT_REASON]) {
    await expect(page.locator(`[data-animal-id="${id}"] [data-slot="status-badge"]`)).toHaveText("종료 · 입양");
  }
});

test("종료 상세: 배지가 '종료 · 입양'이고, 종료 사유가 있으면 '종료 사유' 줄이 있다", async ({ page }) => {
  const detail = await openDetail(page, WITH_REASON);
  await expect(detail.locator('[data-slot="status-badge"]')).toHaveText("종료 · 입양");
  const term = detail.locator("dt", { hasText: "종료 사유" });
  await expect(term).toHaveCount(1);
  await expect(term.locator("xpath=following-sibling::dd[1]")).toContainText(REASON);
});

test("종료 상세: 종료 사유가 없으면 줄이 없다", async ({ page }) => {
  const detail = await openDetail(page, WITHOUT_REASON);
  await expect(detail.locator('[data-slot="status-badge"]')).toHaveText("종료 · 입양");
  await expect(detail.locator("dt", { hasText: "종료 사유" })).toHaveCount(0);
});
