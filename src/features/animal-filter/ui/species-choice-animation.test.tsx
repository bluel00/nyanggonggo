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
  /** 시작한 캐릭터와 그때의 firstVisit, 시작 순간의 <html data-home-scene> */
  started: [] as { artboard?: string; firstVisit: boolean; scene: string | null }[],
  /** onLoad를 바로 부르지 않고 쥐고 있다가 테스트가 부른다 */
  holdLoad: false,
  pendingLoads: [] as (() => void)[],
}));

vi.mock("@rive-app/canvas-lite", () => {
  runtime.imported = true;
  class Rive {
    artboard?: string;
    cleanup = vi.fn();
    firstVisit = { value: false };
    viewModelInstance = {
      trigger: (name: string) => ({ trigger: () => runtime.triggers.push(`${this.artboard}:${name}`) }),
      boolean: (name: string) => (name === "firstVisit" ? this.firstVisit : null),
    };
    constructor(params: { artboard?: string; onLoad?: () => void }) {
      this.artboard = params.artboard;
      runtime.instances.push(this);
      const load = () => params.onLoad?.();
      if (runtime.holdLoad) runtime.pendingLoads.push(load);
      else queueMicrotask(load);
    }
    play() {
      runtime.started.push({ artboard: this.artboard, firstVisit: this.firstVisit.value, scene: document.documentElement.getAttribute("data-home-scene") });
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
  document.documentElement.removeAttribute("data-home-scene");
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

describe("홈 캐릭터 Rive", () => {
  // 이 묶음은 두 번째 진입(지금 등장 + 인사)을 본다. 첫 진입이면 대체 타이머가 남아 다음 테스트의 장면을 바꾼다
  beforeEach(() => sessionStorage.setItem("nyanggonggo.home-scene-seen", "1"));

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
    await waitFor(() => expect([...canvases()].every((canvas) => canvas.dataset.ready === "true")).toBe(true));
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
 * 홈 첫인상 장면(handoff (k), #115). 세션의 첫 진입이면 두 캐릭터가 모두 그릴 준비가 되는 순간 <html data-home-scene="play">와
 * Rive(firstVisit = true)를 같이 시작한다. 두 번째 진입이나 대체(off)는 지금 등장 + 인사(firstVisit = false)다.
 */
describe("홈 첫인상 장면", () => {
  const scene = () => document.documentElement.getAttribute("data-home-scene");

  it("첫 진입: 기다리는 동안(pending) 시작하지 않고, 둘 다 준비되면 같은 순간 play + firstVisit = true로 시작한다", async () => {
    setReducedMotion(false);
    runtime.holdLoad = true;
    render(<SpeciesChoice area={{ region: "6110000" }} enterFrom={1} />);
    expect(scene()).toBe("pending");
    expect(sessionStorage.getItem("nyanggonggo.home-scene-seen")).toBe("1");
    await waitFor(() => expect(runtime.pendingLoads).toHaveLength(2));
    act(() => runtime.pendingLoads[0]());
    expect(runtime.started).toEqual([]);
    expect(scene()).toBe("pending");
    act(() => runtime.pendingLoads[1]());
    expect(runtime.started.map(({ artboard }) => artboard).sort()).toEqual(["nyang-cat", "nyang-dog"]);
    for (const started of runtime.started) expect(started).toMatchObject({ firstVisit: true, scene: "play" });
    await waitFor(() => expect([...canvases()].every((canvas) => canvas.dataset.ready === "true")).toBe(true));
  });

  it("두 번째 진입: 장면 없이(속성 없음) 지금 등장이 끝난 뒤 firstVisit = false로 시작한다", async () => {
    setReducedMotion(false);
    sessionStorage.setItem("nyanggonggo.home-scene-seen", "1");
    render(<SpeciesChoice area={{ region: "6110000" }} enterFrom={1} />);
    expect(scene()).toBeNull();
    await waitFor(() => expect(runtime.started).toHaveLength(2));
    for (const started of runtime.started) expect(started).toMatchObject({ firstVisit: false, scene: null });
  });

  it("0.3초 안에 준비되지 않으면 대체(off): 늦게 준비돼도 장면 없이 firstVisit = false로 시작한다", async () => {
    vi.useFakeTimers({ toFake: ["setTimeout"] });
    try {
      setReducedMotion(false);
      runtime.holdLoad = true;
      render(<SpeciesChoice area={{ region: "6110000" }} enterFrom={1} />);
      expect(scene()).toBe("pending");
      await act(async () => {
        vi.advanceTimersByTime(300);
      });
      expect(scene()).toBe("off");
      vi.useRealTimers();
      await waitFor(() => expect(runtime.pendingLoads).toHaveLength(2));
      act(() => runtime.pendingLoads.forEach((load) => load()));
      await waitFor(() => expect(runtime.started).toHaveLength(2));
      for (const started of runtime.started) expect(started).toMatchObject({ firstVisit: false, scene: "off" });
    } finally {
      vi.useRealTimers();
    }
  });

  it("기다리는 동안 한 캐릭터만 열렸다가(firstVisit = true로) 대체로 넘어가면, 그 캐릭터를 다시 열어 firstVisit = false로 시작한다", async () => {
    setReducedMotion(false);
    runtime.holdLoad = true;
    render(<SpeciesChoice area={{ region: "6110000" }} enterFrom={1} />);
    await waitFor(() => expect(runtime.pendingLoads).toHaveLength(2));
    const [catLoad, dogLoad] = runtime.pendingLoads;
    act(() => catLoad());
    // 대체 타이머가 하는 일(타이머 자체는 model/home-scene.test.ts가 본다)
    act(() => document.documentElement.setAttribute("data-home-scene", "off"));
    runtime.holdLoad = false;
    act(() => dogLoad());
    await waitFor(() => expect(runtime.started).toHaveLength(2));
    for (const started of runtime.started) expect(started).toMatchObject({ firstVisit: false, scene: "off" });
    // 처음 연 고양이 인스턴스는 정리하고 새로 열었다
    expect(runtime.instances.filter((instance) => instance.artboard === "nyang-cat")).toHaveLength(2);
  });

  it("움직임 줄이기: 장면도 인사도 없지만 첫 진입은 쓴 것으로 남긴다", async () => {
    setReducedMotion(true);
    render(<SpeciesChoice area={{ region: "6110000" }} enterFrom={1} />);
    expect(scene()).toBeNull();
    expect(sessionStorage.getItem("nyanggonggo.home-scene-seen")).toBe("1");
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
    });
    expect(runtime.started).toEqual([]);
  });

  it("홈을 떠나면(언마운트) 속성을 지운다(CSS 장면은 이동과 함께 끝난다)", async () => {
    setReducedMotion(false);
    const { unmount } = render(<SpeciesChoice area={{ region: "6110000" }} enterFrom={1} />);
    expect(scene()).toBe("pending");
    unmount();
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 5));
    });
    expect(scene()).toBeNull();
  });
});
