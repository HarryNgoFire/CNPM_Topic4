# Trạng thái triển khai và giới hạn hiện tại

Tài liệu này tóm tắt phạm vi được triển khai trong repository MoveFlow. Hướng dẫn chạy nằm ở [README](../README.md); yêu cầu chi tiết ở [SRS](SRS.md).

## Chức năng đã có trong mã nguồn

- SPA cho các vai trò SENDER, DRIVER, DISPATCHER và ADMIN; responsive web app được phục vụ bằng Nginx.
- Xác thực email OTP, access/refresh session, hồ sơ người dùng và quản trị tài khoản.
- Báo giá OSRM, tạo shipment và snapshot phí; điều phối tự động/thủ công và nhận/từ chối assignment.
- Luồng giao hai chặng, GPS tài xế, geofence, navigation, live tracking có phân quyền và tracking công khai giới hạn dữ liệu.
- Phiên bản pricing rule, webhook HMAC/retry, geocoding proxy và health endpoint.
- PostgreSQL/PostGIS, Prisma migrations, test backend và test frontend.

Các endpoint và response hiện hành được mô tả trong [OpenAPI](api/openapi.json). Schema database nằm ở `prisma/schema.prisma`; sơ đồ được lưu trong [architecture/diagrams](architecture/diagrams).

## Giới hạn và lưu ý vận hành

- OSRM mặc định dùng profile `driving`; tuyến và khoảng cách không phải tuyến xe máy chuyên biệt.
- OSRM/Nominatim public và SMTP bên ngoài có thể gián đoạn/quota; không có SLA production mặc định.
- Stack tile/OSRM/Nominatim tự lưu trữ là tùy chọn. Dataset chưa được đưa vào repository và cần chuẩn bị riêng.
- Demo seed và Demo Tools dành cho local/testing; không dùng tài khoản, secret hoặc GPS giả lập demo trong production.
- Chưa có thanh toán/COD, bằng chứng giao hàng, quy trình hoàn hàng, reset mật khẩu qua email, MFA bắt buộc ở mỗi lần đăng nhập hay E2E trình duyệt đầy đủ.
- Chưa có cấu hình production đầy đủ cho giám sát, alerting, backup/restore và quản lý secret tập trung.

## Lệnh xác minh

Chạy các lệnh từ thư mục gốc; integration test cần database test riêng:

```bash
npm run lint
npm run typecheck
npm run build
npm test
npm run test:web
npm run test:integration
```

Kết quả chạy trước đây trong các tài liệu `docs/m2`, `docs/m3`, `docs/m4` là snapshot lịch sử, không được xem là kết quả xác minh cho code hiện tại. Chỉ ghi nhận build/test là đã pass sau khi chạy lại trên commit cần phát hành.
