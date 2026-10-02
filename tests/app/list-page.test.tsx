/**
 * app/page.tsx: 쿠키 두 개(축종·지역)를 읽어 진입 판정에 넘기고, 결과대로 그리거나 리다이렉트하는지.
 * 판정 규칙 자체(표)는 `features/animal-filter/model/entry.test.ts`에 있다.
 */
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page from "@/app/page";
import { REGION_COOKIE, SPECIES_COOKIE } from "@/features/animal-filter";
import { AnimalListView } from "@/views/animal-list";

let speciesCookie: string | undefined;
let regionCookie: string | undefined;
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => {
      const value = name === SPECIES_COOKIE ? speciesCookie : name === REGION_COOKIE ? regionCookie : undefined;
      return value === undefined ? undefined : { value };
    },
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
  speciesCookie = undefined;
  regionCookie = undefined;
});

const SEOUL = "6110000";
const BUSAN = "6260000";
const BUSAN_GEUMJEONG = "3350000";
const ID = "411317202600404";

type SearchParams = Record<string, string | string[] | undefined>;

/** 리다이렉트 없이 렌더되면 filter를 돌려준다 */
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

describe("app/page: 축종 기억이 없으면 홈으로", () => {
  it("쿠키도 파라미터도 없으면 /home", async () => {
    expect(await redirectOf({})).toBe("/home");
  });

  it("지역 쿠키만 있어도 축종을 모르면 /home(지역은 판정하지 않는다)", async () => {
    regionCookie = BUSAN;
    expect(await redirectOf({})).toBe("/home");
  });

  it("홈으로 갈 때도 다른 파라미터는 옮긴다", async () => {
    expect(await redirectOf({ focus: ID, utm_source: "kakao" })).toBe(`/home?focus=${ID}&utm_source=kakao`);
  });
});

describe("app/page: 기억으로 주소를 채운다(한 번에)", () => {
  it("축종 쿠키를 읽어 축종과 기본 지역을 함께 채운다", async () => {
    speciesCookie = "dog";
    expect(await redirectOf({})).toBe(`/?species=dog&region=${SEOUL}`);
  });

  it("축종·지역 쿠키를 둘 다 읽는다", async () => {
    speciesCookie = "other";
    regionCookie = `${BUSAN}.${BUSAN_GEUMJEONG}`;
    expect(await redirectOf({})).toBe(`/?species=other&region=${BUSAN}&district=${BUSAN_GEUMJEONG}`);
  });

  it("URL 축종이 있으면 지역만 채운다", async () => {
    regionCookie = BUSAN;
    expect(await redirectOf({ species: "cat" })).toBe(`/?species=cat&region=${BUSAN}`);
  });

  it("쿠키 값이 깨져 있으면 조용히 무시한다", async () => {
    speciesCookie = "panda";
    regionCookie = "몰라";
    expect(await redirectOf({})).toBe("/home");
  });
});

describe("app/page: 축종과 지역이 다 있으면 그대로 그린다", () => {
  it("URL이 쿠키보다 우선이다(리다이렉트 없음)", async () => {
    speciesCookie = "dog";
    regionCookie = BUSAN;
    expect(await renderPage({ species: "cat", region: SEOUL })).toEqual({
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
    expect(await renderPage({ species: "cat", region: "all" })).toEqual({
      species: "cat",
      status: "protected",
      sort: "latest",
    });
  });

  it("focus는 filter가 아니라 focusId로 넘긴다", async () => {
    const element = await Page({
      searchParams: Promise.resolve({ species: "cat", region: SEOUL, focus: ID }),
    });
    expect((element.props as { focusId: unknown }).focusId).toBe(ID);
  });
});
