// @vitest-environment jsdom
/**
 * 홈 캐릭터 Rive: 움직임 줄이기 설정이면 런타임을 아예 받지 않고, 로드가 실패하면 정지 이미지를 두며,
 * 카드를 누르는 순간(pointerdown) 그 캐릭터에 press를 보낸다. Rive 런타임은 가짜 모듈로 바꾼다.
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCharacterAnimationForTest } from "@/entities/animal/lib/character-animation";
import { SpeciesChoice } from "./species-choice";

const runtime = vi.hoisted(() => ({
  imported: false,
  triggers: [] as string[],
  instances: [] as { artboard?: string; cleanup: () => void }[],
}));

vi.mock("@rive-app/canvas-lite", () => {
  runtime.imported = true;
  class Rive {
    artboard?: string;
    cleanup = vi.fn();
    viewModelInstance = {
      trigger: (name: string) => ({ trigger: () => runtime.triggers.push(`${this.artboard}:${name}`) }),
    };
    constructor(params: { artboard?: string; onLoad?: () => void }) {
      this.artboard = params.artboard;
      runtime.instances.push(this);
      queueMicrotask(() => params.onLoad?.());
    }
    resizeDrawingSurfaceToCanvas() {}
  }
  return {
    Rive,
    RuntimeLoader: {
      setWasmFallbackUrl: vi.fn(),
      setWasmUrl: vi.fn(),
      setWasmBinary: vi.fn(),
      awaitInstance: vi.fn(async () => ({})),
    },
  };
});

const fetchMock = vi.fn<typeof fetch>();

function setReducedMotion(reduce: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({ matches: reduce && query.includes("prefers-reduced-motion"), media: query })),
  );
}

beforeEach(() => {
  resetCharacterAnimationForTest();
  runtime.imported = false;
  runtime.triggers = [];
  runtime.instances = [];
  fetchMock.mockReset();
  fetchMock.mockImplementation(async () => new Response(new Uint8Array([1, 2, 3])));
  vi.stubGlobal("fetch", fetchMock);
  vi.spyOn(console, "warn").mockImplementation(() => {});
  vi.spyOn(console, "error");
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const canvases = () => document.querySelectorAll<HTMLCanvasElement>('[data-slot="character-canvas"]');
const images = () => document.querySelectorAll<HTMLImageElement>('[data-slot="character-image"]');

describe("홈 캐릭터 Rive", () => {
  it("움직임 줄이기 설정이면 런타임을 import하지 않고 .riv·WASM도 받지 않는다(정지 이미지만)", async () => {
    setReducedMotion(true);
    render(<SpeciesChoice area={{ region: "6110000" }} />);
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(runtime.imported).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
    for (const image of images()) expect(image.className).not.toContain("invisible");
    for (const canvas of canvases()) expect(canvas.className).toContain("invisible");
  });

  it("로드되면 같은 자리를 캔버스로 바꾸고, .riv는 한 번만 받아 두 캐릭터가 함께 쓴다", async () => {
    setReducedMotion(false);
    render(<SpeciesChoice area={{ region: "6110000" }} />);
    await waitFor(() => expect([...canvases()].every((canvas) => canvas.dataset.ready === "true")).toBe(true));
    expect(runtime.instances.map((instance) => instance.artboard).sort()).toEqual(["nyang-cat", "nyang-dog"]);
    const urls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(urls.filter((url) => url.endsWith(".riv"))).toEqual(["/characters/nyang-characters.riv"]);
    expect(urls.filter((url) => url.endsWith(".wasm"))).toEqual(["/rive/rive-canvas-lite-2.44.0.wasm"]);
    for (const image of images()) expect(image.className).toContain("invisible");
  });

  it("런타임이나 .riv 로드가 실패하면 정지 이미지를 그대로 두고 로그만 남긴다(console.error 없음)", async () => {
    setReducedMotion(false);
    fetchMock.mockImplementation(async () => new Response("nope", { status: 404 }));
    render(<SpeciesChoice area={{ region: "6110000" }} />);
    await waitFor(() => expect(console.warn).toHaveBeenCalled());
    expect(runtime.instances).toHaveLength(0);
    for (const image of images()) expect(image.className).not.toContain("invisible");
    for (const canvas of canvases()) expect(canvas.dataset.ready).toBe("false");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("카드를 누르는 순간(pointerdown) 그 캐릭터에만 press를 보내고, Enter도 같다", async () => {
    setReducedMotion(false);
    render(<SpeciesChoice area={{ region: "6110000" }} />);
    await waitFor(() => expect([...canvases()].every((canvas) => canvas.dataset.ready === "true")).toBe(true));
    fireEvent.pointerDown(screen.getByRole("link", { name: "강아지" }));
    expect(runtime.triggers).toEqual(["nyang-dog:press"]);
    fireEvent.keyDown(screen.getByRole("link", { name: "고양이" }), { key: "Enter" });
    expect(runtime.triggers).toEqual(["nyang-dog:press", "nyang-cat:press"]);
  });

  it("로드 전에 눌러도 오류 없이 지나간다(이동은 늦추지 않는다)", () => {
    setReducedMotion(true);
    render(<SpeciesChoice area={{ region: "6110000" }} />);
    expect(() => fireEvent.pointerDown(screen.getByRole("link", { name: "고양이" }))).not.toThrow();
    expect(runtime.triggers).toEqual([]);
  });
});
