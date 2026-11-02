import { expect, test, type Page } from "@playwright/test";
import { watchConsoleErrors, watchList } from "./helpers";

/**
 * 홈 첫인상 "부르고 답하기"(handoff (k) "언제", "장면의 0초와 Rive", 구현 순서 6단계, #115). production 빌드에서 본다(Rive 정적 파일·번들 그대로).
 *
 * - 홈에 들어올 때마다(첫 방문, 같은 탭에서 다시 옴, 새로고침) CSS 장면이 홈이 처음 그려지는 순간 시작한다. 질문·카드를 숨긴 채 기다리지 않는다
 * - JS가 없어도(번들을 막아도) CSS 장면과 최종 화면이 정상이다
 * - 캐릭터 Rive는 장면 0.92초에 둘 다 준비돼 있으면 withLookUp = true로, 아니면 준비되는 대로 false로 재생한다
 * - 홈 HTML이 Rive wasm·.riv를 미리 받는다(움직임 줄이기 제외). 한 번씩만 받는 것은 home-rive.spec.ts가 본다
 * - 세션 저장소를 쓰지 않는다(예전 기록 nyanggonggo:home-scene-seen은 그대로 둔다)
 * - 움직임 줄이기: 장면·인사 없이 정지 상태. 장면 중 카드를 누르면 바로 이동한다
 */
const consoleWatch = watchConsoleErrors();
test.beforeEach(({ page }) => consoleWatch.attach(page));
test.afterEach(() => consoleWatch.assertNone());

/** 두 캐릭터가 재생을 시작했을 때의 withLookUp(캔버스 data-with-look-up) */
async function startedWithLookUp(page: Page) {
  await page.waitForFunction(() => {
    const canvases = [...document.querySelectorAll<HTMLCanvasElement>('[data-slot="character-canvas"]')];
    return canvases.length === 2 && canvases.every((canvas) => canvas.dataset.ready === "true");
  });
  return page.locator('[data-slot="character-canvas"]').evaluateAll((canvases) => canvases.map((canvas) => (canvas as HTMLElement).dataset.withLookUp));
}

/** 장면 요소들의 CSS 애니메이션 늦춤(ms). 질문 두 줄·보조 문구·카드 셋, 로고 부위 다섯, 기타 동물 셋 */
const sceneDelays = (page: Page) =>
  page.evaluate(() => {
    const delays = (selector: string) =>
      [...document.querySelectorAll(selector)].map((el) => el.getAnimations().map((a) => Math.round(Number((a.effect as KeyframeEffect).getTiming().delay))));
    return {
      intro: delays('[data-scene="question-line"], [data-scene="sub"], [data-enter="home"]:not([data-scene="intro"])'),
      logo: ["dog", "dog-ear", "dog-mouth", "bark-lines", "cat-eyes"].map(
        (part) => document.querySelector(`[data-slot="logo"] [data-part="${part}"]`)?.getAnimations().map((a) => Math.round(Number((a.effect as KeyframeEffect).getTiming().delay))) ?? [],
      ),
      bob: delays('[data-slot="other-characters"] > img'),
    };
  });
const SCENE = {
  intro: [[260], [340], [420], [520], [580], [640]],
  logo: [[120], [140], [150], [180], [300]],
  bob: [[1180], [1250], [1320]],
};

test("들어올 때마다 장면이 돈다(첫 방문 · 같은 탭에서 다시 옴 · 새로고침). 캐시된 Rive가 0.92초 전에 준비되면 withLookUp = true", async ({ page }) => {
  await watchList(page);
  await page.goto("/home");
  expect(await sceneDelays(page)).toEqual(SCENE);
  // 로컬 production은 미리 받기로 첫 방문에도 0.92초 안에 준비된다(실제 망 조건은 따로 잰다)
  expect(await startedWithLookUp(page)).toEqual(["true", "true"]);

  // 목록으로 갔다가 헤더의 홈 진입점으로 돌아온다(축종을 바꾸러 홈에 다시 옴)
  await page.getByRole("link", { name: "고양이", exact: true }).click();
  await expect(page.getByRole("heading", { name: /고양이 공고/ })).toBeVisible();
  await page.getByRole("link", { name: "고양이 공고, 다른 동물 고르기" }).click();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await sceneDelays(page)).toEqual(SCENE);
  expect(await startedWithLookUp(page)).toEqual(["true", "true"]);

  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  expect(await sceneDelays(page)).toEqual(SCENE);
  expect(await startedWithLookUp(page)).toEqual(["true", "true"]);
});

