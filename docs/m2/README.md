# Hướng dẫn chạy và bàn giao phần M2

Bản code này triển khai Pricing, Dispatch và Webhook trên NestJS. Có thêm Shipment, public Tracking và lớp Auth/state machine nền để chạy toàn bộ luồng giao hàng độc lập. Schema, Auth/RBAC và state machine cần M3 rà soát khi tích hợp; test và CI cần M4 tiếp nhận. Frontend thuộc M1 và chưa được tạo trong bản này.

## Chạy bằng Docker Compose

Tại thư mục gốc repo, sao chép `.env.example` thành `.env`. Đặt các biến sau:

- `POSTGRES_PASSWORD`: mật khẩu database local, dùng chuỗi chữ/số hoặc hex để phù hợp URL.
- `DATABASE_URL`: `postgresql://topic4:<POSTGRES_PASSWORD>@localhost:5432/topic4` khi chạy API bằng npm.
- `JWT_SECRET`: chuỗi ngẫu nhiên tối thiểu 32 ký tự, thay hoàn toàn giá trị mẫu.
- `DEMO_PASSWORD`: mật khẩu tài khoản demo, tối thiểu 10 ký tự, tối đa 72 byte UTF-8.
- `WEBHOOK_RECEIVER_SECRET`: chuỗi ngẫu nhiên tối thiểu 32 ký tự.

```bash
cp .env.example .env
# Sửa các biến trên bằng editor trước khi chạy.
docker compose up --build -d
# Seed từ container sau khi hệ thống khởi động:
docker compose run --rm migrate npm run db:seed
```

Compose tự chạy migration trước khi khởi động API. API ở `http://localhost:3001`; Swagger ở `http://localhost:3001/api/docs`. Health check: `GET /api/v1/health`.

Receiver demo ở cổng 4000. Khi đăng ký subscription qua API, dùng URL `http://receiver:4000/webhooks/shipment` để API trong container truy cập được receiver. `secret` phải bằng `WEBHOOK_RECEIVER_SECRET`. Mỗi event được receiver kiểm chữ ký trước khi nhận; deduplication của receiver demo nằm trong bộ nhớ và mất khi restart.

Các tài khoản được seed:

| Email                 | Role       |
| --------------------- | ---------- |
| sender@demo.local     | SENDER     |
| driver-a@demo.local   | DRIVER     |
| driver-b@demo.local   | DRIVER     |
| dispatcher@demo.local | DISPATCHER |
| admin@demo.local      | ADMIN      |

Tất cả dùng `DEMO_PASSWORD` tại lần seed đầu tiên. Seed giữ nguyên mật khẩu tài khoản đã tồn tại. Driver seed có tọa độ mới; sau 5 phút cần cập nhật vị trí qua API để tiếp tục được tự gán.

## Chạy backend bằng npm

Dùng Node 22.22.3 theo `.nvmrc`, npm và Docker cho database:

```bash
npm ci
npm run db:generate
docker compose up -d db
npm run db:migrate
npm run db:seed
npm run dev:api
```

Để chạy receiver ngoài container:

```bash
node --env-file=.env scripts/webhook-receiver.mjs
```

Khi cả API và receiver chạy trên máy, đặt `WEBHOOK_ALLOWED_ORIGINS=http://localhost:4000`, `WEBHOOK_ALLOW_HTTP=true`; subscription URL là `http://localhost:4000/webhooks/shipment`.

## Luồng thử bằng Swagger

1. Gọi `POST /api/v1/auth/login` với Sender; sao chép `accessToken` vào nút Authorize.
2. Gọi `/pricing/quote` và `/shipments` với body booking bên dưới. Không gửi `fee` từ frontend.
3. Đăng nhập Driver A. Gọi `/drivers/me/tasks`, lấy assignment ID rồi gọi `/assignments/{id}/respond` với `{"action":"ACCEPT"}`.
4. Gọi `/shipments/{id}/transition` lần lượt với `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `DELIVERED`.
5. Tra cứu `/tracking/{trackingCode}` không cần token. Timeline có 4 mốc, không có địa chỉ chi tiết hoặc ID người gửi.
6. Đăng nhập Admin, đăng ký webhook trước khi tạo đơn tiếp theo; xem `/webhooks/events` và log receiver.
7. Thử REJECT, timeout và hai request đồng thời theo test plan.

```json
{
  "pickupAddress": {
    "line": "12 Nguyen Trai",
    "ward": "1",
    "district": "5",
    "city": "HCMC",
    "lat": 10.754,
    "lng": 106.663
  },
  "dropoffAddress": {
    "line": "88 Le Loi",
    "ward": "1",
    "district": "1",
    "city": "HCMC",
    "lat": 10.772,
    "lng": 106.698
  },
  "parcel": { "weightKg": 5, "lengthCm": 30, "widthCm": 20, "heightCm": 15 },
  "serviceType": "EXPRESS"
}
```

Các tọa độ minh họa trên không cách nhau 8,4 km. API dùng khoảng cách thật của PostGIS, vì vậy không mặc định phí booking này là 75.300 VND. 75.300 VND là kết quả unit test với đầu vào khoảng cách đúng 8,4 km.

## Quyết định nghiệp vụ trong code

### Pricing

```text
fee = (baseFee + distanceKm × ratePerKm
       + max(0, weightKg − freeWeightThreshold) × ratePerExtraKg)
      × serviceMultiplier
