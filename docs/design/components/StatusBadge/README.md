`StatusBadge` shows the state of a notice with a dot. Consumer provides `variant` (`protected`, `nearDeadline`, `ended`), optional `dDay`, optional `result` (ended only), `context` (`card`, default, or `detail`) and `onPhoto` (white 90% pill, status dot and text colours). Derive the variant from the Domain model (`getStatusVariant(animal, now)` in `entities/animal`): ended stays ended; protected with the deadline D-3 or less is `nearDeadline`.

- **Card** (`statusBadgeText` + `cardDeadlineText`): "보호중 · 마감 D-5", on the last day "보호중 · 오늘 마감". `nearDeadline` uses the same words; only the colour changes to `status-near-deadline*`. There is no "임박" text.
- **Detail** (`context="detail"`): the badge shows the state only ("보호중"). The deadline sits next to it as `DeadlineText`: "공고 마감 D-5" / "오늘 마감", `title` style, in `status-protected-text` or `status-near-deadline-text`. Ended notices have no deadline text.
- **Ended**: "종료 · <결과>" with the API's result as written (입양, 반환, 자연사 …), or "종료" when there is none.
- Outside the app (OG image, share description) the deadline is a date, "공고 마감 11월 3일(화)"; see `handoff.md` 화면 7.
- Label colour uses the `-text` tokens, dot uses the point tokens; never use the point colours as text.
