import { expect, test } from "@playwright/test";
import { loadRealItems, mockList, rememberSpeciesCookie, watchConsoleErrors, type ListItem } from "./helpers";

/**
 * 목록 카드를 누르면 상세가 뜨기 전에 바로 상세 뼈대가 보이는지(`app/animals/[id]/loading.tsx`).
 *
 * 상세는 서버가 공고를 조회한 뒤 그려진다(실측 0.5~0.9초). 그동안 화면이 그대로면 사용자가 여러 번 누른다.
 * 서버가 느린 상황을 만들려고 상세로 가는 RSC 요청(prefetch가 아닌 실제 이동 요청)을 일부러 늦춘다.
 * 로딩 경계가 있으면 그 요청을 기다리지 않고 뼈대를 먼저 그리고, 없으면 요청이 끝날 때까지 목록이 그대로다.
 */

/** 상세 이동 요청을 늦추는 시간. 뼈대를 기다리는 시간(200ms)보다 충분히 길게 둔다 */
const DETAIL_DELAY_MS = 1500;
/** 카드를 누른 뒤 뼈대가 보여야 하는 시간 */
const SKELETON_WITHIN_MS = 200;

let items: ListItem[];
test.beforeAll(async ({ request }) => {
  items = await loadRealItems(request);
});

const consoleWatch = watchConsoleErrors();
test.beforeEach(async ({ page, context }) => {
  consoleWatch.attach(page);
  await rememberSpeciesCookie(context);
});
test.afterEach(() => consoleWatch.assertNone());

test("상세가 느려도 카드를 누르면 바로 상세 뼈대가 보이고, 이어서 실제 상세로 바뀐다", async ({ page }) => {
  await mockList(page, items);
  const target = items[1];

  // 실제 이동 요청만 늦춘다(prefetch는 그대로 둔다). 늦춘 요청이 끝났는지 기록한다
  let navigationDone = false;
  await page.route(
    (url) => url.pathname === `/animals/${target.id}` && url.searchParams.has("_rsc"),
    async (route) => {
      if (route.request().headers()["next-router-prefetch"]) return route.continue();
      await new Promise((resolve) => setTimeout(resolve, DETAIL_DELAY_MS));
      await route.continue();
      navigationDone = true;
    },
  );

  await page.goto("/");
  const card = page.locator(`[data-animal-id="${target.id}"] a`);
  await expect(card).toBeVisible();
  // 화면에 들어온 카드의 prefetch가 끝나기를 기다린다(실사용에서 카드를 누르기까지 걸리는 시간)
  await page.waitForLoadState("networkidle");

  await card.click();
  const skeleton = page.locator('[data-slot="detail-skeleton"]');
  await expect(skeleton).toBeVisible({ timeout: SKELETON_WITHIN_MS });
  // 늦춘 요청이 끝나기 전이다: 상세 위젯이 아니라 라우트 로딩 경계가 그린 뼈대다
  expect(navigationDone).toBe(false);
  // 뼈대에서도 뒤로 갈 수 있다
  await expect(page.getByRole("button", { name: "뒤로가기" })).toBeVisible();

  await expect(page.locator('[data-slot="animal-detail"]')).toBeVisible({ timeout: DETAIL_DELAY_MS + 10_000 });
  await expect(skeleton).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`/animals/${target.id}$`));
});
