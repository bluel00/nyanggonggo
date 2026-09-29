// @vitest-environment jsdom
import { act, cleanup, render } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scrollAppToTop, useAppScrollRestoration } from "./app-column";

function List({ filterKey, ready = true }: { filterKey: string; ready?: boolean }) {
  useAppScrollRestoration(filterKey, ready);
  return <div>목록</div>;
}

let container: HTMLElement;

/** 셸 안에서 화면 하나를 연다. 화면마다 별도 host에 그려 마운트/언마운트를 실제 이동처럼 만든다 */
function openScreen(props: { filterKey: string; ready?: boolean }) {
  const host = document.createElement("div");
  container.appendChild(host);
  return render(<List {...props} />, { container: host });
}

/** jsdom은 스크롤 이벤트를 자동으로 내지 않는다. 사용자 스크롤을 흉내 낸다 */
async function userScrollTo(top: number) {
  container.scrollTop = top;
  await act(async () => {
    container.dispatchEvent(new Event("scroll"));
    await new Promise((resolve) => requestAnimationFrame(() => resolve(null)));
  });
}

beforeEach(() => {
  sessionStorage.clear();
  // AppShell과 같은 구조: 480px 컬럼 + 내부 스크롤 컨테이너
  document.body.innerHTML = `<div data-slot="app-column"><div data-slot="app-scroll"></div></div>`;
  container = document.querySelector<HTMLElement>('[data-slot="app-scroll"]')!;
  // jsdom에는 레이아웃이 없다. 실제 브라우저처럼 "내용이 있으면 스크롤할 수 있고, 내용이 지워지면 없다"를 흉내 낸다
  Object.defineProperty(container, "clientHeight", { configurable: true, value: 600 });
  Object.defineProperty(container, "scrollHeight", {
    configurable: true,
    get: () => (container.textContent ? 3000 : 600),
  });
});
afterEach(() => {
  cleanup();
  document.body.innerHTML = "";
});

describe("useAppScrollRestoration", () => {
  it("목록 → 상세 → 뒤로: 보던 위치로 되돌린다", async () => {
    const key = "cat|6110000||protected|latest";
    const list = openScreen({ filterKey: key });
    await userScrollTo(800);

    // 상세로 이동: 목록이 정리되고, 상세가 컨테이너를 맨 위로 올린다
    list.unmount();
    scrollAppToTop();
    expect(container.scrollTop).toBe(0);

    // 뒤로: 같은 필터의 목록이 다시 마운트된다(캐시된 데이터라 ready=true)
    await act(async () => {
      openScreen({ filterKey: key });
    });
    expect(container.scrollTop).toBe(800);
  });

  it("탭을 닫거나 새로고침할 때(pagehide)는 지금 위치를 다시 읽어 저장한다", async () => {
    const list = openScreen({ filterKey: "k" });
    container.scrollTop = 450; // 스크롤 이벤트가 아직 전달되지 않은 상태

    await act(async () => {
      window.dispatchEvent(new Event("pagehide"));
    });
    list.unmount();

    await act(async () => {
      openScreen({ filterKey: "k" });
    });
    expect(container.scrollTop).toBe(450);
  });

  it("떠날 때 컨테이너가 0으로 눌려도(목록 DOM이 지워짐) 마지막 위치를 저장한다", async () => {
    const list = openScreen({ filterKey: "k" });
    await userScrollTo(800);

    // 실제 브라우저: 목록 DOM이 지워지면 스크롤할 내용이 없어져 브라우저가 scrollTop을 0으로 누른다
    container.scrollTop = 0;
    list.unmount();

    await act(async () => {
      openScreen({ filterKey: "k" });
    });
    expect(container.scrollTop).toBe(800);
  });

  it("스크롤할 내용이 없는 상태의 스크롤 이벤트는 사용자의 스크롤로 보지 않는다", async () => {
    const list = openScreen({ filterKey: "k" });
    await userScrollTo(800);

    // 내용이 지워져 더 스크롤할 수 없게 된 상태에서 온 이벤트(브라우저가 scrollTop을 0으로 누른다)
    Object.defineProperty(container, "scrollHeight", { configurable: true, value: 600 });
    await userScrollTo(0);
    list.unmount();

    await act(async () => {
      openScreen({ filterKey: "k" });
    });
    expect(container.scrollTop).toBe(800);
  });

  it("데이터가 아직 없으면(ready=false) 복원하지 않고, 준비되면 복원한다", async () => {
    const list = openScreen({ filterKey: "k" });
    await userScrollTo(300);
    list.unmount();
    scrollAppToTop();

    const back = openScreen({ filterKey: "k", ready: false });
    expect(container.scrollTop).toBe(0);

    await act(async () => {
      back.rerender(<List filterKey="k" ready />);
    });
    expect(container.scrollTop).toBe(300);
  });

  it("필터가 다르면 그 필터의 위치를 쓴다(저장은 필터별)", async () => {
    const list = openScreen({ filterKey: "cat" });
    await userScrollTo(500);
    list.unmount();
    scrollAppToTop();

    await act(async () => {
      openScreen({ filterKey: "dog" });
    });
    expect(container.scrollTop).toBe(0);
  });

  it("같은 화면에서 필터가 바뀌면 복원하지 않는다(맨 위로 가는 게 맞다)", async () => {
    // dog 위치를 미리 저장해 둔다
    const dog = openScreen({ filterKey: "dog" });
    await userScrollTo(600);
    dog.unmount();

    const cat = openScreen({ filterKey: "cat" });
    scrollAppToTop();
    await act(async () => {
      cat.rerender(<List filterKey="dog" />);
    });
    expect(container.scrollTop).toBe(0);
  });

  it("저장된 위치가 없으면 건드리지 않는다", async () => {
    container.scrollTop = 120;
    await act(async () => {
      openScreen({ filterKey: "새 필터" });
    });
    expect(container.scrollTop).toBe(120);
  });

  it("sessionStorage를 쓸 수 없어도 죽지 않는다", async () => {
    const original = Storage.prototype.setItem;
    Storage.prototype.setItem = () => {
      throw new Error("blocked");
    };
    try {
      const list = openScreen({ filterKey: "k" });
      await userScrollTo(200);
      expect(() => list.unmount()).not.toThrow();
    } finally {
      Storage.prototype.setItem = original;
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
