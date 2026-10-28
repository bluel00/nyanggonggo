import { expect, test, type Page } from "@playwright/test";
import {
  expectListFrom,
  firstPageRequests,
  isCardInView,
  loadStubItems,
  openedDetail,
  REGION_COOKIE,
  rememberSpeciesCookie,
  scrollTop,
  watchConsoleErrors,
  watchList,
  type ListItem,
} from "./helpers";

/**
 * 마지막으로 고른 지역 기억(architecture.md 7절, 13절 (a)).
 * 쿠키에 담아 서버가 첫 렌더부터 그 지역으로 그린다. 기억은 필터 UI에서 직접 고를 때만 한다.
 * 목록 첫 페이지는 서버가 그 지역으로 읽는다(#109). 어느 지역으로 읽었는지는 화면의 카드 id로 본다: 스텁이 지역마다 다른 공고를 준다
 * (e2e/stub-combo.mjs, expectListFrom). 다른 지역 목록이 한 번이라도 그려졌으면 실패한다.
 */

const SEOUL = "6110000";
const BUSAN = "6260000";

let seoulItems: ListItem[];
test.beforeAll(async ({ request }) => {
  seoulItems = await loadStubItems(request, `region=${SEOUL}`);
});

const consoleWatch = watchConsoleErrors();
test.beforeEach(async ({ page, context }) => {
  consoleWatch.attach(page);
  // 이 파일의 관심사는 축종이 아니다. 축종 기억을 심어 `/`가 홈을 건너뛰고 목록으로 가게 한다
  await rememberSpeciesCookie(context);
});
test.afterEach(() => consoleWatch.assertNone());

test("필터로 고른 지역을 기억해, 다시 들어오면 첫 요청부터 그 지역이다", async ({ page, context }) => {
  await watchList(page);
  await page.goto("/");
  await expectListFrom(page, { species: "cat", region: SEOUL });

  // 필터 UI에서 부산을 고른다
  await page.getByRole("button", { name: "필터" }).click();
  await page.getByLabel("시/도").selectOption(BUSAN);
  await page.getByRole("button", { name: "적용하기" }).click();
  await expect(page).toHaveURL(new RegExp(`region=${BUSAN}`));

  // 새 페이지로 파라미터 없이 다시 들어온다(쿠키는 같은 컨텍스트라 유지된다)
  const next = await context.newPage();
  consoleWatch.attach(next);
  const requests = await watchList(next);
  await next.goto("/");
  // 처음부터 부산 목록이다(서울 목록이 먼저 그려졌다가 바뀌지 않는다). 첫 페이지는 서버가 읽어 브라우저가 부르지 않는다
  await expectListFrom(next, { species: "cat", region: BUSAN });
  expect(firstPageRequests(requests)).toEqual([]);
});

test("공유 링크로 들어온 상세의 뒤로가기는 공고의 지역이 아니라 기억된 지역 목록이고, 기억도 바꾸지 않는다", async ({
  page,
  context,
}) => {
  await context.addCookies([{ name: REGION_COOKIE, value: BUSAN, url: "http://localhost:3000" }]);
  const requests = await watchList(page);
  const shared = seoulItems[1]!; // 서울 공고

  await page.goto(`/animals/${shared.id}`);
  await openedDetail(page);
  await page.getByRole("button", { name: "뒤로가기" }).click();

  // PRD-v1.4 R2: 공고의 지역(서울)으로 좁히지 않고 `/`로 간다 → 기억된 축종(고양이)·지역(부산) 목록
  await expect(page).toHaveURL(`/?species=cat&region=${BUSAN}`);
  await expectListFrom(page, { species: "cat", region: BUSAN });
  expect(firstPageRequests(requests)).toEqual([]);

  const cookie = (await context.cookies()).find((item) => item.name === REGION_COOKIE);
  expect(cookie?.value, "남이 공유한 지역은 기억하지 않는다").toBe(BUSAN);

  // 그 목록에서 다른 카드로 들어갔다 돌아오면 그 목록(부산) 그대로다(R1)
  const another = page.locator("[data-animal-id]").nth(3);
  const anotherId = (await another.getAttribute("data-animal-id"))!;
  await another.locator("a").click();
  await expect(page).toHaveURL(new RegExp(`/animals/${anotherId}$`));
  await openedDetail(page);
  await page.getByRole("button", { name: "뒤로가기" }).click();

  await expect(page).toHaveURL(`/?species=cat&region=${BUSAN}`);
  await expect(page.locator(`[data-animal-id="${anotherId}"]`)).toBeVisible();
  expect(await isCardInView(page, anotherId)).toBe(true);
});

