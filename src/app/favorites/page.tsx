import type { Metadata } from "next";
import { SERVICE_NAME } from "@/shared/config/service";
import { FavoritesView } from "@/views/favorites";

export const metadata: Metadata = { title: `찜한 고양이 | ${SERVICE_NAME}` };

export default function Page() {
  return <FavoritesView />;
}
