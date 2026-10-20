// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { scrollAppToTop } from "./app-column";

let container: HTMLElement;

beforeEach(() => {
  document.body.innerHTML = `<div data-slot="app-column"><div data-slot="app-scroll"></div></div>`;
  container = document.querySelector<HTMLElement>('[data-slot="app-scroll"]')!;
});
afterEach(() => {
  document.body.innerHTML = "";
});

describe("scrollAppToTop", () => {
  it("scrollTo가 없는 환경에서도 맨 위로 올린다", () => {
    container.scrollTop = 700;
    scrollAppToTop();
    expect(container.scrollTop).toBe(0);
  });
});
