"use client";

import { Info, MapPin, Phone, type LucideIcon } from "lucide-react";
import { DETAIL_ROW_ACTION_COPY, type Animal } from "@/entities/animal";
import { cn } from "@/shared/lib/utils";
import { Sheet, SheetClose, SheetContent, SheetTitle, SheetTrigger } from "@/shared/ui/sheet";
import { SHELTER_CONTACT_LINK_COPY, shelterContactRows, type ShelterContactAction } from "../model/shelter-contact";

/**
 * 줄 끝 작은 글자 버튼·링크 모양(이슈 #3): 채운 버튼이 아니라 보조 글자색 + 작은 아이콘이다. 누르는 영역은 44×44px이고,
 * 위아래 음수 여백으로 줄 높이(20px)는 그대로 둔다. 상세 보호소 줄의 [보호소 정보]와 시트의 [지도]·[전화]가 같은 모양이다.
 */
const SMALL_ACTION =
  "-my-3 inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center gap-0.5 rounded-sm text-caption text-text-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring";

const LINK_ICON: Record<ShelterContactAction, { icon: LucideIcon; newTab: boolean }> = {
  map: { icon: MapPin, newTab: true },
  call: { icon: Phone, newTab: false },
};

/** 값 줄바꿈: 띄어쓰기에서만 줄을 바꾸고, 띄어쓰기 없는 긴 값은 넘치지 않게 끊는다(이슈 #11, 상세 정보 줄과 같다) */
const VALUE_WRAP = "break-keep wrap-anywhere";

/**
 * 보호소 정보 시트(용어 사전 "보호소 정보 시트", 이슈 #62). 상세 보호소 줄 끝의 [보호소 정보] 버튼과 그 버튼이 여는 아래 시트다.
 * 버튼을 둘지는 상세 정보 줄 규칙(detailRows의 동작 "shelterInfo")이 정한다: 종료 공고이거나 주소·전화가 모두 없으면 없다.
 *
 * 시트는 기존 Sheet(Radix 모달 Dialog, 480 컬럼에 portal)다: 배경 탭·핸들 탭·Esc로 닫히고 방문 기록에 넣지 않는다. 상세 위젯 안에서
 * 그려지므로 상세가 닫히면(뒤로 가기, 쓸어넘기기) 함께 빠진다. 상세 층(StackLayer)의 Esc는 층 밖 대화상자가 있으면 비켜 시트만 닫힌다.
 * 아래로 끌어 닫기는 시트 계약에 없다(architecture.md 12절 25).
 */
export function ShelterInfoSheet({ animal }: { animal: Animal }) {
  const rows = shelterContactRows(animal);
  const { text, label } = DETAIL_ROW_ACTION_COPY.shelterInfo;
  return (
    <Sheet>
      <SheetTrigger asChild>
        <button type="button" aria-label={label} data-slot="shelter-info-button" className={SMALL_ACTION}>
          <Info aria-hidden className="size-3.5" />
          {text}
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" showCloseButton={false} aria-describedby={undefined} data-slot="shelter-info-sheet">
        {/* 머리(핸들·제목) / 내용. 아래 고정 영역은 두지 않는다 */}
        <div className="shrink-0 px-4">
          <SheetClose asChild>
            <button type="button" aria-label="닫기" className="block w-full cursor-grab">
              <span aria-hidden className="mx-auto mt-2 mb-3 block h-1 w-9 rounded-[2px] bg-border" />
            </button>
          </SheetClose>
          <SheetTitle className="mb-4 text-card-title">{animal.shelterName}</SheetTitle>
        </div>
        <dl
          data-slot="sheet-body"
          className="grid min-h-0 grid-cols-[auto_1fr] gap-x-4 gap-y-3 overflow-y-auto overscroll-contain px-4 pb-[calc(var(--space-6)+env(safe-area-inset-bottom,0px))] text-body"
        >
          {rows.map((row) => (
            <div key={row.label} data-slot="shelter-contact-row" className="contents">
              {/* 링크가 있는 줄은 위아래 6px를 더해, 이웃한 두 링크(44px)의 누르는 영역이 겹치지 않게 한다 */}
              <dt className={cn("text-text-2", row.link && "py-1.5")}>{row.label}</dt>
              <dd className={cn("flex items-start gap-2", row.link && "py-1.5")}>
                {/* 값은 그냥 글자(선택·복사 가능)이고, 길면 줄바꿈한다. 링크는 첫 줄 끝 */}
                <span data-slot="shelter-contact-value" className={cn("min-w-0 flex-1", VALUE_WRAP)}>
                  {row.value}
                </span>
                {row.link && <ContactLink action={row.link.action} href={row.link.href} />}
              </dd>
            </div>
          ))}
        </dl>
      </SheetContent>
    </Sheet>
  );
}

function ContactLink({ action, href }: { action: ShelterContactAction; href: string }) {
  const { icon: Icon, newTab } = LINK_ICON[action];
  const { text, label } = SHELTER_CONTACT_LINK_COPY[action];
  return (
    <a href={href} aria-label={label} data-slot="contact-link" {...(newTab ? { target: "_blank", rel: "noopener" } : {})} className={SMALL_ACTION}>
      <Icon aria-hidden className="size-3.5" />
      {text}
    </a>
  );
}
