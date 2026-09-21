import { describe, expect, it, vi } from "vitest";
import { AnimalWireDtoSchema } from "@/contract/animals";
import fixture from "../../docs/fixtures/upstream-items.json";
import { mapUpstreamItem, type MappedAnimal } from "./mapper";
import { UpstreamAnimalItemSchema, type UpstreamAnimalItemDto } from "./upstream/dto";

const dtos = fixture.items.map((item) => UpstreamAnimalItemSchema.parse(item));
const byId = (id: string) => {
  const dto = dtos.find((d) => d.desertionNo === id);
  if (!dto) throw new Error(`fixture ${id} not found`);
  return dto;
};

const PROTECTED_CAT = byId("450650202602282");
const SEX_Q = byId("448536202600859");
const OPTIONAL_SFE = byId("445470202600976");
const ENDED_EUTHANASIA = byId("427346202600847");
const TWO_BRACKETS = byId("448537202601421");
const DOG_VACCINATION = byId("448539202600280");

const WIRE_KEYS = [
  "ageText",
  "foundPlaceText",
  "id",
  "images",
  "noticeEndDate",
  "noticePeriodText",
  "regionText",
  "sex",
  "shelterName",
  "species",
  "status",
];

function map(dto: UpstreamAnimalItemDto, log = vi.fn()): MappedAnimal {
  const result = mapUpstreamItem(dto, { log });
  if (!result) throw new Error("expected mapped result");
  return result;
}

