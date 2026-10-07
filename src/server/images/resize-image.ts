import sharp from "sharp";

/** 원본 이미지 바이트를 폭 width로 줄인 WebP로 바꾼다. 실패하면 예외(호출하는 쪽이 원본으로 대체한다) */
export type ImageResizer = (data: Uint8Array, width: number) => Promise<Uint8Array<ArrayBuffer>>;

/**
 * sharp 구현(Node 런타임 전용, Vercel 함수 icn1에서 동작. architecture.md 5절).
 * - EXIF 방향을 먼저 적용한다(다시 인코딩하면 EXIF가 빠져 브라우저가 돌려 주지 않는다)
 * - 비율 유지, 원본보다 크게 키우지 않는다
 * - WebP, quality는 2026-10-07 실제 공고 사진 5장 비교로 정했다(SERVER_TUNING.imageProxyWebpQuality)
 */
export function createSharpResizer(quality: number): ImageResizer {
  return async (data, width) => {
    const output = await sharp(data)
      .rotate()
      .resize({ width, withoutEnlargement: true })
      .webp({ quality })
      .toBuffer();
    return Uint8Array.from(output);
  };
}
