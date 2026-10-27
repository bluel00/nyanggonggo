import { expect, test, type Locator, type Page } from "@playwright/test";
import { watchConsoleErrors } from "./helpers";

/**
 * 홈 기타 동물 카드(#86, handoff (g) "홈 기타 동물 선택지"). 누르거나 키보드로 기타 동물 목록으로 가고,
 * 누름 반응은 카드 .98 + shadow-card-pressed, 캐릭터 셋 납작이다. 움직임 줄이기면 반응 없이 바로 간다.
 */
const OTHER_LIST = /\/\?species=other(&|$)/;

const consoleWatch = watchConsoleErrors();
test.beforeEach(({ page }) => consoleWatch.attach(page));
test.afterEach(() => consoleWatch.assertNone());

const otherCard = (page: Page) => page.getByRole("link", { name: "기타 동물", exact: true });

/** 카드와 캐릭터 셋의 계산된 누름 값 */
const pressStyle = (card: Locator) =>
  card.evaluate((element) => ({
    scale: getComputedStyle(element).scale,
    shadow: getComputedStyle(element).boxShadow,
    characters: [...element.querySelectorAll("img")].map((img) => getComputedStyle(img).scale),
  }));

/** 등장(enter-rise)이 끝날 때까지 기다린다. 끝나기 전 값은 누름 값과 섞인다 */
async function waitEntered(page: Page) {
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== "running"));
}

async function holdOn(page: Page, card: Locator) {
  const box = (await card.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
}

test("기타 동물 카드를 누르면 기타 동물 목록으로 간다", async ({ page }) => {
  await page.goto("/home");
  await otherCard(page).click();
  await expect(page).toHaveURL(OTHER_LIST);
  await expect(page.getByRole("heading", { name: "기타 동물 공고" })).toBeVisible();
});

test("키보드(Tab, Enter)로도 기타 동물 목록으로 간다", async ({ page, browserName }) => {
  await page.goto("/home");
  await expect(otherCard(page)).toBeVisible();
  if (browserName === "webkit") {
    // 아이폰 에뮬레이션(WebKit)에서는 Tab·Option+Tab이 초점을 옮기지 않는다(초점이 body에 머문다). 초점은 스크립트로 주고 Enter만 본다
    await otherCard(page).focus();
  } else {
    for (let i = 0; i < 10 && !(await otherCard(page).evaluate((element) => element === document.activeElement)); i++) {
      await page.keyboard.press("Tab");
    }
  }
  await expect(otherCard(page)).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(OTHER_LIST);
});

test("누르는 동안 카드는 .98 + shadow-card-pressed, 캐릭터 셋은 납작(1.03 × 0.96)이고, 떼면 바로 간다", async ({ page }) => {
  await page.goto("/home");
  const card = otherCard(page);
  await expect(card).toBeVisible();
  await waitEntered(page);
  const rest = await pressStyle(card);
  expect(rest.scale).toBe("none");
  expect(rest.characters).toEqual(["none", "none", "none"]);

  await holdOn(page, card);
  // 100ms 전환이 끝난 값
  await expect.poll(() => pressStyle(card)).toMatchObject({ scale: "0.98", characters: ["1.03 0.96", "1.03 0.96", "1.03 0.96"] });
  expect((await pressStyle(card)).shadow).not.toBe(rest.shadow);
  await page.mouse.up();
  await expect(page).toHaveURL(OTHER_LIST);
});

test("고양이·강아지 큰 카드도 누르는 동안 .98 + shadow-card-pressed다(#53 C1)", async ({ page }) => {
  await page.goto("/home");
  await waitEntered(page);
  for (const name of ["고양이", "강아지"]) {
    const card = page.getByRole("link", { name, exact: true });
    const rest = await pressStyle(card);
    await holdOn(page, card);
    await expect.poll(() => pressStyle(card).then((style) => style.scale)).toBe("0.98");
    expect((await pressStyle(card)).shadow, name).not.toBe(rest.shadow);
    // 손을 떼면 이동하므로, 떼기 전에 카드 밖으로 옮겨 누름만 푼다
    await page.mouse.move(0, 0);
    await page.mouse.up();
    await expect.poll(() => pressStyle(card)).toMatchObject({ scale: "none", shadow: rest.shadow });
  }
});

test.describe("움직임 줄이기", () => {
  test.use({ reducedMotion: "reduce" });

  test("등장·누름 반응 없이 바로 기타 동물 목록으로 간다", async ({ page }) => {
    await page.goto("/home");
    const card = otherCard(page);
    await expect(card).toBeVisible();
    expect(await card.evaluate((element) => element.getAnimations().length)).toBe(0);
    const rest = await pressStyle(card);

    await holdOn(page, card);
    expect(await pressStyle(card)).toEqual(rest);
    await page.mouse.up();
    await expect(page).toHaveURL(OTHER_LIST);
  });

  test("고양이·강아지 큰 카드도 누름 반응(크기·그림자)이 없다", async ({ page }) => {
    await page.goto("/home");
    for (const name of ["고양이", "강아지"]) {
      const card = page.getByRole("link", { name, exact: true });
      await expect(card).toBeVisible();
      const rest = await card.evaluate((element) => [getComputedStyle(element).scale, getComputedStyle(element).boxShadow]);
      await holdOn(page, card);
      expect(await card.evaluate((element) => [getComputedStyle(element).scale, getComputedStyle(element).boxShadow]), name).toEqual(rest);
      await page.mouse.move(0, 0);
      await page.mouse.up();
    }
  });
});
