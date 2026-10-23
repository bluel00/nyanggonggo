// @vitest-environment jsdom
/**
 * 제목 글꼴 Jua는 고정 문구 7개에만 쓴다(architecture.md 14.1). 데이터에서 오는 글자(상세 제목의 지역 이름 등)는 부분 글꼴에 없어
 * 섞여 보이므로 쓰면 안 된다. (1) 글꼴을 가져오는 파일과 쓰는 횟수를 고정하고, (2) 그 화면을 그려 Jua가 붙은 요소의 글자가
 * 고정 문구뿐인지 본다. 테스트에서 next/font/local은 고정 클래스 이름을 주는 stub이다(tests/stubs/next-font-local.ts).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { cleanup, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { SPECIES_COPY, type AnimalListFilter } from "@/entities/animal";
import { SERVICE_NAME } from "@/shared/config/service";
import { SpeciesPickerView } from "@/views/species-picker";
import { AnimalListHeader } from "@/widgets/animal-list/ui/animal-list-header";
import { NEXT_FONT_LOCAL_STUB_CLASS } from "../stubs/next-font-local";

afterEach(cleanup);

const SRC = join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(path);
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** Jua가 붙은 요소의 글자 */
function displayTexts(container: HTMLElement) {
  return [...container.querySelectorAll(`.${NEXT_FONT_LOCAL_STUB_CLASS}`)].map((element) => element.textContent);
}

describe("Jua를 쓰는 곳", () => {
  it("글꼴을 가져오는 곳은 DisplayText뿐이고, 쓰는 곳은 홈 서비스명·질문, 홈 고양이·강아지 라벨, 목록 제목뿐이다", () => {
    const files = sourceFiles(SRC).map((path) => [relative(SRC, path).replaceAll("\\", "/"), readFileSync(path, "utf8")] as const);
    const importers = files.filter(([, text]) => text.includes("display-font")).map(([path]) => path);
    expect(importers).toEqual(["shared/ui/display-text.tsx"]);
    const uses = Object.fromEntries(
      files
        .filter(([path, text]) => path !== "shared/ui/display-text.tsx" && text.includes("<DisplayText"))
        .map(([path, text]) => [path, text.split("<DisplayText").length - 1]),
    );
    expect(uses).toEqual({
      "views/species-picker/ui/species-picker-view.tsx": 2,
      "features/animal-filter/ui/species-choice.tsx": 1,
      "widgets/animal-list/ui/animal-list-header.tsx": 1,
    });
  });

  it("홈: 서비스명, 질문, 고양이·강아지 라벨만 Jua다(기타 링크·설명은 아니다)", () => {
    const { container } = render(<SpeciesPickerView area={{}} />);
    expect(displayTexts(container)).toEqual([SERVICE_NAME, "오늘은 누구를 보러 왔어요?", "고양이", "강아지"]);
  });

  it.each(["cat", "dog", "other"] as const)("목록 헤더(%s): 제목만 Jua다", (species) => {
    const filter: AnimalListFilter = { species, region: "6110000", status: "protected", sex: "all", sort: "latest" };
    const { container } = render(<AnimalListHeader filter={filter} actions={<button>필터</button>} />);
    expect(displayTexts(container)).toEqual([SPECIES_COPY[species].listTitle]);
  });
});
