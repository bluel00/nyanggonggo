/** FE Domain. UI는 이 타입만 소비한다(architecture.md 6절). 종료 사유와 연락처는 넣지 않는다. */
export type Animal = {
  id: string;
  species: "cat" | "dog" | "other";
  images: string[];
  status: "protected" | "ended";
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
  /** `MM.DD ~ MM.DD` */
  noticePeriodText: string | null;
  /** 특이사항(specialMark). 상세에서만 보여 준다 */
  specialMarkText: string | null;
  /** 품종 이름. 기타 축종은 실제 동물(토끼, 앵무새…)이다. 뽑을 수 없으면 null */
  kindText: string | null;
};

export type AnimalPage = {
  items: Animal[];
  nextCursor: string | null;
};
