import type { ReactNode } from "react";
import { SoundPicker } from "./SoundPicker";
import { TimerControls } from "./TimerControls";
import { Dialog } from "../ui/Dialog";
import {
  Leaf,
} from "../ui/icons";
import type { ControlsProps } from "./types";
/** Touch dialogs. Desktop uses nonmodal panels beside the playbar. */
export function SessionPanels({
  closePanel,
  panel,
  session,
  favorites,
  feedback,
}: Pick<
  ControlsProps,
  | "closePanel"
  | "immersion"
  | "panel"
  | "session"
  | "toggleSession"
> & { favorites: ReactNode; feedback: ReactNode }) {
  return (
    <>
      {panel === "library" && <Dialog title="Âm thanh" close={closePanel}><SoundPicker session={session} close={closePanel} /></Dialog>}
      {panel === "timer" && <Dialog title="Hẹn giờ" close={closePanel}><TimerControls session={session} /></Dialog>}
      {panel === "favorites" && <Dialog title="Phiên yêu thích" close={closePanel}>{favorites}</Dialog>}
      {panel === "feedback" && <Dialog title="Góp ý" className="feedback-dialog" close={closePanel} compact>{feedback}</Dialog>}
      {panel === "about" && (
        <Dialog
          title={"Một góc nhỏ để trở về."}
          close={closePanel}
        >
          <p className={"about-copy"}>
            {
              "Êm là một khoảng lặng cuối ngày. Không mục tiêu, không cần đếm đủ bao nhiêu chú cừu. Chỉ có bạn, một cánh đồng và những âm thanh dịu nhẹ."
            }
          </p>
          <p className={"about-copy"}>
            {
              "Lựa chọn âm thanh và âm lượng được lưu trên thiết bị của bạn. Khi bạn bấm Gửi góp ý, Êm lưu chủ đề, nội dung và email nếu bạn cung cấp."
            }
          </p>
          <p className={"modal-note"}>
            {"Nghe khi khóa màn hình phụ thuộc trình duyệt và thiết bị."}
          </p>
          <button className={"modal-primary"} onClick={closePanel}>
            {"Trở về cánh đồng"}
            <Leaf size={17} />
          </button>
        </Dialog>
      )}
    </>
  );
}
