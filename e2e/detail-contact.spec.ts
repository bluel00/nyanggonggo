import { expect, test, type Locator, type Page } from "@playwright/test";
import { openedDetail, watchConsoleErrors } from "./helpers";

/**
 * 상세의 보호소 주소·전화 줄(이슈 #3). 상세(서버 렌더)는 스텁(e2e/upstream-stub.mjs)의 고정 공고이고 연락처는 지어낸 값이다.
 * 보호 중 공고에는 두 줄과 줄 끝의 [지도]·[전화] 링크가 있고, 종료 공고에는 없다. 링크의 누르는 영역은 44×44px 이상이다.
 */
/** e2e/upstream-stub.mjs의 CARE와 같다 */
const CARE = { careAddr: "E2E시 가상구 테스트로 1 (예시동)", careTel: "000-0000-0000", careOwnerNm: "E2E 담당자" };
/** 고양이·서울 보호중 공고(SEOUL_CAT_ITEMS 0번째)와 종료 공고(ENDED_CASES의 사진 1장. 2장짜리는 두 사진 주소가 같아 캐러셀 key 경고가 난다) */
const PROTECTED_ID = "990000202602000";
const ENDED_ID = "990000202600012";

const consoleWatch = watchConsoleErrors();
test.beforeEach(({ page }) => consoleWatch.attach(page));
test.afterEach(() => consoleWatch.assertNone());

async function openDetail(page: Page, id: string) {
  await page.goto(`/animals/${id}`);
  await openedDetail(page);
  return page.locator('[data-slot="animal-detail"]');
}

const terms = (detail: Locator) => detail.locator("dt").allTextContents();

test("보호 중 상세: 주소·전화 줄과 [지도]·[전화] 링크, 누르는 영역 44px 이상", async ({ page }) => {
  const detail = await openDetail(page, PROTECTED_ID);
  expect(await terms(detail)).toEqual(["발견 장소", "보호소", "주소", "전화", "공고 기간", "특이사항"]);
  await expect(detail.getByText(CARE.careAddr, { exact: true })).toBeVisible();
  await expect(detail.getByText(CARE.careTel, { exact: true })).toBeVisible();
  await expect(detail).not.toContainText(CARE.careOwnerNm);

  const map = detail.getByRole("link", { name: "지도에서 주소 보기(새 탭)" });
  const call = detail.getByRole("link", { name: "보호소에 전화" });
  await expect(map).toHaveAttribute("href", `https://map.kakao.com/link/search/${encodeURIComponent(CARE.careAddr)}`);
  await expect(map).toHaveAttribute("target", "_blank");
  await expect(map).toHaveAttribute("rel", "noopener");
  await expect(call).toHaveAttribute("href", "tel:00000000000");

  const boxes = [];
  for (const link of [map, call]) {
    const box = (await link.boundingBox())!;
    expect(box.width).toBeGreaterThanOrEqual(44);
    expect(box.height).toBeGreaterThanOrEqual(44);
    boxes.push(box);
  }
  // 이웃한 두 링크의 누르는 영역이 겹치지 않는다
  expect(boxes[1].y).toBeGreaterThanOrEqual(boxes[0].y + boxes[0].height - 0.5);
});

test("종료 상세: 주소·전화 줄과 링크가 없고 보호소 이름은 있다", async ({ page }) => {
  const detail = await openDetail(page, ENDED_ID);
  await expect(detail.locator('[data-slot="status-badge"]')).toHaveText("종료");
  expect(await terms(detail)).toEqual(["발견 장소", "보호소", "공고 기간", "특이사항"]);
  await expect(detail.getByText("E2E 보호소", { exact: true })).toBeVisible();
  await expect(detail).not.toContainText(CARE.careAddr);
  await expect(detail).not.toContainText(CARE.careTel);
  await expect(detail.locator('[data-slot="contact-link"]')).toHaveCount(0);
});
