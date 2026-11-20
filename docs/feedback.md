# Góp ý trên Êm

Mở **⋯ → Góp ý** trên desktop hoặc nút **Góp ý** trong cụm điều khiển cảnh trên thiết bị cảm ứng. Chọn chủ đề, viết tối đa 2.000 ký tự rồi gửi. Email chỉ dùng để phản hồi và có thể để trống. Đóng bảng hoặc gặp lỗi gửi sẽ giữ bản nháp trong tab hiện tại. Tải lại trang sẽ xóa bản nháp.

Bản HTML độc lập cho phép xem và nhập thử biểu mẫu. Worker `em` nhận góp ý qua `POST /api/feedback` cùng tên miền. D1 lưu mã gửi, thời điểm UTC, chủ đề, nội dung và email nếu được cung cấp. Mỗi lần thử lại với cùng nội dung dùng cùng mã gửi để tránh sinh bản ghi trùng.

## Bật nhận góp ý trên Cloudflare Workers

1. Trong **Cloudflare Dashboard → Storage & databases → D1 SQL database → product → Console**, chạy [migration 0001](../migrations/0001_feedback.sql) để tạo bảng `feedback`. Migration chỉ tạo bảng và chỉ mục nếu chưa có.
2. Kiểm tra **Workers & Pages → em → Settings → Builds**. Nhánh production là `main`, thư mục gốc là thư mục chứa `wrangler.json`, lệnh build là `npm run build` và lệnh deploy là `npx wrangler deploy`.
3. `wrangler.json` khai báo cả mã Worker, tệp tĩnh `dist` và binding `DB` tới D1 `product`. Sau khi triển khai bản mới, kiểm tra binding trong **em → Settings → Bindings**.
4. Mở [website Êm](https://em.19020341.workers.dev/), gửi một góp ý thử và kiểm tra bản ghi trong D1. Nếu cần xóa bản ghi thử, dùng mã `id` của bản ghi đó.

Trong **D1 → product → Console**, dùng truy vấn sau để đọc góp ý mới nhất.

```sql
SELECT id, created_at, category, message, email
FROM feedback
ORDER BY created_at DESC
LIMIT 50;
```

## Thử Worker và D1 cục bộ

Chạy từ thư mục gốc của dự án. Cơ sở trong thư mục tạm dưới đây chỉ phục vụ kiểm thử.

```sh
npm run build
em_feedback_dev="$(mktemp -d)"
npx --yes wrangler@4 d1 execute DB --local \
  --persist-to="$em_feedback_dev" --file=migrations/0001_feedback.sql
npx --yes wrangler@4 dev --ip 127.0.0.1 --port 8788 --persist-to="$em_feedback_dev"
```

Mở `http://127.0.0.1:8788` để thử gửi. `npm run preview` chỉ phục vụ tệp tĩnh. `npm test -- tests/feedback.spec.ts` kiểm tra giao diện, bản nháp, lỗi mạng và thử lại trong Chromium.
