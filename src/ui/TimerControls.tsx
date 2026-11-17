import { useState } from "react";
import { formatRemaining } from "../session/config";
import type { RelaxationSession } from "../session/useRelaxationSession";
import { Check } from "./icons";
export function TimerControls({
  session
}: {
  session: RelaxationSession;
}) {
  const [custom, setCustom] = useState(""),
    [error, setError] = useState("");
  return <div className="timer-controls">
    <div className="timer-remaining"><span>Còn lại</span><strong>{session.remaining === null ? "Không giới hạn" : formatRemaining(session.remaining)}</strong></div>
    <div className="compact-timers">{([15, 30, 60, 0] as const).map(minutes => <button key={minutes} aria-pressed={session.duration === minutes} onClick={() => {
        session.changeDuration(minutes);
        setError("");
      }}><span>{minutes ? `${minutes} phút` : "Không giới hạn"}</span>{session.duration === minutes && <Check size={16} />}</button>)}</div>
    <form className="custom-timer" noValidate onSubmit={event => {
      event.preventDefault();
      const minutes = Number(custom);
      if (!custom.trim() || !Number.isInteger(minutes) || minutes < 1 || minutes > 720) {
        setError("Nhập số phút nguyên từ 1 đến 720.");
        return;
      }
      session.changeDuration(minutes);
      setError("");
    }}>
      <label htmlFor="custom-minutes">Số phút tùy chỉnh</label><div className="inline-fields"><input id="custom-minutes" type="number" inputMode="numeric" min="1" max="720" step="1" placeholder="1–720 phút" value={custom} aria-invalid={!!error} aria-describedby={error ? "timer-input-error" : undefined} onChange={e => setCustom(e.target.value)} /><button type="submit">Áp dụng</button></div>
      {error && <p id="timer-input-error" className="form-error" role="alert">{error}</p>}
    </form>
    <div className="timer-extend" aria-label="Kéo dài phiên"><button disabled={!session.canExtend(5)} onClick={() => session.extend(5)}>+5 phút</button><button disabled={!session.canExtend(10)} onClick={() => session.extend(10)}>+10 phút</button></div>
    <p className="popover-note">Chọn thời lượng sẽ bắt đầu lại đồng hồ. Cộng phút giữ nguyên thời gian đã nghe.</p>
    <fieldset className="fade-options" disabled={session.duration === 0}><legend>Kết thúc êm dần</legend><div className="choice-segments">{([15, 60, 180] as const).map(seconds => <button type="button" key={seconds} aria-pressed={session.fadeSeconds === seconds} onClick={() => session.changeFade(seconds)}>{seconds < 60 ? "15 giây" : `${seconds / 60} phút`}</button>)}</div></fieldset>
    <p className="popover-note">{session.duration === 0 ? "Không giới hạn: không tự giảm âm thanh hoặc làm tối." : session.effectiveFadeMs < session.fadeSeconds * 1000 ? `Phiên ngắn: âm thanh và cảnh giảm dần trong toàn bộ ${session.duration} phút.` : "Âm thanh nhỏ dần và cảnh tối dần cùng lúc. Điều khiển vẫn rõ."}</p>
  </div>;
}
