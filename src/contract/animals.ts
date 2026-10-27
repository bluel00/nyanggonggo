import { z } from "zod";

/** 공고 id(desertionNo) 형식: 숫자 문자열 1~32자리. 서버 요청 검사, 상세 경로, 찜 저장값이 모두 이것을 쓴다(이슈 #31) */
export function isAnimalId(value: string): boolean {
  return /^\d{1,32}$/.test(value);
}

/** 축종 값. Wire의 species와 목록 쿼리의 species가 같은 목록이다 */
export const ANIMAL_SPECIES = ["cat", "dog", "other"] as const;
/** 공고 상태 값(Wire). 목록 쿼리는 여기에 all을 더한다 */
export const ANIMAL_STATUSES = ["protected", "ended"] as const;

/**
 * 서버(BFF) ↔ 브라우저 계약. 원시 타입만 쓴다(날짜는 문자열).
 * 담당자 이름(careOwnerNm)은 넣지 않는다. 보호소 주소·전화는 상세 정보 줄에 쓴다(이슈 #3).
 */
export const AnimalWireDtoSchema = z.object({
  id: z.string(),
  species: z.enum(ANIMAL_SPECIES),
  images: z.array(z.string()),
  status: z.enum(ANIMAL_STATUSES),
  /**
   * 종료 결과(processState "종료(…)"의 괄호 안 낱말: 입양, 반환, 자연사…) 원문(이슈 #41).
   * 값 목록을 고정하지 않는 자유 문자열이다. 종료가 아니거나 괄호가 없거나 비어 있으면 null
   */
  endResultText: z.string().nullable(),
  /** 공고 종료일, KST 달력 날짜 `YYYY-MM-DD` */
  noticeEndDate: z.string().nullable(),
  sex: z.enum(["male", "female", "unknown"]),
  ageText: z.string().nullable(),
  regionText: z.string(),
  shelterName: z.string().nullable(),
  foundPlaceText: z.string().nullable(),
  /** 보호소 주소(careAddr). 공백뿐이면 null */
  shelterAddressText: z.string().nullable(),
  /** 보호소 전화(careTel) 원문. 공백뿐이면 null */
  shelterTelText: z.string().nullable(),
  /** `MM.DD ~ MM.DD` */
  noticePeriodText: z.string().nullable(),
  /** 특이사항(specialMark). 공백뿐이면 null */
  specialMarkText: z.string().nullable(),
  /** 종료 사유(endReason) 원문(이슈 #41). 공백뿐이면 null */
  endReasonText: z.string().nullable(),
  /**
   * 품종 이름(`kindFullNm`의 `[축종]` 뒤). 기타 축종은 이 값이 실제 동물(토끼, 앵무새…)이라
   * 화면에서 "어떤 동물인지" 보여 주는 데 쓴다. 뽑을 수 없으면 null
   */
  kindText: z.string().nullable(),
});

export type AnimalWireDto = z.infer<typeof AnimalWireDtoSchema>;

/**
 * GET /api/animals 목록 쿼리(species, status, sex, sort)의 값 목록과 기본값(이슈 #28). 서버 파싱, 클라이언트의 요청 URL·화면 필터
 * 파싱·필터 시트가 모두 이것을 쓴다. zod enum과 타입은 이 배열에서 파생한다. 배열 순서는 필터 시트의 선택지 순서다.
 * 값을 하나 더하면 여기와 그 값의 동작(서버 정렬 비교기 등)·라벨(필터 시트)만 고친다.
 * region(시도), district(시군구), cursor는 값 목록이 아니라 형식만 본다(server/animals/query.ts).
 */
export const ANIMAL_LIST_STATUSES = [...ANIMAL_STATUSES, "all"] as const;
/** 성별 미상(unknown)은 all에서만 나온다(이슈 #20) */
export const ANIMAL_LIST_SEXES = ["all", "female", "male"] as const;
export const ANIMAL_LIST_SORTS = ["latest", "deadline"] as const;

export const AnimalListSpeciesSchema = z.enum(ANIMAL_SPECIES);
export const AnimalListStatusSchema = z.enum(ANIMAL_LIST_STATUSES);
export const AnimalListSexSchema = z.enum(ANIMAL_LIST_SEXES);
export const AnimalListSortSchema = z.enum(ANIMAL_LIST_SORTS);

export type AnimalListSpecies = z.infer<typeof AnimalListSpeciesSchema>;
export type AnimalListStatus = z.infer<typeof AnimalListStatusSchema>;
export type AnimalListSex = z.infer<typeof AnimalListSexSchema>;
export type AnimalListSort = z.infer<typeof AnimalListSortSchema>;

/**
 * 값이 없을 때의 기본값. 서버는 빠진 값에, 화면은 빠지거나 모르는 값에 쓴다.
 * URL에서 기본값을 생략하는 규칙은 쓰는 쪽에 있다(요청 URL은 sex만, 화면 URL은 status·sex·sort를 생략한다).
 */
export const ANIMAL_LIST_DEFAULTS = {
  species: "cat",
  status: "protected",
  sex: "all",
  sort: "latest",
} as const satisfies {
  species: AnimalListSpecies;
  status: AnimalListStatus;
  sex: AnimalListSex;
  sort: AnimalListSort;
};

export const AnimalListResponseSchema = z.object({
  items: z.array(AnimalWireDtoSchema),
  nextCursor: z.string().nullable(),
});

export type AnimalListResponse = z.infer<typeof AnimalListResponseSchema>;

/** GET /api/animals/by-ids 한 번에 보낼 수 있는 id 최대 개수. 서버는 넘으면 400, 클라이언트는 이 단위로 나눠 보낸다. */
export const ANIMAL_BY_IDS_MAX = 50;

/**
 * GET /api/animals/by-ids. 못 찾은 id는 빠지고, 순서는 요청한 ids 순서를 따른다.
 * 업스트림 오류로 조회하지 못한 id는 items에서 빠지고 failedIds에 요청 순서대로 담긴다(이슈 #5).
 * 하나도 불러오지 못했는데 실패가 있으면 이 응답 대신 오류(502/504)다.
 */
export const AnimalByIdsResponseSchema = z.object({
  items: z.array(AnimalWireDtoSchema),
  failedIds: z.array(z.string()),
});

export type AnimalByIdsResponse = z.infer<typeof AnimalByIdsResponseSchema>;

/**
 * 모든 /api/** 오류 응답(4xx/5xx)의 본문. message는 사용자에게 보여도 되는 문구이며,
 * 키, URL, 업스트림 본문, 설정 상세를 담지 않는다(architecture.md 5절).
 */
export const ApiErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
  }),
});

export type ApiErrorResponse = z.infer<typeof ApiErrorResponseSchema>;
