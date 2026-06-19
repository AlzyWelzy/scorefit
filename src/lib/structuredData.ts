// Shared schema.org (JSON-LD) builders. One place to keep our structured data correct
// and consistent; pages render the output via a <script type="application/ld+json">.
// Helpers return plain objects — the caller stringifies.

export const SITE_URL = "https://scorefit.net";
const SITE_NAME = "ScoreFit";

const ctx = "https://schema.org";

/** Organization + WebSite nodes for the root layout. WebSite carries a SearchAction so
 *  search engines can offer a sitelinks search box, plus the org logo. */
export function siteGraph() {
  return [
    {
      "@context": ctx,
      "@type": "Organization",
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/icon.svg`,
    },
    {
      "@context": ctx,
      "@type": "WebSite",
      name: SITE_NAME,
      url: SITE_URL,
      potentialAction: {
        "@type": "SearchAction",
        target: { "@type": "EntryPoint", urlTemplate: `${SITE_URL}/exercises?q={search_term_string}` },
        "query-input": "required name=search_term_string",
      },
    },
  ];
}

/** BreadcrumbList for nested pages. Pass ordered { name, path } crumbs (path is absolute
 *  on the site, e.g. "/exercises"). */
export function breadcrumbs(items: { name: string; path: string }[]) {
  return {
    "@context": ctx,
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: `${SITE_URL}${it.path}`,
    })),
  };
}

/** A VideoObject for an exercise demo. uploadDate is required by Google for video rich
 *  results; we pass a stable provenance date since the demo set is curated, not dated. */
export function videoObject(args: {
  name: string;
  description: string;
  thumbnailUrl: string;
  contentUrl: string;
  embedUrl: string;
  uploadDate: string; // ISO date
}) {
  return {
    "@context": ctx,
    "@type": "VideoObject",
    name: args.name,
    description: args.description,
    thumbnailUrl: args.thumbnailUrl,
    contentUrl: args.contentUrl,
    embedUrl: args.embedUrl,
    uploadDate: args.uploadDate,
  };
}

/** A HowTo describing how to perform an exercise, from its coaching cues. */
export function exerciseHowTo(args: { name: string; steps: string[] }) {
  return {
    "@context": ctx,
    "@type": "HowTo",
    name: `How to perform the ${args.name}`,
    step: args.steps.map((text, i) => ({
      "@type": "HowToStep",
      position: i + 1,
      text,
    })),
  };
}

/** TechArticle for a guidebook section. */
export function techArticle(args: { headline: string; description: string; path: string }) {
  return {
    "@context": ctx,
    "@type": "TechArticle",
    headline: args.headline,
    description: args.description,
    url: `${SITE_URL}${args.path}`,
    publisher: { "@type": "Organization", name: SITE_NAME, url: SITE_URL },
  };
}

/** Render-ready: serialize one node or an array of nodes for a single <script> tag. */
export function ldJson(data: object | object[]): string {
  return JSON.stringify(data);
}
