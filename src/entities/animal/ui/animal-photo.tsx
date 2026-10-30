"use client";

import { ImageOff } from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { toImageProxySrcSet, toImageProxyUrl } from "@/contract/images";
import { cn } from "@/shared/lib/utils";

/**
 * 공고 사진 한 장. 원본 URL을 이미지 프록시로 바꿔 plain img(lazy)로 그린다.
 * 사진이 없거나 허용되지 않은 원본이거나 로딩에 실패하면 같은 alt의 대체 UI(배경 + 아이콘)를 보인다.
 * 플레이스홀더 디자인은 미정(handoff)이라 최소로 둔다. 종료 공고는 saturate(.7).
 *
 * sizes(표시 폭 힌트)를 주면 프록시의 허용 폭(480/828/1080, WebP)으로 srcset을 만들어 브라우저가 화면 폭 × DPR에 맞는
 * 것을 고른다. 주지 않으면 원본 그대로다(풀스크린 뷰어: 확대해서 보는 화면, architecture.md 5절).
 *
 * knownSrc를 주면 그 주소(이미 받아 디코드한 카드 사진의 currentSrc)를 그대로 쓰고 바로 디코드한다(decoding="sync"). 카드 → 상세
 * 진입에서 상세 첫 사진이 새로 받거나 디코드를 기다리느라 비는 프레임이 없게 한다(architecture.md 14.2 4단계).
 *
 * shimmer를 켜면(목록 카드, 상세 캐러셀) 사진이 로드될 때까지 칸을 채우는 status-ended-bg 층에 로딩 시머를 둔다(handoff (j) L4).
 * 칸마다 따로 멈추고, 실패하면 대체 UI만이다(시머 없음). 층은 사진 아래에 있어(사진이 relative라 뒤에 칠해진다) 로드된 사진이 칠해지는
 * 순간 하이드레이션 전이라도 가린다. 층은 load 때 뺀다. 하이드레이션 전에 이미 끝난 load·error(캐시된 사진)는 이벤트가 다시 오지 않으므로
 * 칠하기 전(layout effect)에 img.complete로 본다. 부모 칸은 자리 잡기(relative)가 되어 있어야 한다.
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
  knownSrc,
  decodeSync = false,
  shimmer = false,
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
  /** cover: 목록 카드(1:1, 가운데), contain: 상세 캐러셀과 풀스크린 뷰어(자르지 않음) */
  fit?: "cover" | "contain";
  /** 표시 폭 힌트(PHOTO_SIZES). 없으면 원본 */
  sizes?: string;
  /** 이미 받아 둔 같은 사진의 주소. 있으면 srcset 대신 이 주소를 쓴다 */
  knownSrc?: string;
  /** 바로 디코드한다(다시 마운트된 상세 사진이 이미 받은 이미지를 비는 프레임 없이 그리게) */
  decodeSync?: boolean;
  /** 로드될 때까지 로딩 시머 층을 둔다 */
  shimmer?: boolean;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const proxied = src ? (knownSrc ?? toImageProxyUrl(src, sizes ? DEFAULT_WIDTH : undefined)) : null;
  const srcSet = src && sizes && !knownSrc ? (toImageProxySrcSet(src) ?? undefined) : undefined;
  // 로드된 주소. 주소가 바뀌면(다른 사진) 다시 로딩이다
  const [loadedSrc, setLoadedSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  useLayoutEffect(() => {
    const img = imgRef.current;
    if (!img?.complete || !proxied) return;
    if (img.naturalWidth > 0) setLoadedSrc(proxied);
    // 받기 시작한 뒤 끝났는데 크기가 없으면 실패다. 아직 받지 않은 지연 로딩 사진은 currentSrc가 비어 있어 여기서 거른다
    else if (img.currentSrc) setFailed(true);
  }, [proxied]);

  if (!proxied || failed) {
    return (
      <div role="img" aria-label={alt} className={cn("flex size-full items-center justify-center text-text-2", className)}>
        <ImageOff aria-hidden className="size-6" strokeWidth={1.8} />
      </div>
    );
  }
  const loading = shimmer && loadedSrc !== proxied;
  return (
    <>
      {loading && <span aria-hidden data-slot="photo-loading" data-shimmer="" className="absolute inset-0 bg-status-ended-bg" />}
      {/* next/image 대신 프록시 캐시를 쓴다(이중 최적화 비용 회피, architecture.md 12절 23) */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        ref={imgRef}
        src={proxied}
        srcSet={srcSet}
        sizes={srcSet ? sizes : undefined}
        alt={alt}
        loading={priority || highPriority ? "eager" : "lazy"}
        fetchPriority={highPriority ? "high" : undefined}
        decoding={knownSrc || decodeSync ? "sync" : "async"}
        onLoad={() => setLoadedSrc(proxied)}
        onError={() => setFailed(true)}
        className={cn(
          "block size-full",
          shimmer && "relative",
          fit === "cover" ? "object-cover object-center" : "object-contain",
          ended && "saturate-70",
          className,
        )}
      />
    </>
  );
}
