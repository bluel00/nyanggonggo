`Logo` is the 멍냥공고 logo: symbol C "나란히 두 얼굴" (cat in front on the left, dog behind on the right) with cream `bg` faces and a `#3A2A20` line on a 48 grid, optionally followed by the wordmark 멍냥공고. Consumer provides `size` (px), optional `variant`, optional `lockup` and optional `label` (accessible name, default `SERVICE_NAME` "멍냥공고"). Without `variant` the size picks it. The rules come from `handoff.md` (g).

- **Variants.**
  - `line`: the symbol alone, no tile. Allowed only at 56px and up, and only on light grounds (`bg` → `bg-end`). There the cream faces melt into the ground and the brown line (13:1) draws the shape. On a dark ground the line disappears, so it is not used there.
  - `tile`: the symbol on a peach tile (`apply-from` → `apply-to`, 135°), inset 8%, corner 10.5/48. For 32–48px.
  - `tile-small`: the same tile with a thicker line (2.8/48 instead of 1.6), larger eyes (radius 2.3 instead of 1.7) and inset 3%, corner 9/48. For 24px and below, where the regular line drops to about 0.5px and greys out.
- **Size rule.** 24px and below: `tile-small`. 25–55px: `tile`. 56px and up: `line` is allowed (`tile` also works). The code uses the same split. Asking for `line` below 56px renders the tile variant for that size instead.
- **Combinations.**
  - Symbol only (`lockup` false): the default for every square place.
  - Lockup (`lockup` true): the symbol followed by 멍냥공고 in Jua `display-logo` 20/28, `text` #2B211B. The gap is 10px after `line` and 8px after a tile.
  - The lockup is used only on light grounds. The `logo` colour token was removed on 2026-10-27; the wordmark is `text`.
- **Accessibility.**
  - Symbol only: `role="img"` with the label. Set `decorative` when the same name is already written next to it.
  - Lockup: one `role="img"` named from `SERVICE_NAME`; the symbol and word inside are hidden from assistive tech.
  - In the app, alt / `aria-label` also come from `SERVICE_NAME`, so the name has one source.

Where it is used (files in the asset group **Logo**):

| Place | Size | Variant · combination | File |
|---|---|---|---|
| Home top | lockup, height 56; the tagline (`SERVICE_TAGLINE`, 2 lines, `body` `text-2`) sits under it and is not part of the logo | `line` · lockup | `myeongnyang-lockup.svg` |
| Browser tab | 16 / 32 | `tile-small` / `tile`, transparent corners | `icon-16.png`, `icon-32.png` (→ `app/favicon.ico`, or `app/icon.png` 32) |
| iOS home screen | 180 | `tile`, full-bleed, no corner (iOS rounds it) | `apple-icon-180.png` → `app/apple-icon.png` |
| Web app manifest | 192 / 512 | `tile`, full-bleed | `icon-192.png`, `icon-512.png` (`any`), `icon-512-maskable.png` (`maskable`, inset 17%, line inside the central 80% circle) |
| Kakao share card app icon | square source | `tile`, full-bleed | `icon-512.png` (console upload size: to be confirmed) |
| Link-preview pill | 48 in the 1200×630 image | `tile` 48 filling a 48-high pill, so the pill ground does not show: in effect the tile alone, no wordmark | path from `myeongnyang-tile.svg` in `next/og` (`LogoPill`, `LOGO_SIZE = 48`) |
| Documents, decks | height 56 | `line` · lockup | `myeongnyang-lockup.svg` (wordmark outlined, no font needed; Jua is SIL OFL) |
| Small tile source | 16 / 24 | `tile-small` | `myeongnyang-tile-small.svg` |

- **Lockup below 56px (tile + wordmark).** There is no source file. The code cut one from the line lockup by removing the name part; it is not used anywhere now. This component draws the wordmark with `display-logo` text instead, which is why that type style stays.
- The wordmark glyphs are a fixed string in the component; in the app the lockup is an outlined SVG, not text.
