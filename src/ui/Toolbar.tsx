import {
  ChevronDown,
  MoreHorizontal,
  Pause,
  Play,
  Timer,
  Volume,
  VolumeOff,
} from "../ui/icons";
import type { ControlsProps } from "./types";
export function Toolbar({
  currentSound,
  hasStarted,
  immersiveProps,
  panel,
  session,
  setPanel,
  timerLabel,
  toggleSession,
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
>) {
  return (
    <div
      {...immersiveProps}
      className={"minimal-bar"}
      role={"toolbar"}
      aria-label={"Điều khiển thư giãn"}
    >
      <button
        data-pause={true}
        className={"minimal-play"}
        onClick={toggleSession}
        disabled={session.starting}
        aria-label={
          session.starting
            ? "Đang mở âm thanh"
            : session.playing
              ? "Tạm dừng phiên thư giãn"
              : hasStarted
                ? "Phát phiên thư giãn"
                : "Bắt đầu thư giãn"
        }
        title={session.playing ? "Tạm dừng" : "Phát"}
      >
        {session.playing ? (
          <Pause size={20} fill={"currentColor"} />
        ) : (
          <Play size={20} fill={"currentColor"} />
        )}
      </button>
      <button
        className={"minimal-sound"}
        onClick={() => setPanel("library")}
        aria-label={`Chọn âm thanh. Đang chọn: ${currentSound.name}`}
        aria-haspopup={"dialog"}
        aria-expanded={panel === "library"}
      >
        <span>{currentSound.label}</span>
        <ChevronDown size={13} />
      </button>
      <button
        onClick={() => setPanel("volume")}
        aria-label={"Âm lượng"}
        title={"Âm lượng"}
        aria-haspopup={"dialog"}
        aria-expanded={panel === "volume"}
      >
        {session.volume ? <Volume size={19} /> : <VolumeOff size={19} />}
      </button>
      <button
        className={"minimal-timer"}
        onClick={() => setPanel("timer")}
        aria-label={`Hẹn giờ: ${session.duration ? session.duration + " phút" : "không giới hạn"}`}
        aria-haspopup={"dialog"}
        aria-expanded={panel === "timer"}
      >
        <Timer size={18} />
        <span>
          {session.remaining === null
            ? "∞"
            : hasStarted || session.playing || session.ended
              ? timerLabel
              : `${session.duration}′`}
        </span>
      </button>
      <button
        onClick={() => setPanel("options")}
        aria-label={"Tùy chọn"}
        title={"Tùy chọn"}
        aria-haspopup={"dialog"}
        aria-expanded={panel === "options"}
      >
        <MoreHorizontal size={21} />
      </button>
    </div>
  );
}
