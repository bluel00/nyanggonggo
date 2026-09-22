import { describe, expect, it } from "vitest";
import type { Animal } from "@/entities/animal";
import { buildShareContent } from "./share-content";

const kst = (iso: string) => new Date(`${iso}+09:00`);
const IMG = "http://openapi.animal.go.kr/openapi/files/1%5B1%5D.jpg";
const animal = (overrides: Partial<Animal> = {}): Animal => ({
  id: "450650202602282",
  species: "cat",
  images: [IMG],
  status: "protected",
  noticeEndAt: kst("2026-10-01T00:00:00"),
  sex: "female",
  ageText: null,
  regionText: "제주특별자치도",
  shelterName: "제2동물보호센터",
  foundPlaceText: null,
  noticePeriodText: null,
  ...overrides,
});
const NOW = kst("2026-09-21T09:00:00");

describe("buildShareContent", () => {
  it("상세 링크, 지역 기반 제목, 상태·보호소 설명, 대표 사진의 프록시 절대 URL", () => {
    expect(buildShareContent(animal(), "https://nyang.test", NOW)).toEqual({
      url: "https://nyang.test/animals/450650202602282",
      title: "제주특별자치도 고양이",
      description: "보호중 · D-10 · 제2동물보호센터",
      imageUrl: `https://nyang.test/api/image-proxy?src=${encodeURIComponent(IMG)}`,
    });
  });

  it("종료 공고는 '종료', 보호소가 없으면 설명에서 뺀다", () => {
    const content = buildShareContent(animal({ status: "ended", shelterName: null, species: "dog" }), "https://nyang.test", NOW);
    expect(content.title).toBe("제주특별자치도 강아지");
    expect(content.description).toBe("종료");
  });

  it("사진이 없으면 OG 이미지를 썸네일로", () => {
    expect(buildShareContent(animal({ images: [] }), "https://nyang.test", NOW).imageUrl).toBe(
      "https://nyang.test/animals/450650202602282/opengraph-image",
    );
  });
});
