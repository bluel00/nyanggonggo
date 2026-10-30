import { expect, type APIRequestContext, type BrowserContext, type Page } from "@playwright/test";
import { HOME_SCENE_SEEN_KEY } from "../src/features/animal-filter/model/home-scene";
import { SPECIES_COOKIE } from "../src/features/animal-filter/model/species-cookie";
import { listIdPrefix } from "./stub-combo.mjs";

/**
 * 앱의 쿠키·저장소 키. 값을 테스트에 복사하지 않고 앱 상수를 쓴다(#61). spec은 이 파일에서 가져온다.
 * 슬라이스 공개 API(index.ts)는 컴포넌트까지 함께 끌어오므로 상수가 있는 모델 파일을 직접 가져온다.
 */
export { FAVORITES_STORAGE_KEY } from "../src/features/animal-favorite/model/favorites-store";
export { REGION_COOKIE } from "../src/features/animal-filter/model/region-cookie";
export { HOME_SCENE_SEEN_KEY, SPECIES_COOKIE };

/**
 * 축종 기억을 심는다. `/`로 들어가는 테스트는 축종 기억이 있어야 홈(`/home`)을 건너뛰고 목록으로 간다
 * (PRD-v1.1 4절). 이 테스트들의 관심사는 축종이 아니라 스크롤·필터·지역이라, 기본 축종을 미리 기억시켜
 * 둔다. 홈을 거치는 흐름은 `e2e/species-home.spec.ts`가 본다.
 */
export async function rememberSpeciesCookie(context: BrowserContext, species = "cat") {
  await context.addCookies([{ name: SPECIES_COOKIE, value: species, url: "http://localhost:3000" }]);
}

export const SCROLL = '[data-slot="app-scroll"]';

/** 투명 1x1 PNG(카드 사진 대신. 업스트림 이미지를 받지 않아 테스트가 빨라진다) */
const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=",
  "base64",
);

export type ListItem = { id: string; regionText: string; species: string; kindText: string | null };

/**
 * 고정 데이터로 쓸 공고를 개발 서버의 목록 API에서 받아 온다. E2E 서버는 모두 스텁(e2e/upstream-stub.mjs)을 쓰므로 스텁의 고정
 * 공고다(고양이·서울 30건, 기타·전국 20건, 개·세종 120건, 그 밖의 조합은 조합마다 지어낸 30건, e2e/stub-combo.mjs). 상세 페이지는 서버 렌더라 브라우저 라우팅으로 가릴 수 없어, 서버(스텁)가
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

/** 목록 조건(축종·지역·시군구). 지역이 없으면 전국 */
export type ListCondition = { species: "cat" | "dog" | "other"; region?: string | null; district?: string | null };

/**
 * 목록을 지켜본다(가로채지 않는다, #109). 목록 첫 페이지는 서버가 읽어 HTML·RSC로 오므로 브라우저 요청으로는 조건을 볼 수 없다.
 * 대신 스텁이 조건마다 다른 공고를 주고(e2e/stub-combo.mjs), 여기서는 화면에 한 번이라도 그려진 카드 id를 모두 기록한다.
 * 돌려주는 배열에는 브라우저가 부른 /api/animals 요청(다음 페이지, 서버가 첫 페이지를 읽지 못한 경우)이 쌓인다.
 * 카드 사진은 1x1 PNG로 바꾼다(업스트림 이미지를 받지 않아 테스트가 빨라진다).
 */
export async function watchList(page: Page) {
  const requests: URL[] = [];
  page.on("request", (request) => {
    const url = new URL(request.url());
    if (url.pathname === "/api/animals") requests.push(url);
  });
  await page.addInitScript(() => {
    const seen = new Set<string>();
    (window as unknown as { __seenCards: Set<string> }).__seenCards = seen;
    const record = () => document.querySelectorAll("[data-animal-id]").forEach((el) => seen.add(el.getAttribute("data-animal-id")!));
    new MutationObserver(record).observe(document, { childList: true, subtree: true });
    document.addEventListener("DOMContentLoaded", record);
  });
  await page.route(
    (url) => url.pathname === "/api/image-proxy",
    (route) => route.fulfill({ contentType: "image/png", body: PNG_1X1 }),
  );
  return requests;
}

