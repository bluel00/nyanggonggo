// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { SHARE_MESSAGES } from "./share";
import { canOpenShareSheet, SHARE_SHEET_ATTR, SHARE_SHEET_SCRIPT, shareViaSheet, type ShareSheetNavigator } from "./share-sheet";

const URL_ = "https://nyang.example/animals/1";
const TARGET = { title: "가나시 다라구 고양이", url: URL_ };

const deps = (nav: ShareSheetNavigator | undefined) => ({
  nav,
  copy: vi.fn(async (_text: string) => {}),
  notify: vi.fn(),
  onIssue: vi.fn(),
});

describe("canOpenShareSheet", () => {
  it("navigator.share가 없으면 열 수 없다", () => {
    expect(canOpenShareSheet(undefined, URL_)).toBe(false);
    expect(canOpenShareSheet({}, URL_)).toBe(false);
  });

  it("share가 있고 canShare가 없으면 열 수 있다", () => {
    expect(canOpenShareSheet({ share: async () => {} }, URL_)).toBe(true);
  });

  it("canShare가 있으면 canShare({ url })의 답을 따른다(던지면 열 수 없다)", () => {
    const canShare = vi.fn(() => true);
    expect(canOpenShareSheet({ share: async () => {}, canShare }, URL_)).toBe(true);
    expect(canShare).toHaveBeenCalledWith({ url: URL_ });
    expect(canOpenShareSheet({ share: async () => {}, canShare: () => false }, URL_)).toBe(false);
    expect(
      canOpenShareSheet({ share: async () => {}, canShare: () => { throw new Error("x"); } }, URL_),
    ).toBe(false);
  });
});

describe("SHARE_SHEET_SCRIPT(첫 그림 전 <head> 스크립트)", () => {
  const original = Object.getOwnPropertyDescriptors(navigator);
  afterEach(() => {
    document.documentElement.removeAttribute(SHARE_SHEET_ATTR);
    for (const key of ["share", "canShare"] as const) {
      if (!(key in original)) delete (navigator as unknown as Record<string, unknown>)[key];
    }
  });
  const run = () => new Function(SHARE_SHEET_SCRIPT)();
  const setNav = (value: Partial<ShareSheetNavigator>) => {
    for (const [key, fn] of Object.entries(value)) Object.defineProperty(navigator, key, { configurable: true, value: fn });
  };

  it("같은 판정 함수를 바깥 이름 없이 그대로 담는다", () => {
    expect(SHARE_SHEET_SCRIPT).toContain(canOpenShareSheet.toString());
    expect(SHARE_SHEET_SCRIPT).not.toMatch(/import|require\(/);
  });

  it("공유 시트를 열 수 있으면 <html data-share-sheet>를 단다", () => {
    setNav({ share: async () => {}, canShare: () => true });
    run();
    expect(document.documentElement.hasAttribute(SHARE_SHEET_ATTR)).toBe(true);
  });

  it("열 수 없으면(share 없음 또는 canShare 거짓) 달지 않는다", () => {
    run();
    expect(document.documentElement.hasAttribute(SHARE_SHEET_ATTR)).toBe(false);
    setNav({ share: async () => {}, canShare: () => false });
    run();
    expect(document.documentElement.hasAttribute(SHARE_SHEET_ATTR)).toBe(false);
  });
});

describe("shareViaSheet", () => {
  it("열 수 있으면 제목과 주소만 넘겨 공유 시트를 연다(토스트 없음)", async () => {
    const share = vi.fn(async () => {});
    const d = deps({ share });
    expect(await shareViaSheet(TARGET, d)).toBe("shared");
    expect(share).toHaveBeenCalledWith({ title: TARGET.title, url: URL_ });
    expect(d.copy).not.toHaveBeenCalled();
    expect(d.notify).not.toHaveBeenCalled();
  });

  it("사용자가 시트를 닫으면(AbortError) 아무것도 하지 않는다(복사·토스트 없음)", async () => {
    const d = deps({ share: async () => { throw new DOMException("cancel", "AbortError"); } });
    expect(await shareViaSheet(TARGET, d)).toBe("cancelled");
    expect(d.copy).not.toHaveBeenCalled();
    expect(d.notify).not.toHaveBeenCalled();
  });

  it("그 밖의 실패는 링크 복사 + '링크가 복사됐어요'로 대신한다", async () => {
    const d = deps({ share: async () => { throw new DOMException("denied", "NotAllowedError"); } });
    expect(await shareViaSheet(TARGET, d)).toBe("copied");
    expect(d.copy).toHaveBeenCalledWith(URL_);
    expect(d.notify).toHaveBeenCalledWith(SHARE_MESSAGES.copied);
    expect(d.onIssue).toHaveBeenCalled();
  });

  it("열 수 없으면 링크 복사 + '링크가 복사됐어요'", async () => {
    const d = deps({ share: async () => {}, canShare: () => false });
    expect(await shareViaSheet(TARGET, d)).toBe("copied");
    expect(d.copy).toHaveBeenCalledWith(URL_);
    expect(d.notify).toHaveBeenCalledWith("링크가 복사됐어요");
  });

  it("복사도 실패하면 '공유에 실패했어요 …'", async () => {
    const d = deps(undefined);
    d.copy.mockRejectedValueOnce(new Error("no clipboard"));
    expect(await shareViaSheet(TARGET, d)).toBe("failed");
    expect(d.notify).toHaveBeenCalledWith(SHARE_MESSAGES.failed);
  });
});
