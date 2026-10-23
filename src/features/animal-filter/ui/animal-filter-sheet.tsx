"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";
import {
  ANIMAL_LIST_SEXES,
  ANIMAL_LIST_SORTS,
  ANIMAL_LIST_STATUSES,
  ANIMAL_SPECIES,
  type AnimalListSex,
  type AnimalListSort,
  type AnimalListStatus,
} from "@/contract/animals";
import { SEX_LABEL, SPECIES_LABEL, type AnimalListFilter } from "@/entities/animal";
import { DISTRICTS, SIDO } from "@/shared/config/regions";
import { Button } from "@/shared/ui/button";
import { Chip } from "@/shared/ui/chip";
import { NativeSelect } from "@/shared/ui/native-select";
import { RadioOption } from "@/shared/ui/radio-option";
import { Segmented } from "@/shared/ui/segmented";
import { Sheet, SheetClose, SheetContent, SheetFooter, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";
import { REGION_ALL } from "../model/filter";
import { useApplyAnimalFilter } from "../model/use-apply-animal-filter";

/**
 * 선택지. 값과 순서는 계약의 값 목록(이슈 #28)이고, 라벨은 값마다 `Record`라 계약에 값을 더하면 라벨이 없을 때 타입 오류가 난다.
 */
function options<T extends string>(values: readonly T[], labels: Record<T, string>) {
  return values.map((value) => ({ value, label: labels[value] }));
}

const SPECIES_OPTIONS = options(ANIMAL_SPECIES, SPECIES_LABEL);

const SIDO_OPTIONS = [{ value: REGION_ALL, label: "전체 시/도" }, ...SIDO.map((s) => ({ value: s.code, label: s.name }))];
const DISTRICT_ALL = "";

function districtOptions(region: string | undefined) {
  const districts = region ? (DISTRICTS[region] ?? []) : [];
  return [{ value: DISTRICT_ALL, label: "전체 시/군/구" }, ...districts.map((d) => ({ value: d.code, label: d.name }))];
}

const STATUS_OPTIONS = options<AnimalListStatus>(ANIMAL_LIST_STATUSES, { protected: "보호중", ended: "종료", all: "전체" });

/** 성별(이슈 #20). 성별 미상은 전체에서만 보인다. 보호 상태와 같은 칩 묶음 */
const SEX_OPTIONS = options<AnimalListSex>(ANIMAL_LIST_SEXES, { all: "전체", female: SEX_LABEL.female, male: SEX_LABEL.male });

const SORT_OPTIONS = options<AnimalListSort>(ANIMAL_LIST_SORTS, { latest: "최신순", endingSoon: "종료임박순" });

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="mb-6">
      <h3 className="mb-2 text-body text-text-2">{label}</h3>
      {children}
    </section>
  );
}

/**
 * 필터 트리거(Chip 모양 + 필터 아이콘)와 바텀시트(명세 4.2).
 *
 * 현재 값은 URL에서 파싱한 filter(prop)가 단일 진실 소스다. 로컬 state는 시트 열림과 "적용 전 임시 선택값(draft)"뿐이다.
 * 시트를 열 때 draft를 현재 값으로 채우고, [적용하기]에서만 URL에 반영한다. 닫으면(배경 탭, 핸들, Esc) draft는 버린다.
 * 스와이프 다운 닫기는 아직 없다(Radix Dialog에 없음, 12절).
 */
