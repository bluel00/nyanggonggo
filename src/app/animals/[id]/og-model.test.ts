import { describe, expect, it } from "vitest";
import type { Animal } from "@/entities/animal";
import { buildOgModel, buildOgText } from "./og-model";

const kst = (iso: string) => new Date(`${iso}+09:00`);
const NOW = kst("2026-09-21T09:00:00");
const animal = (overrides: Partial<Animal> = {}): Animal => ({
  id: "1",
  species: "cat",
  images: ["http://openapi.animal.go.kr/openapi/files/1.jpg"],
  status: "protected",
  noticeEndAt: kst("2026-10-01T00:00:00"),
  sex: "female",
  ageText: null,
  regionText: "제주특별자치도",
  shelterName: "제2동물보호센터",
  foundPlaceText: "서귀포시",
  noticePeriodText: null,
  ...overrides,
});

describe("buildOgModel", () => {
  it("보호중 D-10: 배지는 상태만, D-day 따로, 제목은 지역, 보조는 보호소, 대표 사진", () => {
    expect(buildOgModel(animal(), NOW)).toEqual({
      title: "제주특별자치도",
      sub: "제2동물보호센터",
      speciesLabel: "고양이",
      variant: "protected",
      badgeText: "보호중",
      dDayText: "D-10",
      imageSrc: "http://openapi.animal.go.kr/openapi/files/1.jpg",
      ended: false,
    });
  });

  it("임박 당일은 D-day, 종료는 D-day 없음, 만료된 보호중도 D-day 없음", () => {
    expect(buildOgModel(animal({ noticeEndAt: kst("2026-09-21T00:00:00") }), NOW)).toMatchObject({ variant: "soon", badgeText: "임박", dDayText: "D-day" });
    expect(buildOgModel(animal({ status: "ended" }), NOW)).toMatchObject({ variant: "ended", badgeText: "종료", dDayText: null, ended: true });
    expect(buildOgModel(animal({ noticeEndAt: kst("2026-09-20T00:00:00") }), NOW)).toMatchObject({ badgeText: "보호중", dDayText: null });
  });

  it("보호소가 없으면 발견 장소, 사진이 없으면 null", () => {
    expect(buildOgModel(animal({ shelterName: null, images: [] }), NOW)).toMatchObject({ sub: "서귀포시", imageSrc: null });
  });
});

describe("buildOgText", () => {
  it("제목과 설명", () => {
    expect(buildOgText(buildOgModel(animal(), NOW), "냥공고")).toEqual({
      title: "제주특별자치도 고양이 공고 | 냥공고",
      description: "보호중 · D-10 · 제2동물보호센터",
    });
  });
});
