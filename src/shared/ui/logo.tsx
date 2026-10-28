import Image from "next/image";
import lockupSrc from "@/shared/assets/logo/myeongnyang-lockup.svg";
import markSrc from "@/shared/assets/logo/myeongnyang-mark.svg";
import tileSmallSrc from "@/shared/assets/logo/myeongnyang-tile-small.svg";
import tileSrc from "@/shared/assets/logo/myeongnyang-tile.svg";
import { SERVICE_NAME } from "@/shared/config/service";
import { cn } from "@/shared/lib/utils";

/** 상징 변형. 원본 파일은 shared/assets/logo/(디자인 시스템 Logo 그대로, 용어 사전 7. 브랜드) */
export type LogoVariant = "tile-small" | "tile" | "line";

/** 상징만(mark) / 상징 + 이름 윤곽선 가로 조합(lockup) */
export type LogoCombo = "mark" | "lockup";

/** 크기(px, 상징의 한 변 = 로고 높이)로 변형을 고른다: 24 이하 tile-small, 25~55 tile, 56 이상 line(선만, 타일 없음) */
export function logoVariant(size: number): LogoVariant {
  if (size <= 24) return "tile-small";
  if (size < 56) return "tile";
  return "line";
}

const SYMBOL_SRC = { "tile-small": tileSmallSrc, tile: tileSrc, line: markSrc } as const;

/*
 * 가로 조합 원본(myeongnyang-lockup.svg)은 높이 56 기준 viewBox 130.34 × 56이다: 상징(line) 0~56, 간격 10, 이름 윤곽선 66~130.34.
 * 56 이상은 원본 그대로 쓴다. 56 미만은 상징이 타일이어야 하므로 크기에 맞는 타일을 두고, 이름은 같은 원본에서 이름 부분만 잘라 보인다
 * (이름만 있는 원본 파일이 없어 새 파일을 만들지 않는다).
 */
const LOCKUP = { width: 130.34, height: 56, nameStart: 66 } as const;

/**
 * 서비스 로고. 쓰는 쪽은 크기(높이 px)와 조합만 말하고, 변형은 크기로 정한다. 접근성 이름은 서비스 이름(그림 안 글자는 읽히지 않는다).
 * 그림은 움직이지 않는다.
 *
 * priority: 화면의 첫 큰 그림(LCP)이면 true(홈 헤더). next/image 기본값인 지연 로딩을 끄고(eager) 다른 요청보다 먼저 받는다(fetchpriority high).
 */
export function Logo({
  size,
  combo = "mark",
  priority = false,
  className,
}: {
  size: number;
  combo?: LogoCombo;
  priority?: boolean;
  className?: string;
}) {
  const variant = logoVariant(size);
  const scale = size / LOCKUP.height;
  const loading = priority ? ({ loading: "eager", fetchPriority: "high" } as const) : {};
  return (
    <span
      role="img"
      aria-label={SERVICE_NAME}
      data-slot="logo"
      data-variant={variant}
      data-combo={combo}
      className={cn("inline-flex flex-none items-center", className)}
    >
      {combo === "lockup" && variant === "line" ? (
        <Image src={lockupSrc} alt="" aria-hidden unoptimized width={LOCKUP.width * scale} height={size} {...loading} />
      ) : (
        <>
          <Image src={SYMBOL_SRC[variant]} alt="" aria-hidden unoptimized width={size} height={size} {...loading} />
          {combo === "lockup" && (
            <span
              aria-hidden
              className="overflow-hidden"
              style={{ marginLeft: (LOCKUP.nameStart - LOCKUP.height) * scale, width: (LOCKUP.width - LOCKUP.nameStart) * scale, height: size }}
            >
              <Image
                src={lockupSrc}
                alt=""
                unoptimized
                width={LOCKUP.width * scale}
                height={size}
                className="max-w-none"
                style={{ marginLeft: -LOCKUP.nameStart * scale }}
                {...loading}
              />
            </span>
          )}
        </>
      )}
    </span>
  );
}