export function AnimalFilterSheet({ filter }: { filter: AnimalListFilter }) {
  const applyFilter = useApplyAnimalFilter();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<AnimalListFilter>(filter);

  const update = (patch: Partial<AnimalListFilter>) => setDraft((current) => ({ ...current, ...patch }));

  function handleOpenChange(next: boolean) {
    if (next) setDraft(filter);
    setOpen(next);
  }

  function handleApply() {
    applyFilter(draft);
    setOpen(false);
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger asChild>
        {/* 필터 버튼: 흰 바탕 + shadow-control(README, 칩보다 진한 그림자). 성별을 골랐으면 칩의 선택 모양으로 보이고
            이름에 성별을 붙인다(이슈 #20, 목록 위 필터 요약이 따로 없다). 토글이 아니라 aria-pressed는 뺀다 */}
        <Chip
          className="shadow-control"
          selected={filter.sex !== "all"}
          aria-pressed={undefined}
          aria-label={filter.sex === "all" ? undefined : `필터, ${SEX_LABEL[filter.sex]}`}
        >
          <SlidersHorizontal aria-hidden className="size-4" strokeWidth={1.8} />
          필터
        </Chip>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        aria-describedby={undefined}
        className="overflow-hidden"
      >
        {/* 머리(핸들·제목) / 스크롤되는 내용 / 고정된 아래 영역(적용하기). 내용만 스크롤된다(이슈 #23) */}
        <div className="shrink-0 px-4">
          <SheetClose asChild>
            <button type="button" aria-label="닫기" className="block w-full cursor-grab">
              <span aria-hidden className="mx-auto mt-2 mb-3 block h-1 w-9 rounded-[2px] bg-border" />
            </button>
          </SheetClose>
          <SheetTitle className="mb-4 text-card-title">필터</SheetTitle>
        </div>

        <div data-slot="sheet-body" className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4">
          <Section label="축종">
            <Segmented
              label="축종"
              options={SPECIES_OPTIONS}
              value={draft.species}
              onChange={(species) => update({ species })}
            />
          </Section>

          <Section label="지역">
            {/* 2단계: 시도를 바꾸면 시군구는 "전체"로 돌아간다. 전국이거나 시군구가 없는 시도(세종)면 시군구는 비활성 */}
            <div className="flex flex-col gap-2">
              <NativeSelect
                label="시/도"
                options={SIDO_OPTIONS}
                value={draft.region ?? REGION_ALL}
                onChange={(value) => update({ region: value === REGION_ALL ? undefined : value, district: undefined })}
              />
              <NativeSelect
                label="시/군/구"
                options={districtOptions(draft.region)}
                value={draft.district ?? DISTRICT_ALL}
                disabled={!draft.region || (DISTRICTS[draft.region]?.length ?? 0) === 0}
                onChange={(value) => update({ district: value === DISTRICT_ALL ? undefined : value })}
              />
            </div>
          </Section>

          <Section label="보호 상태">
            {/* 칩 묶음마다 이름을 붙인다: 보호 상태와 성별에 같은 "전체"가 있어 화면 읽기에서 구분되게 */}
            <div role="group" aria-label="보호 상태" className="flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((option) => (
                <Chip
                  key={option.value}
                  selected={draft.status === option.value}
                  onClick={() => update({ status: option.value })}
                >
                  {option.label}
                </Chip>
              ))}
            </div>
          </Section>

          <Section label="성별">
            <div role="group" aria-label="성별" className="flex flex-wrap gap-2">
              {SEX_OPTIONS.map((option) => (
                <Chip key={option.value} selected={draft.sex === option.value} onClick={() => update({ sex: option.value })}>
                  {option.label}
                </Chip>
              ))}
            </div>
          </Section>

          <Section label="정렬">
            <div role="radiogroup" aria-label="정렬">
              {SORT_OPTIONS.map((option) => (
                <RadioOption
                  key={option.value}
                  checked={draft.sort === option.value}
                  onSelect={() => update({ sort: option.value })}
                >
                  {option.label}
                </RadioOption>
              ))}
            </div>
          </Section>
        </div>

        {/* 아래 영역: 시트와 같은 바탕, 위쪽 그림자는 상세 하단 CTA 바와 같은 shadow-bar. 아래 안전 영역도 CTA 바와 같은 방식 */}
        <SheetFooter className="shrink-0 bg-popover px-4 pt-3 pb-[calc(var(--space-4)+env(safe-area-inset-bottom,0px))] shadow-bar">
          <Button variant="apply" size="touch" className="w-full" onClick={handleApply}>
            적용하기
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
