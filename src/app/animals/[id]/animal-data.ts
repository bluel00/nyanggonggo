import { cache } from "react";
import { toAnimal, type Animal } from "@/entities/animal";
import { getAnimalService } from "@/server/animals/container";

/**
 * 상세 공고 조회(서버). React cache로 감싸 한 요청 안에서 generateMetadata와 페이지가 같은 결과를 쓴다(조회 1회).
 * 캐시 범위는 서버 요청 하나다. OG 이미지 라우트는 별도 요청이라 이 캐시를 공유하지 않는다(upstream fetch 캐시만 공유).
 */
export const getAnimalForRequest = cache(async (id: string): Promise<Animal> => toAnimal(await getAnimalService().getById(id)));
