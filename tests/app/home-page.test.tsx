/** app/page.tsx: URL searchParams와 기억된 지역 쿠키를 파싱해 views/home에 넘기는지 */
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "@/app/page";
import { REGION_COOKIE } from "@/features/animal-filter";
import { HomeView } from "@/views/home";

let cookieValue: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({ get: (name: string) => (name === REGION_COOKIE && cookieValue ? { value: cookieValue } : undefined) }),
}));

beforeEach(() => {
  cookieValue = undefined;
});

async function renderPage(searchParams: Record<string, string | string[] | undefined>) {
  const element = await Page({ searchParams: Promise.resolve(searchParams) });
  expect(isValidElement(element)).toBe(true);
  expect(element.type).toBe(HomeView);
  return (element.props as { filter: unknown }).filter;
}

describe("app/page", () => {
  it("파라미터가 없으면 기본 필터(서울 전체, 시군구 없음)", async () => {
    expect(await renderPage({})).toEqual({
      species: "cat",
      region: "6110000",
      status: "protected",
      sort: "latest",
    });
  });

  it("기억된 지역 쿠키가 있으면 그 지역으로 그린다", async () => {
    cookieValue = "6260000.3350000"; // 부산 금정구
    expect(await renderPage({})).toMatchObject({ region: "6260000", district: "3350000" });
  });

  it("URL에 지역이 있으면 쿠키보다 URL이 우선이다", async () => {
    cookieValue = "6260000";
    expect(await renderPage({ region: "6110000" })).toEqual({
      species: "cat",
      region: "6110000",
      status: "protected",
      sort: "latest",
    });
  });

  it("전국을 기억했으면 전국으로 그린다", async () => {
    cookieValue = "all";
    expect(await renderPage({})).toEqual({ species: "cat", status: "protected", sort: "latest" });
  });

  it.each(["", "몰라", "6260000.9999999", "6260000.3350000.x", "9999999"])(
    "쿠키 값이 %j면 조용히 기본 지역(서울)",
    async (value) => {
      cookieValue = value;
      expect(await renderPage({})).toEqual({ species: "cat", region: "6110000", status: "protected", sort: "latest" });
    },
  );

  it("URL 값을 필터로 넘긴다(page는 무시)", async () => {
    expect(await renderPage({ species: "dog", region: "6260000", status: "all", sort: "endingSoon", page: "3" })).toEqual({
      species: "dog",
      region: "6260000",
      status: "all",
      sort: "endingSoon",
    });
  });
});
