import { expect, test, type Page } from "@playwright/test";
import { openedDetail } from "./helpers";
import { belowScrollTop, LAYER, LAYER_SCROLL } from "./stack";

/**
 * 카드 → 상세 전환(architecture.md 14.2 4단계, 구조 D1, PRD-v1.5 R5). production 빌드 + 스텁 서버(e2e/upstream-stub.mjs).
 * 상세는 목록 위의 층에 얹힌다(PRD-v1.5). 목록 카드는 빠지지 않으므로 누른 카드에 겹친 출발 사진이 상세 사진 칸과 짝을 이룬다.
 *
 * 전환이 일어났는지는 View Transition 의사 요소의 애니메이션(document.getAnimations()의 pseudoElement)으로 본다. 페이지가 매 프레임
 * 기록한다(watchTransitions). 스텁 목록은 개·세종 120건이고 5개 중 하나(index % 5 === 2)는 첫 사진이 4:3이고 두 장이다.
 */
const LIST_URL = "/?species=dog&region=5690000";
const listItemId = (index: number) => String(990000202601000 + index);
/** 첫 사진 4:3, 두 장인 공고(스텁 index 2) */
const TWO_PHOTOS = listItemId(2);
const PHOTO_GROUP = (id: string) => `::view-transition-group(animal-photo-${id})`;

/**
 * pseudo: 전환 의사 요소 애니메이션(group이면 첫 키프레임의 가로·세로 = 출발 칸 크기), rootOldDisplay: 그때 옛 화면(root)의 display,
 * enter: 보인 진입 효과(data-detail-enter 값 → 요소 수 최대)
 */
type Watch = {
  pseudo: { name: string; duration: number; from?: { width: string; height: string } }[];
  rootOldDisplay: string[];
  enter: Record<string, number>;
};

/** View Transition 의사 요소 애니메이션과, 전환 중 옛 화면(root)의 display를 매 프레임 기록한다 */
async function watchTransitions(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __vt: Watch };
    w.__vt = { pseudo: [], rootOldDisplay: [], enter: {} };
    const seen = new Set<Animation>();
    const tick = () => {
      for (const animation of document.getAnimations()) {
        const effect = animation.effect as KeyframeEffect | null;
        if (!effect?.pseudoElement || seen.has(animation)) continue;
        seen.add(animation);
        const first = effect.getKeyframes()[0] as { width?: string; height?: string } | undefined;
        const from = first?.width && first.height ? { width: first.width, height: first.height } : undefined;
        w.__vt.pseudo.push({ name: effect.pseudoElement, duration: Number(effect.getTiming().duration), from });
        w.__vt.rootOldDisplay.push(getComputedStyle(document.documentElement, "::view-transition-old(root)").display);
      }
      const counts: Record<string, number> = {};
      for (const el of document.querySelectorAll("[data-detail-enter]")) {
        const value = el.getAttribute("data-detail-enter")!;
        counts[value] = (counts[value] ?? 0) + 1;
      }
      for (const [value, n] of Object.entries(counts)) w.__vt.enter[value] = Math.max(w.__vt.enter[value] ?? 0, n);
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}
const transitions = (page: Page) => page.evaluate(() => (window as unknown as { __vt: Watch }).__vt);
/**
 * 실제로 움직인 전환 애니메이션(0ms 넘는 것). React는 전환이 없는 이동에도 0ms짜리 루트 애니메이션을 둘 수 있어(움직임 줄이기 등)
 * "효과 없음"은 길이가 있는 애니메이션이 없다는 것으로 본다
 */
const moved = async (page: Page) => (await transitions(page)).pseudo.filter((p) => p.duration > 0);
const resetTransitions = (page: Page) =>
  page.evaluate(() => {
    const w = window as unknown as { __vt: Watch };
    w.__vt.pseudo = [];
    w.__vt.rootOldDisplay = [];
    w.__vt.enter = {};
  });

const card = (page: Page, id: string) => page.locator(`[data-animal-id="${id}"]`);

/** 목록을 열고 그 카드의 사진이 로드될 때까지 기다린다(사진이 있어야 목록 데이터 상세로 간다) */
async function openListWithPhoto(page: Page, id: string) {
  await page.goto(LIST_URL);
  const img = card(page, id).locator("img");
  await expect(img).toBeVisible();
  await expect.poll(() => img.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0)).toBe(true);
}

