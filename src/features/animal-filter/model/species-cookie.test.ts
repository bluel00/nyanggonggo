import { describe, expect, it, vi } from "vitest";
import { parseSpeciesCookie, rememberSpecies, SPECIES_COOKIE } from "./species-cookie";

describe("parseSpeciesCookie", () => {
  it.each(["cat", "dog", "other"] as const)("아는 축종 %j은 그대로", (value) => {
    expect(parseSpeciesCookie(value)).toBe(value);
  });

  it.each([undefined, null, "", "panda", "CAT", " cat", "cat,dog"])(
    "모르는 값 %j은 null(조용히 무시하고 홈으로 간다)",
    (value) => {
      expect(parseSpeciesCookie(value)).toBeNull();
    },
  );
});

describe("rememberSpecies", () => {
  it("지역 쿠키와 같은 속성(path, max-age, SameSite)으로 쓴다", () => {
    const written: string[] = [];
    vi.stubGlobal("document", {
      set cookie(value: string) {
        written.push(value);
      },
    });
    try {
      rememberSpecies("other");
    } finally {
      vi.unstubAllGlobals();
    }
    expect(written).toEqual([`${SPECIES_COOKIE}=other; path=/; max-age=31536000; SameSite=Lax`]);
  });
});
