import { describe, expect, it } from "vitest";
import type { Animal } from "@/entities/animal";
import { buildShareContent, resolveShareOrigin } from "./share-content";
import { makeAnimal } from "@tests/factories/animal";

const kst = (iso: string) => new Date(`${iso}+09:00`);
const IMG = "http://openapi.animal.go.kr/openapi/files/1%5B1%5D.jpg";
const animal = (overrides: Partial<Animal> = {}): Animal =>
  makeAnimal({ id: "450650202602282", images: [IMG], sex: "female", regionText: "제주특별자치도", shelterName: "제2동물보호센터", ...overrides });
const NOW = kst("2026-09-21T09:00:00");

describe("buildShareContent", () => {
  it("상세 링크, 지역 기반 제목, 공고 한 줄 요약 설명(보호소 이름 없음), 대표 사진의 프록시 절대 URL", () => {
    expect(buildShareContent(animal(), "https://nyang.test", NOW)).toEqual({
      url: "https://nyang.test/animals/450650202602282",
      title: "제주특별자치도 고양이",
      description: "암컷 · 나이 미상 · 보호중 · D-10",
      imageUrl: `https://nyang.test/api/image-proxy?src=${encodeURIComponent(IMG)}`,
    });
  });

  it("종료 공고는 상태 자리에 '종료'", () => {
    const content = buildShareContent(animal({ status: "ended", shelterName: null, species: "dog" }), "https://nyang.test", NOW);
    expect(content.title).toBe("제주특별자치도 강아지");
    expect(content.description).toBe("암컷 · 나이 미상 · 종료");
  });

  it("기타 공고는 제목에 실제 동물 이름을 쓴다", () => {
    const rabbit = animal({ species: "other", kindText: "토끼", regionText: "경기도 성남시" });
    expect(buildShareContent(rabbit, "https://nyang.test", NOW).title).toBe("경기도 성남시 토끼");
    const unknown = animal({ species: "other", kindText: null, regionText: "경기도 성남시" });
    expect(buildShareContent(unknown, "https://nyang.test", NOW).title).toBe("경기도 성남시 기타 동물");
  });

  it("사진이 없으면 OG 이미지를 썸네일로", () => {
    expect(buildShareContent(animal({ images: [] }), "https://nyang.test", NOW).imageUrl).toBe(
      "https://nyang.test/animals/450650202602282/opengraph-image",
    );
  });
});

describe("resolveShareOrigin", () => {
  it("NEXT_PUBLIC_SITE_URL이 있으면 그 값(끝 슬래시 제거), 없으면 현재 주소", () => {
    expect(resolveShareOrigin("http://localhost:3000", "https://nyang.example")).toBe("https://nyang.example");
    expect(resolveShareOrigin("http://localhost:3000", "https://nyang.example/")).toBe("https://nyang.example");
    expect(resolveShareOrigin("https://nyang.example", "")).toBe("https://nyang.example");
    expect(resolveShareOrigin("https://nyang.example", "   ")).toBe("https://nyang.example");
  });
});
