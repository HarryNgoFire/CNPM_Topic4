# Bàn giao M2 cho M3 — CNPM Topic 4

Ngày: 11/10/2026. Repo: https://github.com/HarryNgoFire/CNPM_Topic4. Nhánh: `feature/m2-backend-services`. Baseline main: `e35a1de`. Tài liệu này đi cùng code trên nhánh; đọc thêm `docs/m2/README.md`, `integration.md`, `verification.md` và `docs/api/openapi.json`.

Draft PR: https://github.com/HarryNgoFire/CNPM_Topic4/pull/1. CI commit `35eb7e7` đã pass cả Docker build và PostGIS 3.5: https://github.com/HarryNgoFire/CNPM_Topic4/actions/runs/38116244964. Bản cập nhật tài liệu sau đó không đổi code nghiệp vụ.

## 1. M3 nhận những gì và cần chốt những gì

M2 đã triển khai Pricing, Dispatch, Webhooks, Shipment và Tracking. Auth/RBAC, Prisma schema, migration và state machine là nền chạy thử, cần M3 tiếp nhận hoặc thay bằng bản chính thức có cùng contract.

| Thành phần | Vị trí | Việc M3 cần làm |
|---|---|---|
| Schema và migration | `prisma/schema.prisma`, `prisma/migrations/` | Đối chiếu DB thực tế, giữ constraints/trigger hoặc viết migration nâng cấp |
| Prisma 7 | `prisma.config.ts`, `apps/api/src/database/` | Dùng một PrismaService với PrismaPg adapter; không tạo client mỗi request |
| Auth và quyền | `apps/api/src/common/security.ts`, `modules/auth/` | Giữ actor `{sub, role}`, decorator Public/Roles, kiểm active/role hiện hành từ DB |
| State machine | `modules/shipments/shipments.service.ts` | Giữ một điểm transition atomic với history và outbox |
| Pricing | `modules/pricing/` | Giữ version giá và snapshot bất biến |
| Dispatch | `modules/dispatch/`, `modules/drivers/` | Giữ khóa dòng, index active hai phía, expiry và idempotency |
| Webhooks | `modules/webhooks/` | Giữ outbox atomic, delivery riêng, lease và HMAC |
| Hợp đồng API | `docs/api/openapi.json` | Đồng bộ với M1 sau mỗi thay đổi DTO/response |
| Test và CI | `apps/api/test/`, `.github/workflows/m2-backend.yml` | M3 chạy khi tích hợp; M4 tiếp quản kiểm thử/deployment |

Ưu tiên thống nhất schema/Auth/state machine trước khi merge. Chưa có schema riêng của M3 trong repo tại thời điểm triển khai, nên bản này chưa chứng minh tương thích với database đang có của M3.

## 2. Lấy đúng code

```bash
git clone --branch feature/m2-backend-services https://github.com/HarryNgoFire/CNPM_Topic4.git
cd CNPM_Topic4
git status
git log -1 --oneline
```

Nếu đã clone, giữ thay đổi đang làm bằng commit hoặc stash trước khi chuyển nhánh; không dùng reset --hard để lấy bản M2:

```bash
git fetch origin
git switch feature/m2-backend-services
git pull --ff-only
# Tạo nhánh tích hợp riêng cho M3 từ bản M2:
git switch -c feature/m3-integration
```

Chạy lệnh npm/Docker tại thư mục gốc chứa `package.json`. Dùng Node **22.22.3** theo `.nvmrc`; Prisma CLI/client/adapter cùng **7.10.0**. Cài bằng `npm ci`, giữ lockfile. Không chạy npm audit fix --force hoặc tự nâng major khi tích hợp.

## 3. Chạy trên DATABASE MỚI bằng Docker

Chỉ dùng mục này khi DB trống. Docker Desktop phải đang chạy, cổng 5432/3001/4000 còn trống.

```bash
cp .env.example .env
```

Trên PowerShell có thể dùng `Copy-Item .env.example .env`. Sửa `.env` trước khi khởi động:

