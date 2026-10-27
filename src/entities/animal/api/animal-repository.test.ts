import { describe, expect, it, vi } from "vitest";
import { ANIMAL_BY_IDS_MAX, type AnimalWireDto } from "@/contract/animals";
import { ApiError } from "@/shared/api/api-request";
import { createHttpClient, type FetchLike } from "@/shared/api/http-client";
import { BY_IDS_CHUNK_CONCURRENCY, createAnimalRepository } from "./animal-repository";
import { makeWire } from "@tests/factories/animal";

const wire = (overrides: Partial<AnimalWireDto> = {}): AnimalWireDto =>
  makeWire({
    id: "450650202602282",
    images: ["http://a.test/1.jpg", "http://a.test/2%5B1%5D.jpg"],
    sex: "female",
    ageText: "2024(년생)",
    regionText: "제주특별자치도",
    shelterName: "제2동물보호센터",
    foundPlaceText: "서귀포시 남원읍",
    noticePeriodText: "09.21 ~ 10.01",
    ...overrides,
  });

function setup(body: unknown, status = 200) {
  const fetch = vi.fn<FetchLike>(async () => Response.json(body, { status }));
  const repository = createAnimalRepository({ http: createHttpClient({ fetch }) });
  const requested = () => new URL(fetch.mock.calls[0][0], "http://localhost");
  return { fetch, repository, requested };
}

