`Button` is the action with a container (a pill), 44px tall. Every action button that has a container is a Button; what differs is its look (`variant`) and its dimensions (`size`), never what it does. Consumer provides `children` (label, with an icon before it if any), `onClick`, optional `disabled`, `block` (full width), `variant` and `size`.

- `apply` is the filter sheet's 적용하기 and nothing else: a 135deg `apply-from` → `apply-to` gradient with an `on-apply` label and `shadow-apply`.
- `primary` (default) is `text`-filled with an `on-text` label, for the one action of a calm or system screen: "다시 시도" on list and 관심 공고 errors, "뒤로가기" on the detail error. Pressed background: token `primary-pressed` #1E1712 (added 2026-10-27; it was a hard-coded value).
- `overlay` is the 44x44 `photo-pill` circle for controls placed over a photo or black (Back on the detail photo, also on the detail skeleton and error; Close in the viewer).
- `surface` (2026-11-11, `handoff.md` (m)) is the quiet secondary action: white `surface` with `shadow-control`, no outline, label in `text`; pressed the ground goes to `bg`; disabled `disabled-bg` with no shadow. It is a look, not a feature: nothing about sharing lives in Button. First use: the second share button of the detail CTA bar (see `ShareButton`).
- `icon` is a transparent 44x44 header button (the heart link "관심 공고" that opens /favorites).
- Text actions with no container ([보호소 정보], [지도], [전화]) are not a Button variant: they are `TextButton` (2026-11-10; this was `variant="small-action"`).

Sizes: the default is 44 tall with `space-6` side padding and a `card-title` (16/600) label. `compact` (2026-11-11) is 44 tall with `space-3` side padding, a 14/20 600 label, an 18px icon and a 6px gap, for a bar where width is tight. Icon-only buttons (`overlay`, `icon`) are 44×44.

Pressed: scale `press-scale` in `press-duration`. Use one apply or primary per surface; no other fills, since colour points stay for status. An icon-only Button must carry `aria-label`.
