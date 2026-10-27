/**
 * 캐릭터 SVG는 두 벌이다: 원본(`docs/design/assets/characters/`, 디자인 시스템에서 동기화)과
 * 앱이 정지 그림으로 내려보내는 사본(`public/characters/`). 한쪽만 바뀌면 앱이 옛 그림을 쓰게 되므로 둘이 같은지 본다.
 * 원본 폴더에는 Rive용 다른 뷰(3/4·옆·뒤·눕기)와 들어올 때 자세, 기타 동물 셋(새·토끼·거북이)도 있지만, 앱이 정지 그림으로 쓰는 것은 정면 앉음 둘과 기타 동물 셋이다.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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