/** 기록을 비운다. 앱 안에서 다른 목록으로 옮겨 가기 직전에 부르면 그 뒤에 그려진 카드만 남는다 */
export async function clearSeenCards(page: Page) {
  await page.evaluate(() => (window as unknown as { __seenCards?: Set<string> }).__seenCards?.clear());
}

/** 이 페이지에서 한 번이라도 그려진 목록 카드 id(watchList를 먼저 불러야 한다) */
export function seenCardIds(page: Page): Promise<string[]> {
  return page.evaluate(() => [...(window as unknown as { __seenCards?: Set<string> }).__seenCards ?? []]);
}

/**
 * 목록이 이 조건으로 조회됐는지(#109): 카드가 보이고, 지금 그려진 카드와 이 페이지에서 한 번이라도 그려진 카드가 모두 그 조건의 공고다
 * (스텁이 조건마다 다른 id를 준다, e2e/stub-combo.mjs). 다른 조건의 목록이 먼저 그려졌다가 바뀌어도 여기서 실패한다.
 */
export async function expectListFrom(page: Page, { species, region = null, district = null }: ListCondition) {
  const prefix = listIdPrefix(species, region, district);
  await expect(page.locator("[data-animal-id]").first()).toBeVisible();
  const now = await page.locator("[data-animal-id]").evaluateAll((els) => els.map((el) => el.getAttribute("data-animal-id")!));
  const seen = await seenCardIds(page);
  const wrong = [...now, ...seen].filter((id) => !id.startsWith(prefix));
  expect(wrong, `${species}·${region ?? "전국"}·${district ?? "-"} 목록(접두어 ${prefix})이 아닌 카드`).toEqual([]);
}

/**
 * 이 조건·정렬로 읽은 목록 첫 페이지의 공고 id 순서(개발 서버 목록 API, 서버와 같은 데이터·정렬). 화면 카드 순서와 비교해 정렬이 반영됐는지 본다
 */
export async function listOrder(request: APIRequestContext, condition: ListCondition, query = ""): Promise<string[]> {
  const params = new URLSearchParams({ species: condition.species, status: "protected" });
  if (condition.region) params.set("region", condition.region);
  if (condition.region && condition.district) params.set("district", condition.district);
  for (const [key, value] of new URLSearchParams(query)) params.set(key, value);
  const response = await request.get(`http://127.0.0.1:3000/api/animals?${params}`);
  expect(response.ok()).toBeTruthy();
  return ((await response.json()) as { items: { id: string }[] }).items.map((item) => item.id);
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
  let expected: RegExp | null = null;
  return {
    attach(page: Page) {
      errors.length = 0;
      expected = null;
      page.on("console", (message) => {
        if (message.type() === "error") errors.push(message.text());
      });
      page.on("pageerror", (error) => errors.push(String(error)));
    },
    /** 이 테스트에서 일부러 낸 오류(예: 실패 응답)는 빼고 본다 */
    expect(pattern: RegExp) {
      expected = pattern;
    },
    assertNone() {
      expect(errors.filter((error) => !expected?.test(error)), "콘솔 오류가 없어야 한다").toEqual([]);
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


/**
 * 홈 첫인상 장면(handoff (k), #115)을 건너뛴다: 이 세션에서 홈 첫 진입을 이미 쓴 것으로 둔다. 새 브라우저 컨텍스트의 첫 홈은
 * 장면이라, 지금 등장과 인사(두 번째 진입부터의 모습)를 보는 테스트가 문서를 열기 전에 부른다. 장면은 `e2e/home-scene.spec.ts`가 본다.
 */
export async function skipHomeScene(page: Page) {
  await page.addInitScript((key) => sessionStorage.setItem(key, "1"), HOME_SCENE_SEEN_KEY);
}

/** 홈이 다 그려질 때까지(장면을 기다리는 중이 아니고, 등장·장면의 CSS 애니메이션이 모두 끝남). 배치를 잴 때 쓴다 */
export async function homeSettled(page: Page) {
  await page.waitForFunction(() => {
    if (document.documentElement.getAttribute("data-home-scene") === "pending") return false;
    return document.getAnimations().every((animation) => animation.playState === "finished");
  });
}
