import { writeFileSync } from "node:fs";
import type { FullResult, Reporter, Suite, TestCase } from "@playwright/test/reporter";

/** 실제 공공 API를 부르는 테스트에 붙이는 표시(e2e/live). 기본 E2E는 서버가 모두 스텁이라 붙지 않는다(0개여야 한다) */
export const REAL_API_ANNOTATION = "real-api";

/**
 * 실행마다 요약(summary.md)을 실행 폴더에 남기고, 실패·실행 안 됨을 화면에도 다시 적는다(playwright.config.ts).
 * 테스트마다 실제 공공 API를 쓰는지 함께 적는다: 실패가 우리 코드 때문인지 공공 API(지연·쿼터·데이터 변화) 때문인지 가르는 첫 단서다.
 */
export default class RunReporter implements Reporter {
  private root?: Suite;
  constructor(private readonly options: { outputFile: string }) {}

  onBegin(_config: unknown, suite: Suite) {
    this.root = suite;
  }

  onEnd(result: FullResult) {
    const tests = this.root?.allTests() ?? [];
    const realApi = (test: TestCase) =>
      [test.annotations, ...test.results.map((r) => r.annotations)].flat().some((a) => a.type === REAL_API_ANNOTATION);
    const name = (test: TestCase) =>
      `[${test.parent.project()?.name}] ${test.location.file.replace(/\\/g, "/").split("/e2e/").at(-1)}:${test.location.line} ${test.titlePath().slice(3).join(" › ")}${realApi(test) ? " — 실제 공공 API" : ""}`;
    const failed = tests.filter((t) => t.outcome() === "unexpected");
    const flaky = tests.filter((t) => t.outcome() === "flaky");
    const notRun = tests.filter((t) => t.results.length === 0 || t.results.every((r) => r.status === "skipped"));
    const lines = [
      `# E2E ${result.status} (${new Date(result.startTime).toISOString()}, ${Math.round(result.duration / 1000)}s)`,
      "",
      `- 전체 ${tests.length}, 실패 ${failed.length}, 흔들림(재시도 통과) ${flaky.length}, 실행 안 됨·건너뜀 ${notRun.length}`,
      `- 실제 공공 API를 쓰는 테스트 ${tests.filter(realApi).length}개`,
      ...section("실패", failed, (t) => {
        const error = t.results.at(-1)?.error?.message?.split("\n")[0] ?? "";
        return `${name(t)}\n  - ${error.replace(/\x1b\[[0-9;]*m/g, "")}`;
      }),
      ...section("흔들림", flaky, name),
      ...section("실행 안 됨·건너뜀", notRun, name),
    ];
    writeFileSync(this.options.outputFile, lines.join("\n") + "\n");
    if (failed.length || notRun.length) console.log(`\n${lines.join("\n")}\n`);
    console.log(`E2E 기록: ${this.options.outputFile}`);
  }
}

function section(title: string, tests: TestCase[], format: (test: TestCase) => string): string[] {
  return tests.length ? ["", `## ${title}`, ...tests.map((t) => `- ${format(t)}`)] : [];
}
