import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import { HOME_SCENE_SEEN_KEY, watchConsoleErrors, watchList } from "./helpers";

/**
 * 홈 첫인상 "부르고 답하기"(handoff (k), #115 4단계). production 빌드에서 본다(Rive 정적 파일·번들 그대로).
 *
 * - 세션의 첫 홈 진입: <html data-home-scene>이 pending → play로 바뀌고(장면 0초), 두 캐릭터가 firstVisit = true로 시작한다
 * - 같은 세션의 두 번째 진입(앱 안 이동)·새로고침: 장면 없이(속성 없음) 지금 등장 + firstVisit = false
 * - Rive를 0.3초 넘게 늦게 받으면: pending → off(대체), 지금 등장 + firstVisit = false, 첫 진입 기록은 남는다
 * - 움직임 줄이기: 장면·인사 없이 정지 상태, 기록은 남는다
 * - 장면 중 카드를 누르면 바로 이동한다
 */

const consoleWatch = watchConsoleErrors();
test.beforeEach(({ page }) => consoleWatch.attach(page));
test.afterEach(() => consoleWatch.assertNone());

/** 문서가 만들어질 때부터 <html data-home-scene>의 값이 바뀐 차례를 남긴다 */
async function recordScene(context: BrowserContext | Page) {
  await context.addInitScript(() => {
    const w = window as unknown as { __scene: (string | null)[] };
    w.__scene = [];
    new MutationObserver(() => w.__scene.push(document.documentElement?.getAttribute("data-home-scene") ?? null)).observe(document, {
      attributes: true,
      subtree: true,
      attributeFilter: ["data-home-scene"],
    });
  });
}
const sceneHistory = (page: Page) => page.evaluate(() => (window as unknown as { __scene: (string | null)[] }).__scene);
const sceneNow = (page: Page) => page.evaluate(() => document.documentElement.getAttribute("data-home-scene"));
const seen = (page: Page, key = HOME_SCENE_SEEN_KEY) => page.evaluate((k) => sessionStorage.getItem(k), key);

/** 두 캐릭터가 시작했을 때의 firstVisit(캔버스 data-first-visit) */
async function startedFirstVisit(page: Page) {
  await page.waitForFunction(() => {
    const canvases = [...document.querySelectorAll<HTMLCanvasElement>('[data-slot="character-canvas"]')];
    return canvases.length === 2 && canvases.every((canvas) => canvas.dataset.ready === "true");
  });
  return page.locator('[data-slot="character-canvas"]').evaluateAll((canvases) => canvases.map((canvas) => (canvas as HTMLElement).dataset.firstVisit));
}

/** 홈의 등장 요소에 지금 걸린 CSS 애니메이션 이름과 늦춤(ms) */
const entranceAnimations = (page: Page) =>
  page.evaluate(() =>
    [...document.querySelectorAll('[data-enter="home"]')].map((el) =>
      el.getAnimations().map((animation) => `${(animation as CSSAnimation).animationName}@${Math.round(Number((animation.effect as KeyframeEffect).getTiming().delay))}`),
    ),
  );

test("첫 진입: 장면이 돌고(pending → play) 두 캐릭터가 firstVisit = true로 시작한다. 기록이 남는다", async ({ page }) => {
  await recordScene(page);
  await page.goto("/home");
  expect(await startedFirstVisit(page)).toEqual(["true", "true"]);
  expect(await sceneHistory(page)).toEqual(["pending", "play"]);
  expect(await seen(page)).toBe("1");
  // 질문 두 줄·보조 문구·카드가 시간표대로 걸렸다(질문 0.26/0.34, 보조 0.42, 카드 0.52/0.58/0.64)
  const delays = await page.evaluate(() =>
    [...document.querySelectorAll('[data-scene="question-line"], [data-scene="sub"], [data-enter="home"]:not([data-scene="intro"])')].map((el) =>
      el.getAnimations().map((animation) => Math.round(Number((animation.effect as KeyframeEffect).getTiming().delay))),
    ),
  );
  expect(delays).toEqual([[260], [340], [420], [520], [580], [640]]);
  // 로고 속 강아지 "멍"(얼굴 0.12, 귀 0.14, 입 0.15, 소리 선 0.18), 고양이 눈 힐끗(0.30), 기타 동물 셋 까딱(1.18/1.25/1.32)
  const logo = await page.evaluate(() =>
    ["dog", "dog-ear", "dog-mouth", "bark-lines", "cat-eyes"].map((part) =>
      document.querySelector(`[data-slot="logo"] [data-part="${part}"]`)!.getAnimations().map((a) => Math.round(Number((a.effect as KeyframeEffect).getTiming().delay))),
    ),
  );
  expect(logo).toEqual([[120], [140], [150], [180], [300]]);
  const bob = await page.evaluate(() =>
    [...document.querySelectorAll('[data-slot="other-characters"] > img')].map((img) => img.getAnimations().map((a) => Math.round(Number((a.effect as KeyframeEffect).getTiming().delay)))),
  );
  expect(bob).toEqual([[1180], [1250], [1320]]);
  // 로고와 한 줄 소개는 처음부터 보인다(등장 효과 없음)
  await expect(page.getByRole("img", { name: "멍냥공고" })).toBeVisible();
});

