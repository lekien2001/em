import * as React from "react";
import type { ImmersionState } from "../types";
export const DESKTOP_POINTER = "(hover: hover) and (pointer: fine)";
export function useImmersiveControls(state: ImmersionState) {
  let [desktop, setDesktop] = React.useState(
      () => matchMedia(DESKTOP_POINTER).matches,
    ),
    [hidden, setHidden] = React.useState(false),
    [concealed, setConcealed] = React.useState(false);
  React.useEffect(() => {
    if (!hidden) {
      setConcealed(false);
      return;
    }
    let Q = window.setTimeout(() => setConcealed(true), 250);
    return () => window.clearTimeout(Q);
  }, [hidden]);
  let latest = React.useRef(state);
  latest.current = state;
  let controller = React.useRef<{
    sync(): void;
  } | null>(null);
  React.useEffect(() => {
    let Q = matchMedia(DESKTOP_POINTER),
      w = () => setDesktop(Q.matches);
    Q.addEventListener("change", w);
    return () => Q.removeEventListener("change", w);
  }, []);
  React.useEffect(() => {
    if (!desktop) {
      setHidden(false);
      return;
    }
    let Q: number | undefined,
      w = 0,
      t = false,
      D = false,
      B = false,
      M = false,
      r = false,
      v = () => window.clearTimeout(Q),
      C = () =>
        (latest.current.playing || latest.current.sleep) &&
        !latest.current.blocked,
      n = () => {
        v();
        C() &&
          (document.activeElement instanceof HTMLElement &&
            document.activeElement.closest("[data-immersive-ui]") &&
            document.activeElement.blur(),
          (B = true),
          setHidden(true));
      },
      a = () => {
        v();
        C() && !B && !t && !D && (Q = window.setTimeout(n, 3e3));
      },
      z = () => {
        B = false;
        setHidden(false);
        latest.current.wake();
        a();
      },
      T = (x: PointerEvent) => {
        x.pointerType !== "mouse" ||
          (!x.movementX && !x.movementY) ||
          ((D = false), z());
      },
      l = (x: PointerEvent) => {
        if ((cancelAnimationFrame(w), (D = false), B)) {
          x.preventDefault();
          x.stopImmediatePropagation();
          z();
          return;
        }
        t = true;
        v();
      },
      k = () => {
        D = false;
        z();
      },
      Y = () => {
        t = false;
        a();
      },
      j = (x: KeyboardEvent) => {
        let L = B;
        x.key === "Escape" && (t = false);
        D =
          x.key !== "Escape" &&
          (x.key === "Tab" ||
            !!document.activeElement?.closest("[data-immersive-ui]"));
        z();
        L
          ? (x.preventDefault(),
            x.stopImmediatePropagation(),
            x.key === "Tab" &&
              ((D = true),
              (w = requestAnimationFrame(() =>
                document.querySelector<HTMLElement>("[data-pause]")?.focus(),
              ))))
          : x.key === "Escape" &&
            !latest.current.blocked &&
            ((D = false),
            document.activeElement instanceof HTMLElement &&
              document.activeElement.blur(),
            a());
      },
      c = () => {
        queueMicrotask(() => {
          document.activeElement?.closest("[data-immersive-ui]") ||
            ((D = false), a());
        });
      },
      U = () => {
        document.hidden ? ((t = false), v()) : a();
      };
    controller.current = {
      sync() {
        let x = latest.current;
        x.blocked && cancelAnimationFrame(w);
        C()
          ? (!M && x.playing) || (!r && x.sleep)
            ? ((t = D = false), n())
            : a()
          : (v(), (B = false), setHidden(false));
        M = x.playing;
        r = x.sleep;
      },
    };
    document.addEventListener("wheel", k, {
      capture: true,
      passive: true,
    });
    document.addEventListener("pointermove", T, true);
    document.addEventListener("pointerdown", l, true);
    document.addEventListener("pointerup", Y, true);
    document.addEventListener("pointercancel", Y, true);
    document.addEventListener("keydown", j, true);
    document.addEventListener("focusout", c);
    document.addEventListener("visibilitychange", U);
    window.addEventListener("blur", Y);
    return () => {
      v();
      cancelAnimationFrame(w);
      controller.current = null;
      document.removeEventListener("wheel", k, true);
      document.removeEventListener("pointermove", T, true);
      document.removeEventListener("pointerdown", l, true);
      document.removeEventListener("pointerup", Y, true);
      document.removeEventListener("pointercancel", Y, true);
      document.removeEventListener("keydown", j, true);
      document.removeEventListener("focusout", c);
      document.removeEventListener("visibilitychange", U);
      window.removeEventListener("blur", Y);
    };
  }, [desktop]);
  React.useEffect(
    () => controller.current?.sync(),
    [desktop, state.playing, state.sleep, state.blocked],
  );
  return {
    desktop: desktop,
    hidden: desktop && hidden,
    concealed: desktop && hidden && concealed,
  };
}
