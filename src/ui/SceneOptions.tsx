import type { SheepSpeed } from "../types";
import { Eye, EyeOff, Leaf, ResetCamera } from "../ui/icons";
import type { ControlsProps } from "./types";
export function SceneOptions({
  immersion,
  reduced,
  sceneReady,
  setReduced,
  setReset,
  setShowCount,
  setSpeed,
  setPanel,
  showCount,
  speed,
}: Pick<
  ControlsProps,
  | "immersion"
  | "reduced"
  | "sceneReady"
  | "setReduced"
  | "setReset"
  | "setShowCount"
  | "setSpeed"
  | "setPanel"
  | "showCount"
  | "speed"
>) {
  return (
    <div className={"scene-toolbar sleep-hide"}>
      <div className={"camera-reset"}>
        <button
          className={"reset-view"}
          aria-label={"Về góc ban đầu"}
          title={"Về góc ban đầu"}
          disabled={!sceneReady}
          onClick={() => {
            setReset((x) => x + 1);
          }}
        >
          <ResetCamera size={15} />
          <span>{"Về góc ban đầu"}</span>
        </button>
      </div>
      <div className={"scene-options"}>
        <button className="small-option favorites-open" aria-label="Phiên yêu thích" title="Phiên yêu thích" onClick={() => setPanel("favorites")}><span aria-hidden="true">♡</span><span>Phiên yêu thích</span></button>
        <button className="small-option face-open" aria-label="Mặt cừu của bạn" title="Mặt cừu của bạn" onClick={() => setPanel("face")}><span aria-hidden="true">☺</span><span>Mặt cừu của bạn</span></button>
        <label className={"speed-control"}>
          <span>{"Tốc độ:"}</span>
          <select
            aria-label={"Tốc độ cừu"}
            value={speed}
            onChange={(x) => setSpeed(x.target.value as SheepSpeed)}
          >
            <option value={"slow"}>{"Chậm"}</option>
            <option value={"medium"}>{"Vừa"}</option>
          </select>
        </label>
        <button
          className={"small-option count-toggle"}
          onClick={() => setShowCount((x) => !x)}
          aria-pressed={showCount}
          aria-label={showCount ? "Ẩn số đếm" : "Hiện số đếm"}
          title={showCount ? "Ẩn số đếm" : "Hiện số đếm"}
        >
          {showCount ? <Eye size={17} /> : <EyeOff size={17} />}
          <span>{showCount ? "Ẩn số đếm" : "Hiện số đếm"}</span>
        </button>
        <button
          className={"small-option"}
          onClick={() => setReduced((x) => !x)}
          aria-pressed={reduced}
          aria-label={"Giảm chuyển động"}
          title={"Giảm chuyển động"}
        >
          <Leaf size={17} />
          {immersion.desktop && <span>{"Giảm chuyển động"}</span>}
        </button>
      </div>
    </div>
  );
}
