# Mặt cừu cá nhân — 0.5.0

## Sử dụng

Desktop: mở **⋯ → Mặt cừu của bạn → Chọn ảnh**. Trên giao diện cảm ứng, dùng nút mặt cười trong nhóm tùy chọn cảnh. Chọn JPEG, PNG hoặc WebP không quá 20 MB/50 megapixel; HEIC cần chuyển sang JPEG trước.

Kéo ảnh để căn vào khung bầu dục; cuộn chuột hoặc dùng thanh Phóng to; dùng thanh Xoay hoặc chụm/xoay hai ngón. Khi focus khung ảnh, phím mũi tên dịch chuyển 1 pixel đầu ra, Shift+mũi tên dịch 10 pixel. Kéo bản xem trước 3D để xem các phía. **Áp dụng** dùng một khuôn mặt cho cả ba cừu. Mở lại mục này để tiếp tục chỉnh từ ảnh nguồn và thông số đã áp dụng; **Chỉnh lại** đặt lại căn chỉnh. **Khôi phục** bỏ ảnh và trả đúng mặt cừu gốc. Đóng bảng khi chưa áp dụng sẽ hủy các thay đổi nháp.

Không có nhận diện hoặc tạo mặt bằng AI. Các pixel ảnh thật được căn/cắt bằng Canvas, không có bộ lọc hoạt hình, làm đẹp hoặc thay đổi tỷ lệ hai chiều. Ảnh chỉ ở RAM của lần mở trang, không ghi vào localStorage/IndexedDB, log, máy chủ hoặc HTML xuất sẵn. Tải lại trang sẽ trở về mặt gốc. Âm thanh và hẹn giờ tiếp tục khi chỉnh ảnh; bản xem trước đứng yên để dễ căn.

## Các phần mã mới

- `src/face/image.ts`: đọc ảnh, EXIF, giới hạn đầu vào, phép căn đồng nhất, giới hạn kéo theo bầu dục, xuất 768×1024 RGBA với mép mềm 8 px. Ảnh nguồn được thu về cạnh dài tối đa 3072 px. PNG có alpha được lót nền trung tính trước khi cắt để vùng trong mặt không bị thủng.
- `src/face/CropCanvas.tsx`: khung căn ảnh, Pointer Events/capture, chuột, wheel, hai ngón và bàn phím. `FaceEditor.tsx` quản lý nháp, đọc file bất đồng bộ theo yêu cầu mới nhất, lỗi và các nút thao tác.
- `src/face/FacePreview.tsx`: renderer riêng, dùng cùng GLB và bộ ghép mặt, render khi thay đổi, dừng khi ẩn tab. Dispose cả renderer và context riêng khi đóng để mở nhiều lần không chiếm các context của cảnh chính.
- `src/face/FaceAttachment.ts`: hình học mặt cong và viền lông; lọc nét mặt gốc; quản lý các bản hình học dẫn xuất, material và một CanvasTexture dùng chung cho ba cừu.
- `src/face/modelConfig.ts`: cấu hình duy nhất cho model. `usePersonalFace.ts` sở hữu ảnh nguồn/ảnh đã cắt đang áp dụng và giải phóng khi thay, khôi phục hoặc unmount.

Các phần tích hợp được sửa: `src/app/App.tsx`, `src/types.ts`, `src/scene/SceneView.tsx`, `src/scene/SceneRenderer.ts`, `src/scene/world.ts`, `src/ui/SceneOptions.tsx`, `src/ui/types.ts`, `src/ui/Dialog.tsx` và `src/style.css`. Không sửa GLB, ảnh nguồn, camera, lịch chuyển động, bộ phát hoặc trạng thái hẹn giờ.

`SceneProps.face` là tùy chọn, gồm Canvas và revision; mặc định không có ảnh. `onFaceError` là callback tùy chọn. Handle renderer có `setFace()` để cập nhật và yêu cầu một khung khi pause; không tạo lại cảnh hoặc reset đồng hồ. Cảnh chưa tải xong dùng lựa chọn mới nhất khi sẵn sàng. WebGL/model không tương thích giữ chức năng thư giãn và hiện thông báo, không cho áp dụng qua một preview bị lỗi.

## Model thực tế và cách ghép

Model `sheep-natural.glb` có SHA-256 `6d221f4014342f3b58fe975a3608f973f0f84422c4471d85aa0c88dd29c9995c`. Đã đọc trực tiếp GLB và cây đối tượng của GLTFLoader: bone `Head` có hai con `EarL`/`EarR`; 13 joint; bốn clip Idle/Walk/Jump/Land. Các primitive dùng các vật liệu `Felt wool — source fiber texture`, `Warm beige felt`, `Soft pink cheeks and inner ears`, `Warm brown smile and hoof`.