test("기억된 지역에서 목록 → 상세 → 뒤로가기도 그 지역 그대로다", async ({ page, context }) => {
  await context.addCookies([{ name: REGION_COOKIE, value: BUSAN, url: "http://localhost:3000" }]);
  await watchList(page);
  await page.goto("/");
  await expectListFrom(page, { species: "cat", region: BUSAN });

  const target = page.locator("[data-animal-id]").nth(2);
  const targetId = (await target.getAttribute("data-animal-id"))!;
  await page.evaluate(() => {
    const container = document.querySelector<HTMLElement>('[data-slot="app-scroll"]');
    if (container) container.scrollTop = 400;
  });
  await target.locator("a").click();
  await expect(page).toHaveURL(new RegExp(`/animals/${targetId}$`));

  await page.getByRole("button", { name: "뒤로가기" }).click();
  await expect(page).toHaveURL(new RegExp(`region=${BUSAN}`)); // 기억된 지역이 주소에 채워져 있다
  expect(await isCardInView(page, targetId)).toBe(true);
  expect(await scrollTop(page)).toBeGreaterThan(0);
  await expectListFrom(page, { species: "cat", region: BUSAN });
});

test("보고 있던 목록 주소는 다른 탭에서 지역을 바꿔도 그대로다(지역을 늘 URL에 쓰는 이유)", async ({ page, context }) => {
  await watchList(page);
  await page.goto("/");

  // 필터에서 서울 전체를 직접 고른다. 기본 지역이지만 URL에 명시된다
  await page.getByRole("button", { name: "필터" }).click();
  await page.getByLabel("시/도").selectOption(SEOUL);
  await page.getByRole("button", { name: "적용하기" }).click();
  await expect(page).toHaveURL(new RegExp(`region=${SEOUL}`));

  // 다른 탭에서 부산으로 바꿔 기억을 덮는다
  const other = await context.newPage();
  consoleWatch.attach(other);
  await watchList(other);
  await other.goto("/");
  await other.getByRole("button", { name: "필터" }).click();
  await other.getByLabel("시/도").selectOption(BUSAN);
  await other.getByRole("button", { name: "적용하기" }).click();
  await expect(other).toHaveURL(new RegExp(`region=${BUSAN}`));

  // 원래 탭을 새로고침해도 보고 있던 목록(서울)이다
  await page.reload();
  await expectListFrom(page, { species: "cat", region: SEOUL });
});

test("지역 없이 들어오면 기억된 지역을 주소에 채워 준다(목록 요청은 그 지역 한 번)", async ({ page, context }) => {
  await context.addCookies([{ name: REGION_COOKIE, value: BUSAN, url: "http://localhost:3000" }]);
  const requests = await watchList(page);

  await page.goto("/");
  await expect(page).toHaveURL(`/?species=cat&region=${BUSAN}`);
  // 처음부터 부산 목록이고 서울 목록은 한 번도 그려지지 않는다(서울을 받았다가 바꾸지 않는다). 첫 페이지 요청은 브라우저에서 나가지 않는다
  await expectListFrom(page, { species: "cat", region: BUSAN });
  expect(firstPageRequests(requests)).toEqual([]);
});

test("쿠키 값이 깨져 있으면 조용히 기본 지역(서울)으로 간다", async ({ page, context }) => {
  await context.addCookies([{ name: REGION_COOKIE, value: "몰라.이건", url: "http://localhost:3000" }]);
  await watchList(page);

  await page.goto("/");
  await expectListFrom(page, { species: "cat", region: SEOUL });
});

/** 문서 요청 중 리다이렉트(3xx) 응답 수. 서버의 redirect()와 클라이언트 이동이 모두 문서 요청으로 잡힌다 */
function countDocumentRedirects(page: Page) {
  const redirects: string[] = [];
  page.on("response", (response) => {
    if (response.request().resourceType() === "document" && response.status() >= 300 && response.status() < 400) {
      redirects.push(response.url());
    }
  });
  return redirects;
}

const GYEONGNAM = "6480000";
const CHANGWON = "5670000";

for (const oldCode of ["5280000", "5320000"]) {
  test(`목록에서 뺀 창원시 옛 코드(${oldCode}) 주소로 들어오면 5670000 목록이다(리다이렉트 1회)`, async ({ page }) => {
    await watchList(page);
    const redirects = countDocumentRedirects(page);

    await page.goto(`/?species=cat&region=${GYEONGNAM}&district=${oldCode}`);
    await expect(page).toHaveURL(`/?species=cat&region=${GYEONGNAM}&district=${CHANGWON}`);
    // 고친 시군구(5670000)로 읽은 목록이다
    await expectListFrom(page, { species: "cat", region: GYEONGNAM, district: CHANGWON });

    expect(redirects.length, `리다이렉트: ${redirects.join(", ")}`).toBe(1); // 주소를 고치는 한 번뿐이다
  });
}

test("지역 기억 쿠키에 창원시 옛 코드가 있으면 5670000으로 채운다(리다이렉트 1회)", async ({ page, context }) => {
  await context.addCookies([{ name: REGION_COOKIE, value: `${GYEONGNAM}.5280000`, url: "http://localhost:3000" }]);
  await watchList(page);
  const redirects = countDocumentRedirects(page);

  await page.goto("/");
  await expect(page).toHaveURL(`/?species=cat&region=${GYEONGNAM}&district=${CHANGWON}`);
  await expectListFrom(page, { species: "cat", region: GYEONGNAM, district: CHANGWON });

  expect(redirects.length, `리다이렉트: ${redirects.join(", ")}`).toBe(1); // 주소를 고치는 한 번뿐이다
});
