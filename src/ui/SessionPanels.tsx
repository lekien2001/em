import { sounds } from "../audio/catalog";
import { Dialog } from "../ui/Dialog";
import {
  ArrowUpRight,
  Check,
  Headphones,
  Leaf,
  Timer,
} from "../ui/icons";
import type { ControlsProps } from "./types";
/** Touch dialogs. Desktop uses nonmodal panels beside the playbar. */
export function SessionPanels({
  closePanel,
  immersion,
  panel,
  session,
  toggleSession,
}: Pick<
  ControlsProps,
  | "closePanel"
  | "immersion"
  | "panel"
  | "session"
  | "toggleSession"
>) {
  return (
    <>
      {panel === "library" && (
        <Dialog
          title={immersion.desktop ? "Âm thanh" : "Bạn muốn nghe gì tối nay?"}
          close={closePanel}
          compact={immersion.desktop}
        >
          {!immersion.desktop && (
            <p className={"modal-description"}>
              {"Chọn một âm thanh. Để mọi thứ khác chậm lại."}
            </p>
          )}
          <div className={"sound-list"}>
            {sounds.map((x) => (
              <button
                className={`sound-card ${session.sound === x.id ? "selected" : ""}`}
                aria-pressed={session.sound === x.id}
                onClick={() => {
                  session.setSound(x.id);
                  immersion.desktop && closePanel();
                }}
                key={x.id}
              >
                <span className={`sound-art ${x.art}`} />
                <span className={"sound-card-text"}>
                  <span className={"sound-label"}>{x.label}</span>
                  <strong>{x.name}</strong>
                  {!immersion.desktop && <span>{x.description}</span>}
                </span>
                <span className={"sound-check"}>
                  {session.sound === x.id ? (
                    <Check size={19} />
                  ) : (
                    <Headphones size={19} />
                  )}
                </span>
              </button>
            ))}
          </div>
          {!immersion.desktop && (
            <p className={"modal-note"}>
              <Headphones size={14} />
              {"Âm thanh tự tạo · Không quảng cáo · Phát lặp liên tục"}
            </p>
          )}
          {!immersion.desktop && (
            <button
              className={"modal-primary"}
              onClick={() => {
                session.playing || toggleSession();
                closePanel();
              }}
            >
              {session.playing ? "Trở về không gian" : "Nghe và thư giãn"}
              <ArrowUpRight size={17} />
            </button>
          )}
        </Dialog>
      )}
      {panel === "timer" && (
        <Dialog
          title={immersion.desktop ? "Hẹn giờ" : "Đến giờ, mình cùng nghỉ."}
          close={closePanel}
          compact={immersion.desktop}
        >
          {!immersion.desktop && (
            <p className={"modal-description"}>
              {
                "Âm thanh sẽ nhỏ dần trong 15 giây cuối. Sau đó, cả cánh đồng cũng chìm vào giấc ngủ."
              }
            </p>
          )}
          <div className={"timer-options"}>
            {([15, 30, 60, 0] as const).map((x) => (
              <button
                aria-pressed={session.duration === x}
                onClick={() => {
                  session.changeDuration(x);
                  closePanel();
                }}
                key={x}
              >
                <Timer size={19} />
                <span>{x ? `${x} phút` : "Không giới hạn"}</span>
                {session.duration === x && <Check size={18} />}
              </button>
            ))}
          </div>
          <p className={"modal-note"}>
            {immersion.desktop
              ? "Âm thanh giảm dần trong 15 giây cuối."
              : "Thay đổi hẹn giờ sẽ bắt đầu một khoảng thời gian mới."}
          </p>
        </Dialog>
      )}
      {panel === "about" && (
        <Dialog
          title={"Một góc nhỏ để trở về."}
          close={closePanel}
          compact={immersion.desktop}
        >
          <p className={"about-copy"}>
            {
              "Êm là một khoảng lặng cuối ngày. Không mục tiêu, không cần đếm đủ bao nhiêu chú cừu. Chỉ có bạn, một cánh đồng và những âm thanh dịu nhẹ."
            }
          </p>
          <p className={"about-copy"}>
            {
              "Lựa chọn âm thanh và âm lượng chỉ được lưu trên thiết bị của bạn. Không cần tài khoản, không gửi dữ liệu lên máy chủ."
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