| Biến | Giá trị/ý nghĩa |
|---|---|
| POSTGRES_PASSWORD | Mật khẩu local mới; dùng hex hoặc chữ/số để tránh lỗi URL encoding |
| DATABASE_URL | `postgresql://topic4:<mật khẩu trên>@localhost:5432/topic4` cho npm trên máy |
| JWT_SECRET | Chuỗi ngẫu nhiên ít nhất 32 ký tự, thay giá trị mẫu |
| DEMO_PASSWORD | 10 ký tự trở lên, không quá 72 byte UTF-8 |
| WEBHOOK_RECEIVER_SECRET | Secret ngẫu nhiên ít nhất 32 ký tự, dùng cùng secret khi đăng ký subscription |
| WEBHOOK_ALLOWED_ORIGINS | `http://receiver:4000` cho Compose |
| WEBHOOK_ALLOW_HTTP | `true` chỉ cho demo local; dùng HTTPS ở deployment thật |
| CORS_ORIGIN | Origin frontend M1, mặc định `http://localhost:3000` |

Tạo từng secret bằng `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Không commit `.env`, token, backup DB hoặc secret. Compose thay DATABASE_URL của container sang hostname `db`; API chạy bằng npm dùng `localhost`.

```bash
docker compose up --build -d
docker compose run --rm migrate npm run db:seed
docker compose ps
docker compose logs --tail=100 migrate api
curl http://localhost:3001/api/v1/health
```

Swagger: http://localhost:3001/api/docs. Receiver: cổng 4000. Seed tạo Sender, Driver A/B, Dispatcher và Admin; email nằm trong `docs/m2/README.md`, password là DEMO_PASSWORD lần seed đầu. Seed không thay mật khẩu user đã tồn tại. Vị trí driver hết hạn sau 5 phút; cập nhật vị trí trước demo dài.

Dừng bằng `docker compose down`; volume DB được giữ. `docker compose down -v` xóa DB, chỉ dùng khi chủ động bỏ dữ liệu local disposable.

### Chạy API bằng npm, database bằng Docker

```bash
npm ci
npm run db:generate
docker compose up -d db
npm run db:migrate
npm run db:seed
npm run dev:api
```

Receiver ngoài container: `node --env-file=.env scripts/webhook-receiver.mjs`. Khi API cũng chạy ngoài container, đổi allowlist thành `http://localhost:4000` và đăng ký URL `http://localhost:4000/webhooks/shipment`. Không dùng hostname receiver từ API trên máy.

## 4. Nếu M3 ĐÃ CÓ DATABASE: tích hợp an toàn

**Không chạy baseline `202610110001_m2_baseline` trực tiếp lên database đang có bảng. Không reset DB để làm mất dữ liệu.** Migration nền tạo toàn bộ bảng/enum, chỉ dành cho DB mới.

1. Ghi lại commit code, version Postgres/PostGIS, schema và danh sách migration hiện tại. Backup trước thay đổi. Với DB Compose có thể dùng:

   ```bash
   docker compose exec -T db pg_dump -U topic4 -d topic4 -Fc > topic4-before-m3.dump
   ```

   Đây là file nhị phân; trên Windows dùng PowerShell 7.4+ hoặc công cụ pg_dump ghi trực tiếp `-f`, tránh shell cũ làm hỏng bytes. Backup phải được thử restore vào DB riêng trước khi coi là dùng được.
2. Tạo bản sao DB disposable. Trỏ DATABASE_URL vào bản sao, chạy `npx prisma migrate status`; giữ nguyên lịch sử migration M3. Đối chiếu `schema.prisma` và SQL baseline với DB thực tế.
3. Chốt schema hợp nhất và viết **migration nâng cấp mới** theo schema M3. Nếu chọn schema khác bản M2, sửa repository/raw SQL/DTO/test tương ứng. Không ghép hai migration khởi tạo toàn bộ bảng. Không dùng `migrate resolve --applied` để bỏ qua lỗi nếu chưa đối chiếu và xác nhận mọi object thực sự tồn tại đúng định nghĩa.
4. Test nâng cấp trên bản sao có dữ liệu, kiểm FK, số dòng, snapshot cũ, history, các index partial và trigger. Nếu dữ liệu cũ có hai assignment active cho một driver/shipment, phải giải quyết theo nghiệp vụ trước khi tạo unique index.
5. Chạy generate, lint, typecheck, build, unit, integration; kiểm luồng thực tế trên bản sao. Review SQL với nhóm trước khi chạy trên DB dùng chung.
6. Khi triển khai, tạm dừng ghi/worker theo quy trình nhóm, backup đã kiểm restore, chạy migration nâng cấp rồi khởi động đúng phiên bản API. Nếu lỗi, giữ log và trạng thái migration; sửa bằng migration tiếp theo sau khi xác định nguyên nhân. Không sửa/xóa history để vượt constraint.

