import { z } from "zod";

/**
 * 공공 API(abandonmentPublic_v2) 응답 item 1건. 필드명과 값을 그대로 받는다(모두 문자열).
 * 도착 검증만 한다. 가공, 변환, 파생은 서버 Mapper가 한다.
 *
 * 사진은 `popfile1..N`으로 개수가 가변이라 알 수 없는 키를 버리지 않는다(looseObject).
 * 그 외 알 수 없는 키도 파싱을 깨뜨리지 않으며, Mapper는 선언된 필드와 `popfileN`만 읽는다.
 */
export const UpstreamAnimalItemSchema = z.looseObject({
  desertionNo: z.string(),
  happenDt: z.string(),
  happenPlace: z.string(),
  kindFullNm: z.string(),
  upKindCd: z.string(),
  upKindNm: z.string(),
  kindCd: z.string(),
  kindNm: z.string(),
  colorCd: z.string(),
  age: z.string(),
  weight: z.string(),
  noticeNo: z.string(),
  noticeSdt: z.string(),
  noticeEdt: z.string(),
  popfile1: z.string().optional(),
  popfile2: z.string().optional(),
  processState: z.string(),
  sexCd: z.string(),
  neuterYn: z.string(),
  specialMark: z.string(),
  careRegNo: z.string(),
  careNm: z.string(),
  careTel: z.string(),
  careAddr: z.string(),
  careOwnerNm: z.string(),
  orgNm: z.string(),
  updTm: z.string(),
  vaccinationChk: z.string().optional(),
  sfeSoci: z.string().optional(),
  sfeHealth: z.string().optional(),
  endReason: z.string().optional(),
});

export type UpstreamAnimalItemDto = z.infer<typeof UpstreamAnimalItemSchema>;
