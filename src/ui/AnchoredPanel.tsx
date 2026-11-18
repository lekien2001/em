import { useEffect, useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { ArrowLeft, CloseIcon } from "./icons";
import { placePanel, type PanelPlacement } from "./panelPlacement";
import type { DesktopPanel } from "./types";
export function AnchoredPanel({
  panel,
  title,
  barRef,
  close,
  back,
  children
}: {
  panel: DesktopPanel;
  title: string;
  barRef: RefObject<HTMLDivElement | null>;
  close(): void;
  back?(): void;
  children: ReactNode;
}) {
  const container = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [placement, setPlacement] = useState<PanelPlacement | null>(null);
  const latestClose = useRef(close);
  latestClose.current = close;
  useLayoutEffect(() => {
    const element = container.current,
      body = content.current,
      bar = barRef.current;
    const anchor = bar?.querySelector<HTMLElement>(`[data-panel-trigger="${panel === "favorites" ? "options" : panel}"]`);
    if (!element || !body || !bar || !anchor) return;
    let measured: PanelPlacement | undefined;
    let measurementFrame = 0;
    const measure = () => {
      measurementFrame = 0;
      const style = getComputedStyle(element);
      const verticalInsets = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom) + element.offsetHeight - element.clientHeight;
      const next = placePanel({
        width: innerWidth,
        height: innerHeight
      }, bar.getBoundingClientRect(), anchor.getBoundingClientRect(), {
        width: element.offsetWidth,
        height: body.offsetHeight + verticalInsets,
      }, panel === "volume");
      if (measured && measured.left === next.left && measured.top === next.top &&
          measured.maxHeight === next.maxHeight && measured.side === next.side) return;
      measured = next;
      setPlacement(next);
    };
    const queueMeasure = () => {
      if (!measurementFrame) measurementFrame = requestAnimationFrame(measure);
    };
    measure();
    const observer = new ResizeObserver(queueMeasure);
    // Observe the content at its natural height so applying a maxHeight to
    // the outer panel doesn't itself trigger another placement measurement.
    observer.observe(body);
    observer.observe(bar);
    window.addEventListener("resize", queueMeasure);
    window.visualViewport?.addEventListener("resize", queueMeasure);
    return () => {
      cancelAnimationFrame(measurementFrame);
      observer.disconnect();
      window.removeEventListener("resize", queueMeasure);
      window.visualViewport?.removeEventListener("resize", queueMeasure);
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
      barRef.current?.querySelector<HTMLElement>(`[data-panel-trigger="${panel === "favorites" ? "options" : panel}"]`)?.focus({
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
    barRef.current?.querySelector<HTMLElement>(`[data-panel-trigger="${panel === "favorites" ? "options" : panel}"]`)?.focus();
    close();
  };
  return <div ref={container} id={`desktop-panel-${panel}`} data-panel={panel} data-side={placement?.side} data-immersive-ui="true" className={`desktop-popover popover-${panel}`} role="dialog" aria-modal="false" aria-label={title} tabIndex={-1} style={{
    left: placement?.left ?? 0,
    top: placement?.top ?? 0,
    maxHeight: placement?.maxHeight,
    visibility: placement ? "visible" : "hidden"
  }}>
    <div className="popover-content" ref={content}>
      {panel !== "volume" && <div className="popover-heading">
        {back && <button type="button" className="popover-back" aria-label="Quay lại Tùy chọn" onClick={back}><ArrowLeft size={16} /></button>}
        <h2>{title}</h2>
        <button type="button" className="popover-close" aria-label="Đóng" onClick={dismiss}><CloseIcon size={18} /></button>
      </div>}
      {children}
    </div>
  </div>;
}
