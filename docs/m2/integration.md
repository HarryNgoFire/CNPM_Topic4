# Ghi chú tích hợp M2 với nhóm

> Cập nhật 12/10/2026: đã đồng bộ 9 migration của M3; xem [M3_INTEGRATION.md](M3_INTEGRATION.md) trước khi chạy trên DB từng dùng baseline M2. Schema/API/Auth không đổi.
M2 sở hữu PricingModule, DispatchModule và WebhooksModule. Shipment/Tracking API cũng được triển khai theo kế hoạch tuần trong tài liệu Word. Auth, Prisma schema và state machine là baseline hỗ trợ chạy thử, cần M3 xác nhận trước khi nhóm merge vào nhánh tích hợp.

## Các thay đổi schema cần M3 tiếp nhận

1. PricingRule chuyển từ từng dòng ruleType/rate sang một bộ tham số đầy đủ có version duy nhất. Cách này tránh đọc nhầm bộ base/per-km/multiplier thuộc nhiều version khác nhau. Nếu M3 giữ schema ruleType, cần viết repository adapter để trả về nguyên bộ PricingRule cho PricingService.
2. Shipment có `feeBreakdown` chứa ruleId, ruleVersion, distanceKm và các thành phần phí. `fee` và breakdown bất biến sau tạo đơn.
3. DriverAssignment có `expiresAt` và trạng thái COMPLETED. Index partial bảo vệ cả shipmentId và driverId khi PENDING/ACCEPTED.
4. ShipmentStatusHistory cho phép `fromStatus=null` tại mốc RECEIVED. `changedBy` luôn trỏ tới User thực hiện. Worker reassignment không đổi status shipment nên không cần actor SYSTEM cho transition trong MVP.
5. WebhookSubscription lưu URL/secret/active. WebhookEvent là event bất biến, WebhookDelivery lưu trạng thái gửi riêng theo từng subscription, attempts, nextAttemptAt, leaseToken, lockedUntil và lỗi gần nhất.
6. RefreshSession lưu SHA-256 của refresh token ngẫu nhiên, expiry và revocation. Refresh token được xoay vòng trong transaction có khóa dòng.
7. Address.location/Driver.currentLocation dùng geography(Point,4326), queried qua parameterized raw SQL. Prisma không trả field Unsupported, nên address DTO trả về các trường địa chỉ, không trả geography object.
8. DB trigger bảo vệ fee snapshot và history append-only. Migration nền chỉ dùng cho DB mới. Với database M3 đã tồn tại, cần migration nâng cấp theo schema thực tế, không chạy baseline như một bản reset.

## Ranh giới service

- `PricingService.quote(input, tx?)`: dùng cùng logic cho preview và booking; tx tùy chọn để booking ghi atomic.
- `ShipmentsService.transition(id, status, actor)`: điểm cập nhật status duy nhất trong code ứng dụng. Row lock, ownership, state validation, history, outbox event và giải phóng driver khi DELIVERED nằm trong transaction này.
- `WebhooksService.record(tx, shipment, from, to)`: chỉ ghi event/delivery, không gọi HTTP.
- `DispatchService.assign(shipmentId, preferredDriverId?)`: khóa shipment, chọn và khóa driver, tạo lời mời. Driver được chỉ định chỉ dùng cho can thiệp Dispatcher/Admin.
- `DispatchService.respond`: kiểm ownership và timeout, ACCEPT/REJECT; gán lại sau khi transaction phản hồi đã commit.

M3 có thể thay SecurityGuard/AuthModule bằng implementation chính thức khi giữ actor contract `{sub, role}` và các decorator Public/Roles. Không cho client tự đăng ký DISPATCHER/ADMIN/SYSTEM. Không dùng role claim trong token làm nguồn quyền duy nhất: guard đọc trạng thái/role hiện hành của user trong DB.

## Những điểm đặc tả đã chuẩn hóa

- EXPRESS nhân toàn bộ subtotal; làm tròn tới 1 VND.
- Khoảng cách địa lý của tọa độ mẫu không phải 8,4 km.
- 4 event cho toàn luồng, bao gồm event khởi tạo RECEIVED.
- ACCEPT không tự đổi shipment sang IN_TRANSIT; driver thực hiện transition riêng.
- Một lời mời PENDING đã giữ chỗ driver, tránh gửi nhiều lời mời đồng thời.
- Schema/API dùng role enum chữ hoa nhất quán.
- Admin có quyền các endpoint được ma trận RBAC cho phép; SYSTEM chỉ là actor nội bộ, không được đăng nhập.
- Reassignment/location được triển khai trong MVP dù backlog đánh Should.

## Các giới hạn hiện tại

- Không có frontend, SMS/email hoặc tối ưu tuyến đường nhiều điểm; dispatch dùng geography khoảng cách gần nhất.
- Refresh token được trả trong JSON cho demo. Nếu M1/M3 chuyển sang HttpOnly cookie, cần bổ sung chiến lược cookie/CSRF cho deployment thật.
- Webhook secret nằm trong database và không được trả ra API. Trước môi trường production, M3 cần quyết định encryption/key management và quyền truy cập database.
- Rate limiter hiện dùng bộ nhớ của một API instance; triển khai nhiều replica cần storage chung.
- Receiver demo deduplicate trong bộ nhớ; hệ thống ngoài thật cần lưu eventId bền vững.
