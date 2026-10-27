/**
 * 문서가 적은 코드 위치가 맞다(#61). 함수를 옮기고 문서를 고치지 않으면 낡은 위치가 남는다
 * (architecture.md 10절이 #49 뒤에도 `statusBadgeText`를 `status-badge.tsx`에 있다고 적었다).
 * 두 꼴만 본다: "`이름`(`경로`" 와 "`경로`의 `이름`". 경로는 `src/`를 빼고 적어도 된다. 지운 줄(~~)은 기록이라 보지 않는다.
 * 이름은 그 파일에서 정의돼야 한다(선언, 또는 객체·스키마의 키. 가져다 쓰는 것만으로는 안 된다).
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const DOCS = ["docs/architecture.md", "docs/glossary.md"];
const NAME_THEN_PATH = /`([A-Za-z_]\w*)`\(`?((?:src\/)?[a-z-]+\/[\w/.[\]-]+\.tsx?)/g;
const PATH_THEN_NAME = /`((?:src\/)?[a-z-]+\/[\w/.[\]-]+\.tsx?)`의 `([A-Za-z_]\w*)`/g;

function refs(doc: string) {
  return readFileSync(join(ROOT, doc), "utf8")
    .split("\n")
    .flatMap((line, i) =>
      line.includes("~~")
        ? []
        : [
            ...[...line.matchAll(NAME_THEN_PATH)].map((m) => ({ name: m[1], path: m[2] })),
            ...[...line.matchAll(PATH_THEN_NAME)].map((m) => ({ name: m[2], path: m[1] })),
          ].map((ref) => ({ ...ref, at: `${doc}:${i + 1}` })),
    );
}

function definedIn(path: string, name: string): boolean {
  const file = [path, `src/${path}`].map((p) => join(ROOT, p)).find(existsSync);
  if (!file) return false;
  const text = readFileSync(file, "utf8");
  return new RegExp(`\\b(function\\*?|const|let|class|type|interface|enum)\\s+${name}\\b`).test(text) || new RegExp(`^\\s+${name}\\??:`, "m").test(text);
}

describe("문서가 적은 코드 위치", () => {
  const all = DOCS.flatMap(refs);

  it("본다(꼴이 바뀌어 하나도 못 찾으면 이 테스트가 아무것도 보지 않는다)", () => {
    expect(all.length).toBeGreaterThan(20);
  });

  it("이름이 그 파일에 정의돼 있다", () => {
    expect(all.filter(({ name, path }) => !definedIn(path, name)).map(({ at, name, path }) => `${at} ${name} ← ${path}`)).toEqual([]);
  });
});
