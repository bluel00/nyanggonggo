import { describe, expect, it } from "vitest";
import { DISTRICT_ALIASES, DISTRICTS, findDistrict, findSido, resolveDistrict, SIDO } from "./regions";

describe("정적 지역 데이터(2026-09-22 실측)", () => {
  it("시도 16개, 시군구 235개, 모든 코드는 7자리 숫자이고 전체에서 중복이 없다", () => {
    expect(SIDO).toHaveLength(16);
    const districts = Object.values(DISTRICTS).flat();
    expect(districts).toHaveLength(235);
    const codes = [...SIDO.map((s) => s.code), ...districts.map((d) => d.code)];
    for (const code of codes) expect(code).toMatch(/^\d{7}$/);
    expect(new Set(codes).size).toBe(codes.length);
  });

  it("모든 시도에 시군구 목록(빈 배열 포함)이 있다", () => {
    for (const sido of SIDO) expect(DISTRICTS[sido.code]).toBeDefined();
    expect(Object.keys(DISTRICTS).sort()).toEqual(SIDO.map((s) => s.code).sort());
  });

  it("실제 구가 아닌 항목(시도 자기 자신, ddd99dd 코드, 이름 없음)이 남아 있지 않다", () => {
    for (const sido of SIDO) {
      for (const district of DISTRICTS[sido.code]) {
        expect(district.code).not.toBe(sido.code);
        expect(district.code).not.toMatch(/^\d{3}99\d{2}$/);
        expect(district.name.trim()).not.toBe("");
        expect(district.name).not.toBe("가정보호");
      }
    }
  });

  it("기본 지역(서울/종로구)이 있고, 강원·전북은 특별자치도 코드, 세종은 시군구가 없다", () => {
    expect(findSido("6110000")?.name).toBe("서울특별시");
    expect(findDistrict("6110000", "3000000")?.name).toBe("종로구");
    expect(findSido("6530000")?.name).toBe("강원특별자치도");
    expect(findSido("6540000")?.name).toBe("전북특별자치도");
    expect(findSido("6420000")).toBeNull();
    expect(DISTRICTS["5690000"]).toEqual([]);
  });

  it("같은 시도 안에 이름이 같은 시군구가 없다(필터에서 구분할 수 없는 항목이 생기지 않게)", () => {
    for (const sido of SIDO) {
      const names = DISTRICTS[sido.code].map((district) => district.name);
      const duplicated = names.filter((name, index) => names.indexOf(name) !== index);
      expect(duplicated, sido.name).toEqual([]);
    }
  });

  it("경상남도에 창원시는 5670000 하나뿐이다(12절 41)", () => {
    const changwon = DISTRICTS["6480000"].filter((district) => district.name.includes("창원"));
    expect(changwon).toEqual([{ code: "5670000", name: "창원시" }]);
  });

  it("findDistrict는 시도에 속한 시군구만 찾는다", () => {
    expect(findDistrict("6260000", "3000000")).toBeNull();
    expect(findDistrict(undefined, "3000000")).toBeNull();
  });
});

describe("DISTRICT_ALIASES / resolveDistrict(목록에서 뺀 옛 시군구 코드)", () => {
  it("별칭의 옛 코드는 목록에 없고, 대신 쓰는 코드는 같은 시도에 있다", () => {
    for (const [sidoCode, aliases] of Object.entries(DISTRICT_ALIASES)) {
      for (const [from, to] of Object.entries(aliases)) {
        expect(findDistrict(sidoCode, from), from).toBeNull();
        expect(findDistrict(sidoCode, to), to).not.toBeNull();
      }
    }
  });

  it.each(["5280000", "5320000"])("창원시 옛 코드 %s는 5670000으로 찾는다", (code) => {
    expect(resolveDistrict("6480000", code)).toEqual({ code: "5670000", name: "창원시" });
    expect(findDistrict("6480000", code)).toBeNull();
  });

  it("별칭이 없는 코드는 findDistrict와 같다", () => {
    expect(resolveDistrict("6110000", "3000000")?.name).toBe("종로구");
    expect(resolveDistrict("6110000", "9999999")).toBeNull();
    expect(resolveDistrict("6260000", "5280000")).toBeNull(); // 다른 시도에서는 별칭을 쓰지 않는다
    expect(resolveDistrict(undefined, "5280000")).toBeNull();
  });
});
