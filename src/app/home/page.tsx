import type { Metadata } from "next";
import { cookies } from "next/headers";
import { ANIMAL_COPY } from "@/entities/animal";
import { REGION_COOKIE, resolveHomeArea, type SearchParamsInput } from "@/features/animal-filter";
import { SERVICE_NAME } from "@/shared/config/service";
import { SpeciesPickerView } from "@/views/species-picker";

export const metadata: Metadata = { title: `${ANIMAL_COPY.homeMetaTitle} | ${SERVICE_NAME}` };

/**
 * 홈(축종 선택) 화면. `/`로 들어온 사람 중 축종 기억이 없는 사람이 여기로 온다(`app/page.tsx`).
 *
 * **축종 기억이 있어도 건너뛰지 않는다**(결정 G1): 축종을 바꾸러 목록 헤더에서 직접 오는 화면이기도 하다.
 * 건너뛰기는 `/` 진입에만 적용한다.
 * 지역은 목록에서 넘겨받은 값(없으면 기억된 지역, 그것도 없으면 서울 전체)을 쓰고, 여기서 기억하지는 않는다(결정 G2).
 */
export default async function Page({ searchParams }: { searchParams: Promise<SearchParamsInput> }) {
  const [params, cookieStore] = await Promise.all([searchParams, cookies()]);
  return <SpeciesPickerView area={resolveHomeArea(params, cookieStore.get(REGION_COOKIE)?.value)} />;
}
