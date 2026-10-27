import { expect, test, type Locator, type Page } from "@playwright/test";
import { openedDetail, watchConsoleErrors } from "./helpers";
import { BELOW_SCROLL, belowScrollTop, LAYER, rememberCards, sameCards } from "./stack";

/**
 * 보호소 정보 시트(이슈 #62, 처음은 #3의 주소·전화 줄). 상세(서버 렌더)는 스텁(e2e/upstream-stub.mjs)의 고정 공고이고 연락처는 지어낸 값이다.
 * 정보 줄에는 주소·전화가 없고 보호소 줄 끝의 [보호소 정보]가 시트를 연다. 시트는 기존 Sheet(모달 바텀시트)라 배경 탭·Esc로 닫히고 방문 기록에
 * 넣지 않는다. 얹은 상세(목록 위 층)에서도 같고, 시트를 연 채 뒤로 가면 상세와 시트가 함께 닫힌다. production 스텁, Chromium·WebKit.
 */
/** e2e/upstream-stub.mjs의 CARE와 같다 */
const CARE = { careAddr: "E2E시 가상구 테스트로 1 (예시동)", careTel: "000-0000-0000", careOwnerNm: "E2E 담당자" };
/** 고양이·서울 보호중 공고(SEOUL_CAT_ITEMS 0번째)와 종료 공고(ENDED_CASES) */
const PROTECTED_ID = "990000202602000";
const ENDED_ID = "990000202600011";
/** 개·세종 고정 목록과 그 안의 카드(e2e/stack-nav.spec.ts와 같다) */
const LIST_URL = "/?species=dog&region=5690000";
const LIST_CARD = "990000202601007";

const consoleWatch = watchConsoleErrors();
test.beforeEach(({ page }) => consoleWatch.attach(page));
test.afterEach(() => consoleWatch.assertNone());

const SHEET = '[data-slot="shelter-info-sheet"]';
const terms = (scope: Locator) => scope.locator("dt").allTextContents();
const historyLength = (page: Page) => page.evaluate(() => window.history.length);

async function openDirect(page: Page, id: string) {
  await page.goto(`/animals/${id}`);
  await openedDetail(page);
  return page.locator('[data-slot="animal-detail"]');
}

async function openLayered(page: Page) {
  await page.goto(LIST_URL);
  await expect(page.locator("[data-animal-id]").first()).toBeVisible();
  await page.locator(`[data-animal-id="${LIST_CARD}"] a`).click();
  await expect(page).toHaveURL(new RegExp(`/animals/${LIST_CARD}$`));
  const layer = page.locator(LAYER);
  await expect(layer.locator('[data-slot="animal-detail"]')).toBeVisible();
  return layer;
}

/** [보호소 정보]를 눌러 시트를 연다. 방문 기록이 늘지 않는지도 본다 */
async function openSheet(page: Page, scope: Locator) {
  const before = await historyLength(page);
  const url = page.url();
  await scope.getByRole("button", { name: "보호소 정보 보기" }).click();
  const sheet = page.locator(SHEET);
  await expect(sheet).toBeVisible();
  expect(await historyLength(page), "시트를 열어도 방문 기록이 늘지 않는다").toBe(before);
  expect(page.url()).toBe(url);
  return sheet;
}

/** 시트 바깥(배경)을 누른다. 시트는 컬럼 아래쪽에 붙으므로 위쪽을 누른다 */
async function tapOutside(page: Page) {
  const column = (await page.locator('[data-slot="app-column"]').boundingBox())!;
  await page.mouse.click(column.x + column.width / 2, column.y + 40);
}

test("직접 연 상세: 정보 줄에 주소·전화가 없고, [보호소 정보] 시트에 주소 + [지도], 전화 + [전화]", async ({ page }) => {
  const detail = await openDirect(page, PROTECTED_ID);
  expect(await terms(detail)).toEqual(["발견 장소", "보호소", "공고 번호", "공고 기간", "특이사항"]);
  await expect(detail).not.toContainText(CARE.careAddr);
  await expect(detail).not.toContainText(CARE.careTel);

  // 누르는 영역 44×44px 이상
  const button = detail.getByRole("button", { name: "보호소 정보 보기" });
  const box = (await button.boundingBox())!;
  expect(box.width).toBeGreaterThanOrEqual(44);
  expect(box.height).toBeGreaterThanOrEqual(44);

  const sheet = await openSheet(page, detail);
  await expect(sheet.getByRole("heading", { name: "E2E 보호소" })).toBeVisible();
  expect(await terms(sheet)).toEqual(["주소", "전화"]);
  await expect(sheet.getByText(CARE.careAddr, { exact: true })).toBeVisible();
  await expect(sheet.getByText(CARE.careTel, { exact: true })).toBeVisible();
  await expect(sheet).not.toContainText(CARE.careOwnerNm);

  // 링크 모양: 지도는 카카오맵 검색(새 탭), 전화는 tel: 숫자만
  const map = sheet.getByRole("link", { name: "지도에서 주소 보기(새 탭)" });
  await expect(map).toHaveAttribute("href", `https://map.kakao.com/link/search/${encodeURIComponent(CARE.careAddr)}`);
  await expect(map).toHaveAttribute("target", "_blank");
  await expect(sheet.getByRole("link", { name: "보호소에 전화" })).toHaveAttribute("href", "tel:00000000000");
  for (const link of await sheet.locator('[data-slot="contact-link"]').all()) {
    const linkBox = (await link.boundingBox())!;
    expect(linkBox.width).toBeGreaterThanOrEqual(44);
    expect(linkBox.height).toBeGreaterThanOrEqual(44);
  }
});

