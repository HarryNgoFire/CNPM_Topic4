# Tích hợp email OTP và dịch vụ bản đồ

Tài liệu tham khảo nhanh cho các tích hợp ngoài đang được dùng trong MoveFlow. Hướng dẫn cài đặt chính thức nằm trong [USER_GUIDE](USER_GUIDE.md), [Email OTP](EMAIL_OTP_SETUP.md) và [Maps Operations](maps/operations.md).

## Email xác minh

Backend gửi OTP qua Nodemailer và SMTP. Với Gmail, dùng Google App Password; không dùng mật khẩu đăng nhập Gmail thông thường. Các biến cấu hình nằm trong `.env.example`:

```dotenv
EMAIL_DELIVERY_MODE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=youraccount@gmail.com
SMTP_APP_PASSWORD=your_google_app_password
EMAIL_FROM="MoveFlow <youraccount@gmail.com>"
OTP_SECRET=replace-with-a-random-secret-at-least-32-characters
```

Chế độ `console` chỉ dành cho phát triển không-production. Xem [hướng dẫn thiết lập OTP](EMAIL_OTP_SETUP.md) để biết luồng đăng ký/xác minh và lưu ý bảo mật.

## Tuyến đường và geocoding

- **OSRM:** backend dùng endpoint `OSRM_BASE_URL` để lấy tuyến đường và khoảng cách; profile là `driving`. Không cần API key với máy chủ demo công khai, nhưng máy chủ đó không có SLA. Lỗi tuyến được thể hiện rõ, không thay thế bằng khoảng cách đường thẳng.
- **Nominatim:** backend dùng `GEOCODER_BASE_URL` cho tìm kiếm và reverse geocoding; giới hạn thời gian chờ được cấu hình qua `GEOCODER_TIMEOUT_MS`.
- **Bản đồ web:** frontend dùng MapLibre GL và style URL do cấu hình web/Nginx cung cấp. TileServer GL chỉ có trong compose overlay tự lưu trữ; dataset cần được chuẩn bị riêng.

Không có yêu cầu hay cấu hình để dùng Google Maps làm dịch vụ tính phí/định tuyến trong ứng dụng hiện tại. OSRM profile `driving` không đảm bảo tương đương tuyến xe máy.

## Khởi động

Tạo `.env` từ `.env.example`, cập nhật thông tin SMTP và secret, sau đó chạy:

```bash
docker compose up --build -d
```

Nếu vừa thay đổi `.env`, tạo lại API:

```bash
docker compose up -d --force-recreate api
```
