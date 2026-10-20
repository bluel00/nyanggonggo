import { mkdirSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { loadEnvFile } from "node:process";
import { defineConfig } from "@playwright/test";

/**
 * 실제 공공 API 응답 형식 확인(`pnpm e2e:live`, e2e/live). 기본 E2E(playwright.config.ts)와 따로 돈다: 기본 E2E는 서버를 모두 스텁으로
 * 띄워 실제 API를 부르지 않는다. 이 실행은 브라우저·서버 없이 서버와 같은 업스트림 클라이언트를 테스트 프로세스에서 부른다.
 * 서비스키는 서버 환경변수 DATA_GO_KR_SERVICE_KEY다. 없으면 .env.local에서 읽는다(출력하지 않는다).
 */
if (!process.env.DATA_GO_KR_SERVICE_KEY) {
  try {
    loadEnvFile(".env.local");
  } catch {
    // 파일이 없으면 테스트가 키 없음으로 실패한다
  }
}

/** 실행 기록은 e2e-results/live/<시각>/에 따로 남기고 최근 10개만 둔다(기본 E2E의 실행 기록과 섞이지 않게) */
const LIVE_RUNS_DIR = join("e2e-results", "live");
if (!process.env.E2E_LIVE_RUN_DIR) {
  mkdirSync(LIVE_RUNS_DIR, { recursive: true });
  const old = readdirSync(LIVE_RUNS_DIR, { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort()
    .slice(0, -9);
  for (const name of old) rmSync(join(LIVE_RUNS_DIR, name), { recursive: true, force: true });
  process.env.E2E_LIVE_RUN_DIR = join(LIVE_RUNS_DIR, new Date().toISOString().replace(/[:.]/g, "-"));
}
const RUN_DIR = process.env.E2E_LIVE_RUN_DIR;

export default defineConfig({
  testDir: "./e2e/live",
  testMatch: /.*\.live\.ts$/,
  timeout: 30_000,
  workers: 1,
  retries: 0,
  outputDir: join(RUN_DIR, "test-results"),
  reporter: [["list"], ["./e2e/run-reporter.ts", { outputFile: join(RUN_DIR, "summary.md") }]],
});
