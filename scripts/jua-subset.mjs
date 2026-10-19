#!/usr/bin/env node
/**
 * 제목 글꼴 Jua의 부분 글꼴을 만든다(architecture.md 14.1 "제목 글꼴", 14.2 2단계).
 *
 *   node scripts/jua-subset.mjs
 *
 * 원본: Google Fonts 저장소(google/fonts)의 ofl/jua를 커밋으로 고정해 받는다(Jua-Regular.ttf, OFL.txt). sha256이 다르면 멈춘다.
 * 도구: fontTools pyftsubset을 uvx로 버전을 고정해 임시 환경에서 돌린다. 저장소 의존성이 아니다(uv가 PATH에 있어야 한다).
 * 결과(src/shared/assets/fonts/):
 *   jua-subset.woff2   글자 목록 jua-subset.txt의 글자만 담은 부분 글꼴
 *   OFL.txt            원본 라이선스
 *   jua-fallback.css   Jua를 받기 전에 쓰는 대체 글꼴 "Jua Fallback": Pretendard(wght 400)를 고정 문구의 폭과 Jua의 세로 값에 맞춘다
 *                      (size-adjust, ascent/descent/line-gap-override, 값은 scripts/jua-fallback-metrics.py). Next의 adjustFontFallback은
 *                      a~z 평균 폭으로 Arial을 맞추는데 부분 글꼴에 라틴 글자가 없어 한글에는 효과가 없다. 글꼴 파일은 pretendard 패키지의
 *                      dynamic subset 파일을 그대로 가리키고(본문 Pretendard와 같은 파일), unicode-range는 목록의 글자만이다.
 * 글자 목록을 바꾸면 이 스크립트를 다시 돌려 결과를 함께 커밋한다(tests/design/jua-subset.test.ts가 화면 문구와 파일을 대조한다).
 *
 * 라이선스: SIL OFL 1.1, 예약 글꼴 이름(Reserved Font Name) 없음(원본 OFL.txt와 글꼴 name 13번 확인). 그래서 이름을 바꾸지 않는다.
 */
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
const OUT_DIR = join(ROOT, "src/shared/assets/fonts");
const TEXT_FILE = join(OUT_DIR, "jua-subset.txt");
const SUBSET_FILE = join(OUT_DIR, "jua-subset.woff2");

const SOURCE_COMMIT = "69d2493f8b919292a9c4b530081934877093c038";
const SOURCE_BASE = `https://raw.githubusercontent.com/google/fonts/${SOURCE_COMMIT}/ofl/jua`;
const SOURCES = {
  "Jua-Regular.ttf": "769677aef240bfc3b9965f2b50748075bff885e6c6992fc591a3fb268279f898",
  "OFL.txt": "44a7c6e4c5572392ae122d3b1d8c6ba6fd640a7797e675384585d947f2773e3c",
};
const FONTTOOLS = "fonttools==4.60.1";
const BROTLI = "brotli==1.1.0";

const PRETENDARD_DIR = "node_modules/pretendard/dist/web/variable";
const PRETENDARD_CSS = join(ROOT, PRETENDARD_DIR, "pretendardvariable-dynamic-subset.css");
const PRETENDARD_TTF = join(ROOT, "node_modules/pretendard/dist/public/variable/PretendardVariable.ttf");

function uvx(args, options) {
  return execFileSync("uvx", ["--isolated", "--from", FONTTOOLS, "--with", BROTLI, ...args], options);
}

async function download(name) {
  const response = await fetch(`${SOURCE_BASE}/${name}`);
  if (!response.ok) throw new Error(`${name}: HTTP ${response.status}`);
  const bytes = Buffer.from(await response.arrayBuffer());
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== SOURCES[name]) throw new Error(`${name}: sha256 ${hash}가 고정값과 다르다`);
  return bytes;
}

const hex = (codePoint) => `U+${codePoint.toString(16).toUpperCase()}`;
const percent = (value) => `${(value * 100).toFixed(2)}%`;

/** Pretendard dynamic subset의 @font-face 중 목록 글자가 든 것마다, 같은 파일을 가리키는 "Jua Fallback" 면을 하나씩 만든다 */
function fallbackCss(metrics) {
  const codePoints = [...new Set(readFileSync(TEXT_FILE, "utf8").replace(/\r?\n/g, ""))]
    .map((c) => c.codePointAt(0))
    .sort((a, b) => a - b);
  const faces = [...readFileSync(PRETENDARD_CSS, "utf8").matchAll(/@font-face\s*{([^}]*)}/g)].map((m) => m[1]);
  const covered = new Set();
  const rules = [];
  for (const face of faces) {
    const file = face.match(/url\(['"]?\.\/([^'")]+)/)[1];
    const ranges = face
      .match(/unicode-range:([^;]*)/)[1]
      .split(",")
      .map((range) => range.trim().slice(2).split("-").map((h) => parseInt(h, 16)));
    const inFace = codePoints.filter((c) => !covered.has(c) && ranges.some(([from, to = from]) => c >= from && c <= to));
    if (inFace.length === 0) continue;
    inFace.forEach((c) => covered.add(c));
    rules.push(
      [
        "@font-face {",
        '  font-family: "Jua Fallback";',
        `  src: url("../../../../${PRETENDARD_DIR}/${file}") format("woff2-variations");`,
        "  font-weight: 400;",
        "  font-display: swap;",
        `  size-adjust: ${percent(metrics.sizeAdjust)};`,
        `  ascent-override: ${percent(metrics.ascentOverride)};`,
        `  descent-override: ${percent(metrics.descentOverride)};`,
        `  line-gap-override: ${percent(metrics.lineGapOverride)};`,
        `  unicode-range: ${inFace.map(hex).join(", ")};`,
        "}",
      ].join("\n"),
    );
  }
  const missing = codePoints.filter((c) => !covered.has(c));
  if (missing.length) throw new Error(`Pretendard에 없는 글자: ${missing.map(hex).join(", ")}`);
  return `/* scripts/jua-subset.mjs가 만든다. 직접 고치지 않는다 */\n${rules.join("\n")}\n`;
}

const work = mkdtempSync(join(tmpdir(), "jua-subset-"));
try {
  const ttf = join(work, "Jua-Regular.ttf");
  writeFileSync(ttf, await download("Jua-Regular.ttf"));
  writeFileSync(join(OUT_DIR, "OFL.txt"), await download("OFL.txt"));

  uvx(
    [
      "pyftsubset",
      ttf,
      `--text-file=${TEXT_FILE}`,
      "--flavor=woff2",
      // 0~6(이름·버전) + 13·14(라이선스 설명·주소)를 남긴다
      "--name-IDs=0,1,2,3,4,5,6,13,14",
      `--output-file=${SUBSET_FILE}`,
    ],
    { stdio: "inherit" },
  );

  const metricsScript = join(ROOT, "scripts/jua-fallback-metrics.py");
  const metrics = JSON.parse(uvx(["python", "-I", metricsScript, SUBSET_FILE, PRETENDARD_TTF, TEXT_FILE], { encoding: "utf8" }));
  writeFileSync(join(OUT_DIR, "jua-fallback.css"), fallbackCss(metrics));
  console.log("jua-subset.woff2, OFL.txt, jua-fallback.css 갱신", metrics);
} finally {
  rmSync(work, { recursive: true, force: true });
}
