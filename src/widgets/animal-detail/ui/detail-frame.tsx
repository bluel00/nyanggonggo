import type { ComponentProps, ReactNode } from "react";

/**
 * 상세 사진 칸 자리(handoff 화면 3~4, 방향 A). 실제 상세(AnimalDetail)와 뼈대(AnimalDetailSkeleton)가 같이 써서 둘의 칸 위치가 같다.
 * 칸은 위 안전 영역 아래 space-3(--screen-top)에서 시작해 좌우 24px(px-6) 안쪽이다. 뒤로가기는 칸 왼쪽 위에서 8px 안쪽이다(위는 space-2, 왼쪽은 px-6과 같은 rem 단위로 left-8과 같다).
 */
export function DetailPhotoArea({ back, children }: { back: ReactNode; children: ReactNode }) {
  return (
    <div className="relative px-6 pt-(--screen-top)">
      {children}
      <div className="absolute top-[calc(var(--screen-top)+var(--space-2))] left-[calc(--spacing(6)+--spacing(2))]">{back}</div>
    </div>
  );
}

/**
 * 하단 CTA 바(스크롤 컨테이너 안 sticky bottom-0, fixed 아님). 높이는 globals.css의 --bottom-cta-h(pt-3 + 44px 줄 + space-3)에
 * 아래 안전 영역을 더한 값이다. 토스트를 CTA 위로 올리려면 쓰는 쪽에서 data-slot="bottom-cta"를 붙인다(뼈대는 붙이지 않는다).
 */
export function BottomCtaBar(props: ComponentProps<"div">) {
  return (
    <div
      {...props}
      className="sticky bottom-0 z-10 flex gap-2 bg-bg px-page shadow-bar pt-3 pb-[calc(var(--space-3)+env(safe-area-inset-bottom,0px))]"
    />
  );
}
