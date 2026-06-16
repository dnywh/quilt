import type { CollectionEntry } from "astro:content";
import { getEntry } from "astro:content";
import { R2_BASE_URL } from "./config";
import { getEphemeraImagePath } from "./ephemera";

type NoteEntry = CollectionEntry<"notes">;
type TroveEntry = CollectionEntry<"trove">;
type EphemeraEntry = CollectionEntry<"ephemera">;
type PhotoEntry = CollectionEntry<"photos">;
type SoundscapeEntry = CollectionEntry<"soundscapes">;

export function absoluteUrl(path: string, site: URL): string {
  return new URL(path, site).toString();
}

export function transformedR2ImageUrl(
  path: string,
  {
    width = 800,
    fit = "scale-down",
    quality = 80,
    format = "auto",
  }: {
    width?: number;
    fit?: string;
    quality?: number;
    format?: string;
  } = {}
): string {
  return `${R2_BASE_URL}/cdn-cgi/image/width=${width},fit=${fit},quality=${quality},format=${format}/${path}`;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normaliseWhitespace(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function firstTextParagraph(markdown: string): string {
  const stripped = markdown
    .replace(/import\s+[\s\S]*?from\s+["'][^"']+["'];?/g, "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/^#{1,6}\s+/gm, "")
    .replace(/^>\s?/gm, "")
    .replace(/(\*\*|__|\*|_|`|~~)/g, "")
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1");

  return normaliseWhitespace(stripped).slice(0, 280);
}

function renderInlineMarkdown(value: string): string {
  const placeholders: string[] = [];
  const stash = (html: string) => {
    const token = `RSSPLACEHOLDER${placeholders.length}END`;
    placeholders.push(html);
    return token;
  };

  let text = escapeHtml(value);

  text = text.replace(/`([^`]+)`/g, (_, code: string) =>
    stash(`<code>${code}</code>`)
  );
  text = text.replace(
    /!\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    (_, alt: string, href: string) =>
      stash(`<img src="${escapeHtml(href)}" alt="${escapeHtml(alt)}" />`)
  );
  text = text.replace(
    /\[([^\]]+)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g,
    (_, label: string, href: string) =>
      stash(`<a href="${escapeHtml(href)}">${label}</a>`)
  );
  text = text
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/__([^_]+)__/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>")
    .replace(/_([^_]+)_/g, "<em>$1</em>");

  placeholders.forEach((html, index) => {
    text = text.replace(`RSSPLACEHOLDER${index}END`, html);
  });

  return text;
}

function getProp(source: string, name: string): string | undefined {
  const braced = source.match(new RegExp(`${name}=\\{([^}]+)\\}`));
  const quoted = source.match(new RegExp(`${name}=["']([^"']+)["']`));
  return normalisePropValue(braced?.[1] ?? quoted?.[1]);
}

function normalisePropValue(value: string | undefined): string | undefined {
  if (!value) return undefined;
  return value
    .trim()
    .replace(/^["']|["']$/g, "")
    .replace(/,$/, "")
    .trim();
}

function renderR2ImageTag(tag: string): string {
  const src = getProp(tag, "src");
  const alt = getProp(tag, "alt") ?? "";
  const width = Number(getProp(tag, "width")) || 800;
  const height = Number(getProp(tag, "height"));

  if (!src) return "";

  const attributes = [
    `src="${escapeHtml(transformedR2ImageUrl(src, { width: Math.min(width, 1200) }))}"`,
    `alt="${escapeHtml(alt)}"`,
    `width="${width}"`,
    Number.isFinite(height) && height > 0 ? `height="${height}"` : "",
  ]
    .filter(Boolean)
    .join(" ");

  return `<figure><img ${attributes} /></figure>`;
}

function renderLinkedAssetTag(tag: string, site: URL): string {
  const url = getProp(tag, "url");
  const title = getProp(tag, "title") ?? "Linked asset";
  const description = getProp(tag, "description");

  if (!url) return "";

  return `<p><a href="${absoluteUrl(url, site)}">${escapeHtml(title)}</a>${
    description ? `: ${escapeHtml(description)}` : ""
  }</p>`;
}

function renderMapViewerTag(tag: string, site: URL): string {
  const gpxUrl = getProp(tag, "gpxUrl");
  const gpxUrls = [...tag.matchAll(/["'](\/tracks\/[^"']+\.gpx)["']/g)].map(
    (match) => match[1]
  );
  const routes = gpxUrl ? [gpxUrl] : gpxUrls;

  if (routes.length === 0) {
    return `<p>Interactive route map available on the website.</p>`;
  }

  const links = routes
    .map(
      (route) =>
        `<a href="${absoluteUrl(route, site)}">${escapeHtml(route.replace("/tracks/", ""))}</a>`
    )
    .join(", ");

  return `<p>Interactive route map available on the website. GPX: ${links}</p>`;
}

async function renderSoundscapeTag(tag: string): Promise<string> {
  const id = getProp(tag, "id");
  if (!id) return `<p>Soundscape available on the website.</p>`;

  const entry = await getEntry("soundscapes", id);
  if (!entry) return `<p>Soundscape available on the website.</p>`;

  return renderSoundscapeContent(entry);
}

async function replaceAsync(
  source: string,
  regex: RegExp,
  replacement: (match: string) => Promise<string>
): Promise<string> {
  const matches = [...source.matchAll(regex)];
  const replacements = await Promise.all(matches.map((match) => replacement(match[0])));

  return matches.reduce((result, match, index) => {
    return result.replace(match[0], replacements[index]);
  }, source);
}

async function replaceMdxComponents(markdown: string, site: URL): Promise<string> {
  let result = markdown
    .replace(/import\s+[\s\S]*?from\s+["'][^"']+["'];?/g, "")
    .replace(
      /<MarkdownImageGallery([^>]*)>/g,
      (_, props: string) => {
        const description = getProp(props, "description");
        return `<figure>${description ? `<figcaption>${escapeHtml(description)}</figcaption>` : ""}`;
      }
    )
    .replace(/<\/MarkdownImageGallery>/g, "</figure>")
    .replace(/<R2Image\b[\s\S]*?\/>/g, (tag) => renderR2ImageTag(tag))
    .replace(/<LinkedAsset\b[\s\S]*?\/>/g, (tag) => renderLinkedAssetTag(tag, site))
    .replace(/<MapViewer\b[\s\S]*?\/>/g, (tag) => renderMapViewerTag(tag, site));

  result = await replaceAsync(result, /<SoundscapePlayer\b[\s\S]*?\/>/g, (tag) =>
    renderSoundscapeTag(tag)
  );

  return result;
}

function renderMarkdownBlocks(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const blocks: string[] = [];
  let paragraph: string[] = [];
  let list: string[] = [];
  let blockquote: string[] = [];
  let code: string[] | undefined;
  let codeLanguage = "";

  const flushParagraph = () => {
    if (paragraph.length === 0) return;
    blocks.push(`<p>${renderInlineMarkdown(paragraph.join(" "))}</p>`);
    paragraph = [];
  };

  const flushList = () => {
    if (list.length === 0) return;
    blocks.push(`<ul>${list.map((item) => `<li>${renderInlineMarkdown(item)}</li>`).join("")}</ul>`);
    list = [];
  };

  const flushBlockquote = () => {
    if (blockquote.length === 0) return;
    blocks.push(`<blockquote><p>${renderInlineMarkdown(blockquote.join(" "))}</p></blockquote>`);
    blockquote = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (code || trimmed.startsWith("```")) {
      if (trimmed.startsWith("```")) {
        if (code) {
          blocks.push(
            `<pre><code${codeLanguage ? ` class="language-${escapeHtml(codeLanguage)}"` : ""}>${escapeHtml(
              code.join("\n")
            )}</code></pre>`
          );
          code = undefined;
          codeLanguage = "";
        } else {
          flushParagraph();
          flushList();
          flushBlockquote();
          code = [];
          codeLanguage = trimmed.replace(/^```/, "").trim();
        }
      } else {
        code?.push(line);
      }
      continue;
    }

    if (!trimmed) {
      flushParagraph();
      flushList();
      flushBlockquote();
      continue;
    }

    if (/^<[^>]+>/.test(trimmed)) {
      flushParagraph();
      flushList();
      flushBlockquote();
      blocks.push(trimmed);
      continue;
    }

    const heading = trimmed.match(/^(#{2,6})\s+(.+)$/);
    if (heading) {
      flushParagraph();
      flushList();
      flushBlockquote();
      const level = heading[1].length;
      blocks.push(`<h${level}>${renderInlineMarkdown(heading[2])}</h${level}>`);
      continue;
    }

    const bullet = trimmed.match(/^[-*]\s+(.+)$/);
    if (bullet) {
      flushParagraph();
      flushBlockquote();
      list.push(bullet[1]);
      continue;
    }

    const quote = trimmed.match(/^>\s?(.+)$/);
    if (quote) {
      flushParagraph();
      flushList();
      blockquote.push(quote[1]);
      continue;
    }

    flushList();
    flushBlockquote();
    paragraph.push(trimmed);
  }

  flushParagraph();
  flushList();
  flushBlockquote();

  return blocks.join("\n");
}

export async function renderNoteContent(note: NoteEntry, site: URL): Promise<string> {
  const content = await replaceMdxComponents(note.body ?? "", site);
  return renderMarkdownBlocks(content);
}

export function getNoteDescription(note: NoteEntry): string {
  if (note.data.description && note.data.description !== "TODO") {
    return note.data.description;
  }

  return firstTextParagraph(note.body ?? "");
}

export function renderTroveContent(entry: TroveEntry, site: URL): string {
  const parts = [
    `<p><a href="${entry.data.url}">${escapeHtml(entry.data.title)}</a></p>`,
    entry.data.source ? `<p>${escapeHtml(entry.data.source)}</p>` : "",
    entry.data.quote ? `<blockquote><p>${escapeHtml(entry.data.quote)}</p></blockquote>` : "",
    entry.data.description ? `<p>${escapeHtml(entry.data.description)}</p>` : "",
    entry.data.images
      ?.map((image) => `<figure><img src="${escapeHtml(image)}" alt="" /></figure>`)
      .join("") ?? "",
    `<p><a href="${absoluteUrl(`/trove/#${entry.id}`, site)}">Permalink</a></p>`,
  ];

  return parts.filter(Boolean).join("\n");
}

export function getTroveDescription(entry: TroveEntry): string {
  return entry.data.description ?? entry.data.quote ?? entry.data.source ?? entry.data.url;
}

export function renderEphemeraContent(entry: EphemeraEntry, site: URL): string {
  const images = entry.data.images
    .map((image) => getEphemeraImagePath(image, entry.data.hasTransparency))
    .map(
      (imagePath) =>
        `<figure><img src="${escapeHtml(
          transformedR2ImageUrl(imagePath, { width: 900 })
        )}" alt="${escapeHtml(entry.data.name)}" /></figure>`
    )
    .join("\n");
  const metadata = [entry.data.venue, entry.data.location, entry.data.country]
    .filter(Boolean)
    .join(", ");

  return [
    images,
    metadata ? `<p>${escapeHtml(metadata)}</p>` : "",
    entry.data.notes ? `<p>${escapeHtml(entry.data.notes)}</p>` : "",
    `<p><a href="${absoluteUrl(`/ephemera/${entry.id}`, site)}">Permalink</a></p>`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function getEphemeraDescription(entry: EphemeraEntry): string {
  return [entry.data.venue, entry.data.location, entry.data.country, entry.data.notes]
    .filter(Boolean)
    .join(", ");
}

export function renderPhotoContent(entry: PhotoEntry, site: URL): string {
  const images = entry.data.images
    .map(
      (image) =>
        `<figure><img src="${escapeHtml(
          transformedR2ImageUrl(image.src, { width: Math.min(image.width, 1200) })
        )}" alt="${escapeHtml(image.alt)}" width="${image.width}" height="${image.height}" /></figure>`
    )
    .join("\n");

  return [
    images,
    entry.data.caption ? `<p>${escapeHtml(entry.data.caption)}</p>` : "",
    entry.data.location ? `<p>${escapeHtml(entry.data.location)}</p>` : "",
    `<p><a href="${absoluteUrl(`/photos/`, site)}">Permalink</a></p>`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function getPhotoDescription(entry: PhotoEntry): string {
  return [entry.data.caption, entry.data.location].filter(Boolean).join(", ");
}

export function renderSoundscapeContent(entry: SoundscapeEntry): string {
  const audioUrl = `${R2_BASE_URL}/soundscapes/${entry.data.file}`;

  return [
    `<figure><audio controls preload="metadata"><source src="${escapeHtml(
      audioUrl
    )}" type="audio/mp4" /></audio><figcaption>${escapeHtml(entry.data.title)} — ${escapeHtml(
      entry.data.location
    )}, ${escapeHtml(entry.data.country)}</figcaption></figure>`,
    entry.data.notes ? `<p>${escapeHtml(entry.data.notes)}</p>` : "",
    `<p><a href="${escapeHtml(audioUrl)}">Audio file</a></p>`,
  ]
    .filter(Boolean)
    .join("\n");
}

export function getSoundscapeDescription(entry: SoundscapeEntry): string {
  return [entry.data.location, entry.data.country, entry.data.notes]
    .filter(Boolean)
    .join(", ");
}
