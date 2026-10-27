import { animalSummaryText, getPrimaryImage, speciesText, type Animal } from "@/entities/animal";
import { routes } from "@/shared/config/routes";

/**
 * 공유 내용(용어 사전 "공유 내용", #73). 공고를 밖으로 내보낼 때 쓰는 제목 바탕, 공유 요약, 사진, 주소의 묶음이다.
 * 플랫폼을 모르는 계약이고, 링크 미리보기(OG 메타·OG 이미지 모델, app/animals/[id]/og-model.ts)와 공유 카드·링크 복사(share.ts)가
 * 이것을 쓴다. 네 출력이 함께 쓰는 것만 담는다. 출력에만 필요한 것은 출력 쪽이 덧붙이거나 공고에서 직접 읽는다
 * (OG 제목의 " 공고 | 서비스 이름", OG 이미지의 상태 칩·보호소, 카카오의 이미지 프록시 주소·버튼).
 */
export type ShareContent = {
  /** 제목 바탕: 지역 + 동물(기타 축종은 실제 동물 이름). 공유 카드 제목은 이것 그대로다 */
  title: string;
  /** 공유 요약: 성별 · 나이 · 상태(· D-N) · 특이사항 */
  summary: string;
  /** 대표 사진의 원본 주소. 없으면 null. 출력마다 쓰는 방법이 다르다(카카오는 이미지 프록시, OG 이미지는 서버가 직접 받는다) */
  photoSrc: string | null;
  /** 상세 경로(routes.detail) */
  path: string;
  /** 절대 주소: origin + path */
  url: string;
};

/**
 * 공유 내용을 만든다. 순수 함수다.
 * origin: 주소 기준(서버의 siteOrigin, 끝 슬래시 없음). now: 공유 요약의 상태·D-N 기준 시각. 출력마다 지금처럼 자기 시각을 넣는다
 * (링크 미리보기는 서버가 요청을 받은 시각, 공유 카드는 버튼을 누른 기기의 시각).
 */
export function buildShareContent(animal: Animal, { origin, now }: { origin: string; now: Date }): ShareContent {
  const path = routes.detail(animal.id);
  return {
    title: `${animal.regionText} ${speciesText(animal)}`,
    summary: animalSummaryText(animal, now),
    photoSrc: getPrimaryImage(animal),
    path,
    url: `${origin}${path}`,
  };
}
