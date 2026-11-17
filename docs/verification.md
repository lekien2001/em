# Kiểm chứng bản phục hồi

## Cao độ và hình ảnh

Gò cục bộ từng nâng tâm chuồng số 2 từ nền -0.1371 lên 1.2032. Bản mới bỏ thành phần gò và cố định sàn chuồng đích ở -0.15, cùng mức hàng rào. Nền trong footprint bằng phẳng và chuyển tiếp mềm ra đồng; không tạo hố bao quanh. Bờ, nước, đá, hoa và cỏ cùng lấy dữ liệu cao độ, giữ đường suối và bố trí ngang. Không thay các lớp đồi lớn hoặc camera.

Mái và mép gỗ bo mềm hơn, thêm trần kín phía trong để giữ che khuất khi xoay/zoom. Tổng hình học chuồng gồm bóng cửa vẫn trong ngân sách 20.000 tam giác/12 draw; bộ bóng tĩnh tiếp tục chỉ dựng một lần. Màu và texture gốc giữ nguyên; chỉ chỉnh độ nhám, normal scale và sheen để đồng nhất chất liệu vải nỉ.

## Rig và thời gian

Mô hình gốc có 11 xương: Root, Body, Head và hai xương cho mỗi chân. Dẫn xuất thêm EarL/EarR, giữ nguyên buffer position/normal/uv/index, bốn clip Idle/Walk/Jump/Land và 11 xương cũ. Chỉ 1.388 đỉnh của các thành phần tai và lòng tai đổi trọng số. Kiểm tra bind pose không thay hình dáng.

Chân dùng mục tiêu chống đất cố định theo quãng đường của clip và đường đi, giải IK hai đoạn với giới hạn tầm với. Độ nâng chân pha vung nhỏ; phần IK tắt dần trước cú nhảy, bật mềm sau tiếp đất và đi theo trọng số blend của clip. Đầu/tai/nhịp thở có biên độ nhỏ, lệch pha theo từng con, giảm khi qua cửa và tắt khi giảm chuyển động. Không thêm chuyển động tự xoay camera.

Lớp phụ dùng thời gian hoạt động không nhân tốc độ từ cùng SceneClock. Pose nền được lưu và khôi phục trước AnimationMixer; tránh tối ưu bỏ qua giá trị không đổi của mixer làm tích lũy scale/rotation khi pause và kéo camera. Không thêm timer độc lập cho tai hoặc chân.

## Phép thử

- Kiểm tra từng buffer hình học và bind pose của mô hình gốc/dẫn xuất, bốn clip và sơ đồ xương.
- Lấy mẫu rig thật qua toàn bộ chu kỳ để kiểm tra cửa/rào; raycast các góc thể tích nhân vật từ tám hướng, hai mức zoom và hai góc cao khi cửa kín.
- Kiểm tra chân chống đất, giới hạn IK, 100 lần dựng lại cùng pose khi pause, biên độ chuyển động phụ và giảm chuyển động.
- Kiểm tra đồng hồ, pause/đổi tốc độ, đếm tại điểm vượt, cửa và vị trí tái sử dụng sau hai chu kỳ.
- Kiểm tra desktop 1366×768, 1440×900, 1920×1080, UI tự ẩn/focus, âm thanh/lưu lựa chọn, deadline/fade, lỗi audio/storage, camera và WebGL fallback.
- HTML cuối kiểm tra offline với mô hình thật và âm thanh sau thao tác; kiểm tra bản nguồn nhúng có thể phục hồi, mô hình gốc và mã chỉnh sửa khớp checksum.

Ảnh đối chiếu chỉ lưu trong /tmp để QA; không xuất ảnh/video nghiệm thu. Mọi số FPS phải đo bằng đồng hồ thật. Kết quả SwiftShader là GPU phần mềm, không xác nhận tốc độ trên GPU máy HP của người dùng.

## Kết quả đã xác nhận

