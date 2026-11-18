# Chuẩn hóa điều khiển desktop 0.7.1

## Kích thước và căn chỉnh

- Năm nút playbar cao 44 px. Play, volume và tùy chọn rộng 44 px; âm thanh 140 px; timer 120 px. Thanh có đệm 8 px và gap 4 px, giữ nguyên kích thước khi đổi tên âm thanh hoặc định dạng thời gian.
- Tên âm thanh và nhãn thời lượng căn giữa; mũi tên/dấu chọn đặt riêng, không làm dịch chữ. Các khung chọn nhóm có đệm 3 px, vùng bấm bên trong cao 44 px.
- Form một hành động dùng cột linh hoạt + nút 80 px; ô nhập và nút cùng cao 44 px. Ô số giữ nguyên semantics spinbutton và phím lên/xuống, ẩn spinner Chrome mặc định.
- Settings và mixer dùng cột điều khiển cuối rộng 40 px. Công tắc, icon, mũi tên SVG nằm giữa cột. Thanh trượt bỏ margin trình duyệt, vùng thao tác cao 44 px, phần trăm có cột cố định.
- Bốn thao tác thường của favorite chia bốn cột đều nhau. Đổi tên dùng input trọn hàng và hai nút bằng nhau phía dưới. Đổi tên/xác nhận xóa thay nhóm thao tác thường của thẻ đó. Các phiên khác giữ nguyên.

## Focus và trạng thái

Thông số chung trong `src/style.css`: control-height 44 px, control-radius 12 px, focus-width 2 px, focus-offset 2 px và action-width 80 px. Ô nhập có vòng focus sát mép 2 px, không cộng halo 14 px như trước. Chế độ forced colors dùng outline hệ thống để giữ focus khi box-shadow bị tắt.

Radio tốc độ đặt viền trên phần hiển thị thay cho input trong suốt. Canvas crop dùng cùng khoảng focus. Các hàng văn bản/nhãn vẫn theo trục đọc; nội dung thao tác và biểu tượng được căn giữa trong vùng riêng.

Favorite trả focus sau DOM commit: lưu/hủy đổi tên về nút Đổi tên; mở xác nhận xóa ưu tiên Hủy; hủy xóa về nút Xóa; xóa thành công sang thẻ tiếp theo/trước đó hoặc ô tạo phiên khi danh sách trống. Không phụ thuộc requestAnimationFrame hoặc tên do người dùng đặt.

Thay đổi nằm ở CSS, markup Settings/mixer và trạng thái trình bày của favorite; hợp đồng Scene, camera, âm thanh, dữ liệu lưu và đồng hồ giữ nguyên. Desktop là ưu tiên; nội dung dùng chung vẫn kiểm tra cảm ứng cơ bản.

## Kiểm tra

`tests/control-polish.spec.ts` kiểm tra ba kích thước desktop × ba DPR, tâm chữ/biểu tượng, chiều cao và độ rộng cố định, vòng focus/forced colors, phím tăng số, báo lỗi, nhãn dài và focus sau đổi tên/xóa. Các suite desktop-controls, session-features và fonts kiểm tra lại hành vi liên quan. Chạy thêm UI tự ẩn/play-pause, production build, HTML offline và phục hồi nguồn chính xác.

Ảnh so sánh chỉ lưu trong /tmp để rà soát nội bộ. HTML trước thay đổi giữ ở baseline/em-before-control-polish.html; bản bàn giao duy nhất là artifacts/em-final.html. Môi trường Chromium quản lý có thể chặn file://; kiểm tra offline hiện có ghi rõ giới hạn này và kiểm tra persistence bằng origin localhost intercept khi mạng tắt.

## Kết quả kiểm tra

- TypeScript strict và production build đạt. 44 ca giao diện/phiên/font đạt; 11 ca bổ sung về tự ẩn, bàn phím, lỗi, hộp ảnh và crop cảm ứng đạt (hai ca lặp lại), tổng 53 ca riêng biệt liên quan.
- Chín tổ hợp desktop/DPR đạt các tiêu chí: tâm nhãn và icon sai lệch tối đa 1 CSS px, năm nút cao 44 px, độ rộng thanh ổn định với bốn tên/mix và đồng hồ tới 12:00:00; không cuộn ngang hoặc bảng vượt viewport.
- Ô số giữ hoạt động phím ArrowUp, hiển thị lỗi khi nhập lẻ và có vòng focus 2 px sát mép. Forced colors giữ outline 2 px. Favorite kiểm tra đủ đổi tên/lưu/hủy/xóa, cân kích thước bốn nút, trạng thái thay thế và focus quay về đúng chỗ.
- Bản đóng gói được kiểm tra thêm bằng script offline: kích thước playbar, tâm tên âm thanh, focus ô số, các trạng thái đổi tên/xác nhận xóa, giữ camera/ảnh mặt khi áp dụng preset, lưu/reload với mạng tắt và fallback Worker/WebGL.
