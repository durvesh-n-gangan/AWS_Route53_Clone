import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ComingSoon } from "@/components/layout/ComingSoon";
import { PLACEHOLDER_PAGES } from "@/lib/navigation";

// Only the sections listed in PLACEHOLDER_PAGES exist; anything else is a 404.
export const dynamicParams = false;

export function generateStaticParams() {
  return Object.keys(PLACEHOLDER_PAGES).map((key) => ({ section: key.split("/") }));
}

async function findPage(params: PageProps<"/route53/v2/[...section]">["params"]) {
  const { section } = await params;
  return PLACEHOLDER_PAGES[section.join("/")];
}

export async function generateMetadata({
  params,
}: PageProps<"/route53/v2/[...section]">): Promise<Metadata> {
  const page = await findPage(params);
  return { title: page?.title ?? "Page not found" };
}

export default async function PlaceholderSectionPage({
  params,
}: PageProps<"/route53/v2/[...section]">) {
  const page = await findPage(params);
  if (!page) notFound();
  return <ComingSoon title={page.title} description={page.description} />;
}
