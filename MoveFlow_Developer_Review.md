# Developer review và các lỗi đã xử lý

## Các khuyết điểm đã xử lý trong bản này

1. **Không có frontend chạy được**: thêm `apps/web` là SPA responsive, served qua Nginx trong Compose.
2. **Đăng ký/đăng nhập chưa xác minh email**: thêm cột `User.emailVerified`, bảng `EmailVerificationCode`, OTP hash, hạn 10 phút, giới hạn 5 lần thử và endpoint verify/resend.
3. **Có thể tự đăng ký DRIVER từ endpoint công khai**: DTO đăng ký không nhận role; service luôn tạo `SENDER`. Tài khoản quản trị/tài xế chỉ được cấp riêng.
4. **Thiếu giao diện hồ sơ và quản lý tài khoản**: thêm API `users/me`, cập nhật tên, đổi mật khẩu, danh sách tài khoản admin và khóa/mở khóa account. Khóa account thu hồi refresh sessions.
5. **OTP provider thất bại có thể để lại tài khoản mồ côi**: đăng ký xóa account mới tạo nếu gửi code thất bại; resend có cooldown.
6. **Không có luồng UI cho công việc tài xế**: thêm nhận/từ chối assignment, cập nhật trạng thái và link điều hướng Google Maps.
7. **Không có hướng dẫn tích hợp các phần**: thêm `USER_GUIDE.md`, `EMAIL_OTP_SETUP.md` và Compose service frontend.

## Rủi ro còn tồn tại / nên giải quyết tiếp

- OSRM public demo chỉ phù hợp demo học tập; production nên tự host hoặc dùng routing provider có SLA và thỏa thuận quota.
- OSRM driving profile không phải routing xe máy chuyên biệt; giá và tuyến có thể khác Google Maps.
- Giao diện nhập tọa độ thủ công, chưa geocode tự động.
- Không có MFA yêu cầu OTP ở mọi lần đăng nhập; OTP hiện dùng để xác minh email lần đầu.
- Admin đầu tiên được khởi tạo qua seed. Cần quy trình bootstrap quản trị an toàn (không dùng demo password) trước khi triển khai thực.
- Chưa có reset password qua email, kiểm thử E2E qua trình duyệt, giám sát/alert, backup tự động hoặc external secrets manager.
- Frontend đã tự làm mới access token một lần bằng refresh-token rotation; cần kiểm thử E2E khi access token hết hạn và khi tài khoản bị khóa.
- Một số workflow nghiệp vụ cần hoàn thiện trước production: giao thất bại/hủy/hoàn hàng, COD, bằng chứng giao, xử lý mất mạng, đối soát phí.

## Kiểm thử

- Đã kiểm tra cú pháp JavaScript frontend bằng `node --check` và parse cấu hình/ngữ nghĩa file tĩnh.
- Cập nhật test auth theo hành vi public signup mới và fixture email verified.
- Trong môi trường tạo bản giao này, dependencies ở `apps/api/node_modules` chưa đầy đủ và npm registry không phản hồi kịp; vì thế chưa xác nhận được `npm run typecheck`, Jest, build Docker hoặc luồng email thật. Phải chạy các lệnh ở mục dưới trong môi trường có mạng trước khi xem là production-ready.

## Checklist xác nhận trước demo

```bash
npm ci
npm run db:generate
npm run typecheck
npm test
npm run build
```

Sau đó kiểm thử Docker sạch trong database demo riêng, tạo tài khoản Gmail thật, xác minh OTP, đăng nhập sai mật khẩu, OTP hết hạn/sai nhiều lần, khóa user, tạo đơn, điều phối tài xế và chuyển trạng thái hoàn tất.
