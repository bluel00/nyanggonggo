서비스명은 미정이며 임시로 "냥공고"를 쓴다. 이름은 코드에서 `SERVICE_NAME` 한 곳에서만 정의하고 OG 이미지, 카카오 피드 카드, 문서 `<title>`에서 이 상수를 읽는다. 화면 타이틀은 서비스명이 아니라 축종에 따라 "고양이 공고" / "강아지 공고"다.

## Content fundamentals

Write in short, warm Korean (해요체). The product is a photo feed, not an adoption service: the action is sharing, never adopting. Never show shelter phone numbers or contact information anywhere. Real copy: "지금은 고양이를 불러오지 못했어요", "아직 찜한 고양이가 없어요 / 마음에 드는 고양이를 저장해보세요 🐾", "링크가 복사됐어요". The only emoji is the 🐾 in the favourites empty state. The feed never says it has ended; it keeps showing `SkeletonCard`.

## Visual foundations

Warm, minimal, the photo is the hero. Set text in Pretendard using `title` (20/700), `card-title` (16/600), `body` (14/400), `caption` (12/400) and `badge` (12/600). Page ground is `bg`, text `text`, secondary `text-2`, hairlines `border`. Page padding is `space-4` (16), card gap `space-3` (12), card radius `radius-card` (16), chips and badges `radius-pill`. No shadows. Cards are radius only.

Colour points are for status only: 보호중 uses `status-protected` (dot) with `status-protected-bg` and `status-protected-text`; 임박 (D-day 3 or less) uses `status-soon` with `-bg` and `-text`; 종료 uses `status-ended` with `-bg` and `-text`. Text never uses the point colours, only the `-text` variants, which meet 4.5:1. The one exception to "accent = status" is `kakao` with `on-kakao` on ShareButton. Over a photo, badges are `photo-pill` (white 90%) with a coloured dot.

Photos are 4:5, `object-fit: cover`, `object-position: center 35%`. The full-screen viewer shows the original ratio (`contain`) on `viewer-bg`. Ended animals: photo saturate(0.7), grey badge, no dim.

Layout: design frame 390x844 (safe area 47 top, 34 bottom). On desktop the content is one `column-max` (480px) column centred on `canvas`; there is no desktop layout. Bottom sheet, viewer and the fixed CTA bar live inside that column.

Motion: card press 100ms scale(0.98), bottom sheet 250ms ease-out, toast fade 250ms. Nothing else moves. Focus ring is a 2px `focus-ring` with 2px offset.

## Iconography

Icons are simple 1.8px-stroke outline glyphs (heart, close, back, chat bubble in `on-kakao`). No icon set was supplied: the `Icon` component in `bundle.js` draws heart, filter, close, back and chevron-down, and the Kakao chat bubble is inline in `ShareButton`. They are placeholders for lucide equivalents (Heart, SlidersHorizontal, X, ChevronLeft, ChevronDown), which ship with shadcn/ui.
