# Máy trạng thái Shipment

Tài liệu này thay mục 7.2 "Bảng transition hợp lệ" trong tài liệu triển khai. Từ migration `20261110020000_two_stage_delivery_state`, đơn hàng đi qua hai chặng (tới điểm lấy A, rồi tới điểm giao B) và có thêm hai lối kết thúc là `CANCELLED` và `DELIVERY_FAILED`. Bản 4 trạng thái chỉ đi tiến không còn đúng với code.

- Sơ đồ: [`shipment-state-machine.drawio`](../architecture/diagrams/shipment-state-machine.drawio) và [ảnh PNG](../architecture/diagrams/shipment-state-machine.png)
- Code: `VALID_TRANSITIONS` và `canTransition()` trong `apps/api/src/modules/shipments/state-machine.ts`; các bước kiểm tra trong `ShipmentsService.transition()`; bước nhận đơn nằm trong `DispatchService.respond()`
- Test: ma trận 9 × 9 trong `apps/api/test/qa/state-machine-matrix.spec.ts`; ST-01..ST-11 trên PostGIS thật trong `apps/api/test/workflow.integration.spec.ts` (mục 8)
- Kiểm tra geofence: `evaluateGeofenceArrival()` trong `apps/api/src/common/geo.ts`

## 1. Các trạng thái

| Trạng thái         | Loại            | Ý nghĩa                                                                                       |
| ------------------ | --------------- | --------------------------------------------------------------------------------------------- |
| `RECEIVED`         | Khởi đầu        | Đơn vừa tạo, phí đã chốt, đang chờ tài xế nhận                                                |
| `EN_ROUTE_PICKUP`  | Chặng 1         | Tài xế đã nhận đơn và đang tới điểm lấy A                                                     |
| `ARRIVED_PICKUP`   | Chặng 1         | Tài xế đã vào bán kính 100 m quanh A                                                          |
| `OUT_FOR_DELIVERY` | Chặng 2         | Tài xế đã lấy hàng và đang tới điểm giao B                                                    |
| `ARRIVED_DROPOFF`  | Chặng 2         | Tài xế đã vào bán kính 100 m quanh B                                                          |
| `IN_TRANSIT`       | Chặng 2, cũ     | Chỉ còn ở đơn tạo trước migration ngày 10/11; không transition nào đi vào trạng thái này nữa |
| `DELIVERED`        | Cuối, thành công | Giao xong                                                                                     |
| `DELIVERY_FAILED`  | Cuối, thất bại  | Tài xế không giao được; lý do lưu ở `Shipment.reason`                                         |
| `CANCELLED`        | Cuối, thất bại  | Đơn bị hủy; lý do lưu ở `Shipment.reason`                                                     |

`IN_TRANSIT` được giữ trong enum để các đơn và dòng lịch sử cũ vẫn đọc được. Không xóa giá trị này và không sửa các dòng cũ.

## 2. Bảng transition hợp lệ

Bảng có đúng 15 cặp, khớp từng dòng với `VALID_TRANSITIONS`. Mọi cặp khác bị `canTransition()` từ chối.

