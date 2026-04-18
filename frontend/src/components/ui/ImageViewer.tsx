import { useEffect, useRef } from "react";
import { useUiStore } from "@/stores/uiStore";
import type { ImageViewerItem } from "@/stores/uiStore";
import PhotoSwipe from "photoswipe";
import "photoswipe/style.css";

export function ImageViewer() {
  const items = useUiStore((s) => s.imageViewerItems);
  const index = useUiStore((s) => s.imageViewerIndex);
  const closeImageViewer = useUiStore((s) => s.closeImageViewer);
  const pswpRef = useRef<PhotoSwipe | null>(null);

  useEffect(() => {
    if (!items || items.length === 0) return;
    // Guard against double-open in StrictMode
    if (pswpRef.current) return;

    const dataSource = items.map((item) => ({
      src: item.src,
      width: item.width || 0,
      height: item.height || 0,
      alt: item.alt,
    }));

    const pswp = new PhotoSwipe({
      dataSource,
      index,
      bgOpacity: 0.92,
      showHideAnimationType: "fade",
      pswpModule: PhotoSwipe,
    });

    // Dynamically resolve image dimensions when not provided
    pswp.on("gettingData", ({ data }) => {
      if (!data.width || !data.height) {
        const img = new Image();
        img.onload = () => {
          data.width = img.naturalWidth;
          data.height = img.naturalHeight;
          pswp.updateSize(true);
        };
        img.src = data.src as string;
      }
    });

    pswp.on("destroy", () => {
      pswpRef.current = null;
      closeImageViewer();
    });

    pswp.init();
    pswpRef.current = pswp;

    return () => {
      if (pswpRef.current) {
        pswpRef.current.destroy();
        pswpRef.current = null;
      }
    };
  }, [items, index, closeImageViewer]);

  return null;
}

/**
 * Helper to open the image viewer with a single image (e.g., avatar preview).
 */
export function openSingleImage(src: string) {
  useUiStore.getState().openImageViewer([{ src }], 0);
}

/**
 * Helper to open the image viewer with a gallery of images.
 */
export function openImageGallery(items: ImageViewerItem[], startIndex: number) {
  useUiStore.getState().openImageViewer(items, startIndex);
}
