import { expect, test, type Page, type TestInfo } from "@playwright/test";
import { DISTRICTS } from "../src/shared/config/regions";
import { FAVORITES_STORAGE_KEY, SCROLL, watchConsoleErrors } from "./helpers";
import { comboItemId, WAIT_REGION } from "./stub-combo.mjs";

/**
 * 로딩 시머·캐릭터(#111, handoff (j) L1~L5).
 * 목록 첫 페이지는 서버가 읽어 스트리밍으로 온다(#109·#110). 스텁이 1000ms 늦게 답하는 시도(WAIT_REGION)에서는 뼈대(Suspense fallback)가
 * 먼저 보이고, 늦지 않는 시도(경기)에서는 서버 HTML에 카드가 바로 담긴다. 서버 페이지 캐시는 시군구까지 키라서 테스트마다 다른 시군구를 쓴다.
 * 같은 스텁 서버를 Chromium·WebKit 프로젝트가 함께 쓰므로 프로젝트마다 시군구를 나눈다.
 * 시간은 CSS가 정한다: 캐릭터는 animationstart(지연 500ms가 끝나 나타나기 시작한 때)로, 시머는 뼈대의 ::after 애니메이션으로 본다.
 */
const SKELETON = '[data-slot="skeleton-card"]';
const CHARACTER = '[data-slot="loading-character"]';
const CARD = '[data-slot="animal-card"]';
const PHOTO_LOADING = '[data-slot="photo-loading"]';

/** 테스트마다 다른 시군구(서버 캐시를 새로 채운다). WebKit은 뒤쪽 절반 */
const district = (region: string, testInfo: TestInfo, slot: number) => {
  const list = DISTRICTS[region];
  const half = Math.floor(list.length / 2);
  return list[(testInfo.project.name.endsWith("webkit") ? half : 0) + slot].code;
};
const slowList = (testInfo: TestInfo, slot: number, query: string) =>
  `/?${query}&region=${WAIT_REGION}&district=${district(WAIT_REGION, testInfo, slot)}`;
/** 늦지 않는 목록(경기). 사진 테스트 등 */
const FAST_REGION = "6410000";
const fastList = (testInfo: TestInfo, slot: number, species = "cat") =>
  `/?species=${species}&region=${FAST_REGION}&district=${district(FAST_REGION, testInfo, slot)}`;

/**
 * 브라우저 안에서 시각(performance.now)을 기록한다. 늦는 목록도 1000ms 뒤에는 공고가 와서 뼈대가 빠지므로, 캐릭터가 보이는 구간
 * (500ms ~ 공고 도착)이 짧다. 그래서 테스트가 밖에서 폴링하지 않고 페이지 안에서 일어난 때를 잡는다.
 * - skeletonAt, skeleton: 첫 뼈대 카드가 들어온 때와 다음 프레임에 그 안에서 돌던 애니메이션
 * - insertedAt, species: 로딩 캐릭터가 들어온 때와 축종
 * - shownAt: 캐릭터가 나타나기 시작한 때(loading-wait-in의 animationstart, 지연이 끝난 때)
 * - visible: 나타나기를 마쳤을 때(animationend) 캐릭터와 문구가 보였는지
 * - cardsAt: 첫 공고 카드가 문서에 들어온 때(스트리밍은 숨긴 채 먼저 넣고 뒤에 뼈대와 바꾼다)
 * - skeletonGoneAt, characterGoneAt: 뼈대와 캐릭터가 빠진 때
 */
