## 원칙

꾸밈 규칙보다 먼저 온다. 아래와 부딪히는 꾸밈은 넣지 않는다.

- **사진은 덮거나 칠하지 않는다.** 사진 위에는 지금 있는 상태 배지(`photo-pill`), 목록 카드의 찜 원, 상세의 뒤로가기(`Button variant="overlay"`)만 둔다. 그림자·그라데이션·후광·광택·반투명 바탕 같은 새 꾸밈은 사진 바깥에만 둔다. 화면 전환 중에도 사진이 반투명한 바탕 아래 비치지 않게 한다. 종료 공고의 `saturate(0.7)`는 기존 규칙으로 유지한다.
- **종료 공고는 차분하게 둔다.** 장식·튐·등장 효과를 넣지 않는다. 종료 카드는 누름 효과도, 목록 등장 효과도, 상세로 갈 때 전환 효과도 없이 바로 바뀌고, 그림자는 `shadow-card-ended`로 납작하다. 종료 상세에는 캐릭터·사진 그림자·D-day가 없다.
- **목록은 빠르게 둔다.** 첫 화면에서 한 번만 움직이고 스크롤 중에는 효과가 없다. 스크롤로 새로 보이는 카드, 다음 페이지, 상세에서 돌아온 목록은 그냥 보인다.
- **움직임 줄이기 설정이면 모든 효과 없이 바로 바뀐다.** 전환·등장·하트·누름·시트·캐릭터 모두. 대신 페이드도 넣지 않는다.

