`OgImage` is not a React component: the link-preview image is drawn by the app with `next/og` (`og-image.tsx`, `og-model.ts`). This card shows its spec at half size. The image is 1200×630 (a 600×315 logical layout at 2x). Colours are the direction A token values copied as hex (`text` #2B211B, `text-2` #6B5A4C, `surface` #FFFFFF, status colours), because Satori cannot read CSS variables.

- **Notice.**
  - Ground: the photo full-bleed (`cover`, `center 35%`), or `canvas` without a photo.
  - Top-left, 24px in (logical; 48px in the image): the logo pill, 48 high, holding `Logo` `tile` 48. The tile fills the pill, so the pill ground does not show and there is no wordmark (the name is in the preview title).
  - Bottom white card (`surface`): the first line holds the badge (dot + "보호중"; ended "종료 · <결과>") and the deadline date "공고 마감 11월 3일(화)" (40px, the status text colour, only before the deadline) side by side, 16px apart, centred vertically. Below it the title (the region, other species "<동물> · <지역>", 40px, `text`) → shelter name, or the found place without one (28px, `text-2`). The date makes the line longer; it stays inside the card width.
- **No notice.** 1200×630 on `canvas` #F5F5F5, two lines centred vertically, 16 apart: `SERVICE_NAME` "멍냥공고" (Pretendard 700, 72px, `text`) → "유기동물 공고" (Pretendard 400, 32px, `text-2`).
- **Share card and link-preview description.** "성별 · 나이 · 보호중 · 공고 마감 11월 3일(화) · <특이사항>". Past or missing deadline: "보호중" without a date. Ended: "종료 · <결과>". No shelter name.
- **Deadline rule.** Inside the app (card, detail) the deadline is relative ("마감 D-N", "공고 마감 D-N", "오늘 마감"). What leaves the app (OG, share) uses the date "공고 마감 M월 D일(요)".
- Example values here are invented.