- TypeScript và production build đạt; 15/15 kiểm thử tự động đạt, gồm một phiên WebGL thật và ba kích thước desktop.
- Bàn chân đang chống đất: sai lệch lớn nhất so với mục tiêu 1,27×10⁻⁷ đơn vị; sole cách đất tối đa 0,00403 đơn vị trong 450 mẫu chân chống. Mức 0,004 là khoảng hở chủ động chống z-fighting. Sau 100 lần dựng lại cùng pose, vị trí/quaternion/scale không tích lũy sai lệch.
- Hai chuồng: 11.488 tam giác và 7 lượt vẽ cho hình chính; tính thêm bóng cửa là 14.400 tam giác/11 lượt vẽ. Trần kín vẫn che nhân vật khi cửa đóng tại tám hướng và các giới hạn camera.
- Mô hình cừu không tăng số tam giác; chỉ tăng hai xương tai. 144.171 cụm cỏ và 639 bụi hoa được giữ nguyên. WebGL kiểm tra bộ bóng tĩnh chỉ bake một lần, bóng động không cập nhật khi pause rồi kéo camera.

`scripts/benchmark.mjs` đo tuần tự bằng đồng hồ thật tại ba độ phân giải, ở trạng thái kéo camera khi pause, phát, và vừa kéo vừa phát. Mẫu nhỏ chỉ dùng chẩn đoán; không dùng đồng hồ giả để báo thời gian khung. `scripts/check-offline.mjs` kiểm tra đúng HTML bàn giao khi ngắt mạng. `scripts/check-source-roundtrip.mjs` kiểm tra phục hồi nguồn và tài nguyên bằng SHA-256. Báo cáo máy đọc được nằm riêng trong `artifacts/`, không nhúng số hash tự tham chiếu vào HTML.

## Đo thời gian thực trên SwiftShader

ANGLE Vulkan SwiftShader Device (Subzero), Chromium hệ thống, chạy nối tiếp từng kích thước và chế độ. Mỗi hàng chỉ 7–8 mẫu sau mẫu đầu, bao gồm độ trễ cấp sự kiện chuột ở chế độ kéo; đây không phải benchmark GPU thật hoặc kết luận 60 FPS. Các mẫu ghi bằng performance.now, không điều khiển thời gian giả.

| Kích thước | Chế độ | n | Trung vị ms | p95 ms | >50 ms | Lượt vẽ | Tam giác |
|---|---|---:|---:|---:|---:|---|---|
| 1366×768 | Kéo khi pause | 8 | 5191.8 | 9565.1 | 8 | 212–221 | 1903908–2001740 |
| 1366×768 | Phát | 7 | 5233.2 | 5343.9 | 7 | 227–235 | 2056931–2112591 |
| 1366×768 | Kéo khi phát | 8 | 5601.5 | 6765.6 | 8 | 236–245 | 2045970–2143802 |
| 1440×900 | Kéo khi pause | 8 | 5348.1 | 6318.7 | 7 | 202–208 | 1965298–1973318 |
| 1440×900 | Phát | 7 | 5957.8 | 6672.4 | 7 | 224–224 | 2098285–2098285 |
| 1440×900 | Kéo khi phát | 8 | 5816.0 | 7587.9 | 8 | 226–232 | 2107360–2115380 |
| 1920×1080 | Kéo khi pause | 8 | 7124.2 | 7681.9 | 7 | 212–220 | 2154026–2238644 |
| 1920×1080 | Phát | 7 | 7586.9 | 9034.2 | 6 | 235–235 | 2362709–2362709 |
| 1920×1080 | Kéo khi phát | 8 | 7473.9 | 8018.0 | 8 | 236–244 | 2296088–2380706 |

Cả chín lượt không có lỗi JavaScript/console. Bộ bóng tĩnh giữ một bake ở mọi trường hợp. Các số liệu phần mềm ở đây rất chậm và không dùng để suy diễn FPS máy HP; mật độ thực vật được giữ đúng yêu cầu.
