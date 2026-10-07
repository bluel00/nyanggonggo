import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  firstPageRequests,
  isCardInView,
  loadRealItems,
  mockList,
  rememberSpeciesCookie,
  requestedRegions,
  requestedSpecies,
  SPECIES_COOKIE,
  watchConsoleErrors,
  type ListItem,
} from "./helpers";

/**
 * 홈(축종 선택)과 축종 기억(PRD-v1.1 3절 7)·8), 4절, architecture.md 7절).
 *
 * 쿠키와 리다이렉트는 서버에서 일어나고(`app/page.tsx`), 홈의 선택은 클라이언트에서 쿠키를 쓴다.
 * 둘이 실제로 맞물리는지는 브라우저에서만 볼 수 있어 여기서 본다. 목록 API 응답은 고정한다.
 */

const SEOUL = "6110000";
const BUSAN = "6260000";
const REGION_COOKIE = "nyanggonggo.region";
const HOME_TITLE = "오늘은 누구를 보러 왔어요?";

/**
 * 고정 데이터는 한 번만 받는다(업스트림 호출을 늘리지 않는다). 목록 응답의 **내용**은 이 파일의 관심이 아니다:
 * 보는 것은 주소, 목록 요청의 조건, 쿠키다. 상세로 바로 들어가는 테스트만 실제 공고 id가 필요하다.
 */
let items: ListItem[];
test.beforeAll(async ({ request }) => {
  items = await loadRealItems(request, `region=${SEOUL}`);
});

const consoleWatch = watchConsoleErrors();
test.beforeEach(({ page }) => consoleWatch.attach(page));
test.afterEach(() => consoleWatch.assertNone());

/** 지금 기억된 축종 */
async function rememberedSpecies(context: BrowserContext) {
  return (await context.cookies()).find((cookie) => cookie.name === SPECIES_COOKIE)?.value;
}

/** 문서(페이지) 요청에 대한 리다이렉트 응답만 모은다. 주소를 채우느라 307이 두 번 나가지 않는지 본다 */
function watchDocumentRedirects(page: Page): string[] {
  const redirects: string[] = [];
  page.on("response", (response) => {
    const status = response.status();
    if (status >= 300 && status < 400 && response.request().resourceType() === "document") {
      redirects.push(`${status} ${new URL(response.url()).pathname}`);
    }
  });
  return redirects;
}

test("첫 방문은 홈을 거치고, 고른 축종을 기억해 다음 방문은 바로 그 목록이다", async ({ page, context }) => {
  const requests = await mockList(page, items);

  // 기억이 없으면 홈이다. 기본 축종(고양이)으로 밀어 넣지 않는다
  await page.goto("/");
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: HOME_TITLE })).toBeVisible();
  expect(requests, "홈에서는 목록을 받지 않는다").toEqual([]);

  await page.getByRole("link", { name: "강아지" }).click();
  await expect(page).toHaveURL(`/?species=dog&region=${SEOUL}`);
  await expect(page.getByRole("heading", { name: "강아지 공고" })).toBeVisible();
  const asked = requestedSpecies(firstPageRequests(requests));
  expect(asked.length).toBeGreaterThan(0);
  expect(asked.every((species) => species === "dog"), `첫 페이지 요청 축종: ${asked.join(", ")}`).toBe(true);
  expect(await rememberedSpecies(context)).toBe("dog");

  // 같은 브라우저로 다시 들어오면 홈을 건너뛴다. 축종과 지역을 한 번의 리다이렉트로 채운다
  const next = await context.newPage();
  consoleWatch.attach(next);
  const nextRequests = await mockList(next, items);
  const redirects = watchDocumentRedirects(next);
  await next.goto("/");
  await expect(next).toHaveURL(`/?species=dog&region=${SEOUL}`);
  await expect(next.getByRole("heading", { name: "강아지 공고" })).toBeVisible();
  expect(redirects, `리다이렉트: ${redirects.join(", ")}`).toHaveLength(1);
  expect(requestedSpecies(nextRequests)).not.toContain("cat");
});

