import rss, { pagesGlobToRssItems } from "@astrojs/rss";
import { getCollection } from "astro:content";
import { getEphemeraImagePath } from "../lib/ephemera";
import { R2_BASE_URL } from "../lib/config";

export async function GET(context) {
  // TODO: render some or all of the MDX content, see bottom of:
  // https://blog.damato.design/posts/astro-rss-mdx/
  const ephemera = await getCollection("ephemera");
  const ephemeraItems = ephemera.map((item) => {
    const firstImage = item.data.images[0];
    const imagePath = getEphemeraImagePath(firstImage, item.data.hasTransparency);
    const imageUrl = `${R2_BASE_URL}/cdn-cgi/image/width=600,fit=scale-down,quality=80,format=auto/${imagePath}`;
    return {
      title: item.data.name,
      pubDate: item.data.date,
      link: `${context.site}ephemera/${item.id}`,
      content: `<img src="${imageUrl}" alt="${item.data.name}" />`,
    };
  });
  const notes = await getCollection("notes");
  const notesItems = notes.map((note) => ({
    title: note.data.title,
    description: note.data.description,
    pubDate: note.data.date,
    link: `${context.site}notes/${note.id}`,
  }));
  // Sort by date descending (newest first)
  const allItems = [...notesItems, ...ephemeraItems].sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  );
  return rss({
    title: "Danny White",
    description:
      "The internet home of Danny White, a freelance product designer based in Australia.",
    site: context.site,
    // items: await pagesGlobToRssItems(import.meta.glob("./notes/**/*.mdx")),
    items: allItems,
    language: "en-au",
    // customData: `<language>en-us</language>`,
    // stylesheet: "/feed-stylesheet.xsl",
  });
}
