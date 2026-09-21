import { z } from "zod";

/**
 * 서버(BFF) ↔ 브라우저 계약. 원시 타입만 쓴다(날짜는 문자열).
 * 연락처(careTel, careAddr, careOwnerNm)와 종료 사유(endReason)는 넣지 않는다.
 */
export const AnimalWireDtoSchema = z.object({
  id: z.string(),
  species: z.enum(["cat", "dog"]),
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
});

export type AnimalWireDto = z.infer<typeof AnimalWireDtoSchema>;

export const AnimalListResponseSchema = z.object({
  items: z.array(AnimalWireDtoSchema),
  nextCursor: z.string().nullable(),
});

export type AnimalListResponse = z.infer<typeof AnimalListResponseSchema>;
