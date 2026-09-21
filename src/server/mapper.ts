import type { AnimalWireDto } from "@/contract/animals";
import { noopLogger, type Logger } from "./logger";
import type { UpstreamAnimalItemDto } from "./upstream/dto";

/**
 * 정렬용 원문 값. 형식이 고정 폭이라 문자열 비교로 정렬한다(architecture.md 5절).
 * 원문에 없으면 빈 문자열이다(내림차순에서 맨 뒤).
 */
export type AnimalSortKeys = {
  /** `YYYYMMDD` */
  noticeSdt: string;
  /** `YYYYMMDD` */
  noticeEdt: string;
  /** `YYYY-MM-DD HH:mm:ss.S` */
  updTm: string;
};

export type MappedAnimal = {
  wire: AnimalWireDto;
  sortKeys: AnimalSortKeys;
};

type MapOptions = { logger?: Logger };

/**
 * UpstreamDto → { wire, sortKeys }.
 * 종(species)을 판정할 수 없는 항목(고양이/개 외)은 null을 반환하고 로그를 남긴다.
 */
export function mapUpstreamItem(
  dto: UpstreamAnimalItemDto,
  { logger = noopLogger }: MapOptions = {},
): MappedAnimal | null {
  const species = toSpecies(dto.upKindNm);
  if (species === null) {
    logger.warn("unknown upKindNm, item skipped", {
      desertionNo: dto.desertionNo,
      upKindNm: dto.upKindNm,
    });
    return null;
  }

  const noticeStart = parseYmd(dto.noticeSdt ?? "");
  const noticeEnd = parseYmd(dto.noticeEdt);

  const wire: AnimalWireDto = {
    id: dto.desertionNo,
    species,
    images: toImages(dto),
    status: toStatus(dto, logger),
    noticeEndDate: noticeEnd ? formatIsoDate(noticeEnd) : null,
    sex: toSex(dto.sexCd ?? ""),
    ageText: nonEmpty(dto.age),
    regionText: dto.orgNm.trim(),
    shelterName: nonEmpty(dto.careNm),
    foundPlaceText: nonEmpty(dto.happenPlace),
    noticePeriodText:
      noticeStart && noticeEnd
        ? `${formatMonthDay(noticeStart)} ~ ${formatMonthDay(noticeEnd)}`
        : null,
  };

  return {
    wire,
    sortKeys: {
      noticeSdt: dto.noticeSdt ?? "",
      noticeEdt: dto.noticeEdt,
      updTm: dto.updTm ?? "",
    },
  };
}

function toSpecies(upKindNm: string): AnimalWireDto["species"] | null {
  switch (upKindNm.trim()) {
    case "고양이":
      return "cat";
    case "개":
      return "dog";
    default:
      return null;
  }
}

function toStatus(dto: UpstreamAnimalItemDto, logger: Logger): AnimalWireDto["status"] {
  const state = dto.processState.trim();
  if (state.startsWith("종료")) return "ended";
  if (state !== "보호중") {
    logger.warn("unknown processState, treated as protected", {
      desertionNo: dto.desertionNo,
      processState: dto.processState,
    });
  }
  return "protected";
}

function toSex(sexCd: string): AnimalWireDto["sex"] {
  switch (sexCd.trim()) {
    case "M":
      return "male";
    case "F":
      return "female";
    default:
      return "unknown";
  }
}

const POPFILE_KEY = /^popfile(\d+)$/;

/** `popfile1..N` 중 값이 있는 것만 번호순으로. */
function toImages(dto: UpstreamAnimalItemDto): string[] {
  return Object.entries(dto)
    .flatMap(([key, value]) => {
      const match = POPFILE_KEY.exec(key);
      if (!match || typeof value !== "string" || value.trim() === "") return [];
      return [{ order: Number(match[1]), url: value.trim() }];
    })
    .sort((a, b) => a.order - b.order)
    .map(({ url }) => encodeImageUrl(url));
}

/**
 * 파일명의 `[` `]`만 `%5B` `%5D`로 바꾼다. 이미 인코딩된 `%xx`는 건드리지 않아
 * 이중 인코딩이 없고, 여러 번 적용해도 결과가 같다.
 */
export function encodeImageUrl(url: string): string {
  return url.replaceAll("[", "%5B").replaceAll("]", "%5D");
}

type Ymd = { year: number; month: number; day: number };

/** `YYYYMMDD` → Ymd. 형식이 다르거나 없는 날짜면 null. */
function parseYmd(value: string): Ymd | null {
  const match = /^(\d{4})(\d{2})(\d{2})$/.exec(value.trim());
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

function formatIsoDate({ year, month, day }: Ymd): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

function formatMonthDay({ month, day }: Ymd): string {
  return `${pad2(month)}.${pad2(day)}`;
}

function nonEmpty(value: string | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed === "" ? null : trimmed;
}
