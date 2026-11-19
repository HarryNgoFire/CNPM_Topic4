# Báo cáo kiểm thử — M4 (QA) — MoveFlow

> Báo cáo này thay thế bản ghi nhận trên commit `a2f7379`. Mọi con số là kết quả thật của các lần chạy ghi ở mục 1. Mục nào chưa chạy lại trên commit này thì ghi rõ "chưa chạy lại" (xem mục 7). Không gán số liệu của bản cũ cho commit hiện tại.

## 1. Thông tin lần chạy

| Mục | Giá trị |
|---|---|
| Ngày chạy | 2026-11-17 đến 2026-11-18 |
| Commit kiểm thử | `513f80a` (nhánh `main`, merge PR #14) |
| Môi trường | Windows PowerShell 5.1, Node v24.22.0 (CI/Docker dùng 22.22.3), npm 11.19.1, Docker 29.8.2, Compose v5.6.0 |
| Người chạy | M4 |
| Phiên bản hệ thống | Vòng đời đơn 9 trạng thái (2 chặng), geofence 100 m, kiểm tra GPS phía máy chủ, OTP email, giao diện MoveFlow (cổng 3005), API (cổng 3001) |

Phương pháp: kiểm thử từ dưới lên (Database → Backend trên Database → Backend → Giao diện), mỗi tầng có tiêu chí đạt riêng.

## 2. Kết quả theo tầng

### Tầng 1 — Database

| Kiểm tra | Kết quả | Ghi chú |
|---|---|---|
| Dựng từ DB trống, áp dụng migration | **Pass** | Đủ **12** migration, `migrate` thoát mã 0 ngay lần đầu |
| Lỗi `ECONNREFUSED` ở lần chạy Compose đầu (B01) | **Đã sửa** | Retest trên `513f80a`: không còn lỗi (healthcheck dùng `pg_isready -h 127.0.0.1`) |
| Dữ liệu còn sau `docker compose down` rồi `up -d` | **Pass** | Hệ thống lên lại, API healthy; dữ liệu cũ (lời giao việc của tài xế A) vẫn còn |
| `scripts/qa/db-checks.sql` (ràng buộc, trigger, index, PostGIS) | Chưa chạy lại | Đã chạy trên `a2f7379`: 5/5 PASS. Cần chạy lại do thêm 2 migration |

### Tầng 2 — Backend trên Database

| Kiểm tra | Kết quả | Ghi chú |
|---|---|---|
| Integration test (PostgreSQL/PostGIS thật, DB `_test`) | **27/27 pass** | Gồm luồng đặt đơn→gán→giao→tracking→webhook, quyền riêng tư vị trí trực tiếp, điều hướng theo giai đoạn và geofence, đơn `IN_TRANSIT` cũ, giới hạn tần suất GPS |
| Khởi động hệ thống (5 dịch vụ) | **Pass** | `db`, `migrate`, `api`, `web`, `receiver`; health `ok`, trang web trả 200 |
| `scripts/qa/smoke-flow.ps1` (luồng 9 trạng thái, 43 kiểm tra) | **43/43 pass** | Geofence và kiểm tra GPS do máy chủ thực thi; hủy bắt buộc có lý do; tracking công khai không lộ dữ liệu riêng tư |
| `scripts/qa/probe-sender-transition.ps1` (phân quyền chuyển trạng thái) | **7/7 bị chặn** | Người gửi (5 lần thử các trạng thái), tài xế không được giao và điều phối viên đều nhận 403; đơn giữ nguyên `RECEIVED` |

### Tầng 3 — Backend và Frontend (kiểm thử tự động)

| Kiểm tra | Kết quả |
|---|---|
| `lint`, `typecheck`, `build` | **Sạch** |
| Test backend (Jest) | **405 pass, 12 suite**, 0 fail |
| Test frontend (`npm run test:web`, Node test runner) | **52/52 pass** |
| `npm audit --omit=dev` (phần chạy thật) | **0 lỗ hổng** |
| `npm audit` (cả công cụ phát triển) | 46 lỗ hổng (1 nghiêm trọng, 39 cao, 6 trung bình), **đều nằm ở phần phát triển** |
| `docker build`, `npm run openapi` + `git diff` | Chưa chạy lại trên `513f80a` |
| CI | Workflow hiện chưa chạy `test:web` (xem F4) |

Coverage theo cấu hình hiện tại của nhóm (chỉ đo `dispatch`, `pricing`/`routing`, `webhooks`):

| File | % Statements | % Branch | % Functions | % Lines |
|---|---|---|---|---|
| dispatch.service.ts | 96,29 | 84,9 | 90 | 97,52 |
| pricing.service.ts | 100 | 100 | 100 | 100 |
| routing.service.ts | 95,06 | 91,37 | 100 | 94,73 |
| webhooks.service.ts | 98,33 | 96 | 92,3 | 98,18 |
| **Tổng** | **96,79** | **90,6** | **93,47** | **97,19** |

Lưu ý phạm vi: cấu hình coverage không đo `shipments.service.ts` (state machine) và `auth.service.ts`; hai file này được kiểm bằng test riêng của M4 (ma trận trạng thái, ma trận RBAC, `auth-service`, `shipments-service`). Test frontend kiểm tra logic JavaScript (client API, bản đồ, GPS), không phải E2E trình duyệt, và hiện chưa có E2E tự động.

### Tầng 4 — Giao diện (kiểm thử thủ công)

Nhóm xác nhận đã chạy các kịch bản demo trên giao diện (tạo đơn, ghim điểm, báo giá, điều phối, giao hàng, tra cứu) và không phát hiện lỗi chặn. **Chưa có bằng chứng đính kèm** (ảnh chụp, video, bảng test case). Khi điền, ghi theo mẫu: kịch bản, vai trò, kết quả, bằng chứng.

## 3. Đối chiếu yêu cầu kiểm thử (SRS mục 4.1)

| ID | Kết quả | Bằng chứng |
|---|---|---|
| QA-01 Unit test (phí, định tuyến, GPS, trạng thái, dispatch, webhook) | Đạt | 405 test backend pass |
| QA-02 RBAC và quyền sở hữu | Đạt | Ma trận RBAC (21 endpoint), integration "blocks sender access to another sender shipment", probe phân quyền 7/7 |
| QA-03 State machine | Đạt | Ma trận trạng thái, integration, smoke-flow 43/43 |
| QA-04 Integration PostgreSQL/PostGIS | Đạt | 27/27 pass, 12 migration |
| QA-05 Frontend (API client, bản đồ, GPS, luồng người gửi) | Đạt | 52/52 pass (không phải E2E trình duyệt) |
| QA-06 Negative test | Đạt một phần | Smoke-flow: GPS sai (4 loại), thiếu token, sai vai trò, mã tracking sai định dạng, hủy thiếu lý do. **Chưa** kiểm chứng OTP bằng email thật (SMTP chưa cấu hình trên máy kiểm thử) |
| QA-07 Quyền riêng tư dữ liệu | Đạt | Tracking công khai chỉ trả `trackingCode, status, createdAt, pickup, dropoff, history`, không có `senderId`, không có toạ độ tài xế; điều hướng trước khi lấy hàng không lộ điểm giao; xe không liên quan không xem được vị trí trực tiếp |
| QA-08 Cổng chất lượng khi đổi code | Đạt một phần | lint, typecheck, build, test đều pass; `docker build` và kiểm tra `openapi.json` chưa chạy lại |
| QA-09 Báo cáo | Đạt | Tài liệu này; còn các ô "chưa chạy lại" ở mục 7 |

## 4. Ghi chú phương pháp: hai kiểm tra smoke thất bại ban đầu

Ở lần chạy đầu, hai kiểm tra thất bại và từng bị nghi ngờ là lỗi phân quyền (người gửi nhận 200 khi gọi chuyển trạng thái). Điều tra kết luận **không phải lỗi hệ thống**:

- Khi tài xế **nhận đơn**, hệ thống tự chuyển đơn từ `RECEIVED` sang `EN_ROUTE_PICKUP` (đúng với SRS 4.2 mục 4). Script ban đầu giả định đơn vẫn `RECEIVED` sau khi nhận.
- API trả 200 "idempotent" cho chủ đơn khi đơn đã ở đúng trạng thái yêu cầu, nên người gửi nhận 200 mà không đổi trạng thái.
- Bản script sửa kiểm tra phân quyền **trước** khi nhận đơn (khi đơn còn `RECEIVED`). Cả hai kiểm tra pass và probe độc lập xác nhận người gửi bị chặn 403 ở mọi trạng thái.

Một kiểm tra khác ban đầu mong đợi 409 sau `DELIVERED` nhưng hệ thống trả 403 (tài xế không còn được giao việc). Cả hai đều chặn đúng; kỳ vọng đã được sửa (tài xế 403 hoặc 409, admin 409).

## 5. Lỗi và phát hiện

| ID | Mức độ | Mô tả | Trạng thái |
|---|---|---|---|
| B01 ([#2](https://github.com/HarryNgoFire/CNPM_Topic4/issues/2)) | Trung bình | Compose lần đầu: `migrate` lỗi `ECONNREFUSED`, `api` không lên | **Đã sửa, M4 đã retest** |
| B02 ([#3](https://github.com/HarryNgoFire/CNPM_Topic4/issues/3)) | Thấp–Trung bình | Đăng ký webhook trùng URL tạo nhiều subscription, mỗi event gửi nhiều lần | Nhóm báo đã sửa; **M4 chưa retest** |
| B03 ([#4](https://github.com/HarryNgoFire/CNPM_Topic4/issues/4)) | Thấp (tài liệu) | Tài liệu webhook không nêu rõ không đảm bảo thứ tự | Nhóm báo đã sửa; **M4 chưa retest** |
| S01 | Cao nếu triển khai công khai; thấp khi chạy cục bộ | Giao diện (`apps/web/app.js`) **nhúng sẵn thông tin đăng nhập demo** (`sender@gmail.com`, `driver-a@gmail.com`, `dispatcher@gmail.com`, `admin@gmail.com`, mật khẩu `admin`) cùng nút đăng nhập 1 chạm, **bật mặc định** (chỉ tắt khi đặt cờ trong `localStorage`). Mật khẩu mặc định của tài khoản seed cũng là `admin` | Mở; cần quyết định cách xử lý |
| S02 | Thấp–Trung bình | Access token và refresh token lưu trong `sessionStorage` (khoá `moveflow_session`) và được khôi phục khi tải lại trang, trong khi `USER_GUIDE.md` và kịch bản thuyết trình ghi "giữ trong bộ nhớ, không lưu localStorage, tải lại trang phải đăng nhập lại". Mọi script chạy trên trang đều đọc được (rủi ro XSS) | Mở; sửa tài liệu hoặc mã |
| F3 | Thấp | Kịch bản thuyết trình lỗi thời: vòng đời 4 trạng thái (thực tế 9); "nhận đơn không làm đơn tự chuyển" (thực tế tự chuyển sang `EN_ROUTE_PICKUP`); "chưa có xử lý giao thất bại" (đã có `DELIVERY_FAILED`, `CANCELLED`); "không có geocoding" (giao diện đã có tìm địa chỉ) | Cần sửa trước khi trình bày |
| F4 | Thấp | CI chưa chạy `npm run test:web` | Đề xuất bổ sung |
| F5 | Thấp | Tài liệu mâu thuẫn nhau về số test (397/13 trong `DEVELOPER_REVIEW`, "349+/45" trong README, thực tế **405/52**); README ghi frontend Next.js/Playwright (thực tế HTML/JS thuần, chưa có Playwright); `HELPER.md` ghi cổng 3000 và `/docs` (thực tế 3001, `/api/docs`); sơ đồ state machine vẫn vẽ 4 trạng thái | Đề xuất cập nhật |
| F6 | Thấp | 46 lỗ hổng `npm audit` ở phần phát triển (0 ở phần chạy thật); `npm ci` cần nhiều RAM, bị dừng vì hết bộ nhớ khi chạy cùng Docker Desktop | Ghi nhận |

## 6. Rủi ro và hạn chế còn lại

- Tính đường đi dùng OSRM công cộng (không có SLA, cần Internet); tìm địa chỉ dùng Nominatim công cộng (giới hạn 1 yêu cầu/giây).
- Rate limiter lưu trong bộ nhớ, chỉ đúng khi chạy một instance.
- Chưa có E2E tự động; chưa kiểm chứng gửi email OTP thật; chưa có script cho đường dẫn `DELIVERY_FAILED`.
- Máy kiểm thử dùng Node 24, CI và Docker dùng Node 22.22.3.
- Tài khoản demo mật khẩu `admin` chỉ phù hợp chạy cục bộ.

## 7. Việc còn lại trước khi nộp

1. Chạy lại `scripts/qa/db-checks.sql` trên `513f80a` và điền vào Tầng 1.
2. Chạy `npm run openapi` rồi `git diff --exit-code -- docs/api/openapi.json`, và `docker build -f Dockerfile.api -t topic4-api .`; điền kết quả vào Tầng 3 và QA-08.
3. Retest Issue #3, #4 và đóng Issue #2.
4. Quyết định S01 và S02 với nhóm (sửa mã, hoặc ghi rõ trong tài liệu là chỉ cho demo cục bộ).
5. Bổ sung bằng chứng cho kiểm thử thủ công (ảnh chụp, bảng test case).
