import { describe, expect, it, vi } from "vitest";
import type { AnimalWireDto } from "@/contract/animals";
import { ApiError } from "@/shared/api/api-request";
import { createHttpClient, type FetchLike } from "@/shared/api/http-client";
import { createAnimalRepository } from "./animal-repository";

const wire = (overrides: Partial<AnimalWireDto> = {}): AnimalWireDto => ({
  id: "450650202602282",
  species: "cat",
  images: ["http://a.test/1.jpg", "http://a.test/2%5B1%5D.jpg"],
  status: "protected",
  noticeEndDate: "2026-10-01",
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
    it("쿼리를 만들고 응답을 Domain으로 바꾼다(날짜 → KST 00:00 Date)", async () => {
      const { repository, requested } = setup({ items: [wire(), wire({ id: "2", status: "ended" })], nextCursor: "MjA" });
      const page = await repository.getAnimals({ species: "cat", region: "6260000", status: "all", sort: "endingSoon", cursor: "MjA" });

      const url = requested();
      expect(url.pathname).toBe("/api/animals");
      expect(Object.fromEntries(url.searchParams)).toEqual({
        species: "cat",
        status: "all",
        sort: "endingSoon",
        region: "6260000",
        cursor: "MjA",
      });
      expect(page.nextCursor).toBe("MjA");
      expect(page.items.map((a) => a.id)).toEqual(["450650202602282", "2"]);
      expect(page.items[0].noticeEndAt?.toISOString()).toBe("2026-09-30T15:00:00.000Z");
      expect(page.items[1].status).toBe("ended");
    });

    it("region과 cursor가 없으면 보내지 않는다", async () => {
      const { repository, requested } = setup({ items: [], nextCursor: null });
      await repository.getAnimals({ species: "dog", status: "protected", sort: "latest" });
      expect([...requested().searchParams.keys()].sort()).toEqual(["sort", "species", "status"]);
    });

    it("계약과 다른 응답은 contract ApiError(어긋난 경로를 담는다)", async () => {
      const { repository } = setup({ items: [{ ...wire(), species: "bird", careTel: "010-0000-0000" }], nextCursor: null });
      const error = await repository.getAnimals({ species: "cat", status: "protected", sort: "latest" }).catch((e) => e);
      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ kind: "contract", endpoint: "/api/animals", issues: ["items.0.species"] });
      expect(JSON.stringify(error)).not.toContain("010-0000-0000");
    });

    it("서버 오류는 서버가 준 code/message를 가진 ApiError", async () => {
      const { repository } = setup({ error: { code: "upstream_error", message: "공고 정보를 불러오지 못했어요." } }, 502);
      await expect(repository.getAnimals({ species: "cat", status: "protected", sort: "latest" })).rejects.toMatchObject({
        kind: "http",
        status: 502,
        code: "upstream_error",
        message: "공고 정보를 불러오지 못했어요.",
      });
    });

    it("signal을 fetch로 전달한다", async () => {
      const { fetch, repository } = setup({ items: [], nextCursor: null });
      const controller = new AbortController();
      await repository.getAnimals({ species: "cat", status: "protected", sort: "latest" }, { signal: controller.signal });
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
      const { repository, requested } = setup({ items: [wire({ id: "3" }), wire({ id: "1" })] });
      const animals = await repository.getAnimalsByIds(["3", "2", "1"]);
      expect(requested().pathname).toBe("/api/animals/by-ids");
      expect(requested().searchParams.get("ids")).toBe("3,2,1");
      expect(animals.map((a) => a.id)).toEqual(["3", "1"]);
    });

    it("빈 배열이면 호출하지 않고 빈 결과", async () => {
      const { fetch, repository } = setup({ items: [] });
      await expect(repository.getAnimalsByIds([])).resolves.toEqual([]);
      expect(fetch).not.toHaveBeenCalled();
    });
  });
});
