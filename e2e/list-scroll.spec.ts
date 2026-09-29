import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

/**
 * 목록 → 상세 → 뒤로가기 때 열었던 카드로 돌아오는지 실제 브라우저에서 확인한다.
 * jsdom에는 레이아웃이 없어 스크롤을 검증할 수 없어서 이 흐름은 여기서만 제대로 확인된다.
 *
 * 목록 API 응답은 page.route로 고정한다(항상 같은 순서, 6건씩 여러 페이지).
 * 다만 상세 페이지는 서버 렌더라 브라우저 라우팅으로 가릴 수 없어, 고정 데이터는 실제 목록 API에서 받아 온다.
 */

const LIST_PAGE_SIZE = 6;
const SCROLL = '[data-slot="app-scroll"]';
/** 투명 1x1 PNG(카드 사진 대신. 업스트림 이미지를 받지 않아 테스트가 빨라진다) */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

type ListItem = { id: string };

async function loadRealItems(request: APIRequestContext): Promise<ListItem[]> {
  const response = await request.get("/api/animals?species=cat&region=6110000&status=protected&sort=latest");
  expect(response.ok(), "목록 API가 응답해야 한다(개발 서버와 서비스키 필요)").toBeTruthy();
  const body = (await response.json()) as { items: ListItem[] };
  expect(body.items.length, "고정 데이터로 쓸 공고가 충분해야 한다").toBeGreaterThanOrEqual(12);
  return body.items;
}

/** 목록 API를 고정 데이터로 바꾼다. 커서는 이 목킹 안에서만 쓰는 offset 문자열이다 */
async function mockList(page: Page, items: ListItem[]) {
  await page.route(
    (url) => url.pathname === "/api/animals",
    async (route) => {
      const start = Number(new URL(route.request().url()).searchParams.get("cursor") ?? 0);
      const end = start + LIST_PAGE_SIZE;
      await route.fulfill({
        json: { items: items.slice(start, end), nextCursor: end < items.length ? String(end) : null },
      });
    },
  );
  await page.route(
    (url) => url.pathname === "/api/image-proxy",
    (route) => route.fulfill({ contentType: "image/png", body: PNG_1X1 }),
  );
}

/** 목록의 내부 스크롤 컨테이너를 끝까지 내려 다음 페이지를 부른다 */
async function scrollListToBottom(page: Page) {
  await page.evaluate((selector) => {
    const container = document.querySelector<HTMLElement>(selector);
    if (container) container.scrollTop = container.scrollHeight;
  }, SCROLL);
}

/** 카드가 스크롤 컨테이너의 보이는 영역 안에 있는지 */
async function isCardInView(page: Page, animalId: string) {
  return page.evaluate(
    ({ selector, id }) => {
      const container = document.querySelector<HTMLElement>(selector);
      const card = document.querySelector<HTMLElement>(`[data-animal-id="${id}"]`);
      if (!container || !card) return false;
      const containerBox = container.getBoundingClientRect();
      const cardBox = card.getBoundingClientRect();
      return cardBox.bottom > containerBox.top && cardBox.top < containerBox.bottom;
    },
    { selector: SCROLL, id: animalId },
  );
}

/** 2페이지까지 불러온 뒤 아래쪽 카드를 눌러 상세로 간다. 누른 카드 id를 돌려준다 */
async function openCardOnSecondPage(page: Page) {
  await expect(page.locator("[data-animal-id]")).toHaveCount(LIST_PAGE_SIZE);
  await scrollListToBottom(page);
  await expect(page.locator("[data-animal-id]")).toHaveCount(LIST_PAGE_SIZE * 2);

  const target = page.locator("[data-animal-id]").nth(LIST_PAGE_SIZE + 2); // 2페이지의 카드
  const animalId = (await target.getAttribute("data-animal-id"))!;
  await target.locator("a").click();
  await expect(page).toHaveURL(new RegExp(`/animals/${animalId}$`));
  await expect(page.getByRole("button", { name: "뒤로가기" })).toBeVisible();
  return animalId;
}

let items: ListItem[];
test.beforeAll(async ({ request }) => {
  items = await loadRealItems(request);
});

/** 모든 테스트에서 콘솔 오류(중복 key 등)를 모은다 */
const consoleErrors: string[] = [];
test.beforeEach(async ({ page }) => {
  consoleErrors.length = 0;
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  await mockList(page, items);
});
test.afterEach(() => {
  expect(consoleErrors.filter((text) => text.includes("same key")), "중복 key 오류가 없어야 한다").toEqual([]);
});

test("화면 안 뒤로가기: 목록으로 돌아오면 열었던 카드가 보인다", async ({ page }) => {
  await page.goto("/");
  const animalId = await openCardOnSecondPage(page);

  await page.getByRole("button", { name: "뒤로가기" }).click();
  await expect(page).toHaveURL("/");
  await expect(page.locator(`[data-animal-id="${animalId}"]`)).toBeVisible();
  expect(await isCardInView(page, animalId)).toBe(true);
});

test("브라우저 뒤로가기: 목록으로 돌아오면 열었던 카드가 보인다", async ({ page }) => {
  await page.goto("/");
  const animalId = await openCardOnSecondPage(page);

  await page.goBack();
  await expect(page).toHaveURL("/");
  await expect(page.locator(`[data-animal-id="${animalId}"]`)).toBeVisible();
  expect(await isCardInView(page, animalId)).toBe(true);
});

test("기본값이 아닌 필터에서도 열었던 카드가 보인다", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "필터" }).click();
  await page.getByRole("radio", { name: "종료임박순" }).click();
  await page.getByRole("button", { name: "적용하기" }).click();
  await expect(page).toHaveURL(/sort=endingSoon/);

  const animalId = await openCardOnSecondPage(page);
  await page.getByRole("button", { name: "뒤로가기" }).click();
  await expect(page).toHaveURL(/sort=endingSoon/);
  await expect(page.locator(`[data-animal-id="${animalId}"]`)).toBeVisible();
  expect(await isCardInView(page, animalId)).toBe(true);
});

test("공유 링크로 상세에 바로 들어오면 뒤로가기가 목록으로 간다", async ({ page }) => {
  await page.goto(`/animals/${items[0]!.id}`);
  await page.getByRole("button", { name: "뒤로가기" }).click();

  await expect(page).toHaveURL("/");
  await expect(page.locator("[data-animal-id]").first()).toBeVisible();
});
