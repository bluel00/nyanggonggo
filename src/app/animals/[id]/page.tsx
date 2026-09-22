import { notFound } from "next/navigation";
import { AnimalDetailView } from "@/views/animal-detail";

/** 공고 id는 숫자 문자열(desertionNo). 형식이 다르면 조회하지 않고 404 */
const ID_PATTERN = /^\d{1,32}$/;

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!ID_PATTERN.test(id)) notFound();
  return <AnimalDetailView id={id} />;
}
