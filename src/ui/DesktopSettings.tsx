import type { Dispatch, SetStateAction } from "react";
import type { SheepSpeed } from "../types";
import { Moon, ResetCamera } from "./icons";
function SettingSwitch({
  label,
  checked,
  change
}: {
  label: string;
  checked: boolean;
  change(): void;
}) {
  return <button className="setting-row setting-toggle" role="switch" aria-label={label} aria-checked={checked} onClick={change}>
    <span>{label}</span><span className="setting-switch" aria-hidden="true"><span /></span>
  </button>;
}
export function DesktopSettings({
  speed,
  setSpeed,
  reduced,
  setReduced,
  showCount,
  setShowCount,
  reset,
  sceneReady,
  dim,
  openFace,
  faceApplied
}: {
  speed: SheepSpeed;
  setSpeed: Dispatch<SetStateAction<SheepSpeed>>;
  reduced: boolean;
  setReduced: Dispatch<SetStateAction<boolean>>;
  showCount: boolean;
  setShowCount: Dispatch<SetStateAction<boolean>>;
  reset(): void;
  sceneReady: boolean;
  dim(): void;
  openFace(): void;
  faceApplied: boolean;
}) {
  return <div className="desktop-settings">
    <section aria-label="Cảnh"><h3>Cảnh</h3>
      <div className="setting-row setting-speed"><span>Tốc độ cừu</span><div className="speed-segments" role="radiogroup" aria-label="Tốc độ cừu">
        {([['slow', 'Chậm'], ['medium', 'Vừa']] as const).map(([value, label]) => <label key={value}>
          <input type="radio" name="desktop-sheep-speed" value={value} checked={(reduced ? "slow" : speed) === value} disabled={reduced} onChange={() => setSpeed(value)} data-initial-focus={(reduced ? "slow" : speed) === value} /><span>{label}</span>
        </label>)}
      </div></div>
      {reduced && <p className="setting-help">Cố định ở Chậm khi giảm chuyển động.</p>}
      <SettingSwitch label="Hiện số đếm" checked={showCount} change={() => setShowCount(x => !x)} />
      <button className="setting-row setting-action" onClick={reset} disabled={!sceneReady}><span>Về góc ban đầu</span><ResetCamera size={17} /></button>
    </section>
    <section aria-label="Thư giãn"><h3>Thư giãn</h3>
      <SettingSwitch label="Giảm chuyển động" checked={reduced} change={() => setReduced(x => !x)} />
      <button className="setting-row setting-action" onClick={dim}><span>Làm tối cảnh</span><Moon size={17} /></button>
    </section>
    <section aria-label="Cá nhân hóa"><h3>Cá nhân hóa</h3>
      <button className="setting-row setting-face" aria-label="Mặt cừu của bạn" onClick={openFace}>
        <span><span>Mặt cừu của bạn</span><small>{faceApplied ? "Đã thêm ảnh" : "Chưa chọn ảnh"}</small></span><span aria-hidden="true" className="setting-chevron">›</span>
      </button>
    </section>
  </div>;
}
