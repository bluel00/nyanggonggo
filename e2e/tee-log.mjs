// E2E 서버 명령을 돌리며 출력을 화면과 파일에 함께 남긴다(playwright.config.ts의 webServer가 쓴다).
//   node e2e/tee-log.mjs <로그 파일> "<셸 명령>"
// 종료 코드는 명령의 것을 그대로 돌려준다. Playwright가 서버를 끌 때는 프로세스 트리째 끈다.
import { spawn } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";
import { dirname } from "node:path";

const [logFile, command] = process.argv.slice(2);
if (!logFile || !command) throw new Error('사용법: node e2e/tee-log.mjs <로그 파일> "<셸 명령>"');
mkdirSync(dirname(logFile), { recursive: true });
const log = createWriteStream(logFile, { flags: "a" });
const child = spawn(command, { shell: true, stdio: ["ignore", "pipe", "pipe"], env: process.env });
child.stdout.on("data", (chunk) => {
  process.stdout.write(chunk);
  log.write(chunk);
});
child.stderr.on("data", (chunk) => {
  process.stderr.write(chunk);
  log.write(chunk);
});
child.on("exit", (code, signal) => {
  log.end(`\n[tee-log] 종료 code=${code} signal=${signal}\n`);
  process.exitCode = code ?? 1;
});
