/**
 * 홈 캐릭터 Rive 자산이 런타임 패키지와 맞는지 본다. WASM은 런타임 JS와 버전이 같아야 하고(다르면 로드가 깨진다),
 * .riv는 Vercel 빌드에 Rive CLI가 없어 빌드 결과를 커밋한다(pnpm rive:build).
 */
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  CHARACTER_RIV_URL,
  RIVE_RUNTIME_VERSION,
  RIVE_WASM_URL,
} from "@/entities/animal/lib/character-animation-assets";

const ROOT = process.cwd();
const pkgDir = join(ROOT, "node_modules/@rive-app/canvas-lite");

describe("Rive 자산", () => {
  it("런타임 버전은 package.json에 정확히 고정되어 있고 설치된 패키지와 같다", () => {
    const pkg = JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8"));
    expect(pkg.dependencies["@rive-app/canvas-lite"]).toBe(RIVE_RUNTIME_VERSION);
    expect(JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8")).version).toBe(RIVE_RUNTIME_VERSION);
  });

  it("public의 WASM은 그 버전의 rive.wasm과 바이트 단위로 같고, 다른 버전 파일은 없다", () => {
    const wasm = join(ROOT, "public", RIVE_WASM_URL);
    expect(readFileSync(wasm).equals(readFileSync(join(pkgDir, "rive.wasm")))).toBe(true);
    expect(readdirSync(join(ROOT, "public/rive"))).toEqual([`rive-canvas-lite-${RIVE_RUNTIME_VERSION}.wasm`]);
  });

  it(".riv가 있고 두 아트보드(nyang-cat, nyang-dog)를 담고 있다", () => {
    const riv = join(ROOT, "public", CHARACTER_RIV_URL);
    expect(existsSync(riv)).toBe(true);
    const bytes = readFileSync(riv);
    expect(bytes.subarray(0, 4).toString("latin1")).toBe("RIVE");
    expect(bytes.includes(Buffer.from("nyang-cat"))).toBe(true);
    expect(bytes.includes(Buffer.from("nyang-dog"))).toBe(true);
  });
});
