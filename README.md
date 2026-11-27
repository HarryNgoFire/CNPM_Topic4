# MoveFlow — Giao nhận chặng cuối và theo dõi vận đơn

MoveFlow là ứng dụng web và REST API hỗ trợ tạo đơn giao nhận, báo giá theo tuyến đường, phân công tài xế, cập nhật tiến trình giao hàng và tra cứu vận đơn. Repository hiện triển khai frontend SPA JavaScript, backend NestJS/TypeScript và PostgreSQL/PostGIS; không sử dụng Next.js hay chatbot AI.

## Chức năng hiện có

- **Tài khoản:** đăng ký người gửi, xác minh email bằng OTP, đăng nhập/đăng xuất, làm mới phiên, cập nhật hồ sơ và đổi mật khẩu. ADMIN có thể tạo tài khoản DRIVER/DISPATCHER và khóa/mở tài khoản.
- **Tạo đơn và báo giá:** chọn địa chỉ/tọa độ trên bản đồ, tìm kiếm và reverse geocoding, nhập kiện hàng, chọn STANDARD/EXPRESS, xem phí và tuyến OSRM trước khi tạo đơn. Phí được tính lại ở backend và lưu thành snapshot.
- **Điều phối:** tự động chọn tài xế đủ điều kiện; ADMIN/DISPATCHER có thể xem hàng chờ và chỉ định tài xế. Tài xế nhận hoặc từ chối yêu cầu.
- **Giao hàng:** tài xế cập nhật trạng thái và GPS. Điều hướng được chia thành chặng đến điểm lấy rồi mới đến điểm giao; API kiểm tra geofence 100 m cùng độ chính xác và độ mới của GPS.
- **Theo dõi:** người được phân quyền xem chi tiết và vị trí tài xế trực tiếp; tra cứu công khai bằng mã vận đơn chỉ trả trạng thái/lịch sử công khai, không trả tọa độ GPS.
- **Vận hành:** ADMIN quản lý phiên bản bảng giá và webhook; webhook có chữ ký HMAC và cơ chế retry. Có health endpoint và Swagger UI.
- **Demo:** frontend có Demo Tools cho mô phỏng và hỗ trợ trình diễn. Chỉ dùng dữ liệu/mô phỏng demo trong môi trường phát triển.

Không có thanh toán/COD, bằng chứng giao hàng, hoàn hàng, reset mật khẩu qua email, MFA qua email ở mỗi lần đăng nhập hay E2E trình duyệt tự động đầy đủ.

## Công nghệ và cấu trúc

| Thành phần | Công nghệ |
|---|---|
| Web | HTML/CSS/JavaScript, MapLibre GL 4.7.1, Nginx |
| API | Node.js, NestJS 11, TypeScript, REST/OpenAPI |
| Database | PostgreSQL 16, PostGIS 3.5, Prisma 7 |
| Tuyến đường | OSRM, profile `driving` |
| Tìm kiếm địa chỉ | Nominatim qua API proxy |
| Xác minh email | Nodemailer qua SMTP |
| Chạy local | Docker Compose v2 |

```text
apps/
  api/       NestJS API, modules và backend tests
  web/       SPA, bản đồ, controllers và frontend tests
docs/
  api/       OpenAPI JSON
  maps/      Kiến trúc, vận hành và xác minh bản đồ
  architecture/diagrams/
prisma/      Schema và migrations
scripts/     Seed và tiện ích xuất OpenAPI
infra/maps/  Cấu hình/data mount cho map stack tùy chọn
```

## Chạy với Docker Compose

Yêu cầu: Docker Desktop/Engine và Docker Compose v2. Từ thư mục gốc repository, tạo `.env` từ mẫu rồi thay các secret:

```powershell
Copy-Item .env.example .env
```

