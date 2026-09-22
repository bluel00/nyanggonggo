/** app/animals/[id]/page.tsx: id 형식 검증 */
import { isValidElement } from "react";
import { describe, expect, it } from "vitest";
import Page from "@/app/animals/[id]/page";
import { AnimalDetailView } from "@/views/animal-detail";

describe("app/animals/[id]", () => {
  it("숫자 id면 상세 view에 넘긴다", async () => {
    const element = await Page({ params: Promise.resolve({ id: "450650202602282" }) });
    expect(isValidElement(element) && element.type).toBe(AnimalDetailView);
    expect((element.props as { id: string }).id).toBe("450650202602282");
  });

  it("형식이 다르면 notFound(조회하지 않음)", async () => {
    await expect(Page({ params: Promise.resolve({ id: "../etc" }) })).rejects.toThrow();
  });
});
