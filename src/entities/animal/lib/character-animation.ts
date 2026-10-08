import { describeError, warnClient } from "@/shared/lib/client-log";
import { CHARACTER_RIV_URL, RIVE_WASM_URL } from "./character-animation-assets";

type RiveRuntime = typeof import("@rive-app/canvas-lite");

/** 캐릭터 애니메이션에 필요한 것. 런타임과 .riv 바이트는 한 번만 받아 두 캐릭터가 함께 쓴다 */
export type CharacterAnimationKit = {
  runtime: RiveRuntime;
  /** .riv 내용. 캐릭터마다 사본(slice)을 넘긴다 */
  riv: ArrayBuffer;
};

/** 런타임을 불러오는 함수. 테스트가 바꿔 끼운다 */
export type RuntimeImporter = () => Promise<RiveRuntime>;

const importRuntime: RuntimeImporter = () => import("@rive-app/canvas-lite");

let pending: Promise<CharacterAnimationKit | null> | null = null;

/** 움직임을 줄이도록 설정했으면 런타임·WASM·.riv를 아예 받지 않는다(characters.md: 기본 포즈로 정지) */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches === true;
}

async function fetchBytes(url: string): Promise<ArrayBuffer> {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`HTTP ${response.status} ${url}`);
  return response.arrayBuffer();
}

/**
 * Rive 런타임(@rive-app/canvas-lite)과 WASM, .riv를 우리 도메인에서 받는다. 페이지에서 한 번만 받고 결과를 같이 쓴다.
 *
 * WASM은 직접 받아 `setWasmBinary`로 넘기고 대체 URL은 끈다. 런타임 기본값은 unpkg → 실패 시 jsdelivr이고, 실패하면
 * 런타임이 console.error를 남기는데, 이렇게 하면 외부 CDN 요청이 없고 네트워크 실패는 여기서 로그만 남긴다.
 * 어느 단계든 실패하면 null(호출하는 쪽은 정지 이미지를 그대로 둔다).
 */
export function loadCharacterAnimation(load: RuntimeImporter = importRuntime): Promise<CharacterAnimationKit | null> {
  pending ??= (async () => {
    try {
      const [runtime, wasm, riv] = await Promise.all([load(), fetchBytes(RIVE_WASM_URL), fetchBytes(CHARACTER_RIV_URL)]);
      runtime.RuntimeLoader.setWasmFallbackUrl(null);
      runtime.RuntimeLoader.setWasmUrl(RIVE_WASM_URL);
      runtime.RuntimeLoader.setWasmBinary(wasm);
      await runtime.RuntimeLoader.awaitInstance();
      return { runtime, riv };
    } catch (error) {
      warnClient("character-animation", "Rive를 불러오지 못해 정지 이미지를 쓴다", describeError(error));
      return null;
    }
  })();
  return pending;
}

/** 테스트용: 한 번만 받는 캐시를 비운다 */
export function resetCharacterAnimationForTest(): void {
  pending = null;
}
