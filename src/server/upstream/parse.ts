import { noopLogger, type Logger } from "../logger";
import { UpstreamAnimalItemSchema, type UpstreamAnimalItemDto } from "./dto";

export type ParsedUpstreamItems = {
  items: UpstreamAnimalItemDto[];
  skippedCount: number;
};

/**
 * item마다 따로 검증한다. 실패한 item은 건너뛰고 로그를 남긴다.
 * 한 item의 실패가 목록 전체를 실패시키지 않는다. 로그에는 값이 아니라 이슈 경로만 남긴다.
 */
export function parseUpstreamItems(
  rawItems: unknown[],
  logger: Logger = noopLogger,
): ParsedUpstreamItems {
  const items: UpstreamAnimalItemDto[] = [];
  let skippedCount = 0;

  for (const raw of rawItems) {
    const result = UpstreamAnimalItemSchema.safeParse(raw);
    if (result.success) {
      items.push(result.data);
      continue;
    }
    skippedCount += 1;
    logger.warn("upstream item skipped (schema mismatch)", {
      desertionNo: readDesertionNo(raw),
      issues: result.error.issues.map((issue) => issue.path.join(".") || "(root)"),
    });
  }

  return { items, skippedCount };
}

function readDesertionNo(raw: unknown): string | null {
  if (typeof raw !== "object" || raw === null) return null;
  const value = (raw as Record<string, unknown>).desertionNo;
  return typeof value === "string" ? value : null;
}
