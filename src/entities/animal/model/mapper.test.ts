import { describe, expect, it } from "vitest";
import type { AnimalWireDto } from "@/contract/animals";
import { toAnimal } from "./mapper";

const wire: AnimalWireDto = {
  id: "450650202602282",
  species: "cat",
  images: ["http://a.test/1.jpg", "http://a.test/2%5B1%5D.jpg"],
  status: "protected",
  noticeEndDate: "2026-10-01",
  sex: "female",
  ageText: "2024(년생)",
  regionText: "제주특별자치도",
  shelterName: "제2동물보호센터",
  foundPlaceText: "서귀포시 남원읍 의귀리1537",
  noticePeriodText: "09.21 ~ 10.01",
  specialMarkText: null,
  kindText: null,
};

describe("toAnimal", () => {
  it("noticeEndDate를 그날 00:00 KST의 Date로 바꾼다", () => {
    const animal = toAnimal(wire);
    expect(animal.noticeEndAt).toBeInstanceOf(Date);
    expect(animal.noticeEndAt?.toISOString()).toBe("2026-09-30T15:00:00.000Z");
  });

  it("noticeEndDate가 null이거나 형식이 다르면 null", () => {
    expect(toAnimal({ ...wire, noticeEndDate: null }).noticeEndAt).toBeNull();
    expect(toAnimal({ ...wire, noticeEndDate: "20261001" }).noticeEndAt).toBeNull();
    expect(toAnimal({ ...wire, noticeEndDate: "2026-13-45" }).noticeEndAt).toBeNull();
  });

  it.each([
    ["값이 있으면 앞뒤 공백만 제거", "  보호센터 내 출산 ", "보호센터 내 출산"],
    ["빈 문자열은 null", "", null],
    ["공백뿐이면 null", "   ", null],
    ["null은 null", null, null],
  ] as [string, string | null, string | null][])("특이사항: %s", (_label, input, expected) => {
    expect(toAnimal({ ...wire, specialMarkText: input }).specialMarkText).toBe(expected);
  });

  it("나머지 필드는 그대로 옮기고 images는 복사한다", () => {
    const animal = toAnimal(wire);
    const { noticeEndDate: _d, ...rest } = wire;
    const { noticeEndAt: _a, ...animalRest } = animal;
    expect(animalRest).toEqual(rest);
    expect(animal.images).not.toBe(wire.images);
  });
});
