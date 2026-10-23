import { ViewTransition as ReactViewTransition, type ViewTransitionProps } from "react";

/**
 * React `<ViewTransition>`(architecture.md 14.1 상세 전환). App Router가 쓰는 React canary에는 있고, 저장소의 react 19.2.8
 * (단위 테스트가 쓰는 쪽)에는 없다. 없으면 자식을 그대로 그린다(전환 없이 바로 바뀐다).
 * 전환 이름과 짝 규칙은 쓰는 쪽이 정한다(카드 → 상세 사진은 `entities/animal`의 photoTransition).
 */
export function ViewTransition(props: ViewTransitionProps) {
  if (!ReactViewTransition) return <>{props.children}</>;
  return <ReactViewTransition {...props} />;
}
