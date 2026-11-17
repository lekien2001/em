# Tách nguồn Êm 0.3

## Ranh giới và dữ liệu

App điều phối phiên và lựa chọn hiển thị. Thanh điều khiển, các bảng nổi, tùy chọn cảnh và giao diện cảm ứng nhận props đã định kiểu, không sở hữu bộ phát hoặc renderer.

Session quản lý `playing/starting`, bài/âm lượng, `duration/remaining/ended/error/fade`. Deadline dùng Date.now; âm thanh dùng AudioContext.currentTime; hoạt ảnh dùng SceneClock với performance.now và thời gian hoạt động không nhân tốc độ. Các đồng hồ phục vụ mục đích riêng, không làm chậm phiên để che rơi khung.

SceneView chỉ giữ DOM host và vòng đời bộ dựng. SceneRenderer đọc props mới qua getter, quản lý WebGL, OrbitControls, RAF, camera tween, độ phân giải và bảng số đo. World quản lý đối tượng cảnh và gọi pipeline cừu trực tiếp, không thay thế phương thức cập nhật bằng wrapper được tiêm lúc chạy.

SheepActor đánh giá clip, lưu/khôi phục pose nguồn trước lớp phụ; NaturalSheep áp dụng IK, đầu/tai/nhịp thở sau pose nền. PoseLayer là hợp đồng có kiểu, thay cho sửa phương thức actor tại runtime. Bốn clip, rig tai, đường đi và mốc đếm được giữ nguyên.

SceneProps tiếp tục gồm `playing`, `reduced`, `speed`, `reset`, `sessionId`, `onCount`, `onReady`. Reset camera và reset phiên vẫn là hai tín hiệu độc lập. Không có API mạng mới.

## Quyền sở hữu và tháo/lắp

AssetLoader sở hữu cache promise của ảnh/GLB. Các clone có thể dùng chung hình học/texture; actor sở hữu vật liệu và skeleton được clone. Bộ giải phóng dùng WeakSet để cùng tài nguyên chỉ được dispose một lần qua các đường tháo/lắp khác nhau; WeakSet không giữ sống tài nguyên đã bỏ.

SceneRenderer.dispose idempotent: hủy RAF, bỏ observer/listener, giải phóng điều khiển, bóng cache, actor, cảnh, bộ tải và renderer, rồi gỡ canvas. Kết quả tải muộn được giải phóng, không đánh dấu ready sau khi tháo renderer. AudioEngine giữ một AudioContext cho phiên, giải phóng khi hook unmount; kết quả start bất đồng bộ không cập nhật phiên đã tháo.

Không thay thiết kế, mật độ thực vật hoặc âm thanh trong lượt này. Desktop giữ chất lượng high; trải nghiệm cảm ứng được tách component nhưng giữ hành vi cũ.

## Đối chiếu và kiểm thử

- Fixture lấy từ e1fff41 cho 14 mốc thời gian × ba cừu, cửa/đếm, 81 điểm cao độ, camera và giới hạn; so số với dung sai 1e-9.
- Kiểm thử hình học kiểm tra mô hình gốc, clip/rig, chống đất, che khuất chuồng từ tám hướng và va chạm với cửa/rào.
- Kiểm thử trình duyệt kiểm tra ba kích thước desktop, âm thanh/lưu lựa chọn, timer/fade/deadline, pause, camera, giảm chuyển động và tự ẩn.
- Kiểm tra đồ thị esbuild: React, React DOM, Three.js dùng dependency npm; không có recovered/reference-runtime, boot hoặc testMode trong production.
- Kiểm thử vòng đời: StrictMode mount/phát/unmount/remount đóng từng AudioContext một lần; renderer thật giải phóng từng geometry/material/texture theo dõi một lần, hủy RAF, không còn canvas và xử lý tháo trước khi tải xong.
- HTML offline kiểm tra mô hình WebGL và phát/tạm dừng/đếm/chọn bài khi ngắt mạng. Kiểm tra phục hồi nguồn đối chiếu cả TSX và mô hình gốc theo SHA-256.

Ở khung chính 1366×768, pha 4.4 đang pause, cả bản trước và bản module ghi 219 lượt vẽ, 2.001.271 tam giác, 161 geometry, 25 texture; cùng 144.171 cụm cỏ, 639 bụi hoa và một lần bake bóng tĩnh. Đây là số tải dựng hình thực từ WebGL SwiftShader, không phải kết luận FPS trên GPU máy HP.

Ảnh đối chiếu chỉ phục vụ QA nội bộ, không bàn giao ảnh/video. Các báo cáo máy đọc được và HTML xuất nằm trong artifacts, không đưa vào Git.

## Kết quả lượt nghiệm thu

TypeScript strict và production build đạt. Bộ 20 kiểm thử đạt toàn bộ (15 kiểm thử hồi quy + 5 kiểm thử bổ sung cho mốc đối chiếu, đồ thị dependency và vòng đời). Sai lệch mục tiêu chân lớn nhất trong 450 mẫu chân chống vẫn là 1,26055×10⁻⁷ đơn vị; không trôi pose sau 100 lần dựng cùng thời điểm. Mọi tài nguyên trong public/assets giữ nguyên so với e1fff41.

Các kiểm tra nguồn sạch, đối chiếu WebGL nội bộ, HTML offline và phục hồi toàn bộ nguồn/tài nguyên được ghi ở báo cáo artifacts/verification-modular.json sau khi đóng gói; báo cáo không nằm trong HTML để tránh checksum tự tham chiếu.
