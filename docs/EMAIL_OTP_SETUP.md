# Cấu hình xác minh email OTP

MoveFlow dùng Resend HTTPS API từ backend Node.js để gửi email xác minh mà không nhúng khóa bí mật vào trình duyệt. Mã được gửi tới email người dùng nhập (ví dụ Gmail cá nhân); `EMAIL_FROM` là địa chỉ gửi của hệ thống.

## 1. Tạo key gửi email

1. Tạo tài khoản tại <https://resend.com/>.
2. Trong Dashboard, tạo API key cho môi trường phát triển.
3. Xác minh domain gửi theo hướng dẫn của Resend (cập nhật các bản ghi DNS mà dịch vụ cung cấp).
4. Dùng địa chỉ sender thuộc domain đã xác minh, ví dụ `MoveFlow <no-reply@mailer.example.com>`.
5. Không đưa API key vào mã frontend hoặc repository; đặt nó trong `.env` trên máy chạy backend.

Một số tài khoản/dạng sử dụng thử nghiệm của nhà cung cấp có thể bị giới hạn người nhận. Kiểm tra quy định hiện hành trong dashboard Resend trước khi dùng để gửi tới Gmail của nhiều thành viên. Gói miễn phí và giới hạn gửi có thể thay đổi.

## 2. Cấu hình `.env`

```dotenv
EMAIL_DELIVERY_MODE=resend
RESEND_API_KEY=re_xxxxxxxxxxxxxxxxx
EMAIL_FROM="MoveFlow <no-reply@mailer.example.com>"
OTP_SECRET=chuoi-ngau-nhien-rieng-it-nhat-32-ky-tu
```

Sau khi sửa cấu hình, khởi động lại API:

```bash
docker compose up -d --build api
```

## 3. Luồng xác minh

- `POST /api/v1/auth/register`: tạo tài khoản `SENDER` chưa xác minh, gửi OTP và trả `verificationRequired: true`.
- `POST /api/v1/auth/verify-email`: nhận `email` và `code`; code có 6 chữ số, hiệu lực 10 phút, tối đa 5 lần thử cho một code.
- `POST /api/v1/auth/resend-verification`: yêu cầu gửi lại mã, có thời gian chờ chống spam.
- `POST /api/v1/auth/login`: chỉ phát token nếu email đã xác minh và tài khoản đang hoạt động.

OTP không được lưu dạng văn bản trong database. Chỉ hash của OTP được lưu; code chỉ xuất hiện trong email. Backend không gửi lại nguyên lỗi provider cho trình duyệt.

## 4. Chế độ console cho phát triển cục bộ

Nếu chỉ cần thử luồng UI khi chưa có cấu hình email, có thể đặt `EMAIL_DELIVERY_MODE=console` và chạy backend **ngoài production**. OTP sẽ được in ở log backend; mã không được trả về client. Không dùng chế độ này cho production. Dockerfile đặt `NODE_ENV=production`; nếu muốn thử console trong Docker, chỉ thực hiện trên máy cục bộ và chủ động set `NODE_ENV=development` trong `.env`.

## 5. Lưu ý bảo mật

- `OTP_SECRET` phải là chuỗi ngẫu nhiên độc lập dài ít nhất 32 ký tự; API production sẽ không khởi động nếu secret bị bỏ trống hoặc còn placeholder. Khi thay secret đang dùng, các OTP đang chờ có thể không còn xác thực được.
- Dùng HTTPS khi triển khai public.
- Bật rate limit ở reverse proxy nếu có, giám sát lỗi gửi email và giới hạn chi phí.
- Email OTP khi đăng ký xác minh quyền truy cập mailbox; phiên bản này chưa yêu cầu mã thứ hai ở mọi lần login (MFA per-login).
