import { createCn } from "cn/config";

/**
 * 클래스 병합(clsx + tailwind-merge 호환). 디자인 토큰으로 만든 테마 키를 알려 줘야 충돌 판정이 맞다.
 * 예: 알려 주지 않으면 글자 크기 text-body와 글자색 text-text-2를 같은 그룹으로 보고 하나를 지운다.
 * 키는 src/app/globals.css의 @theme과 같게 유지한다.
 */
export const cn = createCn({
  extend: {
    theme: {
      text: ["title", "card-title", "body", "caption", "badge"],
      radius: ["card", "control", "pill"],
      spacing: ["page", "feed-gap", "touch"],
      container: ["column"],
    },
  },
});
