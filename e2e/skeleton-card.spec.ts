import { expect, test } from "@playwright/test";
import { watchConsoleErrors } from "./helpers";
import { SLOW_REGIONS } from "./stub-combo.mjs";

/**
 * 로딩 카드(SkeletonCard)와 실제 카드(공고 번호 있음)의 높이가 같다(#84). 사진이 와서 카드로 바뀌어도 아래가 밀리지 않는다.
 * 목록 첫 페이지는 서버가 읽어 스트리밍으로 온다(#109). 스텁이 늦게 답하는 조합(e2e/stub-combo.mjs SLOW_REGIONS)을 열어
 * 서버가 기다리는 동안의 로딩 카드를 잰 뒤, 들어온 실제 카드를 잰다(스텁 공고에는 공고 번호가 있다).
 * 늦는 것은 서버 캐시가 비어 있을 때 한 번뿐이라 브라우저(프로젝트)마다 다른 조합을 쓴다.
 */
const SKELETON = '[data-slot="skeleton-card"]';
const CARD = '[data-slot="animal-card"]';

const consoleWatch = watchConsoleErrors();
test.beforeEach(({ page }) => consoleWatch.attach(page));
test.afterEach(() => consoleWatch.assertNone());

test("로딩 카드와 공고 번호가 있는 실제 카드는 높이가 같다", async ({ page }, testInfo) => {
  const region = testInfo.project.name.endsWith("webkit") ? SLOW_REGIONS[1] : SLOW_REGIONS[0];
  await page.goto(`/?species=dog&region=${region}`, { waitUntil: "commit" });
  const skeleton = page.locator(SKELETON).first();
  await expect(skeleton).toBeVisible();
  const skeletonBox = (await skeleton.boundingBox())!;

  const card = page.locator(CARD).first();
  await expect(card.locator('[data-slot="notice-no"]')).toBeVisible();
  const cardBox = (await card.boundingBox())!;

  expect(cardBox.width).toBeCloseTo(skeletonBox.width, 0);
  expect(cardBox.height).toBeCloseTo(skeletonBox.height, 0);
});
