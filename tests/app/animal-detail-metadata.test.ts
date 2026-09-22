/** app/animals/[id]/page.tsx generateMetadata: 서비스를 가짜로 바꿔 공공 API를 호출하지 않는다 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { AnimalWireDto } from "@/contract/animals";

const getById = vi.fn<(id: string) => Promise<AnimalWireDto>>();
vi.mock("@/server/animals/container", () => ({ getAnimalService: () => ({ getById }) }));

const { generateMetadata } = await import("@/app/animals/[id]/page");

beforeEach(() => {
  getById.mockReset();
  vi.useFakeTimers({ toFake: ["Date"] });
  vi.setSystemTime(new Date("2026-09-21T09:00:00+09:00"));
});

const wire: AnimalWireDto = {
  id: "1",
  species: "cat",
  images: [],
  status: "protected",
  noticeEndDate: "2026-10-01",
  sex: "female",
  ageText: null,
  regionText: "제주특별자치도",
  shelterName: "제2동물보호센터",
  foundPlaceText: null,
  noticePeriodText: null,
};
const meta = (id: string) => generateMetadata({ params: Promise.resolve({ id }) });

describe("상세 generateMetadata", () => {
  it("지역 기반 제목과 상태·보호소 설명(og 포함)", async () => {
    getById.mockResolvedValue(wire);
    expect(await meta("1")).toEqual({
      title: "제주특별자치도 고양이 공고 | 냥공고",
      description: "보호중 · D-10 · 제2동물보호센터",
      openGraph: { title: "제주특별자치도 고양이 공고 | 냥공고", description: "보호중 · D-10 · 제2동물보호센터" },
    });
  });

  it("조회 실패나 잘못된 id면 기본 메타데이터", async () => {
    getById.mockRejectedValue(new Error("upstream"));
    expect(await meta("1")).toEqual({});
    expect(await meta("abc")).toEqual({});
    expect(getById).toHaveBeenCalledTimes(1);
  });
});
