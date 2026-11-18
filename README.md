# Êm

Website thư giãn 3D trên trình duyệt: cừu ra/vào chuồng, nhảy rào, thảm cỏ vải nỉ, ba âm thanh tổng hợp và hẹn giờ. Chạy hoàn toàn ở máy người dùng, không cần tài khoản, API hoặc máy chủ ứng dụng.

## Cài đặt và chạy

Cần Node.js 22.12+ và npm.

```sh
npm ci
npm run build
npm run preview
```

Mở `http://localhost:4173`. Sau khi chỉnh mã, chạy lại `npm run build`; preview đọc bản build mới. Toàn bộ ảnh và mô hình có trong `public/assets/`.

## Kiểm thử và xuất HTML

```sh
npm test
npm run demo
npm run verify:offline
npm run verify:source
```

Giao diện dùng Be Vietnam Pro nhúng sẵn, hỗ trợ tiếng Việt khi offline. Ba âm thanh tổng hợp được chuẩn bị trong Worker, chuyển bài bằng fade 800 ms; không cần tải file âm thanh. Kiến trúc, giấy phép và kiểm chứng phiên bản 0.4.0 ở [docs/font-audio.md](docs/font-audio.md). Có thể chạy `npm run verify:soak` khi preview đang mở để kiểm tra riêng một phiên 10 phút bằng đồng hồ thật.

Từ phiên bản 0.5.0, mở **⋯ → Mặt cừu của bạn** để chọn ảnh, căn mặt thủ công và gắn lên cả ba cừu. Ảnh chỉ được xử lý trong trình duyệt và không giữ lại sau khi tải lại trang. Cách sử dụng, cấu trúc mã, thông số model và giới hạn kiểm thử ở [docs/personal-face.md](docs/personal-face.md).

Phiên bản 0.6.0 thiết kế lại settings desktop theo từng hàng, dùng radio Chậm/Vừa và công tắc trạng thái. Bảng nhỏ nằm gần thanh phát, vẫn cho Play/Pause; mute khôi phục đúng mức âm lượng cũ, kể cả sau reload. Chi tiết hành vi, cấu trúc và kiểm tra ở [docs/desktop-controls.md](docs/desktop-controls.md).

Phiên bản 0.7.0 thêm **Âm thanh → Trộn**, hẹn giờ tùy chỉnh 1–720 phút, cộng 5/10 phút, kết thúc êm dần 15/60/180 giây và **⋯ → Phiên yêu thích**. Âm thanh và cảnh cùng giảm dần; phiên yêu thích lưu cấu hình trên trình duyệt, áp dụng ở trạng thái tạm dừng. Chi tiết tại [docs/session-experience.md](docs/session-experience.md).

Phiên bản 0.7.1 chuẩn hóa focus, kích thước và căn chỉnh điều khiển desktop; thẻ phiên yêu thích có bố cục đổi tên/xác nhận xóa riêng và trả focus đúng sau thao tác. Chi tiết tại [docs/control-polish.md](docs/control-polish.md).

Playwright tự khởi động build/preview khi chưa có preview đang chạy. Trên môi trường có Chromium ở `/usr/bin/chromium`, kiểm thử dùng trình duyệt đó; nơi khác chạy `npx playwright install chromium` trước. Có thể chỉ định trình duyệt bằng `CHROMIUM_PATH`. Các kiểm thử WebGL dùng SwiftShader để chạy ổn định trong cloud, không xác nhận FPS GPU máy thật.

`npm run demo` tạo **`artifacts/em-final.html`** nhúng toàn bộ mã, ảnh, GLB và âm thanh tổng hợp, mở độc lập khi không có mạng. Script kiểm tra offline và phục hồi nguồn cần Chromium hệ thống như môi trường cloud.

## Mã nguồn

Ứng dụng hiện build trực tiếp từ TS/TSX có TypeScript strict. React/React DOM 19.3.1 và Three.js 0.181.0 được lấy từ npm, khóa bằng `package-lock.json`; không nạp runtime hoặc thư viện được phục hồi từ bundle cũ.

- `src/app/`, `src/ui/`: điều phối App, thanh điều khiển, bảng nổi, giao diện cảm ứng, focus và tự ẩn.
- `src/session/`, `src/audio/`: phiên, deadline hẹn giờ, lưu lựa chọn và bộ phát Web Audio độc lập với cảnh.
- `src/scene/`: bộ dựng cảnh, camera, địa hình, cây/cỏ/hoa, chuồng, bóng, đồng hồ và hoạt ảnh cừu.
- `src/assets/`: danh mục, bộ tải có cache và giải phóng tài nguyên dùng chung theo định danh đối tượng.
- `scripts/`: build, preview, đóng gói, phục hồi nguồn, kiểm tra offline và công cụ QA.

Các lệnh build không sinh lại mã nguồn, không cần Blender hoặc các script phục hồi. Mô hình đã tối ưu được giữ nguyên; chỉ chạy `scripts/derive-rig.mjs` khi chủ động cần tái xuất dẫn xuất tai từ mô hình gốc.

## Mốc đối chiếu và nguồn phục hồi

Mốc trước refactor là commit `e1fff41`; cấu trúc component nguyên bản đã mất khi chỉ còn HTML. Các module hiện tại được tái cấu trúc theo hành vi đã đối chiếu, không phải mã TypeScript gốc được lấy lại nguyên văn.

`recovered/` giữ bản tham chiếu và nhật ký chuyển mã; thư mục này **không nằm trong đồ thị production build**. Script trong `recovered/migration/` là hồ sơ các bước trung gian, không chạy lại trên nguồn hiện tại.

HTML bàn giao tiếp tục chứa bản sao nguồn nén, bao gồm TSX. Để phục hồi vào một thư mục trống:

```sh
node scripts/restore-project.mjs artifacts/em-final.html /tmp/em-restored
```

Bộ phục hồi kiểm tra SHA-256, ghi nguồn và tài nguyên nhưng không tự thực thi mã hoặc cài dependency. `npm run verify:source` đối chiếu từng file bằng checksum, gồm mô hình cừu gốc được phục hồi chính xác.

Cấu trúc và kiểm chứng mới ở [docs/modularization.md](docs/modularization.md). Số đo trước refactor ở [docs/verification.md](docs/verification.md). Giấy phép thư viện/biểu tượng được giữ trong `THIRD_PARTY_NOTICES.txt` và HTML xuất ra.

Git lưu nguồn, tài nguyên, cấu hình và kiểm thử; bỏ qua `node_modules/`, `dist/`, `artifacts/`, bản HTML đối chiếu trong `baseline/` và báo cáo kiểm thử.
