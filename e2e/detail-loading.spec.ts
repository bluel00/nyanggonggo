import { expect, test, type Page } from "@playwright/test";
import { loadRealItems, mockList, openedDetail, rememberSpeciesCookie, watchConsoleErrors, type ListItem } from "./helpers";

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

/** 상세 이동 요청(prefetch가 아닌 실제 이동 RSC)을 ms만큼 늦춘다. 끝났는지 기록한다 */
async function delayDetailNavigation(page: Page, id: string, ms: number) {
  const state = { done: false };
  await page.route(
    (url) => url.pathname === `/animals/${id}` && url.searchParams.has("_rsc"),
    async (route) => {
      if (route.request().headers()["next-router-prefetch"]) return route.continue();
      await new Promise((resolve) => setTimeout(resolve, ms));
      await route.continue().catch(() => {});
      state.done = true;
    },
  );
  return state;
}

/** 뼈대 뒤로가기를 누르는 동안 상세가 뜨지 않도록 길게 늦춘다 */
const SLOW_DETAIL_MS = 4000;

test("목록에서 들어와 뼈대가 떠 있을 때 뒤로가기를 누르면 그 목록으로 돌아간다(브라우저 뒤로가기)", async ({ page }) => {
  await mockList(page, items);
  const target = items[1];
  const navigation = await delayDetailNavigation(page, target.id, SLOW_DETAIL_MS);

  await page.goto("/?region=6110000");
  const listUrl = page.url();
  const card = page.locator(`[data-animal-id="${target.id}"] a`);
  await expect(card).toBeVisible();
  await page.waitForLoadState("networkidle");

  await card.click();
  await expect(page.locator('[data-slot="detail-skeleton"]')).toBeVisible({ timeout: SKELETON_WITHIN_MS });
  await page.getByRole("button", { name: "뒤로가기" }).click();

  // 늦춘 상세가 끝나기 전에 원래 목록(필터가 붙은 주소)으로 돌아와 있다
  await expect(page).toHaveURL(listUrl);
  await expect(card).toBeVisible();
  expect(navigation.done).toBe(false);
});

test("바로 들어온 탭에서 뼈대가 떠 있으면 뒤로가기 버튼을 그리지 않고 자리만 둔다(기본 목록으로 보내지 않는다)", async ({ page }) => {
  // 공유 링크로 상세 A에 바로 들어온 탭(목록을 거치지 않음). 이 탭에서 다른 상세 B로 가는 동안 뼈대가 뜨게 한다.
  // 서버가 바로 그린 첫 화면의 뼈대는 서버 렌더라 버튼이 없다(animal-detail-skeleton.test.tsx). 여기서는 같은 판단이
  // 클라이언트에서 그린 뼈대에서도 지켜지는지를, B의 이동 요청을 늦춰서 본다.
  const [first, target] = [items[2], items[3]];
  await page.goto(`/animals/${first.id}`);
  await openedDetail(page);
  const navigation = await delayDetailNavigation(page, target.id, SLOW_DETAIL_MS);
  // 로딩 경계까지는 prefetch로 받아 두고(카드를 화면에 둔 것과 같다) 실제 이동은 늦춘다
  await page.evaluate((href) => (window as unknown as { next: { router: { prefetch(h: string): void } } }).next.router.prefetch(href), `/animals/${target.id}`);
  await page.waitForLoadState("networkidle");
  await page.evaluate((href) => (window as unknown as { next: { router: { push(h: string): void } } }).next.router.push(href), `/animals/${target.id}`);

  const skeleton = page.locator('[data-slot="detail-skeleton"]');
  await expect(skeleton).toBeVisible({ timeout: 2000 });
  expect(navigation.done).toBe(false);
  await expect(page.getByRole("button", { name: "뒤로가기" })).toHaveCount(0);
  const placeholder = skeleton.locator('[data-slot="back-placeholder"]');
  await expect(placeholder).toBeVisible();
  const slot = await placeholder.boundingBox();

  // 상세가 뜨면 같은 자리(헤더가 움직이지 않음)에 상세의 뒤로가기가 생긴다
  await expect(page.locator('[data-slot="animal-detail"]')).toBeVisible({ timeout: SLOW_DETAIL_MS + 10_000 });
  const button = await page.getByRole("button", { name: "뒤로가기" }).boundingBox();
  expect(button).toEqual(slot);
});
