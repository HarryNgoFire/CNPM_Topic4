# Kiến trúc bản đồ MoveFlow

Tài liệu mô tả stack bản đồ trong repository hiện tại. Cấu hình có thể thay đổi theo `.env`, `compose.yaml`, `compose.maps.yaml` và các module API tương ứng.

## Thành phần

```text
Browser (SPA + MapLibre GL)
       |
       +-- /api/v1/geocoding/search, /reverse --> MoveFlow API --> Nominatim
       +-- /api/v1/pricing/quote --------------> MoveFlow API --> OSRM
       +-- shipment navigation/live, driver GPS -> MoveFlow API --> PostgreSQL/PostGIS
       |
       +-- map style/tiles --------------------> Nginx proxy --> TileServer GL (optional)
```

- **Web:** vanilla JavaScript SPA; MapLibre GL 4.7.1 được vendored trong `apps/web/vendor/maplibre-gl`. Bản đồ booking cho phép chọn/kéo điểm lấy và giao; bản đồ tài xế hiển thị tuyến và trạng thái chuyến.
- **Geocoding:** API proxy đến Nominatim qua `GEOCODER_BASE_URL`; search/reverse được chuẩn hóa và giới hạn bởi backend. Lỗi upstream được trả về dưới dạng lỗi dịch vụ, không tạo kết quả giả.
- **Routing/pricing:** `RoutingService` gọi OSRM qua `OSRM_BASE_URL`, profile `driving`. Khoảng cách tuyến được dùng trong quote và phí shipment; không tự thay bằng đường chim bay khi không có tuyến.
- **Vị trí:** PostgreSQL/PostGIS lưu vị trí tài xế; backend phân quyền live tracking và kiểm tra điều kiện GPS/geofence khi chuyển trạng thái.
- **Tile server:** TileServer GL, OSRM và Nominatim có thể chạy bằng compose overlay. Các dataset không được commit cùng repo; phải tự chuẩn bị trước khi triển khai stack này.

## Luồng giao hai chặng

Luồng nghiệp vụ chính của tài xế:

```text
RECEIVED
  -> EN_ROUTE_PICKUP
  -> ARRIVED_PICKUP
  -> OUT_FOR_DELIVERY
  -> ARRIVED_DROPOFF
  -> DELIVERED
```

Tại điểm lấy/giao, backend yêu cầu vị trí trong geofence 100 m cùng giới hạn độ chính xác/độ mới GPS. Chặng đến điểm giao chỉ được mở sau khi đã xác nhận đến điểm lấy và nhận hàng. Các trạng thái cuối còn gồm `CANCELLED` và `DELIVERY_FAILED`; chuyển trạng thái và quyền thực hiện được kiểm tra ở API. Xem [state machine](../architecture/diagrams/shipment-state-machine.drawio) và [SRS](../SRS.md).

## Quyền riêng tư

- `GET /api/v1/shipments/:id/live` yêu cầu xác thực và kiểm tra vai trò/quyền sở hữu hoặc assignment.
- `GET /api/v1/tracking/:trackingCode` là tra cứu công khai có response giới hạn; không chứa tọa độ GPS tài xế.
- Dữ liệu điều hướng được trả theo giai đoạn giao hàng; frontend không phải ranh giới bảo vệ quyền truy cập.

Tile, geocoding và routing phụ thuộc dịch vụ/cấu hình môi trường. Máy chủ public không có SLA; xem [hướng dẫn vận hành](operations.md).
