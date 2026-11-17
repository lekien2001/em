type Rect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  width: number;
};
export type PanelPlacement = {
  left: number;
  top: number;
  maxHeight: number;
  side: "right" | "left" | "above";
};
/** Keep large panels beside the toolbar and away from the central jumping area.
 * Fall above the bar when neither side fits; the panel scrolls on short windows. */
export function placePanel(viewport: {
  width: number;
  height: number;
}, bar: Rect, anchor: Rect, size: {
  width: number;
  height: number;
}, compact: boolean): PanelPlacement {
  const margin = 12,
    gap = 12,
    width = size.width;
  const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(Math.max(lo, hi), n));
  if (!compact) {
    const side = bar.right + gap + width <= viewport.width - margin ? "right" : bar.left - gap - width >= margin ? "left" : null;
    if (side) {
      const maxHeight = Math.max(1, viewport.height - margin * 2);
      const height = Math.min(size.height, maxHeight);
      return {
        side,
        left: side === "right" ? bar.right + gap : bar.left - gap - width,
        top: clamp(bar.bottom - height, margin, viewport.height - margin - height),
        maxHeight
      };
    }
  }
  const maxHeight = Math.max(1, Math.min(bar.top - gap - margin, viewport.height - margin * 2));
  const height = Math.min(size.height, maxHeight);
  return {
    side: "above",
    left: clamp(compact ? anchor.left + anchor.width / 2 - width / 2 : bar.right - width, margin, viewport.width - margin - width),
    top: clamp(bar.top - gap - height, margin, viewport.height - margin - height),
    maxHeight
  };
}