Các điểm bắt buộc đối chiếu:

| Điểm | Contract M2 cần |
|---|---|
| PricingRule | Một bộ base/rate/threshold/multiplier có version nhất quán; nếu dùng ruleType phải có adapter gom nguyên bộ |
| Shipment | fee và feeBreakdown bất biến, breakdown có rule/version/distance |
| DriverAssignment | expiresAt, COMPLETED; unique active PENDING/ACCEPTED cho cả shipmentId và driverId |
| History | fromStatus có thể null ở RECEIVED; changedBy là User; append-only |
| Spatial | PostGIS geography(Point,4326), GiST index; ST_Distance trả mét |
| Webhook | Subscription + Event + Delivery; attempts, nextAttemptAt, lockedUntil, leaseToken |
| RefreshSession | Hash SHA-256 token, expiry/revocation, xoay vòng trong transaction |

Prisma không đọc trực tiếp field Unsupported geography; dùng parameterized SQL đang có. Không đổi sang geometry rồi giữ ST_Distance như cũ: geometry tọa độ lon/lat không trả mét như geography.

## 5. Contract API và Auth để M3 giữ tương thích

Base `/api/v1`; Bearer access token trong `Authorization`. Role chữ hoa. Sender chỉ xem đơn của mình; Driver chỉ truy cập nhiệm vụ liên quan, không suy ra quyền từ việc biết UUID. Public tracking chỉ có code/status/time/city/timeline, không lộ địa chỉ chi tiết/người gửi.

| Endpoint | Role |
|---|---|
| POST auth/register, login, refresh, logout | Public; đăng ký chỉ SENDER/DRIVER |
| POST pricing/quote; POST shipments | SENDER/ADMIN |
| GET shipments | SENDER/ADMIN/DISPATCHER |
| GET shipments/:id | SENDER/ADMIN/DISPATCHER/DRIVER với kiểm ownership |
| POST shipments/:id/transition | DRIVER/ADMIN, vẫn yêu cầu assignment ACCEPTED |
| POST shipments/:id/assign-driver; GET dispatch/queue | DISPATCHER/ADMIN |
| POST assignments/:id/respond; GET drivers/me/tasks; PATCH drivers/me/location/status | DRIVER |
| GET admin/pricing-rules; PUT admin/pricing-rules/:id | ADMIN |
| POST webhooks/subscriptions; GET webhooks/events | ADMIN |
| GET tracking/:trackingCode; GET health | Public |

Body booking đầy đủ trong README và Swagger. Không gửi fee từ client, không thêm field ngoài DTO. Respond dùng `{"action":"ACCEPT"}` hoặc REJECT; transition dùng `{"toStatus":"IN_TRANSIT"}` rồi OUT_FOR_DELIVERY, DELIVERED. Assign thủ công dùng `{"driverId":"<uuid>"}`; body `{}` là chọn tự động.

M3 thay Auth vẫn phải giữ `{sub, role}`, kiểm user active/role từ DB, ownership và decorators. SYSTEM không được login; client không được đăng ký ADMIN/DISPATCHER. Access token hiện 15 phút; refresh 7 ngày, token cũ bị revoke khi refresh. Refresh token trả JSON cho demo; chuyển HttpOnly cookie cần thống nhất cookie/CORS/CSRF với M1. Auth giới hạn 10 request/phút, có thể trả 429 khi thử liên tục.

## 6. Quy tắc transaction không được làm mất

