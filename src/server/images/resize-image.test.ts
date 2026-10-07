/**
 * 실제 sharp로 변환한다(네이티브 모듈이 이 환경에서 동작하는지도 함께 본다). 입력 이미지는 테스트에서 만든다.
 */
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { detectImageType } from "./image-type";
import { createSharpResizer } from "./resize-image";

const resize = createSharpResizer(75);

async function jpeg(width: number, height: number, orientation?: number) {
  const image = sharp({ create: { width, height, channels: 3, background: { r: 200, g: 120, b: 60 } } }).jpeg();
  return new Uint8Array(await (orientation ? image.withMetadata({ orientation }) : image).toBuffer());
}

describe("createSharpResizer", () => {
  it("비율을 지켜 그 폭으로 줄이고 WebP로 바꾼다", async () => {
    const output = await resize(await jpeg(2000, 1500), 828);
    expect(detectImageType(output)).toBe("image/webp");
    const meta = await sharp(output).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(["webp", 828, 621]);
  });

  it("원본보다 크게 키우지 않는다", async () => {
    const meta = await sharp(await resize(await jpeg(600, 800), 1080)).metadata();
    expect([meta.width, meta.height]).toEqual([600, 800]);
  });

  it("EXIF 방향을 적용한다(세로 사진이 눕지 않게)", async () => {
    // orientation 6: 저장은 가로 1200x900이지만 화면에는 시계 방향 90도 돌려 세로로 보인다
    const meta = await sharp(await resize(await jpeg(1200, 900, 6), 480)).metadata();
    expect([meta.width, meta.height]).toEqual([480, 640]);
  });

  it("이미지가 아니면 예외(프록시가 원본으로 대체한다)", async () => {
    await expect(resize(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]), 480)).rejects.toThrow();
  });
});