describe("createAnimalRepository", () => {
  describe("getAnimals", () => {
    // CDN 캐시 키(요청 URL 그대로, 쿼리스트링 순서 포함)를 고정한다(이슈 #28). 기대값은 계약을 읽지 않고 글자로 적는다
    describe("CDN 캐시 키가 값 조합마다 그대로다", () => {
      const combos = ["cat", "dog", "other"].flatMap((species) =>
        ["protected", "ended", "all"].flatMap((status) =>
          ["all", "female", "male"].flatMap((sex) => ["latest", "deadline"].map((sort) => ({ species, status, sex, sort }))),
        ),
      ) as { species: "cat"; status: "protected"; sex: "all"; sort: "latest" }[];

      it.each(combos)("$species $status $sex $sort", async (filter) => {
        const { fetch, repository } = setup({ items: [], nextCursor: null });
        await repository.getAnimals(filter);
        const sex = filter.sex === "all" ? "" : `&sex=${filter.sex}`;
        expect(fetch.mock.calls[0][0]).toBe(`/api/animals?species=${filter.species}&status=${filter.status}&sort=${filter.sort}${sex}`);
      });

      it("지역·시군구·성별·커서가 모두 있을 때의 순서", async () => {
        const { fetch, repository } = setup({ items: [], nextCursor: null });
        await repository.getAnimals({
          species: "dog",
          region: "6110000",
          district: "3000000",
          status: "ended",
          sex: "female",
          sort: "deadline",
          cursor: "MjA",
        });
        expect(fetch.mock.calls[0][0]).toBe(
          "/api/animals?species=dog&status=ended&sort=deadline&region=6110000&district=3000000&sex=female&cursor=MjA",
        );
      });
    });

    it("sex는 전체면 보내지 않고, 고르면 sex=로 보낸다(이슈 #20)", async () => {
      const all = setup({ items: [], nextCursor: null });
      await all.repository.getAnimals({ species: "cat", status: "protected", sex: "all", sort: "latest" });
      expect(all.requested().searchParams.has("sex")).toBe(false);
      const female = setup({ items: [], nextCursor: null });
      await female.repository.getAnimals({ species: "cat", status: "protected", sex: "female", sort: "latest" });
      expect(female.requested().searchParams.get("sex")).toBe("female");
    });

    it("쿼리를 만들고 응답을 Domain으로 바꾼다(날짜 → KST 00:00 Date)", async () => {
      const { repository, requested } = setup({ items: [wire(), wire({ id: "2", status: "ended" })], nextCursor: "MjA" });
      const page = await repository.getAnimals({ species: "cat", region: "6260000", status: "all", sex: "all", sort: "deadline", cursor: "MjA" });

      const url = requested();
      expect(url.pathname).toBe("/api/animals");
      expect(Object.fromEntries(url.searchParams)).toEqual({
        species: "cat",
        status: "all",
        sort: "deadline",
        region: "6260000",
        cursor: "MjA",
      });
      expect(page.nextCursor).toBe("MjA");
      expect(page.items.map((a) => a.id)).toEqual(["450650202602282", "2"]);
      expect(page.items[0].noticeEndAt?.toISOString()).toBe("2026-09-30T15:00:00.000Z");
      expect(page.items[1].status).toBe("ended");
    });

    it("district는 region과 함께 보내고, region이 없으면 보내지 않는다", async () => {
      const { fetch, repository } = setup({ items: [], nextCursor: null });
      await repository.getAnimals({ species: "cat", region: "6110000", district: "3000000", status: "protected", sex: "all", sort: "latest" });
      await repository.getAnimals({ species: "cat", district: "3000000", status: "protected", sex: "all", sort: "latest" });
      const [first, second] = fetch.mock.calls.map(([input]) => new URL(input, "http://localhost"));
      expect(first.searchParams.get("district")).toBe("3000000");
      expect(second.searchParams.has("district")).toBe(false);
    });

    it("region과 cursor가 없으면 보내지 않는다", async () => {
      const { repository, requested } = setup({ items: [], nextCursor: null });
      await repository.getAnimals({ species: "dog", status: "protected", sex: "all", sort: "latest" });
      expect([...requested().searchParams.keys()].sort()).toEqual(["sort", "species", "status"]);
    });

    it("계약과 다른 응답은 contract ApiError(어긋난 경로를 담는다)", async () => {
      const { repository } = setup({ items: [{ ...wire(), species: "bird", careTel: "010-0000-0000" }], nextCursor: null });
      const error = await repository.getAnimals({ species: "cat", status: "protected", sex: "all", sort: "latest" }).catch((e) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ kind: "contract", endpoint: "/api/animals", issues: ["items.0.species"] });
      expect(JSON.stringify(error)).not.toContain("010-0000-0000");
    });

    it("서버 오류는 서버가 준 code/message를 가진 ApiError", async () => {
      const { repository } = setup({ error: { code: "upstream_error", message: "공고 정보를 불러오지 못했어요." } }, 502);
      await expect(repository.getAnimals({ species: "cat", status: "protected", sex: "all", sort: "latest" })).rejects.toMatchObject({
        kind: "http",
        status: 502,
        code: "upstream_error",
        message: "공고 정보를 불러오지 못했어요.",
      });
    });

    it("signal을 fetch로 전달한다", async () => {
      const { fetch, repository } = setup({ items: [], nextCursor: null });
      const controller = new AbortController();
      await repository.getAnimals({ species: "cat", status: "protected", sex: "all", sort: "latest" }, { signal: controller.signal });
      const signal = fetch.mock.calls[0][1]?.signal as AbortSignal;
      controller.abort();
      expect(signal.aborted).toBe(true);
    });
  });

  describe("getAnimalById", () => {
    it("id를 경로에 넣고 Domain을 돌려준다", async () => {
      const { repository, requested } = setup(wire({ id: "448539202600280", species: "dog" }));
      const animal = await repository.getAnimalById("448539202600280");
      expect(requested().pathname).toBe("/api/animals/448539202600280");
      expect(animal).toMatchObject({ id: "448539202600280", species: "dog" });
    });

    it("404는 not_found ApiError", async () => {
      const { repository } = setup({ error: { code: "not_found", message: "공고를 찾을 수 없어요." } }, 404);
      await expect(repository.getAnimalById("1")).rejects.toMatchObject({ kind: "http", status: 404, code: "not_found" });
    });
  });

  describe("getAnimalsByIds", () => {
    it("ids를 쉼표로 이어 보내고 응답 순서대로 Domain을 돌려준다", async () => {
      const { repository, requested } = setup({ items: [wire({ id: "3" }), wire({ id: "1" })], failedIds: [] });
      const result = await repository.getAnimalsByIds(["3", "2", "1"]);
      expect(requested().pathname).toBe("/api/animals/by-ids");
      expect(requested().searchParams.get("ids")).toBe("3,2,1");
      expect(result.items.map((a) => a.id)).toEqual(["3", "1"]);
      expect(result.failedIds).toEqual([]);
    });

    it("서버가 알려 준 failedIds를 그대로 돌려준다", async () => {
      const { repository } = setup({ items: [wire({ id: "3" })], failedIds: ["1"] });
      await expect(repository.getAnimalsByIds(["3", "2", "1"])).resolves.toMatchObject({
        items: [{ id: "3" }],
        failedIds: ["1"],
      });
    });

    it("요청이 실패하면(전부 실패) ApiError를 던진다", async () => {
      const { repository } = setup({ error: { code: "upstream_error", message: "공고 정보를 불러오지 못했어요." } }, 502);
      await expect(repository.getAnimalsByIds(["3"])).rejects.toMatchObject({ kind: "http", status: 502 });
    });

    describe("상한을 넘는 ids는 청크로 나눈다", () => {
      // 상한의 2.5배(125개). id "k"는 5의 배수만 서버에 있다고 가정한다(나머지는 못 찾음).
      const ids = Array.from({ length: ANIMAL_BY_IDS_MAX * 2.5 }, (_, i) => String(1000 + i));
      const known = (id: string) => Number(id) % 5 === 0;

      function chunkedSetup(delayMs = 0) {
        let running = 0;
        let peak = 0;
        const fetch = vi.fn<FetchLike>(async (input) => {
          running += 1;
          peak = Math.max(peak, running);
          const requestedIds = new URL(input, "http://localhost").searchParams.get("ids")!.split(",");
          // 서버처럼 요청 순서를 유지하고 못 찾은 id는 뺀다. 응답 도착 순서는 일부러 뒤섞는다.
          await new Promise((r) => setTimeout(r, delayMs * (4 - Number(requestedIds[0]) % 4)));
          running -= 1;
          return Response.json({ items: requestedIds.filter(known).map((id) => wire({ id })), failedIds: [] });
        });
        const repository = createAnimalRepository({ http: createHttpClient({ fetch }) });
        const requestedChunks = () =>
          fetch.mock.calls.map(([input]) => new URL(input, "http://localhost").searchParams.get("ids")!.split(","));
        return { fetch, repository, requestedChunks, peak: () => peak };
      }

      it("50 / 50 / 25개로 3번 요청하고, 각 청크는 입력 순서대로 이어진다", async () => {
        const { fetch, repository, requestedChunks } = chunkedSetup();
        await repository.getAnimalsByIds(ids);
        expect(fetch).toHaveBeenCalledTimes(3);
        expect(requestedChunks().map((c) => c.length)).toEqual([50, 50, 25]);
        expect(requestedChunks().flat()).toEqual(ids);
      });

      it("결과는 입력 순서를 유지하고, 못 찾은 id는 빠지며 나머지는 정상 반환된다", async () => {
        const { repository } = chunkedSetup(1);
        const { items, failedIds } = await repository.getAnimalsByIds(ids);
        expect(items.map((a) => a.id)).toEqual(ids.filter(known));
        expect(items).toHaveLength(25);
        expect(failedIds).toEqual([]);
      });

      it("동시 요청은 상한(3) 이내", async () => {
        const many = Array.from({ length: ANIMAL_BY_IDS_MAX * 5 }, (_, i) => String(2000 + i));
        const { repository, peak } = chunkedSetup(2);
        await repository.getAnimalsByIds(many);
        expect(peak()).toBeLessThanOrEqual(BY_IDS_CHUNK_CONCURRENCY);
        expect(peak()).toBeGreaterThan(1);
      });

      it("중복 id는 한 번만 보낸다", async () => {
        const { requestedChunks, repository } = chunkedSetup();
        await repository.getAnimalsByIds(["1005", "1001", "1005"]);
        expect(requestedChunks()).toEqual([["1005", "1001"]]);
      });

      /** failing(청크 첫 id)에 해당하는 청크는 502, 나머지는 known만 돌려준다 */
      function failingChunks(failing: (first: string) => boolean) {
        const fetch = vi.fn<FetchLike>(async (input) => {
          const requestedIds = new URL(input, "http://localhost").searchParams.get("ids")!.split(",");
          if (failing(requestedIds[0]!)) {
            return Response.json({ error: { code: "upstream_error", message: "공고 정보를 불러오지 못했어요." } }, { status: 502 });
          }
          return Response.json({ items: requestedIds.filter(known).map((id) => wire({ id })), failedIds: [] });
        });
        return createAnimalRepository({ http: createHttpClient({ fetch }) });
      }

      it("한 청크가 실패하면 나머지 청크는 그대로 두고, 실패한 청크의 id를 모두 failedIds에 담는다", async () => {
        const repository = failingChunks((first) => first === ids[ANIMAL_BY_IDS_MAX]);
        const { items, failedIds } = await repository.getAnimalsByIds(ids);
        const failedChunk = ids.slice(ANIMAL_BY_IDS_MAX, ANIMAL_BY_IDS_MAX * 2);
        expect(failedIds).toEqual(failedChunk);
        expect(items.map((a) => a.id)).toEqual(ids.filter((id) => known(id) && !failedChunk.includes(id)));
      });

      it("모든 청크가 실패하면 전체가 실패한다", async () => {
        const repository = failingChunks(() => true);
        await expect(repository.getAnimalsByIds(ids)).rejects.toMatchObject({ kind: "http", status: 502 });
      });
    });

    it("빈 배열이면 호출하지 않고 빈 결과", async () => {
      const { fetch, repository } = setup({ items: [], failedIds: [] });
      await expect(repository.getAnimalsByIds([])).resolves.toEqual({ items: [], failedIds: [] });
      expect(fetch).not.toHaveBeenCalled();
    });
  });
});
