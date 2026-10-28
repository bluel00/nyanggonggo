// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { makeAnimal } from "@tests/factories/animal";
import { buildShareContent } from "../model/share-content";
import { SHARE_SHEET_ATTR } from "../model/share-sheet";
import { COPY_LINK_LABEL, SHARE_SHEET_LABEL, ShareSheetButton } from "./share-sheet-button";

const showToast = vi.fn();
vi.mock("@/shared/ui/toast", () => ({ showToast: (message: string) => showToast(message) }));

const writeText = vi.fn(async (_text: string) => {});
const share = vi.fn(async (_data: { title?: string; url?: string }) => {});
const ORIGIN = "https://nyang.example";
const animal = makeAnimal({ noticeEndAt: null });

beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
});
afterEach(() => {
  cleanup();
  showToast.mockClear();
  writeText.mockClear();
  share.mockReset();
  delete (navigator as unknown as Record<string, unknown>).share;
  delete (navigator as unknown as Record<string, unknown>).canShare;
});
const enableShare = (canShare: boolean) => {
  Object.defineProperty(navigator, "share", { configurable: true, value: share });
  Object.defineProperty(navigator, "canShare", { configurable: true, value: () => canShare });
};

describe("ShareSheetButton", () => {
  it("두 이름표를 함께 그린다: 공유 시트용(Share2 + '다른 앱으로 공유')과 복사용(Link + '링크 복사'). 아이콘은 숨긴다", () => {
    render(<ShareSheetButton animal={animal} origin={ORIGIN} />);
    const button = document.querySelector('[data-slot="share-sheet-button"]')!;
    expect(button.getAttribute("aria-label")).toBeNull();
    const sheet = button.querySelector('[data-share-mode="sheet"]')!;
    const copy = button.querySelector('[data-share-mode="copy"]')!;
    expect(sheet.textContent).toBe(SHARE_SHEET_LABEL);
    expect(copy.textContent).toBe(COPY_LINK_LABEL);
    expect(sheet.querySelector("svg")!.getAttribute("class")).toContain("lucide-share-2");
    expect(copy.querySelector("svg")!.getAttribute("class")).toContain("lucide-link");
    for (const svg of button.querySelectorAll("svg")) expect(svg.getAttribute("aria-hidden")).toBe("true");
  });

  it("어느 이름표를 보일지는 <html data-share-sheet>로 CSS가 정한다(기본은 '링크 복사')", () => {
    render(<ShareSheetButton animal={animal} origin={ORIGIN} />);
    const sheet = document.querySelector('[data-share-mode="sheet"]')!.className.split(" ");
    const copy = document.querySelector('[data-share-mode="copy"]')!.className.split(" ");
    expect(sheet).toEqual(expect.arrayContaining(["hidden", `[:root[${SHARE_SHEET_ATTR}]_&]:inline-flex`]));
    expect(copy).toEqual(expect.arrayContaining(["inline-flex", `[:root[${SHARE_SHEET_ATTR}]_&]:hidden`]));
  });

  it("공유 시트를 열 수 있으면 공유 내용의 제목과 주소(og:url과 같은 주소)만 넘긴다", async () => {
    enableShare(true);
    render(<ShareSheetButton animal={animal} origin={ORIGIN} />);
    fireEvent.click(document.querySelector('[data-slot="share-sheet-button"]')!);
    const content = buildShareContent(animal, { origin: ORIGIN, now: new Date() });
    await waitFor(() => expect(share).toHaveBeenCalledWith({ title: content.title, url: content.url }));
    expect(content.url).toBe(`${ORIGIN}/animals/${animal.id}`);
    expect(showToast).not.toHaveBeenCalled();
  });

  it("사용자가 공유 시트를 닫으면 토스트가 없다", async () => {
    enableShare(true);
    share.mockRejectedValueOnce(new DOMException("cancel", "AbortError"));
    render(<ShareSheetButton animal={animal} origin={ORIGIN} />);
    fireEvent.click(document.querySelector('[data-slot="share-sheet-button"]')!);
    await waitFor(() => expect(share).toHaveBeenCalled());
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(showToast).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
  });

  it("공유 시트가 다른 이유로 실패하면 링크를 복사하고 '링크가 복사됐어요'", async () => {
    enableShare(true);
    share.mockRejectedValueOnce(new DOMException("denied", "NotAllowedError"));
    render(<ShareSheetButton animal={animal} origin={ORIGIN} />);
    fireEvent.click(document.querySelector('[data-slot="share-sheet-button"]')!);
    await waitFor(() => expect(showToast).toHaveBeenCalledWith("링크가 복사됐어요"));
    expect(writeText).toHaveBeenCalledWith(`${ORIGIN}/animals/${animal.id}`);
  });

  it("공유 시트를 열 수 없으면 링크를 복사하고 '링크가 복사됐어요'", async () => {
    enableShare(false);
    render(<ShareSheetButton animal={animal} origin={ORIGIN} />);
    fireEvent.click(screen.getByRole("button"));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith("링크가 복사됐어요"));
    expect(share).not.toHaveBeenCalled();
    expect(writeText).toHaveBeenCalledWith(`${ORIGIN}/animals/${animal.id}`);
  });
});
