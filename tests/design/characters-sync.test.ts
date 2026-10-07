/**
 * 캐릭터 SVG는 두 벌이다: 원본(`docs/design/assets/characters/`, 디자인 시스템에서 동기화)과
 * 앱이 내려보내는 사본(`public/characters/`). 한쪽만 바뀌면 앱이 옛 그림을 쓰게 되므로 둘이 같은지 본다.
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SOURCE_DIR = join(ROOT, "docs/design/assets/characters");
const PUBLIC_DIR = join(ROOT, "public/characters");

const svgFiles = (dir: string) => readdirSync(dir).filter((name) => name.endsWith(".svg")).sort();

describe("캐릭터 SVG 원본과 앱 사본", () => {
  it("같은 파일들이 있고 내용이 바이트 단위로 같다", () => {
    const files = svgFiles(SOURCE_DIR);
    expect(files).toEqual(["nyang-cat.svg", "nyang-dog.svg"]);
    expect(svgFiles(PUBLIC_DIR)).toEqual(files);
    for (const name of files) {
      expect(readFileSync(join(PUBLIC_DIR, name)).equals(readFileSync(join(SOURCE_DIR, name))), name).toBe(true);
    }
  });
});
