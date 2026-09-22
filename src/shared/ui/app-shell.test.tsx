import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppShell } from "./app-shell";

const html = renderToStaticMarkup(
  <AppShell>
    <p>내용</p>
  </AppShell>,
);

/** 렌더 결과의 div class 목록(바깥 → 컬럼 순) */
const classLists = [...html.matchAll(/<div[^>]*class="([^"]*)"/g)].map((m) => m[1].split(" "));
const [outer, column] = classLists;

describe("AppShell", () => {
  it("바깥은 뷰포트 높이의 canvas 배경", () => {
    expect(outer).toEqual(expect.arrayContaining(["min-h-dvh", "bg-canvas"]));
  });

  it("컬럼은 최대 480px(max-w-column), 가운데 정렬, 폭은 가득(390px 화면에서도 그대로)", () => {
    expect(column).toEqual(expect.arrayContaining(["max-w-column", "mx-auto", "w-full", "bg-bg"]));
    expect(html).toContain('data-slot="app-column"');
  });

  it("컬럼이 absolute/sticky 요소의 기준(position: relative)이고 fixed를 쓰지 않는다", () => {
    expect(column).toContain("relative");
    expect(classLists.flat()).not.toContain("fixed");
  });

  it("children을 컬럼 안에 그린다", () => {
    expect(html).toMatch(/data-slot="app-column"[^>]*><p>내용<\/p><\/div>/);
  });
});
