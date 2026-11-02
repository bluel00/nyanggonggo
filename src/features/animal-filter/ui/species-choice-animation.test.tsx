// @vitest-environment jsdom
/**
 * 홈 캐릭터 Rive: 움직임 줄이기 설정이면 런타임을 아예 받지 않고, 로드가 실패하면 정지 이미지를 두며,
 * 카드를 누르는 순간(pointerdown) 그 캐릭터에 press를 보낸다. Rive 런타임은 가짜 모듈로 바꾼다.
 * 재생은 장면 0.92초(LOOK_UP_AT_MS)에 시작하므로 재생을 기다리는 테스트는 실제 시계로 1초 남짓 기다린다
 * (jsdom에는 Web Animations가 없어 장면 0초는 그린 순간의 지금이다).
 */
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { resetCharacterAnimationForTest } from "@/entities/animal/lib/character-animation";
import { LOOK_UP_AT_MS } from "../model/home-scene";
import { SpeciesChoice } from "./species-choice";

const runtime = vi.hoisted(() => ({
  imported: false,
  triggers: [] as string[],
  instances: [] as { artboard?: string; cleanup: () => void }[],
  /** 시작한 캐릭터, 그때의 withLookUp, 시작 시각(performance.now) */
  started: [] as { artboard?: string; withLookUp: boolean; at: number }[],
  /** onLoad를 바로 부르지 않고 쥐고 있다가 테스트가 부른다 */
  holdLoad: false,
  pendingLoads: [] as (() => void)[],
}));

