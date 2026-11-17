# Font và âm thanh — phiên bản 0.4.0

## Phạm vi

Mốc đối chiếu: `b8ad252`. Không đổi mô hình, mật độ thực vật, camera, đường chạy, giao diện tối giản hoặc quy tắc tự ẩn. Các ảnh và GLB hiện có được giữ nguyên.

Giao diện chức năng dùng Be Vietnam Pro 400/500 thay Georgia; wordmark Êm giữ kiểu cũ. Desktop: điều khiển 14 px, tiêu đề bảng 20 px, nội dung 14 px và số đếm 20 px. Kích thước giao diện cảm ứng giữ theo CSS hiện có. Sáu WOFF2 tiếng Việt/Latin mở rộng/Latin được lưu trong `public/assets/`, không tải font qua mạng. Phiên bản, nguồn và checksum nằm trong `src/assets/fonts.json`; giấy phép OFL 1.1 nằm ở `docs/licenses/be-vietnam-pro.txt` và thông báo bên thứ ba.

## Bộ âm thanh

- `src/audio/synthesis.ts`: DSP thuần, có seed để kiểm thử. Mưa dùng nhiều dải nhiễu và các hạt âm mềm; suối thiên về dải thấp/trung với biến thiên chậm; brown noise được lọc DC, hạn chế dải cao. Đây là âm thanh tổng hợp, không phải bản ghi ngoài thiên nhiên.
- Mỗi preset tạo 34 giây stereo, trong đó hai giây dùng để làm mượt đường nối bằng raised cosine. Phát lặp từ giây 2 đến 34, tương đương chu kỳ nghe 32 giây. Chuẩn hóa trên phần phát về khoảng −24 dBFS RMS, giữ peak từng kênh không quá −6 dBFS.
- `src/audio/SoundBank.ts`: một Blob Worker tổng hợp và chuyển quyền sở hữu hai mảng PCM. Chuyển sang AudioBuffer rồi thả mảng trung gian; cache tối đa ba preset. Worker không dùng file hoặc dịch vụ ngoài. Nếu Worker bị chặn hoặc lỗi, generator nhường luồng chính qua MessageChannel. Dispose hủy công việc, kết thúc Worker và thu hồi Blob URL.
- `src/audio/voice.ts`: mỗi bài có gain riêng; chuyển bài bằng đường cong equal-power 800 ms. Đổi nhanh trong khi đang fade tính lại từ mức gain hiện tại. Nguồn cũ dừng và được ngắt kết nối sau chuyển tiếp.
- `src/audio/AudioEngine.ts`: điều phối phát/tạm dừng, chuyển bài mới nhất, master gain và fade 15 giây cuối. `select()` bất đồng bộ; pause/dispose vô hiệu hóa yêu cầu cũ để dữ liệu về muộn không tự phát.
- `src/session/useRelaxationSession.ts`: thao tác phát mở AudioContext ngay trong tương tác người dùng, đợi bài sẵn sàng rồi mới bắt đầu deadline. Trong lúc chuẩn bị, dùng âm thanh/âm lượng/hẹn giờ được chọn mới nhất. Lỗi chuẩn bị hoặc đổi bài giữ phiên tạm dừng và hiện thông báo thử lại.

Hẹn giờ tiếp tục dựa vào `Date.now()`, không dựa vào AudioContext hoặc số khung hình. Âm thanh chỉ bắt đầu sau thao tác người dùng. Không thêm API hay lựa chọn mới.

## Kiểm tra

```sh
npm run build
npm test
npm run preview             # nếu chưa có preview tại localhost:4173
npm run verify:soak         # chạy riêng, 10 phút thời gian thật
npm run demo
npm run verify:offline
npm run verify:source
```

`verify:soak` cần preview đang chạy, tạo báo cáo nội bộ `artifacts/audio-soak.json`. Không chạy đồng thời với bài kiểm thử WebGL khác. Các kiểm thử font/audio mới bao gồm 44.1/48 kHz, RMS/peak/DC/đường nối, Worker so với generator, fallback, chuyển bài nhanh, pause/dispose khi đang tải, lựa chọn thay đổi khi khởi động, lỗi AudioBuffer, native equal-power, fade cuối giờ và deadline 30/60 phút khi đồng hồ thiết bị âm thanh khác đồng hồ phiên.

Font được kiểm tra ở 1366×768, 1440×900, 1920×1080 và DPR 1/1.25/1.5; Chromium xác nhận glyph tiếng Việt thực sự dùng font nhúng. Có ca chặn font để kiểm tra font dự phòng.

Phiên chạy ngày 17/11/2026 đạt 600.002 giây thời gian thực, đổi bài mỗi 30 giây, không có lỗi. Sau làm nóng: ba AudioBuffer, một voice hoạt động, không giữ voice đã fade; JS heap lấy mẫu khoảng 59.5–61.6 MB. Khi unmount: context đóng, cache và voice rỗng, không còn canvas/RAF. Đây là kiểm tra ổn định trên Chromium/SwiftShader, không xác nhận FPS trên HP PC hoặc chất lượng nghe bằng tai trên thiết bị thật.

AudioContext headless của môi trường này tiến chậm hơn đồng hồ thực: phiên 600 giây ghi khoảng 569.87 giây audio. Phép thử độc lập bằng native silent BufferSource cũng ghi 18.65 giây audio trong 20.01 giây thực. Báo cáo giữ riêng hai đồng hồ; không sửa đồng hồ ứng dụng để bù đặc tính thiết bị giả lập. Các kiểm thử deadline vẫn yêu cầu dừng đúng theo thời gian phiên.

HTML cuối nhúng mã, WOFF2, ảnh, GLB và source snapshot; không nhúng PCM dài vì tổng hợp tại máy người dùng. Bộ phục hồi nhận cả HTML cũ chưa có WOFF2 và bản mới. Kết quả đo chi tiết nằm trong thư mục `artifacts/` cục bộ; chỉ HTML cuối được bàn giao.
