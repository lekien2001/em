import {
  ChevronDown,
  CloseIcon,
  MoreHorizontal,
  Pause,
  Play,
  Timer,
  Volume,
  VolumeOff,
} from "../ui/icons";
import { isDesktopPanel, panelTrigger, type ControlsProps } from "./types";
export function Toolbar({
  hasStarted,
  immersiveProps,
  panel,
  session,
  setPanel,
  timerLabel,
  toggleSession,
  barRef,
}: Pick<
  ControlsProps,
  | "currentSound"
  | "hasStarted"
  | "immersiveProps"
  | "panel"
  | "session"
  | "setPanel"
  | "timerLabel"
  | "toggleSession"
  | "barRef"
>) {
  const togglePanel = (next: "library" | "volume" | "timer" | "options") => setPanel(current => current === next ? null : next);
  const optionsOpen = isDesktopPanel(panel) && panelTrigger(panel) === "options";
  return (
    <div
      ref={barRef}
      {...immersiveProps}
      className={"minimal-bar"}
      role={"toolbar"}
      aria-label={"Điều khiển thư giãn"}
    >
      <button
        data-pause={true}
        className={"minimal-play"}
        onClick={toggleSession}
        aria-label={
          session.starting
            ? "Hủy mở âm thanh"
            : session.playing
              ? "Tạm dừng phiên thư giãn"
              : hasStarted
                ? "Phát phiên thư giãn"
                : "Bắt đầu thư giãn"
        }
        title={session.starting ? "Đang mở âm thanh · Bấm để hủy" : session.playing ? "Tạm dừng" : "Phát"}
      >
        {session.starting ? <span className="play-pending" aria-hidden="true"><span className="play-loading" /><CloseIcon size={10} /></span> : session.playing ? (
          <Pause size={20} fill={"currentColor"} />
        ) : (
          <Play size={20} fill={"currentColor"} />
        )}
      </button>
      <button
        className={"minimal-sound"}
        onClick={() => togglePanel("library")}
        data-panel-trigger="library"
        aria-controls={panel === "library" ? "desktop-panel-library" : undefined}
        aria-label={`Chọn âm thanh. Đang chọn: ${session.soundLabel}`}
        aria-haspopup={"dialog"}
        aria-expanded={panel === "library"}
      >
        <span>{session.soundLabel}</span>
        <ChevronDown size={13} />
      </button>
      <button
        onClick={() => togglePanel("volume")}
        data-panel-trigger="volume"
        aria-controls={panel === "volume" ? "desktop-panel-volume" : undefined}
        aria-label={"Âm lượng"}
        title={"Âm lượng"}
        aria-haspopup={"dialog"}
        aria-expanded={panel === "volume"}
      >
        {session.volume ? <Volume size={19} /> : <VolumeOff size={19} />}
      </button>
      <button
        className={"minimal-timer"}
        onClick={() => togglePanel("timer")}
        data-panel-trigger="timer"
        aria-controls={panel === "timer" ? "desktop-panel-timer" : undefined}
        aria-label={`Hẹn giờ: ${session.duration ? session.duration + " phút" : "không giới hạn"}`}
        aria-haspopup={"dialog"}
        aria-expanded={panel === "timer"}
      >
        <Timer size={18} />
        <span>
          {session.remaining === null
            ? "∞"
            : timerLabel}
        </span>
      </button>
      <button
        onClick={() => togglePanel("options")}
        data-panel-trigger="options"
        aria-controls={optionsOpen ? `desktop-panel-${panel}` : undefined}
        aria-label={"Tùy chọn"}
        title={"Tùy chọn"}
        aria-haspopup={"dialog"}
        aria-expanded={optionsOpen}
      >
        <MoreHorizontal size={21} />
      </button>
    </div>
  );
}
