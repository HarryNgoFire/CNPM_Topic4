# MoveFlow — Sổ tay Hỗ trợ & Kiểm thử Hệ thống (Helper Guide)

Tài liệu này cung cấp toàn bộ thông tin hướng dẫn nhanh, tài khoản kiểm thử, bộ công cụ MoveFlow Demo Toolkit, cách kích hoạt kịch bản mẫu và các lệnh vận hành hệ thống.

---

## 1. Thông tin tài khoản kiểm thử (Test Credentials)

Tất cả các tài khoản mẫu dưới đây đã được kích hoạt sẵn (`active: true`, email đã xác thực OTP) và nạp sẵn trong hệ thống khi khởi tạo cơ sở dữ liệu:

| Vai trò | Email đăng nhập | Mật khẩu | Chức năng chính |
|---|---|---|---|
| **Người gửi (Sender)** | `sender@gmail.com` | `admin` | Tạo đơn hàng (ghim A/B OSRM), xem báo cước, theo dõi vị trí tài xế trực tiếp. |
| **Tài xế A (Driver A)** | `driver-a@gmail.com` | `admin` | Nhận cuốc, dẫn đường 2 chặng Cockpit (A ➔ B), Geofence 100m, gạt Sẵn sàng/Ngoại tuyến. |
| **Tài xế B (Driver B)** | `driver-b@gmail.com` | `admin` | Tài xế dự phòng cho kịch bản điều phối và từ chối cuốc. |
| **Điều phối viên (Dispatcher)** | `dispatcher@gmail.com` | `admin` | Giám sát hàng chờ điều phối, gán tài xế tự động hoặc chỉ định thủ công (Manual Override). |
| **Quản trị viên (Admin)** | `admin@gmail.com` | `admin` | Toàn quyền hệ thống, quản lý người dùng, chỉnh sửa bảng giá cước, giám sát Webhook Outbox. |

> **Mẹo:** Bạn có thể chuyển đổi qua lại giữa các tài khoản chỉ bằng **1-Click** ngay trên thanh công cụ **Demo Tools** hoặc dùng khối đăng nhập nhanh ở trang Login.

---

## 2. Thanh công cụ Demo & Giả lập (MoveFlow Demo Toolkit)

Ở góc dưới bên phải màn hình có nút **🛠️ Demo Tools**. Nhấp vào nút để mở bảng điều khiển gồm 3 tab:

### Tab 1: ⚡ Tác vụ nhanh (Quick Actions)
- **✨ Chạy Demo trọn gói (1-Click Full Flow):** Tự động kích hoạt toàn trình:
  1. Đăng nhập Sender ➔ Tạo đơn hàng mẫu Quận 1 đến Quận 7.
  2. Đăng nhập Dispatcher ➔ Điều phối đơn hàng cho Tài xế A.
  3. Đăng nhập Tài xế A ➔ Chấp nhận cuốc giao.
  4. Giả lập xe đến điểm lấy hàng A ➔ Xác nhận đã nhận kiện hàng.
  5. Giả lập xe di chuyển đến điểm giao B ➔ Xác nhận giao thành công (kèm hiệu ứng pháo hoa ăn mừng 🎉).
- **Các bước quy trình thủ công (01 ➔ 05):** Cho phép bạn chạy từng bước riêng biệt để thuyết trình hoặc debug chi tiết từng API.

### Tab 2: 👤 Đổi tài khoản (1-Click Role Switcher)
- Chuyển đổi ngay lập tức sang bất kỳ vai trò nào (Sender, Driver A, Driver B, Dispatcher, Admin) mà không phải gõ email/mật khẩu hay đăng xuất.

### Tab 3: 📍 GPS & Xe chạy mô phỏng
- **🛰️ Chế độ Mock GPS:** Khi bật, hệ thống sẽ chặn trình duyệt gọi GPS thực tế của thiết bị, cho phép sử dụng tọa độ ảo trên bản đồ mà không bị giật ngược về vị trí thật.
- **🎲 Đặt vị trí ngẫu nhiên:** Đặt xe tài xế ở vị trí ngẫu nhiên cách điểm lấy A khoảng ~2km và tự động lấy tuyến đường OSRM thực tế.
- **⚡ Đặt tốc độ xe tài xế (`km/h`):**
  - Thanh trượt điều chỉnh từ **10 km/h** đến **500 km/h**.
  - Ô nhập số tùy ý (từ 5 đến 1000 km/h).
  - 5 nút chọn nhanh: `🐢 30 km/h`, `🛵 60 km/h`, `🚗 100 km/h`, `⚡ 180 km/h`, `🚀 360 km/h`.
  - Tốc độ xe cập nhật ngay lập tức trong lúc xe đang chạy trên bản đồ.
- **▶️ Xe chạy mô phỏng:** Xe di chuyển mượt mà trên từng cung đường thực tế theo dữ liệu OSRM:
  - Thanh xanh chỉ đường (`polyline`) tự động cắt ngắn dần theo mũi xe và xóa sạch khi xe cán đích.
  - Đồng hồ hiển thị tốc độ thực, phần trăm hoàn thành, cự ly còn lại và thời gian dự kiến (ETA).
