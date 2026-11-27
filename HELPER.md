# MoveFlow — Ghi chú demo và kiểm tra nhanh

Tài liệu này là checklist ngắn để chạy demo local. Hướng dẫn cài đặt đầy đủ nằm ở [README](README.md) và [USER_GUIDE](docs/USER_GUIDE.md).

## 1. Khởi động

1. Tạo `.env` từ `.env.example`, đặt secret riêng và cấu hình SMTP nếu muốn kiểm tra đăng ký/OTP bằng email thật.
2. Chạy `docker compose up --build -d`.
3. Nếu cần dữ liệu mẫu, chạy `docker compose run --rm migrate npm run db:seed`.
4. Mở web ở <http://localhost:3005>, Swagger ở <http://localhost:3001/api/docs>.

Seed có các tài khoản `sender@gmail.com`, `driver-a@gmail.com`, `driver-b@gmail.com`, `dispatcher@gmail.com` và `admin@gmail.com`. Mật khẩu mặc định `admin` chỉ áp dụng khi tạo user seed mới trên database sạch; `DEMO_PASSWORD` có thể đặt trong `.env`. Seed không tự đặt lại mật khẩu của tài khoản canonical đã tồn tại. Không sử dụng các tài khoản demo trong production.

## 2. Luồng trình diễn gợi ý

### Người gửi

- Đăng nhập hoặc đăng ký và xác minh email.
- Tạo đơn, nhập địa chỉ/kiện hàng và chọn cả hai điểm trên bản đồ.
- Xem báo giá, tạo đơn, ghi lại tracking code và theo dõi chi tiết.

### Điều phối

- Đăng nhập bằng tài khoản `DISPATCHER` hoặc `ADMIN`.
- Kiểm tra danh sách đơn/hàng chờ và yêu cầu tự động hoặc chỉ định tài xế.
- Việc phân công tự động phụ thuộc trạng thái sẵn sàng và vị trí GPS còn hợp lệ của tài xế.

### Tài xế

- Đăng nhập bằng tài khoản `DRIVER`, mở công việc và nhận/từ chối assignment.
- Cấp quyền định vị trình duyệt hoặc dùng Demo Tools để mô phỏng GPS khi kiểm thử local.
- Cập nhật các bước đến điểm lấy, đã nhận hàng, đến điểm giao và hoàn tất/báo giao thất bại.
- API chỉ cho xác nhận đến điểm khi thỏa điều kiện geofence; frontend không thể thay thế kiểm tra này.

### Tra cứu công khai

- Dùng mã vận đơn trên màn hình tra cứu. Response công khai không bao gồm vị trí GPS tài xế.

## 3. Demo Tools và dữ liệu

Frontend có bộ Demo Tools phục vụ mô phỏng/trình diễn, gồm tiện ích thử luồng và vị trí tài xế. Không xem các thao tác mô phỏng là hoạt động nghiệp vụ thực, không bật/mock GPS trong môi trường production. Chi tiết các điều khiển có thể thay đổi theo phiên bản giao diện; kiểm tra trực tiếp trong web app.

MapLibre cần WebGL và dữ liệu tile; geocoding, định tuyến OSRM và SMTP phụ thuộc cấu hình/kết nối bên ngoài. OSRM mặc định dùng profile `driving`, không đảm bảo tuyến xe máy hoặc SLA. Stack bản đồ tự lưu trữ là tùy chọn và yêu cầu tự cung cấp dataset.

## 4. Kiểm tra nhanh khi có lỗi

```bash
docker compose ps
docker compose logs --tail=100 api
docker compose logs --tail=100 web
```

- Web/API chưa sẵn sàng: kiểm tra trạng thái Compose, health endpoint và log API.
- Không nhận OTP: kiểm tra SMTP, Google App Password, `EMAIL_FROM` và log API.
- Không tìm thấy tuyến/báo giá: kiểm tra hai ghim tọa độ và kết nối tới OSRM.
- Không thể xác nhận đã đến điểm: kiểm tra GPS, độ chính xác, thời điểm đo và bán kính geofence.
- Đăng nhập tài khoản demo thất bại sau khi đã dùng trước đó: mật khẩu của user seed hiện có không bị reset bởi lần seed tiếp theo.

Lệnh kiểm thử và danh sách tài liệu khác nằm ở [README](README.md).