test("CSS 장면은 Rive를 기다리지 않는다: .riv가 늦으면 장면은 그대로 돌고, 캐릭터는 받는 대로 withLookUp = false로 재생한다", async ({ page }) => {
  await page.route("**/characters/nyang-characters.riv", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.goto("/home");
  expect(await sceneDelays(page)).toEqual(SCENE);
  // 장면이 끝나기 전(.riv를 받기 전)에 질문·카드가 다 보인다
  await page.waitForFunction(() =>
    [...document.querySelectorAll('[data-enter="home"]:not([data-scene="intro"])')].every((card) => card.getAnimations()[0]?.playState === "finished"),
  );
  for (const card of ["고양이", "강아지", "기타 동물"]) await expect(page.getByRole("link", { name: card, exact: true })).toBeVisible();
  expect(await page.locator('[data-slot="character-canvas"][data-ready="true"]').count(), "아직 Rive 전: 정면 정지 그림").toBe(0);
  expect(await startedWithLookUp(page)).toEqual(["false", "false"]);
});

test("JS 번들이 오지 않아도 CSS 장면이 돌고 최종 화면이 정상이다(하이드레이션에 기대지 않는다)", async ({ page }) => {
  await page.route(/\/_next\/static\/chunks\/.*\.js$/, (route) => route.abort());
  consoleWatch.expect(/Failed to load resource|ChunkLoadError|net::ERR_FAILED/);
  await page.goto("/home");
  expect(await sceneDelays(page)).toEqual(SCENE);
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState === "finished"));
  await expect(page.getByRole("heading", { name: "오늘은 누구를 보러 왔어요?" })).toBeVisible();
  for (const card of ["고양이", "강아지", "기타 동물"]) await expect(page.getByRole("link", { name: card, exact: true })).toBeVisible();
  const opacity = await page.locator('[data-enter="home"]:not([data-scene="intro"])').evaluateAll((cards) => cards.map((card) => getComputedStyle(card).opacity));
  expect(opacity).toEqual(["1", "1", "1"]);
});

test("홈 HTML이 Rive wasm·.riv를 미리 받는다(움직임 줄이기 제외 media)", async ({ request }) => {
  const html = await (await request.get("/home")).text();
  for (const href of ["/rive/rive-canvas-lite-2.44.0.wasm", "/characters/nyang-characters.riv"]) {
    const link = new RegExp(`<link[^>]*rel="preload"[^>]*href="${href.replace(/[.]/g, "\\.")}"[^>]*>`).exec(html)?.[0];
    expect(link, href).toBeTruthy();
    expect(link).toContain('as="fetch"');
    // crossorigin=""는 anonymous와 같다(앱의 fetch() 기본: cors, 같은 출처 자격)
    expect(link).toMatch(/crossorigin="(anonymous)?"/);
    expect(link).toContain('media="(prefers-reduced-motion: no-preference)"');
  }
});

test("세션 저장소를 쓰지 않는다: 예전 기록(nyanggonggo:home-scene-seen)이 있어도 장면·올려다보기가 같고, 기록은 그대로다", async ({ page }) => {
  await page.addInitScript(() => {
    if (!sessionStorage.getItem("nyanggonggo:home-scene-seen")) sessionStorage.setItem("nyanggonggo:home-scene-seen", "1");
  });
  await page.goto("/home");
  expect(await sceneDelays(page)).toEqual(SCENE);
  expect(await startedWithLookUp(page)).toEqual(["true", "true"]);
  const stored = await page.evaluate(() => ({ seen: sessionStorage.getItem("nyanggonggo:home-scene-seen"), keys: Object.keys(sessionStorage) }));
  expect(stored).toEqual({ seen: "1", keys: ["nyanggonggo:home-scene-seen"] });
  expect(await page.evaluate(() => document.documentElement.hasAttribute("data-home-scene"))).toBe(false);
});

test("움직임 줄이기: 장면·인사 없이 정지 상태로 바로 보인다", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", baseURL });
  const page = await context.newPage();
  consoleWatch.attach(page);
  await page.goto("/home");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await page.waitForTimeout(1200);
  expect(await page.evaluate(() => document.getAnimations().length)).toBe(0);
  for (const canvas of await page.locator('[data-slot="character-canvas"]').all()) await expect(canvas).toBeHidden();
  for (const card of ["고양이", "강아지", "기타 동물"]) await expect(page.getByRole("link", { name: card, exact: true })).toBeVisible();
  await context.close();
});

for (const at of [100, 500, 1000]) {
  test(`장면 중(${at}ms) 카드를 누르면 바로 이동한다`, async ({ page }) => {
    await watchList(page);
    await page.goto("/home");
    await page.waitForTimeout(at);
    const started = Date.now();
    // 카드가 아직 떠오르기 전(투명)이어도 누를 수 있다
    await page.getByRole("link", { name: "강아지", exact: true }).click({ force: at < 600 });
    await expect(page.getByRole("heading", { name: /강아지 공고/ })).toBeVisible();
    const elapsed = Date.now() - started;
    expect(elapsed, `이동 ${elapsed}ms`).toBeLessThan(3000);
  });
}
