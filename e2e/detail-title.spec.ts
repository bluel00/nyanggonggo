import { expect, test, type Locator } from "@playwright/test";

/**
 * 상세 제목 줄은 상태와 상관없이 32px이다(architecture.md 14.1·14.4 2단계). 종료 공고 제목은 title 크기(20px)지만 줄 높이를
 * 맞춰, 로딩 뼈대(`app/animals/[id]/loading.tsx`) → 종료 공고 상세로 바뀔 때 제목과 그 아래 내용이 움직이지 않는다.
 *
 * 스텁 서버(e2e/upstream-stub.mjs)의 종료 공고를 찜 목록에 넣어 두고 카드를 눌러 앱 안에서 이동한다. 상세로 가는 RSC 요청
 * (prefetch가 아닌 실제 이동 요청)을 늦춰 뼈대를 붙잡아 둔다(e2e/detail-loading.spec.ts와 같은 방법). 사진은 1:1 두 장이라
 * 뼈대의 기본 칸(1:1)·넘김 점 줄과 높이가 같다. 사진이 한 장이면 점 줄이 없어 제목 위가 18px 올라간다(architecture.md 12절 B, 이 테스트 밖).
 */
const ENDED_ID = "990000202600011";
const FAVORITES_STORAGE_KEY = "nyanggonggo:favorites";
const DETAIL_DELAY_MS = 1500;

/** 제목 상자와 바로 아래 요소의 위쪽 위치(페이지 좌표) */
async function titleBox(scope: Locator) {
  return scope.locator('[data-slot="detail-title"]').evaluate((title) => {
    const box = title.getBoundingClientRect();
    return {
      top: box.top,
      height: box.height,
      nextTop: title.nextElementSibling!.getBoundingClientRect().top,
    };
  });
}

test("로딩 뼈대 → 종료 공고 상세: 제목 줄 32px, 제목과 그 아래 내용이 움직이지 않는다", async ({ page }) => {
  await page.addInitScript(
    ([key, id]) => window.localStorage.setItem(key, JSON.stringify([id])),
    [FAVORITES_STORAGE_KEY, ENDED_ID],
  );
  await page.route(
    (url) => url.pathname === `/animals/${ENDED_ID}` && url.searchParams.has("_rsc"),
    async (route) => {
      if (route.request().headers()["next-router-prefetch"]) return route.continue();
      await new Promise((resolve) => setTimeout(resolve, DETAIL_DELAY_MS));
      await route.continue();
    },
  );

  await page.goto("/favorites");
  const card = page.locator(`[data-animal-id="${ENDED_ID}"] a`);
  await expect(card).toBeVisible();
  await page.waitForLoadState("networkidle");
  await card.click();

  const skeleton = page.locator('[data-slot="detail-skeleton"]');
  await expect(skeleton).toBeVisible();
  const before = await titleBox(skeleton);

  const detail = page.locator('[data-slot="animal-detail"]');
  await expect(detail).toBeVisible({ timeout: DETAIL_DELAY_MS + 10_000 });
  await expect(detail.locator('[data-slot="status-badge"]')).toHaveText("종료");
  const after = await titleBox(detail);

  expect(before.height).toBe(32);
  expect(after).toEqual(before);
});
