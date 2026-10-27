import { describe, expect, it } from "vitest";
import type { Animal } from "@/entities/animal";
import { buildShareContent } from "@/features/animal-share";
import { buildOgModel, buildOgText } from "./og-model";
import { makeAnimal } from "@tests/factories/animal";

const kst = (iso: string) => new Date(`${iso}+09:00`);
const NOW = kst("2026-09-21T09:00:00");
const animal = (overrides: Partial<Animal> = {}): Animal =>
  makeAnimal({
    images: ["http://openapi.animal.go.kr/openapi/files/1.jpg"],
    sex: "female",
    regionText: "제주특별자치도",
    shelterName: "제2동물보호센터",
    foundPlaceText: "서귀포시",
    ...overrides,
  });

describe("buildOgModel", () => {
  it("보호중 D-10: 배지는 상태만, 마감은 날짜로 따로, 제목은 지역, 보조는 보호소, 대표 사진. 공유 내용을 함께 담는다", () => {
    expect(buildOgModel(animal(), NOW, "https://nyang.test")).toEqual({
      title: "제주특별자치도",
      sub: "제2동물보호센터",
      variant: "protected",
      badgeText: "보호중",
      deadlineText: "공고 마감 10월 1일(목)",
      imageSrc: "http://openapi.animal.go.kr/openapi/files/1.jpg",
      ended: false,
      share: buildShareContent(animal(), { origin: "https://nyang.test", now: NOW }),
    });
  });

  it("기타 공고는 이미지 제목에 동물이 들어가고, 링크 미리보기 제목 바탕(공유 내용)에도 실제 동물 이름이 들어간다", () => {
    // 이미지 제목은 카드 1줄과 같다. 링크 미리보기 제목은 공유 내용의 제목 바탕("<지역> <동물>") + " 공고 | 서비스 이름"
    expect(buildOgModel(animal({ species: "other", kindText: "토끼" }), NOW)).toMatchObject({
      title: "토끼 · 제주특별자치도",
      share: { title: "제주특별자치도 토끼" },
    });
    expect(buildOgModel(animal({ species: "other", kindText: null }), NOW)).toMatchObject({
      title: "기타 동물 · 제주특별자치도",
      share: { title: "제주특별자치도 기타 동물" },
    });
    const text = buildOgText(buildOgModel(animal({ species: "other", kindText: "토끼" }), NOW), "멍냥공고");
    expect(text.title).toBe("제주특별자치도 토끼 공고 | 멍냥공고");
  });

  it("당일도 날짜(배지는 '보호중', 색은 마감 가까움), 종료·만료된 보호중은 마감 표기 없음", () => {
    expect(buildOgModel(animal({ noticeEndAt: kst("2026-09-21T00:00:00") }), NOW)).toMatchObject({ variant: "nearDeadline", badgeText: "보호중", deadlineText: "공고 마감 9월 21일(월)" });
    expect(buildOgModel(animal({ status: "ended" }), NOW)).toMatchObject({ variant: "ended", badgeText: "종료", deadlineText: null, ended: true });
    expect(buildOgModel(animal({ noticeEndAt: kst("2026-09-20T00:00:00") }), NOW)).toMatchObject({ badgeText: "보호중", deadlineText: null });
  });

  it("보호소가 없으면 발견 장소, 사진이 없으면 null", () => {
    expect(buildOgModel(animal({ shelterName: null, images: [] }), NOW)).toMatchObject({ sub: "서귀포시", imageSrc: null });
  });
});

describe("buildOgText", () => {
  it("제목은 그대로, 설명은 공고 한 줄 요약(성별 · 나이 · 상태 · 특이사항, 보호소 이름 없음)", () => {
    // 특이사항은 지어낸 문장이다
    expect(buildOgText(buildOgModel(animal({ ageText: "2024(년생)", specialMarkText: "검은 코,\n조용한 편" }), NOW), "멍냥공고")).toEqual({
      title: "제주특별자치도 고양이 공고 | 멍냥공고",
      description: "암컷 · 2024(년생) · 보호중 · 공고 마감 10월 1일(목) · 검은 코, 조용한 편",
    });
  });

  it("링크 미리보기 설명은 공유 카드 설명과 같은 공유 요약이다", () => {
    const cases = [
      animal({ specialMarkText: "꼬리가 짧고\n  잘 웃는 얼굴" }),
      animal({ status: "ended", sex: "unknown" }),
      animal({ ageText: "2026(60일미만)(년생)", specialMarkText: "   " }),
    ];
    for (const a of cases) {
      expect(buildOgText(buildOgModel(a, NOW), "멍냥공고").description).toBe(buildShareContent(a, { origin: "https://nyang.test", now: NOW }).summary);
    }
  });
});
