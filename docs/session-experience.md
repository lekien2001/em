# Phiên thư giãn 0.7.0

## Cách dùng

Thanh desktop vẫn có năm nút. **Âm thanh → Chọn nhanh** chuyển sang một nguồn; **Trộn** bật/tắt mưa, suối và brown noise, chỉnh từng mức 1–100%. Giữ ít nhất một nguồn; tắt nguồn giữ lại mức cũ. Âm lượng tổng/mute tác động cả bản phối. Chuyển tab không đổi âm thanh.

**Hẹn giờ** có 15/30/60 phút, không giới hạn và số phút nguyên 1–720. Chọn thời lượng đặt lại đồng hồ, giữ trạng thái phát/tạm dừng; bảng vẫn mở. Sau khi đã bắt đầu, cộng 5/10 phút giữ phần đã nghe, tăng cả thời lượng cấu hình và thời gian còn lại; không vượt tổng 720 phút. Không cộng khi chưa bắt đầu, đang chuẩn bị, đã kết thúc hoặc không giới hạn.

**Kết thúc êm dần** chọn 15 giây, 1 phút hoặc 3 phút, mặc định 15 giây. Cửa sổ thực bằng min(lựa chọn, toàn phiên). Âm lượng và cảnh dùng cùng hệ số; cảnh tối tối đa 70%, điều khiển nằm ngoài lớp tối. Pause giữ hệ số và thời gian; khi đang phát mà cộng phút/đổi thời lượng/đổi fade, hồi tới đường fade mới trong tối đa 1,5 giây. Không giới hạn tắt auto fade. Mute không ảnh hưởng độ tối. Hết giờ dừng phiên; chuột/phím đánh thức giao diện và cảnh.

**⋯ → Cá nhân hóa → Phiên yêu thích** lưu tối đa 10 cấu hình có tên riêng (1–40 ký tự, trim, không trùng khi bỏ qua hoa/thường). Có áp dụng, cập nhật theo cấu hình hiện tại, đổi tên, xóa có xác nhận tại chỗ. Áp dụng tạm dừng và hủy chuẩn bị âm thanh, đặt lại đồng hồ/cừu/số đếm; giữ camera và ảnh mặt. Không tự phát. Cấu hình gồm bản phối, volume/mute/mức trước mute, tổng thời lượng, fade, tốc độ, số đếm, giảm chuyển động. Không lưu ảnh, góc camera, thời gian còn lại hoặc chế độ làm tối thủ công.

Dữ liệu ở localStorage, không tải lên mạng. Khi chặn lưu, thông báo ghi rõ chỉ giữ trong lần mở trang. Reload luôn tạm dừng và mặc định 30 phút; khôi phục mix/volume/fade mới nhất, không tự áp dụng phiên yêu thích. Di chuyển từ khóa sound/volume cũ được hỗ trợ. Nội dung mixer/timer dùng chung với dialog cảm ứng, không thiết kế lại mobile.

## Cấu trúc và giới hạn tài nguyên

- `SessionTimer` là mô hình deadline kiểm thử được với đồng hồ truyền vào. Hook điều phối React, thao tác audio và hủy yêu cầu async. Deadline dùng Date.now; kiểm tra 250 ms và khi đổi visibility. Web Audio tự lập lịch fade chính xác; DOM cập nhật cùng hệ số theo nhịp đồng hồ.
- Engine dùng tối đa ba loop voices, mỗi nguồn duy nhất, ba buffer và Worker tạo âm thanh dùng chung. Không tạo source mới khi đổi mức hoặc quay lại nguồn đã chuẩn bị. Các nguồn đã tắt giữ loop gain 0 để tránh tích lũy voice. Pause suspend context; dispose dừng/disconnect toàn bộ và hủy Worker.
- Gain kênh chuẩn hóa bằng g/max(1,sqrt(sum(g²))). Chuyển nhanh equal-power 800 ms, chuẩn hóa cả điểm trung gian; thay mức/mix 150 ms. DSP mỗi nguồn peak <= .5, tổng peak chặn trên .5*sqrt(3) ≈ -1,25 dBFS. Gain âm lượng, fade và pause tách riêng.
- Yêu cầu mix cuối cùng thắng. Chuẩn bị live thất bại trả UI về bản phối đã commit, phiên vẫn chạy. Lỗi khởi động giữ tạm dừng. Áp dụng favorite hoặc unmount hủy thao tác đang chờ; resume cũ không ghi đè resume mới.
- Phiên yêu thích có schema version 1, kiểm tra dữ liệu và tên trước sử dụng; không deserialize mã. Tài nguyên ảnh, GLB, camera, chuyển động hiện có giữ nguyên.

