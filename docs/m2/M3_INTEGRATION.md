# M2 đồng bộ với M3 — 12/10/2026

## Kết quả review

Đã tiếp nhận nhánh `feature/m3-integration` tại commit `a661cd5` vào nhánh M2 bằng fast-forward, giữ nguyên tác giả và lịch sử commit M3.

M3 thay migration nền bằng 9 migration theo miền nghiệp vụ, bổ sung ERD và state machine. Không thay `schema.prisma`, Auth/RBAC, state transition, DTO/API, Pricing/Dispatch/Webhooks. Đối chiếu nội dung SQL sau bỏ comment và thứ tự: **55 statement của baseline cũ và chuỗi mới giống nhau**, kể cả FK, CHECK, partial unique indexes, geography và trigger. Vì contract không đổi, không cần sửa thuật toán service hoặc frontend. CI của M3 đã pass: https://github.com/HarryNgoFire/CNPM_Topic4/actions/runs/38140422617.

## Thay đổi M2 sau review

- Dùng 9 migration của M3; bỏ baseline cũ, không đưa lại file đã bỏ.
- `npm run db:migrate` chạy `db:check-history` trước Prisma migrate deploy. Kiểm tra chỉ đọc DB; nếu thấy baseline cũ chưa được rolled back, dừng với mã lỗi `M2_LEGACY_BASELINE` trước khi áp migration. Database mới hoặc đã dùng chuỗi M3 tiếp tục bình thường.
- Compose migrate cũng dùng command này; DB chưa tương thích sẽ không cho API khởi động qua dependency migration.
- Có integration test thật kiểm tra chuỗi M3 được chấp nhận, baseline cũ bị chặn và dữ liệu User không bị sửa. Tổng hiện tại: 105 unit/HTTP và 23 integration.
- API/OpenAPI giữ nguyên. Từ nay schema mới phải có migration mới và M3 review; không sửa migration đã áp dụng.

## DB mới hoặc DB đã dùng chuỗi M3

Làm theo `docs/m2/README.md`: cấu hình `.env`, `npm ci`, generate, migrate, seed, chạy API. Kiểm tra riêng bằng `npm run db:check-history`. Không chạy script trực tiếp từ môi trường thiếu DATABASE_URL; script đọc `.env` tại root hoặc biến môi trường shell/container.

## DB đã áp baseline M2 cũ

**Không chạy chuỗi mới trực tiếp; không xóa volume nếu chưa quyết định bỏ dữ liệu.** Guard báo lỗi là hành vi đúng, không phải cần bypass. `npx prisma migrate deploy` trực tiếp sẽ bỏ qua guard, nên dùng npm run db:migrate.

### Dữ liệu demo không cần tiếp tục dùng: tạo DB riêng, giữ DB cũ

Sao lưu nếu cần. Dừng project Compose cũ để giải phóng cổng nhưng giữ volume:

```bash
docker compose down
# Tên project khác tạo volume riêng; không dùng down -v.
docker compose -p topic4-m3 up --build -d
docker compose -p topic4-m3 run --rm migrate npm run db:seed
docker compose -p topic4-m3 ps
```

Sau đó mọi lệnh Compose trên DB mới đều phải có `-p topic4-m3`, gồm logs, exec, seed, down. Cấu hình mật khẩu/secret hợp lệ trong `.env` trước khi chạy. Bản cũ vẫn nằm trong volume của project cũ; muốn mở lại phải dừng project mới rồi chạy code tương ứng baseline cũ và project cũ. Không cho code chuỗi M3 migrate DB cũ.

Nếu DB ngoài Docker, tạo database trống mới và đổi DATABASE_URL vào database mới; giữ nguyên database cũ.

### Dữ liệu cần bảo toàn và tiếp tục sử dụng

Backup và restore vào bản sao, dừng ghi/worker trước chuyển đổi. Nhờ M3 đối chiếu **schema DB thực tế**, bao gồm geography, partial indexes, enum, constraints, trigger và lịch sử migration; không chỉ so file schema.prisma. M3 cần chốt quy trình rebaseline lịch sử hoặc chuyển dữ liệu sang database chuỗi mới, test trên bản sao rồi mới thực hiện ở DB dùng chung. Không đánh dấu 9 migration applied chỉ dựa vào việc database có bảng hoặc xóa hàng _prisma_migrations để hết lỗi. Guard không tự sửa lịch sử hoặc tự xóa dữ liệu.

## Test và nhận bàn giao

```bash
npm ci
npm run db:generate
npm run lint
npm run typecheck
npm run build
npm test
npm run openapi
git diff --exit-code -- docs/api/openapi.json
```

Integration chỉ chạy database riêng tên kết thúc `_test`, đã áp 9 migration. Nếu DB test từng chạy baseline, tạo DB test mới hoặc chủ động bỏ DB test cũ sau xác nhận dữ liệu disposable. Test xóa dữ liệu nghiệp vụ; không trỏ DB chung.

CI trên nhánh M2 kiểm migration trên DB trống, 105 unit/HTTP, 23 integration gồm guard mới, OpenAPI và Docker build. Xem GitHub Actions của đúng commit trước merge: https://github.com/HarryNgoFire/CNPM_Topic4/pull/1. Chưa chạy toàn bộ Compose local do máy không có Docker; Docker build và DB integration được xác nhận qua CI.

## Thứ tự đọc tài liệu

Mục này cập nhật hướng dẫn cũ về migration: ưu tiên `M3_INTEGRATION.md`, tiếp theo `docs/m3/README.md`, rồi `BAN_GIAO_M2_CHO_M3.md`. Hướng dẫn baseline một file trong bản bàn giao ngày 11/10 chỉ có giá trị lịch sử. Các contract nghiệp vụ, Auth và API trong bản bàn giao đó vẫn áp dụng.
