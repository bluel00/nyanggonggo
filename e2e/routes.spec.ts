import { expect, test } from "@playwright/test";
import { routes } from "../src/shared/config/routes";

/**
 * routes(src/shared/config/routes.ts)의 경로가 app 디렉터리의 실제 라우트와 맞는지(#73). 크롤러처럼 쿠키 없이 요청한다.
 * 서버는 스텁(e2e/upstream-stub.mjs)이고 상세 id는 스텁의 고정 공고다.
 */
const DETAIL_ID = "990000202602000";
const SEOUL = "6110000";

const pathOf = (url: string) => {
  const { pathname, search } = new URL(url);
  return pathname + search;
};

test("진입 경로: 기억이 없으면 홈으로 간다", async ({ request }) => {
  const response = await request.get(routes.entry());
  expect(response.ok()).toBe(true);
  expect(pathOf(response.url())).toBe(routes.home());
});

test.describe("페이지 경로가 그대로 열린다(리다이렉트 없음)", () => {
  for (const [name, path] of [
    ["홈", routes.home()],
    ["홈(지역)", routes.home(`region=${SEOUL}`)],
    ["목록", routes.list(`species=cat&region=${SEOUL}`)],
    ["관심 목록", routes.favorites()],
    ["상세", routes.detail(DETAIL_ID)],
  ] as const) {
    test(`${name}: ${path}`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      expect(pathOf(response.url())).toBe(path);
      expect(response.headers()["content-type"]).toContain("text/html");
    });
  }
});

test.describe("OG 이미지 경로", () => {
  for (const [name, path] of [
    ["사이트", routes.ogImage()],
    ["상세", routes.detailOgImage(DETAIL_ID)],
  ] as const) {
    test(`${name}: ${path}`, async ({ request }) => {
      const response = await request.get(path);
      expect(response.status()).toBe(200);
      expect(response.headers()["content-type"]).toBe("image/png");
    });
  }
});
