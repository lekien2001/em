import type { ReactNode } from "react";
import { sounds } from "../audio/catalog";
import { AnchoredPanel } from "./AnchoredPanel";
import { Check, Volume, VolumeOff } from "./icons";
import { isDesktopPanel, type ControlsProps } from "./types";
export function DesktopPanels({
  panel,
  barRef,
  closePanel,
  session,
  timerLabel,
  settings
}: Pick<ControlsProps, "panel" | "barRef" | "closePanel" | "session" | "timerLabel"> & {
  settings: ReactNode;
}) {
  if (!isDesktopPanel(panel)) return null;
  const titles = {
    library: "Âm thanh",
    volume: "Âm lượng",
    timer: "Hẹn giờ",
    options: "Tùy chọn"
  };
  const close = () => {
    barRef.current?.querySelector<HTMLElement>(`[data-panel-trigger="${panel}"]`)?.focus();
    closePanel();
  };
  return <AnchoredPanel key={panel} panel={panel} title={titles[panel]} barRef={barRef} close={closePanel}>
    {panel === "options" && settings}
    {panel === "library" && <div className="compact-sounds">{sounds.map(sound => <button key={sound.id} className="compact-sound" aria-pressed={session.sound === sound.id} data-initial-focus={session.sound === sound.id} onClick={() => {
        session.setSound(sound.id);
        close();
      }}><span className={`sound-art ${sound.art}`} aria-hidden="true" /><span className="sound-label">{sound.label}</span><span className="compact-check">{session.sound === sound.id && <Check size={17} />}</span></button>)}</div>}
    {panel === "volume" && <div className="compact-volume">
      <button className="volume-mute" onClick={session.toggleMute} aria-label={session.volume ? "Tắt tiếng" : "Bật tiếng"} title={session.volume ? "Tắt tiếng" : "Bật tiếng"}>{session.volume ? <Volume size={19} /> : <VolumeOff size={19} />}</button>
      <input data-initial-focus="true" type="range" min="0" max="1" step="0.01" aria-label="Âm lượng" aria-valuetext={`${Math.round(session.volume * 100)}%`} value={session.volume} onChange={event => session.setVolume(Number(event.target.value))} />
      <output aria-label="Mức âm lượng">{Math.round(session.volume * 100)}%</output>
    </div>}
    {panel === "timer" && <>
      <div className="timer-remaining"><span>Còn lại</span><strong>{session.remaining === null ? "Không giới hạn" : timerLabel}</strong></div>
      <div className="compact-timers">{([15, 30, 60, 0] as const).map(minutes => <button key={minutes} aria-pressed={session.duration === minutes} data-initial-focus={session.duration === minutes} onClick={() => {
          session.changeDuration(minutes);
          close();
        }}><span>{minutes ? `${minutes} phút` : "Không giới hạn"}</span>{session.duration === minutes && <Check size={16} />}</button>)}</div>
      <p className="popover-note">Chọn mốc sẽ bắt đầu lại thời gian.</p><p className="popover-note">Âm thanh giảm dần trong 15 giây cuối.</p>
    </>}
  </AnchoredPanel>;
}
