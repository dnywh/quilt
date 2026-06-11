import { getCollection, type CollectionEntry } from "astro:content";

export type ListItemKind = "note" | "trove" | "ephemera" | "photo" | "soundscape";

export type DatedListItem =
  | { kind: "note"; date: Date; id: string; entry: CollectionEntry<"notes"> }
  | { kind: "trove"; date: Date; id: string; entry: CollectionEntry<"trove"> }
  | { kind: "ephemera"; date: Date; id: string; entry: CollectionEntry<"ephemera"> }
  | { kind: "photo"; date: Date; id: string; entry: CollectionEntry<"photos"> }
  | { kind: "soundscape"; date: Date; id: string; entry: CollectionEntry<"soundscapes"> };

export const LIST_FILTERS: { kind: ListItemKind; label: string; id: string }[] = [
  { kind: "note", label: "Notes", id: "filter-note" },
  { kind: "trove", label: "Trove", id: "filter-trove" },
  { kind: "ephemera", label: "Ephemera", id: "filter-ephemera" },
  { kind: "photo", label: "Photos", id: "filter-photo" },
  { kind: "soundscape", label: "Soundscapes", id: "filter-soundscape" },
];

export function sortListItems(items: DatedListItem[]): DatedListItem[] {
  return [...items].sort((a, b) => b.date.getTime() - a.date.getTime());
}

export async function getDatedListItems(): Promise<DatedListItem[]> {
  const [notes, trove, ephemera, photos, soundscapes] = await Promise.all([
    getCollection("notes"),
    getCollection("trove"),
    getCollection("ephemera"),
    getCollection("photos"),
    getCollection("soundscapes"),
  ]);

  const items: DatedListItem[] = [
    ...notes.map(
      (entry): DatedListItem => ({
        kind: "note",
        date: entry.data.date,
        id: entry.id,
        entry,
      })
    ),
    ...trove.map(
      (entry): DatedListItem => ({
        kind: "trove",
        date: entry.data.date,
        id: entry.id,
        entry,
      })
    ),
    ...ephemera.map(
      (entry): DatedListItem => ({
        kind: "ephemera",
        date: entry.data.date,
        id: entry.id,
        entry,
      })
    ),
    ...photos.map(
      (entry): DatedListItem => ({
        kind: "photo",
        date: entry.data.date,
        id: entry.id,
        entry,
      })
    ),
    ...soundscapes.map(
      (entry): DatedListItem => ({
        kind: "soundscape",
        date: entry.data.date,
        id: entry.id,
        entry,
      })
    ),
  ];

  return sortListItems(items);
}

export const LIST_PAGE_SIZE = 30;

export function paginateListItems(
  items: DatedListItem[],
  page: number,
  pageSize = LIST_PAGE_SIZE
): { items: DatedListItem[]; totalPages: number } {
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(Math.max(page, 1), totalPages);
  const start = (safePage - 1) * pageSize;
  return {
    items: items.slice(start, start + pageSize),
    totalPages,
  };
}

export function getNotePreview(
  entry: CollectionEntry<"notes">,
  maxLength = 160
): string {
  const description = entry.data.description?.trim();
  if (description && description !== "TODO") {
    return description;
  }

  const body = entry.body;
  if (!body) return "";

  const plain = body
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/(\*\*|__|\*|_|`|~~)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/\s+/g, " ")
    .trim();

  if (!plain) return "";
  if (plain.length <= maxLength) return plain;

  const truncated = plain.slice(0, maxLength);
  const lastSpace = truncated.lastIndexOf(" ");
  return `${(lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated).trim()}…`;
}

export function getListPageUrl(page: number): string {
  return page <= 1 ? "/list/" : `/list/${page}/`;
}

export function formatListDate(date: Date): string {
  return date.toLocaleDateString("en-AU", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}
