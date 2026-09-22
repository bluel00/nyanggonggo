"use client";

import { ImageOff } from "lucide-react";
import { useState } from "react";
import { toImageProxyUrl } from "@/contract/images";
import { cn } from "@/shared/lib/utils";

/**
 * 공고 사진 한 장. 원본 URL을 이미지 프록시로 바꿔 plain img(lazy)로 그린다.
 * 사진이 없거나 허용되지 않은 원본이거나 로딩에 실패하면 같은 alt의 대체 UI(배경 + 아이콘)를 보인다.
 * 플레이스홀더 디자인은 미정(handoff)이라 최소로 둔다. 종료 공고는 saturate(.7).
 */
export function AnimalPhoto({
  src,
  alt,
  ended = false,
  priority = false,
  fit = "cover",
  className,
}: {
  /** 원본 URL(공공 API). null이면 대체 UI */
  src: string | null;
  alt: string;
  ended?: boolean;
  priority?: boolean;
  /** cover: 4:5 카드/상세(초점 center 35%), contain: 풀스크린 뷰어(원본 비율) */
  fit?: "cover" | "contain";
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  const proxied = src ? toImageProxyUrl(src) : null;

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
      alt={alt}
      loading={priority ? "eager" : "lazy"}
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
