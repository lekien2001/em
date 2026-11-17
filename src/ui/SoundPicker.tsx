import { useState } from "react";
import { sounds } from "../audio/catalog";
import { copyMix } from "../session/config";
import type { RelaxationSession } from "../session/useRelaxationSession";
import { Check } from "./icons";
export function SoundPicker({
  session,
  close
}: {
  session: RelaxationSession;
  close(): void;
}) {
  const [tab, setTab] = useState<"quick" | "mix">(session.activeSounds.length > 1 ? "mix" : "quick");
  return <div className="sound-picker">
    <div className="panel-tabs" role="tablist" aria-label="Cách chọn âm thanh">{([["quick", "Chọn nhanh"], ["mix", "Trộn"]] as const).map(([value, label]) => <button key={value} role="tab" id={`sound-tab-${value}`} aria-selected={tab === value} aria-controls={`sound-content-${value}`} tabIndex={tab === value ? 0 : -1} onClick={() => setTab(value)} onKeyDown={e => {
        if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
          e.preventDefault();
          const next = e.key === "Home" ? "quick" : e.key === "End" ? "mix" : tab === "quick" ? "mix" : "quick";
          setTab(next);
          document.getElementById(`sound-tab-${next}`)?.focus();
        }
      }}>{label}</button>)}</div>
    <div role="tabpanel" id={`sound-content-${tab}`} aria-labelledby={`sound-tab-${tab}`}>
    {tab === "quick" ? <div className="compact-sounds">{sounds.map(sound => {
          const selected = session.activeSounds.length === 1 && session.sound === sound.id;
          return <button key={sound.id} className="compact-sound" aria-pressed={selected} onClick={() => {
            session.setSound(sound.id);
            close();
          }}><span className={`sound-art ${sound.art}`} aria-hidden="true" /><span className="sound-label">{sound.label}</span><span className="compact-check">{selected && <Check size={17} />}</span></button>;
        })}</div> : <div className="mix-rows">{sounds.map(sound => {
          const channel = session.mix[sound.id],
            only = channel.enabled && session.activeSounds.length === 1;
          return <div className="mix-row" key={sound.id}>
        <button role="switch" className="setting-row setting-toggle" aria-label={sound.label} aria-checked={channel.enabled} disabled={only} title={only ? "Giữ ít nhất một âm thanh trong bản phối" : undefined} onClick={() => {
              const next = copyMix(session.mix);
              next[sound.id].enabled = !channel.enabled;
              session.setMix(next);
            }}><span>{sound.label}</span><span className="setting-switch" aria-hidden="true"><span /></span></button>
        <div className="mix-level"><input type="range" min="0.01" max="1" step="0.01" aria-label={`Mức ${sound.label.toLocaleLowerCase("vi")}`} aria-valuetext={`${Math.round(channel.level * 100)}%`} value={channel.level} disabled={!channel.enabled} onChange={event => {
                const next = copyMix(session.mix);
                next[sound.id].level = Number(event.target.value);
                session.setMix(next);
              }} /><output>{Math.round(channel.level * 100)}%</output></div>
      </div>;
        })}<p className="popover-note">Giữ ít nhất một âm thanh. Âm lượng tổng điều chỉnh toàn bộ bản phối.</p></div>}
    </div>
    {session.mixError && <p className="form-error" role="alert">{session.mixError}</p>}
  </div>;
}
