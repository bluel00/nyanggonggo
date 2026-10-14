// E2E 전용 서버 스텁. playwright.config.ts의 "production-stub" 서버가 NODE_OPTIONS="--import ./e2e/upstream-stub.mjs"로 넣는다.
// 서버의 fetch를 가로채 공공 API는 아래 고정 공고로, 이미지 호스트는 경로에 적힌 크기(가로x세로)의 단색 JPEG로 답한다.
// 그 밖 호스트는 막는다(실제 공공 API·이미지 요청 없음). 사진 경로는 실제 주소가 아니다.
//
// 서버의 공공 API 페이지 캐시(Next 데이터 캐시, .next/cache)는 production 서버(3100)와 같은 폴더를 쓴다. 캐시 키가
// 요청 파라미터라, 고정 목록은 다른 E2E가 쓰지 않는 조합(개, 세종)에만 둔다. 공고 id는 실제 공고와 겹치지 않는 99로 시작한다.
import sharp from "sharp";

const IMAGE_HOST = "openapi.animal.go.kr";
const photo = (width, height) => `http://${IMAGE_HOST}/e2e-fixture/${width}x${height}.jpg`;

/** 고정 목록의 조합. 다른 조합의 목록은 빈 결과다(e2e/back-nav.spec.ts의 값과 같아야 한다) */
const STUB_LIST = { upkind: "417000", region: "5690000", orgNm: "세종특별자치시", size: 120 };
/** 고정 목록 공고의 id(최신순 0번째가 맨 앞) */
const listItemId = (index) => String(990000202601000 + index);

/** 상세 사진 비율 확인용 공고 id → 사진 크기 */
const PHOTO_CASES = {
  "990000202600001": [[1600, 1200], [1600, 1300]], // 4:3 가로
  "990000202600002": [[900, 1200], [1020, 1084]], // 3:4 세로
  "990000202600003": [[1200, 1600], [1600, 1200]], // 세로 → 가로가 섞임
};

/** KST 오늘에서 days만큼 옮긴 yyyyMMdd. 어느 날 돌려도 보호중 공고다 */
function ymd(days) {
  const d = new Date(Date.now() + 9 * 3600_000 + days * 86_400_000);
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}

function item(id, { upkind, kind, orgNm, photos, updTm, noticeEdtDays }) {
  return {
    desertionNo: id,
    processState: "보호중",
    upKindCd: upkind,
    upKindNm: kind,
    kindFullNm: `[${kind}] 믹스`,
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
    specialMark: "E2E 고정 공고",
    updTm,
    ...Object.fromEntries(photos.map(([w, h], i) => [`popfile${i + 1}`, photo(w, h)])),
  };
}

/** updTm이 하나씩 이르다(최신순 정렬이 index 순서). 종료일은 7~16일 뒤로 돌려 종료임박순은 다른 순서가 된다 */
const LIST_ITEMS = Array.from({ length: STUB_LIST.size }, (_, index) => {
  const minutes = STUB_LIST.size - index;
  const updTm = `2026-10-13 ${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}:00.0`;
  return item(listItemId(index), {
    upkind: STUB_LIST.upkind,
    kind: "개",
    orgNm: STUB_LIST.orgNm,
    photos: [[400, 400]],
    updTm,
    noticeEdtDays: 7 + (index % 10),
  });
});

const BY_ID = new Map([
  ...LIST_ITEMS.map((it) => [it.desertionNo, it]),
  ...Object.entries(PHOTO_CASES).map(([id, photos]) => [
    id,
    item(id, { upkind: "422400", kind: "고양이", orgNm: "서울특별시 종로구", photos, updTm: "2026-10-14 10:00:00.0", noticeEdtDays: 7 }),
  ]),
]);

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
    if (id) {
      const found = BY_ID.get(id);
      return upstreamPage(found ? [found] : [], found ? 1 : 0, 1, 10);
    }
    const pageNo = Number(params.get("pageNo") ?? 1);
    const rows = Number(params.get("numOfRows") ?? 10);
    const mine =
      params.get("upkind") === STUB_LIST.upkind && params.get("upr_cd") === STUB_LIST.region && !params.get("org_cd")
        ? LIST_ITEMS
        : [];
    return upstreamPage(mine.slice((pageNo - 1) * rows, pageNo * rows), mine.length, pageNo, rows);
  }
  if (url.hostname === IMAGE_HOST) {
    const size = url.pathname.match(/^\/e2e-fixture\/(\d+)x(\d+)\.jpg$/);
    if (!size) return new Response("not found", { status: 404 });
    return new Response(await jpeg(Number(size[1]), Number(size[2])), { status: 200, headers: { "content-type": "image/jpeg" } });
  }
  throw new TypeError(`e2e stub: blocked host ${url.hostname}`);
};