- `ShipmentsService.create`: fee/address/parcel/shipment/history/event nằm cùng transaction. Gán driver sau booking commit; không có driver vẫn giữ đơn để worker thử lại.
- `ShipmentsService.transition`: khóa shipment, kiểm quyền, state, ghi history/outbox và giải phóng driver khi DELIVERED trong cùng transaction. Trình tự duy nhất: RECEIVED → IN_TRANSIT → OUT_FOR_DELIVERY → DELIVERED. ACCEPT chưa chuyển shipment sang IN_TRANSIT. Request lặp cùng trạng thái không sinh thêm event/history; kiểm quyền trước idempotency.
- Dispatch khóa shipment trước driver; giữ thứ tự khi bổ sung code để tránh deadlock. PENDING đã giữ chỗ driver; không chỉ dựa vào driver.status=AVAILABLE. ACCEPT chuyển BUSY; DELIVERED chuyển assignment COMPLETED và driver AVAILABLE.
- Vị trí mới tối đa 300s, bán kính auto 10km, expiry 300s, tối đa 5 lời mời tự động. Dispatcher chỉ định có thể vượt radius/lượt nhưng vẫn kiểm freshness/availability/constraint.
- Pricing dùng Decimal và half-up đến 1 VND. EXPRESS nhân cả subtotal. Không dùng JS float thay Decimal cho tiền. Giá booking tính lại theo rule đang hiệu lực; không giữ giá preview vĩnh viễn.
- Advisory lock pricing dùng `SELECT 1 AS locked FROM pg_advisory_xact_lock(84001)`; không trả cột void cho Prisma.
- `WebhooksService.record(tx, ...)` chỉ ghi DB. Gửi HTTP sau commit; không nhét request mạng vào transaction shipment.
- Worker webhook SKIP LOCKED, lease 30s và fencing token. Một event có delivery riêng từng subscription. Receiver kiểm HMAC đúng bytes raw JSON, deduplicate eventId bền vững. Toàn luồng có 4 event kể cả RECEIVED; subscription mới không nhận lịch sử cũ.
- Initial send + 5 retries: 10/60/300/900/1800s, timeout 5s, không follow redirect. Chỉ origin allowlist; signing secret không trả qua API. Việc mã hóa secret tại rest do M3 quyết định trước production.

Khi M3 có worker khác, không thêm một luồng update trạng thái/ghi event song song. Nhiều instance worker của implementation hiện tại được bảo vệ bằng khóa DB; rate limiter và receiver demo vẫn dùng bộ nhớ từng instance.

## 7. Kiểm thử trước khi bàn giao tiếp/merge

```bash
npm ci
npm run db:generate
npm run lint
npm run typecheck
npm run build
npm run test:coverage
npm run openapi
git diff -- docs/api/openapi.json
```

Nếu đổi API, review rồi commit OpenAPI mới. CI kiểm file sinh ra không lệch bản đã commit. Integration **xóa dữ liệu**: chỉ chạy DB riêng có tên kết thúc `_test`, không dùng DB demo/DB M3 dùng chung.

```bash
docker compose exec db createdb -U topic4 topic4_test
export DATABASE_URL="postgresql://topic4:YOUR_LOCAL_PASSWORD@localhost:5432/topic4_test"
npm run db:migrate
npm run test:integration
unset DATABASE_URL
```

PowerShell: `$env:DATABASE_URL="postgresql://topic4:YOUR_LOCAL_PASSWORD@localhost:5432/topic4_test"`; sau test dùng `Remove-Item Env:DATABASE_URL`. Nếu DB test đã tồn tại, không cần createdb lại. Khi trở về demo, bảo đảm không còn env shell ghi đè `.env`.

Kết quả local: 105 unit/HTTP + 22 integration = **127 pass** trên Node 22.22.3, PostgreSQL 16.15/PostGIS 3.4.6. Coverage 3 service M2: statements 99.50%, branches 94.87%, functions/lines 100%; không phải coverage toàn backend. Runtime audit 0 advisory tại thời điểm kiểm; dev tooling còn advisory, chi tiết verification.md. CI dùng PostGIS 3.5 và kiểm Docker build; xem trạng thái thật trên GitHub Actions trước merge.

Checklist demo bằng Swagger:

