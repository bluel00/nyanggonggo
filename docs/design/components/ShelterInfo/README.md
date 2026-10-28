`ShelterInfo` is the content of the shelter info sheet (in the app: `features/shelter-info`, `ShelterInfoSheet`). Put it in a `BottomSheet` without `footer`, titled with the shelter name (`card-title`). The sheet opens from [보호소 정보] on the detail's 보호소 row. Consumer provides the Domain `animal`.

- **Rows** (label–value, same grid as `DetailInfo`): 주소 <주소> [지도] → 전화 <번호> [전화]. Empty rows are left out. A phone without digits keeps its row and drops [전화].
- **Row actions** are `Button variant="small-action"`: [지도] (map pin, opens a map search in a new tab) and [전화] (phone, `tel:`). `text-2` caption with a 14px icon, 44×44 hit area. Rows with a link get 6px above and below the label and the value, so the two neighbouring 44px hit areas do not overlap (row gap 12 + line 20 = 32).
- **Accessible names**: the opening button "보호소 정보 보기", [지도] "지도에서 주소 보기(새 탭)", [전화] "보호소에 전화", the handle "닫기".
- **Sheet**: handle (36×4, `border`) → title → rows, no fixed bottom area. Close with a tap on the dim, a tap on the handle, or Esc. No drag-to-close. Reduced motion: no open/close animation.
- The person in charge is never shown.
