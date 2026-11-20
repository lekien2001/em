# Góp ý trên Êm

Mở **⋯ → Góp ý** trên desktop hoặc nút **Góp ý** trong cụm điều khiển cảnh trên thiết bị cảm ứng. Chọn chủ đề, viết tối đa 2.000 ký tự rồi gửi. Email chỉ dùng để phản hồi và có thể để trống. Đóng bảng hoặc gặp lỗi gửi sẽ giữ bản nháp trong tab hiện tại. Tải lại trang sẽ xóa bản nháp.

Bản HTML độc lập cho phép xem và nhập thử biểu mẫu. Website chạy trên Cloudflare Pages nhận góp ý qua `POST /api/feedback` cùng tên miền. D1 lưu mã gửi, thời điểm UTC, chủ đề, nội dung và email nếu được cung cấp. Mỗi lần thử lại với cùng nội dung dùng cùng mã gửi để tránh sinh bản ghi trùng.

## Bật nhận góp ý trên Cloudflare Pages

1. Mở **Cloudflare Dashboard → Storage & databases → D1 SQL database** và tạo cơ sở dữ liệu `em-feedback`.
2. Mở **Console** của cơ sở dữ liệu đó và chạy nội dung [migration 0001](../migrations/0001_feedback.sql). Migration có thể chạy lại và giữ dữ liệu đã lưu.
3. Mở **Workers & Pages → dự án Êm → Settings → Bindings**. Trong môi trường **Production**, thêm **D1 database** với tên biến `FEEDBACK_DB` và chọn `em-feedback`. Dùng cơ sở riêng nếu muốn nhận góp ý thử ở **Preview**.
4. Khi triển khai mã nguồn, giữ lệnh build `npm run build` và thư mục đầu ra `dist`. Pages nhận thư mục `functions/` từ gốc dự án. Triển khai lại sau khi lưu binding.
5. Mở URL triển khai, gửi một góp ý thử qua biểu mẫu và kiểm tra trong D1. Nếu cần xóa bản ghi thử, dùng mã `id` của chính bản ghi đó.

Trong **D1 → em-feedback → Console**, dùng truy vấn sau để đọc góp ý mới nhất.

```sql
SELECT id, created_at, category, message, email
FROM feedback
ORDER BY created_at DESC
LIMIT 50;
```

## Thử Pages Functions và D1 cục bộ

Chạy từ thư mục gốc của dự án. Cơ sở trong thư mục tạm dưới đây chỉ phục vụ kiểm thử.

```sh
npm run build
em_feedback_dev="$(mktemp -d)"
cat > "$em_feedback_dev/wrangler.toml" <<'EOF'
name = "em-feedback-local"
compatibility_date = "2026-11-20"

[[d1_databases]]
binding = "FEEDBACK_DB"
database_name = "em-feedback-local"
database_id = "00000000-0000-4000-8000-000000000001"
EOF
npx --yes wrangler@4 d1 execute FEEDBACK_DB --local \
  --config="$em_feedback_dev/wrangler.toml" --persist-to="$em_feedback_dev/state" \
  --file=migrations/0001_feedback.sql
npx --yes wrangler@4 pages dev dist --ip 127.0.0.1 --port 8788 \
  --d1=FEEDBACK_DB=00000000-0000-4000-8000-000000000001 \
  --persist-to="$em_feedback_dev/state" --compatibility-date=2026-11-20
```

Mở `http://127.0.0.1:8788` để thử gửi. `npm run preview` chỉ phục vụ tệp tĩnh. `npm test -- tests/feedback.spec.ts` kiểm tra giao diện, bản nháp, lỗi mạng và thử lại trong Chromium.