type LoadingRecord = {
  skeletonAt: number | null;
  skeleton: [string, string | null, number, number][];
  insertedAt: number | null;
  species: string | null;
  shownAt: number | null;
  visible: { character: string; text: string } | null;
  cardsAt: number | null;
  skeletonGoneAt: number | null;
  characterGoneAt: number | null;
};
async function recordLoading(page: Page) {
  await page.addInitScript(() => {
    const record: LoadingRecord = {
      skeletonAt: null,
      skeleton: [],
      insertedAt: null,
      species: null,
      shownAt: null,
      visible: null,
      cardsAt: null,
      skeletonGoneAt: null,
      characterGoneAt: null,
    };
    (window as unknown as { __loading: LoadingRecord }).__loading = record;
    const character = () => document.querySelector<HTMLElement>('[data-slot="loading-character"]');
    new MutationObserver(() => {
      const skeleton = document.querySelector('[data-slot="skeleton-card"]');
      if (record.skeletonAt === null && skeleton) {
        record.skeletonAt = performance.now();
        requestAnimationFrame(() => {
          record.skeleton = skeleton.getAnimations({ subtree: true }).map((animation) => {
            const effect = animation.effect as KeyframeEffect;
            const timing = effect.getComputedTiming();
            return [(animation as CSSAnimation).animationName, effect.pseudoElement, Number(timing.duration), Number(timing.delay)];
          });
        });
      }
      const found = character();
      if (record.insertedAt === null && found) {
        record.insertedAt = performance.now();
        record.species = found.dataset.species ?? null;
      }
      if (record.cardsAt === null && document.querySelector('[data-slot="animal-card"]')) record.cardsAt = performance.now();
      if (record.skeletonAt !== null && record.skeletonGoneAt === null && !skeleton) record.skeletonGoneAt = performance.now();
      if (record.insertedAt !== null && record.characterGoneAt === null && !found) record.characterGoneAt = performance.now();
    }).observe(document, { childList: true, subtree: true });
    document.addEventListener(
      "animationstart",
      (event) => {
        if (event.animationName === "loading-wait-in" && record.shownAt === null) record.shownAt = performance.now();
      },
      true,
    );
    document.addEventListener(
      "animationend",
      (event) => {
        if (event.animationName !== "loading-wait-in" || record.visible) return;
        const target = event.target as HTMLElement;
        const text = target.querySelector("p")!;
        record.visible = { character: getComputedStyle(target).visibility, text: `${getComputedStyle(text).visibility} ${text.textContent}` };
      },
      true,
    );
  });
}
const loadingRecord = (page: Page) => page.evaluate(() => (window as unknown as { __loading: LoadingRecord }).__loading);
/** 첫 공고 카드가 그려질 때까지 기다린 뒤의 기록 */
async function recordUntilCards(page: Page) {
  await expect(page.locator(CARD).first()).toBeVisible({ timeout: 15_000 });
  return loadingRecord(page);
}

/** 요소(와 그 안, ::after 포함)에서 도는 CSS 애니메이션: [이름, 의사 요소, 길이(ms), 지연(ms)] */
async function animations(page: Page, selector: string) {
  return page.locator(selector).first().evaluate((el) =>
    el.getAnimations({ subtree: true }).map((animation) => {
      const effect = animation.effect as KeyframeEffect;
      const timing = effect.getComputedTiming();
      return [(animation as CSSAnimation).animationName, effect.pseudoElement, Number(timing.duration), Number(timing.delay)] as const;
    }),
  );
}
const names = (list: readonly (readonly [string, ...unknown[]])[]) => list.map(([name]) => name);

const consoleWatch = watchConsoleErrors();
test.beforeEach(({ page }) => consoleWatch.attach(page));
test.afterEach(() => consoleWatch.assertNone());

