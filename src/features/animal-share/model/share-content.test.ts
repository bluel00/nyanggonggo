import { describe, expect, it } from "vitest";
import type { Animal } from "@/entities/animal";
import { buildShareContent } from "./share-content";
import { makeAnimal } from "@tests/factories/animal";

const kst = (iso: string) => new Date(`${iso}+09:00`);
const IMG = "http://openapi.animal.go.kr/openapi/files/1%5B1%5D.jpg";
const animal = (overrides: Partial<Animal> = {}): Animal =>
  makeAnimal({ id: "450650202602282", images: [IMG], sex: "female", regionText: "제주특별자치도", shelterName: "제2동물보호센터", ...overrides });
const NOW = kst("2026-09-21T09:00:00");
const at = { origin: "https://nyang.test", now: NOW };

describe("buildShareContent: 공유 내용 계약", () => {
  it("제목 바탕(지역 + 동물), 공유 요약(보호소 이름 없음), 대표 사진 원본, 상세 경로와 절대 주소", () => {
    expect(buildShareContent(animal(), at)).toEqual({
      title: "제주특별자치도 고양이",
      summary: "암컷 · 나이 미상 · 보호중 · 공고 마감 10월 1일(목)",
      photoSrc: IMG,
      path: "/animals/450650202602282",
      url: "https://nyang.test/animals/450650202602282",
    });
  });

  it("종료 공고는 요약의 상태 자리에 '종료'", () => {
    const content = buildShareContent(animal({ status: "ended", shelterName: null, species: "dog" }), at);
    expect(content.title).toBe("제주특별자치도 강아지");
    expect(content.summary).toBe("암컷 · 나이 미상 · 종료");
  });

  it("기타 공고는 제목 바탕에 실제 동물 이름을 쓴다", () => {
    const rabbit = animal({ species: "other", kindText: "토끼", regionText: "경기도 성남시" });
    expect(buildShareContent(rabbit, at).title).toBe("경기도 성남시 토끼");
    const unknown = animal({ species: "other", kindText: null, regionText: "경기도 성남시" });
    expect(buildShareContent(unknown, at).title).toBe("경기도 성남시 기타 동물");
  });

  it("사진이 없으면 photoSrc는 null(대신 쓸 이미지는 출력 쪽이 정한다)", () => {
    expect(buildShareContent(animal({ images: [] }), at).photoSrc).toBeNull();
  });

  it("요약의 마감은 날짜다. 기준 시각으로 마감이 지났는지만 본다(지났으면 날짜를 붙이지 않는다)", () => {
    expect(buildShareContent(animal(), { ...at, now: kst("2026-09-30T23:59:00") }).summary).toBe("암컷 · 나이 미상 · 보호중 · 공고 마감 10월 1일(목)");
    expect(buildShareContent(animal(), { ...at, now: kst("2026-10-02T00:00:00") }).summary).toBe("암컷 · 나이 미상 · 보호중");
  });
});
