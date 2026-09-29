import { expect, type APIRequestContext, type Page } from "@playwright/test";

/** 목록 API를 고정 데이터로 바꿀 때 한 페이지에 담는 건수 */
export const LIST_PAGE_SIZE = 6;
export const SCROLL = '[data-slot="app-scroll"]';

/** 투명 1x1 PNG(카드 사진 대신. 업스트림 이미지를 받지 않아 테스트가 빨라진다) */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

export type ListItem = { id: string; regionText: string };

/**
 * 고정 데이터로 쓸 공고를 실제 목록 API에서 받아 온다.
 * 상세 페이지는 서버 렌더라 브라우저 라우팅으로 가릴 수 없어, 실제로 존재하는 공고 id가 필요하다.
 */
export async function loadRealItems(request: APIRequestContext, query = "region=6110000"): Promise<ListItem[]> {
  // API는 IPv4로 직접 부른다(APIRequestContext에서 localhost가 ::1로 풀려 개발 서버에 못 붙는다)
  const response = await request.get(
    `http://127.0.0.1:3000/api/animals?species=cat&status=protected&sort=latest&${query}`,
  );
  expect(response.ok(), "목록 API가 응답해야 한다(개발 서버와 서비스키 필요)").toBeTruthy();
  const body = (await response.json()) as { items: ListItem[] };
  expect(body.items.length, "고정 데이터로 쓸 공고가 충분해야 한다").toBeGreaterThanOrEqual(12);
  return body.items;
}

/** 목록 API를 고정 데이터로 바꾼다. 커서는 이 목킹 안에서만 쓰는 offset 문자열이다 */
export async function mockList(page: Page, items: ListItem[]) {
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
export async function scrollListToBottom(page: Page) {
  await page.evaluate((selector) => {
    const container = document.querySelector<HTMLElement>(selector);
    if (container) container.scrollTop = container.scrollHeight;
  }, SCROLL);
}

/** 카드가 스크롤 컨테이너의 보이는 영역 안에 있는지 */
export async function isCardInView(page: Page, animalId: string) {
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

/** 내부 스크롤 컨테이너의 현재 위치 */
export function scrollTop(page: Page) {
  return page.evaluate((selector) => document.querySelector<HTMLElement>(selector)?.scrollTop ?? -1, SCROLL);
}

/**
 * 콘솔 오류를 모아 테스트 끝에 검사한다(중복 key 등).
 * 개발 서버에서 나는 빌드/HMR 관련 잡음은 제외하지 않는다. 오류가 보이면 그 자체로 고칠 거리다.
 */
export function watchConsoleErrors() {
  const errors: string[] = [];
  return {
    attach(page: Page) {
      errors.length = 0;
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(String(error)));
    },
    assertNone() {
      expect(errors, "콘솔 오류가 없어야 한다").toEqual([]);
    },
  };
}
