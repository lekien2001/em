# Điều khiển desktop — 0.6.0

## Thay đổi giao diện

Thanh phát vẫn có năm điều khiển: Play/Pause, Âm thanh, Âm lượng, Hẹn giờ, Tùy chọn. Tên bài và thời gian có vùng rộng cố định; đồng hồ bắt đầu bằng `30:00`, không chuyển định dạng từ phút sang đồng hồ khi phát. Khi chuẩn bị âm thanh, nút phát hiển thị vòng chờ, nhãn truy cập và tooltip tương ứng. Giảm chuyển động tắt hoạt ảnh vòng chờ.

Settings được thiết kế thành từng hàng với ba nhóm:

- **Cảnh:** Tốc độ cừu, Hiện số đếm, Về góc ban đầu.
- **Thư giãn:** Giảm chuyển động, Làm tối cảnh.
- **Cá nhân hóa:** Mặt cừu của bạn, kèm trạng thái đã/chưa thêm ảnh.

Tốc độ dùng nhóm radio **Chậm / Vừa**; có thể Tab và dùng phím mũi tên. Khi giảm chuyển động, bộ chọn hiển thị Chậm, tạm khóa và giải thích lý do; lựa chọn tốc độ trước đó vẫn được giữ để phục hồi khi tắt giảm chuyển động. Hai mức tốc độ, camera, đếm và hoạt ảnh không thay đổi.

Công tắc Hiện số đếm và Giảm chuyển động dùng `role=switch`/`aria-checked` đúng trạng thái. Các hàng thao tác và công tắc có vùng bấm tối thiểu 44 px. Đặt lại camera và làm tối cảnh đóng bảng để xem kết quả; đặt lại bị khóa nếu cảnh chưa sẵn sàng. Trình chỉnh mặt giữ cửa sổ lớn hiện có.

## Bảng nổi và bàn phím

Các bảng desktop là dialog **không modal**, không có lớp phủ chặn cảnh hoặc thanh phát. Bấm trực tiếp nút khác để chuyển bảng, bấm lại nút đang mở để đóng. Có thể Play/Pause khi bảng mở. Click ngoài đóng bảng và tiếp tục thao tác bên ngoài; Escape đóng và trả focus về nút mở bảng. Tab không bị giữ trong bảng; di chuyển focus ra ngoài bảng và thanh phát sẽ đóng bảng mà không kéo focus trở lại.

Âm lượng là bảng nhỏ 280 px ngay trên nút loa, gồm mute, slider và phần trăm. Các bảng còn lại tối đa 340 px, ưu tiên bên phải thanh phát và căn đáy cùng thanh, cách 12 px; không đủ chỗ thì thử bên trái, cuối cùng phía trên. Luôn chừa mép màn hình 12 px và cuộn bên trong khi thiếu chiều cao. Kích thước/vị trí được tính lại khi resize hoặc nội dung thay đổi. Desktop bỏ min-height cũ của bố cục cảm ứng để thanh phát vẫn hiện ở cửa sổ thấp.

Giao diện giữ hiện khi mở bảng hoặc đang tương tác. Sau khi đóng và hết thao tác, áp dụng lại khoảng chờ 3 giây. Điều hướng bàn phím tiếp tục giữ điều khiển hiện theo cơ chế hiện có. Mở bảng không pause âm thanh hoặc đồng hồ phiên. Chuyển động xuất hiện 180 ms; thiết lập giảm chuyển động tắt hiệu ứng.

## Âm thanh, âm lượng và hẹn giờ

Thư viện desktop có ba hàng với thumbnail 36 px, một tên chính thống nhất với thanh phát và dấu chọn. Các tên thơ cũ vẫn trong danh mục và trải nghiệm cảm ứng; không thay nguồn âm thanh.

`toggleMute()` được bổ sung vào hook quản lý phiên, dùng chung cho desktop và cảm ứng. Giữ `em:volume`, thêm `em:last-volume` để nhớ mức lớn hơn 0 gần nhất. Giá trị volume hợp lệ hiện tại được ưu tiên khi chuyển từ bản cũ; khi đang mute, đọc last-volume hợp lệ trong khoảng (0,1], nếu không có thì dùng 0.45. Slider về 0 vẫn giữ mức trước đó. Storage bị chặn không làm mất khả năng mute/unmute trong RAM. Không sửa DSP, fade, cache hoặc AudioEngine.

Hẹn giờ hiển thị thời gian còn lại và giải thích việc chọn mốc bắt đầu lại thời gian. Giữ các lựa chọn 15/30/60 phút và không giới hạn; chọn lại cùng mốc cũng đặt lại. Phiên đang pause vẫn pause, phiên đang chạy tiếp tục chạy với deadline mới. Fade 15 giây cuối giữ nguyên.

## Các phần mã

- `src/ui/DesktopSettings.tsx`: nhóm cài đặt, radio tốc độ, switch và hàng hành động.
- `src/ui/DesktopPanels.tsx`: thư viện gọn, âm lượng, hẹn giờ và nội dung settings.
- `src/ui/AnchoredPanel.tsx`, `panelPlacement.ts`: vị trí, resize, focus, Escape, click ngoài và bàn phím; không phụ thuộc thư viện ngoài.
- Cập nhật App, Toolbar và kiểu UI để truyền ref thanh phát. SessionPanels giữ dialog cảm ứng; TouchControls chỉ thay lời gọi mute. SceneOptions cảm ứng sửa trạng thái pressed của số đếm.
- CSS điều khiển mới có namespace desktop/popover; không dựng lại cảnh, không thêm API, không thay model/ảnh hoặc chỉnh giới hạn camera.

## Kiểm thử và đóng gói

```sh
npm run build
npm test
npm run demo
npm run verify:offline
npm run verify:source
```

Kiểm tra desktop ở 1366×768, 1440×900, 1920×1080; cửa sổ 900×500/900×400; font ở DPR 1/1.25/1.5. Các ca mới xác nhận nhóm settings, radio bằng bàn phím, số đếm, giảm chuyển động và phục hồi tốc độ, Play/Pause xuyên suốt khi bảng mở, focus ban đầu/thoát/khôi phục, chuyển bảng một lần bấm, mute 72% qua reload, storage lỗi, thư viện một tên, đồng hồ có chiều rộng ổn định và vị trí bảng có cuộn khi cần.

Chạy hồi quy âm thanh, deadline, auto-hide, model và ghép mặt. Ảnh chụp chỉ dùng đối chiếu nội bộ; chỉ HTML cuối được bàn giao. Phiên bản trước giữ tại `baseline/em-before-desktop-controls.html` trong workspace, không đưa lên Git. Kiểm tra WebGL dùng Chromium/SwiftShader; không coi kết quả này là đo FPS GPU máy HP hoặc kiểm chứng thiết bị cảm ứng thật.

Kết quả: lượt đầy đủ 67 ca đạt; sau khi bổ sung kiểm tra trả focus từ trình chỉnh mặt, 11 ca desktop chạy lại đều đạt, tổng cộng 68 ca riêng biệt. Giao diện bốn bảng được đối chiếu với cảnh WebGL thật ở 1440×900, không có lỗi trình duyệt. Chiều rộng thanh phát 405 px; settings 340×497 px, âm lượng 280×74 px. Phép chiếu bảo thủ của toàn bộ cú nhảy ở ba màn hình nằm bên trái bảng settings, không giao nhau tại góc mặc định. Đây là kiểm chứng bố cục, không phải phép đo FPS.
