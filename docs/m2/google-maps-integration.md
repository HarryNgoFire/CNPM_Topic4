# Tính phí theo khoảng cách đường bộ bằng OSRM và mở Google Maps chỉ đường

Bản backend dùng hai cơ chế tách biệt:

1. **OSRM Route API**: lấy khoảng cách theo mạng lưới đường để đưa vào công thức tính phí. Không cần API key hoặc Google Cloud billing.
2. **Google Maps URLs**: tạo liên kết để tài xế mở Google Maps đến điểm lấy hàng hoặc điểm giao. Liên kết này không cần API key.

## 1. Cấu hình OSRM

Mặc định `.env.example` đã dùng máy chủ demo công khai:

```dotenv
OSRM_BASE_URL=https://router.project-osrm.org
OSRM_ROUTE_TIMEOUT_MS=6000
GOOGLE_MAPS_TRAVEL_MODE=TWO_WHEELER
```

Không cần đăng ký key, không cần bật Google Cloud billing. Khi chạy Docker Compose, sao chép `.env.example` thành `.env`, điền các thông tin bắt buộc khác như `POSTGRES_PASSWORD`, `JWT_SECRET`, `DEMO_PASSWORD` và `WEBHOOK_RECEIVER_SECRET`, sau đó chạy:

```bash
docker compose up --build -d
```

### Giới hạn quan trọng của máy chủ OSRM công khai

- Đây là máy chủ demo best-effort, không có cam kết uptime hoặc tốc độ; chính sách đề nghị dùng hợp lý và không quá **1 request/giây**.
- Backend đã xếp hàng yêu cầu để giới hạn khoảng 1 request/giây trên mỗi tiến trình và cache kết quả theo cặp tọa độ trong 5 phút. Nếu triển khai nhiều replica, mỗi replica có bộ giới hạn riêng; nên tự host OSRM hoặc dùng nhà cung cấp định tuyến có SLA nếu cần vận hành ổn định.
- Profile mặc định `driving` là profile đường bộ thường dùng, không phải profile xe máy riêng. Vì vậy, khoảng cách dùng để tính phí có thể khác tuyến Google Maps chọn cho xe máy tại Việt Nam. Với đồ án nhỏ, có thể dùng để minh họa phí dựa trên quãng đường bộ; không nên coi là độ chính xác sản phẩm thương mại.
- Nếu không tìm được đường, timeout hoặc OSRM không truy cập được, endpoint báo giá trả lỗi `503`. Hệ thống **không tự chuyển sang đường chim bay**, tránh tính phí sai mà người dùng không biết.

Máy chủ demo được cung cấp theo chính sách sử dụng hợp lý, không bảo đảm dịch vụ. Khi cần vận hành ổn định hơn, có thể chạy OSRM riêng theo [hướng dẫn Project OSRM](https://github.com/Project-OSRM/osrm-backend) hoặc sử dụng một nhà cung cấp định tuyến khác bằng cách đổi `OSRM_BASE_URL`.

Tài liệu tham khảo:

- [OSRM API documentation](https://project-osrm.org/docs/v5.24.0/api/)
- [OSRM demo server and usage policy](https://github.com/Project-OSRM/osrm-backend/wiki/Demo-server)

## 2. Cách tính phí

`POST /api/v1/pricing/quote` và `POST /api/v1/shipments` dùng chung `PricingService`. Service gọi OSRM trước khi mở transaction tạo đơn, lấy `routes[0].distance` tính bằng mét rồi chia 1.000 để ra km. Phí tiếp tục được tính theo `PricingRule` hiện có:

```text
fee = (baseFee + distanceKm × ratePerKm
       + max(0, weightKg − freeWeightThreshold) × ratePerExtraKg)
      × serviceMultiplier
```

Kết quả quote có `distanceSource: "OSRM_DRIVING"` để frontend và nhóm kiểm thử biết khoảng cách đến từ định tuyến đường bộ. Giá cuối cùng vẫn phụ thuộc rule giá cước đang hiệu lực và quãng đường OSRM trả về.

## 3. Mở Google Maps để chỉ đường cho tài xế

Các endpoint chi tiết đơn `GET /api/v1/shipments/:id` và danh sách việc tài xế `GET /api/v1/drivers/me/tasks` trả về `navigationUrls` khi đơn có tọa độ:

```json
{
  "navigationUrls": {
    "pickup": "https://www.google.com/maps/dir/?api=1&destination=...&travelmode=two-wheeler&dir_action=navigate",
    "dropoff": "https://www.google.com/maps/dir/?api=1&destination=...&travelmode=two-wheeler&dir_action=navigate"
  }
}
```

Frontend chỉ cần gắn URL vào nút:

```tsx
<a href={task.navigationUrls.pickup} target="_blank" rel="noreferrer">
  Đi đến điểm lấy hàng
</a>
<a href={task.navigationUrls.dropoff} target="_blank" rel="noreferrer">
  Đi đến điểm giao hàng
</a>
```

Google Maps URLs không yêu cầu API key. `travelmode=two-wheeler` ưu tiên tuyến xe máy ở nơi được hỗ trợ; `dir_action=navigate` mở điều hướng hoặc bản xem trước tùy thiết bị và quyền truy cập vị trí.

Tài liệu: [Google Maps URLs](https://developers.google.com/maps/documentation/urls/get-started).

## 4. Xử lý sự cố

- `503 OSRM routing service could not be reached`: kiểm tra Internet của máy chạy API, `OSRM_BASE_URL`, hoặc thử lại sau.
- `503 OSRM did not return a valid road route`: kiểm tra tọa độ đầu vào và khả năng tìm đường tại khu vực đó.
- Muốn không phụ thuộc máy chủ demo: tự host OSRM hoặc chọn dịch vụ có quota/SLA. Không đổi lại đường chim bay nếu mục đích là tính phí theo quãng đường đường bộ.
- Frontend của bản ZIP hiện chưa được tạo; backend chỉ trả URL điều hướng. Nút thực tế cần được nối khi nhóm làm giao diện.
