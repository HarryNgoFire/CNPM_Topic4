# Báo cáo kiểm thử — M4 (QA)

## 1. Thông tin lần chạy

| Mục | Giá trị |
|---|---|
| Ngày chạy | 2026-10-18 |
| Commit được kiểm thử | `d59b716` (đầu nhánh M2 tại thời điểm chạy; các file test của M4 được thêm lên trên commit này) |
| Nhánh | `feature/m4-testing` (tách từ `feature/m2-backend-services`, đã gồm 9 migration của M3) |
| Môi trường | Windows PowerShell 5.1, Node v24.22.0 (CI/Docker dùng 22.22.3), npm 11.19.1, Docker 29.8.2, Compose v5.6.0 |
| Người chạy | M4 |
| Pull Request | [#5](https://github.com/HarryNgoFire/CNPM_Topic4/pull/5) (nhắm vào nhánh `feature/m2-backend-services`) |

Phạm vi: kiểm thử từ dưới lên: Database (M3) → Backend trên Database (M2 + M3) → Backend (M2). Tầng giao diện (M1) chưa thực hiện vì repo chưa có frontend.

## 2. Kết quả theo tầng

### Tầng 1 — Database (M3)

| Kiểm tra | Kết quả | Ghi chú |
|---|---|---|
| `docker compose up` lần đầu (volume trống) | **FAIL** | `migrate` thoát mã 1 với `ECONNREFUSED`, `api` không khởi động. Tái hiện được. Xem B01 |
| Workaround: chạy `docker compose up -d` lần hai | Pass | `migrate` thoát mã 0, `api` lên, `/health` trả `ok` |
| Áp migration trên DB trống (`topic4_test`) | Pass | Đủ 9 migration, guard `check-migration-history` báo tương thích với series M3 |
| `prisma migrate status` | Pass | 9 migration, "Database schema is up to date" |
| `prisma validate` | Pass | Schema hợp lệ |
| `db:seed` chạy lần hai | Pass | Không lỗi, seed lặp lại được. Seed giữ nguyên mật khẩu đã có ("Existing passwords are preserved") |
| `scripts/qa/db-checks.sql` | **5/5 PASS** | Fee snapshot bất biến, lịch sử chỉ thêm (DELETE bị chặn), cân nặng > 0, giá không âm, không xóa user có dữ liệu liên quan |
| PostGIS, index, trigger | Pass | PostGIS 3.5; đủ 3 index (`one_active_assignment_per_shipment`, `one_active_assignment_per_driver`, `driver_location_gist`) và 2 trigger |
| Seed | Pass | SENDER 1, DRIVER 2, DISPATCHER 1, ADMIN 1 |
| Khoảng cách địa lý (PostGIS geography) | Pass | 4.315 m giữa hai điểm mẫu (kỳ vọng xấp xỉ 4.300 m) |
| Dữ liệu còn sau `docker compose down` rồi `up -d` | Pass | Số đơn hàng giữ nguyên (2) |

Giới hạn của kiểm tra: dòng "không xóa user có đơn" thực tế bị chặn bởi khóa ngoại của `RefreshSession`, không phải của `Shipment`. Ràng buộc FK của `Shipment` chưa được kiểm riêng.

### Tầng 2 — Backend trên Database (M2 + M3)

| Kiểm tra | Kết quả | Ghi chú |
|---|---|---|
| Integration test (`topic4_test`) | **23/23 pass** (46,5 s) | Tài liệu M3 ghi 22. Xem D01 |
| `scripts/qa/smoke-flow.ps1` | **12/12 PASS** | Đặt đơn → tài xế gần nhất nhận → 3 lần chuyển trạng thái → tracking công khai |
| Tracking công khai | Pass | Trả đúng 6 field, không lộ `senderId` |
| Webhook receiver | Pass có ghi chú | 8 event cho 2 đơn (đủ 4 event/đơn). Xem B02, B03 |
| `GET /health` | Pass | |

### Tầng 3 — Backend (M2)

| Kiểm tra | Kết quả |
|---|---|
| `lint`, `typecheck`, `build` | Sạch (kể cả test của M4) |
| Test unit + HTTP của M2 | 105 pass (xác nhận con số M2 ghi) |
| Test QA bổ sung của M4 | **118 pass** |
| **Tổng** | **223 test pass, 9 suite** |
| CI GitHub Actions (nhánh M4) | Pass: run #9 (push, 2m5s) và run #10 (Pull Request #5, 1m44s) |

Test QA của M4:

| File | Số test | Nội dung |
|---|---|---|
| `state-machine-matrix.spec.ts` | 18 | Cả 16 cặp trạng thái; `DELIVERED` là trạng thái cuối; trạng thái không tồn tại bị từ chối |
| `rbac-matrix.spec.ts` | 75 | 15 endpoint × (không token + 4 vai trò): đúng 401/403 |
| `auth-service.spec.ts` | 17 | Giới hạn 72 byte UTF-8, email chữ thường, bcrypt cost 12, hồ sơ tài xế, 409 trùng email, đăng nhập thất bại, refresh token chỉ lưu dạng SHA-256, xoay token, đăng xuất idempotent |
| `shipments-service.spec.ts` | 8 | Thử lại khi trùng tracking code (tối đa 3 lần rồi 409); người gửi chỉ thấy đơn của mình; phân trang |

Lưu ý phạm vi: test RBAC dùng service giả (mock) nên chỉ kiểm tra phân quyền ở tầng guard. Quyền sở hữu dữ liệu (người gửi A không xem được đơn của B) được kiểm bởi integration test của M2.

### Coverage

| File | Config M2 (3 service) | Đo đủ 5 service, trước test bổ sung | Sau test bổ sung |
|---|---|---|---|
| pricing.service.ts | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |
| dispatch.service.ts | 99,07 / 92,5 / 100 / 100 | 99,07 / 92,5 / 100 / 100 | 99,07 / 92,5 / 100 / 100 |
| webhooks.service.ts | 100 / 96 / 100 / 100 | 100 / 96 / 100 / 100 | 100 / 96 / 100 / 100 |
| shipments.service.ts | không đo | 92,85 / 75 / 100 / 93,54 | 98,57 / 96,42 / 100 / 100 |
| auth.service.ts | không đo | **30 / 0 / 14,28 / 26,31** | 100 / 100 / 100 / 100 |
| common/security.ts | không đo | 100 / 100 / 100 / 100 | 100 / 100 / 100 / 100 |
| **Tổng** | 99,5 / 94,87 / 100 / 100 | 90,25 / 78,83 / 89,47 / 89,64 | **99,42 / 96,35 / 100 / 100** |

(Các cột là % Statements / Branches / Functions / Lines.) Con số 99,5% trong báo cáo của M2 chỉ tính 3 trong 5 service; xem D03.

### Thăm dò đầu vào sai định dạng (negative testing)

| Yêu cầu | Kết quả | Đánh giá |
|---|---|---|
| `GET /shipments?page=99999999999&limit=100` | 200 | Không lỗi. (Giả thuyết ban đầu "có thể trả 500" **không đúng**) |
| `?page=0`, `?limit=101`, `?limit=abc`, `?status=FAILED` | 400 | Đúng |
| `GET /shipments/not-a-uuid` | 400 | Đúng |
| `GET /shipments/<uuid không tồn tại>` | 404 | Đúng |
| `GET /tracking/AAAAAAAAAAAAAAAA` (đúng định dạng, không tồn tại) | 404 | Đúng |
| `GET /tracking/short` | 400 | Đúng |
| `GET /tracking/' OR 1=1--` | 400 | Chuỗi bị chặn bởi kiểm tra định dạng |
| 12 lần đăng nhập sai liên tiếp | 10 lần 401, rồi 429 | Giới hạn tốc độ hoạt động đúng thiết kế (10 lần/phút) |

Kết quả: 0 lỗi 500 trong tất cả các yêu cầu thăm dò.

### Tầng 4 — Giao diện (M1)

Chưa thực hiện: repo chưa có frontend (`apps/web`). Kế hoạch: viết E2E Playwright cho luồng đặt hàng và tra cứu tracking khi M1 có giao diện, thống nhất `data-testid` với M1.

## 3. Lỗi và phát hiện

| ID | Mức độ | Mô tả | Issue | Trạng thái |
|---|---|---|---|---|
| B01 | Trung bình | Lần chạy Compose đầu tiên: `migrate` lỗi `ECONNREFUSED`, `api` không khởi động. Nghi ngờ do healthcheck `pg_isready` kiểm tra qua unix socket nên báo `healthy` khi TCP chưa mở. Gợi ý: `pg_isready -h 127.0.0.1 ...`. Workaround: chạy `up -d` lần hai | [#2](https://github.com/HarryNgoFire/CNPM_Topic4/issues/2) | Open |
| B02 | Thấp–Trung bình | Đăng ký trùng URL tạo nhiều subscription; mỗi event có 2 delivery (đã xác nhận trên DB: 2 subscription, mỗi event 2 delivery). Receiver deduplicate nên không thấy | [#3](https://github.com/HarryNgoFire/CNPM_Topic4/issues/3) | Open |
| B03 | Thấp (tài liệu) | Webhook đến sai thứ tự so với `occurredAt` (quan sát ở cả hai đơn), tài liệu chưa nói rõ không đảm bảo thứ tự | [#4](https://github.com/HarryNgoFire/CNPM_Topic4/issues/4) | Open |
| D01 | Thấp (tài liệu) | README của M3 ghi 22 integration test, thực tế 23 | — | Ghi nhận |
| D02 | Thấp | `npm ci` không tự tạo Prisma Client, người mới gặp lỗi TypeScript khó hiểu. Gợi ý `postinstall: prisma generate` hoặc ghi rõ trong README | — | Ghi nhận |
| D03 | Thấp–Trung bình | Coverage tiêu đề (99,5%) không đo state machine (`shipments.service.ts`), `auth.service.ts` và `security.ts`. Khi đo đủ, `auth.service.ts` chỉ đạt 30% ở mức unit test. Gợi ý mở rộng `collectCoverageFrom` | — | Đã bổ sung test, chờ M2 mở rộng cấu hình |

Quan sát khác (không phải lỗi):
- Mã tracking chỉ chấp nhận chữ hoa (chữ thường trả 400), cần báo M1 để giao diện tự chuyển chữ hoa.
- Seed không ghi đè mật khẩu của user đã tồn tại. Nếu đổi `DEMO_PASSWORD` trong `.env` sau lần seed đầu thì mật khẩu đăng nhập vẫn là giá trị cũ, dễ gây lỗi 401 khó hiểu. Nên ghi rõ trong README.

## 4. Kết luận và rủi ro còn lại

- Database (M3) hoạt động đúng thiết kế ở mọi kiểm tra đã thực hiện; backend (M2) chạy đúng trên schema này (23/23 integration test và luồng giao hàng 12/12).
- Điểm yếu đáng xử lý nhất: B01 (người mới chạy Compose lần đầu có thể không có API).
- Rủi ro còn lại:
  - Rate limiter lưu trong bộ nhớ, chỉ đúng khi chạy một instance (M2 đã tự ghi nhận).
  - 34 cảnh báo `npm audit` ở dev dependencies (chủ yếu từ Jest 29.7), chưa xử lý, cần PR riêng.
  - Máy kiểm thử dùng Node 24, CI và Docker dùng Node 22.22.3.
  - Chưa đo coverage của integration test; chưa có E2E giao diện.
  - Receiver demo deduplicate trong bộ nhớ; hệ thống bên ngoài cần lưu `eventId` bền vững.
