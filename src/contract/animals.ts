import { z } from "zod";

/**
 * 서버(BFF) ↔ 브라우저 계약. 원시 타입만 쓴다(날짜는 문자열).
 * 연락처(careTel, careAddr, careOwnerNm)와 종료 사유(endReason)는 넣지 않는다.
 */
export const AnimalWireDtoSchema = z.object({
  id: z.string(),
  species: z.enum(["cat", "dog", "other"]),
  images: z.array(z.string()),
  status: z.enum(["protected", "ended"]),
  /** 공고 종료일, KST 달력 날짜 `YYYY-MM-DD` */
  noticeEndDate: z.string().nullable(),
  sex: z.enum(["male", "female", "unknown"]),
  ageText: z.string().nullable(),
  regionText: z.string(),
  shelterName: z.string().nullable(),
  foundPlaceText: z.string().nullable(),
  /** `MM.DD ~ MM.DD` */
  noticePeriodText: z.string().nullable(),
  /** 특이사항(specialMark). 공백뿐이면 null */
  specialMarkText: z.string().nullable(),
  /**
   * 품종 이름(`kindFullNm`의 `[축종]` 뒤). 기타 축종은 이 값이 실제 동물(토끼, 앵무새…)이라
   * 화면에서 "어떤 동물인지" 보여 주는 데 쓴다. 뽑을 수 없으면 null
   */
  kindText: z.string().nullable(),
});

export type AnimalWireDto = z.infer<typeof AnimalWireDtoSchema>;

export const AnimalListResponseSchema = z.object({
  items: z.array(AnimalWireDtoSchema),
  nextCursor: z.string().nullable(),
});

export type AnimalListResponse = z.infer<typeof AnimalListResponseSchema>;

/** GET /api/animals/by-ids 한 번에 보낼 수 있는 id 최대 개수. 서버는 넘으면 400, 클라이언트는 이 단위로 나눠 보낸다. */
export const ANIMAL_BY_IDS_MAX = 50;

/** GET /api/animals/by-ids. 못 찾은 id는 빠지고, 순서는 요청한 ids 순서를 따른다. */
export const AnimalByIdsResponseSchema = z.object({
  items: z.array(AnimalWireDtoSchema),
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
