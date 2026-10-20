import type { ReactNode } from "react";
import { StackLayer } from "@/shared/ui/stack-layer";

/**
 * 목록·찜에서 카드를 누르면 `/animals/{id}`를 가로채 지금 화면 위에 상세를 얹는다(PRD-v1.5 R1). 아래 화면은 내려가지 않는다.
 * 로딩 경계와 상세가 모두 이 층 안이라, 로딩 화면 → 상세로 바뀌어도 층은 그대로다.
 */
export default function Layout({ children }: { children: ReactNode }) {
  return <StackLayer>{children}</StackLayer>;
}
