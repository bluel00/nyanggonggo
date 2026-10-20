import { expect, test } from "@playwright/test";
import {
  loadStubItems,
  mockList,
  rememberSpeciesCookie,
  SPECIES_COOKIE,
  watchConsoleErrors,
  type ListItem,
} from "./helpers";

/**
 * 기타 축종(upkind=429900). 기타 공고는 `kindNm`이 늘 "기타축종"이라 어떤 동물인지는
 * `kindFullNm`에서 뽑은 `kindText`에만 있다(architecture.md 12.A P12).
 * 목록은 page.route로 고정하고, 상세(서버 렌더)는 스텁(e2e/upstream-stub.mjs)의 기타 공고다. 실제 API가 기타 축종에 동물 이름을
 * 담아 주는지는 `pnpm e2e:live`(e2e/live)가 본다.
 */

let otherItems: ListItem[];
test.beforeAll(async ({ request }) => {
  // 전국 기타·보호중
  otherItems = await loadStubItems(request, "", "other");
  const named = otherItems.find((item) => item.kindText);
  expect(named, "동물 이름이 있는 기타 공고가 있어야 한다").toBeTruthy();
});

const consoleWatch = watchConsoleErrors();
test.beforeEach(async ({ page, context }) => {
  consoleWatch.attach(page);
  // 이 파일의 관심사는 축종이 아니다. 축종 기억을 심어 `/`가 홈을 건너뛰고 목록으로 가게 한다
  await rememberSpeciesCookie(context);
});
test.afterEach(() => consoleWatch.assertNone());

test("필터에서 기타를 고르면 기타 조건으로 조회하고 카드에 동물 이름이 보인다", async ({ page }) => {
  const requests = await mockList(page, otherItems);
  await page.goto("/");
  await expect(page.locator("[data-animal-id]").first()).toBeVisible();

  await page.getByRole("button", { name: "필터" }).click();
  await page.getByRole("radio", { name: "기타 동물" }).click();
  await page.getByRole("button", { name: "적용하기" }).click();

  await expect(page).toHaveURL(/species=other/);
  await expect(page.getByRole("heading", { name: "기타 동물 공고" })).toBeVisible();
  expect(requests.filter((url) => url.searchParams.get("species") === "other").length).toBeGreaterThan(0);

  // 카드 1줄은 "<동물> · <지역>"이다
  const target = otherItems.find((item) => item.kindText)!;
  const card = page.locator(`[data-animal-id="${target.id}"]`);
  await expect(card).toBeVisible();
  await expect(card).toContainText(`${target.kindText} · ${target.regionText}`);
});

test("공유 링크로 들어온 기타 공고는 상세에 동물 이름이 보이고, 뒤로가면 기억된 축종의 목록이다", async ({
  page,
  context,
}) => {
  await mockList(page, otherItems);
  const target = otherItems.find((item) => item.kindText)!;

  await page.goto(`/animals/${target.id}`);
  // 상세는 서버 렌더다(목킹 아님). 타이틀에 어떤 동물인지가 들어 있다
  await expect(page.getByRole("heading", { name: `${target.kindText} · ${target.regionText}` })).toBeVisible();

  // PRD-v1.4 R2: 공고의 축종(기타)이 아니라 `/`로 간다 → 기억된 축종(고양이, beforeEach), 지역 기억 없음 → 서울
  await page.getByRole("button", { name: "뒤로가기" }).click();
  await expect(page).toHaveURL("/?species=cat&region=6110000");
  await expect(page.getByRole("heading", { name: "고양이 공고" })).toBeVisible();
  const remembered = (await context.cookies()).find((cookie) => cookie.name === SPECIES_COOKIE)?.value;
  expect(remembered, "공유받은 공고의 축종을 기억하지 않는다").toBe("cat");
});
