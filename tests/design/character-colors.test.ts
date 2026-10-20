/**
 * 캐릭터 선 색(characters.md 방향 A, 2026-10-14): 선(stroke)은 #3A2A20이고 #111111이 남지 않는다. 채움 #111111은 눈과 강아지 코에만 있다.
 * 원본 SVG(docs/design/assets/characters)와, 그것으로 만든 Rive 장면(rive/nyang-characters/scene.rml, `pnpm rive:build`)을 함께 본다.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SOURCE_DIR = join(ROOT, "docs/design/assets/characters");
const svgs = readdirSync(SOURCE_DIR)
  .filter((name) => name.endsWith(".svg"))
  .map((name) => ({ name, text: readFileSync(join(SOURCE_DIR, name), "utf8") }));

/** fill="#111111"인 도형마다 감싼 그룹 id들(바깥 → 안)과 도형 id */
function darkFills(svg: string): string[] {
  const stack: string[] = [];
  const found: string[] = [];
  for (const [, close, tag, attrs] of svg.matchAll(/<(\/?)(g|path|circle|ellipse|rect)\b([^>]*?)\/?>/g)) {
    if (tag === "g") {
      if (close) stack.pop();
      else stack.push(/id="([^"]+)"/.exec(attrs)?.[1] ?? "");
      continue;
    }
    if (!close && /fill="#111111"/i.test(attrs)) found.push([...stack, /id="([^"]+)"/.exec(attrs)?.[1] ?? tag].join(">"));
  }
  return found;
}

describe("캐릭터 SVG 원본의 색", () => {
  it("17개 파일 모두 선에 #111111이 남지 않고, 선 색은 #3A2A20이다", () => {
    expect(svgs).toHaveLength(17);
    for (const { name, text } of svgs) {
      expect(text, name).not.toMatch(/stroke="#111111"/i);
      expect(text, name).toMatch(/stroke="#3A2A20"/);
    }
  });

  it("채움 #111111은 눈(eyes-*)과 강아지 코(nose)에만 있다", () => {
    for (const { name, text } of svgs) {
      for (const path of darkFills(text)) {
        expect(path, name).toMatch(/(^|>)eyes-[a-z]+(>|$)|(^|>)nose$/);
      }
    }
    // 정면 앉음(정지 그림)에는 눈과 강아지 코가 실제로 있다
    expect(darkFills(svgs.find((s) => s.name === "nyang-cat.svg")!.text).length).toBeGreaterThan(0);
    expect(darkFills(svgs.find((s) => s.name === "nyang-dog.svg")!.text).some((path) => path.endsWith("nose"))).toBe(true);
  });
});

describe("Rive 장면(scene.rml)의 색", () => {
  const rml = readFileSync(join(ROOT, "rive/nyang-characters/scene.rml"), "utf8");
  it("선(Stroke)에 #111111이 없고 #3A2A20이다. #111111은 채움(Fill)에만 남는다", () => {
    const strokeColors = [...rml.matchAll(/<Stroke\b[^>]*>\s*<SolidColor colorValue="([0-9A-F]{8})"/g)].map((m) => m[1]);
    expect(strokeColors.length).toBeGreaterThan(0);
    expect(strokeColors).not.toContain("FF111111");
    expect(strokeColors).toContain("FF3A2A20");
    const fillDark = [...rml.matchAll(/<Fill\b[^>]*>\s*<SolidColor colorValue="FF111111"/g)].length;
    expect(fillDark).toBe([...rml.matchAll(/colorValue="FF111111"/g)].length);
  });
});
