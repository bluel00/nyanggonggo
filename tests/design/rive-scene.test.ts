/**
 * 캐릭터 Rive 원본(rive/nyang-characters/scene.rml)의 두 아트보드는 scripts/rive-characters-scene.mjs가 SVG에서 만든다.
 * SVG만 바꾸고 생성(`pnpm rive:build`)을 하지 않으면 커밋된 scene.rml·.riv가 옛 그림이 되므로, 생성 결과와 같은지 본다.
 */
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const GENERATOR = join(process.cwd(), "scripts/rive-characters-scene.mjs");

describe("캐릭터 Rive 원본", () => {
  it("scene.rml이 지금 SVG로 생성한 결과와 같다(다르면 pnpm rive:build)", () => {
    let output = "";
    let failed = false;
    try {
      output = execFileSync(process.execPath, [GENERATOR, "--check"], { encoding: "utf8", stdio: "pipe" });
    } catch (error) {
      failed = true;
      output = String((error as { stderr?: string }).stderr ?? error);
    }
    expect(failed, output).toBe(false);
  }, 30_000);
});
