import "server-only";
import { AnimalListResponseSchema } from "@/contract/animals";
import { toAnimalListQuery, type AnimalListFilter, type AnimalListFirstPage } from "@/entities/animal";
import { getAnimalService } from "@/server/animals/container";
import { parseListQuery } from "@/server/animals/query";
import { classify } from "@/server/http/respond";
import { consoleLogger } from "@/server/logger";
import { createRequestPerf } from "@/server/perf/request-perf";

/**
 * 목록 첫 페이지(서버, 이슈 #109). `/api/animals`(app/api/animals/route.ts)와 같은 경로다: 필터를 같은 쿼리(`toAnimalListQuery`, 클라이언트 저장소와 같은 함수)로 만들어 같은 파서로 읽고,
 * 같은 서비스(공공 API 페이지 캐시 300초)로 조회한 뒤 같은 계약으로 검증한다. 그래서 브라우저가 첫 페이지를 부른 것과 같은 응답이다.
 *
 * 페이지는 이 promise를 기다리지 않고 목록에 넘긴다(뼈대가 먼저 그려지고 카드는 스트리밍으로 이어진다).
 * 실패는 예외로 던지지 않고 `{ ok: false }`로 돌려준다: 페이지가 깨지지 않고, 목록은 지금처럼 클라이언트가 조회한다(오류 화면 포함).
 * 요청마다 계측 로그 한 줄을 남긴다(목록 API와 같은 "list", architecture.md 12절 52).
 */
export async function loadFirstListPage(filter: AnimalListFilter): Promise<AnimalListFirstPage> {
  const perf = createRequestPerf("list");
  try {
    const params = parseListQuery(toAnimalListQuery(filter));
    const response = AnimalListResponseSchema.parse(await getAnimalService(perf).list(params));
    perf.finish({ status: 200 });
    return { ok: true, response };
  } catch (error) {
    classify(error, consoleLogger);
    perf.finish({ status: 500 });
    return { ok: false };
  }
}
