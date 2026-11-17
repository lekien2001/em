# Êm — Bản hoàn thiện chuyển động và vật liệu

Website thư giãn 3D chạy trên trình duyệt. Bản này được khôi phục từ HTML hai chuồng người dùng cung cấp, SHA-256 `bfd361e5294b94b54fd5f5ff30b802858066182b64ccbc224b9aee6e2cac8a1e`.

Repository lưu đầu vào để chỉnh sửa và build: `src/`, `public/assets/`, các script, cấu hình và kiểm thử. `dist/`, `artifacts/`, HTML bàn giao, bản HTML gốc và `node_modules/` được bỏ qua bởi Git.

Do chỉ còn HTML, cấu trúc component và tên biến TypeScript trước lần bundle cũ không thể khôi phục hoàn toàn. Runtime cũ đã được định dạng và tách tài nguyên trong `src/recovered-runtime.js`; nó vẫn chứa mã thư viện đã gộp từ bản cũ. Phần chỉnh mới nằm riêng trong `src/enhancements.ts`. Thư mục `recovered/` giữ dữ liệu tham chiếu phục vụ việc phục hồi và tái tạo runtime, không phải kết quả production build mới.

## Chạy và kiểm tra

Cần Node.js 22.12+ và npm. Mô hình/texture đã có trong `public/assets`, không cần tải ảnh hoặc API khác.

```sh
npm ci
npm run build
npm run preview
```

Preview tại `http://127.0.0.1:4173`. Giữ preview chạy và mở terminal thứ hai để kiểm thử. Kiểm thử dùng Chromium `/usr/bin/chromium` và SwiftShader:

```sh
npm test
npm run demo
```

HTML bàn giao: `artifacts/em-final.html`. Chỉ bàn giao một HTML, không ảnh/video nghiệm thu. Bản gốc tải lên được giữ riêng trong `baseline/` khi còn trong workspace.

## Phần được giữ và phần chỉnh mới

- React, giao diện tối giản, âm thanh, deadline hẹn giờ và bộ dựng Three.js gốc được giữ từ HTML; không viết lại giao diện hoặc tạo lại nhân vật.
- `src/recovered-runtime.js` là mã đã tách tài nguyên và định dạng lại. `scripts/patch-runtime.mjs` dùng AST, kiểm tra đúng một vị trí cho từng thay đổi; không eval hoặc thay chuỗi tùy tiện khi chạy web. Bản tham chiếu chưa sửa nằm trong `recovered/`.
- `src/enhancements.ts` chứa lớp hoạt ảnh phụ, IK chân theo quãng đường, khôi phục pose gốc để không tích lũy khi pause, cùng hiệu chỉnh vật liệu.
- Chuồng số 2 dùng cao độ -0.15, bằng vùng hàng rào. Gò Gaussian cục bộ được gỡ; sàn, cỏ/hoa/đá, bờ và mặt nước cùng lấy cao độ mới. Các lớp đồi xa, vị trí ngang và camera giữ nguyên.
- `scripts/derive-rig.mjs` giữ nguyên geometry/texture/bốn clip và 11 xương gốc; chỉ bổ sung hai xương tai cùng trọng số trên đúng 1.388 đỉnh tai. GLB gốc giữ nguyên SHA-256, không tái tạo hình dáng cừu.
- Giữ 144.171 cụm cỏ, 639 bụi hoa, ba cừu, nhịp 18/12 giây và khoảng cách 6/4 giây. Mật độ thực vật không tự giảm trên desktop.

## HTML tự chứa bản nguồn phục hồi

HTML mới có một khối `em-project-source` dạng JSON/gzip, không thực thi và không ảnh hưởng điều khiển. Khối này lưu mã nguồn, cấu hình và hướng dẫn; tài nguyên đã nhúng được tham chiếu theo SHA-256. Mô hình gốc có thể khôi phục chính xác từ phần BIN giữ nguyên trong GLB dẫn xuất.

```sh
node scripts/restore-project.mjs artifacts/em-final.html /tmp/em-restored
```

Không cần thêm một ZIP bàn giao. Lần sau chỉ có HTML vẫn có thể lấy lại bộ dự án trước khi chỉnh tiếp. Bộ phục hồi chỉ ghi tệp trong thư mục đích và không tự chạy npm hoặc mã trong archive.

Thông tin kiểm chứng ở `docs/verification.md`. Các giấy phép thư viện gốc được giữ trong `THIRD_PARTY_NOTICES.txt` và trong HTML đóng gói.
