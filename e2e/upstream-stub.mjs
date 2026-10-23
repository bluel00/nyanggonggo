// E2E 전용 서버 스텁. playwright.config.ts의 E2E 서버 셋(개발 3000, production 3100·3101) 모두 NODE_OPTIONS="--import ./e2e/upstream-stub.mjs"로 넣는다.
// 서버의 fetch를 가로채 공공 API는 아래 고정 공고로, 이미지 호스트는 경로에 적힌 크기(가로x세로)의 단색 JPEG로 답한다.
// 그 밖 호스트는 막는다(실제 공공 API·이미지 요청 없음, 기본 E2E는 실제 API를 쓸 수 없다). 사진 경로는 실제 주소가 아니다.
// 실제 API의 응답 형식은 따로 `pnpm e2e:live`(e2e/live)가 본다.
//
// 공고 id는 실제 공고와 겹치지 않는 99로 시작한다. 날짜는 오늘(KST) 기준이라 어느 날 돌려도 보호중이다.
import sharp from "sharp";

const IMAGE_HOST = "openapi.animal.go.kr";
const photo = (width, height) => `http://${IMAGE_HOST}/e2e-fixture/${width}x${height}.jpg`;

/** 개·세종 고정 목록(e2e/back-nav.spec.ts 등 production-stub의 값과 같아야 한다) */
const STUB_LIST = { upkind: "417000", region: "5690000", orgNm: "세종특별자치시", size: 120 };
/** 개·세종 고정 목록 공고의 id(최신순 0번째가 맨 앞) */
const listItemId = (index) => String(990000202601000 + index);

/** 상세 사진 비율 확인용 공고 id → 사진 크기 */
const PHOTO_CASES = {
  "990000202600001": [[1600, 1200], [1600, 1300]], // 4:3 가로
  "990000202600002": [[900, 1200], [1020, 1084]], // 3:4 세로
  "990000202600003": [[1200, 1600], [1600, 1200]], // 세로 → 가로가 섞임
};

/** 보호소 연락처. 지어낸 값이다(e2e/detail-contact.spec.ts와 같아야 한다). 담당자 이름은 화면에 나오면 안 된다 */
const CARE = { careAddr: "E2E시 가상구 테스트로 1 (예시동)", careTel: "000-0000-0000", careOwnerNm: "E2E 담당자" };

/**
 * 정보 줄 줄바꿈 확인용 공고(e2e/detail-wrap.spec.ts와 같아야 한다). 지어낸 값이다.
 * 주소·발견 장소는 띄어쓰기가 있는 긴 한글(띄어쓰기에서만 줄이 바뀌어야 한다), 특이사항은 띄어쓰기 없는 긴 값(넘치지 않아야 한다)
 */
const WRAP_ID = "990000202600021";
const WRAP_VALUES = {
  careAddr: "가상특별시 예시구 테스트대로 123길 45 (가나다라동, 예시주상복합아파트 101동)",
  happenPlace: "가상특별시 예시구 테스트대로 앞 버스정류장 근처 공원 산책로 입구 화단",
  specialMark: "E2E-LONG-VALUE-WITHOUT-ANY-SPACES-".repeat(4),
};

/** KST 오늘에서 days만큼 옮긴 yyyyMMdd. 어느 날 돌려도 보호중 공고다 */
function ymd(days) {
  const d = new Date(Date.now() + 9 * 3600_000 + days * 86_400_000);
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}

function item(id, { upkind, kind, fullKind = kind, orgNm, photos, updTm, noticeEdtDays, processState = "보호중", animal = "믹스", extra = {} }) {
  return {
    desertionNo: id,
    processState,
    upKindCd: upkind,
    upKindNm: kind,
    kindFullNm: `[${fullKind}] ${animal}`,
    colorCd: "갈색",
    age: "2025(년생)",
    weight: "3(Kg)",
    sexCd: "F",
    neuterYn: "N",
    happenDt: ymd(-3),
    happenPlace: "E2E 고정 데이터",
    noticeNo: `E2E-${id.slice(-4)}`,
    noticeSdt: ymd(-3),
    noticeEdt: ymd(noticeEdtDays),
    orgNm,
    careNm: "E2E 보호소",
    ...CARE,
    specialMark: "E2E 고정 공고",
    updTm,
    ...Object.fromEntries(photos.map(([w, h], i) => [`popfile${i + 1}`, photo(w, h)])),
    ...extra,
  };
}

