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

/**
 * 주어진 사진이 모두 로드된(또는 실패한) 뒤 브라우저 유휴 시간에 받는다. 첫 화면 사진(LCP)과 대역폭을 다투지 않게 한다.
 * window load로는 늦출 수 없었다: 목록은 데이터를 브라우저에서 받아 카드 사진이 load 뒤에 시작해, load 때 받으면 첫 사진과 겹쳐
 * 목록 LCP가 약 +90ms 늦었다(2026-10-20 실측). 돌려주는 함수를 부르면 아직 받지 않았을 때 취소한다.
 */
export function warmFontsAfterImages(images: readonly HTMLImageElement[], text: string): () => void {
  let cancelled = false;
  let idle: number | undefined;
  const loaded = images.map((img) =>
    img.complete
      ? Promise.resolve()
      : new Promise<void>((resolve) => {
          img.addEventListener("load", () => resolve(), { once: true });
          img.addEventListener("error", () => resolve(), { once: true });
        }),
  );
  void Promise.all(loaded).then(() => {
    if (cancelled) return;
    const run = () => {
      if (!cancelled) warmFonts(text);
    };
    idle = typeof window.requestIdleCallback === "function" ? window.requestIdleCallback(run, { timeout: 2000 }) : window.setTimeout(run, 200);
  });
  return () => {
    cancelled = true;
    if (idle === undefined) return;
    if (typeof window.cancelIdleCallback === "function") window.cancelIdleCallback(idle);
    else window.clearTimeout(idle);
  };
}
