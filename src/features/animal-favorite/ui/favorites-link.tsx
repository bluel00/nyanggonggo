import { Heart } from "lucide-react";
import Link from "next/link";

/**
 * 목록 헤더의 찜 목록 버튼(handoff: 44x44, 중립색, 개수 배지 없음). /favorites의 유일한 진입 경로다.
 */
export function FavoritesLink() {
  return (
    <Link
      href="/favorites"
      aria-label="찜 목록"
      className="inline-flex size-touch items-center justify-center rounded-pill text-text transition-transform duration-press ease-out active:scale-press focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <Heart aria-hidden className="size-[22px]" strokeWidth={1.8} />
    </Link>
  );
}
