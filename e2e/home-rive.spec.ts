import { expect, test, type Page } from "@playwright/test";
import { loadRealItems, mockList, rememberSpeciesCookie, watchConsoleErrors, type ListItem } from "./helpers";

/**
 * 홈 캐릭터 Rive(architecture.md 9절 "홈 캐릭터 Rive"). production 빌드에서 본다(실제 번들 분할·정적 파일 그대로).
 *
 * - 홈: 정지 SVG가 같은 자리의 캔버스로 바뀌고, .riv·WASM은 우리 도메인에서만 받는다(외부 CDN 요청 0)
 * - 움직임 줄이기 설정: 정지 이미지만, Rive 런타임·.riv·WASM을 받지 않는다
 * - 홈이 아닌 화면(목록·상세·찜): Rive 런타임·.riv·WASM을 받지 않는다
 * - 카드를 누르면 바로 이동한다(press 때문에 늦추지 않는다), 교체 전후 레이아웃 이동 0
 * - greet 동안 카드·라벨이 움직이지 않고, greet 중간에 눌러도 바로 이동한다(PRD v1.2 5.1, 7절 "방해 없음")
 */

/** Rive 런타임 번들에만 있는 문자열. 청크 이름은 해시라 내용으로 찾는다 */
const RIVE_RUNTIME_MARKER = "rive_fallback.wasm";

type Seen = { riveAssets: string[]; externalCdn: string[]; runtimeChunks: string[] };

function watchRive(page: Page): Seen {
  const seen: Seen = { riveAssets: [], externalCdn: [], runtimeChunks: [] };
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (/\.(riv|wasm)$/.test(url.pathname)) seen.riveAssets.push(`${url.host}${url.pathname}`);
    if (/unpkg\.com|jsdelivr\.net|rive\.app/.test(url.host)) seen.externalCdn.push(url.href);
  });
  page.on("response", async (response) => {
    if (response.request().resourceType() !== "script") return;
    const body = await response.text().catch(() => "");
    if (body.includes(RIVE_RUNTIME_MARKER)) seen.runtimeChunks.push(new URL(response.url()).pathname);
  });
  return seen;
}

const consoleWatch = watchConsoleErrors();
test.beforeEach(({ page }) => consoleWatch.attach(page));
test.afterEach(() => consoleWatch.assertNone());

const canvasesReady = (page: Page) =>
  page.waitForFunction(() => {
    const canvases = [...document.querySelectorAll<HTMLCanvasElement>('[data-slot="character-canvas"]')];
    return canvases.length === 2 && canvases.every((canvas) => canvas.dataset.ready === "true");
  });

test("홈: 정지 이미지가 같은 자리의 Rive 캔버스로 바뀌고, .riv·WASM은 우리 도메인에서만 받는다", async ({ page, baseURL }) => {
  await page.addInitScript(() => {
    (window as unknown as { __cls: number }).__cls = 0;
    new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
        if (!entry.hadRecentInput) (window as unknown as { __cls: number }).__cls += entry.value;
      }
    }).observe({ type: "layout-shift", buffered: true });
  });
  const seen = watchRive(page);
  await page.goto("/home");
  const wrapper = page.locator('[data-slot="character-image"]').first().locator("..");
  const before = await wrapper.boundingBox();

  await canvasesReady(page);
  const after = await wrapper.boundingBox();
  // 교체 전후 같은 자리, 같은 크기(120×120)
  expect(after).toEqual(before);
  expect(before?.width).toBe(120);
  for (const image of await page.locator('[data-slot="character-image"]').all()) await expect(image).toBeHidden();
  for (const canvas of await page.locator('[data-slot="character-canvas"]').all()) await expect(canvas).toBeVisible();
  expect(await page.evaluate(() => (window as unknown as { __cls: number }).__cls)).toBe(0);

  const host = new URL(baseURL!).host;
  expect(seen.riveAssets.sort()).toEqual([`${host}/characters/nyang-characters.riv`, `${host}/rive/rive-canvas-lite-2.44.0.wasm`]);
  expect(seen.externalCdn).toEqual([]);
  expect(seen.runtimeChunks.length).toBeGreaterThan(0);
});

