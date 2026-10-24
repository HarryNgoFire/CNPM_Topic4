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

### Cách đã kiểm chứng

Trên PostgreSQL 16.9 / PostGIS 3.5 và Node 22.22.3:

1. Áp baseline cũ lên một database trống, áp chuỗi mới lên một database trống khác.
2. Chạy `pg_dump --schema-only --no-owner --no-privileges` cho cả hai rồi `diff`: không có dòng nào khác nhau (13 bảng kể cả `_prisma_migrations`, 6 enum, 13 khóa ngoại, 15 index, 3 CHECK, 2 trigger).
3. Trên database dựng từ chuỗi mới: lint, typecheck, build, 105 test unit/HTTP, 22 test integration và export OpenAPI đều pass; `docs/api/openapi.json` không đổi.

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
| ERD 12 bảng, ký pháp crow's-foot | `docs/architecture/diagrams/erd.drawio`                    | `docs/architecture/diagrams/erd.png`                    |
| State machine vòng đời Shipment  | `docs/architecture/diagrams/shipment-state-machine.drawio` | `docs/architecture/diagrams/shipment-state-machine.png` |

Mở file `.drawio` bằng app.diagrams.net hoặc draw.io Desktop. Khi schema hoặc luồng transition thay đổi, sửa file `.drawio` và xuất lại PNG trong cùng commit.

### Điểm khác so với mục 6.2 của tài liệu triển khai

Tài liệu triển khai mô tả 9 bảng ở mức khái niệm. Schema thực tế có 12 bảng vì các yêu cầu khác trong chính tài liệu đó cần thêm chỗ lưu:

- `RefreshSession`: mục 12.1 yêu cầu lưu hash của refresh token để thu hồi được.
- `WebhookSubscription` và `WebhookDelivery`: mục 11.4 có API đăng ký URL nhận webhook; mỗi subscription cần trạng thái gửi và số lần thử riêng.
- `PricingRule`: một dòng là một bộ tham số đầy đủ có `version`, tránh ghép tham số của nhiều phiên bản khi tính phí.
- `ShipmentStatusHistory.fromStatus` cho phép NULL: mốc RECEIVED đầu tiên không có trạng thái trước đó.
- `DriverAssignment.expiresAt` và trạng thái `COMPLETED`: phục vụ BR-DISPATCH-02 và BR-DISPATCH-03.
- `Shipment.feeBreakdown`: lưu rule, version và khoảng cách đã dùng để tính `fee`.

## Bàn giao cho từng thành viên

| Người nhận | Cần đọc                       | Cần làm                                                                                                        |
| ---------- | ----------------------------- | -------------------------------------------------------------------------------------------------------------- |
| M2         | Mục "Chuỗi migration"         | Tạo lại database local. Từ nay đổi schema bằng migration mới và gửi M3 review; không đưa lại file baseline cũ. |
| M1         | `docs/api/openapi.json`       | Không phải sửa gì: hợp đồng API giữ nguyên.                                                                    |
| M4         | Mục "Cách đã kiểm chứng"      | Workflow CI không cần sửa. Tạo lại `topic4_test` trên máy trước khi chạy integration test.                     |
| Cả nhóm    | `docs/architecture/diagrams/` | Dùng `erd.png` và `shipment-state-machine.png` cho phần Architecture & UML của báo cáo.                        |