Mesh nét mặt không tách riêng: primitive hồng gồm má và tai, primitive nâu gồm nét mặt và móng. Bộ lọc nối các tam giác thành thành phần liên thông, hàn vị trí ở seam UV, chỉ bỏ thành phần được Head điều khiển hoàn toàn trong hai vật liệu đó. Giữ cả thành phần tai có blend sang EarL/EarR; nếu chỉ xét từng tam giác sẽ mất phần gốc tai có weight Head=1. Bản sao index/geometry không sửa buffer của AssetLoader. Khi khôi phục, trả nguyên đối tượng geometry gốc.

Mặt ảnh là một mặt cong phía trước khối đầu màu be còn lại, UV chiếu từ trước với tỷ lệ 3:4. Không dán lên toàn bộ đầu và không billboard theo camera. Hình học chuyển qua inverse bind matrix rồi gắn vào bone Head, tránh sai trục/lật ảnh vì Head có phép xoay riêng. Ảnh đi theo cả clip gốc và chuyển động đầu bổ sung. Phía sau bị khối đầu che; cửa chuồng và các vật thể khác vẫn che ảnh theo depth test.

CanvasTexture dùng sRGB; MeshBasicMaterial không nhận ánh sáng trực tiếp và không tone-map để giữ màu ảnh. Bề mặt lệch 0.012 đơn vị và có polygon offset, transparent, depth test bật/depth write tắt. Viền lông dùng bản sao vật liệu lông hiện có, mượn texture; không dispose texture mượn khi bỏ tính năng. Ba cừu dùng chung geometry, material và texture mặt, mỗi nhóm được gắn vào bone đầu riêng. Đổi ảnh thay map, thu hồi texture trước đó; không thêm lớp mặt.

## Thông số khi đổi model

Chỉnh tập trung trong `FACE_MODEL`: tên bone, tên vật liệu lông/nét mặt, tâm khối đầu `[0, 1.47, 0.81]`, bán kính `[0.47, 0.51, 0.43]`, bán kính ảnh `[0.36, 0.48]`, độ lệch bề mặt, số phân đoạn/vòng và kích thước viền lông. Các tọa độ là bind pose của GLB hiện tại. Cần kiểm tra lại cấu trúc skin/component và hiệu chỉnh trước khi dùng một GLB khác; không chỉ đổi tên file.

Đây là ảnh 2D trên mặt cong, không tái tạo hình học mặt người 3D. Góc nghiêng sẽ thu hẹp ảnh theo phối cảnh tự nhiên. Dùng ảnh mặt rõ, gần chính diện để có kết quả tốt.

## Kiểm chứng và giới hạn

```sh
npm run build
npx playwright test tests/face-model.spec.ts tests/face.spec.ts
npm test
npm run demo
npm run verify:offline
npm run verify:source
```

Kiểm thử mới đọc GLB thật để đối chiếu nguyên tam giác tai/móng, kiểm tra gắn bone ở cả bốn clip, 30 lần thay/khôi phục và dispose tài nguyên. Kiểm thử WebGL cô lập đo số texture/geometry qua 30 lần thay, tám hướng nhìn, màu pixel ảnh và giải phóng cuối. Kiểm thử ứng dụng kiểm tra chọn/căn/xem trước/áp dụng cho ba cừu, pause/chuyển động, chỉnh lại/hủy, file lỗi, khôi phục và tải lại. Fixture bất đối xứng cùng 8 chiều EXIF kiểm tra orientation cả ImageBitmap và fallback ImageElement. Cảm ứng dùng sự kiện touch thật qua Chromium CDP ở 390×844 và 844×390. HTML offline phải áp dụng/khôi phục được ảnh mà không có yêu cầu HTTP.

Các kiểm tra dùng ảnh tổng hợp bất đối xứng để kiểm chứng pixel/alpha/tỷ lệ và Chromium với SwiftShader. Chưa xác nhận trên GPU HP PC, Safari/iPhone hoặc thiết bị cảm ứng thật; không suy ra FPS phần cứng hay khả năng giải mã HEIC từ các kết quả này. Không có ảnh cá nhân của người dùng được dùng làm fixture hoặc đưa vào repository.

57 ca kiểm thử mới và hồi quy đã đạt, gồm tám ca cho tính năng này. Hai ca trong lượt chạy đầu cần sửa cách kiểm chứng: cố định đồng hồ giả trước khi mở trang để tránh mốc hẹn nằm trong quá khứ; và phân biệt một DFG LUT 32×32 dùng chung của Three.js 0.181 với texture ảnh của tính năng. Hai ca đó đã chạy lại thành công. Texture ảnh trở về mức nền sau mỗi lần khôi phục; LUT của thư viện không bị dispose bởi bộ ghép mặt. Context WebGL riêng của preview được thu hồi khi đóng.
