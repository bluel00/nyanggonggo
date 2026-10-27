/**
 * 소스(className·style 문자열)가 읽는 CSS 변수는 모두 정의돼 있다(#61). 정의되지 않은 var()는 조용히 무시돼 색이 계산되지 않는다
 * (button.tsx secondary hover가 `--secondary`·`--foreground`를 읽었는데 globals.css에는 `--color-secondary`·`--color-foreground`만 있었다).
 * 정의된 곳: globals.css(토큰과 Tailwind 테마 변수), 또는 소스가 style로 직접 넣는 변수(`"--이름"`).
 */
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = process.cwd();
const SRC = join(ROOT, "src");
const globals = readFileSync(join(SRC, "app/globals.css"), "utf8");

const sources = (readdirSync(SRC, { recursive: true }) as string[])
  .filter((name) => /\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name))
  .map((name) => ({ name: name.replaceAll("\\", "/"), text: readFileSync(join(SRC, name), "utf8") }));

const setInSource = new Set(sources.flatMap(({ text }) => [...text.matchAll(/["'`](--[a-z0-9-]+)["'`]\s*[:\]]/g)].map((m) => m[1])));
const isDefined = (name: string) => new RegExp(`${name}\\s*:`).test(globals) || setInSource.has(name);

describe("소스가 읽는 CSS 변수", () => {
  it("모두 정의돼 있다", () => {
    const missing = sources.flatMap(({ name, text }) =>
      [...text.matchAll(/var\((--[a-z0-9-]+)/g)].map((m) => m[1]).filter((v) => !isDefined(v)).map((v) => `${name}: ${v}`),
    );
    expect(missing).toEqual([]);
  });
});
