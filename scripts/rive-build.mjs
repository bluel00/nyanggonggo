#!/usr/bin/env node
/**
 * 홈 캐릭터 Rive 자산을 public/에 둔다(architecture.md 12절 47, 9절 "홈 캐릭터 Rive").
 *
 *   pnpm rive:build   생성기(scripts/rive-characters-scene.mjs)로 scene.rml을 다시 만든 뒤(SVG 변경 반영), RML 원본(rive/nyang-characters)을
 *                     Rive CLI로 빌드해 public/characters/nyang-characters.riv로 복사
 *   pnpm rive:wasm    @rive-app/canvas-lite의 rive.wasm을 public/rive/rive-canvas-lite-<버전>.wasm으로 복사(이전 버전은 지운다)
 *
 * 규칙: RML을 고치면 `pnpm rive:build`로 다시 빌드해 .riv를 함께 커밋한다(Vercel 빌드에는 Rive CLI가 없다).
 * 런타임 패키지 버전을 바꾸면 `pnpm rive:wasm`을 돌리고 src/entities/animal/lib/character-animation-assets.ts의 버전을 맞춘다
 * (tests/design/rive-assets.test.ts가 둘이 어긋나면 실패한다).
 *
 * Rive CLI 위치: 환경변수 RIVE_BIN → PATH의 rive → ~/.rive/bin/rive(.exe) 순서로 찾는다.
 */
import { execFileSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const PROJECT = join(ROOT, "rive/nyang-characters");
const RIV_OUT = join(ROOT, "public/characters/nyang-characters.riv");
const WASM_DIR = join(ROOT, "public/rive");

function findRive() {
  if (process.env.RIVE_BIN) return process.env.RIVE_BIN;
  try {
    execFileSync("rive", ["--version"], { stdio: "ignore" });
    return "rive";
  } catch {
    const exe = join(homedir(), ".rive/bin", process.platform === "win32" ? "rive.exe" : "rive");
    if (existsSync(exe)) return exe;
    throw new Error("Rive CLI를 찾지 못했다. RIVE_BIN을 지정하거나 PATH에 rive를 둔다");
  }
}

function buildRiv() {
  // 생성 → 빌드. 그림만 바꾸고 생성을 잊으면 옛 도형이 빌드되므로 늘 먼저 생성한다
  execFileSync(process.execPath, [join(ROOT, "scripts/rive-characters-scene.mjs")], { stdio: "inherit" });
  const rive = findRive();
  const version = execFileSync(rive, ["--version"], { encoding: "utf8" }).trim();
  execFileSync(rive, [PROJECT, "--once"], { stdio: "inherit" });
  const built = join(PROJECT, "build/nyang-characters.riv");
  mkdirSync(dirname(RIV_OUT), { recursive: true });
  copyFileSync(built, RIV_OUT);
  console.log(`${version}: ${built} → public/characters/nyang-characters.riv (${statSync(RIV_OUT).size} bytes)`);
}

function copyWasm() {
  const pkgDir = join(ROOT, "node_modules/@rive-app/canvas-lite");
  const { version } = JSON.parse(readFileSync(join(pkgDir, "package.json"), "utf8"));
  const name = `rive-canvas-lite-${version}.wasm`;
  mkdirSync(WASM_DIR, { recursive: true });
  for (const old of readdirSync(WASM_DIR)) if (old.endsWith(".wasm") && old !== name) rmSync(join(WASM_DIR, old));
  copyFileSync(join(pkgDir, "rive.wasm"), join(WASM_DIR, name));
  console.log(`@rive-app/canvas-lite ${version}: rive.wasm → public/rive/${name} (${statSync(join(WASM_DIR, name)).size} bytes)`);
}

const command = process.argv[2];
if (command === "riv") buildRiv();
else if (command === "wasm") copyWasm();
else throw new Error("사용법: node scripts/rive-build.mjs riv|wasm");
