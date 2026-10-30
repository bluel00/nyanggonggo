import { expect, test, type Page } from "@playwright/test";
import { rememberSpeciesCookie, watchConsoleErrors } from "./helpers";

/**
 * 필터 시트의 [적용하기](이슈 #23): 시트는 머리 / 스크롤되는 내용 / 고정된 아래 영역으로 나뉘고 [적용하기]는 아래 영역에 붙어 있다.
 * 아이폰 사파리의 아래 주소창 바는 여기서 재현할 수 없다(EL이 운영 실기기에서 본다).
 */
const LIST_URL = "/?species=cat&region=6110000";
const SHEET = '[data-slot="sheet-content"]';
const BODY = '[data-slot="sheet-body"]';

const consoleWatch = watchConsoleErrors();
test.beforeEach(async ({ page, context }) => {
  consoleWatch.attach(page);
  await rememberSpeciesCookie(context);
});
test.afterEach(() => consoleWatch.assertNone());

async function openSheet(page: Page) {
  await page.goto(LIST_URL);
  await page.getByRole("button", { name: "필터" }).click();
  await expect(page.locator(SHEET)).toBeVisible();
  // 올라오는 움직임(duration-sheet)이 끝난 자리에서 잰다. 끝이 없는 것(아직 받지 않은 사진 칸의 로딩 시머, #111)은 기다리지 않는다
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== "running" || a.effect?.getComputedTiming().endTime === Infinity),
  );
  return page.getByRole("button", { name: "적용하기" });
}

const box = async (page: Page, selector: string) => (await page.locator(selector).boundingBox())!;

test.describe("작은 화면(375×667)", () => {
  test.use({ viewport: { width: 375, height: 667 } });

  test("열자마자 [적용하기]가 스크롤 없이 화면 안에 다 보이고, 내용을 끝까지 내려도 같은 자리다", async ({ page }) => {
    const apply = await openSheet(page);
    await expect(apply).toBeInViewport({ ratio: 1 });
    const before = (await apply.boundingBox())!;
    expect(before.y + before.height).toBeLessThanOrEqual(667);

    // 내용은 시트 높이를 넘쳐 스크롤된다(이 화면 크기에서 확인할 가치가 있는 경우)
    const overflow = await page.locator(BODY).evaluate((el) => el.scrollHeight - el.clientHeight);
    expect(overflow, "작은 화면에서 내용이 넘친다").toBeGreaterThan(0);

    await page.locator(BODY).evaluate((el) => el.scrollTo(0, el.scrollHeight));
    await expect.poll(() => page.locator(BODY).evaluate((el) => Math.ceil(el.scrollTop + el.clientHeight) >= el.scrollHeight)).toBe(true);
    expect(await apply.boundingBox()).toEqual(before);
    await expect(page.getByRole("radio", { name: "공고 마감 빠른순" })).toBeInViewport();

    // 내용은 아래 영역 뒤로 들어가지 않는다(내용 영역이 아래 영역 위에서 끝난다)
    const body = await box(page, BODY);
    expect(body.y + body.height).toBeLessThanOrEqual(before.y);

    await apply.click();
    await expect(page.locator(SHEET)).toBeHidden();
  });
});

for (const viewport of [
  { width: 390, height: 844 },
  { width: 1280, height: 800 },
]) {
  test(`큰 화면(${viewport.width}×${viewport.height})에서도 시트는 컬럼 바닥에 붙고 [적용하기]가 다 보인다`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const apply = await openSheet(page);
    await expect(apply).toBeInViewport({ ratio: 1 });

    const sheet = await box(page, SHEET);
    expect(sheet.y).toBeGreaterThanOrEqual(0);
    expect(Math.round(sheet.y + sheet.height)).toBe(viewport.height);
    expect(sheet.width).toBeLessThanOrEqual(480);
    expect(sheet.height).toBeLessThanOrEqual(viewport.height * 0.85 + 1);
    const body = await box(page, BODY);
    expect(body.y + body.height).toBeLessThanOrEqual((await apply.boundingBox())!.y);
  });
}

test("시트 안 칩(보호 상태, 성별)은 토글 버튼(aria-pressed)으로 남아 있다", async ({ page }) => {
  await openSheet(page);
  for (const group of ["보호 상태", "성별"]) {
    const chips = page.getByRole("group", { name: group }).getByRole("button");
    await expect(chips).not.toHaveCount(0);
    for (const chip of await chips.all()) await expect(chip).toHaveAttribute("aria-pressed", /^(true|false)$/);
  }
  await expect(page.getByRole("group", { name: "보호 상태" }).getByRole("button", { name: "보호중" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
  await expect(page.getByRole("group", { name: "성별" }).getByRole("button", { name: "전체" })).toHaveAttribute(
    "aria-pressed",
    "true",
  );
});

/** 시트와 바탕의 계산된 애니메이션 이름(tw-animate-css: 열림 enter, 닫힘 exit) */
const sheetAnimations = (page: Page) =>
  page.evaluate(() =>
    ['[data-slot="sheet-overlay"]', '[data-slot="sheet-content"]'].map((selector) => {
      const el = document.querySelector(selector);
      return el ? getComputedStyle(el).animationName : null;
    }),
  );

test.describe("움직임 줄이기(#61)", () => {
  test.use({ reducedMotion: "reduce" });

  test("시트는 애니메이션 없이 열리고 닫힌다", async ({ page }) => {
    await page.goto(LIST_URL);
    // 열고 닫는 동안 시작된 애니메이션 이름을 모은다
    await page.evaluate(() => {
      const started: string[] = [];
      (window as unknown as { __started: string[] }).__started = started;
      document.addEventListener("animationstart", (event) => started.push(event.animationName), true);
    });
    const started = () => page.evaluate(() => (window as unknown as { __started: string[] }).__started);

    await page.getByRole("button", { name: "필터" }).click();
    await expect(page.locator(SHEET)).toBeVisible();
    expect(await sheetAnimations(page)).toEqual(["none", "none"]);

    await page.keyboard.press("Escape");
    await expect(page.locator(SHEET)).toHaveCount(0);
    expect(await started()).toEqual([]);
  });
});

test("움직임 줄이기가 아니면 시트는 애니메이션으로 열린다", async ({ page }) => {
  await page.goto(LIST_URL);
  await page.getByRole("button", { name: "필터" }).click();
  await expect(page.locator(SHEET)).toBeVisible();
  expect(await sheetAnimations(page)).toEqual(["enter", "enter"]);
});
