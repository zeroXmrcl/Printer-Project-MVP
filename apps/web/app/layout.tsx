import { IBM_Plex_Mono, IBM_Plex_Sans } from "next/font/google";
import { headers } from "next/headers";
import type { Metadata } from "next";
import type { ReactNode } from "react";
import { buildShareCardCopy, fallbackShareCardCopy, shareCardMetadataOrigin } from "../lib/share-card";
import { currentLive, settings } from "../lib/store";
import "./globals.css";

const sans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500"] });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export async function generateMetadata(): Promise<Metadata> {
  const headerList = await headers();
  const origin = shareCardMetadataOrigin(headerList);
  let metadataBase: URL | undefined;
  try {
    metadataBase = new URL(origin);
  } catch {
    metadataBase = undefined;
  }
  const copy = loadCopy(origin);
  return {
    title: copy.title,
    description: copy.description,
    ...(metadataBase ? { metadataBase } : {}),
    openGraph: {
      title: copy.title,
      description: copy.description,
      siteName: "PrintCast",
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: copy.title,
      description: copy.description,
    },
  };
}

function loadCopy(origin: string) {
  try {
    const live = currentLive();
    const display = settings();
    return buildShareCardCopy({
      title: display.title,
      file: live.filename,
      percent: live.showBar ? live.percent : null,
      nozzleC: live.temps.nozzle.actual,
      bedC: live.temps.bed.actual,
      host: origin.replace(/^https?:\/\//, ""),
    });
  } catch {
    return fallbackShareCardCopy("");
  }
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className={`${sans.className} ${mono.variable}`}>{children}</body>
    </html>
  );
}
