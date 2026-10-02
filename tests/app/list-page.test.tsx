/** app/page.tsx: URL searchParams와 기억된 지역 쿠키를 파싱해 views/animal-list에 넘기는지, 지역이 없으면 주소를 채워 주는지 */
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "@/app/page";
import { REGION_COOKIE } from "@/features/animal-filter";
import { AnimalListView } from "@/views/animal-list";

let cookieValue: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (name === REGION_COOKIE && cookieValue ? { value: cookieValue } : undefined),
  }),
}));

/** 실제 redirect()는 NEXT_REDIRECT를 던진다. 여기서는 목적지만 확인한다 */
class Redirected extends Error {
  constructor(readonly url: string) {
    super(`redirect: ${url}`);
  }
}
vi.mock("next/navigation", () => ({
  redirect: (url: string) => {
    throw new Redirected(url);
  },
}));

beforeEach(() => {
  cookieValue = undefined;
});

const SEOUL = "6110000";
const BUSAN = "6260000";
const BUSAN_GEUMJEONG = "3350000";

type SearchParams = Record<string, string | string[] | undefined>;

/** 리다이렉트 없이 렌더되면 filter를, 리다이렉트되면 목적지를 돌려준다 */
async function renderPage(searchParams: SearchParams) {
  const element = await Page({ searchParams: Promise.resolve(searchParams) });
  expect(isValidElement(element)).toBe(true);
  expect(element.type).toBe(AnimalListView);
  return (element.props as { filter: unknown }).filter;
}

async function redirectOf(searchParams: SearchParams) {
  try {
    await Page({ searchParams: Promise.resolve(searchParams) });
  } catch (error) {
    if (error instanceof Redirected) return error.url;
    throw error;
  }
  throw new Error("리다이렉트하지 않았다");
}

describe("app/page: 지역이 없으면 주소를 채워 리다이렉트", () => {
  it("파라미터가 없으면 기본 지역(서울)을 채운다", async () => {
    expect(await redirectOf({})).toBe(`/?species=cat&region=${SEOUL}`);
  });

  it("기억된 지역이 있으면 그 지역을 채운다", async () => {
    cookieValue = BUSAN;
    expect(await redirectOf({})).toBe(`/?species=cat&region=${BUSAN}`);
  });

  it("기억된 시군구까지 채운다", async () => {
    cookieValue = `${BUSAN}.${BUSAN_GEUMJEONG}`;
    expect(await redirectOf({})).toBe(`/?species=cat&region=${BUSAN}&district=${BUSAN_GEUMJEONG}`);
  });

  it("전국을 기억했으면 region=all", async () => {
    cookieValue = "all";
    expect(await redirectOf({})).toBe("/?species=cat&region=all");
  });

  it("focus 등 다른 파라미터는 그대로 옮긴다", async () => {
    expect(await redirectOf({ focus: "411317202600404", utm_source: "kakao", species: "dog" })).toBe(
      `/?focus=411317202600404&utm_source=kakao&species=dog&region=${SEOUL}`,
    );
  });

  it("모르는 지역 코드도 주소를 바로잡는다", async () => {
    cookieValue = BUSAN;
    expect(await redirectOf({ region: "9999999" })).toBe(`/?species=cat&region=${BUSAN}`);
  });

  it.each(["", "몰라", `${BUSAN}.9999999`, `${BUSAN}.${BUSAN_GEUMJEONG}.x`])(
    "쿠키 값이 %j면 기본 지역(서울)을 채운다",
    async (value) => {
      cookieValue = value;
      expect(await redirectOf({})).toBe(`/?species=cat&region=${SEOUL}`);
    },
  );
});

describe("app/page: 지역이 있으면 그대로 그린다", () => {
  it("URL이 쿠키보다 우선이다(리다이렉트 없음)", async () => {
    cookieValue = BUSAN;
    expect(await renderPage({ region: SEOUL })).toEqual({
      species: "cat",
      region: SEOUL,
      status: "protected",
      sort: "latest",
    });
  });

  it("URL 값을 필터로 넘긴다(page는 무시)", async () => {
    expect(
      await renderPage({ species: "dog", region: BUSAN, status: "all", sort: "endingSoon", page: "3" }),
    ).toEqual({ species: "dog", region: BUSAN, status: "all", sort: "endingSoon" });
  });

  it("region=all이면 전국으로 그린다", async () => {
    expect(await renderPage({ region: "all" })).toEqual({ species: "cat", status: "protected", sort: "latest" });
  });

  it("focus는 filter가 아니라 focusId로 넘긴다", async () => {
    const element = await Page({ searchParams: Promise.resolve({ region: SEOUL, focus: "411317202600404" }) });
    expect((element.props as { focusId: unknown }).focusId).toBe("411317202600404");
  });
});
