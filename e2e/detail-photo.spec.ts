import { expect, test, type Page } from "@playwright/test";

/**
 * 상세 사진이 잘리지 않는다(PRD v1.3, architecture.md 12절 50). production 빌드를 스텁 서버로 띄워(첫 사진 크기 읽기 포함) 본다.
 *
 * 공고와 사진은 e2e/upstream-stub.mjs의 고정 데이터다(실제 공고·사진 요청 없음). 사진 크기는 스텁의 ANIMALS와 같아야 한다.
 * 비율은 2026-10-08 사진 비율 조사의 대표 경우(4:3 가로, 3:4 세로, 세로 → 가로)를 따랐다.
 */
const CASES = [
  { name: "4:3 가로", id: "990000202600001", photos: [{ width: 1600, height: 1200 }, { width: 1600, height: 1300 }] },
  { name: "3:4 세로", id: "990000202600002", photos: [{ width: 900, height: 1200 }, { width: 1020, height: 1084 }] },
  { name: "세로 → 가로가 섞임", id: "990000202600003", photos: [{ width: 1200, height: 1600 }, { width: 1600, height: 1200 }] },
];

/** 사진 칸은 컬럼 좌우 24px 안쪽이다(방향 A 1단계, px-6) */
const PHOTO_INSET = 24;

const clamp = (ratio: number) => Math.min(4 / 3, Math.max(3 / 4, ratio));

type Slide = { box: { width: number; height: number }; natural: { width: number; height: number }; fit: string; position: string };

/** i번째 슬라이드로 넘기고, 사진이 다 받아진 뒤 칸·사진 크기를 읽는다 */
async function slideAt(page: Page, index: number): Promise<Slide> {
  const track = page.locator('[data-slot="image-carousel"]');
  await track.evaluate((element, i) => element.scrollTo({ left: i * element.clientWidth }), index);
  const image = track.locator("button").nth(index).locator("img");
  await expect(image).toBeVisible();
  await expect.poll(() => image.evaluate((el: HTMLImageElement) => el.complete && el.naturalWidth > 0), { timeout: 15_000 }).toBe(true);
  return image.evaluate((el: HTMLImageElement) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      box: { width: rect.width, height: rect.height },
      natural: { width: el.naturalWidth, height: el.naturalHeight },
      fit: style.objectFit,
      position: style.objectPosition,
    };
  });
}

for (const item of CASES) {
  test(`상세 사진(${item.name}): 칸은 첫 사진 비율, 사진은 잘리지 않고, 넘겨도 칸 높이가 같고, 레이아웃 이동이 없다`, async ({ page }) => {
    await page.addInitScript(() => {
      const w = window as unknown as { __cls: number };
      w.__cls = 0;
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries() as (PerformanceEntry & { value: number; hadRecentInput: boolean })[]) {
          if (!entry.hadRecentInput) w.__cls += entry.value;
        }
      }).observe({ type: "layout-shift", buffered: true });
    });
    const response = await page.goto(`/animals/${item.id}`);
    expect(response?.status()).toBe(200);
    const track = page.locator('[data-slot="image-carousel"]');
    await expect(track).toBeVisible();

    // 칸은 컬럼 좌우 24px 안쪽(좁아진 칸에서도 아래 비율·contain이 그대로여야 한다)
    const column = await page.locator('[data-slot="app-column"]').boundingBox();
    const trackBox = await track.boundingBox();
    if (!column || !trackBox) throw new Error("컬럼 또는 사진 칸을 찾지 못했다");
    expect(trackBox.x - column.x, "칸 왼쪽 여백").toBeCloseTo(PHOTO_INSET, 0);
    expect(trackBox.width, "칸 폭 = 컬럼 − 좌우 24px").toBeCloseTo(column.width - PHOTO_INSET * 2, 0);

    // 칸 비율 = 첫 사진 비율을 3:4~4:3으로 제한. 모든 슬라이드가 같은 칸
    const expectedBox = clamp(item.photos[0].width / item.photos[0].height);
    const heights: number[] = [];
    for (const [index, original] of item.photos.entries()) {
      const slide = await slideAt(page, index);
      heights.push(slide.box.height);
      expect(slide.box.width, `사진 요소 폭 = 좁아진 칸 폭(${index + 1}번째)`).toBeCloseTo(trackBox.width, 0);
      expect(slide.box.width / slide.box.height, `칸 비율(${index + 1}번째)`).toBeCloseTo(expectedBox, 2);
      // 사진 전체가 칸 안에 보인다: contain이고, 원본 비율 그대로 그린 영역이 칸 안에 들어간다
      expect(slide.fit).toBe("contain");
      expect(slide.position).toBe("50% 50%");
      const naturalRatio = slide.natural.width / slide.natural.height;
      expect(naturalRatio, `받은 사진 비율 = 원본 비율(${index + 1}번째)`).toBeCloseTo(original.width / original.height, 2);
      const scale = Math.min(slide.box.width / slide.natural.width, slide.box.height / slide.natural.height);
      const drawn = { width: slide.natural.width * scale, height: slide.natural.height * scale };
      expect(drawn.width).toBeLessThanOrEqual(slide.box.width + 0.5);
      expect(drawn.height).toBeLessThanOrEqual(slide.box.height + 0.5);
      expect(drawn.width / drawn.height, `그려진 사진 영역 비율(${index + 1}번째)`).toBeCloseTo(original.width / original.height, 2);
    }
    // 넘겨 볼 때 칸 높이가 그대로
    expect(new Set(heights.map((h) => h.toFixed(1))).size, `칸 높이 ${heights.join(", ")}`).toBe(1);

    await page.waitForTimeout(500);
    const cls = await page.evaluate(() => (window as unknown as { __cls: number }).__cls);
    expect(cls, `layout-shift 합계 ${cls}`).toBeLessThanOrEqual(0.01);
  });
}