서비스 이름은 "멍냥공고"다(옛 이름 "냥공고", #64). 이름은 코드에서 `SERVICE_NAME` 한 곳에서만 정의하고 OG 이미지, 카카오 피드 카드, 문서 `<title>`에서 이 상수를 읽는다. 화면 타이틀은 서비스명이 아니라 축종에 따라 "고양이 공고" / "강아지 공고" / "기타 동물 공고"다.

## Content fundamentals

Write in short, warm Korean (해요체). The product is a photo feed, not an adoption service: the action is sharing, never adopting. Never show shelter phone numbers or contact information anywhere. Real copy: "지금은 고양이를 불러오지 못했어요" (list error), "지금은 공고를 불러오지 못했어요" (detail error), "아직 찜한 공고가 없어요 / 마음에 드는 공고를 저장해보세요 🐾", "링크가 복사됐어요". List copy names the current species (고양이 / 강아지 / 기타 동물); screens that mix species or don't know it (favourites, detail error) say 공고 instead. The only emoji is the 🐾 in the favourites empty state. The feed never says it has ended; it keeps showing `SkeletonCard`.

## Visual foundations

Direction A "햇살 담요" (chosen 2026-10-14; source: the design "냥공고 홈 · 축종 선택", boards DirA, HomeA and MotionA; where the board's table and the demo differed, the demo's played values are the rule). Warm and soft, and the photo is still the hero.

Ground: a vertical gradient `bg` (#FFF8EE) → `bg-end` (#F9EBD9) on the non-scrolling column, so it spans the screen, not the scroll length. White `surface` cards float on it with `shadow-card` (two warm-brown layers); pressed cards drop to `shadow-card-pressed`; ended cards stay flat with `shadow-card-ended`. Card radius `radius-card` (22), home choice cards `radius-choice` (24) with a radial `choice-halo` → `choice-halo-end` circle (104px) behind each character. All text is checked on `bg-end`, the darker end: `text` 13.4:1, `text-2` 5.6:1, status `-text` 4.5:1 or more, `logo` 4.8:1.

Type: body stays Pretendard with `title` (20/700), `card-title` (16/600), `body` (14/400), `caption` (12/400) and `badge` (12/600). Titles only use Jua (배달의민족 주아, SIL OFL 1.1, Google Fonts, 400 only): `display-home` 28/36 for the home question, `display-title` 22/28 for the list title and the 고양이 / 강아지 choice labels, `display-logo` 20/28 for the 멍냥공고 wordmark in `logo`. The region title of a protected or soon notice is `display-detail` 24/32 in Pretendard 700, not Jua: it comes from the API's `orgNm`, so its glyphs are not known in advance. Ended-notice titles, errors and empty states stay in Pretendard `title`, so they read calm. Constraint: Jua is only for seven fixed strings ("멍냥공고", "오늘은 누구를 보러 왔어요?", "고양이", "강아지", "고양이 공고", "강아지 공고", "기타 동물 공고"), shipped as one subset file that holds just those glyphs (`next/font/local`, see `handoff.md`), never the full Korean font; the fallback is Pretendard. (Repo note 2026-10-14: the design system still had the detail title in Jua while it was being changed to Pretendard; this follows `docs/architecture.md` 14절.)

Buttons and controls: only the filter sheet's 적용하기 is a peach gradient pill (`Button variant="apply"`: `apply-from` → `apply-to`, `on-apply`, `shadow-apply`). The default primary Button stays `text`-filled for the one action of a system screen ("다시 시도"). FavoriteButton and the filter button are `surface` with `shadow-control`, no outline; Chips are `surface` with `shadow-chip`, selected Chips are `text`-filled. ShareButton keeps `kakao` / `on-kakao`. The detail CTA bar is `bg` with `shadow-bar` on its top edge.

Detail photo: the box takes the first photo's ratio clamped to 3:4–4:3, inset 24px each side, `radius-card`, contain on `bg`, with `shadow-photo` around it (none on ended notices). Back sits on the photo's top-left as the existing overlay button.

Spacing is unchanged: page padding `space-4` (16), card gap `space-3` (12), touch target `touch` (44).

Colour points are for status only: 보호중 uses `status-protected` (dot) with `status-protected-bg` and `status-protected-text`; 임박 (D-day 3 or less) uses `status-soon` with `-bg` and `-text`; 종료 uses `status-ended` with `-bg` and `-text`. Text never uses the point colours, only the `-text` variants, which meet 4.5:1. Exceptions to "accent = status": `kakao` with `on-kakao` on ShareButton; the `apply-from` → `apply-to` peach on 적용하기 only; the `logo` brown on the home wordmark only. The character illustrations use their own illustration-only palette, and the cat's bow (`#9C3548`) is a second, character-only exception; see the 캐릭터 section (`characters.md`). Over a photo, badges are `photo-pill` (white 90%) with a coloured dot. The filled favourite heart is `text`, never a colour.

Photos in list cards are 1:1, `object-fit: cover`, `object-position: center` (a 4:5 crop cut the head or face off about 1 in 10 cards, mostly landscape photos with the animal near an edge; 1:1 cuts about 1 in 35). The OG image stays 4:5, `object-fit: cover`, `object-position: center 35%`. On the detail page photos are never cropped: the photo box takes the first photo's width/height ratio clamped to 3:4–4:3, and every photo in the carousel is `contain` inside that box on `bg`, so the box height stays the same while swiping. The loading card's photo box is 1:1 too. If the first photo's size is not known in time, the box is 1:1. Shelter photos are about half 4:3 landscape and a third 3:4 portrait, so a fixed 4:5 cover hid about 40% of a landscape photo. The full-screen viewer shows the original ratio (`contain`) on `viewer-bg`. Ended animals: photo saturate(0.7), grey badge, no dim.

Layout: design frame 390x844 (safe area 47 top, 34 bottom). On desktop the content is one `column-max` (480px) column centred on `canvas`; there is no desktop layout. Bottom sheet, viewer and the fixed CTA bar live inside that column.

Motion (the values MotionA played; tokens in the motion and scale families):

| Scene | Time · curve | What moves | Ended | Reduced motion |
|---|---|---|---|---|
| Home entrance | `enter-duration` 320ms, ease-out, `enter-stagger` 60ms | title (with subline) → cat card → dog card → link rise `enter-distance` 12px and fade in; done at 500ms. The characters' `greet` starts within 0.3s after (`characters.md`) | — | all shown at once, characters still |
| Choice card press | `press-duration` 100ms, ease-out | card `press-scale` .98; character eyes `eyes-happy` and body squash `char-press-x` 1.03 × `char-press-y` 0.96 from the bottom centre; no head tilt. On release go to the list at once | — | go at once |
| List first screen | `list-enter-duration` 240ms, ease-out, `list-enter-stagger` 40ms | once, only cards on the first screen rise `list-enter-distance` 8px and fade in. Nothing on scroll, next pages or coming back | no effect | no effect |
| Card press | 100ms, ease-out | `press-scale` .98 and `shadow-card-pressed` | no effect | no effect |
| Favourite heart | `heart-duration` 280ms, `ease-heart` on each half | heart fills with `text` and pops 1 → `heart-scale` 1.2 (at 45%) → 1 inside the white circle, which keeps its size; un-fill fades over `heart-off-duration` 120ms | fill only | fill only |
| Card → detail | `detail-duration` 300ms, `ease-emphasized` | the detail ground is opaque from the first frame; 카드 사진이 상세 사진 칸의 크기·위치로 옮겨 가며 자리를 잡는다(상세 칸이 좌우 24px 안쪽이라 대개 작아진다). 1:1에서 잘렸던 부분이 드러난다 (same photo, nothing painted on it); info fades in over `detail-info-duration` 200ms after `detail-info-delay` 100ms. Where shared-element transitions are not supported: ground at once, photo and info fade in over 200ms | switches at once | switches at once |
| Bottom sheet, toast | `sheet-duration` 250ms, `ease-out` | unchanged | — | at once |

Characters may idle on screens without photos, react briefly to a press on screens with photos, and never appear in ended-notice contexts (see `characters.md`). Focus ring is a 2px `focus-ring` with 2px offset.

## Iconography

Icons are simple 1.8px-stroke outline glyphs (heart, close, back, chat bubble in `on-kakao`). No icon set was supplied: the `Icon` component in `bundle.js` draws heart, filter, close, back and chevron-down, and the Kakao chat bubble is inline in `ShareButton`. They are placeholders for lucide equivalents (Heart, SlidersHorizontal, X, ChevronLeft, ChevronDown), which ship with shadcn/ui.
