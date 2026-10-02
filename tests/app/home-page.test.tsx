/**
 * app/home/page.tsx: 축종 기억이 있어도 홈을 보여 주는지(결정 G1), 홈이 쓸 지역을 어떻게 정하는지(결정 G2).
 */
import { isValidElement } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import Page, { metadata } from "@/app/home/page";
import { REGION_COOKIE, SPECIES_COOKIE } from "@/features/animal-filter";
import { SpeciesPickerView } from "@/views/species-picker";

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

beforeEach(() => {
  speciesCookie = undefined;
  regionCookie = undefined;
});

const SEOUL = "6110000";
const BUSAN = "6260000";
const BUSAN_GEUMJEONG = "3350000";

type SearchParams = Record<string, string | string[] | undefined>;

async function renderHome(searchParams: SearchParams = {}) {
  const element = await Page({ searchParams: Promise.resolve(searchParams) });
  expect(isValidElement(element)).toBe(true);
  expect(element.type).toBe(SpeciesPickerView);
  return (element.props as { area: unknown }).area;
}

describe("app/home: 축종 기억이 있어도 보여 준다(결정 G1)", () => {
  it("축종 쿠키가 있어도 리다이렉트하지 않는다", async () => {
    speciesCookie = "dog";
    expect(await renderHome()).toEqual({ region: SEOUL });
  });

  it("문서 제목이 있다", () => {
    expect(metadata.title).toBe("어떤 친구를 볼까요 | 냥공고");
  });
});

describe("app/home: 홈이 쓸 지역(결정 G2)", () => {
  it("목록에서 넘겨받은 지역을 쓴다", async () => {
    regionCookie = SEOUL;
    expect(await renderHome({ region: BUSAN, district: BUSAN_GEUMJEONG })).toEqual({
      region: BUSAN,
      district: BUSAN_GEUMJEONG,
    });
  });

  it("넘겨받은 지역이 없으면 기억된 지역을 쓴다", async () => {
    regionCookie = BUSAN;
    expect(await renderHome()).toEqual({ region: BUSAN });
  });

  it("둘 다 없거나 쓸 수 없으면 기본 지역(서울 전체)이다", async () => {
    expect(await renderHome({ region: "9999999" })).toEqual({ region: SEOUL });
    regionCookie = "몰라";
    expect(await renderHome()).toEqual({ region: SEOUL });
  });

  it("전국도 지역이다", async () => {
    expect(await renderHome({ region: "all" })).toEqual({});
  });
});
