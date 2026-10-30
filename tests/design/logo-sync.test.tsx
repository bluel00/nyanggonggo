/**
 * 홈 위쪽 가로 조합 로고는 부위를 나눈 판의 인라인 SVG(shared/ui/logo-lockup-drawing.tsx)다. 원본은 디자인 시스템에서 동기화한
 * `docs/design/assets/Logo/myeongnyang-lockup-rigged.svg`이고, 한쪽만 바뀌면 앱이 옛 그림을 쓰게 되므로 그림(요소, 순서, 모양, 색, data-part)이
 * 같은지 본다(handoff (k), #115). 바깥 svg의 role·aria-label은 감싼 Logo가 맡아 비교하지 않는다.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Logo } from "@/shared/ui/logo";
import { drawingTags } from "./svg-drawing";

const SOURCE = join(process.cwd(), "docs/design/assets/Logo/myeongnyang-lockup-rigged.svg");

describe("가로 조합 로고의 인라인 SVG와 원본", () => {
  it("그림이 원본(부위를 나눈 판)과 같다", () => {
    const inline = renderToStaticMarkup(<Logo size={56} combo="lockup" />);
    const source = readFileSync(SOURCE, "utf8");
    expect(inline).toContain(`viewBox="${/viewBox="([^"]*)"/.exec(source)![1]}"`);
    const tags = drawingTags(inline);
    expect(tags.length).toBeGreaterThan(20);
    expect(tags).toEqual(drawingTags(source));
  });
});
