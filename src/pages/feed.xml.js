import rss, { pagesGlobToRssItems } from "@astrojs/rss";
import { getCollection } from "astro:content";

export async function GET(context) {
  // TODO: render some or all of the MDX content, see bottom of:
  // https://blog.damato.design/posts/astro-rss-mdx/
  // const ephemera = await getCollection("ephemera");
  // const ephemeraItems = ephemera.map((item) => ({
  //   title: item.data.name,
  //   description: item.data.description,
  //   pubDate: item.data.date,
  //   link: `${context.site.url}/ephemera/${item.id}`,
  // }));
  const notes = await getCollection("notes");
  const notesItems = notes.map((note) => ({
    title: note.data.title,
    description: note.data.description,
    pubDate: note.data.date,
    link: `${context.site.url}/notes/${note.id}`,
  }));
  return rss({
    title: "Danny White",
    description:
      "The internet home of Danny White, a freelance product designer based in Australia.",
    site: context.site,
    // items: await pagesGlobToRssItems(import.meta.glob("./notes/**/*.mdx")),
    // items: [...notesItems, ...ephemeraItems],
    items: notesItems,
    language: "en-au",
    // customData: `<language>en-us</language>`,
    // stylesheet: "/feed-stylesheet.xsl",
  });
}
