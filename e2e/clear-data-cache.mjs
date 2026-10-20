// E2E 서버를 띄우기 전에 서버 데이터 캐시를 비운다(playwright.config.ts의 webServer 명령이 먼저 부른다).
//   node e2e/clear-data-cache.mjs <Next 출력 폴더>...   예) .next  .next/dev
//
// 지우는 것: <폴더>/cache/fetch-cache 하나. fetch 캐시와 unstable_cache(공공 API 페이지 캐시·사진 크기 캐시)가 여기에 파일로
// 남아 다음 실행까지 이어진다. 빌드 산출물(.next/server, static 등)과 turbopack 캐시는 건드리지 않는다.
//
// 이유: 스텁(e2e/upstream-stub.mjs)의 공고 날짜는 실행한 날 기준이다. 전날 실행의 캐시가 남아 있으면 첫 요청은 전날 날짜의
// 목록을 받고(재검증 중 이전 값을 내준다) 다음 페이지는 오늘 날짜의 목록에서 자르므로, 커서(앞 페이지 마지막 항목의 날짜)가
// 오늘 목록의 모든 항목보다 뒤로 가 빈 페이지가 왔다(back-nav "5페이지까지" 실패, 2026-10-19·20).
import { existsSync, rmSync } from "node:fs";
import { join } from "node:path";

for (const outDir of process.argv.slice(2)) {
  const dataCache = join(outDir, "cache", "fetch-cache");
  if (!existsSync(dataCache)) continue;
  rmSync(dataCache, { recursive: true, force: true });
  console.log(`[e2e] 서버 데이터 캐시를 비웠다: ${dataCache}`);
}
