import { useEffect, useRef, type ReactNode } from "react";
import { CloseIcon } from "./icons";
export function Dialog({
  title,
  children,
  close,
  compact = false,
  className = "",
  backdropClassName = "",
}: {
  title: string;
  children: ReactNode;
  close(): void;
  compact?: boolean;
  className?: string;
  backdropClassName?: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const previous = document.activeElement;
    container.current
      ?.querySelector<HTMLElement>("button, select, input")
      ?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      if (event.key !== "Tab") return;
      const controls = Array.from(container.current?.querySelectorAll<HTMLElement>(
        'button, select, input, [tabindex="0"]',
      ) ?? []).filter(el => !el.matches(':disabled, [inert], [type="hidden"]') && el.getClientRects().length > 0 && !el.closest('[inert]'));
      if (!controls?.length) return;
      const first = controls[0],
        last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previous instanceof HTMLElement) previous.focus();
    };
  }, []);
  return (
    <div
      className={`modal-backdrop ${backdropClassName}`}
      onClick={(event) => {
        if (event.target === event.currentTarget) close();
      }}
    >
      <div
        ref={container}
        className={`modal ${compact ? "modal-compact" : ""} ${className}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-heading">
          <div>
            {!compact && <span className="eyebrow">ÊM · GÓC NHỎ CỦA BẠN</span>}
            <h2>{title}</h2>
          </div>
          <button className="icon-button" onClick={close} aria-label="Đóng">
            <CloseIcon size={21} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
