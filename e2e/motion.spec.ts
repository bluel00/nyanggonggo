import { expect, test, type Page } from "@playwright/test";
import {
  skipHomeScene,
  loadNextListPage,
  loadStubItems,
  openedDetail,
  rememberSpeciesCookie,
  watchConsoleErrors,
  watchList,
  type ListItem,
} from "./helpers";
import { comboLatestIds, SLOW_REGIONS } from "./stub-combo.mjs";

/**
 * 움직임(architecture.md 14.2 3단계, README 움직임 표·원칙). production 빌드에서 본다(링크 prefetch가 실제와 같다).
 * 애니메이션 유무는 `getAnimations()`로 본다(CSS animation·transition 모두 잡힌다).
 *
 * 목록 첫 화면 등장은 뼈대가 실제로 보였을 때만 돈다(handoff "목록 첫 화면 등장", #109). 첫 페이지는 서버가 읽으므로 뼈대가 꼭 보여야 하는
 * 테스트는 스텁이 늦게 답하는 조합(e2e/stub-combo.mjs SLOW_REGIONS)을 연다. 늦는 것은 서버 캐시가 빈 첫 요청뿐이라 테스트마다 다른 조합이다.
 * 등장한 카드는 `enter-rise` 애니메이션이 시작된 카드로 센다(서버가 그린 첫 페이지는 CSS만으로, 클라이언트가 받은 목록은 data-enter로 돈다).
 */

/** 휴대폰 화면(Pixel 7 크기). 첫 화면에 카드 두 장(0·1번)이 보인다 */
test.use({ viewport: { width: 412, height: 839 } });

let items: ListItem[];
test.beforeAll(async ({ request }) => {
  items = await loadStubItems(request);
});

const consoleWatch = watchConsoleErrors();
test.beforeEach(async ({ page, context }) => {
  consoleWatch.attach(page);
  await rememberSpeciesCookie(context);
  // 등장(enter-rise)이 시작된 카드 id를 순서대로 남긴다
  await page.addInitScript(() => {
    const w = window as unknown as { __entered: string[] };
    w.__entered = [];
    document.addEventListener(
      "animationstart",
      (event) => {
        const target = event.target as Element;
        if (event.animationName === "enter-rise" && target.matches('[data-slot="animal-card"]')) {
          w.__entered.push(target.getAttribute("data-animal-id")!);
        }
      },
      true,
    );
  });
});
test.afterEach(() => consoleWatch.assertNone());

const card = (page: Page, id: string) => page.locator(`[data-animal-id="${id}"]`);

/** 문서 전체에서 돌고 있는(또는 기다리는) 애니메이션 수 */
const runningAnimations = (page: Page) =>
  page.evaluate(() => document.getAnimations().filter((a) => a.playState === "running" || a.pending).length);

/** 그 카드(찜 버튼 포함) 안에서 도는 애니메이션의 이름(CSS animation) 또는 속성(transition) */
const cardAnimations = (page: Page, id: string) =>
  page.evaluate((animalId) => {
    const root = document.querySelector(`[data-animal-id="${animalId}"]`)!;
    return document
      .getAnimations()
      .filter((a) => a.effect instanceof KeyframeEffect && a.effect.target instanceof Element && root.contains(a.effect.target))
      .filter((a) => a.playState === "running" || a.pending)
      .map((a) => (a as CSSAnimation).animationName ?? (a as CSSTransition).transitionProperty);
  }, id);

/** 목록 첫 화면 등장이 시작된 카드 id(시작한 순서) */
const enteringCards = (page: Page) => page.evaluate(() => (window as unknown as { __entered: string[] }).__entered);

/** 등장 표시(서버 첫 페이지의 html[data-list-enter], 클라이언트 목록의 data-enter="list")가 남아 있는지 */
const enterMarks = (page: Page) =>
  page.evaluate(() => document.documentElement.hasAttribute("data-list-enter") || document.querySelector('[data-enter="list"]') !== null);

