import { z } from "zod";

/**
 * 공공 API(abandonmentPublic_v2) 응답 item 1건. 필드명과 값을 그대로 받는다(모두 문자열).
 * 도착 검증만 한다. 가공, 변환, 파생은 서버 Mapper가 한다.
 *
 * 필수는 "없으면 유효한 WireDto를 만들 수 없는 필드"만이다(architecture.md 4절).
 * 나머지는 optional이고 Mapper가 null 또는 빈 배열로 처리한다.
 *
 * 사진은 `popfile1..N`으로 개수가 가변이라 알 수 없는 키를 버리지 않는다(looseObject).
 * 그 외 알 수 없는 키도 파싱을 깨뜨리지 않으며, Mapper는 선언된 필드와 `popfileN`만 읽는다.
 */
export const UpstreamAnimalItemSchema = z.looseObject({
  // 필수: id, status, species, 공고 종료일(D-day, endingSoon 정렬), regionText(non-null)
  desertionNo: z.string().min(1),
  processState: z.string(),
  upKindNm: z.string(),
  noticeEdt: z.string(),
  orgNm: z.string(),

  happenDt: z.string().optional(),
  happenPlace: z.string().optional(),
  kindFullNm: z.string().optional(),
  upKindCd: z.string().optional(),
  kindCd: z.string().optional(),
  kindNm: z.string().optional(),
  colorCd: z.string().optional(),
  age: z.string().optional(),
  weight: z.string().optional(),
  noticeNo: z.string().optional(),
  noticeSdt: z.string().optional(),
  popfile1: z.string().optional(),
  popfile2: z.string().optional(),
  sexCd: z.string().optional(),
  neuterYn: z.string().optional(),
  specialMark: z.string().optional(),
  careRegNo: z.string().optional(),
  careNm: z.string().optional(),
  careTel: z.string().optional(),
  careAddr: z.string().optional(),
  careOwnerNm: z.string().optional(),
  updTm: z.string().optional(),
  vaccinationChk: z.string().optional(),
  sfeSoci: z.string().optional(),
  sfeHealth: z.string().optional(),
  endReason: z.string().optional(),
});

export type UpstreamAnimalItemDto = z.infer<typeof UpstreamAnimalItemSchema>;
