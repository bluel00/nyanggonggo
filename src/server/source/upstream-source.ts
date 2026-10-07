import { noopLogger, type Logger } from "../logger";
import { mapUpstreamItem, type MappedAnimal } from "../mapper";
import type { UpstreamClient } from "../upstream/client";
import type { AnimalSource } from "./animal-source";

/**
 * 기본 구현. 캐시는 업스트림 클라이언트의 페이지 캐시(검증을 통과한 페이지만, Next 데이터 캐시)가 맡고,
 * 파싱과 Mapper는 요청마다 메모리에서 한다.
 */
export function createUpstreamAnimalSource(
  upstream: UpstreamClient,
  logger: Logger = noopLogger,
): AnimalSource {
  return {
    async list({ species, uprCd, orgCd }) {
      const dtos = await upstream.fetchAll({
        species,
        uprCd: uprCd === "all" ? undefined : uprCd,
        // 시도 전체(all)에는 시군구를 붙이지 않는다
        ...(uprCd !== "all" && orgCd ? { orgCd } : {}),
      });
      return dtos.flatMap((dto) => mapUpstreamItem(dto, { logger }) ?? []);
    },

    async getById(id): Promise<MappedAnimal | null> {
      const dto = await upstream.fetchByDesertionNo(id);
      return dto ? mapUpstreamItem(dto, { logger }) : null;
    },
  };
}
