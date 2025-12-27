/**
 * Shared utilities for ephemera content
 */

/**
 * Get the full R2 path for an ephemera image slug.
 *
 * Priority order:
 * 1. If slug already has a file extension (e.g., ".jpg", ".png", ".webp"), use it as-is
 *    This allows explicit overrides even when hasTransparency is set
 * 2. If no extension and hasTransparency is true, use .webp
 * 3. Otherwise default to .jpg
 *
 * @example
 * getEphemeraImagePath("marathon-bib-front", true)  // "ephemera/marathon-bib-front.webp"
 * getEphemeraImagePath("some-ticket")               // "ephemera/some-ticket.jpg"
 * getEphemeraImagePath("special-item.png")          // "ephemera/special-item.png"
 */
export function getEphemeraImagePath(
  slug: string,
  hasTransparency?: boolean
): string {
  // Priority 1: Check if slug already has a known image extension
  // This always wins, even if hasTransparency suggests a different format
  const hasExtension = /\.(jpe?g|png|webp|gif)$/i.test(slug);

  if (hasExtension) {
    return `ephemera/${slug}`;
  }

  // Priority 2 & 3: Look at the hasTransparency flag only when no explicit extension exists
  const extension = hasTransparency ? "webp" : "jpg";
  return `ephemera/${slug}.${extension}`;
}
