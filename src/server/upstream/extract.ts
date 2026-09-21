/**
 * 공공 API JSON 응답 → item 배열.
 *
 * 래퍼 구조(`response.header`, `response.body.items.item`, `response.body.totalCount`)는
 * 검증되지 않은 가정이다(architecture.md 12절 2). 그래서 다음을 모두 견딘다:
 * `item`이 배열 / 단일 객체, `items`가 `""`, `items` 또는 `item` 누락 → 빈 배열,
 * `totalCount`가 숫자 / 숫자 문자열 / 없음.
 * 최상위에 `response` 객체가 없으면 모양을 알 수 없는 응답으로 보고 null을 반환한다.
 */
export type ExtractedPage = {
  items: unknown[];
  totalCount: number | null;
  resultCode: string | null;
};

export function extractPage(json: unknown): ExtractedPage | null {
  const response = field(json, "response");
  if (!isRecord(response)) return null;

  const header = field(response, "header");
  const body = field(response, "body");
  const item = field(field(body, "items"), "item");

  return {
    items: Array.isArray(item) ? item : isRecord(item) ? [item] : [],
    totalCount: toCount(field(body, "totalCount")),
    resultCode: toCode(field(header, "resultCode")),
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function field(value: unknown, key: string): unknown {
  return isRecord(value) ? value[key] : undefined;
}

function toCount(value: unknown): number | null {
  const n = typeof value === "number" ? value : typeof value === "string" && value.trim() !== "" ? Number(value) : NaN;
  return Number.isInteger(n) && n >= 0 ? n : null;
}

function toCode(value: unknown): string | null {
  if (typeof value === "number") return String(value);
  if (typeof value === "string" && value.trim() !== "") return value.trim();
  return null;
}
