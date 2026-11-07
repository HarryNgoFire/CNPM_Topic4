# Ghi chú phần M3 — Database, Auth, State machine

M3 tiếp nhận schema, migration, Auth/RBAC và state machine từ nền chạy thử của M2 (xem `docs/m2/BAN_GIAO_M2_CHO_M3.md`). Tài liệu này ghi lại những gì M3 đã thay đổi và việc các thành viên khác cần làm theo.

## Chuỗi migration

File `202610110001_m2_baseline` đã được tách thành chín migration nhỏ, mỗi file một miền nghiệp vụ. Schema kết quả giống hệt baseline; contract của Pricing, Dispatch và Webhooks không đổi.

| Thứ tự | Migration                                    | Nội dung                                                                             | Quy tắc liên quan         |
| -----: | -------------------------------------------- | ------------------------------------------------------------------------------------ | ------------------------- |
|      1 | `20261011120000_enable_postgis`              | Extension PostGIS                                                                    | Spatial DB                |
|      2 | `20261011120100_users_and_refresh_sessions`  | Enum `Role`, bảng `User`, `RefreshSession`                                           | FR-12                     |
|      3 | `20261011120200_drivers_and_addresses`       | Enum `DriverStatus`, bảng `Driver`, `Address`, GiST index vị trí tài xế              | FR-05                     |
|      4 | `20261011120300_shipments_and_parcels`       | Enum `ShipmentStatus`, `ServiceType`, bảng `Shipment`, `Parcel`, CHECK               | FR-01, FR-04, BR-TRACK-02 |
|      5 | `20261011120400_shipment_fee_snapshot_guard` | Trigger chặn sửa `fee`/`feeBreakdown`                                                | BR-PRICE-01, BR-PRICE-02  |
|      6 | `20261011120500_driver_assignments`          | Enum `AssignmentStatus`, bảng `DriverAssignment`, hai partial unique index           | BR-DISPATCH-01..03        |
|      7 | `20261011120600_shipment_status_history`     | Bảng `ShipmentStatusHistory`, trigger append-only                                    | FR-09, BR-AUDIT-01        |
|      8 | `20261011120700_pricing_rules`               | Bảng `PricingRule` có version, CHECK giá trị hợp lệ                                  | FR-03, BR-PRICE-02        |
|      9 | `20261011120800_webhook_outbox`              | Enum `DeliveryStatus`, bảng `WebhookSubscription`, `WebhookEvent`, `WebhookDelivery` | FR-10, BR-WEBHOOK-01      |

Migration thứ 10, `20261028120000_email_verification_and_accounts`, được thêm sau khi tách chuỗi: cột `User.emailVerified`, `User.createdAt` và bảng `EmailVerificationCode`.

### Kết quả review migration thứ 10

Migration này vào `main` tại commit `8f56a4d` mà chưa qua M3 review. M3 đã rà lại ngày 03/11/2026 và chấp nhận giữ nguyên, không cần migration sửa:

- Áp được lên database trống cùng chín migration trước; `prisma migrate status` báo schema đã cập nhật.
- `prisma migrate diff` chỉ khác ở `driver_location_gist`, là index viết tay mà Prisma không biểu diễn được. `schema.prisma` khớp với database thật.
- Tài khoản có từ trước được đánh dấu đã xác minh, nên không ai bị khóa khi nâng cấp.
- `EmailVerificationCode.userId` là khóa ngoại duy nhất dùng `ON DELETE CASCADE`: mã OTP không có giá trị lưu trữ khi tài khoản không còn.
- Bảng này chưa có job dọn mã hết hạn. Đây là việc còn lại, không ảnh hưởng tính đúng đắn.

### Cách đã kiểm chứng

Trên PostgreSQL 16.9 / PostGIS 3.5 và Node 22.22.3:

1. Áp baseline cũ lên một database trống, áp chuỗi mới lên một database trống khác.
2. Chạy `pg_dump --schema-only --no-owner --no-privileges` cho cả hai rồi `diff`: không có dòng nào khác nhau (13 bảng kể cả `_prisma_migrations`, 6 enum, 13 khóa ngoại, 15 index, 3 CHECK, 2 trigger).
3. Trên database dựng từ chuỗi mới: lint, typecheck, build, 105 test unit/HTTP, 22 test integration (số tại commit `a661cd5`; số hiện tại ở mục "Trạng thái kiểm thử") và export OpenAPI đều pass; `docs/api/openapi.json` không đổi.