test.describe("카드 → 상세 전환", () => {
  test("목록 → 상세: 사진 칸이 300ms로 이어지고, 정보는 100ms 뒤 200ms 페이드, 옛 화면은 비치지 않는다", async ({ page }) => {
    await watchTransitions(page);
    await openListWithPhoto(page, TWO_PHOTOS);
    const cardPhoto = (await card(page, TWO_PHOTOS).locator("img").first().boundingBox())!;
    await card(page, TWO_PHOTOS).locator("a").click();
    await openedDetail(page);

    await expect.poll(async () => (await transitions(page)).pseudo.map((p) => p.name)).toContain(PHOTO_GROUP(TWO_PHOTOS));
    const vt = await transitions(page);
    const group = vt.pseudo.find((p) => p.name === PHOTO_GROUP(TWO_PHOTOS))!;
    expect(group.duration).toBe(300);
    // 출발 칸은 카드 사진 칸(1:1)이다. 누름 효과(scale .98)만큼 작을 수 있다
    const from = { width: parseFloat(group.from!.width), height: parseFloat(group.from!.height) };
    expect(from.width / from.height).toBeCloseTo(1, 2);
    expect(from.width).toBeGreaterThan(cardPhoto.width * 0.97);
    expect(from.width).toBeLessThanOrEqual(cardPhoto.width + 0.5);
    // 루트(옛 목록 화면)는 숨겨 반투명하게 비치지 않는다
    expect(new Set(vt.rootOldDisplay)).toEqual(new Set(["none"]));
    // 정보 영역과 CTA 바가 진입 페이드(100ms 뒤 200ms, globals.css [data-detail-enter="info"])를 가졌다. 끝나면 속성을 뗀다
    expect(vt.enter).toEqual({ info: 2 });
    await expect(page.locator("[data-detail-enter]")).toHaveCount(0);
    // 카드 사진(1:1)과 달리 상세 칸은 첫 사진 비율(4:3)이다
    const box = (await page.locator('[data-slot="image-carousel"] button').first().boundingBox())!;
    expect(box.width / box.height).toBeCloseTo(4 / 3, 1);
  });

  test("뒤로가기(화면 안 버튼·브라우저)에는 전환이 없고, 목록은 떠날 때 위치 그대로다", async ({ page }) => {
    await watchTransitions(page);
    await openListWithPhoto(page, TWO_PHOTOS);
    for (const how of ["화면 안", "브라우저"] as const) {
      await card(page, TWO_PHOTOS).locator("a").click();
      await openedDetail(page);
      // 떠날 때(층 아래) 목록 위치. 누르기 전에는 Playwright가 카드를 화면으로 스크롤할 수 있어 누른 뒤에 읽는다
      const left = await belowScrollTop(page);
      await expect.poll(async () => (await transitions(page)).pseudo.length).toBeGreaterThan(0);
      await page.waitForTimeout(400);
      await resetTransitions(page);
      if (how === "화면 안") await page.locator(LAYER).getByRole("button", { name: "뒤로가기" }).click();
      else await page.goBack();
      await expect(page).toHaveURL(LIST_URL);
      await expect(card(page, TWO_PHOTOS)).toBeVisible();
      expect(await belowScrollTop(page), "목록 위치 그대로").toBe(left);
      // 겹쳤던 출발 사진은 상세가 얹힐 때 빠졌다. 카드의 사진은 원래 한 장이다
      await expect(card(page, TWO_PHOTOS).locator("img")).toHaveCount(1);
      await page.waitForTimeout(400);
      expect(await moved(page), `${how} 뒤로가기`).toEqual([]);
    }
  });

  test("공유 링크 직접 진입: 전환·진입 효과가 없다", async ({ page }) => {
    await watchTransitions(page);
    await page.goto(`/animals/${TWO_PHOTOS}`);
    await openedDetail(page);
    await page.waitForTimeout(400);
    expect(await moved(page)).toEqual([]);
    expect((await transitions(page)).enter).toEqual({});
    await expect(page.locator('[data-slot="detail-preview"]')).toHaveCount(0);
  });

  test("종료 공고 카드: 전환·진입 효과 없이 바로 바뀐다", async ({ page }) => {
    await watchTransitions(page);
    // 목록 응답에서 그 공고만 종료로 바꾼다(스텁 목록은 모두 보호중)
    await page.route(
      (url) => url.pathname === "/api/animals",
      async (route) => {
        const response = await route.fetch();
        const body = (await response.json()) as { items: { id: string; status: string }[] };
        for (const item of body.items) if (item.id === TWO_PHOTOS) item.status = "ended";
        await route.fulfill({ response, json: body });
      },
    );
    await openListWithPhoto(page, TWO_PHOTOS);
    await expect(card(page, TWO_PHOTOS)).toHaveAttribute("data-status", "ended");
    await card(page, TWO_PHOTOS).locator("a").click();
    await openedDetail(page);
    await page.waitForTimeout(400);
    expect(await moved(page)).toEqual([]);
    expect((await transitions(page)).enter).toEqual({});
  });

  test.describe("움직임 줄이기", () => {
    test.use({ reducedMotion: "reduce" });
    test("전환·진입 효과가 없다", async ({ page }) => {
      await watchTransitions(page);
      await openListWithPhoto(page, TWO_PHOTOS);
      await card(page, TWO_PHOTOS).locator("a").click();
      await openedDetail(page);
      await page.waitForTimeout(400);
      expect(await moved(page)).toEqual([]);
      expect((await transitions(page)).enter).toEqual({});
    });
  });

  test("전환을 지원하지 않는 브라우저: 바탕은 바로, 사진 칸과 정보만 200ms 페이드", async ({ page }) => {
    await page.addInitScript(() => {
      delete (Document.prototype as Partial<Document>).startViewTransition;
    });
    await watchTransitions(page);
    await openListWithPhoto(page, TWO_PHOTOS);
    await card(page, TWO_PHOTOS).locator("a").click();
    await openedDetail(page);
    // 사진 칸(track), 정보 영역, CTA 바가 200ms 페이드(globals.css [data-detail-enter="fade"])를 가졌다
    await expect.poll(async () => (await transitions(page)).enter).toEqual({ fade: 3 });
    expect(await moved(page)).toEqual([]);
  });
});

