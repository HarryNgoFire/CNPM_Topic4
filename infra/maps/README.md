# Hạ tầng bản đồ tự lưu trữ (tùy chọn)

`compose.maps.yaml` bổ sung ba dịch vụ vào Compose chính:

- TileServer GL (`maptiler/tileserver-gl:v4.11.0`) đọc style và MBTiles ở `tileserver/`.
- OSRM (`osrm-backend:v5.27.1`) đọc graph routing ở `osrm/data/`.
- Nominatim (`mediagis/nominatim:5.3`) nhập dữ liệu OSM vào volume riêng.

Stack chỉ chạy đầy đủ sau khi các bộ dữ liệu được chuẩn bị. Trong repository, các thư mục `tileserver/data`, `osrm/data` và `nominatim/data` hiện chỉ có `.gitkeep`; không có dữ liệu bản đồ để import hoặc route sẵn.

TileServer style `tileserver/styles/moveflow.json` và `tileserver/config.json` được cấu hình cho vùng khu vực TP. Hồ Chí Minh và vùng lân cận, bbox `105.8, 10.3, 107.4, 11.4`. OSRM được chạy theo profile `driving`, không phải xe máy.

Để bật overlay sau khi chuẩn bị file dữ liệu, xem [hướng dẫn vận hành](../../docs/maps/operations.md):

```bash
docker compose -f compose.yaml -f compose.maps.yaml config
docker compose -f compose.yaml -f compose.maps.yaml up -d
```

Không commit dataset lớn, thông tin xác thực hoặc dữ liệu người dùng vào repository.