### Nếu máy bạn đã chạy baseline cũ

Database local đã ghi `202610110001_m2_baseline` vào `_prisma_migrations`, nên `npm run db:migrate` sẽ dừng với `P3018 ... type "Role" already exists`. Database local chỉ chứa dữ liệu demo, hãy tạo lại:

```bash
docker compose down -v          # xóa volume database local
docker compose up --build -d
docker compose run --rm migrate npm run db:seed
```

Database test (`topic4_test`) cũng cần tạo lại trước khi chạy `npm run db:migrate`:

```bash
docker compose exec db dropdb -U topic4 --if-exists topic4_test
docker compose exec db createdb -U topic4 topic4_test
```

CI không bị ảnh hưởng vì mỗi lần chạy đều dùng database mới.

### Quy ước khi thêm migration

- Mỗi thay đổi schema là một migration mới, tên `YYYYMMDDHHMMSS_mo_ta_ngan`; không sửa migration đã push.
- Sửa `prisma/schema.prisma` cùng commit với migration tương ứng.
- Phần Prisma không biểu diễn được (geography, partial index, CHECK, trigger) viết tay trong `migration.sql`.
- Chạy `npm run test:integration` trên database có tên kết thúc `_test` trước khi mở PR.

## Sơ đồ

| Sơ đồ                            | Nguồn chỉnh sửa (draw.io)                                  | Ảnh dùng cho báo cáo                                    |
| -------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------- |
| ERD 13 bảng, ký pháp crow's-foot | `docs/architecture/diagrams/erd.drawio`                    | `docs/architecture/diagrams/erd.png`                    |
| State machine vòng đời Shipment  | `docs/architecture/diagrams/shipment-state-machine.drawio` | `docs/architecture/diagrams/shipment-state-machine.png` |

Mở file `.drawio` bằng app.diagrams.net hoặc draw.io Desktop. Khi schema hoặc luồng transition thay đổi, sửa file `.drawio` và xuất lại PNG trong cùng commit.

### Điểm khác so với mục 6.2 của tài liệu triển khai

Tài liệu triển khai mô tả 9 bảng ở mức khái niệm. Schema thực tế có 13 bảng vì các yêu cầu khác trong chính tài liệu đó, cùng phần xác minh email thêm sau này, cần thêm chỗ lưu:

- `RefreshSession`: mục 12.1 yêu cầu lưu hash của refresh token để thu hồi được.
- `EmailVerificationCode`: lưu hash mã OTP, hạn dùng và số lần thử của luồng xác minh email.
- `WebhookSubscription` và `WebhookDelivery`: mục 11.4 có API đăng ký URL nhận webhook; mỗi subscription cần trạng thái gửi và số lần thử riêng.
- `PricingRule`: một dòng là một bộ tham số đầy đủ có `version`, tránh ghép tham số của nhiều phiên bản khi tính phí.
- `ShipmentStatusHistory.fromStatus` cho phép NULL: mốc RECEIVED đầu tiên không có trạng thái trước đó.
- `DriverAssignment.expiresAt` và trạng thái `COMPLETED`: phục vụ BR-DISPATCH-02 và BR-DISPATCH-03.
- `Shipment.feeBreakdown`: lưu rule, version và khoảng cách đã dùng để tính `fee`.

## Bàn giao cho từng thành viên

| Người nhận | Cần đọc                       | Cần làm                                                                                                        |
| ---------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| M2         | Mục "Chuỗi migration"         | Tạo lại database local. Từ nay đổi schema bằng migration mới và gửi M3 review; không đưa lại file baseline cũ. |
| M1         | `docs/api/openapi.json`       | Sai mật khẩu hiện tại ở `PATCH users/me/password` giờ trả 400 thay vì 401. Giao diện chưa gửi vị trí tài xế, xem mục "Lưu ý khi demo". |
| M4         | Mục "Trạng thái kiểm thử"     | Workflow CI không cần sửa. Cập nhật số liệu trong `docs/m4/TEST_REPORT.md`: coverage giờ đo cả auth, users, shipments. Cổng 3001 chỉ mở trên loopback. |
| Cả nhóm    | `docs/architecture/diagrams/` | Dùng `erd.png` và `shipment-state-machine.png` cho phần Architecture & UML của báo cáo.                        |

