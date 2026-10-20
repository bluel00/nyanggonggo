// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { warmFonts, warmFontsAfterImages } from "./font-warm";

const load = vi.fn(() => Promise.resolve([]));
let idleCallbacks: (() => void)[];

beforeEach(() => {
  idleCallbacks = [];
  Object.defineProperty(document, "fonts", { configurable: true, value: { load } });
  vi.stubGlobal("requestIdleCallback", (cb: () => void) => idleCallbacks.push(cb));
  vi.stubGlobal("cancelIdleCallback", () => {});
});
afterEach(() => {
  load.mockClear();
  vi.unstubAllGlobals();
});

/** 아직 로드되지 않은 사진 */
function pendingImage() {
  const img = document.createElement("img");
  Object.defineProperty(img, "complete", { configurable: true, value: false });
  return img;
}
const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("warmFonts", () => {
  it("본문 글꼴(Pretendard Variable)로 그 글자의 조각을 받는다", () => {
    warmFonts("보호소");
    expect(load).toHaveBeenCalledWith('16px "Pretendard Variable"', "보호소");
  });
});

describe("warmFontsAfterImages", () => {
  it("사진이 모두 로드된 뒤 유휴 시간에 받는다(첫 화면 사진과 겹치지 않게)", async () => {
    const a = pendingImage();
    const b = pendingImage();
    warmFontsAfterImages([a, b], "발견 장소");
    await flush();
    expect(idleCallbacks).toHaveLength(0);

    a.dispatchEvent(new Event("load"));
    await flush();
    expect(idleCallbacks).toHaveLength(0);

    b.dispatchEvent(new Event("error")); // 실패해도 끝난 것으로 본다
    await flush();
    expect(load).not.toHaveBeenCalled();
    idleCallbacks.forEach((cb) => cb());
    expect(load).toHaveBeenCalledWith('16px "Pretendard Variable"', "발견 장소");
  });

  it("받기 전에 취소하면 받지 않는다(목록을 떠남)", async () => {
    const a = pendingImage();
    const cancel = warmFontsAfterImages([a], "공고 기간");
    cancel();
    a.dispatchEvent(new Event("load"));
    await flush();
    idleCallbacks.forEach((cb) => cb());
    expect(load).not.toHaveBeenCalled();
  });
});
