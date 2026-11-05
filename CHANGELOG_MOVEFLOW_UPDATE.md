# MoveFlow — cập nhật ngày 30/10/2026

## Đã sửa
- OTP chuyển từ Resend sang Nodemailer SMTP (Gmail App Password); không cần domain/DNS trả phí.
- Biểu mẫu tạo đơn không còn mặc định hai tọa độ bất kỳ. Người tạo đơn chọn điểm lấy và giao trực tiếp trên OpenStreetMap (Leaflet), và mỗi lần đổi văn bản địa chỉ phải chọn lại tọa độ.
- OSRM vẫn tính khoảng cách đường bộ, thêm kiểm tra điểm bị OSRM tự dịch quá 250m tới đường có thể đi.
- Nút điều hướng Google Maps chỉ dành cho giao diện tài xế (trong nhiệm vụ và trang chi tiết đơn); sender không có nút điều hướng và backend không trả navigationUrls cho sender.
- Giữ tài liệu hướng dẫn tại `docs/NODEMAILER_OSM_SETUP.md`.

## Giới hạn / lưu ý
- Chưa chạy được `npm install`, TypeScript compile hoặc Docker integration test ở môi trường tạo bản này vì npm registry không truy cập được. Đã kiểm tra cú pháp `node --check apps/web/app.js`.
- Dockerfile dùng `npm install` thay vì `npm ci` để tự cập nhật phụ thuộc mới trên máy có Internet. Khi npm đã cài được, hãy cập nhật và commit `package-lock.json`; sau đó chuyển lại `npm ci` cho build có thể tái lập.
- Bản đồ không tự xác thực địa chỉ chữ với ghim. Người tạo đơn phải phóng to và chọn cổng đúng trên bản đồ; việc sửa dữ liệu cũ cần thao tác riêng.
- OSRM demo là profile xe hơi/đường bộ, không phải đường riêng xe máy; Google Maps có thể chọn tuyến khác. Không nên tính cước thực tế theo giá trị này nếu yêu cầu tuyến xe máy khớp tuyệt đối.
- OpenStreetMap tile public, Leaflet CDN và OSRM demo có chính sách sử dụng; không dùng tải lớn hoặc sản xuất nếu không tự host/chọn nhà cung cấp phù hợp.
- Gmail có giới hạn gửi mail và cần bật 2FA + App Password (tùy tài khoản Google).
