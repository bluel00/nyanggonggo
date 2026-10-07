"use client";

import { ImageOff } from "lucide-react";
import { useState } from "react";
import { toImageProxySrcSet, toImageProxyUrl } from "@/contract/images";
import { cn } from "@/shared/lib/utils";

/**
 * 공고 사진 한 장. 원본 URL을 이미지 프록시로 바꿔 plain img(lazy)로 그린다.
 * 사진이 없거나 허용되지 않은 원본이거나 로딩에 실패하면 같은 alt의 대체 UI(배경 + 아이콘)를 보인다.
 * 플레이스홀더 디자인은 미정(handoff)이라 최소로 둔다. 종료 공고는 saturate(.7).
 *
 * sizes(표시 폭 힌트)를 주면 프록시의 허용 폭(480/828/1080, WebP)으로 srcset을 만들어 브라우저가 화면 폭 × DPR에 맞는
 * 것을 고른다. 주지 않으면 원본 그대로다(풀스크린 뷰어: 확대해서 보는 화면, architecture.md 5절).
 */

/** 표시 폭 힌트. 카드는 컬럼(최대 480) − 좌우 여백 32, 상세 캐러셀은 컬럼 전체다 */
export const PHOTO_SIZES = {
  card: "(min-width: 480px) 448px, calc(100vw - 32px)",
  detail: "(min-width: 480px) 480px, 100vw",
} as const;

/** srcset을 모르는 브라우저가 받는 기본 폭 */
const DEFAULT_WIDTH = 828;
export function AnimalPhoto({
  src,
  alt,
  ended = false,
  priority = false,
  highPriority = false,
  fit = "cover",
  sizes,
  className,
}: {
  /** 원본 URL(공공 API). null이면 대체 UI */
  src: string | null;
  alt: string;
  ended?: boolean;
  priority?: boolean;
  /**
   * 화면의 첫 사진(목록 첫 카드, 상세 캐러셀 첫 장)만 true. `fetchpriority="high"`로 다른 요청보다 먼저 받는다.
   * 남용하면 서로 대역폭을 다투므로 화면당 한 장만 쓴다(architecture.md 7절).
   */
  highPriority?: boolean;
  /** cover: 4:5 카드/상세(초점 center 35%), contain: 풀스크린 뷰어(원본 비율) */
  fit?: "cover" | "contain";
  /** 표시 폭 힌트(PHOTO_SIZES). 없으면 원본 */
  sizes?: string;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const proxied = src ? toImageProxyUrl(src, sizes ? DEFAULT_WIDTH : undefined) : null;
  const srcSet = src && sizes ? (toImageProxySrcSet(src) ?? undefined) : undefined;

  if (!proxied || failed) {
    return (
      <div role="img" aria-label={alt} className={cn("flex size-full items-center justify-center text-text-2", className)}>
        <ImageOff aria-hidden className="size-6" strokeWidth={1.8} />
      </div>
    );
  }
  return (
    // next/image 대신 프록시 캐시를 쓴다(이중 최적화 비용 회피, architecture.md 12절 23)
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={proxied}
      srcSet={srcSet}
      sizes={srcSet ? sizes : undefined}
      alt={alt}
      loading={priority || highPriority ? "eager" : "lazy"}
      fetchPriority={highPriority ? "high" : undefined}
      decoding="async"
      onError={() => setFailed(true)}
      className={cn(
        "block size-full",
        fit === "cover" ? "object-cover object-[center_35%]" : "object-contain",
        ended && "saturate-70",
        className,
      )}
    />
  );
}
