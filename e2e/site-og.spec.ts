import { expect, test, type APIRequestContext } from "@playwright/test";

/**
 * 링크 미리보기 메타(#69). 크롤러처럼 쿠키 없이 HTML을 받아 og 태그를 읽는다. 서버는 스텁(e2e/upstream-stub.mjs)이고 값은 지어낸 것이다.
 * 절대 주소의 기준은 Next 기본값(metadataBase 없음)이라 로컬에서는 이 서버의 주소다. 상세 og:image도 같은 기준이다.
 */

/** e2e/upstream-stub.mjs의 고양이·서울 첫 공고(종로구, 암컷) */
const DETAIL_ID = "990000202602000";
const SEOUL = "6110000";

async function ogTags(request: APIRequestContext, path: string) {
  const response = await request.get(path);
  expect(response.ok(), `${path} 응답`).toBe(true);
  const html = await response.text();
  const tags: Record<string, string> = {};
  for (const [, key, value] of html.matchAll(/<meta (?:property|name)="((?:og|twitter):[\w:]+)" content="([^"]*)"/g)) {
    tags[key] ??= value.replaceAll("&amp;", "&");
  }
  return { tags, html, url: response.url() };
}

const SITE = { siteName: "멍냥공고", description: "보호 중인 아이들의 공고가 더 많은 사람에게 닿도록." };

test.describe("사이트 OG(홈·목록)", () => {
  test("홈: `/`로 들어오면(쿠키 없음) /home이고 사이트 OG가 있다. 문서 제목은 그대로다", async ({ request, baseURL }) => {
    const { tags, html, url } = await ogTags(request, "/");
    expect(new URL(url).pathname).toBe("/home");
    expect(tags["og:url"]).toBe(`${baseURL}/home`);
    expect(tags["og:site_name"]).toBe(SITE.siteName);
    expect(tags["og:type"]).toBe("website");
    expect(tags["og:title"]).toBe(SITE.siteName);
    expect(tags["og:description"]).toBe(SITE.description);
    expect(tags["og:image"]).toMatch(new RegExp(`^${baseURL}/opengraph-image(\\?|$)`));
    expect(tags["twitter:card"]).toBe("summary_large_image");
    expect(html).toContain("<title>오늘은 누구를 보러 왔어요? | 멍냥공고</title>");
  });

  test("목록(지역 쿼리): og:url은 계약 값만으로 다시 만든 주소이고 계약 밖 파라미터는 빠진다", async ({ request, baseURL }) => {
    const { tags } = await ogTags(request, `/?species=cat&region=${SEOUL}&sex=female&utm_source=e2e&page=2`);
    expect(tags["og:url"]).toBe(`${baseURL}/?species=cat&region=${SEOUL}&sex=female`);
    expect(tags["og:site_name"]).toBe(SITE.siteName);
    expect(tags["og:type"]).toBe("website");
    expect(tags["og:title"]).toBe(SITE.siteName);
    expect(tags["og:description"]).toBe(SITE.description);
    expect(tags["og:image"]).toMatch(new RegExp(`^${baseURL}/opengraph-image(\\?|$)`));
    expect(tags["twitter:card"]).toBe("summary_large_image");
  });

  test("사이트 og:image는 PNG 1200×630이다(상세의 대체 이미지 재사용)", async ({ request }) => {
    const { tags } = await ogTags(request, "/home");
    expect(tags["og:image:width"]).toBe("1200");
    expect(tags["og:image:height"]).toBe("630");
    const image = await request.get(tags["og:image"]);
    expect(image.ok()).toBe(true);
    expect(image.headers()["content-type"]).toBe("image/png");
  });
});

test("상세: 기존 og:title·description·image는 그대로이고 og:url·site_name·type이 더해진다", async ({ request, baseURL }) => {
  const { tags } = await ogTags(request, `/animals/${DETAIL_ID}?utm_source=e2e`);
  expect(tags["og:url"]).toBe(`${baseURL}/animals/${DETAIL_ID}`);
  expect(tags["og:site_name"]).toBe(SITE.siteName);
  expect(tags["og:type"]).toBe("website");
  expect(tags["og:title"]).toBe("서울특별시 종로구 고양이 공고 | 멍냥공고");
  expect(tags["og:description"]).toMatch(/^암컷 · 2025\(년생\) · 보호중 · D-\d+ · E2E 고정 공고$/);
  expect(tags["og:image"]).toMatch(new RegExp(`^${baseURL}/animals/${DETAIL_ID}/opengraph-image(\\?|$)`));
  expect(tags["twitter:card"]).toBe("summary_large_image");
});
