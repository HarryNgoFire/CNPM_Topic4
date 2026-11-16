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
|     10 | `20261028120000_email_verification_and_accounts` | Cột `User.emailVerified`, `User.createdAt`, bảng `EmailVerificationCode`         | FR-12                     |
|     11 | `20261110020000_two_stage_delivery_state`    | Thêm 5 giá trị `ShipmentStatus`, cột `reason` trên `Shipment` và `ShipmentStatusHistory` | BR-STATE-01..05       |
|     12 | `20261110030000_driver_location_metadata`    | Cột `Driver.locationAccuracyM`, `Driver.locationCapturedAt`                          | BR-STATE-05               |

Migration 10–12 được thêm sau đợt tách baseline, cùng các tính năng xác minh email OTP và giao hai chặng. Bảng transition mới nằm ở [`STATE_MACHINE.md`](STATE_MACHINE.md).

### Kết quả review migration 10–12

Ba migration này vào `main` (tại `8f56a4d` và qua PR #14) mà chưa qua M3 review. M3 đã rà lại và chấp nhận giữ nguyên, không cần migration sửa:

- Cả chuỗi 12 migration áp được lên database trống, cho 13 bảng, 6 enum, 14 khóa ngoại, 17 index ngoài khóa chính, 3 CHECK và 2 trigger. `prisma migrate diff` từ database sang `schema.prisma` chỉ báo khác ở `driver_location_gist`, là GiST index viết tay mà Prisma không biểu diễn được, nên `schema.prisma` khớp với database thật.
- Migration 10: tài khoản có từ trước được đánh dấu đã xác minh, nên không ai bị khóa khi nâng cấp. `EmailVerificationCode.userId` là khóa ngoại duy nhất dùng `ON DELETE CASCADE`: mã OTP không có giá trị lưu trữ khi tài khoản không còn. Bảng này chưa có job dọn mã hết hạn; đây là việc còn lại, không ảnh hưởng tính đúng đắn.
- Migration 11 chỉ thêm giá trị enum và cột cho phép NULL, nên đơn cũ đọc được ngay. `IN_TRANSIT` được giữ lại có chủ đích để đơn tạo trước ngày 10/11 vẫn đi tiếp được; không có transition nào đi vào trạng thái này nữa.
- Migration 12 thêm hai cột cho phép NULL có `COMMENT`; dòng cũ không có độ chính xác GPS sẽ không qua được geofence cho tới khi tài xế gửi vị trí mới, đúng với ý đồ.

### Cách đã kiểm chứng

Trên PostgreSQL 16.9 / PostGIS 3.5 và Node 22.22.3:

1. Áp baseline cũ lên một database trống, áp chuỗi mới lên một database trống khác.
2. Chạy `pg_dump --schema-only --no-owner --no-privileges` cho cả hai rồi `diff`: không có dòng nào khác nhau (13 bảng kể cả `_prisma_migrations`, 6 enum, 13 khóa ngoại, 15 index, 3 CHECK, 2 trigger).
3. Trên database dựng từ chuỗi mới: lint, typecheck, build, 105 test unit/HTTP, 22 test integration và export OpenAPI đều pass; `docs/api/openapi.json` không đổi. Đây là số tại thời điểm tách chuỗi; số hiện tại ở mục "Trạng thái kiểm thử".

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
| State machine giao hai chặng, 9 trạng thái | `docs/architecture/diagrams/shipment-state-machine.drawio` | `docs/architecture/diagrams/shipment-state-machine.png` |

Mở file `.drawio` bằng app.diagrams.net hoặc draw.io Desktop. Khi schema hoặc luồng transition thay đổi, sửa file `.drawio` và xuất lại PNG trong cùng commit.

### Điểm khác so với mục 6.2 của tài liệu triển khai

Tài liệu triển khai mô tả 9 bảng ở mức khái niệm. Schema thực tế có 13 bảng vì các yêu cầu khác trong chính tài liệu đó cần thêm chỗ lưu:

- `RefreshSession`: mục 12.1 yêu cầu lưu hash của refresh token để thu hồi được.
- `EmailVerificationCode`: lưu hash mã OTP 6 số, hạn 10 phút, tối đa 5 lần nhập sai, phục vụ xác minh email khi đăng ký.
- `WebhookSubscription` và `WebhookDelivery`: mục 11.4 có API đăng ký URL nhận webhook; mỗi subscription cần trạng thái gửi và số lần thử riêng.
- `PricingRule`: một dòng là một bộ tham số đầy đủ có `version`, tránh ghép tham số của nhiều phiên bản khi tính phí.
- `ShipmentStatusHistory.fromStatus` cho phép NULL: mốc RECEIVED đầu tiên không có trạng thái trước đó.
- `DriverAssignment.expiresAt` và trạng thái `COMPLETED`: phục vụ BR-DISPATCH-02 và BR-DISPATCH-03.
- `Shipment.feeBreakdown`: lưu rule, version và khoảng cách đã dùng để tính `fee`.

## Bàn giao cho từng thành viên

| Người nhận | Cần đọc                       | Cần làm                                                                                                        |
| ---------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| M2         | Mục "Chuỗi migration"         | Tạo lại database local. Từ nay đổi schema bằng migration mới và gửi M3 review; không đưa lại file baseline cũ. |
| M1         | `docs/api/openapi.json`       | Sai mật khẩu hiện tại ở `PATCH users/me/password` giờ trả 400 thay vì 401, nên giao diện không còn tự làm mới phiên rồi gọi lại. OpenAPI có thêm schema response cho mọi endpoint. |
| M4         | Mục "Trạng thái kiểm thử"     | Workflow CI không cần sửa. Coverage giờ đo thêm shipments (state machine), auth, users và guard; cập nhật số trong `docs/m4/TEST_REPORT.md`. Cổng 3001 chỉ mở trên loopback, gọi API qua nginx ở cổng 3005. |
| Cả nhóm    | `docs/architecture/diagrams/` | Dùng `erd.png` và `shipment-state-machine.png` cho phần Architecture & UML của báo cáo.                        |

## Trạng thái phần việc M3

Đối chiếu với mục 18 và 19 của tài liệu triển khai, cập nhật ngày 17/11/2026.

| Hạng mục                                         | Trạng thái | Vị trí                                                              |
| ------------------------------------------------ | ---------- | ------------------------------------------------------------------- |
| Schema, migration PostgreSQL/PostGIS             | Xong       | `prisma/`                                                           |
| AuthGuard + RolesGuard theo ma trận RBAC         | Xong       | `apps/api/src/common/security.ts`                                   |
| bcrypt, JWT, refresh token thu hồi được          | Xong       | `apps/api/src/modules/auth/`                                        |
| `canTransition` và transition có khóa dòng       | Xong       | `apps/api/src/modules/shipments/state-machine.ts`, `shipments.service.ts` |
| Unique index và transaction chống gán trùng      | Xong       | `prisma/migrations/`, `dispatch.service.ts`                         |
| History và WebhookEvent ghi nguyên tử            | Xong       | `shipments.service.ts`, test rollback trong `workflow.integration.spec.ts` |
| Rate limit đúng theo người dùng sau nginx        | Xong       | `apps/api/src/bootstrap.ts`, `compose.yaml`                         |
| OpenAPI 3.1 sinh từ code                         | Xong       | `docs/api/openapi.json`, `apps/api/src/common/openapi-responses.ts` |
| Seed dữ liệu mẫu cho demo                        | Xong       | `scripts/seed.ts`                                                   |
| Phần data model và security trong báo cáo        | Xong       | [DATA_MODEL_SECURITY.md](DATA_MODEL_SECURITY.md)                    |
| Rà toàn bộ migration                             | Xong       | Mục "Kết quả review migration 10–12"                                |

## Trạng thái kiểm thử

Chạy ngày 17/11/2026 trên bản gộp #8–#11 sau khi rebase lên `main` tại `513f80a`, trong container Node 22.22.3 và PostgreSQL 16/PostGIS 3.5, theo đúng các bước của workflow CI:

| Kiểm tra                                        | Kết quả                                   |
| ----------------------------------------------- | ----------------------------------------- |
| lint, typecheck, build, OpenAPI không lệch      | Pass                                      |
| Unit và HTTP                                    | 500 pass                                  |
| Integration trên PostGIS                        | 45 pass, gồm ST-01..ST-11                 |
| Test web (`node:test`)                          | 52 pass                                   |
| `npm run db:seed` hai lần trên database mới     | Pass                                      |
| `docker build` với `npm ci`                     | Pass                                      |
| Coverage `state-machine.ts`, `security.ts`      | 100%                                      |
| Coverage `shipments.service.ts`                 | 90,86% câu lệnh                           |
| Coverage toàn bộ phần đo được                   | 80,15% câu lệnh, 72,30% nhánh             |

Phạm vi đo giờ gồm Pricing, Dispatch, Webhooks, Shipments, Auth, Users và guard, nên con số thấp hơn mức 96,79% khi chỉ đo ba module. `auth.service.ts` và `users.service.ts` chủ yếu được kiểm bằng integration test, nên coverage ở mức unit thấp (45% và 17%).

## Lưu ý khi demo

- Seed tạo sẵn đơn đã giao với mã `MOVEFLOWDEMO0001` để minh họa tra cứu công khai và lịch sử chuyến của tài xế.
- Muốn thử đăng ký mà không gửi email thật, đặt `EMAIL_DELIVERY_MODE=console` và `NODE_ENV=development` trong `.env`, rồi đọc mã bằng `docker compose logs api`. Image API mặc định chạy `NODE_ENV=production`, ở chế độ đó console bị từ chối và đăng ký trả 503.
- Seed không đổi mật khẩu của tài khoản đã tồn tại. Nếu đổi `DEMO_PASSWORD` sau lần seed đầu, mật khẩu cũ vẫn có hiệu lực.
- Báo "đã tới" cần vị trí tài xế mới hơn 30 giây. Khi trình bày trong phòng, dùng Demo Tools để giả lập GPS thay vì GPS thật của máy.
