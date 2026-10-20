import { ViewTransition as ReactViewTransition, type ViewTransitionProps } from "react";

/**
 * React `<ViewTransition>`(architecture.md 14.1 상세 전환). App Router가 쓰는 React canary에는 있고, 저장소의 react 19.2.8
 * (단위 테스트가 쓰는 쪽)에는 없다. 없으면 자식을 그대로 그린다(전환 없이 바로 바뀐다).
 */
export function ViewTransition(props: ViewTransitionProps) {
  if (!ReactViewTransition) return <>{props.children}</>;
  return <ReactViewTransition {...props} />;
}

/** 목록 카드 → 상세 전환의 이동 종류(`next/link`의 transitionTypes). 이 종류일 때만 사진이 이어진다 */
export const CARD_TO_DETAIL = "card-detail";

/**
 * 카드 사진과 상세 사진 칸에 같이 붙이는 전환 속성. 카드 → 상세 이동(CARD_TO_DETAIL)에서만 짝을 이루고(globals.css의
 * `.card-detail`), 뒤로가기·로딩 → 페이지 교체 등 다른 전환에서는 움직이지 않는다.
 */
export function photoTransition(id: string): Omit<ViewTransitionProps, "children"> {
  return { name: `animal-photo-${id}`, share: { [CARD_TO_DETAIL]: CARD_TO_DETAIL, default: "none" }, default: "none" };
}