test.describe("움직임 줄이기", () => {
  test.use({ reducedMotion: "reduce" });

  test("홈·목록·카드 누름·찜 어디서도 애니메이션이 하나도 돌지 않는다", async ({ page }) => {
    await watchList(page);
    await page.goto("/home");
    await expect(page.getByRole("heading", { name: "오늘은 누구를 보러 왔어요?" })).toBeVisible();
    expect(await runningAnimations(page)).toBe(0);

    await page.goto("/");
    await expect(card(page, items[0].id)).toBeVisible();
    expect(await runningAnimations(page)).toBe(0);

    // 누르고 있는 동안
    const link = card(page, items[0].id).locator("a");
    const box = (await link.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    expect(await runningAnimations(page)).toBe(0);
    await page.mouse.move(0, 0);
    await page.mouse.up();

    // 찜 켜기·끄기
    const favorite = card(page, items[0].id).getByRole("button", { name: "관심 공고에 담기" });
    await favorite.click();
    expect(await cardAnimations(page, items[0].id)).toEqual([]);
    await card(page, items[0].id).getByRole("button", { name: "관심 공고에서 빼기" }).click();
    expect(await cardAnimations(page, items[0].id)).toEqual([]);
  });
});

test("종료 카드: 첫 화면 등장·누름·하트 튐이 없다(보호중 카드는 등장·튐이 있다)", async ({ page }) => {
  // 스텁 조합 목록(상태 전체)은 1번이 종료 공고다. 뼈대가 보이도록 늦게 답하는 조합을 연다
  const ENDED = 1;
  const region = SLOW_REGIONS[2];
  const list = comboLatestIds("cat", region, null, { status: "all" }).map((id) => ({ id }));
  await watchList(page);
  await page.goto(`/?species=cat&region=${region}&status=all`, { waitUntil: "commit" });
  await expect(page.locator('[data-slot="skeleton-card"]').first()).toBeVisible();
  await expect(card(page, list[ENDED].id)).toBeVisible();
  await expect(card(page, list[ENDED].id)).toHaveAttribute("data-status-variant", "ended");

  // 첫 화면의 두 장 중 보호중(0번)만 등장한다
  await expect.poll(() => enteringCards(page)).toEqual([list[0].id]);
  expect(await cardAnimations(page, list[ENDED].id)).toEqual([]);

  // 누르고 있는 동안에도 아무것도 돌지 않는다
  const link = card(page, list[ENDED].id).locator("a");
  const box = (await link.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  expect(await cardAnimations(page, list[ENDED].id)).toEqual([]);
  await page.mouse.move(0, 0);
  await page.mouse.up();

  // 찜: 종료는 채움만, 보호중은 튄다
  await card(page, list[ENDED].id).getByRole("button", { name: "관심 공고에 담기" }).click();
  await expect(card(page, list[ENDED].id).getByRole("button", { name: "관심 공고에서 빼기" })).toBeVisible();
  expect(await cardAnimations(page, list[ENDED].id)).toEqual([]);
  await card(page, list[0].id).getByRole("button", { name: "관심 공고에 담기" }).click();
  expect(await cardAnimations(page, list[0].id)).toContain("heart-pop");
});

test("다음 페이지 카드와 상세에서 돌아온 목록에는 등장 효과가 없다", async ({ page }) => {
  // 뼈대가 보이도록 늦게 답하는 조합을 연다(첫 화면 등장이 돈다)
  const region = SLOW_REGIONS[3];
  const ids = comboLatestIds("cat", region, null);
  await watchList(page);
  await page.goto(`/?species=cat&region=${region}`, { waitUntil: "commit" });
  await expect(page.locator('[data-slot="skeleton-card"]').first()).toBeVisible();
  await expect(card(page, ids[0])).toBeVisible();
  // 첫 화면은 한 번 등장한다
  await expect.poll(() => enteringCards(page)).toEqual([ids[0], ids[1]]);
  await expect.poll(() => enterMarks(page), { message: "등장이 끝나면 표시를 지운다" }).toBe(false);

  await loadNextListPage(page);
  const next = ids[20]; // 2페이지 첫 카드(서버 목록 한 페이지 20건)
  await expect(card(page, next)).toBeVisible();
  expect(await enteringCards(page)).toEqual([ids[0], ids[1]]);
  expect(await cardAnimations(page, next)).toEqual([]);

  await card(page, next).locator("a").click();
  await openedDetail(page);
  await page.goBack();
  await expect(card(page, next)).toBeVisible();
  expect(await enteringCards(page)).toEqual([ids[0], ids[1]]);
  for (const id of [ids[0], next]) expect(await cardAnimations(page, id)).toEqual([]);
});

test("홈 등장: 제목 → 고양이 → 강아지 → 링크, 60ms 간격으로 320ms씩, 500ms에 끝난다", async ({ page }) => {
  // 두 번째 진입부터의 등장이다(세션 첫 진입의 첫인상 장면은 home-scene.spec.ts, #115)
  await skipHomeScene(page);
  await page.goto("/home");
  await expect(page.getByRole("link", { name: "고양이", exact: true })).toBeVisible();
  const entrance = await page.evaluate(() =>
    [...document.querySelectorAll('[data-enter="home"]')].map((el) => {
      const timing = el.getAnimations()[0]?.effect?.getComputedTiming();
      return timing ? Number(timing.delay) + Number(timing.duration) : null;
    }),
  );
  expect(entrance).toEqual([320, 380, 440, 500]);
});

test("등장 중에 축종 카드를 누르면 목록 이동이 바로 시작된다(이동을 늦추지 않는다)", async ({ page }) => {
  await skipHomeScene(page);
  await watchList(page);
  // 누른 순간(click 이벤트)의 시각과 그때 등장이 돌고 있었는지를 남긴다
  await page.addInitScript(() => {
    const w = window as unknown as { __click: { at: number; entering: boolean } };
    document.addEventListener(
      "click",
      () => {
        const entering = [...document.querySelectorAll('[data-enter="home"]')].some((el) =>
          el.getAnimations().some((a) => a.playState === "running"),
        );
        w.__click = { at: performance.now(), entering };
      },
      { capture: true, once: true },
    );
  });
  const navigation = page.waitForRequest(
    (request) => {
      const url = new URL(request.url());
      return url.pathname === "/" && url.searchParams.get("species") === "cat" && !request.headers()["next-router-prefetch"];
    },
    { timeout: 5_000 },
  );
  await page.goto("/home", { waitUntil: "commit" });
  const cat = page.getByRole("link", { name: "고양이", exact: true });
  await cat.waitFor({ state: "attached" });
  // 사람이 누르듯 좌표로 누른다(locator.click은 움직임이 멈출 때까지 기다린다)
  const box = (await cat.boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  const request = await navigation;
  await expect(page).toHaveURL(/species=cat/);
  const result = await page.evaluate((url) => {
    const click = (window as unknown as { __click: { at: number; entering: boolean } }).__click;
    const entry = performance.getEntriesByType("resource").find((e) => e.name === url && e.startTime >= click.at);
    return { entering: click.entering, elapsed: entry ? entry.startTime - click.at : null };
  }, request.url());
  expect(result.entering, "등장이 도는 중에 눌렀다").toBe(true);
  expect(result.elapsed, "이동 요청이 리소스 기록에 있다").not.toBeNull();
  expect(result.elapsed!, `누름 → 이동 요청 ${Math.round(result.elapsed!)}ms`).toBeLessThan(50);
});