```

- Khoảng cách lấy từ `ST_Distance(geography, geography)` theo mét, chia 1.000 thành km. Đây là khoảng cách địa lý, chưa phải quãng đường theo mạng đường bộ hoặc route optimization.
- Dùng decimal arithmetic; làm tròn half-up tới 1 VND, không làm tròn tới hàng nghìn.
- Fee và fee breakdown được lưu lúc tạo đơn. DB trigger chặn sửa snapshot.
- Rule là một bộ tham số có version; Admin sửa rule mới nhất để tạo version kế tiếp. Rule cũ và shipment cũ được giữ nguyên.
- Preview không giữ giá vĩnh viễn: booking tính lại theo rule đang có hiệu lực. Frontend cần sử dụng fee trả về khi tạo đơn và xử lý trường hợp rule đã đổi sau preview.

### Dispatch

- Tự gán sau booking; worker quét lại hàng đợi mỗi 10 giây nếu lần đầu chưa có driver.
- Chọn driver AVAILABLE, tài khoản active, có vị trí trong 5 phút gần nhất và nằm trong bán kính 10 km.
- Ưu tiên khoảng cách gần nhất, dùng driver ID để xử lý trường hợp bằng nhau.
- Một driver và một shipment chỉ được giữ tối đa một assignment PENDING/ACCEPTED. Partial unique index bảo vệ cả hai phía; transaction khóa shipment rồi khóa driver.
- PENDING hết hạn sau 5 phút. REJECT/EXPIRED loại driver đã thử và chọn driver kế tiếp, tối đa 5 lời mời tự động.
- Khi hết lượt, Dispatcher dùng endpoint assign-driver với body `{"driverId":"<uuid>"}` để chỉ định một driver AVAILABLE có vị trí mới. Thao tác này có thể vượt bán kính tự động và thử lại driver đã từ chối; vẫn áp dụng constraint chống gán trùng.
- ACCEPT chuyển driver sang BUSY. Shipment vẫn RECEIVED cho tới khi driver gọi transition IN_TRANSIT.
- DELIVERED chuyển assignment sang COMPLETED và trả driver về AVAILABLE.
- Phản hồi/transition lặp cùng kết quả là idempotent. Phản hồi trái với kết quả đã chốt trả 409. Kiểm tra quyền sở hữu luôn chạy trước xử lý idempotency.

### Webhook

- Có event lúc tạo RECEIVED và mỗi transition: một luồng hoàn chỉnh có 4 event.
- Ghi Shipment, history và event trong cùng transaction. Worker gửi sau commit.
- Mỗi subscription có delivery riêng. Subscription mới chỉ nhận event phát sinh sau khi đăng ký.
- HMAC-SHA256 ký đúng bytes JSON gửi đi; header `X-Webhook-Signature` có dạng `sha256=<hex>`.
- Initial send + tối đa 5 retries, chờ lần lượt 10s, 60s, 300s, 900s, 1800s. HTTP timeout 5s; redirect không được follow.
- Worker dùng `FOR UPDATE SKIP LOCKED`, lease 30s và fencing token. Delivery có thể được gửi lại nếu worker chết sau gửi nhưng trước khi cập nhật DB: receiver cần deduplicate theo eventId.
- Chỉ cho phép URL thuộc các origin đã cấu hình. HTTP chỉ dành cho demo khi bật cờ. Không trả signing secret qua API.

## Kiểm tra chất lượng

```bash
npm run lint
npm run typecheck
npm run build
npm run test:coverage
npm run openapi
```

Test integration yêu cầu database riêng có tên kết thúc bằng `_test`, đã chạy migration. Test xóa dữ liệu trong database này để mỗi kịch bản độc lập.

```bash
docker compose exec db createdb -U topic4 topic4_test
# Export DATABASE_URL của database test trong terminal, thay mật khẩu local:
export DATABASE_URL="postgresql://topic4:YOUR_LOCAL_PASSWORD@localhost:5432/topic4_test"
npm run db:migrate
npm run test:integration
```

CI trong `.github/workflows/m2-backend.yml` tạo PostgreSQL 16/PostGIS 3.5, chạy migration, unit/HTTP tests, integration tests, export OpenAPI và Docker build. Workflow mới chỉ có thể được xác nhận trên GitHub sau khi nhánh được push.

OpenAPI được sinh vào `docs/api/openapi.json`. Chạy export sau khi đổi controller/DTO. File này có request, response, error schema và security contract.

## Ranh giới tích hợp

| Người nhận | Phần cần rà soát                                                                                      |
| ---------- | ----------------------------------------------------------------------------------------------------- |
| M1         | DTO booking, response fee, tasks, queue, timeline; token Bearer; lỗi 400/401/403/404/409/429          |
| M3         | Prisma schema/migration nền, PostGIS indexes, role enum, Auth/refresh, transition/history transaction |
| M4         | Unit/HTTP/integration tests, CI, Compose, coverage artifact, kiểm tra Docker trên môi trường của nhóm |

Chi tiết chênh lệch với đặc tả và vị trí code nằm trong `integration.md`. Kết quả test thực tế nằm trong `verification.md`.

Hướng dẫn chi tiết dành riêng cho M3: [BAN_GIAO_M2_CHO_M3.md](BAN_GIAO_M2_CHO_M3.md).
