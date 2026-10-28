import { expect, test, type BrowserContext, type Page } from "@playwright/test";
import {
  clearSeenCards,
  expectListFrom,
  firstPageRequests,
  loadStubItems,
  openedDetail,
  REGION_COOKIE,
  rememberSpeciesCookie,
  SPECIES_COOKIE,
  watchConsoleErrors,
  watchList,
  type ListItem,
} from "./helpers";

/**
 * 홈(축종 선택)과 축종 기억(PRD-v1.1 3절 7)·8), 4절, architecture.md 7절).
 *
 * 쿠키와 리다이렉트는 서버에서 일어나고(`app/page.tsx`), 홈의 선택은 클라이언트에서 쿠키를 쓴다.
 * 둘이 실제로 맞물리는지는 브라우저에서만 볼 수 있어 여기서 본다. 목록 첫 페이지는 서버가 읽으므로(#109) 어떤 축종·지역으로 읽었는지는
 * 화면의 카드 id로 본다(스텁이 조건마다 다른 공고를 준다, e2e/stub-combo.mjs).
 */

const SEOUL = "6110000";
const BUSAN = "6260000";
const HOME_TITLE = "오늘은 누구를 보러 왔어요?";

/**
 * 고정 데이터는 한 번만 받는다(업스트림 호출을 늘리지 않는다). 목록 응답의 **내용**은 이 파일의 관심이 아니다:
 * 보는 것은 주소, 목록 요청의 조건, 쿠키다. 상세로 바로 들어가는 테스트만 서버(스텁)가 아는 공고 id가 필요하다.
 */
let items: ListItem[];
test.beforeAll(async ({ request }) => {
  items = await loadStubItems(request, `region=${SEOUL}`);
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
  const requests = await watchList(page);

  // 기억이 없으면 홈이다. 기본 축종(고양이)으로 밀어 넣지 않는다
  await page.goto("/");
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole("heading", { name: HOME_TITLE })).toBeVisible();
  expect(requests, "홈에서는 목록을 받지 않는다").toEqual([]);

  await page.getByRole("link", { name: "강아지" }).click();
  await expect(page).toHaveURL(`/?species=dog&region=${SEOUL}`);
  await expect(page.getByRole("heading", { name: "강아지 공고" })).toBeVisible();
  // 강아지·서울로 읽은 목록이고, 첫 페이지는 서버가 읽어 브라우저가 부르지 않는다
  await expectListFrom(page, { species: "dog", region: SEOUL });
  expect(firstPageRequests(requests)).toEqual([]);
  expect(await rememberedSpecies(context)).toBe("dog");

  // 같은 브라우저로 다시 들어오면 홈을 건너뛴다. 축종과 지역을 한 번의 리다이렉트로 채운다
  const next = await context.newPage();
  consoleWatch.attach(next);
  await watchList(next);
  const redirects = watchDocumentRedirects(next);
  await next.goto("/");
  await expect(next).toHaveURL(`/?species=dog&region=${SEOUL}`);
  await expect(next.getByRole("heading", { name: "강아지 공고" })).toBeVisible();
  expect(redirects, `리다이렉트: ${redirects.join(", ")}`).toHaveLength(1);
  // 고양이 목록이 먼저 그려지지 않는다
  await expectListFrom(next, { species: "dog", region: SEOUL });
});

test("목록 헤더에서 홈으로 가면 기억이 있어도 홈이 보이고, 다시 고르면 지역은 그대로다", async ({ page, context }) => {
  await rememberSpeciesCookie(context, "dog");
  await context.addCookies([{ name: REGION_COOKIE, value: BUSAN, url: "http://localhost:3000" }]);
  await watchList(page);

  await page.goto("/");
  await expect(page).toHaveURL(`/?species=dog&region=${BUSAN}`);
  await expectListFrom(page, { species: "dog", region: BUSAN });

  // 축종 기억이 있어도 홈은 건너뛰지 않는다(결정 G1). 보고 있던 지역을 함께 넘긴다(결정 G2)
  await page.getByRole("link", { name: /다른 동물 고르기/ }).click();
  await expect(page).toHaveURL(`/home?region=${BUSAN}`);
  await expect(page.getByRole("heading", { name: HOME_TITLE })).toBeVisible();

  await clearSeenCards(page);
  await page.getByRole("link", { name: "고양이" }).click();
  await expect(page).toHaveURL(`/?species=cat&region=${BUSAN}`);
  await expect(page.getByRole("heading", { name: "고양이 공고" })).toBeVisible();
  expect(await rememberedSpecies(context)).toBe("cat");
  // 홈에서는 축종만 기억한다. 지역 기억은 그대로이고, 목록도 그 지역(고양이·부산)으로 읽었다
  expect((await context.cookies()).find((cookie) => cookie.name === REGION_COOKIE)?.value).toBe(BUSAN);
  await expectListFrom(page, { species: "cat", region: BUSAN });
});

