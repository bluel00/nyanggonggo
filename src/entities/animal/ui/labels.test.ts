import { describe, expect, it } from "vitest";
import type { Animal } from "../model/animal";
import { ANIMAL_COPY, animalSummaryText, animalTitle, SEX_LABEL, sexAgeText, SPECIES_COPY, SPECIES_LABEL, speciesText } from "./labels";

const SPECIES: Animal["species"][] = ["cat", "dog", "other"];

describe("축종 문구", () => {
  it("모든 축종에 라벨과 문구가 있다", () => {
    for (const species of SPECIES) {
      expect(SPECIES_LABEL[species], species).toBeTruthy();
      const copy = SPECIES_COPY[species];
      expect(Object.values(copy).every((text) => typeof text === "string" && text.length > 0), species).toBe(true);
    }
    expect(Object.keys(SPECIES_COPY).sort()).toEqual([...SPECIES].sort());
  });

  it("문구에 조사가 바르게 붙어 있다(라벨 + 템플릿으로 만들지 않는다)", () => {
    for (const species of SPECIES) {
      const { emptyTitle, errorTitle } = SPECIES_COPY[species];
      expect(emptyTitle, species).toMatch(/[가이] 없어요$/);
      expect(errorTitle, species).toMatch(/[를을] 불러오지 못했어요$/);
    }
  });

  it("축종 중립 문구에는 축종 이름이 없다(찜 목록은 축종이 섞인다)", () => {
    for (const [key, text] of Object.entries(ANIMAL_COPY)) {
      for (const label of Object.values(SPECIES_LABEL)) {
        expect(text, `${key}에 "${label}"이 들어 있다`).not.toContain(label);
      }
    }
  });

  it("성별 라벨은 세 가지다", () => {
    expect(Object.keys(SEX_LABEL).sort()).toEqual(["female", "male", "unknown"]);
  });
});

describe("speciesText", () => {
  it("고양이와 강아지는 축종 라벨이다(kindText는 쓰지 않는다)", () => {
    expect(speciesText({ species: "cat", kindText: "한국 고양이" })).toBe("고양이");
    expect(speciesText({ species: "dog", kindText: "믹스견" })).toBe("강아지");
  });

  it("기타 축종은 실제 동물 이름을 쓴다", () => {
    expect(speciesText({ species: "other", kindText: "토끼" })).toBe("토끼");
    expect(speciesText({ species: "other", kindText: "앵무새" })).toBe("앵무새");
  });

  it("기타인데 동물 이름이 없으면 기본 라벨", () => {
    expect(speciesText({ species: "other", kindText: null })).toBe("기타 동물");
  });
});

describe("animalTitle", () => {
  const region = "서울특별시 성동구";

  it("고양이와 강아지는 지역만 쓴다", () => {
    expect(animalTitle({ species: "cat", kindText: "한국 고양이", regionText: region })).toBe(region);
    expect(animalTitle({ species: "dog", kindText: "믹스견", regionText: region })).toBe(region);
  });

  it("기타 축종은 어떤 동물인지를 지역 앞에 붙인다", () => {
    expect(animalTitle({ species: "other", kindText: "토끼", regionText: region })).toBe(`토끼 · ${region}`);
    expect(animalTitle({ species: "other", kindText: null, regionText: region })).toBe(`기타 동물 · ${region}`);
  });
});

describe("sexAgeText (상세 제목 아래 줄)", () => {
  it("성별 · 나이, 모르면 '성별 미상' · '나이 미상'", () => {
    expect(sexAgeText({ sex: "female", ageText: "2026(60일미만)(년생)" })).toBe("암컷 · 2026(60일미만)(년생)");
    expect(sexAgeText({ sex: "unknown", ageText: null })).toBe("성별 미상 · 나이 미상");
  });
});

describe("animalSummaryText (공유 카드·링크 미리보기 설명)", () => {
  const kst = (iso: string) => new Date(`${iso}+09:00`);
  const NOW = kst("2026-09-21T09:00:00");
  // 특이사항은 지어낸 문장이다
  const animal = (overrides: Partial<Animal> = {}): Animal => ({
    id: "1",
    species: "cat",
    images: [],
    status: "protected",
    noticeEndAt: kst("2026-09-29T00:00:00"),
    sex: "female",
    ageText: "2026(60일미만)(년생)",
    regionText: "제주특별자치도",
    shelterName: "가상 보호소",
    foundPlaceText: null,
    shelterAddressText: null,
    shelterTelText: null,
    noticePeriodText: null,
    specialMarkText: "줄무늬 꼬리, 사람을 잘 따름",
    kindText: null,
    ...overrides,
  });

  it("보호 중: 성별 · 나이 · 상태 · D-N · 특이사항, 보호소 이름은 없다", () => {
    expect(animalSummaryText(animal(), NOW)).toBe("암컷 · 2026(60일미만)(년생) · 보호중 · D-8 · 줄무늬 꼬리, 사람을 잘 따름");
  });

  it("종료: 상태 자리에 '종료', D-N 없음", () => {
    expect(animalSummaryText(animal({ status: "ended" }), NOW)).toBe("암컷 · 2026(60일미만)(년생) · 종료 · 줄무늬 꼬리, 사람을 잘 따름");
  });

  it("성별 미상·나이 미상은 상세와 같은 표기", () => {
    expect(animalSummaryText(animal({ sex: "unknown" }), NOW)).toMatch(/^성별 미상 · 2026/);
    expect(animalSummaryText(animal({ ageText: null }), NOW)).toMatch(/^암컷 · 나이 미상 · 보호중/);
  });

  it("특이사항이 비어 있으면(없음·공백뿐) 그 항목을 뺀다", () => {
    expect(animalSummaryText(animal({ specialMarkText: null }), NOW)).toBe("암컷 · 2026(60일미만)(년생) · 보호중 · D-8");
    expect(animalSummaryText(animal({ specialMarkText: "  \n " }), NOW)).toBe("암컷 · 2026(60일미만)(년생) · 보호중 · D-8");
  });

  it("특이사항의 줄바꿈과 연속 공백은 공백 하나로, 내용은 그대로(자르지 않는다)", () => {
    const long = "앞발에 흰 양말 무늬.\n\n  겁이 조금 있지만   간식을 주면 다가옴.\r\n".repeat(5);
    const text = animalSummaryText(animal({ specialMarkText: long }), NOW);
    const oneLine = "앞발에 흰 양말 무늬. 겁이 조금 있지만 간식을 주면 다가옴.";
    expect(text).toBe(`암컷 · 2026(60일미만)(년생) · 보호중 · D-8 · ${Array(5).fill(oneLine).join(" ")}`);
    expect(text).not.toMatch(/[\r\n]| {2}/);
  });
});
