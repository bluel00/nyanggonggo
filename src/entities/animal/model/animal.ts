/** FE Domain. UI는 이 타입만 소비한다(architecture.md 6절). 담당자 이름은 쓰는 곳이 없어 넣지 않는다(#90). */
export type Animal = {
  id: string;
  species: "cat" | "dog" | "other";
  images: string[];
  status: "protected" | "ended";
  /** 종료 결과(입양, 반환, 자연사…) 원문. 값 목록을 고정하지 않는다. 종료가 아니거나 모르면 null(이슈 #41) */
  endResultText: string | null;
  /** 공고 종료일 00:00 KST */
  noticeEndAt: Date | null;
  sex: "male" | "female" | "unknown";
  /** 1단계는 API 원문 유지. 표기 정제는 미정(architecture.md 12절) */
  ageText: string | null;
  /** orgNm */
  regionText: string;
  /** careNm. 동물병원일 수 있다 */
  shelterName: string | null;
  /** happenPlace */
  foundPlaceText: string | null;
  /** careAddr. 상세 정보 줄(종료 공고는 숨긴다) */
  shelterAddressText: string | null;
  /** careTel 원문. 상세 정보 줄(종료 공고는 숨긴다) */
  shelterTelText: string | null;
  /** 공고 번호(noticeNo) 원문. 상세 정보 줄과 카드 3줄(이슈 #59). 구조 번호(id)와 다르다 */
  noticeNoText: string | null;
  /** `MM.DD ~ MM.DD` */
  noticePeriodText: string | null;
  /** 특이사항(specialMark). 상세에서만 보여 준다 */
  specialMarkText: string | null;
  /** 종료 사유(endReason) 원문. 상세 정보 줄에만 쓴다(이슈 #41) */
  endReasonText: string | null;
  /** 품종 이름. 기타 축종은 실제 동물(토끼, 앵무새…)이다. 뽑을 수 없으면 null */
  kindText: string | null;
};

export type AnimalPage = {
  items: Animal[];
  nextCursor: string | null;
};

/** 여러 id 조회 결과. 못 찾은 id는 어디에도 없고, 오류로 조회하지 못한 id는 failedIds에 있다(이슈 #5) */
export type AnimalsByIds = {
  items: Animal[];
  failedIds: string[];
};
