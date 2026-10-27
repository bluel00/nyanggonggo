import { expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { SPECIES_COOKIE } from "../src/features/animal-filter/model/species-cookie";

/**
 * 앱의 쿠키·저장소 키. 값을 테스트에 복사하지 않고 앱 상수를 쓴다(#61). spec은 이 파일에서 가져온다.
 * 슬라이스 공개 API(index.ts)는 컴포넌트까지 함께 끌어오므로 상수가 있는 모델 파일을 직접 가져온다.
 */
export { FAVORITES_STORAGE_KEY } from "../src/features/animal-favorite/model/favorites-store";
export { REGION_COOKIE } from "../src/features/animal-filter/model/region-cookie";
export { SPECIES_COOKIE };

/**
 * 축종 기억을 심는다. `/`로 들어가는 테스트는 축종 기억이 있어야 홈(`/home`)을 건너뛰고 목록으로 간다
 * (PRD-v1.1 4절). 이 테스트들의 관심사는 축종이 아니라 스크롤·필터·지역이라, 기본 축종을 미리 기억시켜
 * 둔다. 홈을 거치는 흐름은 `e2e/species-home.spec.ts`가 본다.
 */
export async function rememberSpeciesCookie(context: BrowserContext, species = "cat") {
  await context.addCookies([{ name: SPECIES_COOKIE, value: species, url: "http://localhost:3000" }]);
}

/** 목록 API를 고정 데이터로 바꿀 때 한 페이지에 담는 건수 */
export const LIST_PAGE_SIZE = 6;
export const SCROLL = '[data-slot="app-scroll"]';

/** 투명 1x1 PNG(카드 사진 대신. 업스트림 이미지를 받지 않아 테스트가 빨라진다) */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

export type ListItem = { id: string; regionText: string; species: string; kindText: string | null };

/**
 * 고정 데이터로 쓸 공고를 개발 서버의 목록 API에서 받아 온다. E2E 서버는 모두 스텁(e2e/upstream-stub.mjs)을 쓰므로 스텁의 고정
 * 공고다(고양이·서울 30건, 기타·전국 20건, 개·세종 120건). 상세 페이지는 서버 렌더라 브라우저 라우팅으로 가릴 수 없어, 서버(스텁)가
 * 아는 공고 id가 필요하다. species를 바꾸면 그 축종으로 받는다(기타는 `other`). query를 비우면 전국이다.
 */
export async function loadStubItems(
  request: APIRequestContext,
  query = "region=6110000",
  species: "cat" | "dog" | "other" = "cat",
): Promise<ListItem[]> {
  // API는 IPv4로 직접 부른다(APIRequestContext에서 localhost가 ::1로 풀려 개발 서버에 못 붙는다)
  const response = await request.get(
    `http://127.0.0.1:3000/api/animals?species=${species}&status=protected&sort=latest${query ? `&${query}` : ""}`,
  );
  expect(response.ok(), "목록 API가 응답해야 한다(스텁을 넣은 개발 서버)").toBeTruthy();
  const body = (await response.json()) as { items: ListItem[] };
  expect(body.items.length, "고정 데이터로 쓸 공고가 충분해야 한다").toBeGreaterThanOrEqual(12);
  return body.items;
}

/**
 * 목록 API를 고정 데이터로 바꾼다. 커서는 이 목킹 안에서만 쓰는 offset 문자열이다.
 * 돌려주는 배열에는 목록 API로 나간 요청의 URL이 순서대로 쌓인다(어떤 지역으로 조회했는지 확인용).
 */
export async function mockList(page: Page, items: ListItem[]) {
  const requests: URL[] = [];
  await page.route(
    (url) => url.pathname === "/api/animals",
    async (route) => {
      requests.push(new URL(route.request().url()));
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
  return requests;
}

/** 목록 API로 나간 요청들의 region 값 */
export function requestedRegions(requests: URL[]): (string | null)[] {
  return requests.map((url) => url.searchParams.get("region"));
}

/** 목록 API로 나간 요청들의 species 값 */
export function requestedSpecies(requests: URL[]): (string | null)[] {
  return requests.map((url) => url.searchParams.get("species"));
}

/** 그중 첫 페이지 요청(커서 없는 것)만. 무한 스크롤의 다음 페이지 요청과 구분한다 */
export function firstPageRequests(requests: URL[]): URL[] {
  return requests.filter((url) => url.searchParams.get("cursor") === null);
}

/** 목록의 내부 스크롤 컨테이너를 끝까지 내려 다음 페이지를 부른다 */
export async function scrollListToBottom(page: Page) {
  await page.evaluate((selector) => {
    const container = document.querySelector<HTMLElement>(selector);
    if (container) container.scrollTop = container.scrollHeight;
  }, SCROLL);
}

const isNextListPage = (url: string) => {
  const { pathname, searchParams } = new URL(url);
  return pathname === "/api/animals" && searchParams.has("cursor");
};

/**
 * 목록을 끝까지 내려 다음 페이지 요청이 나가게 하고, 그 응답(성공)을 기다린다. 카드 수는 부르는 쪽이 이어서 본다.
 *
 * 카드가 DOM에 생긴 직후 한 번만 내리면, 그 순간 스크롤이 먹지 않거나(컨테이너가 아직 스크롤되지 않는 상태 등)
 * 다음 페이지 감시가 붙기 전이라 요청이 영영 나가지 않을 수 있다(전체 E2E에서 한 번, 카드 20장에서 멈춤).
 * 그래서 요청이 나갈 때까지 다시 내린다. 앱이 다음 페이지를 아예 부르지 않으면 여기서 실패한다.
 */
export async function loadNextListPage(page: Page) {
  let requested = false;
  const onRequest = (request: { url(): string }) => {
    if (isNextListPage(request.url())) requested = true;
  };
  page.on("request", onRequest);
  const response = page.waitForResponse((res) => isNextListPage(res.url()));
  try {
    await expect
      .poll(
        async () => {
          if (!requested) await scrollListToBottom(page);
          return requested;
        },
        { message: "끝까지 내리면 다음 페이지 요청이 나간다" },
      )
      .toBe(true);
    expect((await response).ok(), "다음 페이지 응답이 성공이다").toBe(true);
  } finally {
    page.off("request", onRequest);
  }
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

/**
 * 상세가 다 그려질 때까지 기다린다. 로딩 뼈대(loading.tsx)에도 뒤로가기가 있는데, 뼈대는 공고를 몰라 기본 목록으로 간다.
 * 상세 응답이 조금만 늦어도(첫 사진 크기 읽기, 최대 300ms, architecture.md 12절 50) 뼈대의 버튼을 누르게 되므로,
 * 상세에 바로 들어와 뒤로가기를 누르는 테스트는 이것을 먼저 부른다.
 */
export async function openedDetail(page: Page) {
  await expect(page.locator('[data-slot="animal-detail"]')).toBeVisible();
}