test("공유 링크로 다른 축종 공고를 열면 뒤로가기는 기억된 축종의 목록이고, 기억은 바뀌지 않는다", async ({
  page,
  context,
}) => {
  await rememberSpeciesCookie(context, "dog");
  await watchList(page);
  const target = items[3];

  await page.goto(`/animals/${target.id}`);
  await openedDetail(page);
  await page.getByRole("button", { name: "뒤로가기" }).click();

  // PRD-v1.4 R2: 그 공고(고양이)의 목록이 아니라 `/`로 간다 → 기억된 강아지, 지역 기억 없음 → 서울
  await expect(page).toHaveURL(`/?species=dog&region=${SEOUL}`);
  await expect(page.getByRole("heading", { name: "강아지 공고" })).toBeVisible();
  // 남이 공유한 공고를 봤다고 내 기본 축종이 바뀌면 안 된다
  expect(await rememberedSpecies(context)).toBe("dog");
});

test("필터 시트에서 축종을 바꾸면 그 축종을 기억한다", async ({ page, context }) => {
  await rememberSpeciesCookie(context, "cat");
  await watchList(page);

  await page.goto("/");
  await expectListFrom(page, { species: "cat", region: SEOUL });
  await page.getByRole("button", { name: "필터" }).click();
  await page.getByRole("radio", { name: "강아지" }).click();
  await clearSeenCards(page);
  await page.getByRole("button", { name: "적용하기" }).click();

  await expect(page).toHaveURL(/species=dog/);
  // 바꾼 축종(강아지·서울)으로 읽은 목록이다
  await expectListFrom(page, { species: "dog", region: SEOUL });
  expect(await rememberedSpecies(context)).toBe("dog");
});

test("홈의 선택지는 캐릭터(장식) + 텍스트 라벨의 링크이고, 캐릭터 이미지가 실제로 내려온다", async ({ page }) => {
  // 캐릭터 SVG 응답을 모은다. 404 등으로 깨지면 여기서 잡힌다
  const characterResponses: string[] = [];
  page.on("response", (response) => {
    // 정지 SVG만 본다(같은 폴더의 .riv는 Rive 교체용이고 home-rive.spec.ts가 본다)
    const { pathname } = new URL(response.url());
    if (pathname.startsWith("/characters/") && pathname.endsWith(".svg")) {
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
  // 기타 동물 카드는 새·토끼·거북이 셋(장식, 44px)이다(#86)
  const other = page.getByRole("link", { name: "기타 동물", exact: true }).locator("img");
  await expect(other).toHaveCount(3);
  await expect.poll(() => other.evaluateAll((imgs) => imgs.map((img) => (img as HTMLImageElement).complete && (img as HTMLImageElement).naturalWidth))).toEqual([120, 120, 120]);
  await expect(page.locator("main img")).toHaveCount(5);

  expect(characterResponses.sort()).toEqual([
    "200 /characters/nyang-bird.svg",
    "200 /characters/nyang-cat.svg",
    "200 /characters/nyang-dog.svg",
    "200 /characters/nyang-rabbit.svg",
    "200 /characters/nyang-turtle.svg",
  ]);
});

test("목록 헤더 진입점은 접근 가능한 이름에 '다른 동물 고르기'가 들어간다", async ({ page, context }) => {
  await watchList(page);
  for (const [species, title] of [
    ["cat", "고양이 공고"],
    ["other", "기타 동물 공고"],
  ]) {
    await rememberSpeciesCookie(context, species);
    await page.goto(`/?species=${species}&region=${SEOUL}`);
    const entry = page.getByRole("link", { name: `${title}, 다른 동물 고르기`, exact: true });
    await expect(entry).toBeVisible();
    await expect(entry).toHaveAttribute("href", `/home?region=${SEOUL}`);
    // 하트·필터는 그대로 오른쪽에 있다
    await expect(page.getByRole("button", { name: "필터" })).toBeVisible();
  }
});
