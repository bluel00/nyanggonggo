import { expect, test } from "@playwright/test";
import { watchConsoleErrors } from "./helpers";

/**
 * 홈의 세로 배치(시안 Main 390 / Home-PC 480, architecture.md 12절 44).
 *
 * 묶음(제목 ~ 기타 동물 카드)은 남은 영역이 아니라 **화면 전체**의 세로 가운데에 온다. 다만 넘치지 않는 것이 먼저다
 * (#115, EL 결정 2026-10-30. docs/design handoff (k)에는 다음 디자인 싱크에 들어온다).
 * - 공간이 넉넉한 화면: 머리말과 같은 높이를 본문 아래에 비워 맞추므로 가운데 오프셋 기대값은 0이다. 반올림 여유로 |오프셋| ≤ 2px
 *   (서비스명 줄이 48로 그려지던 버그는 −10px이었다).
 * - 공간이 모자란 화면: 아래 빈 줄만 줄어든다. 세로 스크롤 없음, 머리말과 겹치지 않음, 아래 빈 공간 ≥ 0. 묶음이 가운데보다 아래에
 *   놓이는 것(375×667에서 약 11px)은 의도된 동작이다.
 */

const VIEWPORTS = [
  { width: 390, height: 844, room: true }, // 디자인 프레임
  { width: 430, height: 932, room: true }, // 큰 폰
  { width: 360, height: 800, room: true }, // 좁은 폰
  { width: 375, height: 667, room: false }, // 낮은 화면(iPhone SE)
  { width: 390, height: 667, room: false }, // 낮은 화면
  { width: 1280, height: 900, room: true }, // PC(480 컬럼)
  { width: 1080, height: 1920, room: true }, // 세로로 긴 화면(컬럼)
];

const consoleWatch = watchConsoleErrors();
test.beforeEach(({ page }) => consoleWatch.attach(page));
test.afterEach(() => consoleWatch.assertNone());

for (const viewport of VIEWPORTS) {
  const rule = viewport.room ? "화면 세로 가운데에 있다" : "넘치지 않고 머리말과 겹치지 않는다(아래 빈 줄만 줄어듦, EL 결정 #115)";
  test(`홈 묶음이 ${rule} (${viewport.width}×${viewport.height})`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto("/home");

    const title = page.getByRole("heading", { level: 1 });
    const other = page.getByRole("link", { name: "기타 동물", exact: true });
    await expect(title).toBeVisible();
    await expect(other).toBeVisible();

    const top = (await title.boundingBox())!.y;
    const otherBox = (await other.boundingBox())!;
    const bottom = otherBox.y + otherBox.height;
    const offset = (top + bottom) / 2 - viewport.height / 2;

    // 실패하면 수치가 보이게 메시지에 남긴다
    const detail = `묶음 ${top.toFixed(1)}~${bottom.toFixed(1)}, 중심 오프셋 ${offset.toFixed(1)}px`;
    if (viewport.room) {
      expect(Math.abs(offset), detail).toBeLessThanOrEqual(2);
    }
    // 어느 크기에서든: 머리말과 겹치지 않고, 아래 빈 공간 ≥ 0, 세로 스크롤 없음
    const headerBottom = await page.locator("header").first().evaluate((el) => el.getBoundingClientRect().bottom);
    expect(top, `${detail}, 머리말 아래 ${headerBottom.toFixed(1)}`).toBeGreaterThanOrEqual(headerBottom - 0.5);
    expect(viewport.height - bottom, detail).toBeGreaterThanOrEqual(0);
    const overflowing = await page.evaluate(() =>
      [document.scrollingElement!, ...document.querySelectorAll("*")]
        .filter((el) => el.scrollHeight - el.clientHeight > 1 && (el === document.scrollingElement || /auto|scroll/.test(getComputedStyle(el).overflowY)))
        .map((el) => `${el.tagName} ${el.scrollHeight}/${el.clientHeight}`),
    );
    expect(overflowing, detail).toEqual([]);
  });
}

test("홈 위쪽: 이름이 멍냥공고인 로고(가로 조합)가 처음부터 보이고, 그림이 실제로 그려진다(#66)", async ({ page }) => {
  await page.goto("/home");
  const logo = page.getByRole("img", { name: "멍냥공고" });
  await expect(logo).toBeVisible();
  await expect(logo).toHaveAttribute("data-combo", "lockup");
  await expect(logo).toHaveAttribute("data-variant", "line");
  // 부위를 나눈 인라인 SVG가 실제로 그려진다(입과 소리 선은 숨김, #115)
  const drawing = logo.locator("svg");
  await expect(drawing).toHaveCount(1);
  for (const part of ["dog", "dog-ear", "dog-eyes", "cat", "cat-eyes", "wordmark"]) {
    const box = await drawing.locator(`[data-part="${part}"]`).boundingBox();
    expect(box && box.width > 0 && box.height > 0, part).toBe(true);
  }
  for (const part of ["dog-mouth", "bark-lines"]) {
    await expect(drawing.locator(`[data-part="${part}"]`), part).toHaveAttribute("opacity", "0");
  }
  const box = (await logo.boundingBox())!;
  expect(Math.round(box.height)).toBe(56);
  await expect(page.getByText("보호 중인 아이들의 공고가")).toBeVisible();
});
