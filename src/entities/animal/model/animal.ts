/** FE Domain. UI는 이 타입만 소비한다(architecture.md 6절). 종료 사유와 연락처는 넣지 않는다. */
export type Animal = {
  id: string;
  species: "cat" | "dog";
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
};

export type AnimalPage = {
  items: Animal[];
  nextCursor: string | null;
};