| #   | Từ                 | Đến                | Ai thực hiện, qua đâu                                                  | Điều kiện (guard)                                                                                    | Hiệu ứng thêm                                    |
| --- | ------------------ | ------------------ | ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------ |
| 0   | _(chưa có)_        | `RECEIVED`         | Sender, Admin · `POST /shipments`                                      | Báo giá OSRM thành công, có `PricingRule` hiệu lực; mã tracking không trùng                         | Lưu phí; history với `fromStatus = null`; mời tài xế gần nhất |
| 1   | `RECEIVED`         | `EN_ROUTE_PICKUP`  | Tài xế · `POST /assignments/{id}/respond` với `ACCEPT`                 | Lời mời còn `PENDING`, chưa hết hạn, của chính tài xế; tài xế đang `AVAILABLE`; đơn vẫn `RECEIVED` | Assignment → `ACCEPTED`, tài xế → `BUSY`         |
| 2   | `EN_ROUTE_PICKUP`  | `ARRIVED_PICKUP`   | Tài xế có assignment `ACCEPTED`, hoặc Admin · `POST /shipments/{id}/transition` | Với tài xế: geofence quanh A (xem mục 4)                                                    |                                                  |
| 3   | `ARRIVED_PICKUP`   | `OUT_FOR_DELIVERY` | Tài xế có assignment `ACCEPTED`, hoặc Admin · transition               | Không có điều kiện thêm (tài xế xác nhận đã lấy hàng)                                                |                                                  |
| 4   | `OUT_FOR_DELIVERY` | `ARRIVED_DROPOFF`  | Tài xế có assignment `ACCEPTED`, hoặc Admin · transition               | Với tài xế: geofence quanh B                                                                         |                                                  |
| 5   | `ARRIVED_DROPOFF`  | `DELIVERED`        | Tài xế có assignment `ACCEPTED`, hoặc Admin · transition               | Không có điều kiện thêm                                                                              | Kết thúc (mục 5)                                 |
| 6   | `IN_TRANSIT`       | `OUT_FOR_DELIVERY` | Tài xế có assignment `ACCEPTED`, hoặc Admin · transition               | Chỉ áp dụng cho đơn cũ                                                                               |                                                  |
| 7   | `OUT_FOR_DELIVERY` | `DELIVERY_FAILED`  | Tài xế có assignment `ACCEPTED`, hoặc Admin · transition               | `reason` 1–255 ký tự                                                                                 | Kết thúc                                         |
| 8   | `ARRIVED_DROPOFF`  | `DELIVERY_FAILED`  | như trên                                                               | `reason` 1–255 ký tự                                                                                 | Kết thúc                                         |
| 9   | `IN_TRANSIT`       | `DELIVERY_FAILED`  | như trên                                                               | `reason` 1–255 ký tự                                                                                 | Kết thúc                                         |
| 10  | `RECEIVED`         | `CANCELLED`        | Sender sở hữu đơn, hoặc Admin · transition                             | `reason` 1–255 ký tự; với Sender: chưa có assignment `ACCEPTED`                                      | Kết thúc; lời mời `PENDING` (nếu có) bị đóng     |
| 11  | `EN_ROUTE_PICKUP`  | `CANCELLED`        | Admin · transition                                                     | `reason` 1–255 ký tự                                                                                 | Kết thúc, giải phóng tài xế                      |
| 12  | `ARRIVED_PICKUP`   | `CANCELLED`        | Admin · transition                                                     | `reason` 1–255 ký tự                                                                                 | Kết thúc, giải phóng tài xế                      |
| 13  | `IN_TRANSIT`       | `CANCELLED`        | Admin · transition                                                     | `reason` 1–255 ký tự                                                                                 | Kết thúc, giải phóng tài xế                      |
| 14  | `OUT_FOR_DELIVERY` | `CANCELLED`        | Admin · transition                                                     | `reason` 1–255 ký tự                                                                                 | Kết thúc, giải phóng tài xế                      |
| 15  | `ARRIVED_DROPOFF`  | `CANCELLED`        | Admin · transition                                                     | `reason` 1–255 ký tự                                                                                 | Kết thúc, giải phóng tài xế                      |

Dòng 0 là bước tạo đơn, không nằm trong `VALID_TRANSITIONS`. Dòng 1 có trong bảng nhưng trên thực tế chỉ xảy ra trong `DispatchService.respond()`: trong cùng transaction nhận lời mời, hàm này đổi trạng thái, ghi history và ghi outbox event. Qua endpoint transition thì không đi được bước này, vì endpoint đòi assignment `ACCEPTED` mà khi đó đơn đã ở `EN_ROUTE_PICKUP`.

Mỗi dòng 1–15 đều ghi một dòng `ShipmentStatusHistory` (`fromStatus`, `toStatus`, `changedBy`, `reason`) và một `WebhookEvent` loại `shipment.status_changed` trong cùng transaction với việc đổi trạng thái.

## 3. Thứ tự kiểm tra của `POST /shipments/{id}/transition`

Toàn bộ chạy trong một transaction. Lần kiểm tra đầu tiên thất bại quyết định mã lỗi.

