import type { ViewTransitionProps } from "react";

/** 목록 카드 → 상세 전환의 이동 종류(`next/link`의 transitionTypes). 이 종류일 때만 사진이 이어진다 */
export const CARD_TO_DETAIL = "card-detail";

/**
 * 카드 사진과 상세 사진 칸에 같이 붙이는 전환 속성(`shared/ui/view-transition`의 ViewTransition에 넘긴다). 카드 → 상세
 * 이동(CARD_TO_DETAIL)에서만 짝을 이루고(globals.css의 `.card-detail`), 뒤로가기·로딩 → 페이지 교체 등 다른 전환에서는 움직이지 않는다.
 */
export function photoTransition(id: string): Omit<ViewTransitionProps, "children"> {
  return { name: `animal-photo-${id}`, share: { [CARD_TO_DETAIL]: CARD_TO_DETAIL, default: "none" }, default: "none" };
}
