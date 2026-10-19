/**
 * vitest용 next/font/local. next/font는 Next 빌드가 바꿔 주는 호출이라 테스트에서는 실제 글꼴 없이 클래스 이름만 돌려준다.
 * 클래스 이름은 테스트가 "제목 글꼴이 붙었는지"를 볼 수 있게 고정한다.
 */
export const NEXT_FONT_LOCAL_STUB_CLASS = "next-font-local-stub";

export default function localFont() {
  return { className: NEXT_FONT_LOCAL_STUB_CLASS, style: { fontFamily: "next-font-local-stub" } };
}
