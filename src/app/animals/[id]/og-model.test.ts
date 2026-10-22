import { describe, expect, it } from "vitest";
import type { Animal } from "@/entities/animal";
import { buildShareContent } from "@/features/animal-share";
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
  shelterAddressText: null,
  shelterTelText: null,
  noticePeriodText: null,
  specialMarkText: null,
  kindText: null,
  ...overrides,
});

describe("buildOgModel", () => {
  it("보호중 D-10: 배지는 상태만, D-day 따로, 제목은 지역, 보조는 보호소, 대표 사진", () => {
    expect(buildOgModel(animal(), NOW)).toEqual({
      title: "제주특별자치도",
      region: "제주특별자치도",
      sub: "제2동물보호센터",
      speciesLabel: "고양이",
      variant: "protected",
      badgeText: "보호중",
      dDayText: "D-10",
      imageSrc: "http://openapi.animal.go.kr/openapi/files/1.jpg",
      ended: false,
      description: "암컷 · 나이 미상 · 보호중 · D-10",
    });
  });

  it("기타 공고는 speciesLabel이 실제 동물 이름이고, 이미지 제목에도 동물이 들어간다", () => {
    expect(buildOgModel(animal({ species: "other", kindText: "토끼" }), NOW)).toMatchObject({
      speciesLabel: "토끼",
      // 이미지 제목은 카드 1줄과 같다. 링크 미리보기 제목은 "<지역> <동물> 공고"라 region을 따로 쓴다
      title: "토끼 · 제주특별자치도",
      region: "제주특별자치도",
    });
    expect(buildOgModel(animal({ species: "other", kindText: null }), NOW)).toMatchObject({
      speciesLabel: "기타 동물",
      title: "기타 동물 · 제주특별자치도",
    });
    const text = buildOgText(buildOgModel(animal({ species: "other", kindText: "토끼" }), NOW), "냥공고");
    expect(text.title).toBe("제주특별자치도 토끼 공고 | 냥공고");
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
  it("제목은 그대로, 설명은 공고 한 줄 요약(성별 · 나이 · 상태 · 특이사항, 보호소 이름 없음)", () => {
    // 특이사항은 지어낸 문장이다
    expect(buildOgText(buildOgModel(animal({ ageText: "2024(년생)", specialMarkText: "검은 코,\n조용한 편" }), NOW), "냥공고")).toEqual({
      title: "제주특별자치도 고양이 공고 | 냥공고",
      description: "암컷 · 2024(년생) · 보호중 · D-10 · 검은 코, 조용한 편",
    });
  });

  it("링크 미리보기 설명은 카카오 공유 카드 설명과 같은 문자열이다", () => {
    const cases = [
      animal({ specialMarkText: "꼬리가 짧고\n  잘 웃는 얼굴" }),
      animal({ status: "ended", sex: "unknown" }),
      animal({ ageText: "2026(60일미만)(년생)", specialMarkText: "   " }),
    ];
    for (const a of cases) {
      expect(buildOgText(buildOgModel(a, NOW), "냥공고").description).toBe(buildShareContent(a, "https://nyang.test", NOW).description);
    }
  });
});
