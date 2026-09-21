import { describe, expect, it } from "vitest";
import fixture from "../../../docs/fixtures/upstream-items.json";
import { UpstreamAnimalItemSchema } from "./dto";

const [first] = fixture.items;

describe("UpstreamAnimalItemSchema", () => {
  it("픽스처 6건을 모두 파싱한다", () => {
    expect(fixture.items).toHaveLength(6);
    for (const item of fixture.items) {
      expect(UpstreamAnimalItemSchema.safeParse(item).success).toBe(true);
    }
  });

  it("optional 필드(sfeSoci, vaccinationChk)가 있어도 없어도 통과한다", () => {
    const withSfeSoci = fixture.items.find((i) => "sfeSoci" in i);
    const withVaccination = fixture.items.find((i) => "vaccinationChk" in i);
    expect(withSfeSoci).toBeDefined();
    expect(withVaccination).toBeDefined();
    expect(UpstreamAnimalItemSchema.parse(withSfeSoci).sfeSoci).toBeTypeOf("string");
    expect(UpstreamAnimalItemSchema.parse(withVaccination).vaccinationChk).toBeTypeOf("string");

    const parsed = UpstreamAnimalItemSchema.parse(first);
    expect(parsed.sfeSoci).toBeUndefined();
    expect(parsed.vaccinationChk).toBeUndefined();
    expect(parsed.sfeHealth).toBeUndefined();
    expect(parsed.endReason).toBeUndefined();
  });

  it("사진이 없어도 통과한다", () => {
    const { popfile1: _p1, popfile2: _p2, ...noPhoto } = first;
    expect(UpstreamAnimalItemSchema.safeParse(noPhoto).success).toBe(true);
  });

  it("스키마에 없는 필드가 들어와도 파싱이 깨지지 않는다", () => {
    const result = UpstreamAnimalItemSchema.safeParse({
      ...first,
      brandNewField: "x",
      nested: { a: 1 },
    });
    expect(result.success).toBe(true);
  });

  it.each(["desertionNo", "processState", "noticeEdt", "orgNm"] as const)(
    "필수 필드 %s가 없으면 실패한다",
    (key) => {
      const { [key]: _omitted, ...rest } = first;
      expect(UpstreamAnimalItemSchema.safeParse(rest).success).toBe(false);
    },
  );

  it("값이 문자열이 아니면 실패한다(변환하지 않는다)", () => {
    const result = UpstreamAnimalItemSchema.safeParse({ ...first, desertionNo: 450650202602282 });
    expect(result.success).toBe(false);
  });

  it("processState는 enum이 아니라 임의 문자열을 받는다", () => {
    const result = UpstreamAnimalItemSchema.safeParse({ ...first, processState: "반환" });
    expect(result.success).toBe(true);
  });
});
