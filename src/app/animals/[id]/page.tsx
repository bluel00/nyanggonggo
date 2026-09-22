import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { toAnimal } from "@/entities/animal";
import { getAnimalService } from "@/server/animals/container";
import { SERVICE_NAME } from "@/shared/config/service";
import { AnimalDetailView } from "@/views/animal-detail";
import { buildOgModel, buildOgText } from "./og-model";

/** 공고 id는 숫자 문자열(desertionNo). 형식이 다르면 조회하지 않고 404 */
const ID_PATTERN = /^\d{1,32}$/;

/**
 * 링크 미리보기용 제목/설명(og 이미지는 같은 폴더의 opengraph-image.tsx가 붙인다).
 * 서버 캐시를 거쳐 조회하고, 실패하면 기본 메타데이터를 쓴다(화면은 클라이언트가 따로 조회한다).
 */
export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) return {};
  try {
    const text = buildOgText(buildOgModel(toAnimal(await getAnimalService().getById(id)), new Date()), SERVICE_NAME);
    return { title: text.title, description: text.description, openGraph: { title: text.title, description: text.description } };
  } catch {
    return {};
  }
}

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) notFound();
  return <AnimalDetailView id={id} />;
}
