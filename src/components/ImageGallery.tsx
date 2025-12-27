import { useState } from "preact/hooks";
import { R2_BASE_URL } from "../lib/config";
import styles from "./ImageGallery.module.css";

interface ImageGalleryProps {
  images: string[];
  labels: string[];
  name: string;
}

function buildR2Url(path: string, width: number): string {
  return `${R2_BASE_URL}/cdn-cgi/image/width=${width},fit=scale-down,quality=80,format=auto/${path}`;
}

function buildSrcSet(path: string): string {
  return [200, 400, 600, 800, 1200, 1600]
    .map((w) => `${buildR2Url(path, w)} ${w}w`)
    .join(", ");
}

export default function ImageGallery({
  images,
  labels,
  name,
}: ImageGalleryProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  return (
    <>
      <div class={styles["ephemera-hero-frame"]}>
        <img
          src={buildR2Url(images[activeIndex], 1200)}
          srcset={buildSrcSet(images[activeIndex])}
          sizes="(max-width: 640px) 100vw, (max-width: 1200px) 90vw, 1200px"
          alt={`${name} — ${labels[activeIndex]}`}
          class={styles.heroImage}
          loading="lazy"
          decoding="async"
        />
      </div>

      {images.length > 1 && (
        <>
          <figcaption class={styles.heroCaption}>
            {labels[activeIndex]}
          </figcaption>
          <div class={styles.thumbnails}>
            {images.map((imagePath, idx) => (
              <button
                type="button"
                class={`${styles.thumb} ${
                  idx === activeIndex ? styles.active : ""
                }`}
                onClick={() => setActiveIndex(idx)}
                aria-label={`View ${labels[idx]}`}
              >
                <img
                  src={buildR2Url(imagePath, 120)}
                  alt=""
                  class={styles.thumbImage}
                  loading="lazy"
                  decoding="async"
                />
              </button>
            ))}
          </div>
        </>
      )}
    </>
  );
}
