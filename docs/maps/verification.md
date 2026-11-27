# Báo cáo kiểm tra MoveFlow

## Lần kiểm tra gần nhất trong phiên cập nhật tài liệu

Ngày chạy: **2026-11-27**. Các lệnh dưới đây được chạy từ thư mục gốc repository sau `npm run db:generate` để Prisma Client khớp với `prisma/schema.prisma`.

| Lệnh | Kết quả |
|---|---|
| `npm test` | **Pass** — 12 suites, 405 tests |
| `npm run test:web` | **Pass** — 52 tests |
| `npm run lint` | **Pass** |
| `npm run typecheck` | **Pass** |
| `npm run build` | **Pass** |
| Parse XML của hai file `.drawio` | **Pass** |

`npm run db:generate` cũng hoàn tất thành công trước lần kiểm tra cuối. Lần chạy backend ban đầu trước khi sinh lại Prisma Client thất bại do client trong `node_modules` không khớp enum/model hiện tại; sau khi generate lại, test, typecheck và build đều pass.

## Phạm vi chưa xác minh trong lần chạy này

- `npm run test:integration` và database PostgreSQL/PostGIS thực.
- Đăng ký qua SMTP/Gmail thật.
- Chạy TileServer GL/OSRM/Nominatim tự lưu trữ; repository chưa kèm dataset.
- Kiểm thử E2E trên trình duyệt, đo hiệu năng production hoặc SLA dịch vụ upstream.

Các số liệu trên chỉ áp dụng cho lần chạy đã nêu, không phải cam kết cho mọi commit. Lệnh kiểm tra và thiết lập database nằm trong [README](../../README.md).
