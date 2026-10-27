import localFont from "next/font/local";
import "../assets/fonts/jua-fallback.css";

/**
 * 제목 글꼴 Jua(architecture.md 14.1 "제목 글꼴"). 고정 문구 7개의 글자만 담은 부분 글꼴(scripts/jua-subset.mjs로 만든다)이다.
 * 쓰는 곳: 홈 질문(display-home), 목록 제목·홈 고양이/강아지 라벨(display-title). 홈 서비스 이름은 로고 그림(shared/ui/logo.tsx)이라 쓰지 않는다(#66). 데이터에서 오는 글자에는
 * 쓰지 않는다(tests/design/jua-subset.test.ts). 상세 제목, 종료 공고, 에러, 빈 화면은 Pretendard다.
 *
 * 토큰 `.display-*` 클래스의 font-family("Jua" 이름)는 next/font가 만드는 이름과 달라 쓰지 않는다. 크기는 Tailwind `text-display-*`,
 * 글꼴은 `displayFont.className`이고, 둘을 함께 붙이는 것은 `DisplayText`(display-text.tsx)다. 화면은 DisplayText만 쓴다.
 * 미리 불러오기: 이 모듈을 가져오는 화면(홈, 목록)에서만 `<link rel="preload">`가 붙는다. 글꼴을 받기 전에는 "Jua Fallback"
 * (Pretendard를 Jua 폭·세로 값에 맞춘 면, jua-fallback.css)으로 그려 바뀔 때 글자 자리가 밀리지 않게 한다. Next의 adjustFontFallback은
 * a~z로 Arial을 맞추는 방식이라 라틴 글자가 없는 이 파일에는 효과가 없어 끈다.
 */
export const displayFont = localFont({
  src: "../assets/fonts/jua-subset.woff2",
  weight: "400",
  style: "normal",
  display: "swap",
  preload: true,
  adjustFontFallback: false,
  fallback: [
    "Jua Fallback",
    "Pretendard Variable",
    "Pretendard",
    "-apple-system",
    "BlinkMacSystemFont",
    "Apple SD Gothic Neo",
    "Malgun Gothic",
    "system-ui",
    "sans-serif",
  ],
});
