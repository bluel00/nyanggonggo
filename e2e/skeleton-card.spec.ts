import { expect, test } from "@playwright/test";
import { watchConsoleErrors } from "./helpers";

/**
 * 로딩 카드(SkeletonCard)와 실제 카드(공고 번호 있음)의 높이가 같다(#84). 사진이 와서 카드로 바뀌어도 아래가 밀리지 않는다.
 * 첫 목록 요청을 잡아 두고 로딩 카드를 잰 뒤, 요청을 스텁 서버로 흘려 실제 카드를 잰다(스텁 공고에는 공고 번호가 있다).
 */
const LIST_URL = "/?species=dog&region=5690000";
const SKELETON = '[data-slot="skeleton-card"]';
const CARD = '[data-slot="animal-card"]';

const consoleWatch = watchConsoleErrors();
test.beforeEach(({ page }) => consoleWatch.attach(page));
test.afterEach(() => consoleWatch.assertNone());

test("로딩 카드와 공고 번호가 있는 실제 카드는 높이가 같다", async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(
    (url) => url.pathname === "/api/animals",
    async (route) => {
      await held;
      await route.continue();
    },
  );

  await page.goto(LIST_URL);
  const skeleton = page.locator(SKELETON).first();
  await expect(skeleton).toBeVisible();
  const skeletonBox = (await skeleton.boundingBox())!;

  release();
  const card = page.locator(CARD).first();
  await expect(card.locator('[data-slot="notice-no"]')).toBeVisible();
  const cardBox = (await card.boundingBox())!;

  expect(cardBox.width).toBeCloseTo(skeletonBox.width, 0);
  expect(cardBox.height).toBeCloseTo(skeletonBox.height, 0);
});
