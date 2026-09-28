/**
 * 응답 바이트의 매직 넘버(파일 시그니처)로 이미지 형식을 판별한다.
 *
 * 공공데이터포털 fileDownloadSrvc는 실제 이미지를 내려주면서 Content-Type을 `application/octet-stream`으로
 * 잘못 표기한다(2026-09-27 로컬 확인, architecture.md 12절). 그래서 헤더를 믿지 않고 바이트로 판별하고,
 * Content-Type도 여기서 판별한 값으로 우리가 직접 설정한다.
 */
export type DetectedImageType = "image/jpeg" | "image/png" | "image/gif" | "image/webp";

const JPEG = [0xff, 0xd8, 0xff];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
const GIF = [0x47, 0x49, 0x46, 0x38]; // "GIF8"
const RIFF = [0x52, 0x49, 0x46, 0x46]; // "RIFF"
const WEBP = [0x57, 0x45, 0x42, 0x50]; // "WEBP" (RIFF 컨테이너의 8~11바이트)

function startsWith(bytes: Uint8Array, signature: number[], offset = 0): boolean {
  if (bytes.length < offset + signature.length) return false;
  return signature.every((byte, i) => bytes[offset + i] === byte);
}

/** 알려진 형식이면 그 MIME 타입, 아니면 null */
export function detectImageType(data: ArrayBuffer | Uint8Array): DetectedImageType | null {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (startsWith(bytes, JPEG)) return "image/jpeg";
  if (startsWith(bytes, PNG)) return "image/png";
  if (startsWith(bytes, GIF)) return "image/gif";
  if (startsWith(bytes, RIFF) && startsWith(bytes, WEBP, 8)) return "image/webp";
  return null;
}

/** 로그용: 앞부분 바이트를 16진수로(본문 내용을 남기지 않는다) */
export function bytesPrefixHex(data: ArrayBuffer | Uint8Array, length = 8): string {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  return [...bytes.slice(0, length)].map((b) => b.toString(16).padStart(2, "0")).join(" ");
}
