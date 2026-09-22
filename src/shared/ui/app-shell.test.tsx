import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppShell } from "./app-shell";

const html = renderToStaticMarkup(
  <AppShell>
    <p>내용</p>
  </AppShell>,
);

/** 렌더 결과의 div class 목록(바깥 → 컬럼 → 스크롤 순) */
const classLists = [...html.matchAll(/<div[^>]*class="([^"]*)"/g)].map((m) => m[1].split(" "));
const [outer, column, scroll] = classLists;

describe("AppShell", () => {
  it("바깥은 뷰포트 높이의 canvas 배경", () => {
    expect(outer).toEqual(expect.arrayContaining(["min-h-dvh", "bg-canvas"]));
  });

  it("컬럼은 최대 480px(max-w-column), 가운데 정렬, 폭은 가득(390px 화면에서도 그대로)", () => {
    expect(column).toEqual(expect.arrayContaining(["max-w-column", "mx-auto", "w-full", "bg-bg"]));
    expect(html).toContain('data-slot="app-column"');
  });

  it("컬럼은 화면 높이로 고정되고(h-dvh, overflow-hidden) absolute 요소의 기준(relative)이며 fixed를 쓰지 않는다", () => {
    expect(column).toEqual(expect.arrayContaining(["relative", "h-dvh", "overflow-hidden"]));
    expect(classLists.flat()).not.toContain("fixed");
  });

  it("스크롤은 컬럼 안쪽 app-scroll이 맡고 children은 그 안에 그린다", () => {
    expect(scroll).toEqual(expect.arrayContaining(["flex-1", "overflow-y-auto"]));
    expect(html).toMatch(/data-slot="app-scroll"[^>]*><p>내용<\/p><\/div>/);
  });
});
