/**
 * 홈 캐릭터 Rive 자산의 주소와 이름(architecture.md 9절 "홈 캐릭터 Rive", 12절 47).
 *
 * 모두 우리 도메인에서 내려준다. 런타임 기본값은 WASM을 unpkg에서, 실패하면 jsdelivr에서 받는데 둘 다 쓰지 않는다.
 * - .riv: `pnpm rive:build`가 RML 원본(rive/nyang-characters)을 빌드해 public/characters/에 둔다
 * - WASM: `pnpm rive:wasm`이 @rive-app/canvas-lite의 rive.wasm을 버전이 든 이름으로 public/rive/에 둔다
 * 런타임 버전을 바꾸면 RIVE_RUNTIME_VERSION도 바꾼다(tests/design/rive-assets.test.ts가 어긋나면 실패한다).
 */
export const RIVE_RUNTIME_VERSION = "2.44.0";

export const CHARACTER_RIV_URL = "/characters/nyang-characters.riv";
export const RIVE_WASM_URL = `/rive/rive-canvas-lite-${RIVE_RUNTIME_VERSION}.wasm`;

/** 상태 머신과 앱 → 캐릭터 신호(뷰 모델 트리거). 이름은 docs/design/characters.md 모션 절 그대로다 */
export const CHARACTER_STATE_MACHINE = "State Machine 1";
export const CHARACTER_PRESS_TRIGGER = "press";
