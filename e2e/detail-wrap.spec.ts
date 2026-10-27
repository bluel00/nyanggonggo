import { expect, test, type Locator } from "@playwright/test";
import { openedDetail, watchConsoleErrors } from "./helpers";

/**
 * 상세 정보 줄 값의 줄바꿈(이슈 #11). 한글 값은 띄어쓰기에서만 줄이 바뀌고(단어 중간에서 끊기지 않는다),
 * 띄어쓰기 없는 긴 값도 가로로 넘치지 않는다. 보호소 주소는 보호소 정보 시트에 있어(#62) 시트를 열어 본다. 상세(서버 렌더)는 스텁(e2e/upstream-stub.mjs)의 줄바꿈 확인용 공고이고 값은 지어낸 것이다.
 */
/** e2e/upstream-stub.mjs의 WRAP_ID, WRAP_VALUES와 같다 */
const WRAP_ID = "990000202600021";
const WRAP_VALUES = {
  careAddr: "가상특별시 예시구 테스트대로 123길 45 (가나다라동, 예시주상복합아파트 101동)",
  happenPlace: "가상특별시 예시구 테스트대로 앞 버스정류장 근처 공원 산책로 입구 화단",
  specialMark: "E2E-LONG-VALUE-WITHOUT-ANY-SPACES-".repeat(4),
};

const consoleWatch = watchConsoleErrors();
test.beforeEach(({ page }) => consoleWatch.attach(page));
test.afterEach(() => consoleWatch.assertNone());

/** 여러 줄로 바뀌는 값이 단어 중간에서 끊기지 않는지(단어마다 줄 상자가 하나) */
async function expectWordWrap(value: Locator) {
  // 여러 줄로 바뀌는 길이다(이 확인이 의미 있으려면)
  expect((await value.boundingBox())!.height).toBeGreaterThan(30);
  // 단어마다 줄 상자가 하나다: 단어 중간에서 끊기면 그 단어의 줄 상자가 둘이 된다
  const split = await value.evaluate((element) => {
    const node = [...element.childNodes].find((child) => child.nodeType === Node.TEXT_NODE)!;
    const text = node.textContent!;
    const words: string[] = [];
    for (const match of text.matchAll(/\S+/g)) {
      const range = document.createRange();
      range.setStart(node, match.index);
      range.setEnd(node, match.index + match[0].length);
      if (range.getClientRects().length > 1) words.push(match[0]);
    }
    return words;
  });
  expect(split, "단어 중간에서 줄이 바뀌면 안 된다").toEqual([]);
}

test("띄어쓰기 있는 값은 띄어쓰기에서만 줄이 바뀌고, 띄어쓰기 없는 긴 값도 넘치지 않는다", async ({ page }) => {
  await page.goto(`/animals/${WRAP_ID}`);
  await openedDetail(page);
  const detail = page.locator('[data-slot="animal-detail"]');

  await expectWordWrap(detail.locator('[data-slot="detail-value"]', { hasText: WRAP_VALUES.happenPlace }));

  const longValue = detail.locator('[data-slot="detail-value"]', { hasText: WRAP_VALUES.specialMark });
  await expect(longValue).toBeVisible();
  // 가로로 넘치는 값이 없고, 화면도 가로로 스크롤되지 않는다
  const overflow = await detail.evaluate((element) => {
    const right = element.getBoundingClientRect().right;
    return [...element.querySelectorAll<HTMLElement>('[data-slot="detail-value"]')]
      .filter((value) => value.scrollWidth > value.clientWidth + 1 || value.getBoundingClientRect().right > right + 1)
      .map((value) => value.textContent);
  });
  expect(overflow).toEqual([]);
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});

test("보호소 정보 시트의 주소도 띄어쓰기에서만 줄이 바뀐다(#62)", async ({ page }) => {
  await page.goto(`/animals/${WRAP_ID}`);
  await openedDetail(page);
  await page.getByRole("button", { name: "보호소 정보 보기" }).click();
  const sheet = page.locator('[data-slot="shelter-info-sheet"]');
  await expect(sheet).toBeVisible();
  await expectWordWrap(sheet.locator('[data-slot="shelter-contact-value"]', { hasText: WRAP_VALUES.careAddr }));
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
});
