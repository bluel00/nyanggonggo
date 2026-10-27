`DetailInfo` is the label–value list on the detail page (in the app it is part of `widgets/animal-detail`, `detailRows`). Two columns: label in `body` + `text-2` (column fits its content), value in `body` + `text`, row gap `space-3`. Consumer provides the Domain `animal` and `onShelterInfo` (opens the shelter info sheet).

- **Rows in order**, each left out when empty: 발견 장소 → 보호소 → 공고 번호 → 공고 기간 → 종료 사유 → 특이사항. 주소 and 전화 are not rows here; they moved into the shelter info sheet (`ShelterInfo`).
- **[보호소 정보].** The 보호소 row ends in the small text button `Button variant="small-action"` with the info icon, accessible name "보호소 정보 보기". It is not shown on ended notices, or when the notice has neither an address nor a phone. The row height does not change; the button's hit area is 44×44.
- **Ended notices.** 종료 사유 appears after 공고 기간; if it equals 특이사항, only 종료 사유 is shown.
- **Wrapping.** Values break only at spaces (`word-break: keep-all`); a long value with no spaces breaks anywhere (`overflow-wrap: anywhere`).
- The person in charge is never shown.
