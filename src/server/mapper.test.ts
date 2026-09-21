import { describe, expect, it, vi } from "vitest";
import { AnimalWireDtoSchema } from "@/contract/animals";
import fixture from "../../docs/fixtures/upstream-items.json";
import { encodeImageUrl, mapUpstreamItem, type MappedAnimal } from "./mapper";
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

const spyLogger = () => ({ warn: vi.fn() });

function map(dto: UpstreamAnimalItemDto, logger = spyLogger()): MappedAnimal {
  const result = mapUpstreamItem(dto, { logger });
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
        const value = dto[key]?.trim();
        if (value && value !== dto.orgNm) expect(serialized).not.toContain(value);
      }
    }
  });

  it("종료(안락사)는 ended이고, 결과 어디에도 endReason 값이 없다", () => {
    const logger = spyLogger();
    const result = map(ENDED_EUTHANASIA, logger);
    expect(result.wire.status).toBe("ended");
    expect(ENDED_EUTHANASIA.endReason).toBeTruthy();
    const serialized = JSON.stringify(result);
    expect(serialized).not.toContain("endReason");
    expect(serialized).not.toContain(ENDED_EUTHANASIA.endReason!);
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("종료로 시작하는 다른 값도 ended이다", () => {
    const logger = spyLogger();
    expect(map({ ...PROTECTED_CAT, processState: "종료(자연사)" }, logger).wire.status).toBe("ended");
    expect(map({ ...PROTECTED_CAT, processState: "종료(입양)" }, logger).wire.status).toBe("ended");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("보호중은 protected이고 로그를 남기지 않는다", () => {
    const logger = spyLogger();
    expect(map(PROTECTED_CAT, logger).wire.status).toBe("protected");
    expect(logger.warn).not.toHaveBeenCalled();
  });

  it("알 수 없는 processState는 protected로 두고 로그를 남긴다", () => {
    const logger = spyLogger();
    expect(map({ ...PROTECTED_CAT, processState: "공고중" }, logger).wire.status).toBe("protected");
    expect(logger.warn).toHaveBeenCalledOnce();
    expect(logger.warn.mock.calls[0][1]).toMatchObject({ processState: "공고중" });
  });

  it("로거를 주지 않으면 아무것도 출력하지 않는다(기본 no-op)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    mapUpstreamItem({ ...PROTECTED_CAT, processState: "공고중" });
    mapUpstreamItem({ ...PROTECTED_CAT, upKindNm: "기타축종" });
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
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
    const logger = spyLogger();
    expect(mapUpstreamItem({ ...PROTECTED_CAT, upKindNm: "기타축종" }, { logger })).toBeNull();
    expect(logger.warn).toHaveBeenCalledOnce();
  });

  it("optional 필드가 있는 항목과 없는 항목 모두 매핑된다", () => {
    expect(OPTIONAL_SFE.sfeSoci).toBeDefined();
    expect(DOG_VACCINATION.vaccinationChk).toBeDefined();
    expect(PROTECTED_CAT.sfeSoci).toBeUndefined();
    for (const dto of [OPTIONAL_SFE, DOG_VACCINATION, PROTECTED_CAT]) {
      expect(mapUpstreamItem(dto)).not.toBeNull();
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

    it("URL 구조(스킴, 호스트, 경로 구분자)를 보존한다", () => {
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

  describe("encodeImageUrl", () => {
    it("[1] 파일명을 인코딩한다", () => {
      expect(encodeImageUrl("http://a.test/files/2026/09/1[1].jpg")).toBe(
        "http://a.test/files/2026/09/1%5B1%5D.jpg",
      );
    });

    it("이미 인코딩된 %20, %5B는 다시 인코딩하지 않는다", () => {
      expect(encodeImageUrl("http://a.test/my%20cat[1].jpg")).toBe("http://a.test/my%20cat%5B1%5D.jpg");
      expect(encodeImageUrl("http://a.test/1%5B1%5D.jpg")).toBe("http://a.test/1%5B1%5D.jpg");
    });

    it("두 번 적용해도 결과가 같다(멱등)", () => {
      const once = encodeImageUrl("http://a.test/x%20y[1][2].jpg?v=[3]");
      expect(encodeImageUrl(once)).toBe(once);
      expect(once).toBe("http://a.test/x%20y%5B1%5D%5B2%5D.jpg?v=%5B3%5D");
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

  it("필수 필드만 있는 item도 유효한 WireDto가 된다", () => {
    const { desertionNo, processState, upKindNm, noticeEdt, orgNm } = PROTECTED_CAT;
    const result = map({ desertionNo, processState, upKindNm, noticeEdt, orgNm });
    expect(AnimalWireDtoSchema.strict().parse(result.wire)).toEqual({
      id: desertionNo,
      species: "cat",
      images: [],
      status: "protected",
      noticeEndDate: "2026-10-01",
      sex: "unknown",
      ageText: null,
      regionText: "제주특별자치도",
      shelterName: null,
      foundPlaceText: null,
      noticePeriodText: null,
    });
    expect(result.sortKeys).toEqual({ noticeSdt: "", noticeEdt: "20261001", updTm: "" });
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
