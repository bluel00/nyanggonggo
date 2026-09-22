"use client";

import { SlidersHorizontal } from "lucide-react";
import { useState, type ReactNode } from "react";
import { SPECIES_LABEL, type AnimalListFilter } from "@/entities/animal";
import { DISTRICTS, SIDO } from "@/shared/config/regions";
import { Button } from "@/shared/ui/button";
import { Chip } from "@/shared/ui/chip";
import { NativeSelect } from "@/shared/ui/native-select";
import { RadioOption } from "@/shared/ui/radio-option";
import { Segmented } from "@/shared/ui/segmented";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";
import { REGION_ALL } from "../model/filter";
import { useApplyAnimalFilter } from "../model/use-apply-animal-filter";

const SPECIES_OPTIONS = [
  { value: "cat", label: SPECIES_LABEL.cat },
  { value: "dog", label: SPECIES_LABEL.dog },
] as const;

const SIDO_OPTIONS = [{ value: REGION_ALL, label: "전체 시/도" }, ...SIDO.map((s) => ({ value: s.code, label: s.name }))];
const DISTRICT_ALL = "";

function districtOptions(region: string | undefined) {
  const districts = region ? (DISTRICTS[region] ?? []) : [];
  return [{ value: DISTRICT_ALL, label: "전체 시/군/구" }, ...districts.map((d) => ({ value: d.code, label: d.name }))];
}

const STATUS_OPTIONS = [
  { value: "protected", label: "보호중" },
  { value: "ended", label: "종료" },
  { value: "all", label: "전체" },
] as const;

const SORT_OPTIONS = [
  { value: "latest", label: "최신순" },
  { value: "endingSoon", label: "종료임박순" },
] as const;

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
        <Chip>
          <SlidersHorizontal aria-hidden className="size-4" strokeWidth={1.8} />
          필터
        </Chip>
      </SheetTrigger>
      <SheetContent
        side="bottom"
        showCloseButton={false}
        aria-describedby={undefined}
        className="overflow-y-auto px-4 pb-[calc(var(--space-4)+env(safe-area-inset-bottom,0px))]"
      >
        <SheetClose asChild>
          <button type="button" aria-label="닫기" className="block w-full cursor-grab">
            <span aria-hidden className="mx-auto mt-2 mb-3 block h-1 w-9 rounded-[2px] bg-border" />
          </button>
        </SheetClose>
        <SheetTitle className="mb-4 text-card-title">필터</SheetTitle>

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
          <div className="flex flex-wrap gap-2">
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

        <Button variant="primary" size="touch" className="w-full" onClick={handleApply}>
          적용하기
        </Button>
      </SheetContent>
    </Sheet>
  );
}
