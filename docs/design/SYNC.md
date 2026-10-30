# docs/design 싱크 기록

이 폴더의 다른 파일은 디자인 시스템 "멍냥공고"의 사본이라 고치지 않는다. 싱크 기록만 여기에 적는다.

- 마지막 싱크: 2026-10-30, 디자인 시스템 판 1793343184-65f9, 기준 코드 aabca64 (#115 3단계 전: handoff (k) 홈 세로 배치 규칙, 2단계 구현 기록)
  - 바뀐 파일: handoff.md. tokens.json은 바뀌지 않아 tokens.css도 그대로다.
- 이전 싱크: 2026-10-30, 디자인 시스템 판 1793341485-eae1, 기준 코드 bfbf494 (#115 2단계: 홈 질문 `display-home` 32/40 두 줄, handoff (a)·(k))
  - 바뀐 파일: tokens.json, README.md, handoff.md. 그림은 바뀌지 않았다.
  - tokens.css는 같은 규칙으로 다시 만들었다(바뀐 것은 `.display-home` 28/36 → 32/40 한 줄. tokens.json의 나머지 바뀐 곳은 usage 설명이라 CSS에 없다).
- 이전 싱크: 2026-10-30, 디자인 시스템 판 1793339419-eafd, 기준 코드 b5c822d (#115 홈 첫인상 "부르고 답하기", handoff (k), (j) L6)
  - 바뀐 파일: handoff.md, characters.md. 새 파일: `assets/Logo/myeongnyang-lockup-rigged.svg`, `assets/Logo/myeongnyang-mark-rigged.svg`(부위를 나눈 로고, data-part).
  - tokens.json은 바뀌지 않아 tokens.css도 그대로다. 기존 로고 그림(코드 `src/shared/assets/logo/`)과 캐릭터 그림은 바뀌지 않았다.
- 이전 싱크: 2026-10-30, 디자인 시스템 판 1793332855-64a0, 기준 코드 8c2baee (#111 로딩 시머·캐릭터, handoff (j) L1~L5)
  - 바뀐 파일: README.md, characters.md, handoff.md, tokens.json, bundle.css(디자인 시스템 `components/bundle.css`), SkeletonCard README·preview.html, AnimalCard README. 그림은 바뀌지 않았다.
  - tokens.css는 같은 규칙으로 다시 만들었다(새 토큰 `shimmer-duration` 1400ms, `loading-character-delay` 500ms, `loading-character-fade` 200ms).
- 이전 싱크: 2026-10-28, 디자인 시스템 판 1793154884-da6b, 기준 코드 262bdb8 (handoff (i) W1 "링크 복사" 조건을 브라우저 공유 시트 지원으로, M3 "공유에 실패했어요…" 토스트가 뜨는 때)
  - 바뀐 파일: handoff.md, ShareButton·Toast README. tokens.json은 바뀌지 않았다(tokens.css 그대로).
- 이전 싱크: 2026-10-28, 디자인 시스템 판 1793152397-4492, 기준 코드 5914d13 (#53 마지막 두 줄: 공유 버튼 구현 반영 S2, Icon chevron-right I1)
  - 가져온 것: 지난번과 같은 묶음. 바뀐 파일은 README.md, handoff.md, bundle.js, Icon·ShareButton·Toast README와 Icon preview. tokens.json은 바뀌지 않아 tokens.css도 그대로다.
- 이전 싱크: 2026-10-27, 디자인 시스템 판 1793091314-d30d, 기준 코드 d4a3f5d (#53 둘째: design-sync-53b, 작은 수정 M1·M2, 공유 버튼 시안 2)
  - 가져온 것: README.md, handoff.md, characters.md, tokens.json, bundle.css, bundle.js, 컴포넌트별 README·preview.html, assets/*/README.md. tokens.css는 같은 규칙으로 다시 만들었다(바뀐 토큰은 `toast-offset` 80px → 24px 하나).
  - 가져오지 않은 것: 캐릭터·로고 그림(바뀌지 않음), Screens 캡처(저장소 밖 `nyanggonggo-review/screenshots/53/`), `design-system.json`, 글꼴.
- 이전 싱크: 2026-10-27, 디자인 시스템 판 1793082441-ed30, 기준 코드 83e0269 (#53)
  - `bundle.css`·`bundle.js`는 디자인 시스템의 `components/` 아래에 있지만 이 폴더 바로 아래에 둔다.
  - `tokens.css`는 디자인 시스템에 없어 `tokens.json`에서 만든다(색 한 줄, 나머지 한 줄, 글자 스타일 클래스. 354e74a와 같은 규칙).
  - 가져오지 않은 것: 고양이·강아지 캐릭터 SVG 17개(2026-10-20 사본 그대로), 로고 그림(코드 `src/shared/assets/logo/`), Screens 캡처, 폰트 파일, `design-system.json`.