test.describe("목록 첫 페이지", () => {
  test("뼈대에 첫 프레임부터 시머(1400ms), 500ms 안에 오지 않으면 고양이 캐릭터와 문구가 200ms로 나타나고 공고가 오면 사라진다", async ({ page }, testInfo) => {
    await recordLoading(page);
    await page.goto(slowList(testInfo, 0, "species=cat"), { waitUntil: "commit" });
    const record = await recordUntilCards(page);

    // L1: 사진 칸과 막대 셋에 시머(::after, 1400ms). 뼈대가 들어온 다음 프레임에 이미 돈다
    const shimmers = record.skeleton.filter(([name]) => name === "shimmer");
    expect(shimmers).toEqual(Array(4).fill(["shimmer", "::after", 1400, 0]));
    // L2: 첫 장 사진 칸에 고양이. 500ms 지연 뒤 200ms 페이드, 숨쉬기·깜빡임·꼬리
    expect(record.skeleton.find(([name]) => name === "loading-wait-in")?.slice(2)).toEqual([200, 500]);
    expect(names(record.skeleton)).toEqual(expect.arrayContaining(["loading-breathe", "loading-blink", "loading-tail"]));
    expect(record.species).toBe("cat");
    expect(record.shownAt! - record.insertedAt!, "약 500ms 뒤에 나타난다").toBeGreaterThanOrEqual(450);
    expect(record.shownAt! - record.insertedAt!).toBeLessThan(900);
    expect(record.visible).toEqual({ character: "visible", text: "visible 공고를 불러오고 있어요" });
    expect(record.shownAt!).toBeLessThan(record.skeletonGoneAt!);
    // 공고가 오면 뼈대와 함께(같은 변경에서) 바로 사라진다(붙잡아 두지 않음)
    expect(record.characterGoneAt).not.toBeNull();
    expect(record.characterGoneAt).toBe(record.skeletonGoneAt);
    await expect(page.locator(CHARACTER)).toHaveCount(0);
    await expect(page.locator(SKELETON)).toHaveCount(0);
  });

  test("뼈대 첫 장에만 캐릭터가 있다", async ({ page }, testInfo) => {
    await page.goto(slowList(testInfo, 5, "species=cat"), { waitUntil: "commit" });
    await expect(page.locator(SKELETON).first()).toBeAttached();
    const hasCharacter = await page
      .locator(SKELETON)
      .evaluateAll((cards) => cards.map((card) => card.querySelector('[data-slot="loading-character"]') !== null));
    expect(hasCharacter).toEqual([true, false, false]);
  });

  test("강아지 목록은 강아지 캐릭터", async ({ page }, testInfo) => {
    await recordLoading(page);
    await page.goto(slowList(testInfo, 1, "species=dog&status=all"), { waitUntil: "commit" });
    const record = await recordUntilCards(page);
    expect(record.species).toBe("dog");
    expect(record.visible?.character).toBe("visible");
  });

  test("늦지 않으면(지연 0ms) 캐릭터가 나타나지 않는다", async ({ page }, testInfo) => {
    await recordLoading(page);
    await page.goto(fastList(testInfo, 0));
    await recordUntilCards(page);
    await page.waitForTimeout(800);
    expect((await loadingRecord(page)).shownAt).toBeNull();
    await expect(page.locator(CHARACTER)).toHaveCount(0);
  });

  for (const [name, slot, query] of [
    ["기타 동물 목록", 2, "species=other"],
    ["종료 필터 목록", 3, "species=cat&status=ended"],
  ] as const) {
    test(`${name}: 뼈대에 시머만 있고 캐릭터가 없다`, async ({ page }, testInfo) => {
      await recordLoading(page);
      await page.goto(slowList(testInfo, slot, query), { waitUntil: "commit" });
      const record = await recordUntilCards(page);
      await expect(page.locator(SKELETON)).toHaveCount(0);
      expect((await loadingRecord(page)).skeletonGoneAt! - record.skeletonAt!, "뼈대가 500ms 넘게 보였다").toBeGreaterThan(500);
      expect(names(record.skeleton)).toEqual(Array(4).fill("shimmer"));
      expect(record.insertedAt).toBeNull();
      expect(record.shownAt).toBeNull();
    });
  }

  test("움직임 줄이기: 시머 없이 평평한 바탕, 캐릭터는 500ms에 페이드 없이 정지 그림", async ({ page }, testInfo) => {
    await page.emulateMedia({ reducedMotion: "reduce" });
    await recordLoading(page);
    await page.goto(slowList(testInfo, 4, "species=cat"), { waitUntil: "commit" });
    const photo = page.locator(SKELETON).first().locator('[data-slot="skeleton-photo"]');
    await expect(photo).toBeAttached();
    const style = await photo.evaluate((el) => [getComputedStyle(el, "::after").content, getComputedStyle(el).backgroundColor]);
    const record = await recordUntilCards(page);

    expect(style).toEqual(["none", "rgb(239, 239, 239)"]);
    // 캐릭터의 나타나기만 있다(길이 0 = 페이드 없음). 시머·숨쉬기·깜빡임·꼬리는 없다
    expect(record.skeleton).toEqual([["loading-wait-in", null, 0, 500]]);
    expect(record.shownAt! - record.insertedAt!).toBeGreaterThanOrEqual(450);
    expect(record.visible?.character).toBe("visible");
  });

  test("다음 페이지 뼈대는 시머만이다", async ({ page }, testInfo) => {
    await page.route(
      (url) => url.pathname === "/api/animals" && url.searchParams.has("cursor"),
      async (route) => {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        await route.continue();
      },
    );
    await page.goto(fastList(testInfo, 1));
    await expect(page.locator(CARD).first()).toBeVisible();
    await expect
      .poll(async () => {
        await page.evaluate((selector) => {
          const container = document.querySelector<HTMLElement>(selector);
          if (container) container.scrollTop = container.scrollHeight;
        }, SCROLL);
        return page.locator(SKELETON).count();
      })
      .toBe(1);
    expect(names(await animations(page, SKELETON))).toEqual(["shimmer", "shimmer", "shimmer", "shimmer"]);
    await page.waitForTimeout(700);
    await expect(page.locator(CHARACTER)).toHaveCount(0);
  });
});

