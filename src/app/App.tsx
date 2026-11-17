import * as React from "react";
import { sourceAssets } from "../assets/catalog";
import { sounds } from "../audio/catalog";
import { SceneView as DL } from "../scene/SceneView";
import { useRelaxationSession } from "../session/useRelaxationSession";
import type { SheepSpeed } from "../types";
import { SceneOptions } from "../ui/SceneOptions";
import { SessionPanels } from "../ui/SessionPanels";
import { Toolbar } from "../ui/Toolbar";
import { TouchControls } from "../ui/TouchControls";
import { Panel } from "../ui/types";
import { useImmersiveControls } from "../ui/useImmersiveControls";
export function App() {
  let session = useRelaxationSession(),
    [count, setCount] = React.useState(0),
    [showCount, setShowCount] = React.useState(
      () => !matchMedia("(hover: hover) and (pointer: fine)").matches,
    ),
    [hasStarted, setHasStarted] = React.useState(false),
    [speed, setSpeed] = React.useState<SheepSpeed>("slow"),
    [reset, setReset] = React.useState(0),
    [sessionId, setSessionId] = React.useState(0),
    [reduced, setReduced] = React.useState(
      () => matchMedia("(prefers-reduced-motion: reduce)").matches,
    ),
    [sleep, setSleep] = React.useState(false),
    [sceneReady, setSceneReady] = React.useState(false),
    [panel, setPanel] = React.useState<Panel>(null),
    immersion = useImmersiveControls({
      playing: session.playing,
      sleep: sleep,
      blocked: !!panel || !!session.error || session.starting || session.ended,
      wake: () => setSleep(false),
    }),
    immersiveProps = {
      "data-immersive-ui": true,
      inert: immersion.hidden,
    };
  React.useEffect(() => {
    session.playing && setHasStarted(true);
  }, [session.playing]);
  let currentSound = sounds.find((x) => x.id === session.sound) ?? sounds[0],
    closePanel = () => setPanel(null);
  React.useEffect(() => {
    let x = matchMedia("(prefers-reduced-motion: reduce)"),
      L = () => setReduced(x.matches);
    x.addEventListener("change", L);
    return () => x.removeEventListener("change", L);
  }, []);
  React.useEffect(() => {
    session.ended && setSleep(true);
  }, [session.ended]);
  React.useEffect(() => {
    if (!sleep || immersion.desktop) return;
    let x = (L: KeyboardEvent) => {
      setSleep(false);
      L.key !== "Tab" && (L.preventDefault(), L.stopPropagation());
    };
    document.addEventListener("keydown", x, true);
    return () => document.removeEventListener("keydown", x, true);
  }, [sleep, immersion.desktop]);
  let timerLabel =
    session.remaining === null
      ? "Không giới hạn"
      : `${Math.floor(session.remaining / 6e4)
          .toString()
          .padStart(2, "0")}:${Math.floor((session.remaining % 6e4) / 1e3)
          .toString()
          .padStart(2, "0")}`;
  function toggleSession() {
    session.ended && (setCount(0), setSessionId((x) => x + 1));
    session.toggle();
  }
  let sceneOptions = (
    <SceneOptions
      immersion={immersion}
      reduced={reduced}
      sceneReady={sceneReady}
      setReduced={setReduced}
      setReset={setReset}
      setShowCount={setShowCount}
      setSpeed={setSpeed}
      showCount={showCount}
      speed={speed}
    />
  );
  return (
    <main
      className={`app ${sleep ? "is-sleeping" : ""} ${session.ended ? "has-ended" : ""} ${immersion.desktop ? "desktop-immersion" : ""} ${immersion.hidden ? "is-immersed" : ""} ${immersion.concealed ? "ui-concealed" : ""} ${reduced ? "reduce-motion" : ""}`}
      data-controls-hidden={immersion.hidden}
      data-playing={session.playing}
      data-remaining={session.remaining ?? "unlimited"}
      data-fade={session.fade.toFixed(3)}
      onPointerDownCapture={(x) => {
        sleep &&
          !immersion.desktop &&
          (setSleep(false),
          (x.target as Element).closest("[data-pause]") ||
            (x.preventDefault(), x.stopPropagation()));
      }}
      onKeyDownCapture={(x) => {
        sleep &&
          !immersion.desktop &&
          (setSleep(false),
          x.key !== "Tab" && (x.preventDefault(), x.stopPropagation()));
      }}
    >
      <React.Suspense
        fallback={
          <div className={"world"}>
            <img
              className={"scene-poster"}
              src={sourceAssets.landscape.url}
              alt={""}
              aria-hidden={"true"}
            />
            <p className={"scene-status"} role={"status"}>
              {"Một khoảng bình yên đang đến…"}
            </p>
          </div>
        }
      >
        <DL
          playing={session.playing}
          reduced={reduced}
          speed={speed}
          reset={reset}
          sessionId={sessionId}
          onCount={() => setCount((x) => x + 1)}
          onReady={setSceneReady}
        />
      </React.Suspense>
      <div className={"scene-shade"} aria-hidden={"true"} />
      <div className={"sleep-shade"} aria-hidden={"true"} />
      {immersion.desktop ? (
        <>
          {!hasStarted && (
            <div
              {...immersiveProps}
              className={"minimal-brand"}
              aria-label={"Êm"}
            >
              {"êm"}
              <span>{"☾"}</span>
            </div>
          )}
          {showCount && (
            <div
              {...immersiveProps}
              className={"minimal-count sheep-count"}
              aria-label={`${count} chú cừu đã qua hàng rào`}
            >
              <span>{count.toString().padStart(2, "0")}</span>
            </div>
          )}
          <Toolbar
            currentSound={currentSound}
            hasStarted={hasStarted}
            immersiveProps={immersiveProps}
            panel={panel}
            session={session}
            setPanel={setPanel}
            timerLabel={timerLabel}
            toggleSession={toggleSession}
          />
        </>
      ) : (
        <TouchControls
          count={count}
          currentSound={currentSound}
          immersiveProps={immersiveProps}
          sceneOptions={sceneOptions}
          sceneReady={sceneReady}
          session={session}
          setPanel={setPanel}
          setReset={setReset}
          setSleep={setSleep}
          showCount={showCount}
          timerLabel={timerLabel}
          toggleSession={toggleSession}
        />
      )}
      {sleep && (!immersion.desktop || session.ended) && (
        <p {...immersiveProps} className={"wake-hint"} role={"status"}>
          {session.ended
            ? "Phiên thư giãn đã khép lại. Chúc bạn ngủ ngon."
            : "Cứ thả lỏng thôi…"}
          <span>{"Chạm hoặc nhấn phím để hiện điều khiển"}</span>
        </p>
      )}
      {session.error && (
        <div className={"audio-error"} role={"alert"}>
          {session.error}
          <button onClick={toggleSession}>{"Thử lại"}</button>
          <button onClick={() => setPanel("library")}>{"Chọn bài khác"}</button>
        </div>
      )}

      <SessionPanels
        closePanel={closePanel}
        immersion={immersion}
        panel={panel}
        sceneOptions={sceneOptions}
        session={session}
        setSleep={setSleep}
        toggleSession={toggleSession}
      />
    </main>
  );
}