/** 종료 공고 id → 사진 장수(상세 제목 줄·도트 줄 자리 확인용, e2e/detail-title.spec.ts와 같아야 한다). 사진은 1:1이라 뼈대의 기본 칸과 같다 */
const ENDED_CASES = { "990000202600011": 2, "990000202600012": 1 };
/** 종료 사유가 있는 종료 공고 id → 종료 사유. 지어낸 값이다(e2e/ended-result.spec.ts와 같아야 한다, 이슈 #41) */
const ENDED_REASONS = { "990000202600011": "E2E 입양 완료" };

/**
 * updTm이 하나씩 이르다(최신순 정렬이 index 순서). 종료일은 7~16일 뒤로 돌려 종료임박순은 다른 순서가 된다.
 * 5개 중 하나(index % 5 === 2)는 첫 사진이 4:3 가로이고 두 장이다: 카드(1:1)에서 잘린 부분이 상세 칸(4:3)에서 드러나고, 넘긴 장 위치를
 * 볼 수 있다(e2e/detail-transition.spec.ts와 같아야 한다).
 */
const LIST_ITEMS = Array.from({ length: STUB_LIST.size }, (_, index) => {
  const minutes = STUB_LIST.size - index;
  const updTm = `2026-10-13 ${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00.0`;
  return item(listItemId(index), {
    upkind: STUB_LIST.upkind,
    kind: "개",
    orgNm: STUB_LIST.orgNm,
    photos: index % 5 === 2 ? [[600, 450], [400, 400]] : [[400, 400]],
    updTm,
    noticeEdtDays: 7 + (index % 10),
  });
});

/** n분 전 updTm(최신순 정렬이 index 순서가 되게) */
const updTmAgo = (minutes) => `2026-10-13 ${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00.0`;

/**
 * 고양이·서울(upr_cd 6110000) 30건. 개발·production 서버의 화면 E2E(목록·필터·지역·축종 기억·움직임·상세 로딩)가
 * 상세(서버 렌더)로 들어갈 공고 id를 여기서 얻는다(e2e/helpers.ts의 loadStubItems). 목록 자체는 대개 page.route로 고정한다.
 * 성별은 index % 3으로 암컷(F) / 수컷(M) / 미상(Q)을 돌린다(e2e/sex-filter.spec.ts와 같아야 한다).
 */
const SEOUL_CAT_SEX = ["F", "M", "Q"];
const SEOUL_DISTRICTS = ["서울특별시 종로구", "서울특별시 마포구", "서울특별시 강남구"];
const SEOUL_CAT_ITEMS = Array.from({ length: 30 }, (_, index) =>
  item(String(990000202602000 + index), {
    upkind: "422400",
    kind: "고양이",
    animal: "코리안 숏헤어",
    orgNm: SEOUL_DISTRICTS[index % SEOUL_DISTRICTS.length],
    photos: [[400, 400]],
    updTm: updTmAgo(30 - index),
    noticeEdtDays: 5 + (index % 10),
    extra: { sexCd: SEOUL_CAT_SEX[index % SEOUL_CAT_SEX.length] },
  }),
);

/** 기타 축종·전국(upr_cd 없음) 20건. 실제 응답처럼 upKindNm은 "기타", kindFullNm은 "[기타축종] <동물>"이다(어떤 동물인지는 여기에만 있다, 12.A P12) */
const OTHER_ANIMALS = ["토끼", "햄스터", "고슴도치", "기니피그"];
const OTHER_ITEMS = Array.from({ length: 20 }, (_, index) =>
  item(String(990000202603000 + index), {
    upkind: "429900",
    kind: "기타",
    fullKind: "기타축종",
    animal: OTHER_ANIMALS[index % OTHER_ANIMALS.length],
    orgNm: index % 2 ? "경기도 수원시" : "부산광역시 해운대구",
    photos: [[400, 400]],
    updTm: updTmAgo(20 - index),
    noticeEdtDays: 6 + (index % 10),
  }),
);

