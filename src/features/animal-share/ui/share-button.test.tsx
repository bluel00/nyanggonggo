// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Animal } from "@/entities/animal";
import { KAKAO_SDK_INTEGRITY, KAKAO_SDK_URL, ShareButton } from "./share-button";

const showToast = vi.fn();
vi.mock("@/shared/ui/toast", () => ({ showToast: (message: string) => showToast(message) }));

const writeText = vi.fn(async (_text: string) => {});
beforeEach(() => {
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: { writeText } });
});
afterEach(() => {
  cleanup();
  showToast.mockClear();
  writeText.mockClear();
  delete (window as unknown as { Kakao?: unknown }).Kakao;
});

const animal: Animal = {
  id: "1",
  species: "cat",
  images: [],
  status: "protected",
  noticeEndAt: null,
  sex: "unknown",
  ageText: null,
  regionText: "서울특별시",
  shelterName: null,
  foundPlaceText: null,
  noticePeriodText: null,
};

describe("카카오 SDK 상수", () => {
  it("Full SDK(minified) 2.8.3과 sha384 integrity를 함께 둔다", () => {
    expect(KAKAO_SDK_URL).toBe("https://t1.kakaocdn.net/kakao_js_sdk/2.8.3/kakao.min.js");
    expect(KAKAO_SDK_INTEGRITY).toBe("sha384-oroumrnFVE0xtgqyDZJARgERibXg2C28380uaUZz2kHDS5CR7tu20eGiOU6GkTpy");
  });
});

describe("ShareButton", () => {
  it("키가 없으면(기본값 NEXT_PUBLIC_KAKAO_JS_KEY 미설정) SDK를 불러오지 않고 링크를 복사한다", async () => {
    render(<ShareButton animal={animal} />);
    expect(document.querySelector("script#kakao-sdk")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "카카오톡 공유" }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith("링크가 복사됐어요"));
    expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/animals/1`);
  });

  it("키가 있어도 SDK가 로드되지 않았으면 링크 복사로 폴백한다", async () => {
    render(<ShareButton animal={animal} kakaoKey="test-kakao-key" />);
    fireEvent.click(screen.getByRole("button", { name: "카카오톡 공유" }));
    await waitFor(() => expect(showToast).toHaveBeenCalledWith("링크가 복사됐어요"));
  });

  it("SDK가 있으면 카카오톡 공유를 호출하고 토스트는 띄우지 않는다", async () => {
    const sendDefault = vi.fn();
    (window as unknown as { Kakao: unknown }).Kakao = { isInitialized: () => true, init: vi.fn(), Share: { sendDefault } };
    render(<ShareButton animal={animal} kakaoKey="test-kakao-key" />);
    fireEvent.click(screen.getByRole("button", { name: "카카오톡 공유" }));
    await waitFor(() => expect(sendDefault).toHaveBeenCalledOnce());
    expect(showToast).not.toHaveBeenCalled();
    expect(writeText).not.toHaveBeenCalled();
  });
});
