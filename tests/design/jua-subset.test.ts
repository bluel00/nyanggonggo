/**
 * 제목 글꼴 Jua 부분 글꼴(architecture.md 14.1 "제목 글꼴", 14.3 "Jua 파일"): 고정 문구 7개의 글자가 모두 파일에 있는지,
 * 크기가 20KB 이하인지, 글자 목록·대체 글꼴 CSS가 화면 문구와 맞는지 본다. 파일은 scripts/jua-subset.mjs가 만든다.
 *
 * woff2는 새 의존성 없이 읽는다: 표들은 brotli 한 덩어리로 압축되어 있고(Node 내장 zlib), cmap은 변환 없이 들어 있다(woff2 명세 5절).
 */
import { readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { brotliDecompressSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { ANIMAL_COPY, SPECIES_COPY, SPECIES_LABEL } from "@/entities/animal";
import { SERVICE_NAME } from "@/shared/config/service";

const FONT_DIR = join(process.cwd(), "src/shared/assets/fonts");
const FONT_FILE = join(FONT_DIR, "jua-subset.woff2");

/** Jua로 그리는 고정 문구 7개(화면이 쓰는 상수 그대로) */
const DISPLAY_TEXTS = [
  SERVICE_NAME,
  ANIMAL_COPY.homeTitle,
  SPECIES_LABEL.cat,
  SPECIES_LABEL.dog,
  SPECIES_COPY.cat.listTitle,
  SPECIES_COPY.dog.listTitle,
  SPECIES_COPY.other.listTitle,
];

const codePointsOf = (texts: string[]) => [...new Set(texts.join(""))].map((c) => c.codePointAt(0)!).sort((a, b) => a - b);

// woff2 명세 표 5.1의 알려진 태그(인덱스 순서). 63은 태그를 따로 적는다
// prettier-ignore
const KNOWN_TAGS = [
  "cmap", "head", "hhea", "hmtx", "maxp", "name", "OS/2", "post", "cvt ", "fpgm", "glyf", "loca", "prep", "CFF ", "VORG", "EBDT",
  "EBLC", "gasp", "hdmx", "kern", "LTSH", "PCLT", "VDMX", "vhea", "vmtx", "BASE", "GDEF", "GPOS", "GSUB", "EBSC", "JSTF", "MATH",
  "CBDT", "CBLC", "COLR", "CPAL", "SVG ", "sbix", "acnt", "avar", "bdat", "bloc", "bsln", "cvar", "fdsc", "feat", "fmtx", "fvar",
  "gvar", "hsty", "just", "lcar", "mort", "morx", "opbd", "prop", "trak", "Zapf", "Silf", "Glat", "Gloc", "Feat", "Sill",
];

function readBase128(bytes: Buffer, at: { offset: number }) {
  let value = 0;
  for (let i = 0; i < 5; i++) {
    const byte = bytes[at.offset++];
    value = value * 128 + (byte & 0x7f);
    if ((byte & 0x80) === 0) return value;
  }
  throw new Error("UIntBase128가 5바이트를 넘는다");
}

/** woff2에서 표 하나를 꺼낸다(변환되지 않은 표만) */
function woff2Table(file: Buffer, wanted: string): Buffer {
  expect(file.toString("latin1", 0, 4)).toBe("wOF2");
  const numTables = file.readUInt16BE(12);
  const totalCompressedSize = file.readUInt32BE(20);
  const at = { offset: 48 };
  const tables: { tag: string; length: number; transformed: boolean }[] = [];
  for (let i = 0; i < numTables; i++) {
    const flags = file[at.offset++];
    const tagIndex = flags & 0x3f;
    const version = flags >> 6;
    const tag = tagIndex === 63 ? file.toString("latin1", at.offset, (at.offset += 4)) : KNOWN_TAGS[tagIndex];
    const origLength = readBase128(file, at);
    // glyf·loca는 version 0이 변환, 나머지는 0이 아니면 변환(명세 5.2)
    const transformed = tag === "glyf" || tag === "loca" ? version === 0 : version !== 0;
    const length = transformed ? readBase128(file, at) : origLength;
    tables.push({ tag, length, transformed });
  }
  const data = brotliDecompressSync(file.subarray(at.offset, at.offset + totalCompressedSize));
  let offset = 0;
  for (const table of tables) {
    if (table.tag === wanted) {
      expect(table.transformed).toBe(false);
      return data.subarray(offset, offset + table.length);
    }
    offset += table.length;
  }
  throw new Error(`${wanted} 표가 없다`);
}

/** cmap의 유니코드 하위 표(format 4·12)에 든 코드 포인트 */
function cmapCodePoints(cmap: Buffer): Set<number> {
  const result = new Set<number>();
  const count = cmap.readUInt16BE(2);
  for (let i = 0; i < count; i++) {
    const platform = cmap.readUInt16BE(4 + i * 8);
    const sub = cmap.readUInt32BE(4 + i * 8 + 4);
    if (platform !== 0 && platform !== 3) continue;
    const format = cmap.readUInt16BE(sub);
    if (format === 4) {
      const segX2 = cmap.readUInt16BE(sub + 6);
      const ends = sub + 14;
      const starts = ends + segX2 + 2;
      const deltas = starts + segX2;
      const rangeOffsets = deltas + segX2;
      for (let s = 0; s < segX2 / 2; s++) {
        const end = cmap.readUInt16BE(ends + s * 2);
        const start = cmap.readUInt16BE(starts + s * 2);
        const delta = cmap.readInt16BE(deltas + s * 2);
        const rangeOffset = cmap.readUInt16BE(rangeOffsets + s * 2);
        for (let c = start; c <= end && c !== 0xffff; c++) {
          const glyph =
            rangeOffset === 0
              ? (c + delta) & 0xffff
              : cmap.readUInt16BE(rangeOffsets + s * 2 + rangeOffset + (c - start) * 2);
          if (glyph !== 0) result.add(c);
        }
      }
    } else if (format === 12) {
      const groups = cmap.readUInt32BE(sub + 12);
      for (let g = 0; g < groups; g++) {
        const start = cmap.readUInt32BE(sub + 16 + g * 12);
        const end = cmap.readUInt32BE(sub + 16 + g * 12 + 4);
        for (let c = start; c <= end; c++) result.add(c);
      }
    }
  }
  return result;
}

describe("Jua 부분 글꼴", () => {
  const font = readFileSync(FONT_FILE);
  const cmap = cmapCodePoints(woff2Table(font, "cmap"));

  it("고정 문구 7개의 모든 글자(공백·물음표 포함)가 cmap에 있다", () => {
    const missing = codePointsOf(DISPLAY_TEXTS).filter((c) => !cmap.has(c));
    expect(missing.map((c) => String.fromCodePoint(c))).toEqual([]);
  });

  it("그 밖의 글자는 없다(부분 글꼴)", () => {
    expect([...cmap].sort((a, b) => a - b)).toEqual(codePointsOf(DISPLAY_TEXTS));
  });

  it("20KB 이하다(14.3)", () => {
    expect(statSync(FONT_FILE).size).toBeLessThanOrEqual(20 * 1024);
  });

  it("글자 목록 파일은 고정 문구 7개 그대로다(다시 만들 때의 입력)", () => {
    const lines = readFileSync(join(FONT_DIR, "jua-subset.txt"), "utf8").split(/\r?\n/).filter(Boolean);
    expect(lines).toEqual(DISPLAY_TEXTS);
  });

  it("라이선스 파일(OFL 1.1)이 글꼴 옆에 있다", () => {
    expect(readFileSync(join(FONT_DIR, "OFL.txt"), "utf8")).toContain("SIL OPEN FONT LICENSE Version 1.1");
  });

  it("대체 글꼴(Jua Fallback)의 unicode-range가 고정 문구의 글자를 빠짐없이, 그것만 덮는다", () => {
    const css = readFileSync(join(FONT_DIR, "jua-fallback.css"), "utf8");
    const covered = [...css.matchAll(/unicode-range:([^;]*);/g)]
      .flatMap((m) => m[1].split(","))
      .map((range) => parseInt(range.trim().slice(2), 16))
      .sort((a, b) => a - b);
    expect(covered).toEqual(codePointsOf(DISPLAY_TEXTS));
  });
});
