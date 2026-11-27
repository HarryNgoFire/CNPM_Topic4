# Vận hành bản đồ MoveFlow

## Chế độ mặc định

`.env.example` cấu hình OSRM công khai tại `https://router.project-osrm.org` và Nominatim công khai tại `https://nominatim.openstreetmap.org`. Đây là các dịch vụ best-effort, chịu quota/chính sách sử dụng riêng và không có SLA. OSRM dùng profile `driving`, không phải tuyến xe máy.

Các biến liên quan:

| Biến | Mục đích |
|---|---|
| `OSRM_BASE_URL` | Endpoint OSRM mà backend dùng để lấy tuyến |
| `OSRM_ROUTE_TIMEOUT_MS` | Timeout request định tuyến |
| `GEOCODER_BASE_URL` | Endpoint Nominatim dùng cho search/reverse |
| `GEOCODER_TIMEOUT_MS` | Timeout geocoding |
| `GEOCODER_VIEWBOX` | Khu vực ưu tiên kết quả geocoding |

Sau khi sửa `.env`, tạo lại container API để nhận cấu hình mới:

```bash
docker compose up -d --force-recreate api
```

## Stack tự lưu trữ tùy chọn

`compose.maps.yaml` thêm TileServer GL, OSRM và Nominatim vào stack. Dùng các endpoint trong mạng Compose:

```dotenv
OSRM_BASE_URL=http://osrm:5000
GEOCODER_BASE_URL=http://nominatim:8080
```

Khởi chạy hoặc kiểm tra cấu hình Compose:

```bash
docker compose -f compose.yaml -f compose.maps.yaml config
docker compose -f compose.yaml -f compose.maps.yaml up -d
docker compose -f compose.yaml -f compose.maps.yaml ps
```

> **Cần chuẩn bị dữ liệu trước:** thư mục `infra/maps/*/data` hiện chỉ có `.gitkeep`. Cấu hình TileServer yêu cầu `infra/maps/tileserver/data/hcmc.mbtiles`; OSRM cần graph đã build tại `infra/maps/osrm/data/map.osrm` và các file đi kèm; Nominatim cần import OSM extract vào volume của nó. Các dataset không được tải/tạo tự động bởi Compose và không được chứa trong repository.

Stack TileServer được cấu hình cho vùng bbox `105.8, 10.3, 107.4, 11.4`. Ngoài vùng dữ liệu, tile hoặc tuyến có thể không khả dụng. Hãy chuẩn bị extract phù hợp với cả cấu hình style/tile server, OSRM graph và Nominatim; xác minh dịch vụ riêng trước khi cấu hình API sang self-hosted endpoints.

## Kiểm tra và xử lý sự cố

- **API health:** `http://localhost:3001/api/v1/health`.
- **API logs:** `docker compose logs --tail=100 api`.
- **Map tile lỗi/404:** kiểm tra TileServer GL, file MBTiles, style `infra/maps/tileserver/styles/moveflow.json` và route proxy trong `apps/web/nginx.conf`.
- **Geocoding lỗi:** kiểm tra `GEOCODER_BASE_URL`, log API, timeout và khả năng truy cập Nominatim.
- **Báo giá không có tuyến:** kiểm tra tọa độ ghim, `OSRM_BASE_URL` và tình trạng OSRM. API sẽ báo lỗi thay vì tính khoảng cách đường thẳng.
- **Geofence từ chối:** kiểm tra GPS được cập nhật mới, độ chính xác nằm trong giới hạn và thiết bị đang trong vòng 100 m quanh đích.

Chi tiết thành phần và luồng điều hướng ở [kiến trúc bản đồ](architecture.md); giới hạn dịch vụ ngoài được ghi trong [hướng dẫn người dùng](../USER_GUIDE.md).
