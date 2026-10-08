/** 사진 원본의 가로·세로(px). 서버가 첫 사진에서 읽어 넘긴다(app/animals/[id]/page.tsx) */
export type PhotoSize = { width: number; height: number };

/** 상세 사진 칸 비율(가로/세로)의 범위와 크기를 모를 때의 값(PRD v1.3, 디자인 README 사진 규칙) */
export const PHOTO_BOX_RATIO = { min: 3 / 4, max: 4 / 3, unknown: 1 } as const;

/**
 * 상세 사진 칸 비율 = 첫 사진의 가로/세로를 3:4~4:3으로 제한한 값. 크기를 모르면(시간 초과, 실패) 1:1.
 * 칸 안의 사진은 모두 contain이라 잘리지 않는다. 범위 밖 사진(세로로 아주 길거나 가로로 아주 긴)은 칸 안에서 여백이 생긴다.
 */
export function photoBoxRatio(size: PhotoSize | null | undefined): number {
  if (!size || !(size.width > 0) || !(size.height > 0)) return PHOTO_BOX_RATIO.unknown;
  return Math.min(PHOTO_BOX_RATIO.max, Math.max(PHOTO_BOX_RATIO.min, size.width / size.height));
}
