/**
 * 캐릭터 SVG는 두 벌이다: 원본(`docs/design/assets/characters/`, 디자인 시스템에서 동기화)과
 * 앱이 정지 그림으로 내려보내는 사본(`public/characters/`). 한쪽만 바뀌면 앱이 옛 그림을 쓰게 되므로 둘이 같은지 본다.
 * 원본 폴더에는 Rive용 다른 뷰(3/4·옆·뒤·눕기)와 들어올 때 자세, 기타 동물 셋(새·토끼·거북이)도 있지만, 앱이 정지 그림으로 쓰는 것은 정면 앉음 둘과 기타 동물 셋이다.
 * 정면 앉음 둘은 로딩 캐릭터(entities/animal/ui/loading-character.tsx)에 인라인 SVG로 한 벌 더 있다. 그림(요소, 순서, 모양, 색)은 앱 사본과 같고
 * 움직일 그룹을 감싼 것(data-loading-motion)과 id를 뺀 것만 다르다(handoff (j) L5).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { LoadingCharacter } from "@/entities/animal";

const ROOT = process.cwd();
const SOURCE_DIR = join(ROOT, "docs/design/assets/characters");
const PUBLIC_DIR = join(ROOT, "public/characters");
/** 앱이 쓰는 정지 그림(고양이·강아지 정면 앉음, 홈 기타 동물 카드의 새·토끼·거북이) */
const APP_FILES = ["nyang-bird.svg", "nyang-cat.svg", "nyang-dog.svg", "nyang-rabbit.svg", "nyang-turtle.svg"];

const svgFiles = (dir: string) => readdirSync(dir).filter((name) => name.endsWith(".svg")).sort();

describe("캐릭터 SVG 원본과 앱 사본", () => {
  it("앱 사본은 정면 앉음 둘과 기타 동물 셋뿐이고, 원본과 바이트 단위로 같다", () => {
    expect(svgFiles(PUBLIC_DIR)).toEqual(APP_FILES);
    for (const name of APP_FILES) {
      expect(readFileSync(join(PUBLIC_DIR, name)).equals(readFileSync(join(SOURCE_DIR, name))), name).toBe(true);
    }
  });

  it("원본에는 두 캐릭터의 6뷰(정면·3/4·옆·뒤·기우는 중간·누움)와 들어올 때 자세, 기타 동물 셋의 정면(characters.md)이 있다", () => {
    const views = ["", "-34", "-side", "-back", "-lie-mid", "-lie"];
    const entrance = ["cat-crouch", "cat-crouch-wiggle", "cat-pounce-air", "cat-pounce-land", "dog-play"].map((pose) => `nyang-${pose}.svg`);
    const others = ["bird", "rabbit", "turtle"].map((animal) => `nyang-${animal}.svg`);
    const expected = [...["cat", "dog"].flatMap((animal) => views.map((view) => `nyang-${animal}${view}.svg`)), ...entrance, ...others].sort();
    expect(svgFiles(SOURCE_DIR)).toEqual(expected);
  });
});

/** SVG 안쪽을 여닫는 태그의 차례로 편다. 속성은 이름순이고 id는 뺀다. 감싼 움직임 그룹(data-loading-motion)은 여닫는 태그를 함께 뺀다 */
function drawingTags(svg: string): string[] {
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>[\s\S]*$/, "");
  const tags: string[] = [];
  // 열린 g마다 감싼 그룹인지(닫는 태그를 뺄지)
  const wrappers: boolean[] = [];
  for (const [, close, name, rawAttrs, selfClose] of inner.matchAll(/<(\/?)(\w+)([^>]*?)(\/?)>/g)) {
    if (close) {
      if (!wrappers.pop()) tags.push(`</${name}>`);
      continue;
    }
    const attrs = [...rawAttrs.matchAll(/([\w:-]+)="([^"]*)"/g)].filter(([, key]) => key !== "id");
    const wrapper = attrs.some(([, key]) => key === "data-loading-motion");
    if (!wrapper) tags.push(`<${name} ${attrs.map(([, key, value]) => `${key}="${value}"`).sort().join(" ")}>`);
    if (selfClose) {
      if (!wrapper) tags.push(`</${name}>`);
    } else {
      wrappers.push(wrapper);
    }
  }
  return tags;
}

describe("로딩 캐릭터의 인라인 SVG와 앱 사본", () => {
  it.each(["cat", "dog"] as const)("%s: 감싼 그룹과 id 말고는 그림이 같다", (species) => {
    const inline = renderToStaticMarkup(<LoadingCharacter species={species} />);
    const source = readFileSync(join(PUBLIC_DIR, `nyang-${species}.svg`), "utf8");
    expect(inline).toContain(`viewBox="${/viewBox="([^"]*)"/.exec(source)![1]}"`);
    const tags = drawingTags(inline);
    expect(tags.length).toBeGreaterThan(20);
    expect(tags).toEqual(drawingTags(source));
    expect(inline.match(/data-loading-motion="\w+"/g)).toHaveLength(3);
  });
});
