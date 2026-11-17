import * as React from "react";
import { sounds } from "../audio/catalog";
import {
  ArrowUpRight,
  ChevronDown,
  Info,
  Moon,
  Move,
  Music,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Timer,
  Volume,
  VolumeOff,
} from "../ui/icons";
import type { ControlsProps } from "./types";
export function TouchControls({
  count,
  currentSound,
  immersiveProps,
  sceneOptions,
  sceneReady,
  session,
  setPanel,
  setReset,
  setSleep,
  showCount,
  timerLabel,
  toggleSession,
}: Pick<
  ControlsProps,
  | "count"
  | "currentSound"
  | "immersiveProps"
  | "sceneOptions"
  | "sceneReady"
  | "session"
  | "setPanel"
  | "setReset"
  | "setSleep"
  | "showCount"
  | "timerLabel"
  | "toggleSession"
>) {
  return (
    <>
      <header {...immersiveProps} className={"header sleep-hide"}>
        <a
          className={"logo"}
          href={"#"}
          aria-label={"Êm — về góc ban đầu"}
          onClick={(x) => {
            x.preventDefault();
            setReset((L) => L + 1);
          }}
        >
          {"êm"}
          <span>{"☾"}</span>
        </a>
        <nav aria-label={"Điều hướng chính"}>
          <button
            className={"nav-active"}
            onClick={() => {
              setReset((x) => x + 1);
            }}
          >
            {"Không gian"}
            <span />
          </button>
          <button onClick={() => setPanel("library")}>
            {"Thư viện "}
            <ArrowUpRight size={14} />
          </button>
        </nav>
        <button className={"night-button"} onClick={() => setSleep(true)}>
          <Moon size={17} />
          <span>{"Chế độ ngủ"}</span>
        </button>
      </header>
      <section
        {...immersiveProps}
        className={"intro sleep-hide"}
        aria-label={"Chào mừng"}
      >
        <h1>{"Đếm cừu cùng trăng"}</h1>
        <p>{"Thả lỏng một chút, để ngày dài khép lại."}</p>
      </section>
      {showCount && (
        <div
          {...immersiveProps}
          className={"sheep-count sleep-hide"}
          aria-label={`${count} chú cừu đã qua hàng rào`}
        >
          <span>{count.toString().padStart(2, "0")}</span>
          <small>{"chú cừu qua hàng rào"}</small>
        </div>
      )}
      {!session.playing && !session.ended && (
        <button
          {...immersiveProps}
          className={"start-button sleep-hide"}
          disabled={session.starting}
          onClick={toggleSession}
        >
          <Play size={15} fill={"currentColor"} />
          {session.starting
            ? "Đang mở âm thanh…"
            : count
              ? "Tiếp tục thư giãn"
              : "Bắt đầu thư giãn"}
        </button>
      )}
      <div {...immersiveProps} className={"bottom-ui"}>
        {sceneOptions}
        <section className={"player"} aria-label={"Trình phát thư giãn"}>
          <button
            className={"now-playing sleep-hide"}
            onClick={() => setPanel("library")}
            aria-label={`Chọn âm thanh. Đang chọn: ${currentSound.name}`}
          >
            <span className={`sound-art ${currentSound.art}`}>
              <span className={"art-play"}>
                <Music size={16} />
              </span>
            </span>
            <span className={"track-text"}>
              <span className={"track-title"}>{currentSound.name}</span>
              <span className={"track-subtitle"}>
                <span
                  className={`status-dot ${session.playing ? "live" : ""}`}
                />
                {session.playing
                  ? "Đang thả lỏng cùng bạn"
                  : session.ended
                    ? "Chúc bạn một giấc ngủ êm"
                    : "Âm thanh cho một đêm yên"}
              </span>
            </span>
            <ChevronDown className={"track-chevron"} size={16} />
          </button>
          <div className={"play-section"}>
            <button
              className={"skip-button sleep-hide"}
              aria-label={"Âm thanh trước"}
              onClick={() =>
                session.setSound(
                  sounds[
                    (sounds.findIndex((x) => x.id === session.sound) +
                      sounds.length -
                      1) %
                      sounds.length
                  ].id,
                )
              }
            >
              <SkipBack size={22} fill={"currentColor"} />
            </button>
            <button
              data-pause={true}
              className={"play-button"}
              onClick={toggleSession}
              disabled={session.starting}
              aria-label={
                session.playing
                  ? "Tạm dừng phiên thư giãn"
                  : "Phát phiên thư giãn"
              }
            >
              {session.playing ? (
                <Pause size={23} fill={"currentColor"} />
              ) : (
                <Play size={23} fill={"currentColor"} />
              )}
            </button>
            <button
              className={"skip-button sleep-hide"}
              aria-label={"Âm thanh tiếp theo"}
              onClick={() =>
                session.setSound(
                  sounds[
                    (sounds.findIndex((x) => x.id === session.sound) + 1) %
                      sounds.length
                  ].id,
                )
              }
            >
              <SkipForward size={22} fill={"currentColor"} />
            </button>
          </div>
          <div className={"volume-control sleep-hide"}>
            <button
              className={"icon-button"}
              aria-label={session.volume ? "Tắt tiếng" : "Bật tiếng"}
              onClick={() => session.setVolume(session.volume ? 0 : 0.45)}
            >
              {session.volume ? <Volume size={20} /> : <VolumeOff size={20} />}
            </button>
            <input
              aria-label={"Âm lượng"}
              type={"range"}
              min={"0"}
              max={"1"}
              step={"0.01"}
              value={session.volume}
              onChange={(x) => session.setVolume(Number(x.target.value))}
              style={
                {
                  "--volume": `${session.volume * 100}%`,
                } as React.CSSProperties
              }
            />
          </div>
          <button
            className={"timer-control sleep-hide"}
            onClick={() => setPanel("timer")}
            aria-label={`Hẹn giờ: ${session.duration ? session.duration + " phút" : "không giới hạn"}`}
          >
            <Timer size={20} />
            <span>
              <span className={"timer-name"}>{"HẸN GIỜ NGHỈ"}</span>
              <span className={"timer-value"}>
                {session.playing || count || session.ended
                  ? timerLabel
                  : session.duration
                    ? `${session.duration} phút`
                    : "Không giới hạn"}
              </span>
            </span>
            <ChevronDown size={14} />
          </button>
          <button
            className={"library-button sleep-hide"}
            onClick={() => setPanel("library")}
            aria-label={"Mở thư viện âm thanh"}
          >
            <Music size={19} />
          </button>
        </section>
        <footer className={"footer sleep-hide"}>
          <span>
            <Move size={13} />
            {sceneReady
              ? "Kéo để ngắm nhìn · Cuộn để gần hơn"
              : "Một khoảng lặng, theo cách của bạn"}
          </span>
          <button onClick={() => setPanel("about")}>
            {"Một chút bình yên, mỗi đêm "}
            <Info size={13} />
          </button>
        </footer>
      </div>
    </>
  );
}
