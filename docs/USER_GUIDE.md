# MoveFlow — Hướng dẫn cài đặt và sử dụng

> Bản web MVP cho hệ thống giao nhận chặng cuối. Giao diện được phục vụ trên cổng `3005`; REST API trên cổng `3001`; PostgreSQL/PostGIS trên cổng localhost `5432`.

## 1. Chức năng hiện có

### Khách hàng
- Đăng ký bằng email cá nhân, xác minh email bằng OTP 6 chữ số rồi mới được đăng nhập.
- Đăng nhập, đăng xuất, xem hồ sơ, cập nhật tên và đổi mật khẩu.
- Tạo đơn giao nhận với điểm lấy, điểm giao, tọa độ, khối lượng và dịch vụ tiêu chuẩn/hỏa tốc.
- Yêu cầu báo phí trước khi tạo đơn; backend sử dụng khoảng cách từ OSRM.
- Xem danh sách đơn, chi tiết đơn, trạng thái và lịch sử; tra cứu bằng mã vận đơn.
- Mở Google Maps đến điểm lấy/điểm giao bằng URL, không cần Google Maps API key.

### Quản lý / điều phối
- Xem tổng quan đơn hàng, đơn cần phân công và trạng thái.
- Xem danh sách tài khoản, tạo tài khoản tài xế/điều phối có xác minh email, khóa/mở khóa tài khoản (ADMIN).
- Điều phối tự động đơn đang chờ (ADMIN/DISPATCHER).
- Quản lý phiên bản bảng giá (ADMIN).
- Quản lý hồ sơ và đổi mật khẩu của tài khoản quản lý.

### Tài xế
- Xem công việc được phân công, nhận/từ chối đơn.
- Cập nhật trạng thái sẵn sàng/ngoại tuyến.
- Mở Google Maps để đi đến điểm lấy và điểm giao.
- Cập nhật trạng thái đơn từ đã tiếp nhận → đang vận chuyển → đang giao → đã giao.

## 2. Yêu cầu

- Docker Desktop hiện hành và Docker Compose v2.
- Trình duyệt Chrome, Edge hoặc Firefox bản mới.
- Kết nối Internet để gọi OSRM và dịch vụ gửi email.
- Một tài khoản Gmail bật Xác minh 2 bước và Google App Password để gửi OTP qua SMTP. Người đăng ký có thể dùng Gmail cá nhân làm email nhận.

## 3. Cấu hình lần đầu

1. Giải nén repository.
2. Sao chép `.env.example` thành `.env`.
3. Đặt mật khẩu database và các secret riêng; mỗi secret phải dài tối thiểu 32 ký tự và không dùng chuỗi placeholder.
4. Cấu hình Gmail SMTP (`SMTP_USER`, `SMTP_APP_PASSWORD`, `EMAIL_FROM`) theo mục [Email OTP](EMAIL_OTP_SETUP.md).
5. Không commit `.env` lên Git.

Các biến quan trọng:

| Biến | Mục đích |
|---|---|
| `POSTGRES_PASSWORD` | Mật khẩu PostgreSQL chạy trong Docker |
| `JWT_SECRET` | Ký access token; chuỗi ngẫu nhiên dài ít nhất 32 ký tự |
| `OTP_SECRET` | Secret riêng dùng để băm OTP; không dùng chung secret production với môi trường khác |
| `EMAIL_DELIVERY_MODE` | `smtp` để gửi email thật qua Gmail; `console` chỉ dùng local development |
| `SMTP_USER` | Gmail dùng làm địa chỉ gửi OTP |
| `SMTP_APP_PASSWORD` | Google App Password 16 ký tự; không phải mật khẩu Gmail thường |
| `EMAIL_FROM` | Địa chỉ Gmail gửi OTP, thường trùng với `SMTP_USER` |
| `OSRM_BASE_URL` | Máy chủ routing OSRM; mặc định là máy chủ demo công khai |

## 4. Khởi động bằng Docker

Trong thư mục gốc có `compose.yaml`:

```bash
docker compose up --build -d
docker compose ps
```

Lần đầu, Compose build API, đợi PostgreSQL khỏe, chạy migrations và khởi động frontend. Sau đó truy cập:

- Web app: <http://localhost:3005>
- API health: <http://localhost:3001/api/v1/health>
- Swagger: <http://localhost:3001/api/docs>

Để xem log:

```bash
docker compose logs -f api
docker compose logs -f web
```

Nếu đây là môi trường demo cục bộ và cần các tài khoản mẫu, chạy seed:

```bash
docker compose run --rm migrate npm run db:seed
```

Seed tạo tài khoản mẫu: `sender@gmail.com`, `driver-a@gmail.com`, `driver-b@gmail.com`, `dispatcher@gmail.com`, `admin@gmail.com`. Mật khẩu mặc định là `admin` (đặt bằng `DEMO_PASSWORD`); seed cập nhật lại mật khẩu mỗi lần chạy. Các tài khoản mẫu đã được đánh dấu xác minh để demo, nên không nhận OTP. Địa chỉ này chỉ là tài khoản đăng nhập trong cơ sở dữ liệu local, không đảm bảo là hộp thư Gmail có thật. Không dùng tài khoản/mật khẩu demo trong production.