/** 목록 조합(upkind, upr_cd, org_cd 없음) → 고정 목록. 다른 조합은 빈 결과다 */
const LISTS = [
  { upkind: STUB_LIST.upkind, region: STUB_LIST.region, items: LIST_ITEMS },
  { upkind: "422400", region: "6110000", items: SEOUL_CAT_ITEMS },
  { upkind: "429900", region: null, items: OTHER_ITEMS },
];

const BY_ID = new Map([
  ...LISTS.flatMap((list) => list.items.map((it) => [it.desertionNo, it])),
  ...Object.entries(PHOTO_CASES).map(([id, photos]) => [
    id,
    item(id, { upkind: "422400", kind: "고양이", orgNm: "서울특별시 종로구", photos, updTm: "2026-10-14 10:00:00.0", noticeEdtDays: 7 }),
  ]),
  ...Object.entries(ENDED_CASES).map(([id, count]) => [
    id,
    item(id, {
      upkind: "422400",
      kind: "고양이",
      orgNm: "서울특별시 마포구",
      photos: Array.from({ length: count }, () => [400, 400]),
      updTm: "2026-10-14 09:00:00.0",
      noticeEdtDays: -1,
      processState: "종료(입양)",
      extra: id in ENDED_REASONS ? { endReason: ENDED_REASONS[id] } : {},
    }),
  ]),
  [
    WRAP_ID,
    item(WRAP_ID, {
      upkind: "422400",
      kind: "고양이",
      orgNm: "서울특별시 종로구",
      photos: [[400, 400]],
      updTm: "2026-10-14 08:00:00.0",
      noticeEdtDays: 7,
      extra: WRAP_VALUES,
    }),
  ],
]);

/**
 * 로딩 화면(스켈레톤)을 붙잡아 두는 공고 id. 단건 조회를 SLOW_MS 늦춘 뒤 실패(500)로 답한다:
 * 실패는 서버 페이지 캐시에 남지 않아 매번 늦고, 서버 호출 타임아웃(10초)보다 짧다(e2e/back-nav.spec.ts와 같아야 한다)
 */
const SLOW_ID = "990000202609999";
const SLOW_MS = 8000;

const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const upstreamPage = (list, total, pageNo, rows) =>
  json({
    response: {
      header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
      body: { items: list.length ? { item: list } : "", numOfRows: rows, pageNo, totalCount: total },
    },
  });

const images = new Map();
function jpeg(width, height) {
  const key = `${width}x${height}`;
  if (!images.has(key)) {
    images.set(key, sharp({ create: { width, height, channels: 3, background: "#d9a066" } }).jpeg().toBuffer());
  }
  return images.get(key);
}

globalThis.fetch = async function stubFetch(input) {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.hostname === "apis.data.go.kr") {
    const params = url.searchParams;
    const id = params.get("desertion_no");
    if (id === SLOW_ID) {
      await new Promise((resolve) => setTimeout(resolve, SLOW_MS));
      return new Response("slow stub", { status: 500 });
    }
    if (id) {
      const found = BY_ID.get(id);
      return upstreamPage(found ? [found] : [], found ? 1 : 0, 1, 10);
    }
    const pageNo = Number(params.get("pageNo") ?? 1);
    const rows = Number(params.get("numOfRows") ?? 10);
    const mine =
      LISTS.find(
        (list) => params.get("upkind") === list.upkind && params.get("upr_cd") === list.region && !params.get("org_cd"),
      )?.items ?? [];
    return upstreamPage(mine.slice((pageNo - 1) * rows, pageNo * rows), mine.length, pageNo, rows);
  }
  if (url.hostname === IMAGE_HOST) {
    const size = url.pathname.match(/^\/e2e-fixture\/(\d+)x(\d+)\.jpg$/);
    if (!size) return new Response("not found", { status: 404 });
    return new Response(await jpeg(Number(size[1]), Number(size[2])), { status: 200, headers: { "content-type": "image/jpeg" } });
  }
  throw new TypeError(`e2e stub: blocked host ${url.hostname}`);
};