test("직접 연 상세: 시트는 Esc와 바깥 탭으로 닫히고 상세는 그대로다. 닫으면 초점이 버튼으로 돌아온다", async ({ page }) => {
  const detail = await openDirect(page, PROTECTED_ID);
  const url = page.url();

  await openSheet(page, detail);
  await page.keyboard.press("Escape");
  await expect(page.locator(SHEET)).toHaveCount(0);
  await expect(detail).toBeVisible();
  expect(page.url()).toBe(url);
  await expect(detail.getByRole("button", { name: "보호소 정보 보기" })).toBeFocused();

  await openSheet(page, detail);
  await tapOutside(page);
  await expect(page.locator(SHEET)).toHaveCount(0);
  await expect(detail).toBeVisible();
  expect(page.url()).toBe(url);
});

test("얹은 상세: 시트가 층 위에 열리고, Esc는 시트만 닫고 바깥 탭도 시트만 닫는다", async ({ page }) => {
  const layer = await openLayered(page);
  const url = page.url();

  await openSheet(page, layer);
  await page.keyboard.press("Escape");
  await expect(page.locator(SHEET)).toHaveCount(0);
  await expect(layer).toBeVisible();
  expect(page.url(), "Esc가 상세 층까지 닫지 않는다").toBe(url);

  await openSheet(page, layer);
  await tapOutside(page);
  await expect(page.locator(SHEET)).toHaveCount(0);
  await expect(layer).toBeVisible();
  expect(page.url()).toBe(url);

  // 시트를 닫은 뒤 Esc는 다시 상세 층을 닫는다(층의 Esc가 막히지 않았다)
  await page.keyboard.press("Escape");
  await expect(page.locator(LAYER)).toHaveCount(0);
});

test("얹은 상세: 시트를 연 채 뒤로 가면 상세와 시트가 함께 닫히고 목록은 같은 요소·같은 위치에서 바로 스크롤된다", async ({ page }) => {
  await page.goto(LIST_URL);
  await expect(page.locator("[data-animal-id]").first()).toBeVisible();
  await page.evaluate(([selector, id]) => {
    const scroll = document.querySelector<HTMLElement>(selector)!;
    const card = document.querySelector<HTMLElement>(`[data-animal-id="${id}"]`)!;
    scroll.scrollTop += card.getBoundingClientRect().top - scroll.getBoundingClientRect().top - 80;
  }, [BELOW_SCROLL, LIST_CARD] as const);
  const left = await belowScrollTop(page);
  await rememberCards(page);
  await page.locator(`[data-animal-id="${LIST_CARD}"] a`).click();
  const layer = page.locator(LAYER);
  await expect(layer.locator('[data-slot="animal-detail"]')).toBeVisible();

  await openSheet(page, layer);
  await page.goBack();

  await expect(page).toHaveURL(LIST_URL);
  await expect(page.locator(LAYER)).toHaveCount(0);
  await expect(page.locator(SHEET)).toHaveCount(0);
  expect(await sameCards(page), "목록 카드가 다시 만들어지지 않았다").toBe(true);
  expect(await belowScrollTop(page)).toBe(left);
  // 시트·층이 건 잠금이 남지 않는다: 아래 화면 inert 없음, 화면 읽기 숨김 없음, 바탕 누름 막힘 없음, 스크롤됨
  const below = page.locator(BELOW_SCROLL);
  expect(await below.evaluate((el) => (el as HTMLElement).inert)).toBe(false);
  expect(await below.getAttribute("aria-hidden")).toBeNull();
  expect(await page.evaluate(() => getComputedStyle(document.body).pointerEvents)).not.toBe("none");
  // 목록 가운데를 누르면 목록이 받는다(덮는 층·시트·배경이 남지 않았다). 모바일 WebKit은 마우스 휠이 없어 스크롤은 스크립트로 확인한다
  const hit = await page.evaluate((selector) => {
    const scroll = document.querySelector<HTMLElement>(selector)!;
    const box = scroll.getBoundingClientRect();
    const target = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
    return target !== null && scroll.contains(target);
  }, BELOW_SCROLL);
  expect(hit, "목록 위를 덮는 것이 없다").toBe(true);
  await below.evaluate((el) => el.scrollBy(0, 300));
  await expect.poll(() => belowScrollTop(page)).toBeGreaterThan(left);
});

test("종료 상세: [보호소 정보]가 없고 보호소 이름 줄은 있다", async ({ page }) => {
  const detail = await openDirect(page, ENDED_ID);
  expect(await terms(detail)).toEqual(["발견 장소", "보호소", "공고 번호", "공고 기간", "종료 사유", "특이사항"]);
  await expect(detail.getByText("E2E 보호소", { exact: true })).toBeVisible();
  await expect(detail.getByRole("button", { name: "보호소 정보 보기" })).toHaveCount(0);
  await expect(detail).not.toContainText(CARE.careAddr);
  await expect(detail).not.toContainText(CARE.careTel);
});
