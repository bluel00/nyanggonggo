import type { Metadata } from "next";
import { ANIMAL_COPY } from "@/entities/animal";
import { SERVICE_NAME } from "@/shared/config/service";
import { FavoritesView } from "@/views/favorites";
import { FAVORITES_PATH, siteMetadata } from "../site-metadata";

export const metadata: Metadata = { title: `${ANIMAL_COPY.favoritesTitle} | ${SERVICE_NAME}`, ...siteMetadata(FAVORITES_PATH) };

export default function Page() {
  return <FavoritesView />;
}
