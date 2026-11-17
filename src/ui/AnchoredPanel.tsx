import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { CloseIcon } from "./icons";
import { placePanel, type PanelPlacement } from "./panelPlacement";
import type { DesktopPanel } from "./types";
export function AnchoredPanel({
  panel,
  title,
  barRef,
  close,
  children
}: {
  panel: DesktopPanel;
  title: string;
  barRef: RefObject<HTMLDivElement | null>;
  close(): void;
  children: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<PanelPlacement | null>(null);
  const latestClose = useRef(close);
  latestClose.current = close;
  useLayoutEffect(() => {
    const element = container.current,
      bar = barRef.current;
    const anchor = bar?.querySelector<HTMLElement>(`[data-panel-trigger="${panel}"]`);
    if (!element || !bar || !anchor) return;
    const update = () => {
      const next = placePanel({
        width: innerWidth,
        height: innerHeight
      }, bar.getBoundingClientRect(), anchor.getBoundingClientRect(), element.getBoundingClientRect(), panel === "volume");
      setPlacement(old => old && Object.keys(next).every(key => old[key as keyof PanelPlacement] === next[key as keyof PanelPlacement]) ? old : next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    observer.observe(bar);
    window.addEventListener("resize", update);
    window.visualViewport?.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", update);
      window.visualViewport?.removeEventListener("resize", update);
    };
  }, [panel, barRef]);
  const positioned = placement !== null;
  useLayoutEffect(() => {
    if (!positioned || !container.current) return;
    const initial = container.current.querySelector<HTMLElement>('[data-initial-focus="true"]:not(:disabled)');
    (initial ?? container.current).focus({
      preventScroll: true
    });
  }, [panel, positioned]);
  useEffect(() => {
    const outside = (event: PointerEvent | FocusEvent) => {
      const target = event.target;
      const element = container.current;
      if (element && target instanceof Node && !element.contains(target) && !barRef.current?.contains(target)) latestClose.current();
    };
    const key = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      barRef.current?.querySelector<HTMLElement>(`[data-panel-trigger="${panel}"]`)?.focus({
        preventScroll: true
      });
      latestClose.current();
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("focusin", outside);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", outside, true);
      document.removeEventListener("focusin", outside);
      document.removeEventListener("keydown", key);
    };
  }, [panel, barRef]);
  const dismiss = () => {
    barRef.current?.querySelector<HTMLElement>(`[data-panel-trigger="${panel}"]`)?.focus();
    close();
  };
  return <div ref={container} id={`desktop-panel-${panel}`} data-panel={panel} data-side={placement?.side} data-immersive-ui="true" className={`desktop-popover popover-${panel}`} role="dialog" aria-modal="false" aria-label={title} tabIndex={-1} style={{
    left: placement?.left ?? 0,
    top: placement?.top ?? 0,
    maxHeight: placement?.maxHeight,
    visibility: placement ? "visible" : "hidden"
  }}>
    {panel !== "volume" && <div className="popover-heading"><h2>{title}</h2><button className="popover-close" aria-label="Đóng" onClick={dismiss}><CloseIcon size={18} /></button></div>}
    {children}
  </div>;
}
