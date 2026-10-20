// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react";
import { useLayoutEffect } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { AppShell } from "./app-shell";
import { StackLayer } from "./stack-layer";

afterEach(cleanup);

const below = () => document.querySelector<HTMLElement>('[data-slot="app-scroll"]')!;

/** 층이 붙거나 빠지는 커밋 안(그리기 전)에 아래 화면의 inert를 읽는다 */
function Probe({ seen }: { seen: boolean[] }) {
  useLayoutEffect(() => {
    seen.push(below().inert);
  });
  return null;
}

describe("StackLayer(PRD-v1.5 R3·R4)", () => {
  it("층이 있는 동안 아래 화면(스크롤 영역)을 inert로 막고, 층이 빠지는 커밋에서 바로 푼다", () => {
    const view = render(
      <AppShell stack={<StackLayer>상세</StackLayer>}>
        <p>목록</p>
      </AppShell>,
    );
    expect(below().inert).toBe(true);
    expect(document.querySelector('[data-slot="stack-layer"]')?.textContent).toBe("상세");
    // 막는 것은 inert뿐이다. 스크롤 영역의 overflow·스타일은 건드리지 않는다(돌아온 직후 스크롤 영역이 다시 만들어지지 않게)
    expect(below().getAttribute("style")).toBeNull();

    const seen: boolean[] = [];
    view.rerender(
      <AppShell stack={null}>
        <p>목록</p>
        <Probe seen={seen} />
      </AppShell>,
    );
    expect(document.querySelector('[data-slot="stack-layer"]')).toBeNull();
    // 층을 걷은 바로 그 커밋의 layout effect에서 이미 풀려 있다(다음 프레임을 기다리지 않는다)
    expect(seen).toEqual([false]);
  });

  it("층이 없으면 아래 화면을 막지 않는다", () => {
    render(
      <AppShell>
        <p>목록</p>
      </AppShell>,
    );
    expect(below().inert).toBeFalsy();
  });
});
