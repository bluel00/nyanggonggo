import { expect, test } from "@playwright/test";
import { AnimalWireDtoSchema } from "@/contract/animals";
import { mapUpstreamItem } from "@/server/mapper";
import { createUpstreamClient, type UpstreamClient, type UpstreamListParams } from "@/server/upstream/client";
import type { Logger } from "@/server/logger";
import { createHttpClient } from "@/shared/api/http-client";
import { REAL_API_ANNOTATION } from "../run-reporter";

/**
 * 실제 공공 API의 응답 형식 확인(`pnpm e2e:live`, playwright.live.config.ts). 기본 E2E에서는 돌지 않는다.
 * 화면이 아니라 응답을 본다: 서버와 같은 클라이언트(src/server/upstream/client.ts)로 한 페이지씩 받아, 모든 item이 도착 검증(Zod,
 * src/server/upstream/dto.ts)을 통과하고 계약(AnimalWireDto)으로 매핑되는지, 필수 필드가 비지 않았는지 본다.
 *
 * 공공 API 호출은 모두 3번(목록 두 페이지, 상세 하나)이다. 서비스키는 서버 환경변수(DATA_GO_KR_SERVICE_KEY)에서만 읽고 출력하지
 * 않는다(클라이언트가 오류 메시지에서 가린다). 쿼터 오류(UpstreamError quota_exceeded)가 나면 실패로 끝나고 다시 돌리지 않는다.
 */
test.describe.configure({ mode: "serial", retries: 0 });
test.beforeEach(() => {
  test.info().annotations.push({ type: REAL_API_ANNOTATION, description: "e2e/live" });
});

/** 검증·매핑에서 건너뛴 item을 모은다(서버는 건너뛰고 로그만 남기므로, 여기서는 그 로그를 실패로 본다) */
function collectingLogger() {
  const warnings: { message: string; context?: Record<string, unknown> }[] = [];
  const logger: Logger = { warn: (message, context) => warnings.push({ message, context }) };
  return { logger, warnings };
}

function liveClient(logger: Logger): UpstreamClient {
  const serviceKey = process.env.DATA_GO_KR_SERVICE_KEY;
  expect(serviceKey, "DATA_GO_KR_SERVICE_KEY(서버 환경변수, .env.local)가 있어야 한다").toBeTruthy();
  // 한 페이지(20건)만 받는다: maxPages 1이면 첫 페이지 뒤의 페이지를 부르지 않는다
  return createUpstreamClient({
    http: createHttpClient(),
    serviceKey: serviceKey!,
    logger,
    timeoutMs: 10_000,
    pageSize: 20,
    concurrency: 1,
    maxPages: 1,
  });
}

/** 받은 item이 모두 계약으로 매핑되고 필수 필드가 있는지. 매핑 결과(WireDto)를 돌려준다 */
function mapAll(items: Awaited<ReturnType<UpstreamClient["fetchAll"]>>, logger: Logger) {
  return items.map((dto) => {
    const mapped = mapUpstreamItem(dto, { logger });
    expect(mapped, `매핑 실패 ${dto.desertionNo}`).not.toBeNull();
    const wire = AnimalWireDtoSchema.parse(mapped!.wire);
    expect(wire.id).toMatch(/^\d+$/);
    expect(wire.regionText.length).toBeGreaterThan(0);
    expect(wire.noticeEndDate, `공고 종료일 ${wire.id}`).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    return wire;
  });
}

async function listPage(params: UpstreamListParams) {
  const { logger, warnings } = collectingLogger();
  const items = await liveClient(logger).fetchAll(params);
  const wires = mapAll(items, logger);
  // 한 페이지만 받으므로 "max pages reached"는 정상이다. 그 밖의 경고(형식 불일치로 건너뜀, 모르는 축종)는 실패다
  expect(warnings.filter((w) => w.message !== "upstream max pages reached, list truncated").map((w) => w.message)).toEqual([]);
  return wires;
}

let seoulCatIds: string[] = [];

test("목록 한 페이지(고양이·서울): 모든 item이 도착 검증·매핑을 통과하고 필수 필드가 있다", async () => {
  const wires = await listPage({ species: "cat", uprCd: "6110000" });
  expect(wires.length, "보호중·종료를 합쳐 한 페이지가 차야 한다").toBeGreaterThan(0);
  expect(wires.every((wire) => wire.species === "cat")).toBe(true);
  expect(new Set(wires.map((wire) => wire.status))).not.toEqual(new Set());
  seoulCatIds = wires.map((wire) => wire.id);
});

test("상세 하나(위 목록의 첫 공고): 단건 조회가 같은 공고를 돌려주고 도착 검증·매핑을 통과한다", async () => {
  expect(seoulCatIds.length, "목록 확인이 먼저 통과해야 한다").toBeGreaterThan(0);
  const { logger, warnings } = collectingLogger();
  const dto = await liveClient(logger).fetchByDesertionNo(seoulCatIds[0]);
  expect(dto, "단건 조회 결과가 있어야 한다").not.toBeNull();
  const [wire] = mapAll([dto!], logger);
  expect(wire.id).toBe(seoulCatIds[0]);
  expect(warnings.map((w) => w.message)).toEqual([]);
});

test("기타 축종 한 페이지(전국): 도착 검증·매핑을 통과하고, 대부분 어떤 동물인지(kindText)가 담겨 있다", async () => {
  const wires = await listPage({ species: "other" });
  expect(wires.length).toBeGreaterThan(0);
  expect(wires.every((wire) => wire.species === "other")).toBe(true);
  // 실측에서 kindFullNm은 늘 "[기타축종] <동물>"이라 대부분 이름이 뽑힌다(12.A P12)
  expect(wires.filter((wire) => wire.kindText).length).toBeGreaterThan(wires.length / 2);
});