test("목록 데이터 화면 → 서버 데이터 화면: 사진이 비지 않고, 넘긴 장·스크롤이 그대로고, 레이아웃이 움직이지 않는다", async ({ page }) => {
  // 상세로 가는 실제 이동 요청(prefetch 아님)을 붙잡아 목록 데이터 화면을 유지한다
  let release!: () => void;
  const released = new Promise<void>((resolve) => (release = resolve));
  await page.route(
    (url) => url.pathname === `/animals/${TWO_PHOTOS}` && url.searchParams.has("_rsc"),
    async (route) => {
      if (route.request().headers()["next-router-prefetch"]) return route.continue();
      await released;
      await route.continue();
    },
  );
  // 매 프레임: 보이는 장의 사진이 그려질 수 있는지(없거나 미완료면 빈 프레임), 레이아웃 이동
  await page.addInitScript(() => {
    const w = window as unknown as { __frames: { blank: number; total: number }; __cls: number };
    w.__frames = { blank: 0, total: 0 };
    w.__cls = 0;
    new PerformanceObserver((list) => {
      for (const e of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) if (!e.hadRecentInput) w.__cls += e.value;
    }).observe({ type: "layout-shift", buffered: true });
    const tick = () => {
      const track = document.querySelector<HTMLElement>('[data-slot="image-carousel"]');
      if (track && track.clientWidth > 0) {
        const index = Math.round(track.scrollLeft / track.clientWidth);
        const img = track.querySelectorAll("img")[index] as HTMLImageElement | undefined;
        w.__frames.total += 1;
        if (!img || !img.complete || img.naturalWidth === 0) w.__frames.blank += 1;
      }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  await openListWithPhoto(page, TWO_PHOTOS);
  // 카드가 화면에 들어와 prefetch(로딩 경계)가 끝난 뒤 누른다(실사용에서 카드를 누르기까지 걸리는 시간, detail-loading과 같다).
  // 카드 2는 첫 화면 아래라 화면에 들어와야 prefetch된다
  await card(page, TWO_PHOTOS).scrollIntoViewIfNeeded();
  await page.waitForLoadState("networkidle");
  await card(page, TWO_PHOTOS).locator("a").click();
  const preview = page.locator('[data-slot="detail-preview"]');
  await expect(preview.locator('[data-slot="animal-detail"]')).toBeVisible();

  // 두 번째 장으로 넘기고(뷰어를 열지 않게 스크롤로) 내부 스크롤을 조금 내린다
  const track = page.locator('[data-slot="image-carousel"]');
  // 전환(300ms)과 진입 페이드가 끝난 뒤 넘긴다
  await page.waitForTimeout(500);
  await track.evaluate((el) => el.scrollTo({ left: el.clientWidth }));
  await expect(page.locator('[data-slot="carousel-dots"] span[data-current="true"]')).toHaveCount(1);
  await expect.poll(() => page.locator('[data-slot="carousel-dots"] span').nth(1).getAttribute("data-current")).toBe("true");
  // 상세는 층 안에서 스크롤된다(PRD-v1.5)
  const scroller = page.locator(LAYER_SCROLL);
  await scroller.evaluate((el) => el.scrollTo({ top: Math.min(40, el.scrollHeight - el.clientHeight) }));
  const scrollBefore = await scroller.evaluate((el) => el.scrollTop);
  // 진입 페이드가 끝난 뒤의 화면
  await page.waitForTimeout(500);
  const before = await page.screenshot();
  const clsBefore = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);

  release();
  await expect(preview).toHaveCount(0);
  await expect(page.locator('[data-slot="animal-detail"]')).toBeVisible();
  await page.waitForTimeout(300);
  const after = await page.screenshot();

  expect(await page.locator('[data-slot="carousel-dots"] span').nth(1).getAttribute("data-current"), "넘긴 장 유지").toBe("true");
  expect(await scroller.evaluate((el) => el.scrollTop), "스크롤 유지").toBe(scrollBefore);
  const { frames, cls } = await page.evaluate(() => {
    const w = window as unknown as { __frames: { blank: number; total: number }; __cls: number };
    return { frames: w.__frames, cls: w.__cls };
  });
  expect(cls - clsBefore, "교체 때 레이아웃 이동 없음").toBe(0);
  expect(frames.blank, `사진이 빈 프레임(전체 ${frames.total}프레임)`).toBe(0);
  expect(after.equals(before), "교체 앞뒤 화면이 같다").toBe(true);
});