## Trạng thái phần việc M3

Đối chiếu với mục 18 và 19 của tài liệu triển khai, cập nhật ngày 03/11/2026.

| Hạng mục                                         | Trạng thái | Vị trí                                                            |
| ------------------------------------------------ | ---------- | ----------------------------------------------------------------- |
| Schema, migration PostgreSQL/PostGIS             | Xong       | `prisma/`                                                         |
| AuthGuard + RolesGuard theo ma trận RBAC         | Xong       | `apps/api/src/common/security.ts`                                 |
| bcrypt, JWT, refresh token thu hồi được          | Xong       | `apps/api/src/modules/auth/`                                      |
| `canTransition` và transition có khóa dòng       | Xong       | `apps/api/src/modules/shipments/`                                 |
| Unique index và transaction chống gán trùng      | Xong       | `prisma/migrations/`, `dispatch.service.ts`                       |
| History và WebhookEvent ghi nguyên tử            | Xong       | `shipments.service.ts`, test BR-STATE-03                          |
| OpenAPI 3.1 sinh từ code                         | Xong       | `docs/api/openapi.json`, `apps/api/src/common/openapi-responses.ts` |
| Seed dữ liệu mẫu cho demo                        | Xong       | `scripts/seed.ts`                                                 |
| Phần data model và security trong báo cáo        | Xong       | [DATA_MODEL_SECURITY.md](DATA_MODEL_SECURITY.md)                  |
| Rà toàn bộ migration                             | Xong       | Mục "Kết quả review migration thứ 10"                             |

## Trạng thái kiểm thử

Chạy ngày 08/11/2026 trên bản gộp của các nhánh M3 sau khi rebase lên `main` tại `a2f7379`, trong container Node 22.22.3 và PostgreSQL 16/PostGIS 3.5:

| Kiểm tra                                        | Kết quả                            |
| ----------------------------------------------- | ---------------------------------- |
| lint, typecheck, build, OpenAPI không lệch      | Pass                               |
| Unit và HTTP                                    | 295 pass                           |
| Integration trên PostGIS                        | 40 pass, gồm ST-01..08             |
| `docker compose up` từ volume trống             | Pass ngay lần đầu, gồm cả ảnh API  |
| `scripts/qa/smoke-flow.ps1` trên Compose        | 12/12                              |
| Coverage `state-machine.ts`, `security.ts`      | 100%                               |
| Coverage toàn bộ phần đo được                   | 75,49% câu lệnh                    |

Con số 75,49% thấp hơn các báo cáo trước vì phạm vi đo đã rộng hơn. `auth.service.ts` và `users.service.ts` chủ yếu được kiểm bằng integration test, nên coverage ở mức unit thấp (45% và 17%).

## Lưu ý khi demo

- Vị trí tài xế hết hạn sau 300 giây và giao diện web chưa gửi vị trí. Hãy chạy lại `npm run db:seed` ngay trước demo, hoặc đặt `MAX_LOCATION_AGE_SECONDS` lớn hơn trong `.env`. Nếu không, đơn mới sẽ không tìm được tài xế.
- Seed tạo sẵn đơn đã giao với mã `MOVEFLOWDEMO0001` để minh họa tra cứu công khai.
- Muốn thử đăng ký mà không gửi email thật, đặt `EMAIL_DELIVERY_MODE=console` và `NODE_ENV=development` trong `.env`, rồi đọc mã bằng `docker compose logs api`. Image API mặc định chạy `NODE_ENV=production`, ở chế độ đó console bị từ chối và đăng ký trả 503.
- Seed không đổi mật khẩu của tài khoản đã tồn tại. Nếu đổi `DEMO_PASSWORD` sau lần seed đầu, mật khẩu cũ vẫn có hiệu lực.