- [ ] Health OK, login Sender/Driver/Admin thành công.
- [ ] Quote và booking trả fee từ server; shipment ban đầu RECEIVED.
- [ ] Driver cập nhật location, nhận đúng task, ACCEPT; không có hai active assignments cho một driver.
- [ ] Ba transition đúng thứ tự; nhảy bước/driver khác bị từ chối.
- [ ] Tracking public đủ 4 mốc, không lộ dữ liệu riêng.
- [ ] Đăng ký webhook trước booking; nhận 4 event, chữ ký hợp lệ; retry không mất eventId.
- [ ] REJECT/timeout chuyển driver, không thêm mốc shipment giả.
- [ ] Rule mới không sửa phí shipment cũ; history và fee trigger hoạt động.
- [ ] Refresh token cũ không dùng lại được; Sender không xem đơn người khác.
- [ ] GitHub Actions của đúng commit pass; M1 kiểm response với giao diện.

## 8. Tra lỗi thường gặp

| Hiện tượng | Cách kiểm tra/xử lý |
|---|---|
| Prisma P1001 / không nối DB | docker compose ps/logs db; host localhost cho npm, db cho container; mật khẩu và cổng |
| Migration báo bảng/enum đã tồn tại | Đang dùng baseline trên DB có sẵn; dừng và làm mục 4, không reset |
| P3018 migration thất bại | Đọc lỗi SQL và trạng thái migration; sửa nguyên nhân trên bản sao trước, không đánh dấu applied tùy tiện |
| Không có extension geography/ST_Distance | Dùng image PostGIS, xác nhận extension postgis được tạo và quyền migration |
| API không khởi động với JWT secret | Thay giá trị mẫu bằng secret ngẫu nhiên đủ dài; kiểm env root |
| Prisma client chưa sinh | npm run db:generate sau npm ci/sửa schema |
| Swagger chạy nhưng booking không có driver | Kiểm Driver AVAILABLE, user active, location <=300s, radius và active assignment |
| Giá không bằng 75.300 | Tọa độ README khoảng 3,8km; 75.300 chỉ là test đầu vào 8,4km/5kg/EXPRESS |
| 409 assign/transition | Kiểm active assignment, assignment ACCEPTED và thứ tự state; không bypass constraint |
| 400 body | Đọc DTO/Swagger: UUID, số lat/lng, parcel dương, không gửi fee/field thừa |
| 401/403 | Token hết hạn, user inactive/role thay đổi, sai ownership; login đúng account |
| 429 khi demo login | Auth 10 request/phút; đợi hết window, không tắt guard trên bản dùng chung |
| Webhook không tới | URL phải truy cập được từ API, allowlist đúng origin, subscription tạo trước event; xem deliveries/log receiver |
| Chữ ký webhook sai | Secret hai bên giống nhau; verify raw body bytes trước parse/reserialize |
| Seed password không đổi | Seed giữ password user cũ; dùng cơ chế đổi mật khẩu có kiểm quyền hoặc DB demo mới |
| Docker đổi POSTGRES_PASSWORD nhưng không login được | Volume cũ giữ password lúc khởi tạo; cập nhật role bằng quyền DB hợp lệ hoặc tạo DB demo mới có chủ đích |
| Integration từ chối chạy | DBname phải kết thúc _test; tuyệt đối không bỏ guard để dùng DB thật |
| CI OpenAPI diff | npm run openapi, review/commit file JSON sinh lại |

## 9. Trình tự M3 bàn giao lại cho nhóm

1. Làm trên feature/m3-integration, commit migration/schema/Auth và adapter liên quan; không force push nhánh chung.
2. Ghi rõ schema nào được giữ/thay, migration áp dụng cho DB mới hay nâng cấp, env mới và kết quả test.
3. Mở PR cho nhánh tích hợp nhóm; nếu M2 chưa merge, ghi dependency M2 và thống nhất base để tránh PR trùng toàn bộ code.
4. Chỉ merge sau CI pass, SQL được review và demo M1/M3 hoàn tất. Không chạy migration production qua PR merge một cách ngầm định.
5. Giữ backup và ghi commit đã deploy. Các thay đổi schema phải có kế hoạch khôi phục được kiểm trên bản sao; rollback code đơn thuần có thể không tương thích schema mới.

Tài liệu này cung cấp quy trình tái lập và điểm kiểm soát cụ thể. Khả năng tích hợp với schema/Auth riêng của M3 phải được xác nhận bằng chính bản đó và dữ liệu thử tương ứng.