| Bước | Kiểm tra                                                                                                                                                                       | Kết quả khi sai |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------- |
| —    | Guard: JWT hợp lệ, tài khoản active và đã xác minh email, vai trò thuộc Sender/Driver/Admin (Dispatcher bị chặn)                                                              | 401 / 403       |
| 1    | Khóa dòng `Shipment` bằng `SELECT … FOR UPDATE`; đơn phải tồn tại                                                                                                              | 404             |
| 2    | `toStatus` trùng trạng thái hiện tại: kiểm tra quyền sở hữu rồi trả về đơn kèm `idempotent: true`, không ghi history hay event                                                  | 200 (hoặc 403)  |
| 3a   | Sender: đơn phải của mình, chỉ được gửi `CANCELLED`, đơn phải đang `RECEIVED` và chưa có assignment `ACCEPTED`                                                                 | 403 / 409       |
| 3b   | Tài xế: không được gửi `CANCELLED`; phải là tài xế của assignment `ACCEPTED`; `DELIVERY_FAILED` chỉ khi đơn đang `OUT_FOR_DELIVERY`, `ARRIVED_DROPOFF` hoặc `IN_TRANSIT`      | 403 / 409       |
| 3c   | Admin: mọi đích trừ `CANCELLED` cần đơn có assignment `ACCEPTED`                                                                                                                | 409             |
| 4    | `canTransition(current, next)`; thông báo lỗi nêu rõ bước bị từ chối, ví dụ `EN_ROUTE_PICKUP -> OUT_FOR_DELIVERY`                                                              | 409             |
| 5    | Tài xế gửi `ARRIVED_PICKUP` / `ARRIVED_DROPOFF`: geofence (mục 4)                                                                                                              | 409             |
| 6    | `reason` bắt buộc 1–255 ký tự với `CANCELLED`, `DELIVERY_FAILED`; bị cấm với mọi trạng thái khác                                                                               | 400             |
| 7    | Cập nhật `status` và `reason`, thêm history, thêm outbox event, dọn dẹp nếu là trạng thái cuối                                                                                  | lỗi → rollback  |

Hai request đổi trạng thái đồng thời cho cùng một đơn được xếp hàng nhờ khóa dòng ở bước 1: request thứ hai đọc trạng thái mới và nhận 200 idempotent (cùng đích) hoặc 409 (đích không còn hợp lệ).

## 4. Geofence khi báo "đã tới"

Chỉ áp dụng khi actor là tài xế. Admin chuyển `ARRIVED_PICKUP` / `ARRIVED_DROPOFF` mà không bị kiểm tra vị trí.

| Điều kiện                                                       | Giá trị        |
| --------------------------------------------------------------- | -------------- |
| Đã có vị trí tài xế (`Driver.currentLocation`, `locationCapturedAt`) | bắt buộc   |
| Tuổi của vị trí (`now - locationCapturedAt`)                    | ≤ 30 giây      |
| Độ chính xác GPS (`locationAccuracyM`)                          | ≤ 50 m         |
| Khoảng cách Haversine tới điểm A hoặc B                         | ≤ 100 m        |

Vị trí được ghi qua `PATCH /drivers/me/location`. Endpoint đó tự từ chối tọa độ sai, độ chính xác > 200 m, mốc thời gian lệch tương lai > 30 giây hoặc cũ hơn 120 giây, và tốc độ suy ra > 55 m/s; nó cũng bỏ qua (không lưu) các lần gửi cách nhau dưới 5 giây hoặc đứng yên dưới 15 m trong vòng 60 giây.

## 5. Khi vào trạng thái cuối

Với `DELIVERED`, `CANCELLED` và `DELIVERY_FAILED`, cùng transaction còn:

1. Chuyển assignment đang `PENDING` hoặc `ACCEPTED` của đơn (nếu có) sang `COMPLETED`.
2. Khóa dòng `Driver` của assignment đó và đặt tài xế về `AVAILABLE`.

Từ trạng thái cuối không còn transition nào. Tài xế vẫn xem lại được đơn qua `GET /shipments/{id}`, `navigation` và `live` nhờ assignment `COMPLETED`.

## 6. Lời mời tài xế không đổi trạng thái đơn

| Sự kiện                                    | Assignment            | Shipment       | Việc tiếp theo                                                                          |
| ------------------------------------------ | --------------------- | -------------- | --------------------------------------------------------------------------------------- |
| Tạo đơn, có tài xế phù hợp                 | mới, `PENDING`        | `RECEIVED`     | Hết hạn sau `ASSIGNMENT_TIMEOUT_SECONDS` (mặc định 300)                                 |
| Tài xế `REJECT`                            | `REJECTED`            | `RECEIVED`     | Mời tài xế gần nhất kế tiếp, bỏ qua những người đã mời                                   |
| Hết hạn (job mỗi 10 giây)                  | `EXPIRED`             | `RECEIVED`     | Như trên                                                                                |
| Đã mời `MAX_ASSIGNMENT_ATTEMPTS` lần (mặc định 5) hoặc không còn tài xế | —     | `RECEIVED`     | Đơn nằm trong hàng chờ, Dispatcher gán tay qua `POST /shipments/{id}/assign-driver`     |
| Tài xế `ACCEPT`                            | `ACCEPTED`            | `EN_ROUTE_PICKUP` | Dòng 1 của bảng transition                                                           |