test("관심 목록 뼈대: 시머만이고 캐릭터가 없다", async ({ page }, testInfo) => {
  const id = comboItemId("cat", FAST_REGION, district(FAST_REGION, testInfo, 2), 0);
  await page.addInitScript(([key, ids]) => window.localStorage.setItem(key, JSON.stringify(ids)), [FAVORITES_STORAGE_KEY, [id]] as const);
  await page.route("**/api/animals/by-ids**", async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    await route.continue();
  });
  await page.goto("/favorites");
  await expect(page.locator(SKELETON).first()).toBeVisible();
  expect(names(await animations(page, SKELETON))).toContain("shimmer");
  await page.waitForTimeout(700);
  await expect(page.locator(CHARACTER)).toHaveCount(0);
  await expect(page.locator(`[data-animal-id="${id}"]`)).toBeVisible();
});

test("상세 뼈대: 모든 블록·줄에 시머, 캐릭터 없음", async ({ page }) => {
  // 스텁이 이 공고의 조회를 8초 늦춘다(e2e/upstream-stub.mjs SLOW_ID)
  await page.goto("/animals/990000202609999", { waitUntil: "commit" });
  const skeleton = page.locator('[data-slot="detail-skeleton"]');
  await expect(skeleton).toBeVisible();
  const list = await animations(page, '[data-slot="detail-skeleton"]');
  expect(names(list)).toEqual(Array(9).fill("shimmer"));
  await page.waitForTimeout(700);
  await expect(page.locator(CHARACTER)).toHaveCount(0);
});

test.describe("사진 로딩 시머(L4)", () => {
  test("카드 사진 칸마다 로드될 때까지 시머, 따로 멈춘다", async ({ page }, testInfo) => {
    // 둘째 카드(조합 2번, 첫 사진 600x450)만 늦게 준다. 첫 카드(400x400)는 바로 온다(e2e/stub-combo.mjs)
    await page.route("**/api/image-proxy**", async (route) => {
      if (decodeURIComponent(route.request().url()).includes("600x450")) await new Promise((resolve) => setTimeout(resolve, 2500));
      await route.continue();
    });
    await page.goto(fastList(testInfo, 3), { waitUntil: "commit" });
    const cards = page.locator(CARD);
    await expect(cards.nth(1)).toBeVisible();
    await expect(cards.first().locator(PHOTO_LOADING)).toHaveCount(0);
    await expect(cards.nth(1).locator(PHOTO_LOADING)).toHaveCount(1);
    expect(names(await animations(page, `${CARD} >> nth=1`))).toContain("shimmer");
    await expect(cards.nth(1).locator(PHOTO_LOADING)).toHaveCount(0, { timeout: 10_000 });
  });

  test("캐시에서 이미 로드된 사진(하이드레이션 전에 load가 끝남)에는 시머가 남지 않는다", async ({ page }, testInfo) => {
    await page.goto(fastList(testInfo, 4));
    await expect(page.locator(`${CARD} img`).nth(1)).toHaveJSProperty("complete", true);
    await page.reload();
    await page.waitForLoadState("networkidle");
    const loaded = await page.evaluate(
      ({ card, layer }) =>
        [...document.querySelectorAll(`${card} img`)]
          .filter((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth > 0)
          .map((img) => img.parentElement!.querySelector(layer) !== null),
      { card: CARD, layer: PHOTO_LOADING },
    );
    expect(loaded.length).toBeGreaterThanOrEqual(2);
    expect(loaded.every((stuck) => !stuck)).toBe(true);
  });

  test("상세 사진 칸도 로드될 때까지 시머", async ({ page }, testInfo) => {
    const id = comboItemId("cat", FAST_REGION, district(FAST_REGION, testInfo, 5), 0);
    await page.route("**/api/image-proxy**", async (route) => {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await page.goto(`/animals/${id}`, { waitUntil: "commit" });
    const carousel = page.locator('[data-slot="image-carousel"]');
    await expect(carousel.locator(PHOTO_LOADING).first()).toBeAttached();
    await expect(carousel.locator(PHOTO_LOADING)).toHaveCount(0, { timeout: 10_000 });
  });

  test("사진이 실패하면 ImageOff이고 시머가 없다", async ({ page }, testInfo) => {
    consoleWatch.expect(/Failed to load resource/);
    await page.route("**/api/image-proxy**", (route) => route.abort());
    await page.goto(fastList(testInfo, 6));
    const first = page.locator(CARD).first();
    await expect(first.locator('[role="img"] svg')).toBeVisible();
    await expect(first.locator(PHOTO_LOADING)).toHaveCount(0);
  });
});