## 5. Cách dùng cơ bản

### Đăng ký khách hàng
1. Mở <http://localhost:3005>, chọn **Tạo tài khoản**.
2. Nhập họ tên, email bạn có thể truy cập và mật khẩu tối thiểu 10 ký tự.
3. Mở hộp thư (kiểm tra Spam/Quảng cáo), nhập OTP 6 chữ số trong vòng 10 phút.
4. Đăng nhập bằng email và mật khẩu sau khi xác minh thành công.

Nếu Gmail SMTP chưa cấu hình đúng, backend sẽ từ chối đăng ký và xóa tài khoản chưa xác minh để tránh tạo bản ghi không thể sử dụng. Kiểm tra log API và xác nhận `SMTP_USER`, Google App Password, `EMAIL_FROM` và kết nối mạng.

### Tạo đơn giao nhận
1. Vào **Tạo đơn giao hàng**.
2. Nhập địa chỉ lấy/giao đầy đủ.
3. Ghim chính xác cả điểm lấy và điểm giao trên bản đồ.
4. Nhập khối lượng, kích thước, chọn dịch vụ; nhấn **Tính phí dự kiến**.
5. Kiểm tra phí và quãng đường tính phí (km), sau đó nhấn **Tạo đơn giao hàng**.
6. Lưu mã vận đơn và theo dõi trong **Đơn hàng của tôi**.

Quãng đường tính phí được lấy từ OSRM dựa trên hai tọa độ đã ghim. Hãy kiểm tra vị trí ghim trùng với địa chỉ trước khi tính phí hoặc tạo đơn.

### Quản lý và điều phối
1. Đăng nhập bằng tài khoản `ADMIN` hoặc `DISPATCHER` được cấp.
2. Vào **Tổng quan** để xem đơn và hàng chờ.
3. Mở **Tất cả đơn hàng**, kiểm tra chi tiết hoặc mở **Điều phối tài xế** để gọi phân công.
4. Tài khoản `ADMIN` có thể mở **Tài khoản & phân quyền** để khóa/mở tài khoản và **Bảng giá dịch vụ** để tạo phiên bản bảng giá mới.

### Tài xế
1. Đăng nhập tài khoản `DRIVER` đã được cấp và xác minh.
2. Mở **Công việc của tôi**.
3. Nhận/từ chối đơn; dùng **Đi đến điểm lấy hàng/điểm giao hàng** để mở Google Maps.
4. Cập nhật trạng thái theo tiến trình thực tế.

## 6. Bảo mật và giới hạn MVP

- Đăng ký công khai chỉ tạo vai trò khách hàng (`SENDER`); không cho người dùng tự nâng quyền thành tài xế/điều phối/quản trị viên.
- OTP được sinh ngẫu nhiên, chỉ lưu hash, hết hạn sau 10 phút và giới hạn số lần thử. Endpoint xác minh/gửi lại bị rate limit.
- Access token và refresh token được giữ trong bộ nhớ của frontend, không lưu vào localStorage. Access token hết hạn sau 15 phút; frontend sẽ thử làm mới phiên một lần bằng refresh-token rotation. Tải lại trang vẫn cần đăng nhập lại.
- Đổi mật khẩu hoặc khóa tài khoản sẽ thu hồi refresh session. Access token đã phát hành có thể còn hiệu lực đến hết thời hạn ngắn 15 phút.
- OTP email hiện là xác minh địa chỉ email trong quá trình đăng ký; **chưa phải MFA bắt buộc qua email ở mỗi lần đăng nhập**.
- OSRM public demo không có SLA và dùng profile `driving`; tuyến và khoảng cách có thể khác tuyến xe máy Google Maps. Không dùng làm dữ liệu giá cước production nếu chưa kiểm định.
- Chưa có cổng thanh toán thật, push notification, ảnh ký nhận, COD, hoàn hàng hoặc kiểm thử trình duyệt tự động.

## 7. Dừng và khởi động lại

```bash
docker compose down
# Khởi động lại, giữ nguyên dữ liệu database:
docker compose up -d
```

Không chạy `docker compose down -v` trừ khi muốn xóa hoàn toàn dữ liệu demo/database.

## 8. Khi có lỗi

- Web không mở: kiểm tra `docker compose ps`, `docker compose logs web`, cổng `3005` có bị ứng dụng khác chiếm không.
- Backend không khỏe: `docker compose logs api` và kiểm tra `DATABASE_URL`, `JWT_SECRET`.
- Đăng ký trả 503: kiểm tra `SMTP_USER`, Google App Password, `EMAIL_FROM`, kết nối mạng và log backend.
- Tạo đơn báo không tìm thấy tuyến: kiểm tra latitude/longitude, Internet và tình trạng OSRM.
- Swagger trả 401/403: đăng nhập lấy access token, role hiện tại có thể không có quyền với endpoint đó.