Thiết lập tối thiểu `POSTGRES_PASSWORD`, `JWT_SECRET`, `OTP_SECRET` và thông tin SMTP (`SMTP_USER`, `SMTP_APP_PASSWORD`, `EMAIL_FROM`). Dùng secret riêng, đủ mạnh; không commit `.env`. Xem [cấu hình gửi email OTP](docs/EMAIL_OTP_SETUP.md).

```bash
docker compose up --build -d
docker compose ps
```

Compose khởi động database, áp migrations, API và web. Địa chỉ mặc định:

- Web: <http://localhost:3005>
- API health: <http://localhost:3001/api/v1/health>
- Swagger: <http://localhost:3001/api/docs>

Để nạp dữ liệu demo trên database local:

```bash
docker compose run --rm migrate npm run db:seed
```

Seed có các email `sender@gmail.com`, `driver-a@gmail.com`, `driver-b@gmail.com`, `dispatcher@gmail.com` và `admin@gmail.com`. Trên database mới, mật khẩu mặc định là `admin`; có thể đặt `DEMO_PASSWORD` trong `.env`. Seed không đặt lại mật khẩu của tài khoản demo đã tồn tại. Các email này là tên đăng nhập local, không nhất thiết là hộp thư thật. Không dùng tài khoản hoặc mật khẩu demo trong production.

## Chạy và kiểm tra backend bằng npm

Yêu cầu Node.js `22.12` trở lên (giới hạn theo `package.json`) và npm. Database vẫn cần PostgreSQL/PostGIS; có thể khởi động riêng bằng Compose.

```bash
npm ci
npm run db:generate
docker compose up -d db
npm run db:migrate
npm run db:seed
npm run dev:api
```

Các lệnh kiểm tra được hỗ trợ:

```bash
npm test                 # backend unit/HTTP tests
npm run test:integration # integration tests; cần database test riêng
npm run test:web         # frontend Node.js tests
npm run lint
npm run typecheck
npm run build
npm run openapi          # xuất docs/api/openapi.json
```

`npm run db:migrate` áp dụng migrations lên database trong `DATABASE_URL`; không trỏ lệnh kiểm thử integration vào dữ liệu cần giữ. Xem [SRS](docs/SRS.md) và [hướng dẫn sử dụng/vận hành](docs/USER_GUIDE.md) để biết luồng chi tiết.

## Bản đồ tự lưu trữ (tùy chọn)

`compose.maps.yaml` bổ sung TileServer GL, OSRM và Nominatim. Dữ liệu bản đồ không được đóng gói sẵn trong repository; các thư mục `infra/maps/*/data` chỉ có placeholder. Cần chuẩn bị các file dataset đúng với cấu hình trong `infra/maps` trước khi bật stack:

```bash
docker compose -f compose.yaml -f compose.maps.yaml up -d
```

Xem [hướng dẫn bản đồ](docs/maps/operations.md). Mặc định ứng dụng dùng các upstream được khai báo trong `.env.example`; dịch vụ công cộng không có SLA. OSRM dùng profile `driving`, không phải định tuyến xe máy.

## Tài liệu

- [Hướng dẫn sử dụng, cài đặt và khắc phục lỗi](docs/USER_GUIDE.md)
- [Đặc tả yêu cầu phần mềm (SRS)](docs/SRS.md)
- [Hợp đồng API OpenAPI](docs/api/openapi.json)
- [Kiến trúc bản đồ](docs/maps/architecture.md) · [Vận hành](docs/maps/operations.md) · [Báo cáo xác minh](docs/maps/verification.md)
- [Cấu hình OTP qua Gmail SMTP](docs/EMAIL_OTP_SETUP.md)
- [ERD](docs/architecture/diagrams/erd.drawio) · [State machine](docs/architecture/diagrams/shipment-state-machine.drawio)
- Các tài liệu `docs/m2`, `docs/m3`, `docs/m4` là ghi chú bàn giao/báo cáo của những snapshot trước, không thay thế hướng dẫn và trạng thái triển khai hiện tại.
