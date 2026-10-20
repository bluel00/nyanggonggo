import type { ReactNode } from "react";
import { StackOverlay } from "@/shared/ui/stack-overlay";

/**
 * 시험판(spike-stack-nav): 목록에서 카드를 누르면 이 가로챈 경로가 목록 위에 상세를 얹는다(주소는 /animals/{id}).
 * 로딩 경계와 상세 모두 얹은 층 안에 그린다. 직접 진입·새로고침은 가로채지 않아 원래 상세 페이지(app/animals/[id])다.
 */
export default function Layout({ children }: { children: ReactNode }) {
  return <StackOverlay>{children}</StackOverlay>;
}
