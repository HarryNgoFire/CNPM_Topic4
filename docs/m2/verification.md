# Kết quả kiểm tra phần M2

Ngày kiểm tra: 11/10/2026. Bản code dựa trên nhánh main của repo nhóm tại commit `e35a1de`, làm việc trên nhánh local `feature/m2-backend-services`.

## Môi trường đã chạy

- Node.js 22.22.3, đúng phiên bản nhóm chốt.
- Cài dependency sạch bằng `npm ci` từ lockfile.
- Prisma CLI/client/adapter 7.10.0.
- PostgreSQL 16.15 và PostGIS 3.4.6 chạy bằng binaries Postgres.app trong thư mục test tạm; database riêng `topic4_test`.
- API NestJS thật, HTTP requests thật qua Supertest và receiver webhook localhost. Integration suite không thay thế database hay service nghiệp vụ bằng mock.

## Kết quả

| Kiểm tra                               | Kết quả                                      |
| -------------------------------------- | -------------------------------------------- |
| npm ci                                 | Pass                                         |
| Prisma generate                        | Pass                                         |
| Prisma migrate deploy trên DB test mới | Pass                                         |
| ESLint                                 | Pass                                         |
| TypeScript typecheck                   | Pass                                         |
| Build                                  | Pass                                         |
| Unit và HTTP contract                  | 105 test pass trong 5 suite                  |
| PostgreSQL/PostGIS integration         | 22 test pass trong 1 suite                   |
| OpenAPI export                         | Pass, OpenAPI 3.1, 21 operation trên 20 path |
| Kiểm tra cấu trúc Compose YAML         | Pass                                         |
| npm audit --omit=dev                   | 0 advisory tại thời điểm kiểm tra            |

Tổng cộng 127 test pass. Một số test chủ động mô phỏng lỗi outbox/database, nên log có ERROR dự kiến dù test pass.

Coverage được đo riêng cho ba service Pricing, Dispatch và Webhooks, không phải toàn bộ backend:

| Service         | Statements | Branches | Functions | Lines |
| --------------- | ---------: | -------: | --------: | ----: |
| Pricing         |       100% |     100% |      100% |  100% |
| Dispatch        |     99.07% |   92.50% |      100% |  100% |
| Webhooks        |       100% |      96% |      100% |  100% |
| Tổng ba service |     99.50% |   94.87% |      100% |  100% |

Unit coverage dùng mock repository/network; các hành vi transaction, spatial query và concurrency được kiểm tra riêng bằng integration suite với PostgreSQL/PostGIS thật.

## Các tình huống integration đã xác nhận

- Booking, gán driver gần nhất, ACCEPT, ba transition, timeline đủ bốn mốc và webhook có HMAC.
- Quote ở khoảng cách bằng 0; `ST_Distance` trả mét; geography của tọa độ mẫu khác 8,4 km.
- Tạo version giá mới mà shipment cũ giữ nguyên phí; DB chặn sửa fee snapshot.
- REJECT và timeout chuyển lời mời sang driver kế tiếp, không đổi shipment status.
- Hai worker cùng expire một assignment chỉ tạo một lời mời mới.
- Hai request gán cùng shipment chỉ tạo một active assignment.
- Hai shipment cạnh tranh một driver chỉ một shipment giữ được driver.
- Hai transition đồng thời không ghi trùng history/event.
- Chặn nhảy trạng thái, driver không sở hữu đơn và sender truy cập đơn người khác.
- Chặn đổi availability khi driver còn assignment hoạt động; bỏ qua tọa độ cũ.
- Webhook 503 được retry, shipment vẫn commit; retry giữ nguyên eventId.
- Hai worker webhook không claim cùng một delivery trong lease đang hiệu lực.
- Refresh token xoay vòng và không tái sử dụng được token cũ.
- History không thể sửa/xóa qua thao tác thông thường.
- Dispatcher chỉ định driver; tự động dừng tại giới hạn lượt và cho phép can thiệp thủ công.
- Rollback toàn bộ booking/address/history khi ghi event thất bại; rollback transition khi outbox lỗi.
- Đăng ký không cấp role đặc quyền và tạo profile cho Driver.

## Xác nhận GitHub Actions và kiểm tra còn lại

- Docker build đã pass trên GitHub Actions cho commit `35eb7e7`: https://github.com/HarryNgoFire/CNPM_Topic4/actions/runs/38116244964. Máy local chưa chạy toàn bộ Compose; cần smoke test Compose trên máy nhận bàn giao.
- CI dùng PostgreSQL 16/PostGIS 3.5 đã pass toàn bộ migration, lint/typecheck/build, unit/HTTP, integration, OpenAPI và Docker build trên run nêu trên. Code đã push; draft PR: https://github.com/HarryNgoFire/CNPM_Topic4/pull/1.
- Chưa chạy cùng frontend M1 hoặc schema/Auth implementation riêng của M3. Baseline và điểm tích hợp được ghi trong `integration.md`.
- Audit toàn bộ dependency, gồm dev tooling, còn 34 advisory (5 moderate, 29 high), phần lớn qua Jest 29.7 và các thư viện test/pattern matching. Giữ phiên bản test nhóm chốt; M4 cần xử lý trong PR nâng cấp riêng. Không dùng `npm audit fix --force` để tự đổi major. Dependency runtime đã áp dụng override và audit riêng trả 0.

## Kiểm tra đồng bộ M3 — 12/10/2026

Tiếp nhận M3 commit `a661cd5`. SQL của baseline và 9 migration có cùng 55 statement (đối chiếu bỏ comment/thứ tự); schema, API và Auth không đổi. Lint/typecheck/build và 105 unit/HTTP đã pass lại. Bổ sung integration test migration-history guard; tổng integration dự kiến 23, kết quả thực tế xem CI của commit cập nhật trên PR #1. Chi tiết chuyển DB: `M3_INTEGRATION.md`.