## Kiểm tra

Các kiểm tra mới nằm trong session-model, session-features và audio: deadline/pause/recovery/giới hạn/custom, mức gain tại đầu/cuối/chuyển pha, ba nguồn native OfflineAudioContext, CRUD/lưu lỗi/hủy khởi động/rollback tải lỗi, ba kích thước desktop và touch cơ bản. Chạy thêm toàn bộ kiểm thử cũ về mô hình, khuôn mặt, tài nguyên, font, tự ẩn và camera.

Lệnh: `npm run build`, `npm test`, `npm run verify:soak`, `npm run demo`, `npm run verify:offline`, `npm run verify:source`. Soak dùng 10 phút đồng hồ thật, một cảnh WebGL, đổi qua lại nguồn đơn/bản phối ba nguồn, theo dõi cache, voices, bộ nhớ, deadline, rồi pause/dispose. SwiftShader chỉ xác nhận hành vi và độ ổn định môi trường cloud, không xác nhận FPS hoặc chất lượng nghe trên thiết bị người dùng.

## Kết quả kiểm tra bản bàn giao

- TypeScript strict và production build đạt. Toàn bộ 84 ca hồi quy đạt; 42 ca liên quan trên bản cập nhật tiếp theo đạt (gồm ba ca bổ sung). Sau bổ sung resync fade, 20 ca audio/deadline/model đạt, gồm ca mới kiểm tra native gain khi Date.now lệch AudioContext.currentTime. Tổng cộng 88 ca riêng biệt đã được chạy đạt.
- Cài sạch từ git archive và khôi phục từ HTML đều build được; JS đối chiếu bằng SHA-256. Bản HTML chứa 40 tài nguyên và bản sao nguồn có thể khôi phục; bản gốc GLB được bảo toàn.
- Soak: 600,002 giây đồng hồ thật, 20 mẫu, một cảnh WebGL, đổi qua nguồn đơn và ba nguồn. Không có lỗi; luôn ba voices/ba buffer, pending 0. Heap 56,4–92,0 MiB (cao nhất lúc khởi tạo, sau warmup khoảng 56–59 MiB). Kết thúc: AudioContext closed, voices 0, bank null. Đồng hồ còn lại lệch khoảng 1 ms so với thời gian đã đo ở lần đọc cuối.
- Cảnh giữ nguyên: 144.171 cụm cỏ, 639 cụm hoa; mẫu cuối khoảng 2,11 triệu tam giác/235 lượt vẽ, 161 geometry/33 texture; một lần bake bóng tĩnh. SwiftShader render rất chậm, đồng thời có kiểm tra offline trên cloud nên không dùng số đo này xác nhận FPS máy thật.
- AudioContext headless chậm hơn wall clock khoảng 58 giây trong 10 phút. Đã thêm resync ở cửa sổ fade cuối và kiểm tra trực tiếp native AudioParam bằng ca clock lệch; không thay đổi đồng hồ thiết bị. Soak hoàn tất trước bổ sung guard này; guard không kích hoạt trong 10 phút đầu của cấu hình 30 phút đã thử.
- Chromium quản lý chặn URL file:// bằng ERR_BLOCKED_BY_ADMINISTRATOR. Không thay đổi chính sách. Kiểm tra offline dùng HTML nhúng trực tiếp, fallback không Worker/WebGL và origin localhost được intercept khi mạng tắt để kiểm tra lưu/reload; mở file:// trực tiếp vẫn cần xác nhận ngoài môi trường cloud này.