vi.mock("@rive-app/canvas-lite", () => {
  runtime.imported = true;
  class Rive {
    artboard?: string;
    cleanup = vi.fn();
    withLookUp = { value: false };
    viewModelInstance = {
      trigger: (name: string) => ({ trigger: () => runtime.triggers.push(`${this.artboard}:${name}`) }),
      boolean: (name: string) => (name === "withLookUp" ? this.withLookUp : null),
    };
    constructor(params: { artboard?: string; onLoad?: () => void }) {
      this.artboard = params.artboard;
      runtime.instances.push(this);
      const load = () => params.onLoad?.();
      if (runtime.holdLoad) runtime.pendingLoads.push(load);
      else queueMicrotask(load);
    }
    play() {
      runtime.started.push({ artboard: this.artboard, withLookUp: this.withLookUp.value, at: performance.now() });
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
  runtime.started = [];
  runtime.holdLoad = false;
  runtime.pendingLoads = [];
  sessionStorage.clear();
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

/** 두 캐릭터 캔버스가 보일 때까지(재생은 장면 0.92초) */
const canvasesReady = () =>
  waitFor(() => expect([...canvases()].every((canvas) => canvas.dataset.ready === "true")).toBe(true), { timeout: 3000 });

describe("홈 캐릭터 Rive", () => {

  it("움직임 줄이기 설정이면 런타임을 import하지 않고 .riv·WASM도 받지 않는다(정지 이미지만)", async () => {
    setReducedMotion(true);
    render(<SpeciesChoice area={{ region: "6110000" }} enterFrom={1} />);
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
    render(<SpeciesChoice area={{ region: "6110000" }} enterFrom={1} />);
    await canvasesReady();
    expect(runtime.instances.map((instance) => instance.artboard).sort()).toEqual(["nyang-cat", "nyang-dog"]);
    const urls = fetchMock.mock.calls.map(([input]) => String(input));
    expect(urls.filter((url) => url.endsWith(".riv"))).toEqual(["/characters/nyang-characters.riv"]);
    expect(urls.filter((url) => url.endsWith(".wasm"))).toEqual(["/rive/rive-canvas-lite-2.44.0.wasm"]);
    for (const image of images()) expect(image.className).toContain("invisible");
  });

  it("런타임이나 .riv 로드가 실패하면 정지 이미지를 그대로 두고 로그만 남긴다(console.error 없음)", async () => {
    setReducedMotion(false);
    fetchMock.mockImplementation(async () => new Response("nope", { status: 404 }));
    render(<SpeciesChoice area={{ region: "6110000" }} enterFrom={1} />);
    await waitFor(() => expect(console.warn).toHaveBeenCalled());
    expect(runtime.instances).toHaveLength(0);
    for (const image of images()) expect(image.className).not.toContain("invisible");
    for (const canvas of canvases()) expect(canvas.dataset.ready).toBe("false");
    expect(console.error).not.toHaveBeenCalled();
  });

  it("카드를 누르는 순간(pointerdown) 그 캐릭터에만 press를 보내고, Enter도 같다", async () => {
    setReducedMotion(false);
    render(<SpeciesChoice area={{ region: "6110000" }} enterFrom={1} />);
    await canvasesReady();
    fireEvent.pointerDown(screen.getByRole("link", { name: "강아지" }));
    expect(runtime.triggers).toEqual(["nyang-dog:press"]);
    fireEvent.keyDown(screen.getByRole("link", { name: "고양이" }), { key: "Enter" });
    expect(runtime.triggers).toEqual(["nyang-dog:press", "nyang-cat:press"]);
  });

  it("로드 전에 눌러도 오류 없이 지나간다(이동은 늦추지 않는다)", () => {
    setReducedMotion(true);
    render(<SpeciesChoice area={{ region: "6110000" }} enterFrom={1} />);
    expect(() => fireEvent.pointerDown(screen.getByRole("link", { name: "고양이" }))).not.toThrow();
    expect(runtime.triggers).toEqual([]);
  });
});

/**
 * 홈 첫인상 장면의 캐릭터(handoff (k) "장면의 0초와 Rive", #115). 들어올 때마다 장면이다. 장면 0.92초에 두 캐릭터가 모두 준비돼 있으면
 * 그 순간 withLookUp = true로 같이 재생하고, 아니면 준비되는 대로 withLookUp = false로 재생한다. 세션 저장소는 쓰지 않는다.
 */
describe("홈 첫인상 장면의 캐릭터", () => {
  const release = () => act(() => runtime.pendingLoads.splice(0).forEach((load) => load()));
  const wait = (ms: number) => act(() => new Promise((resolve) => setTimeout(resolve, ms)));

  it("0.92초 전에 둘 다 준비되면 0.92초까지 기다렸다가 같은 순간 withLookUp = true로 재생한다", async () => {
    setReducedMotion(false);
    runtime.holdLoad = true;
    const rendered = performance.now();
    render(<SpeciesChoice area={{ region: "6110000" }} enterFrom={1} />);
    await waitFor(() => expect(runtime.pendingLoads).toHaveLength(2));
    release();
    await wait(50);
    expect(runtime.started, "0.92초 전에는 정지 그림").toEqual([]);
    await waitFor(() => expect(runtime.started).toHaveLength(2), { timeout: 3000 });
    for (const started of runtime.started) {
      expect(started.withLookUp).toBe(true);
      expect(started.at - rendered, "장면 0.92초에 재생").toBeGreaterThanOrEqual(LOOK_UP_AT_MS - 5);
    }
    expect(Math.abs(runtime.started[0].at - runtime.started[1].at), "두 캐릭터가 같은 순간").toBeLessThan(5);
    await canvasesReady();
  });

  it("0.92초까지 준비되지 않으면 준비되는 대로 withLookUp = false로 재생한다", async () => {
    setReducedMotion(false);
    runtime.holdLoad = true;
    render(<SpeciesChoice area={{ region: "6110000" }} enterFrom={1} />);
    await waitFor(() => expect(runtime.pendingLoads).toHaveLength(2));
    await wait(LOOK_UP_AT_MS + 80);
    expect(runtime.started).toEqual([]);
    release();
    await waitFor(() => expect(runtime.started).toHaveLength(2));
    for (const started of runtime.started) expect(started.withLookUp).toBe(false);
  });

  it("0.92초 전에 한쪽만 준비되면(true로 열림) 둘 다 false로 재생한다: 먼저 열린 쪽은 false로 다시 연다", async () => {
    setReducedMotion(false);
    runtime.holdLoad = true;
    render(<SpeciesChoice area={{ region: "6110000" }} enterFrom={1} />);
    await waitFor(() => expect(runtime.pendingLoads).toHaveLength(2));
    const [catLoad, dogLoad] = runtime.pendingLoads.splice(0);
    act(() => catLoad());
    await wait(LOOK_UP_AT_MS + 80);
    runtime.holdLoad = false;
    act(() => dogLoad());
    // 0.92초에 false로 다시 연 고양이 인스턴스도 열린다
    release();
    await waitFor(() => expect(runtime.started).toHaveLength(2));
    for (const started of runtime.started) expect(started.withLookUp).toBe(false);
    expect(runtime.instances.filter((instance) => instance.artboard === "nyang-cat")).toHaveLength(2);
  });

  it("세션 저장소를 쓰지 않는다: 예전 기록(nyanggonggo:home-scene-seen)은 읽지도 지우지도 않고, 있어도 장면·올려다보기가 같다", async () => {
    setReducedMotion(false);
    sessionStorage.setItem("nyanggonggo:home-scene-seen", "1");
    render(<SpeciesChoice area={{ region: "6110000" }} enterFrom={1} />);
    await waitFor(() => expect(runtime.started).toHaveLength(2), { timeout: 3000 });
    for (const started of runtime.started) expect(started.withLookUp).toBe(true);
    expect(sessionStorage.getItem("nyanggonggo:home-scene-seen")).toBe("1");
    expect(sessionStorage.length).toBe(1);
    expect(document.documentElement.hasAttribute("data-home-scene")).toBe(false);
  });

  it("움직임 줄이기: 재생하지 않는다(정지 그림)", async () => {
    setReducedMotion(true);
    render(<SpeciesChoice area={{ region: "6110000" }} enterFrom={1} />);
    await wait(LOOK_UP_AT_MS + 80);
    expect(runtime.started).toEqual([]);
    expect(sessionStorage.length).toBe(0);
  });
});
