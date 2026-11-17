# Nhật ký chuyển mã, không phải pipeline build

Các script ở đây ghi lại từng bước phục hồi và chuyển mã từ HTML. Chúng làm việc trên các trạng thái trung gian, không được chạy lại trên nguồn hiện tại và không được import bởi ứng dụng hoặc build.

`reference-runtime.js` ở thư mục cha là mốc trước refactor, commit e1fff41. `original-bundle.js`, `readable-bundle.js` và báo cáo patch lưu bằng chứng phục hồi ban đầu. Nguồn đang phát triển nằm trong `src/`; build trực tiếp bằng `npm run build`, không sinh lại nguồn từ bundle.