describe("mapUpstreamItem", () => {
  it("픽스처 6건이 계약 스키마를 통과하고 계약 키만 가진다", () => {
    for (const dto of dtos) {
      const { wire } = map(dto);
      expect(AnimalWireDtoSchema.strict().parse(wire)).toEqual(wire);
      expect(Object.keys(wire).sort()).toEqual(WIRE_KEYS);
    }
  });

  it("연락처(careTel, careAddr, careOwnerNm)는 결과 어디에도 없다", () => {
    for (const dto of dtos) {
      const result = map(dto);
      const serialized = JSON.stringify(result);
      for (const key of ["careTel", "careAddr", "careOwnerNm"] as const) {
        expect(serialized).not.toContain(key);
        // careOwnerNm은 orgNm(regionText로 공개)과 같은 값일 수 있다(픽스처 1: 제주특별자치도).
        if (dto[key] !== dto.orgNm) expect(serialized).not.toContain(dto[key].trim());
      }
    }
  });

  it("종료(안락사)는 ended이고, 결과 어디에도 endReason 값이 없다", () => {
    const log = vi.fn();
    const result = map(ENDED_EUTHANASIA, log);
    expect(result.wire.status).toBe("ended");
    expect(ENDED_EUTHANASIA.endReason).toBeTruthy();
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("endReason");
    expect(serialized).not.toContain(ENDED_EUTHANASIA.endReason!);
    expect(log).not.toHaveBeenCalled();
  });

  it("종료로 시작하는 다른 값도 ended이다", () => {
    const log = vi.fn();
    expect(map({ ...PROTECTED_CAT, processState: "종료(자연사)" }, log).wire.status).toBe("ended");
    expect(map({ ...PROTECTED_CAT, processState: "종료(입양)" }, log).wire.status).toBe("ended");
    expect(log).not.toHaveBeenCalled();
  });

  it("보호중은 protected이고 로그를 남기지 않는다", () => {
    const log = vi.fn();
    expect(map(PROTECTED_CAT, log).wire.status).toBe("protected");
    expect(log).not.toHaveBeenCalled();
  });

  it("알 수 없는 processState는 protected로 두고 로그를 남긴다", () => {
    const log = vi.fn();
    expect(map({ ...PROTECTED_CAT, processState: "공고중" }, log).wire.status).toBe("protected");
    expect(log).toHaveBeenCalledOnce();
    expect(log.mock.calls[0][1]).toMatchObject({ processState: "공고중" });
  });

  it("sexCd: M→male, F→female, Q→unknown, 그 외→unknown", () => {
    expect(map(TWO_BRACKETS).wire.sex).toBe("male");
    expect(map(PROTECTED_CAT).wire.sex).toBe("female");
    expect(map(SEX_Q).wire.sex).toBe("unknown");
    expect(map({ ...PROTECTED_CAT, sexCd: "" }).wire.sex).toBe("unknown");
  });

  it("upKindNm: 고양이→cat, 개→dog", () => {
    expect(map(PROTECTED_CAT).wire.species).toBe("cat");
    expect(map(DOG_VACCINATION).wire.species).toBe("dog");
  });

  it("upKindNm이 고양이/개가 아니면 null을 반환하고 로그를 남긴다", () => {
    const log = vi.fn();
    expect(mapUpstreamItem({ ...PROTECTED_CAT, upKindNm: "기타축종" }, { log })).toBeNull();
    expect(log).toHaveBeenCalledOnce();
  });

  it("optional 필드가 있는 항목과 없는 항목 모두 매핑된다", () => {
    expect(OPTIONAL_SFE.sfeSoci).toBeDefined();
    expect(DOG_VACCINATION.vaccinationChk).toBeDefined();
    expect(PROTECTED_CAT.sfeSoci).toBeUndefined();
    for (const dto of [OPTIONAL_SFE, DOG_VACCINATION, PROTECTED_CAT]) {
      expect(mapUpstreamItem(dto, { log: vi.fn() })).not.toBeNull();
    }
  });

  describe("images", () => {
    it("파일명의 [1]을 %5B1%5D로 인코딩한다", () => {
      const { images } = map(ENDED_EUTHANASIA).wire;
      expect(images).toEqual([
        "http://openapi.animal.go.kr/openapi/service/rest/fileDownloadSrvc/files/shelter/2026/09/202609081809275%5B1%5D.jpg",
        "http://openapi.animal.go.kr/openapi/service/rest/fileDownloadSrvc/files/shelter/2026/09/202609081809899.jpg",
      ]);
    });

    it("두 장 모두 [1]이 있어도 각각 인코딩한다", () => {
      const { images } = map(TWO_BRACKETS).wire;
      expect(images).toHaveLength(2);
      for (const url of images) {
        expect(url).not.toMatch(/[[\]]/);
        expect(url).toMatch(/%5B1%5D\.jpg$/);
      }
    });

    it("encodeURI는 URL 구조(스킴, 호스트, 경로 구분자)를 보존한다", () => {
      const [url] = map(TWO_BRACKETS).wire.images;
      const parsed = new URL(url);
      expect(parsed.protocol).toBe("http:");
      expect(parsed.host).toBe("openapi.animal.go.kr");
      expect(parsed.pathname).toBe(
        "/openapi/service/rest/fileDownloadSrvc/files/shelter/2026/09/202609211109624%5B1%5D.jpg",
      );
    });

    it("대괄호가 없는 URL은 바꾸지 않는다", () => {
      expect(map(PROTECTED_CAT).wire.images).toEqual([PROTECTED_CAT.popfile1, PROTECTED_CAT.popfile2]);
    });

    it("popfile1..N 중 값이 있는 것만 번호순으로 모은다", () => {
      const dto = UpstreamAnimalItemSchema.parse({
        ...PROTECTED_CAT,
        popfile1: "http://a.test/1.jpg",
        popfile2: "",
        popfile10: "http://a.test/10.jpg",
        popfile3: "http://a.test/3.jpg",
      });
      expect(map(dto).wire.images).toEqual([
        "http://a.test/1.jpg",
        "http://a.test/3.jpg",
        "http://a.test/10.jpg",
      ]);
    });

    it("사진이 없으면 빈 배열이다", () => {
      const { popfile1: _p1, popfile2: _p2, ...rest } = PROTECTED_CAT;
      expect(map(rest).wire.images).toEqual([]);
    });
  });

  describe("날짜", () => {
    it("noticePeriodText는 MM.DD ~ MM.DD, noticeEndDate는 YYYY-MM-DD", () => {
      const { wire } = map(PROTECTED_CAT);
      expect(wire.noticePeriodText).toBe("09.21 ~ 10.01");
      expect(wire.noticeEndDate).toBe("2026-10-01");
      expect(map(SEX_Q).wire.noticePeriodText).toBe("09.21 ~ 09.28");
    });

    it("날짜 형식이 다르면 null이다", () => {
      const { wire } = map({ ...PROTECTED_CAT, noticeEdt: "", noticeSdt: "20260231" });
      expect(wire.noticeEndDate).toBeNull();
      expect(wire.noticePeriodText).toBeNull();
    });
  });

  it("sortKeys는 noticeSdt, noticeEdt, updTm 원문이다", () => {
    expect(map(PROTECTED_CAT).sortKeys).toEqual({
      noticeSdt: "20260921",
      noticeEdt: "20261001",
      updTm: "2026-09-21 11:29:37.0",
    });
  });

  it("텍스트 필드는 원문을 유지하되 앞뒤 공백만 제거한다", () => {
    const { wire } = map(ENDED_EUTHANASIA);
    expect(wire.id).toBe("427346202600847");
    expect(wire.ageText).toBe("2026(60일미만)(년생)");
    expect(wire.regionText).toBe("대구광역시 수성구");
    expect(wire.shelterName).toBe("세인트동물병원");
    expect(wire.foundPlaceText).toBe("범어로 18길 22");
  });
});
