import { defineConfig, devices } from "@playwright/test";

/**
 * E2E는 실제 브라우저에서만 확인할 수 있는 것(내부 스크롤 컨테이너, 뒤로가기, 스크롤 복원)만 다룬다.
 * 목록 API 응답은 각 테스트가 page.route로 고정하고(항상 같은 결과), 상세 페이지는 서버 렌더라
 * 실제 공고 id를 쓴다(아래 e2e/fixtures.ts).
 */
export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    ...devices["Pixel 7"], // 모바일 뷰포트(412x915)
    trace: "retain-on-failure",
  },
  /*
   * 대부분은 개발 서버에서 돈다. 상세 로딩 경계(detail-loading), 홈 캐릭터 Rive(home-rive)는 production 서버에서 돈다:
   * Next는 production에서만 링크를 prefetch하고, 카드를 누른 즉시 로딩 뼈대가 보이는 것은 그 prefetch 덕분이다.
   * 상세에서 뒤로가기(back-nav, PRD-v1.4), 상세 사진(detail-photo), 상세 제목 줄(detail-title)은 같은 빌드를 스텁 서버
   * (e2e/upstream-stub.mjs: 고정 공고, 크기를 아는 단색 사진)로 띄워 본다.
   * 개발 서버(.next/dev)와 production 빌드(.next)는 출력 폴더가 달라 함께 띄울 수 있다.
   */
  projects: [
    {
      name: "dev",
      testIgnore: /(detail-loading|detail-photo|detail-title|home-rive|back-nav|motion)\.spec\.ts/,
      // 브라우저는 localhost로 연다(개발 서버가 127.0.0.1을 다른 오리진으로 보고 dev 리소스를 막는다)
      use: { baseURL: "http://localhost:3000" },
    },
    {
      name: "production",
      testMatch: /(detail-loading|home-rive|motion)\.spec\.ts/,
      use: { baseURL: "http://localhost:3100" },
    },
    {
      name: "production-stub",
      testMatch: /(back-nav|detail-photo|detail-title)\.spec\.ts/,
      use: { baseURL: "http://localhost:3101" },
    },
  ],
  // 서버마다 띄우기 전에 서버 데이터 캐시(<출력 폴더>/cache/fetch-cache)를 비운다. 이전 실행(전날)의 공고 페이지 캐시가 남으면
  // 스텁의 오늘 기준 날짜와 섞여 다음 페이지가 비었다(e2e/clear-data-cache.mjs). 빌드 산출물은 지우지 않는다.
  // 이미 떠 있는 서버를 쓰는(reuseExistingServer) 경우에는 명령이 돌지 않아 비우지 않는다.
  webServer: [
    {
      command: "node e2e/clear-data-cache.mjs .next/dev && pnpm dev",
      url: "http://127.0.0.1:3000",
      reuseExistingServer: true,
      timeout: 120_000,
    },
    {
      // 매 실행 빌드한다(지금 코드의 production 동작을 본다). 이미 3100에 띄워 둔 서버가 있으면 그것을 쓴다
      command: "node e2e/clear-data-cache.mjs .next && pnpm build && pnpm start -p 3100",
      url: "http://127.0.0.1:3100/home",
      reuseExistingServer: true,
      timeout: 300_000,
    },
    {
      // 위 서버의 빌드를 그대로 쓴다(서버는 배열 순서대로 하나씩 준비된다). 스텁이 모든 외부 요청에 대신 답하므로 서비스키는 쓰이지 않는 자리 값이다
      // 3100과 같은 .next/cache를 쓴다. 3100이 이미 떠 있던 서버여도 섞이지 않게 여기서도 비운다
      command: "node e2e/clear-data-cache.mjs .next && node node_modules/next/dist/bin/next start -p 3101",
      url: "http://127.0.0.1:3101/home",
      env: { NODE_OPTIONS: "--import ./e2e/upstream-stub.mjs", DATA_GO_KR_SERVICE_KEY: "e2e-stub" },
      reuseExistingServer: false,
      timeout: 120_000,
    },
  ],
});
