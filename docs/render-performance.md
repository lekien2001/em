# Đo hiệu năng của Êm

Mở cùng một HTML trong Chrome. Giữ cùng máy, thiết bị đồ họa, viewport 991×765, DPR 1 và góc camera ban đầu. Giữ tab ở phía trước trong lúc đo. Chromium SwiftShader dùng để kiểm tra hành vi. Chọn cấu hình đồ họa mặc định dựa trên GPU máy thật.

| Tham số sau tên tệp | Độ phân giải nội bộ | Cập nhật bóng động |
| --- | --- | --- |
| `?qa=1&render=baseline` | 100% | Mỗi khung khi phát |
| `?qa=1&render=scale90` | 90% theo mỗi chiều | Mỗi khung khi phát |
| `?qa=1&render=shadow30` | 100% | Tối đa 30 lần/giây |
| `?qa=1&render=both` | 90% theo mỗi chiều | Tối đa 30 lần/giây |

Bật phát rồi chạy lệnh sau trong Console. Mỗi lượt làm nóng 5 giây và đo 20 giây. Làm ba lượt ở mỗi cấu hình, đặt lại camera nếu đã xoay hoặc zoom. Kết quả gồm viewport, DPR, kích thước canvas, FPS, p95 khoảng cách giữa khung và phần trăm khoảng cách vượt 25 ms.

```js
await document.querySelector(".canvas-host").emRenderBenchmark()
```

So trung vị của ba lượt. Một cấu hình đạt khi giảm tỉ lệ khoảng cách vượt 25 ms tối thiểu 5 điểm phần trăm, p95 tăng tối đa 1 ms và bóng chân cừu khi nhảy cùng bóng cửa chuồng đang mở vẫn đạt đối chiếu trực quan. Trong các kết quả cách nhau dưới 2 điểm phần trăm, ưu tiên cấu hình có độ phân giải cao hơn, rồi cấu hình cập nhật bóng ở mỗi khung nếu độ phân giải bằng nhau. Khi chưa có dữ liệu GPU máy thật, trang mở ở cấu hình ban đầu.

Để đo hộp mặt cừu, mở với `?qa=1` rồi ghi Chrome Performance từ lúc mở hộp đến lúc áp dụng. Các mục User Timing ghi thời gian mở lần đầu, cắt và vẽ xem trước, cắt ảnh khi áp dụng. Chọn cùng ảnh, kéo, phóng và xoay theo cùng kịch bản giữa các lượt. So thời gian mở riêng với các lần chỉnh sau khi tải xong.

```js
performance.getEntriesByType("measure").filter(({ name }) => name.startsWith("em:face-"))
```
