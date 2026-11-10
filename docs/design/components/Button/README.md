`Button` is the pill action, 44px tall. Consumer provides `children` (label), `onClick`, optional `disabled`, `block` (full width) and `variant`.

- `apply` is the filter sheet's 적용하기 and nothing else: a 135deg `apply-from` → `apply-to` gradient with an `on-apply` label and `shadow-apply`.
- `primary` (default) is `text`-filled with an `on-text` label, for the one action of a calm or system screen: "다시 시도" on list and 관심 공고 errors, "뒤로가기" on the detail error. Pressed background: token `primary-pressed` #1E1712 (added 2026-10-27; it was a hard-coded value).
- `overlay` is the 44x44 `photo-pill` circle for controls placed over a photo or black (Back on the detail photo, also on the detail skeleton and error; Close in the viewer).
- `icon` is a transparent 44x44 header button (the heart link "관심 공고" that opens /favorites).
- Text actions with no container ([보호소 정보], [지도], [전화]) are not a Button variant: they are `TextButton` (2026-11-10; this was `variant="small-action"`).

Pressed: scale `press-scale` in `press-duration`. Use one apply or primary per surface; no other fills, since colour points stay for status. An icon-only Button must carry `aria-label`.