test("목록 헤더에서 홈으로 가면 기억이 있어도 홈이 보이고, 다시 고르면 지역은 그대로다", async ({ page, context }) => {
  await rememberSpeciesCookie(context, "dog");
  await context.addCookies([{ name: REGION_COOKIE, value: BUSAN, url: "http://localhost:3000" }]);
  const requests = await mockList(page, items);

  await page.goto("/");
  await expect(page).toHaveURL(`/?species=dog&region=${BUSAN}`);
  await expect(page.locator("[data-animal-id]").first()).toBeVisible();

  // 축종 기억이 있어도 홈은 건너뛰지 않는다(결정 G1). 보고 있던 지역을 함께 넘긴다(결정 G2)
  await page.getByRole("link", { name: /다른 동물 고르기/ }).click();
  await expect(page).toHaveURL(`/home?region=${BUSAN}`);
  await expect(page.getByRole("heading", { name: HOME_TITLE })).toBeVisible();

  await page.getByRole("link", { name: "고양이" }).click();
  await expect(page).toHaveURL(`/?species=cat&region=${BUSAN}`);
  await expect(page.getByRole("heading", { name: "고양이 공고" })).toBeVisible();
  expect(await rememberedSpecies(context)).toBe("cat");
  // 홈에서는 축종만 기억한다. 지역 기억은 그대로이고, 목록 요청도 그 지역이다
  expect((await context.cookies()).find((cookie) => cookie.name === REGION_COOKIE)?.value).toBe(BUSAN);
  expect(requestedRegions(requests).every((region) => region === BUSAN)).toBe(true);
});

test("공유 링크로 다른 축종 공고를 열면 뒤로가기는 그 공고의 목록이고, 기억은 바뀌지 않는다", async ({
  page,
  context,
}) => {
  await rememberSpeciesCookie(context, "dog");
  await mockList(page, items);
  const target = items[3];

  await page.goto(`/animals/${target.id}`);
  await page.getByRole("button", { name: "뒤로가기" }).click();

  // 뒤로가기는 기억된 강아지가 아니라 그 공고(고양이)의 목록으로 간다
  await expect(page).toHaveURL(/species=cat/);
  await expect(page.getByRole("heading", { name: "고양이 공고" })).toBeVisible();
  expect(await isCardInView(page, target.id)).toBe(true);
  // 남이 공유한 공고를 봤다고 내 기본 축종이 바뀌면 안 된다
  expect(await rememberedSpecies(context)).toBe("dog");
});

test("필터 시트에서 축종을 바꾸면 그 축종을 기억한다", async ({ page, context }) => {
  await rememberSpeciesCookie(context, "cat");
  await mockList(page, items);

  await page.goto("/");
  await page.getByRole("button", { name: "필터" }).click();
  await page.getByRole("radio", { name: "강아지" }).click();
  await page.getByRole("button", { name: "적용하기" }).click();

  await expect(page).toHaveURL(/species=dog/);
  expect(await rememberedSpecies(context)).toBe("dog");
});

test("홈의 선택지는 캐릭터(장식) + 텍스트 라벨의 링크이고, 캐릭터 이미지가 실제로 내려온다", async ({ page }) => {
  // 캐릭터 SVG 응답을 모은다. 404 등으로 깨지면 여기서 잡힌다
  const characterResponses: string[] = [];
  page.on("response", (response) => {
    if (new URL(response.url()).pathname.startsWith("/characters/")) {
      characterResponses.push(`${response.status()} ${new URL(response.url()).pathname}`);
    }
  });

  await page.goto("/home");
  await expect(page.getByRole("heading", { name: HOME_TITLE })).toBeVisible();

  for (const name of ["고양이", "강아지"]) {
    // 링크 이름은 텍스트 라벨이 정한다(이미지는 alt가 비어 이름에 끼지 않는다)
    const choice = page.getByRole("link", { name, exact: true });
    await expect(choice).toBeVisible();
    const image = choice.locator("img");
    await expect(image).toHaveCount(1);
    await expect(image).toHaveAttribute("alt", "");
    // 내려받아 그려졌다(깨진 이미지는 naturalWidth가 0이다)
    await expect.poll(() => image.evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth)).toBe(120);
  }
  // 기타는 캐릭터 없는 텍스트 링크다
  await expect(page.getByRole("link", { name: "다른 동물들도 있어요" }).locator("img")).toHaveCount(0);
  await expect(page.locator("main img")).toHaveCount(2);

  expect(characterResponses.sort()).toEqual(["200 /characters/nyang-cat.svg", "200 /characters/nyang-dog.svg"]);
});

test("목록 헤더 진입점은 접근 가능한 이름에 '다른 동물 고르기'가 들어간다", async ({ page, context }) => {
  await mockList(page, items);
  for (const [species, title] of [
    ["cat", "고양이 공고"],
    ["other", "기타 동물 공고"],
  ]) {
    await rememberSpeciesCookie(context, species);
    await page.goto(`/?species=${species}&region=${SEOUL}`);
    // 숨김 텍스트(sr-only)는 absolute라 Chrome이 이름에 공백을 하나 끼운다("고양이 공고 , 다른 동물 고르기")
    const entry = page.getByRole("link", { name: new RegExp(`^${title} ?, 다른 동물 고르기$`) });
    await expect(entry).toBeVisible();
    await expect(entry).toHaveAttribute("href", `/home?region=${SEOUL}`);
    // 하트·필터는 그대로 오른쪽에 있다
    await expect(page.getByRole("button", { name: "필터" })).toBeVisible();
  }
});
