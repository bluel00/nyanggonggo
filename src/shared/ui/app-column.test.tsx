// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  ANIMAL_ID_ATTRIBUTE,
  rememberSelectedAnimal,
  scrollAppToAnimal,
  scrollAppToTop,
  useAnimalScrollRestoration,
} from "./app-column";

const CONTAINER_HEIGHT = 600;
const CARD_HEIGHT = 400;

let container: HTMLElement;

/**
 * jsdom에는 레이아웃이 없다. 카드가 세로로 400px씩 쌓인 목록을 흉내 낸다(컨테이너는 위쪽 0, 높이 600).
 * 렌더 타이밍과 무관하게 동작하도록 getBoundingClientRect 자체를 갈아 끼운다.
 */
const realRect = Element.prototype.getBoundingClientRect;
function installFakeLayout() {
  Element.prototype.getBoundingClientRect = function (this: Element) {
    if (this === container) return { top: 0, height: CONTAINER_HEIGHT } as DOMRect;
    const cards = [...container.querySelectorAll(`[${ANIMAL_ID_ATTRIBUTE}]`)];
    const index = cards.indexOf(this);
    if (index < 0) return { top: 0, height: 0 } as DOMRect;
    return { top: index * CARD_HEIGHT - container.scrollTop, height: CARD_HEIGHT } as DOMRect;
  };
}

function Cards({ ids }: { ids: string[] }) {
  return (
    <>
      {ids.map((id) => (
        <div key={id} data-slot="animal-card" {...{ [ANIMAL_ID_ATTRIBUTE]: id }} />
      ))}
    </>
  );
}

function List({ listKey, ready = true, ids = [] }: { listKey: string; ready?: boolean; ids?: string[] }) {
  useAnimalScrollRestoration(listKey, ready);
  return <Cards ids={ids} />;
}

/** 화면 하나를 연다. 화면마다 별도 host에 그려 마운트/언마운트를 실제 이동처럼 만든다 */
function openScreen(props: { listKey: string; ready?: boolean; ids?: string[] }) {
  const host = document.createElement("div");
  container.appendChild(host);
  return render(<List {...props} />, { container: host });
}

beforeEach(() => {
  sessionStorage.clear();
  document.body.innerHTML = `<div data-slot="app-column"><div data-slot="app-scroll"></div></div>`;
  container = document.querySelector<HTMLElement>('[data-slot="app-scroll"]')!;
  installFakeLayout();
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
  Element.prototype.getBoundingClientRect = realRect;
});

const IDS = ["a1", "a2", "a3", "a4", "a5"];

describe("scrollAppToAnimal", () => {
  it("카드가 컨테이너 가운데로 오도록 스크롤하고 true", () => {
    render(<Cards ids={IDS} />, { container });

    expect(scrollAppToAnimal("a4")).toBe(true);
    // a4는 1200~1600, 가운데(1400)가 컨테이너 가운데(scrollTop+300)에 오도록
    expect(container.scrollTop).toBe(1100);
  });

  it("없는 카드면 아무것도 하지 않고 false", () => {
    render(<Cards ids={IDS} />, { container });
    container.scrollTop = 200;

    expect(scrollAppToAnimal("없는-id")).toBe(false);
    expect(container.scrollTop).toBe(200);
  });
});

describe("useAnimalScrollRestoration", () => {
  it("목록 → 상세 → 뒤로: 열었던 카드로 되돌아간다", async () => {
    const list = openScreen({ listKey: "cat|6110000||protected|latest", ids: IDS });
    rememberSelectedAnimal("cat|6110000||protected|latest", "a4"); // 카드 클릭
    list.unmount();
    scrollAppToTop(); // 상세 화면

    await act(async () => {
      openScreen({ listKey: "cat|6110000||protected|latest", ids: IDS });
    });
    expect(container.scrollTop).toBe(1100);
  });

  it("카드가 늦게 그려져도 몇 프레임 기다렸다 찾는다", async () => {
    rememberSelectedAnimal("k", "a4");
    const list = openScreen({ listKey: "k", ids: [] });
    expect(container.scrollTop).toBe(0);

    await act(async () => {
      list.rerender(<List listKey="k" ids={IDS} />);
    });
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 50)); // 카드를 찾을 때까지 몇 프레임
    });
    expect(container.scrollTop).toBe(1100);
  });

  it("데이터에 없는 공고면 조용히 맨 위에 둔다", async () => {
    rememberSelectedAnimal("k", "사라진-공고");
    await act(async () => {
      openScreen({ listKey: "k", ids: IDS });
      await new Promise((resolve) => setTimeout(resolve, 60));
    });
    expect(container.scrollTop).toBe(0);
  });

  it("기억한 카드는 한 번만 쓴다(다시 들어오면 맨 위)", async () => {
    rememberSelectedAnimal("k", "a4");
    const first = openScreen({ listKey: "k", ids: IDS });
    await act(async () => {});
    expect(container.scrollTop).toBe(1100);
    first.unmount();
    scrollAppToTop();

    await act(async () => {
      openScreen({ listKey: "k", ids: IDS });
    });
    expect(container.scrollTop).toBe(0);
  });

  it("다른 필터의 목록에서는 복원하지 않는다", async () => {
    rememberSelectedAnimal("cat", "a4");
    await act(async () => {
      openScreen({ listKey: "dog", ids: IDS });
    });
    expect(container.scrollTop).toBe(0);
  });

  it("데이터가 아직 없으면(ready=false) 기다렸다가 준비되면 복원한다", async () => {
    rememberSelectedAnimal("k", "a4");
    const list = openScreen({ listKey: "k", ready: false, ids: IDS });
    expect(container.scrollTop).toBe(0);

    await act(async () => {
      list.rerender(<List listKey="k" ready ids={IDS} />);
    });
    expect(container.scrollTop).toBe(1100);
  });

  it("sessionStorage를 쓸 수 없어도 죽지 않는다", async () => {
    const setItem = Storage.prototype.setItem;
    const getItem = Storage.prototype.getItem;
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
    Storage.prototype.getItem = () => {
      throw new Error("blocked");
    };
    try {
      expect(() => rememberSelectedAnimal("k", "a4")).not.toThrow();
      await act(async () => {
        openScreen({ listKey: "k", ids: IDS });
      });
      expect(container.scrollTop).toBe(0);
    } finally {
      Storage.prototype.setItem = setItem;
      Storage.prototype.getItem = getItem;
    }
  });
});

describe("scrollAppToTop", () => {
  it("scrollTo가 없는 환경에서도 맨 위로 올린다", () => {
    container.scrollTop = 700;
    scrollAppToTop();
    expect(container.scrollTop).toBe(0);
  });
});
