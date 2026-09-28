import { describe, expect, it } from "vitest";
import { bytesPrefixHex, detectImageType } from "./image-type";

const bytes = (...values: number[]) => new Uint8Array(values);

describe("detectImageType", () => {
  it.each([
    ["JPEG", bytes(0xff, 0xd8, 0xff, 0xe0, 0x00), "image/jpeg"],
    ["PNG", bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00), "image/png"],
    ["GIF87a", bytes(0x47, 0x49, 0x46, 0x38, 0x37, 0x61), "image/gif"],
    ["GIF89a", bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61), "image/gif"],
    ["WebP", bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x45, 0x42, 0x50, 0), "image/webp"],
  ] as [string, Uint8Array, string][])("%s 시그니처", (_label, data, expected) => {
    expect(detectImageType(data)).toBe(expected);
    expect(detectImageType(data.buffer as ArrayBuffer)).toBe(expected);
  });

  it.each([
    ["빈 바이트", bytes()],
    ["JPEG 시그니처 미완성", bytes(0xff, 0xd8)],
    ["HTML", new TextEncoder().encode("<html><body>")],
    ["RIFF이지만 WEBP 아님(wav)", bytes(0x52, 0x49, 0x46, 0x46, 1, 2, 3, 4, 0x57, 0x41, 0x56, 0x45)],
    ["RIFF인데 12바이트 미만", bytes(0x52, 0x49, 0x46, 0x46, 1, 2)],
    ["PDF", new TextEncoder().encode("%PDF-1.7")],
  ] as [string, Uint8Array][])("이미지가 아니면 null: %s", (_label, data) => {
    expect(detectImageType(data)).toBeNull();
  });
});

describe("bytesPrefixHex", () => {
  it("앞부분만 16진수로", () => {
    expect(bytesPrefixHex(bytes(0xff, 0xd8, 0xff, 0x00), 3)).toBe("ff d8 ff");
    expect(bytesPrefixHex(bytes(1, 2))).toBe("01 02");
  });
});
