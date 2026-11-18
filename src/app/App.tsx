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
import { FaceEditor } from "../face/FaceEditor";
import { usePersonalFace } from "../face/usePersonalFace";
import { DesktopPanels } from "../ui/DesktopPanels";
import { useFavorites } from "../session/useFavorites";
import { formatRemaining, type FavoriteConfig } from "../session/config";
import type { Favorite } from "../session/favorites";
import { FavoritesPanel } from "../ui/FavoritesPanel";
import { DesktopSettings } from "../ui/DesktopSettings";
export function App() {
  const favorites = useFavorites();
  const [endDimDismissed, setEndDimDismissed] = React.useState(false);
  const personalFace = usePersonalFace();
  const barRef = React.useRef<HTMLDivElement>(null);
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
      blocked: !!panel || !!session.error || !!session.mixError || session.starting || session.ended,
      wake: () => {
        setSleep(false);
        if (session.ended) setEndDimDismissed(true);
      },
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
    if (session.ended) { setSleep(true); setEndDimDismissed(false); }
  }, [session.ended]);
  React.useEffect(() => {
    if (!sleep || immersion.desktop) return;
    let x = (L: KeyboardEvent) => {
      setSleep(false);
      setEndDimDismissed(true);
      L.key !== "Tab" && (L.preventDefault(), L.stopPropagation());
    };
    document.addEventListener("keydown", x, true);
    return () => document.removeEventListener("keydown", x, true);
  }, [sleep, immersion.desktop]);
  const timerLabel = formatRemaining(session.remaining);
  function toggleSession() {
    session.ended && (setCount(0), setSessionId((x) => x + 1));
    setEndDimDismissed(false);
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
      setPanel={setPanel}
      showCount={showCount}
      speed={speed}
    />
  );
  const desktopSettings = (
    <DesktopSettings
      speed={speed}
      setSpeed={setSpeed}
      reduced={reduced}
      setReduced={setReduced}
      showCount={showCount}
      setShowCount={setShowCount}
      sceneReady={sceneReady}
      faceApplied={!!personalFace.photo}
      openFavorites={() => setPanel("favorites")}
      reset={() => { closePanel(); setReset(x => x + 1); }}
      dim={() => { closePanel(); setSleep(true); }}
      openFace={() => {
        barRef.current?.querySelector<HTMLElement>('[data-panel-trigger="options"]')?.focus();
        setPanel("face");
      }}
    />
  );
  function configuration(): FavoriteConfig {
    return { ...session.getConfiguration(), speed, reduced, showCount };
  }
  function applyFavorite(favorite: Favorite) {
    session.applyConfiguration(favorite.config);
    setSpeed(favorite.config.speed);
    setReduced(favorite.config.reduced);
    setShowCount(favorite.config.showCount);
    setCount(0);
    setSessionId(x => x + 1);
    setSleep(false);
    setEndDimDismissed(false);
    closePanel();
  }
  const favoritesContent = (
    <FavoritesPanel favorites={favorites} current={configuration} apply={applyFavorite}
      back={immersion.desktop ? undefined : closePanel} />
  );
  const automaticDim = session.ended && endDimDismissed ? 0 : .7 * (1 - session.fade);
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
          (setSleep(false), setEndDimDismissed(true),
          (x.target as Element).closest("[data-pause]") ||
            (x.preventDefault(), x.stopPropagation()));
      }}
      onKeyDownCapture={(x) => {
        sleep &&
          !immersion.desktop &&
          (setSleep(false), setEndDimDismissed(true),
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
          editorOpen={panel === "face"}
          reduced={reduced}
          speed={speed}
          reset={reset}
          sessionId={sessionId}
          onCount={() => setCount((x) => x + 1)}
          onReady={setSceneReady}
          face={personalFace.photo?.face ?? null}
          onFaceError={personalFace.setError}
        />
      </React.Suspense>
      <div className={"scene-shade"} aria-hidden={"true"} />
      <div className={"sleep-shade"} aria-hidden={"true"}
        style={{ opacity: Math.max(sleep ? .7 : 0, automaticDim) }} />
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
            barRef={barRef}
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
      {session.mixError && panel !== "library" && (
        <div className="audio-error" role="alert">
          {session.mixError}<button onClick={() => setPanel("library")}>Chỉnh bản phối</button>
        </div>
      )}
      {session.noticeVisible && !session.mixError && panel !== "library" && (
        <div className="audio-error" role="status">{session.audioNotice}</div>
      )}
      {personalFace.error && <div className="audio-error" role="alert">{personalFace.error}<button onClick={personalFace.restore}>Khôi phục</button></div>}
      {panel === "face" && <FaceEditor face={personalFace} close={closePanel} sceneReady={sceneReady} />}

      {immersion.desktop ? (
        <DesktopPanels panel={panel} barRef={barRef} closePanel={closePanel} session={session} timerLabel={timerLabel}
          settings={desktopSettings} favorites={favoritesContent} backToOptions={() => setPanel("options")} />
      ) : <SessionPanels
        closePanel={closePanel}
        immersion={immersion}
        panel={panel}
        session={session}
        toggleSession={toggleSession}
        favorites={favoritesContent}
      />}
    </main>
  );
}
