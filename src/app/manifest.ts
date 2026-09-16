import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Our Home",
    short_name: "Our Home",
    description: "จัดการเงินและงานบ้านของครอบครัวในที่เดียว",
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: "#718d7a",
    icons: [
      {
        src: "/icons/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/icons/icon-maskable.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "maskable",
      },
    ],
  };
}
