import { z } from "zod";
import { InvalidRequestError } from "./errors";
import type { AnimalListParams } from "./service";

/**
 * 요청 파라미터 검증. 빈 문자열은 값이 없는 것으로 본다.
 * region(시도 코드), district(시군구 코드), id(desertionNo)는 숫자 문자열만 확인한다(architecture.md 12절).
 * district는 region과 함께만 받는다(시군구만 오면 400).
 */
const DIGITS = /^\d{1,32}$/;

const ListQuerySchema = z.object({
  species: z.enum(["cat", "dog"]).default("cat"),
  region: z.string().regex(DIGITS).optional(),
  district: z.string().regex(DIGITS).optional(),
  status: z.enum(["protected", "ended", "all"]).default("protected"),
  sort: z.enum(["latest", "endingSoon"]).default("latest"),
  cursor: z.string().max(64).optional(),
}).refine((query) => query.district === undefined || query.region !== undefined, {
  path: ["district"],
  message: "district requires region",
});

const IdSchema = z.string().regex(DIGITS);

export function parseListQuery(searchParams: URLSearchParams): AnimalListParams {
  const result = ListQuerySchema.safeParse({
    species: read(searchParams, "species"),
    region: read(searchParams, "region"),
    district: read(searchParams, "district"),
    status: read(searchParams, "status"),
    sort: read(searchParams, "sort"),
    cursor: read(searchParams, "cursor"),
  });
  if (!result.success) throw invalid(result.error);
  return result.data;
}

export function parseAnimalId(raw: string): string {
  const result = IdSchema.safeParse(raw);
  if (!result.success) throw new InvalidRequestError("Invalid id");
  return result.data;
}

/** `ids=a,b,c`. 1개 이상, max개 이하. */
export function parseIdsQuery(searchParams: URLSearchParams, max: number): string[] {
  const ids = (read(searchParams, "ids") ?? "")
    .split(",")
    .map((id) => id.trim())
    .filter((id) => id !== "");
  const result = z.array(IdSchema).min(1).max(max).safeParse(ids);
  if (!result.success) throw invalid(result.error);
  return result.data;
}

function read(searchParams: URLSearchParams, key: string): string | undefined {
  const value = searchParams.get(key);
  return value === null || value === "" ? undefined : value;
}

function invalid(error: z.ZodError): InvalidRequestError {
  const fields = [...new Set(error.issues.map((issue) => String(issue.path[0] ?? "ids")))];
  return new InvalidRequestError(`Invalid query: ${fields.join(", ")}`);
}
