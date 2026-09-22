import { readFile as fsReadFile } from "node:fs/promises";
import { join } from "node:path";
import { isAllowedImageSource } from "@/contract/images";
import type { HttpClient } from "@/shared/api/http-client";
import { noopLogger, type Logger } from "../logger";

/**
 * OG 이미지(next/og, satori) 에셋.
 *
 * 폰트: pretendard 패키지가 함께 배포하는 정적 단일 weight otf를 node_modules에서 그대로 읽는다(저장소에 복사하지 않음).
 * satori는 woff2를 읽지 못하고 ttf/otf/woff만 받는다(Next 문서). 배포 번들에 파일이 들어가도록 next.config.ts의
 * outputFileTracingIncludes에 같은 경로를 넣었다. 읽기에 실패하면 빈 배열을 돌려주고 satori 기본 폰트로 조용히 대체된다
 * (기본 폰트에는 한글이 없어 글자가 빈 칸으로 보일 수 있다, architecture.md 12절).
 */
export const OG_FONT_FILES = [
  { path: "node_modules/pretendard/dist/public/static/Pretendard-Regular.otf", weight: 400 },
  { path: "node_modules/pretendard/dist/public/static/Pretendard-Bold.otf", weight: 700 },
] as const;

export type OgFont = { name: string; data: ArrayBuffer; weight: 400 | 700; style: "normal" };

/**
 * 경로는 join(process.cwd(), "고정 문자열")로 직접 적는다. 변수로 넘기면 번들러가 경로를 정적으로 알 수 없어
 * 프로젝트 전체를 서버 번들 추적 대상으로 삼는다(Turbopack 경고). 테스트는 readFile만 바꾼다.
 */
function readFontFiles(readFile: (path: string) => Promise<Uint8Array>) {
  return Promise.all([
    readFile(join(process.cwd(), "node_modules/pretendard/dist/public/static/Pretendard-Regular.otf")),
    readFile(join(process.cwd(), "node_modules/pretendard/dist/public/static/Pretendard-Bold.otf")),
  ]);
}

export async function loadOgFonts(
  readFile: (path: string) => Promise<Uint8Array> = fsReadFile,
  logger: Logger = noopLogger,
): Promise<OgFont[]> {
  try {
    const files = await readFontFiles(readFile);
    return files.map((bytes, i) => ({
      name: "Pretendard",
      data: bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
      weight: OG_FONT_FILES[i].weight,
      style: "normal" as const,
    }));
  } catch (error) {
    logger.warn("og font load failed, falling back to default font", {
      name: error instanceof Error ? error.name : typeof error,
    });
    return [];
  }
}

/** OG 원본 이미지 최대 크기. 넘으면 사진 없이 그린다 */
export const OG_IMAGE_MAX_BYTES = 5 * 1024 * 1024;

/**
 * 공고 사진을 서버에서 직접 받아 data URL로 만든다(이미지 프록시를 거치지 않는다. 서버 컨텍스트라 혼합 콘텐츠 문제가 없다).
 * 허용된 원본(공공 API 이미지 서버)만 받고, 실패하거나 이미지가 아니거나 너무 크면 null(사진 없이 그린다).
 */
export async function fetchOgImage(
  src: string | null,
  http: HttpClient,
  { timeoutMs, logger = noopLogger }: { timeoutMs: number; logger?: Logger },
): Promise<string | null> {
  if (!src || !isAllowedImageSource(src)) return null;
  try {
    const { data, contentType } = await http.getBytes(src, { timeoutMs, redirect: "error", cache: "no-store" });
    const type = contentType?.split(";")[0].trim().toLowerCase();
    if (!type?.startsWith("image/") || data.byteLength > OG_IMAGE_MAX_BYTES) return null;
    return `data:${type};base64,${Buffer.from(data).toString("base64")}`;
  } catch (error) {
    logger.warn("og image fetch failed", { name: error instanceof Error ? error.name : typeof error });
    return null;
  }
}
