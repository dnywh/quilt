import rss from "@astrojs/rss";
import { getCollection } from "astro:content";
import {
  absoluteUrl,
  getEphemeraDescription,
  getNoteDescription,
  getPhotoDescription,
  getSoundscapeDescription,
  getTroveDescription,
  renderEphemeraContent,
  renderNoteContent,
  renderPhotoContent,
  renderSoundscapeContent,
  renderTroveContent,
} from "../lib/rss";

export async function GET(context) {
  const site = context.site;
  const [notes, trove, ephemera, photos, soundscapes] = await Promise.all([
    getCollection("notes"),
    getCollection("trove"),
    getCollection("ephemera"),
    getCollection("photos"),
    getCollection("soundscapes"),
  ]);

  const noteItems = await Promise.all(
    notes.map(async (note) => ({
      title: note.data.title,
      description: getNoteDescription(note),
      pubDate: note.data.date,
      link: absoluteUrl(`/notes/${note.id}`, site),
      content: await renderNoteContent(note, site),
      categories: ["Note", ...(note.data.tags ?? [])],
    }))
  );

  const troveItems = trove.map((entry) => ({
    title: `Trove: ${entry.data.title}`,
    description: getTroveDescription(entry),
    pubDate: entry.data.date,
    link: entry.data.url,
    content: renderTroveContent(entry, site),
    categories: ["Trove", ...(entry.data.tags ?? [])],
  }));

  const ephemeraItems = ephemera.map((entry) => ({
    title: entry.data.name,
    description: getEphemeraDescription(entry),
    pubDate: entry.data.date,
    link: absoluteUrl(`/ephemera/${entry.id}`, site),
    content: renderEphemeraContent(entry, site),
    categories: ["Ephemera", ...entry.data.tags],
  }));

  const photoItems = photos.map((entry) => ({
    title: entry.data.title,
    description: getPhotoDescription(entry),
    pubDate: entry.data.date,
    link: absoluteUrl(`/photos/`, site),
    content: renderPhotoContent(entry, site),
    categories: ["Photo", ...(entry.data.tags ?? [])],
  }));

  const soundscapeItems = soundscapes.map((entry) => ({
    title: entry.data.title,
    description: getSoundscapeDescription(entry),
    pubDate: entry.data.date,
    link: absoluteUrl(`/`, site),
    content: renderSoundscapeContent(entry),
    categories: ["Soundscape", ...(entry.data.tags ?? [])],
  }));

  const allItems = [
    ...noteItems,
    ...troveItems,
    ...ephemeraItems,
    ...photoItems,
    ...soundscapeItems,
  ].sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime()
  );

  return rss({
    title: "Danny White",
    description:
      "The internet home of Danny White, a freelance product designer based in Australia.",
    site,
    items: allItems,
    customData: `<language>en-au</language>`,
    // stylesheet: "/feed-stylesheet.xsl",
  });
}
