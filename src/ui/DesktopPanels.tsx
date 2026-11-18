import type { ReactNode } from "react";
import { SoundPicker } from "./SoundPicker";
import { TimerControls } from "./TimerControls";
import { AnchoredPanel } from "./AnchoredPanel";
import { Volume, VolumeOff } from "./icons";
import { isDesktopPanel, type ControlsProps } from "./types";
export function DesktopPanels({
  panel,
  barRef,
  closePanel,
  session,
  settings,
  favorites,
  backToOptions,
}: Pick<ControlsProps, "panel" | "barRef" | "closePanel" | "session" | "timerLabel"> & {
  settings: ReactNode;
  favorites: ReactNode;
  backToOptions(): void;
}) {
  if (!isDesktopPanel(panel)) return null;
  const titles = {
    library: "Âm thanh",
    volume: "Âm lượng",
    timer: "Hẹn giờ",
    options: "Tùy chọn",
    favorites: "Phiên yêu thích"
  };
  const close = () => {
    barRef.current?.querySelector<HTMLElement>(`[data-panel-trigger="${panel === "favorites" ? "options" : panel}"]`)?.focus();
    closePanel();
  };
  return <AnchoredPanel key={panel} panel={panel} title={titles[panel]} barRef={barRef} close={closePanel}
    back={panel === "favorites" ? backToOptions : undefined}>
    {panel === "options" && settings}
    {panel === "favorites" && favorites}
    {panel === "library" && <SoundPicker session={session} close={close} />}
    {panel === "volume" && <div className="compact-volume">
      <button className="volume-mute" onClick={session.toggleMute} aria-label={session.volume ? "Tắt tiếng" : "Bật tiếng"} title={session.volume ? "Tắt tiếng" : "Bật tiếng"}>{session.volume ? <Volume size={19} /> : <VolumeOff size={19} />}</button>
      <input data-initial-focus="true" type="range" min="0" max="1" step="0.01" aria-label="Âm lượng" aria-valuetext={`${Math.round(session.volume * 100)}%`} value={session.volume} onChange={event => session.setVolume(Number(event.target.value))} />
      <output aria-label="Mức âm lượng">{Math.round(session.volume * 100)}%</output>
    </div>}
    {panel === "timer" && <TimerControls session={session} showPresetCheck={false} />}
  </AnchoredPanel>;
}
