# Cấu hình xác minh email OTP qua Gmail SMTP

MoveFlow gửi email OTP bằng Nodemailer qua Gmail SMTP. `SMTP_USER` là hộp thư gửi; mã OTP được gửi tới địa chỉ người dùng đăng ký, ví dụ Gmail cá nhân. Không cần Resend.

## 1. Tạo Google App Password

1. Dùng tài khoản Gmail sẽ gửi email OTP và bật Xác minh 2 bước (2-Step Verification).
2. Tạo App Password trong phần bảo mật của Google Account.
3. Dùng App Password 16 ký tự cho ứng dụng; không dùng mật khẩu đăng nhập Gmail thông thường.
4. Không chia sẻ hoặc commit App Password. Chỉ đặt nó trong `.env` trên máy chạy backend.

## 2. Cấu hình `.env`

```dotenv
EMAIL_DELIVERY_MODE=smtp
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=youraccount@gmail.com
SMTP_APP_PASSWORD=your_16_character_google_app_password
EMAIL_FROM="MoveFlow <youraccount@gmail.com>"
OTP_SECRET=chuoi-ngau-nhien-rieng-it-nhat-32-ky-tu
```

`EMAIL_FROM` nên dùng chính địa chỉ Gmail đã đăng nhập SMTP. Sau khi cập nhật, khởi động lại API:

```bash
docker compose up -d --build api
```

Nếu vừa thay đổi `.env`, dùng `docker compose up -d --force-recreate api` để container nhận cấu hình mới.

## 3. Luồng xác minh

- `POST /api/v1/auth/register`: tạo tài khoản `SENDER` chưa xác minh và gửi OTP tới email đăng ký.
- `POST /api/v1/auth/verify-email`: nhận `email` và `code`; code có 6 chữ số, hiệu lực 10 phút, tối đa 5 lần thử cho một code.
- `POST /api/v1/auth/resend-verification`: yêu cầu gửi lại mã, có thời gian chờ chống spam.
- `POST /api/v1/auth/login`: chỉ phát token nếu email đã xác minh và tài khoản đang hoạt động.

OTP không được lưu dạng văn bản trong database. Chỉ hash của OTP được lưu; code chỉ xuất hiện trong email. Backend không gửi lại nguyên lỗi SMTP cho trình duyệt.

Tài khoản demo được seed sẵn với trạng thái đã xác minh để dùng đăng nhập thử, nên không nhận OTP. Hãy đăng ký bằng địa chỉ Gmail mà bạn có thể truy cập để kiểm tra luồng gửi và xác minh OTP.

## 4. Chế độ console cho phát triển cục bộ

Nếu chỉ cần thử luồng UI khi chưa có cấu hình email, có thể đặt `EMAIL_DELIVERY_MODE=console` và chạy backend **ngoài production**. OTP sẽ được in ở log backend; mã không được trả về client. Không dùng chế độ này cho production. Dockerfile đặt `NODE_ENV=production`, vì vậy Docker Compose cần `EMAIL_DELIVERY_MODE=smtp`.

## 5. Lưu ý bảo mật

- `OTP_SECRET` phải là chuỗi ngẫu nhiên độc lập dài ít nhất 32 ký tự; API production sẽ không khởi động nếu secret bị bỏ trống hoặc còn placeholder. Khi thay secret đang dùng, các OTP đang chờ có thể không còn xác thực được.
- Không dùng mật khẩu Gmail chính làm `SMTP_APP_PASSWORD`.
- Dùng HTTPS khi triển khai public; giám sát lỗi SMTP và giới hạn gửi.
- Email OTP khi đăng ký xác minh quyền truy cập mailbox; phiên bản này chưa yêu cầu mã thứ hai ở mọi lần login (MFA per-login).
