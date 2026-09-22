/** app/page.tsx: URL searchParams를 파싱해 views/home에 넘기는지 */
import { isValidElement } from "react";
import { describe, expect, it } from "vitest";
import Page from "@/app/page";
import { HomeView } from "@/views/home";

async function renderPage(searchParams: Record<string, string | string[] | undefined>) {
  const element = await Page({ searchParams: Promise.resolve(searchParams) });
  expect(isValidElement(element)).toBe(true);
  expect(element.type).toBe(HomeView);
  return (element.props as { filter: unknown }).filter;
}

describe("app/page", () => {
  it("파라미터가 없으면 기본 필터(서울/종로구)", async () => {
    expect(await renderPage({})).toEqual({
      species: "cat",
      region: "6110000",
      district: "3000000",
      status: "protected",
      sort: "latest",
    });
  });

  it("URL 값을 필터로 넘긴다(page는 무시)", async () => {
    expect(await renderPage({ species: "dog", region: "6260000", status: "all", sort: "endingSoon", page: "3" })).toEqual({
      species: "dog",
      region: "6260000",
      status: "all",
      sort: "endingSoon",
    });
  });
});
