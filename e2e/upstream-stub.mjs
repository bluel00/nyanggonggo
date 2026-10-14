// E2E 전용 서버 스텁. playwright.config.ts의 "production-stub" 서버가 NODE_OPTIONS="--import ./e2e/upstream-stub.mjs"로 넣는다.
// 서버의 fetch를 가로채 공공 API는 아래 고정 공고로, 이미지 호스트는 경로에 적힌 크기(가로x세로)의 단색 JPEG로 답한다.
// 그 밖 호스트는 막는다(실제 공공 API·이미지 요청 없음). 사진 경로는 실제 주소가 아니다.
import sharp from "sharp";

const IMAGE_HOST = "openapi.animal.go.kr";
const photo = (width, height) => `http://${IMAGE_HOST}/e2e-fixture/${width}x${height}.jpg`;

/** 공고 id → 사진 크기. id는 실제 공고 번호 형식(15자리)이지만 실제 공고와 겹치지 않는 99로 시작한다 */
const ANIMALS = {
  "990000202600001": [[1600, 1200], [1600, 1300]], // 4:3 가로
  "990000202600002": [[900, 1200], [1020, 1084]], // 3:4 세로
  "990000202600003": [[1200, 1600], [1600, 1200]], // 세로 → 가로가 섞임
};

/** KST 오늘에서 days만큼 옮긴 yyyyMMdd. 어느 날 돌려도 보호중 공고다 */
function ymd(days) {
  const d = new Date(Date.now() + 9 * 3600_000 + days * 86_400_000);
  return d.toISOString().slice(0, 10).replaceAll("-", "");
}

function item(id, photos) {
  return {
    desertionNo: id,
    processState: "보호중",
    upKindCd: "422400",
    upKindNm: "고양이",
    kindCd: "000200",
    kindNm: "한국 고양이",
    kindFullNm: "[고양이] 한국 고양이",
    colorCd: "치즈",
    age: "2025(년생)",
    weight: "3(Kg)",
    sexCd: "F",
    neuterYn: "N",
    happenDt: ymd(-3),
    happenPlace: "E2E 고정 데이터",
    noticeNo: `E2E-${id.slice(-3)}`,
    noticeSdt: ymd(-3),
    noticeEdt: ymd(7),
    orgNm: "서울특별시 종로구",
    careNm: "E2E 보호소",
    specialMark: "E2E 고정 공고",
    updTm: "2026-10-14 10:00:00.0",
    ...Object.fromEntries(photos.map(([w, h], i) => [`popfile${i + 1}`, photo(w, h)])),
  };
}

const json = (body) => new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
const upstreamPage = (list) =>
  json({
    response: {
      header: { resultCode: "00", resultMsg: "NORMAL SERVICE." },
      body: { items: list.length ? { item: list } : "", numOfRows: 10, pageNo: 1, totalCount: list.length },
    },
  });

globalThis.fetch = async function stubFetch(input) {
  const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
  if (url.hostname === "apis.data.go.kr") {
    const id = url.searchParams.get("desertion_no");
    return upstreamPage(id && ANIMALS[id] ? [item(id, ANIMALS[id])] : []);
  }
  if (url.hostname === IMAGE_HOST) {
    const size = url.pathname.match(/^\/e2e-fixture\/(\d+)x(\d+)\.jpg$/);
    if (!size) return new Response("not found", { status: 404 });
    const image = await sharp({ create: { width: +size[1], height: +size[2], channels: 3, background: "#d9a066" } })
      .jpeg()
      .toBuffer();
    return new Response(image, { status: 200, headers: { "content-type": "image/jpeg" } });
  }
  throw new TypeError(`e2e stub: blocked host ${url.hostname}`);
};
