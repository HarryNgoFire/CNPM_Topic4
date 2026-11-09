# MoveFlow — Cập nhật Unified Map (Tháng 11/2026)

## Các tính năng và cải tiến lớn

1. **Bản đồ thống nhất MapLibre GL (v4.7.1)**:
   - Loại bỏ hoàn toàn Leaflet CDN, Esri, Arcgisonline và các phụ thuộc thương mại.
   - Sử dụng thư viện MapLibre GL v4.7.1 được vendored nội bộ tại `apps/web/vendor/maplibre-gl/`.
   - Kiến trúc GeoJSON phản ứng (reactive sources: `endpoints`, `driver`, `route`) cập nhật qua `setData()`, không tạo lại layer hoặc nhấp nháy DOM.

2. **Định tuyến và bảng giá chuẩn hóa qua OSRM**:
   - Sử dụng duy nhất OSRM driving profile cho việc tính toán cự ly đường bộ, thời gian di chuyển, vẽ lộ trình và tính phí vận chuyển.
   - Loại bỏ các thuật toán tính khoảng cách song song hoặc không đồng nhất.

3. **Quy trình giao hàng hai chặng (Two-Stage Lifecycle) & Geofence Guard**:
   - State machine bổ sung các trạng thái chuẩn hóa: `EN_ROUTE_PICKUP` -> `ARRIVED_PICKUP` -> `OUT_FOR_DELIVERY` -> `ARRIVED_DROPOFF` -> `DELIVERED` / `DELIVERY_FAILED`.
   - Bảo vệ geofence 100m bằng hàm PostGIS: tài xế chỉ có thể chuyển sang `ARRIVED_PICKUP` hoặc `ARRIVED_DROPOFF` khi khoảng cách $\le 100$m, độ chính xác GPS $\le 50$m và thời gian ghi nhận $\le 30$s.
   - Cô lập lộ trình chặng 2: Tài xế không thể lấy tọa độ và lộ trình điểm giao B khi đang ở chặng lấy hàng A.

4. **Kiểm soát GPS tài xế (GPS Throttling)**:
   - Client tự động điều tiết tần suất gửi GPS: tối thiểu cách nhau 5 giây và 15 mét di chuyển; gửi heartbeat 60 giây khi đứng yên.
   - Tự động phát hiện lệch tuyến $>75$m sau 20 giây để yêu cầu tính lại lộ trình.

5. **API Geocoding địa chỉ tiếng Việt**:
   - Thêm module `/api/v1/geocoding/search` và `/reverse` bọc Nominatim, chuẩn hóa định dạng địa chỉ hành chính Việt Nam.
   - Tích hợp bộ đệm nhớ 24 giờ (tối đa 1.000 địa chỉ), timeout 5 giây và cơ chế fallback 503 an toàn.

6. **Theo dõi trực tiếp có phân quyền (Live Tracking)**:
   - Thêm endpoint `GET /api/v1/shipments/:id/live` dành riêng cho chủ đơn hàng (Sender), tài xế được phân công, điều phối viên và admin.
   - Tài khoản không liên quan bị từ chối với mã lỗi 403.
   - Vị trí tài xế được xóa tự động (`null`) khi đơn hàng chuyển sang trạng thái kết thúc (`DELIVERED`, `DELIVERY_FAILED`, `CANCELLED`).
   - Giao diện chi tiết đơn hàng tự động thăm dò vị trí mỗi 10 giây khi tab đang hiển thị và dừng hoàn toàn khi chuyển view hoặc ẩn tab.

7. **Hạ tầng bản đồ tự lưu trữ (Self-Hosted Map Stack)**:
   - Bổ sung `compose.maps.yaml` gồm TileServer GL v4.11.0, OSRM Backend v5.27.1 (MLD) và Nominatim 5.3.
   - Cung cấp tài liệu vận hành và hướng dẫn import dữ liệu extract khu vực tại `infra/maps/README.md`.

8. **Bảo mật & Kiểm thử toàn diện**:
   - Cấu hình CSP nghiêm ngặt trên Nginx cho phép Web Workers, WebGL và kết nối cùng nguồn.
   - Đạt 100% kiểm thử: **397/397 baseline tests backend** và **13/13 web tests frontend** đều passed.
   - Cập nhật tài liệu kỹ thuật tại `docs/maps/architecture.md`, `docs/maps/operations.md`, `docs/maps/verification.md` và OpenAPI 3.1.0 tại `docs/api/openapi.json`.