test("두 번째 진입(앱 안 이동)과 새로고침: 장면 없이 지금 등장 + firstVisit = false", async ({ page }) => {
  await watchList(page);
  await page.goto("/home");
  expect(await startedFirstVisit(page)).toEqual(["true", "true"]);

  // 목록으로 갔다가 헤더의 홈 진입점으로 돌아온다(축종을 바꾸러 홈에 다시 옴)
  await page.getByRole("link", { name: "고양이", exact: true }).click();
  await expect(page.getByRole("heading", { name: /고양이 공고/ })).toBeVisible();
  expect(await sceneNow(page), "홈을 떠나면 속성이 지워진다").toBeNull();
  await page.getByRole("link", { name: "고양이 공고, 다른 동물 고르기" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await sceneNow(page)).toBeNull();
  expect(await entranceAnimations(page)).toEqual([["enter-rise@0"], ["enter-rise@60"], ["enter-rise@120"], ["enter-rise@180"]]);
  expect(await startedFirstVisit(page)).toEqual(["false", "false"]);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await sceneNow(page)).toBeNull();
  expect(await startedFirstVisit(page)).toEqual(["false", "false"]);
});

test("Rive를 0.3초 넘게 늦게 받으면 대체(pending → off): 지금 등장 + firstVisit = false, 기록은 남는다", async ({ page }) => {
  await recordScene(page);
  await page.route("**/characters/nyang-characters.riv", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 800));
    await route.continue();
  });
  await page.goto("/home");
  expect(await startedFirstVisit(page)).toEqual(["false", "false"]);
  expect(await sceneHistory(page)).toEqual(["pending", "off"]);
  expect(await seen(page)).toBe("1");
  // 대체로 넘어간 뒤 질문·카드는 지금 등장으로 보인다
  for (const card of ["고양이", "강아지", "기타 동물"]) await expect(page.getByRole("link", { name: card, exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
});

test("움직임 줄이기: 장면·인사 없이 정지 상태로 바로 보이고, 기록은 남는다", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", baseURL });
  const page = await context.newPage();
  consoleWatch.attach(page);
  await recordScene(page);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(500);
  expect(await sceneHistory(page)).toEqual([]);
  expect(await seen(page)).toBe("1");
  const running = await page.evaluate(() => document.getAnimations().length);
  expect(running).toBe(0);
  for (const canvas of await page.locator('[data-slot="character-canvas"]').all()) await expect(canvas).toBeHidden();
  await context.close();
});

for (const at of [100, 500, 1000]) {
  test(`장면 중(${at}ms) 카드를 누르면 바로 이동한다`, async ({ page }) => {
    await recordScene(page);
    await watchList(page);
    await page.goto("/home");
    await page.waitForFunction(() => document.documentElement.getAttribute("data-home-scene") === "play");
    await page.waitForTimeout(at);
    const started = Date.now();
    // 카드가 아직 등장 전(투명)이어도 누를 수 있다
    await page.getByRole("link", { name: "강아지", exact: true }).click({ force: at < 600 });
    await expect(page.getByRole("heading", { name: /강아지 공고/ })).toBeVisible();
    const elapsed = Date.now() - started;
    expect(elapsed, `이동 ${elapsed}ms`).toBeLessThan(3000);
    expect(await sceneNow(page), "CSS 장면은 이동과 함께 끝난다").toBeNull();
  });
}