- **📍 Dịch chuyển tức thời (< 25m):** Đưa xe đến sát điểm A hoặc điểm B trong nháy mắt (< 25m) để kiểm tra tính năng xác nhận Geofence mà không cần chờ xe chạy.

---

## 3. Hướng dẫn tính năng Tài xế (Driver Experience)

### Bảng điều hành buồng lái (Cockpit Navigation)
- Khi nhận chuyến, tài xế được đưa vào giao diện buồng lái toàn màn hình với bản đồ chiếm 80% không gian.
- **Quy trình 2 chặng khép kín:**
  - **Chặng 1 (Đến điểm A):** Bản đồ chỉ hiển thị điểm lấy A và lộ trình đến A (bảo mật tuyệt đối thông tin điểm giao B).
  - **Chặng 2 (Đến điểm B):** Sau khi bấm "📦 Xác nhận đã lấy hàng", bản đồ mới mở lộ trình đến điểm giao B.
- **Bảo vệ Geofence 100m:**
  - Nút `⚑ Đã đến điểm lấy hàng` và `⚑ Đã đến điểm giao hàng` chỉ cho phép bấm khi xe tài xế đã đi vào bán kính $\le 100$m so với điểm đích.
- **Hủy nhận chuyến:**
  - Ở Chặng 1: Có nút đỏ `✕ Hủy nhận chuyến`.
  - Ở Chặng 2: Có nút `✕ Hủy / Báo giao thất bại` kèm popup nhập lý do nhanh.
- **Công tắc gạt trạng thái Sẵn sàng / Ngoại tuyến:**
  - Thiết kế kiểu công tắc gạt iOS kèm modal popup xác nhận an toàn.
  - Trên máy tính (Desktop): Đặt ở thanh tiêu cực kỳ tiện lợi.
  - Trên điện thoại (Mobile Frame): Đặt ở Menu bên trái (Sidebar Drawer ☰).

### Lịch sử chuyến xe tài xế
- Tự động lưu trữ và hiển thị đầy đủ các chuyến tài xế đã tiếp nhận, đang giao và **đã giao thành công (`DELIVERED`)**.
- Bảng tổng kết đầu trang hiển thị:
  - **Tổng số chuyến đã nhận**
  - **Số chuyến giao thành công**
  - **Tổng doanh thu cước phí đã hoàn thành**
- Bấm vào bất kỳ chuyến nào để mở trang chi tiết xem lại bản đồ lộ trình A ➔ B và lịch sử thời gian.

---

## 4. Hướng dẫn tính năng Điều phối & Quản trị

### Hàng chờ điều phối (Dispatcher Queue)
- Giám sát toàn bộ các đơn hàng chưa có tài xế tiếp nhận.
- **⚡ Tự động gán gần nhất:** Tìm kiếm tài xế đang `AVAILABLE` gần điểm lấy A nhất theo thuật toán PostGIS OSRM.
- **👤 Chỉ định thủ công (Manual Override):** Danh sách chọn trực tiếp tài xế đang hoạt động để phân công đơn hàng khi đơn bị từ chối quá số lần cho phép.

### Giám sát Webhook Outbox (Admin)
- Giám sát các sự kiện Outbox Pattern đảm bảo độ tin cậy khi bắn Webhook tới các hệ sinh thái bên thứ ba.
- Mỗi request được ký bảo mật bằng chữ ký số `X-Webhook-Signature: sha256=...`.
- Tự động Retry lên đến 5 lần với Exponential Backoff khi endpoint đối tác gặp sự cố.

### Chế độ giao diện kép (Dual-Mode Presentation)
- Nút chuyển đổi nhanh ở góc trên màn hình:
  - **📱 Giao diện Di động (Mobile Phone Frame):** Chuẩn iPhone 390x844px với bottom navigation, hỗ trợ cử chỉ vuốt kéo sheet điều hành.
  - **🖥️ Giao diện Máy tính (Desktop 1440px):** Giao diện bảng điều khiển rộng rãi 2 cột hiện đại.
- **🌓 Giao diện Tối / Sáng (Dark Mode):** Chuyển đổi nền tối chuyên dụng cho tài xế chạy đêm.

---

## 5. Các câu lệnh phát triển & kiểm thử (Commands)

### Khởi động hệ thống
```bash
# Khởi chạy toàn bộ dịch vụ (API, Web Nginx, PostgreSQL PostGIS, TileServer)
docker compose up -d

# Xem log API
docker compose logs -f api

# Build lại container API sau khi sửa mã nguồn backend
docker compose up -d --build api
```

### Chạy kiểm thử tự động
```bash
# Chạy toàn bộ kiểm thử đơn vị & tích hợp Frontend (45/45 tests pass)
npm run test:web

# Chạy kiểm thử Backend NestJS (349+ tests pass)
npm test
```

### Truy cập hệ thống trên trình duyệt
- **Giao diện người dùng Web:** [http://localhost:3005](http://localhost:3005)
- **Tài liệu API Swagger / OpenAPI:** [http://localhost:3000/docs](http://localhost:3000/docs)
- **Kiểm tra trạng thái máy chủ API:** [http://localhost:3000/api/v1/health](http://localhost:3000/api/v1/health)
