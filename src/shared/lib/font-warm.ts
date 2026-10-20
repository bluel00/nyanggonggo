/**
 * 글자에 필요한 본문 글꼴(Pretendard dynamic subset) 조각을 미리 받는다. 이미 받았으면 아무 일도 없다. 실패는 무시한다(글꼴은 보이는 데만 쓴다).
 * 다음 화면에 보일 글자를 그 화면이 그려지기 전에 받아 두는 데 쓴다(architecture.md 14.2 4단계: 카드 → 상세 전환은 새 화면의 글꼴을
 * 다 받을 때까지 커밋을 기다린다).
 */
export function warmFonts(text: string): void {
  const fonts = typeof document === "undefined" ? undefined : document.fonts;
  if (!fonts?.load || !text) return;
  // font-family는 토큰 --font-sans의 첫 항목(layout.tsx가 싣는 pretendard dynamic subset)과 같다. 굵기는 가변 글꼴 하나라 무관하다
  void fonts.load('16px "Pretendard Variable"', text).catch(() => {});
}

/** 페이지의 첫 내용(사진 등)을 다 받은 뒤(load) 받는다. 첫 화면 사진과 대역폭을 다투지 않게 한다 */
export function warmFontsAfterLoad(text: string): () => void {
  if (typeof document === "undefined") return () => {};
  if (document.readyState === "complete") {
    warmFonts(text);
    return () => {};
  }
  const onLoad = () => warmFonts(text);
  window.addEventListener("load", onLoad, { once: true });
  return () => window.removeEventListener("load", onLoad);
}
