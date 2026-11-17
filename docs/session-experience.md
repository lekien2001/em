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
