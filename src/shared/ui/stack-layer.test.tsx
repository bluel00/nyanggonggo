// @vitest-environment jsdom
import { act, cleanup, fireEvent, render } from "@testing-library/react";
import { useLayoutEffect, type ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AppShell } from "./app-shell";
import { StackLayer } from "./stack-layer";

const back = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ back }) }));

beforeEach(() => back.mockClear());
afterEach(cleanup);

const below = () => document.querySelector<HTMLElement>('[data-slot="app-scroll"]')!;
const layer = () => document.querySelector<HTMLElement>('[data-slot="stack-layer"]');

/** 층이 붙거나 빠지는 커밋 안(그리기 전)에 아래 화면의 inert를 읽는다 */
function Probe({ seen }: { seen: boolean[] }) {
  useLayoutEffect(() => {
    seen.push(below().inert);
  });
  return null;
}

function Detail({ title = true }: { title?: boolean }) {
  return (
    <div>
      <button type="button">뒤로가기</button>
      {title && (
        <h1 id="detail-title" tabIndex={-1}>
          고양이 · 서울
        </h1>
      )}
    </div>
  );
}

function Screen({ open, detail = <Detail />, probe }: { open: boolean; detail?: ReactNode; probe?: ReactNode }) {
  return (
    <AppShell
      stack={
        open ? (
          <StackLayer labelledBy="detail-title" label="공고 상세">
            {detail}
          </StackLayer>
        ) : null
      }
    >
      <button type="button" data-testid="card">카드</button>
      {probe}
    </AppShell>
  );
}

describe("StackLayer(PRD-v1.5 R3·R4)", () => {
  it("층이 있는 동안 아래 화면(스크롤 영역)을 inert로 막고, 층이 빠지는 커밋에서 바로 푼다", () => {
    const view = render(<Screen open />);
    expect(below().inert).toBe(true);
    // 막는 것은 inert뿐이다. 스크롤 영역의 overflow·스타일은 건드리지 않는다(돌아온 직후 스크롤 영역이 다시 만들어지지 않게)
    expect(below().getAttribute("style")).toBeNull();

    const seen: boolean[] = [];
    view.rerender(<Screen open={false} probe={<Probe seen={seen} />} />);
    expect(layer()).toBeNull();
    // 층을 걷은 바로 그 커밋의 layout effect에서 이미 풀려 있다(다음 프레임을 기다리지 않는다)
    expect(seen).toEqual([false]);
  });

  it("층이 없으면 아래 화면을 막지 않는다", () => {
    render(<Screen open={false} />);
    expect(below().inert).toBeFalsy();
  });
});

describe("StackLayer 접근성", () => {
  it("모달 대화상자이고 이름은 상세 제목(aria-labelledby), 제목이 없을 때를 위한 aria-label도 있다", () => {
    render(<Screen open />);
    expect(layer()?.getAttribute("role")).toBe("dialog");
    expect(layer()?.getAttribute("aria-modal")).toBe("true");
    expect(layer()?.getAttribute("aria-labelledby")).toBe("detail-title");
    expect(layer()?.getAttribute("aria-label")).toBe("공고 상세");
  });

  it("열리면 초점이 제목으로 가고, 닫히면 연 카드로 돌아온다", () => {
    const view = render(<Screen open={false} />);
    const card = document.querySelector<HTMLElement>('[data-testid="card"]')!;
    card.focus();

    view.rerender(<Screen open />);
    expect(document.activeElement?.id).toBe("detail-title");

    view.rerender(<Screen open={false} />);
    expect(document.activeElement).toBe(card);
  });

  it("제목이 아직 없으면(뼈대) 첫 버튼(뒤로가기)으로, 그 요소가 빠지고 상세가 오면 제목으로 옮긴다", async () => {
    const view = render(<Screen open detail={<Detail key="skeleton" title={false} />} />);
    expect(document.activeElement?.textContent).toBe("뒤로가기");

    // 로딩 화면 → 상세: Next가 다시 마운트해 초점을 가진 요소가 빠진다
    await act(async () => {
      view.rerender(<Screen open detail={<Detail key="page" />} />);
    });
    expect(document.activeElement?.id).toBe("detail-title");
  });

  it("Esc를 누르면 뒤로가기(router.back)로 닫는다. 한 번만 부른다", () => {
    render(<Screen open />);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(back).toHaveBeenCalledTimes(1);
  });

  it("층 밖에 다른 대화상자(사진 크게 보기)가 열려 있으면 Esc는 그쪽 것이라 층을 닫지 않는다", () => {
    render(<Screen open />);
    const viewer = document.createElement("div");
    viewer.setAttribute("role", "dialog");
    document.body.append(viewer);
    fireEvent.keyDown(document.activeElement!, { key: "Escape" });
    expect(back).not.toHaveBeenCalled();
    viewer.remove();
  });
});