test("움직임 줄이기 설정이면 정지 이미지만 두고 Rive 런타임·.riv·WASM을 받지 않는다", async ({ browser, baseURL }) => {
  const context = await browser.newContext({ reducedMotion: "reduce", baseURL });
  const page = await context.newPage();
  consoleWatch.attach(page);
  const seen = watchRive(page);
  await page.goto("/home");
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(500);
  for (const image of await page.locator('[data-slot="character-image"]').all()) await expect(image).toBeVisible();
  for (const canvas of await page.locator('[data-slot="character-canvas"]').all()) await expect(canvas).toBeHidden();
  expect(seen).toEqual({ riveAssets: [], externalCdn: [], runtimeChunks: [] });
  await context.close();
});

test.describe("홈이 아닌 화면", () => {
  let items: ListItem[];
  test.beforeAll(async ({ request }) => {
    items = await loadRealItems(request);
  });

  test("목록·상세·찜에서는 Rive 런타임·.riv·WASM을 받지 않는다", async ({ page, context }) => {
    await rememberSpeciesCookie(context);
    await mockList(page, items);
    const seen = watchRive(page);
    await page.goto("/");
    await expect(page.locator("[data-animal-id]").first()).toBeVisible();
    await page.goto(`/animals/${items[0].id}`);
    await expect(page.getByRole("button", { name: "뒤로가기" })).toBeVisible();
    await page.goto("/favorites");
    await expect(page.getByRole("heading", { name: "찜한 공고" })).toBeVisible();
    await page.waitForLoadState("networkidle");
    expect(seen).toEqual({ riveAssets: [], externalCdn: [], runtimeChunks: [] });
  });
});

test("Rive가 붙은 뒤 카드를 누르면 바로 이동한다(press 반응 때문에 이동을 늦추지 않는다)", async ({ page }) => {
  await mockList(page, await loadRealItems(page.request));
  await page.goto("/home");
  await canvasesReady(page);
  const started = Date.now();
  await page.getByRole("link", { name: "고양이", exact: true }).click();
  await expect(page.getByRole("heading", { name: /고양이 공고/ })).toBeVisible();
  const elapsed = Date.now() - started;
  // 개발 PC의 production 서버 기준. 이동이 press 반응(250ms)을 기다리지 않으면 이 안에 끝난다
  expect(elapsed, `이동 ${elapsed}ms`).toBeLessThan(3000);
  await expect(page).toHaveURL(/species=cat/);
});

/** 카드(링크)·캐릭터 칸·라벨(텍스트 노드)의 위치와 크기. 라벨은 텍스트라 Range로 잰다 */
const cardLayout = (page: Page) =>
  page.evaluate(() =>
    ["고양이", "강아지"].map((label) => {
      const link = [...document.querySelectorAll("a")].find((a) => a.textContent?.trim() === label);
      if (!link) throw new Error(`카드 ${label}이 없다`);
      const text = [...link.childNodes].find((node) => node.nodeType === Node.TEXT_NODE && node.textContent?.trim());
      const range = document.createRange();
      if (text) range.selectNodeContents(text);
      const box = (rect: DOMRect) => [rect.x, rect.y, rect.width, rect.height].map((value) => Math.round(value * 10) / 10).join(",");
      return { label, card: box(link.getBoundingClientRect()), character: box(link.querySelector("span")!.getBoundingClientRect()), text: box(range.getBoundingClientRect()) };
    }),
  );

test("greet(들어올 때 동작) 동안 카드·캐릭터 칸·라벨의 위치와 크기가 바뀌지 않는다(PRD v1.2 5.1)", async ({ page }) => {
  await page.goto("/home");
  await canvasesReady(page);
  const first = await cardLayout(page);
  // 두 greet는 2초 안에 끝난다. 100ms마다 2.2초 동안 잰다
  for (let i = 0; i < 22; i++) {
    await page.waitForTimeout(100);
    expect(await cardLayout(page), `${(i + 1) * 100}ms`).toEqual(first);
  }
});

for (const at of [500, 1400]) {
  test(`greet 중간(${at}ms)에 카드를 누르면 바로 목록으로 이동한다`, async ({ page }) => {
    await mockList(page, await loadRealItems(page.request));
    await page.goto("/home");
    await canvasesReady(page);
    await page.waitForTimeout(at);
    const started = Date.now();
    await page.getByRole("link", { name: "강아지", exact: true }).click();
    await expect(page.getByRole("heading", { name: /강아지 공고/ })).toBeVisible();
    const elapsed = Date.now() - started;
    // 위 "바로 이동한다"와 같은 기준(개발 PC의 production 서버). greet가 이동을 늦추지 않는다
    expect(elapsed, `이동 ${elapsed}ms`).toBeLessThan(3000);
    await expect(page).toHaveURL(/species=dog/);
  });
}