## 7. Business rule sau thay đổi

| Mã          | Nội dung hiện tại                                                                                                                                                         |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BR-STATE-01 | Đơn chỉ đi tiến theo hai chặng; không nhảy bước, không đi lùi. Ngoại lệ duy nhất là hai lối thoát sang trạng thái cuối `CANCELLED` và `DELIVERY_FAILED` theo bảng ở mục 2. |
| BR-STATE-02 | Mọi lần đổi trạng thái phải hợp lệ theo `VALID_TRANSITIONS`. `ShipmentsService.transition()` gọi `canTransition()`; `DispatchService.respond()` không gọi hàm này mà tự kiểm tra đơn đang `RECEIVED` trước khi chuyển sang `EN_ROUTE_PICKUP` (xem mục 9). |
| BR-STATE-03 | Mỗi lần đổi trạng thái ghi đúng một dòng `ShipmentStatusHistory` và một `WebhookEvent` trong cùng transaction.                                                             |
| BR-STATE-04 | `CANCELLED` và `DELIVERY_FAILED` bắt buộc có lý do 1–255 ký tự; các trạng thái khác không nhận lý do.                                                                       |
| BR-STATE-05 | Tài xế chỉ được báo đã tới A hoặc B khi vị trí mới (≤ 30 giây), đủ chính xác (≤ 50 m) và trong bán kính 100 m.                                                              |

## 8. Test case

ST-04..08 giữ đúng ý nghĩa của mục 17.2 tài liệu triển khai; ST-01..03 được viết lại cho hai chặng; ST-09..11 thêm cho các quy tắc mới. Tất cả chạy trên PostgreSQL/PostGIS thật trong `workflow.integration.spec.ts`.

| Test      | Tình huống                                                            | Kết quả mong đợi                                                                 |
| --------- | --------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| ST-01..03 | Nhận đơn, đi hết hai chặng tới `DELIVERED`                            | 200 mỗi bước; 6 dòng lịch sử đúng thứ tự và người thực hiện; 6 sự kiện; tài xế về `AVAILABLE` |
| ST-04     | `EN_ROUTE_PICKUP` nhảy sang `OUT_FOR_DELIVERY`                        | 409 nêu rõ bước bị từ chối, không thêm lịch sử hay sự kiện                       |
| ST-05     | Admin đổi đơn đã `DELIVERED` sang trạng thái khác, kể cả hủy          | 409                                                                              |
| ST-06     | Gửi lại trạng thái hiện tại                                           | 200 `idempotent: true`, không thêm dòng nào                                      |
| ST-07     | Tài xế mới có lời mời `PENDING`, tài xế khác, Dispatcher              | 403                                                                              |
| ST-08     | 8 request đồng thời cùng chuyển sang `OUT_FOR_DELIVERY`               | Cả 8 trả 200, đúng 1 request có hiệu lực, 1 dòng lịch sử                         |
| ST-09     | Báo đã tới A khi cách khoảng 550 m                                    | 409 kèm khoảng cách; Admin vẫn chuyển được                                        |
| ST-10     | Sender hủy đơn chưa có tài xế nhận; hủy sau khi tài xế nhận; tài xế hủy | 400 khi thiếu lý do, 200 và đóng lời mời; 409; 403; Admin hủy được và giải phóng tài xế |
| ST-11     | Báo giao thất bại trước khi lấy hàng; tại B không lý do; tại B có lý do | 409; 400; 200, lưu lý do, giải phóng tài xế                                     |

Việc ghi sự kiện thất bại làm hoàn tác cả trạng thái lẫn lịch sử (BR-STATE-03) được kiểm bằng test "rollback preserves current shipment status when transition event write fails" có sẵn trên `main`.

## 9. Điểm cần nhóm xem lại

- **Hai nơi đổi trạng thái.** Bước `RECEIVED → EN_ROUTE_PICKUP` cập nhật cột `status` trực tiếp trong `DispatchService.respond()` thay vì qua `canTransition()`. Kết quả hiện tại vẫn đúng (bảng có cặp này và hàm kiểm tra `RECEIVED` trước), nhưng nếu sau này đổi bảng thì hai nơi có thể lệch nhau. Gọi `canTransition()` trong `respond()` là đủ để gom về một chỗ.
- **Admin bỏ qua geofence.** Đây là cách để Admin xử lý sự cố, nhưng nên ghi rõ trong báo cáo và kịch bản demo để không bị hỏi là lỗ hổng.
