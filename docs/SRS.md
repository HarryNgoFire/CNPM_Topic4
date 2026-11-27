# Tài liệu đặc tả yêu cầu phần mềm (SRS)

## MoveFlow — Hệ thống giao nhận chặng cuối và theo dõi vận đơn

## 1. Mục đích và phạm vi

### 1.1 Mục đích

SRS này thống nhất yêu cầu nghiệp vụ, chức năng, dữ liệu, giao diện, bảo mật và tiêu chí kiểm thử của MoveFlow. Tài liệu có thể được dùng làm căn cứ để:

- xác định phạm vi bàn giao giữa M1, M2, M3 và M4;
- phát triển hoặc sửa đổi giao diện/API/schema theo cùng một hợp đồng;
- xây dựng test case và kiểm tra điều kiện nghiệm thu;
- phân biệt chức năng hiện có với các hạng mục chưa triển khai.

### 1.2 Phạm vi sản phẩm

MoveFlow là ứng dụng web một trang (SPA) và REST API phục vụ giao nhận chặng cuối. Hệ thống hỗ trợ:

1. đăng ký người gửi, xác minh email OTP, đăng nhập và quản lý phiên;
2. tạo đơn với địa chỉ lấy/giao, vị trí bản đồ, thông tin kiện, loại dịch vụ và báo giá;
3. sinh mã vận đơn, điều phối tài xế, nhận/từ chối công việc và cập nhật trạng thái;
4. dẫn đường giao hàng hai chặng, cập nhật GPS và kiểm tra geofence khi xác nhận đến điểm;
5. xem đơn, lịch sử trạng thái, theo dõi vị trí trực tiếp có phân quyền và tra cứu công khai;
6. quản trị tài khoản do quản trị viên cấp, phiên bản bảng giá và webhook;
7. lưu trữ dữ liệu quan hệ và không gian địa lý bằng PostgreSQL/PostGIS.

### 1.3 Ngoài phạm vi hiện tại

Các nội dung sau không được coi là chức năng đã triển khai trong SRS này:

- thanh toán trực tuyến, COD, hoàn tiền;
- bằng chứng giao hàng như ảnh, chữ ký hoặc mã OTP giao hàng;
- hoàn hàng, giao lại nhiều lần theo quy trình chuyên biệt;
- chatbot Gemini/AI;
- quên mật khẩu/đặt lại mật khẩu qua email hoặc MFA email ở mỗi lần đăng nhập;
- push notification/SMS;
- cam kết SLA cho OSRM, Nominatim hoặc máy chủ bản đồ công cộng;
- E2E trình duyệt tự động đầy đủ.

## 2. Mô tả tổng quan

### 2.1 Nhóm người dùng và vai trò hệ thống

| Vai trò                        | Mục tiêu và quyền tổng quát                                                                                                                             |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Khách chưa đăng nhập       | Đăng ký tài khoản người gửi; tra cứu công khai bằng mã vận đơn; kiểm tra trạng thái dịch vụ qua health endpoint.                          |
| SENDER (người gửi)           | Quản lý hồ sơ; tạo báo giá/đơn; xem đơn của chính mình; theo dõi trạng thái/vị trí; hủy đơn khi còn ở trạng thái đủ điều kiện. |
| DRIVER (tài xế)               | Xem công việc được giao; nhận/từ chối; bật/tắt trạng thái sẵn sàng; cập nhật GPS; dẫn đường và cập nhật tiến trình giao.             |
| DISPATCHER (điều phối viên) | Xem đơn và hàng chờ; xem tài xế; phân công hoặc phân công lại tài xế; tra cứu và theo dõi đơn.                                            |
| ADMIN (quản trị viên)        | Có các quyền quản lý vận hành cần thiết, bao gồm quản lý tài khoản, bảng giá, webhook, đơn hàng và điều phối.                          |
| SYSTEM                          | Vai trò nội bộ; không phải tài khoản đăng nhập tương tác và không được phép đăng nhập như người dùng thông thường.               |

Quyền được kiểm tra ở API. Việc ẩn/hiện điều hướng hoặc nút trên frontend không thay thế kiểm tra quyền phía backend.

### 2.2 Môi trường và kiến trúc

- Frontend: HTML/CSS/JavaScript thuần, SPA được phục vụ qua Nginx; MapLibre GL để hiển thị bản đồ.
- Backend: Node.js, NestJS, TypeScript; REST API có tiền tố `/api/v1`; tài liệu API qua Swagger.
- Database: PostgreSQL với PostGIS; Prisma schema và migration là nguồn quản lý cấu trúc dữ liệu.
- Tích hợp tuyến đường: OSRM (profile `driving`).
- Tích hợp tìm kiếm địa chỉ: backend proxy đến Nominatim.
- Email: SMTP để gửi mã xác minh; chế độ console chỉ phù hợp môi trường phát triển.
- Môi trường chạy: Docker Compose có thể khởi động web, API, database và migration.

### 2.3 Giả định và phụ thuộc

- Người dùng có trình duyệt hiện đại, kết nối mạng và cho phép định vị nếu muốn dùng GPS.
- Tạo đơn cần dịch vụ định tuyến hoạt động; hệ thống không tự thay thế khoảng cách đường bộ bằng khoảng cách đường chim bay khi OSRM lỗi.
- Tìm kiếm địa chỉ, định tuyến, gửi email và tải tile bản đồ phụ thuộc dịch vụ ngoài/cấu hình môi trường.
- Tài khoản DRIVER/DISPATCHER được ADMIN tạo; đăng ký công khai chỉ cấp vai trò SENDER.
- Thời gian lưu trữ dữ liệu, SLA production, RTO/RPO và tải đỉnh chưa được đặc tả trong cấu hình hiện tại.

## 3. Quy trình nghiệp vụ chính

1. Người gửi đăng ký bằng email và mật khẩu; hệ thống gửi OTP.
2. Người dùng xác minh email rồi đăng nhập.
3. Người gửi tìm/chọn địa chỉ lấy và giao, ghim tọa độ, nhập thông tin kiện, chọn STANDARD hoặc EXPRESS.
4. Backend truy vấn tuyến OSRM, tính phí theo quy tắc giá đang hiệu lực, sau đó tạo đơn và lưu phí/chi tiết tính phí tại thời điểm đặt.
5. Hệ thống sinh tracking code và ghi trạng thái đầu tiên `RECEIVED`; tiến hành thử tự động phân công tài xế gần nhất đủ điều kiện.
6. Tài xế nhận hoặc từ chối yêu cầu. Khi nhận, đơn chuyển sang `EN_ROUTE_PICKUP`.
7. Tài xế cập nhật vị trí và chỉ có thể xác nhận đến điểm lấy/giao khi đạt yêu cầu GPS/geofence. Sau khi xác nhận lấy hàng, đơn chuyển qua giai đoạn giao.
8. Tài xế giao thành công hoặc ghi nhận giao thất bại kèm lý do. Các lần đổi trạng thái được ghi lịch sử và phát sinh webhook event.
9. Người gửi/điều phối/quản trị theo dõi chi tiết; người ngoài có thể tra cứu thông tin công khai bằng tracking code nhưng không xem GPS tài xế.

## 4. Yêu cầu chức năng

Mức ưu tiên: **Cao** = cốt lõi/nghiệp vụ bắt buộc; **Trung bình** = chức năng quản lý/vận hành hỗ trợ.

### 4.1 M1 — Frontend

| ID    | Ưu tiên   | Yêu cầu                                                                                                                                                                                                                                       |
| ----- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FE-01 | Cao         | Giao diện phải cung cấp đăng nhập, đăng ký người gửi, nhập OTP xác minh email và gửi lại OTP. Các lỗi đăng nhập/xác minh phải được thông báo; phiên hết hạn phải yêu cầu đăng nhập lại.                  |
| FE-02 | Cao         | Sau đăng nhập, giao diện phải hiển thị điều hướng theo vai trò: người gửi, tài xế, điều phối hoặc quản trị viên; người dùng không được tiếp cận chức năng chỉ dành cho vai trò khác.                     |
| FE-03 | Cao         | Trang tổng quan phải trình bày dữ liệu đơn phù hợp quyền hiện tại, các trạng thái chính, đơn gần đây/đang hoạt động và đường dẫn tới chức năng tương ứng.                                                  |
| FE-04 | Cao         | Người gửi (và ADMIN theo quyền API) phải có thể nhập thông tin lấy/giao, tra cứu gợi ý địa chỉ, chọn hoặc kéo ghim A/B trên bản đồ; giao diện hỗ trợ lấy GPS thiết bị cho điểm lấy hàng.                      |
| FE-05 | Cao         | Màn tạo đơn phải thu thập địa chỉ hành chính, tọa độ hợp lệ, cân nặng, kích thước kiện và loại dịch vụ STANDARD/EXPRESS; phải cho phép xem báo giá trước khi xác nhận tạo đơn.                             |
| FE-06 | Cao         | Giao diện báo giá phải trình bày phí, khoảng cách và thời gian tuyến dự kiến do API cung cấp; phải thể hiện lỗi nếu không lấy được tuyến/báo giá, không tự đưa ra mức phí thay thế.                          |
| FE-07 | Cao         | Người gửi, điều phối và quản trị viên phải có thể duyệt danh sách đơn được API cấp, lọc trạng thái (nếu có), mở chi tiết và xem mã vận đơn, cước, tuyến, kiện hàng, trạng thái và lịch sử.           |
| FE-08 | Cao         | Màn chi tiết đơn phải hiển thị bản đồ tuyến và vị trí tài xế trực tiếp cho người có quyền; giao diện cập nhật định kỳ khoảng 10 giây khi trang hiển thị và dừng polling khi đơn kết thúc/rời màn hình. |
| FE-09 | Cao         | Màn tra cứu phải chuẩn hóa mã nhập thành chữ hoa, truy vấn tracking công khai và hiển thị trạng thái, thời điểm, khu vực lấy/giao và lịch sử; không được hiển thị tọa độ GPS tài xế.                         |
| FE-10 | Cao         | Tài xế phải có màn công việc/ca trực, xem việc đang chờ hoặc đã nhận, làm mới danh sách, nhận hoặc từ chối yêu cầu và xem bản đồ điều hướng phù hợp giai đoạn.                                              |
| FE-11 | Cao         | Màn tài xế phải cho phép bật/tắt trạng thái sẵn sàng, cập nhật GPS, xác nhận đến điểm lấy, xác nhận lấy hàng, đến điểm giao, hoàn tất giao hoặc báo giao thất bại với lý do.                                |
| FE-12 | Cao         | Trạng thái nút đến điểm phải phản ánh điều kiện geofence từ backend; frontend không được xem xét vị trí thiết bị như bằng chứng duy nhất để ghi nhận đã đến.                                                  |
| FE-13 | Trung bình | Điều phối viên phải xem hàng chờ, danh sách tài xế/đơn và thực hiện phân công hoặc yêu cầu phân công lại thông qua API.                                                                                                 |
| FE-14 | Trung bình | ADMIN phải có giao diện xem/tạo tài khoản DRIVER hoặc DISPATCHER, kích hoạt/khóa tài khoản, xem/tạo phiên bản bảng giá và xem/tạo webhook subscription/sự kiện.                                                            |
| FE-15 | Trung bình | Người dùng đã đăng nhập phải xem/cập nhật tên hồ sơ và đổi mật khẩu bằng mật khẩu hiện tại.                                                                                                                             |
| FE-16 | Trung bình | Giao diện phải hỗ trợ bố cục desktop/mobile. Tùy chọn giao diện sáng/tối, mô phỏng thiết bị và công cụ demo (nếu bật trong môi trường) không làm thay đổi nghiệp vụ thực trên server.                            |
| FE-17 | Cao         | Khi request thất bại, giao diện phải thể hiện trạng thái lỗi phù hợp, không hiển thị dữ liệu thành công giả hoặc tiếp tục cho phép gửi form trong trạng thái đang xử lý.                                           |

### 4.2 M2 — Backend

#### Xác thực, tài khoản và phân quyền

| ID    | Ưu tiên   | Yêu cầu                                                                                                                                                                                                                                     |
| ----- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BE-01 | Cao         | API đăng ký công khai nhận email, tên, mật khẩu và chỉ tạo vai trò SENDER; email được chuẩn hóa chữ thường/loại khoảng trắng; email trùng phải bị từ chối.                                                        |
| BE-02 | Cao         | API xác minh email phát OTP 6 chữ số, chỉ lưu hash, giới hạn thời hạn 10 phút và tối đa 5 lần nhập sai cho một mã. OTP cũ được tiêu thụ khi gửi mã mới.                                                            |
| BE-03 | Cao         | API gửi lại OTP không tiết lộ rõ ràng email có tồn tại hay đã xác minh; endpoint xác minh/gửi mã/đăng ký/đăng nhập có giới hạn tốc độ.                                                                            |
| BE-04 | Cao         | Đăng nhập chỉ thành công với tài khoản hoạt động, đã xác minh email và thông tin xác thực hợp lệ. Tài khoản bị khóa hoặc chưa xác minh không được cấp phiên.                                                |
| BE-05 | Cao         | Access token có thời hạn 15 phút; refresh token có thời hạn 7 ngày, chỉ lưu hash và được xoay vòng khi refresh. Logout thu hồi refresh session; đổi mật khẩu/khóa tài khoản thu hồi các phiên refresh tương ứng. |
| BE-06 | Cao         | API phải bảo vệ endpoint theo role, kiểm tra quyền sở hữu đơn của SENDER và quan hệ phân công của DRIVER. Request trái quyền phải trả lỗi phù hợp (401/403), tài nguyên không tồn tại trả 404.                    |
| BE-07 | Trung bình | Người dùng có thể xem hồ sơ, cập nhật tên và đổi mật khẩu với xác minh mật khẩu hiện tại; ADMIN có thể liệt kê tài khoản, tạo DRIVER/DISPATCHER và kích hoạt/khóa tài khoản.                                |

#### Báo giá, giao nhận và điều phối

| ID    | Ưu tiên   | Yêu cầu                                                                                                                                                                                                                                                                                                                                 |
| ----- | ----------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BE-08 | Cao         | API báo giá phải lấy quy tắc đang hoạt động và có hiệu lực mới nhất, tìm tuyến OSRM giữa hai tọa độ và tính cước theo công thức: `(baseFee + distanceKm × ratePerKm + max(0, weightKg − freeWeightThreshold) × ratePerExtraKg) × serviceMultiplier`; làm tròn VND đến đơn vị đồng theo half-up. |
| BE-09 | Cao         | API phải từ chối dữ liệu địa chỉ/tọa độ/kiện/dịch vụ sai định dạng; không có quy tắc giá hoặc không lấy được tuyến phải trả lỗi, không âm thầm tính theo đường thẳng.                                                                                                                              |
| BE-10 | Cao         | API tạo đơn phải xác thực người gửi/ADMIN, tính lại phí ở backend, tạo địa chỉ và kiện hàng, sinh tracking code duy nhất, chốt `fee` cùng `feeBreakdown`, tạo lịch sử RECEIVED và event ban đầu trong luồng nhất quán.                                                                                |
| BE-11 | Cao         | Mã vận đơn phải là chuỗi chữ hoa/chữ số 12–16 ký tự và duy nhất; xung đột khi sinh mã được thử lại có giới hạn, hết số lần phải báo lỗi.                                                                                                                                                                  |
| BE-12 | Cao         | API danh sách hỗ trợ phân trang, giới hạn kích thước trang tối đa 100 và lọc trạng thái; SENDER chỉ xem đơn của chính mình, ADMIN/DISPATCHER xem danh sách vận hành theo quyền.                                                                                                                                  |
| BE-13 | Cao         | API chi tiết phải kiểm tra quyền trước khi trả địa chỉ, kiện hàng, lịch sử; DRIVER chỉ xem đơn gắn với phân công của mình.                                                                                                                                                                                         |
| BE-14 | Cao         | Tự động phân công chọn tài xế hoạt động, AVAILABLE, có vị trí đủ mới, trong phạm vi cấu hình, không có phân công đang hoạt động; ưu tiên tài xế gần điểm lấy nhất và tránh lặp tài xế đã bị từ chối/hết hạn.                                                                             |
| BE-15 | Cao         | ADMIN/DISPATCHER có thể yêu cầu phân công tự động hoặc chỉ định tài xế; chỉ đơn RECEIVED chưa có phân công đang hoạt động mới được phân công. Khi đạt giới hạn thử hoặc không có tài xế phù hợp, đơn phải được đưa về hàng chờ điều phối.                                       |
| BE-16 | Cao         | DRIVER chỉ có thể trả lời assignment của chính mình. Phản hồi hết hạn hoặc đã giải quyết phải bị từ chối phù hợp; nhận đơn chuyển tài xế BUSY và shipment sang EN_ROUTE_PICKUP; từ chối/hết hạn kích hoạt thử phân công lại.                                                                      |
| BE-17 | Cao         | Trạng thái shipment chỉ được chuyển theo state machine hợp lệ; API phải khóa/đồng bộ cập nhật để tránh hai cập nhật đồng thời làm sai trạng thái. Mỗi chuyển trạng thái hợp lệ ghi lịch sử và event.                                                                                                  |
| BE-18 | Cao         | SENDER chỉ hủy đơn do mình tạo khi đơn còn RECEIVED và chưa được nhận phân công; DRIVER không được hủy; yêu cầu CANCELLED/DELIVERY_FAILED bắt buộc có lý do dài 1–255 ký tự.                                                                                                                              |
| BE-19 | Cao         | Khi kết thúc bằng DELIVERED, DELIVERY_FAILED hoặc CANCELLED, assignment đang hoạt động phải được đóng và trạng thái tài xế được giải phóng theo nghiệp vụ.                                                                                                                                                      |
| BE-20 | Cao         | API tài xế phải cung cấp danh sách công việc, cập nhật trạng thái OFFLINE/AVAILABLE khi không còn assignment đang hoạt động, và nhận vị trí GPS kèm độ chính xác/thời điểm.                                                                                                                                  |
| BE-21 | Cao         | Backend phải từ chối GPS ngoài WGS84, độ chính xác trên 200m, thời điểm cũ hơn 120 giây hoặc lệch tương lai quá 30 giây, timestamp không tăng, tốc độ bất khả thi; cập nhật quá dày/đứng yên có thể bị từ chối mềm theo chính sách throttling.                                                 |
| BE-22 | Cao         | Chuyển sang ARRIVED_PICKUP/ARRIVED_DROPOFF phải được backend xác minh vị trí còn mới tối đa 30 giây, độ chính xác không quá 50m và khoảng cách không quá 100m.                                                                                                                                                    |
| BE-23 | Cao         | API navigation phải cung cấp phase, đích và tuyến phù hợp trạng thái; trước khi xác nhận lấy hàng không được tiết lộ đích/tuyến giao hàng cho DRIVER.                                                                                                                                                           |
| BE-24 | Cao         | API live location chỉ cho người gửi sở hữu đơn, tài xế được gán, dispatcher và admin; tracking công khai không trả tọa độ tài xế.                                                                                                                                                                                  |
| BE-25 | Trung bình | API geocoding cung cấp tìm kiếm (chuỗi 3–200 ký tự, tối đa 5 kết quả) và reverse geocoding; lỗi dịch vụ ngoài phải được phản ánh thành lỗi dịch vụ thay vì trả kết quả bịa đặt.                                                                                                                          |

#### Tracking, quản trị và tích hợp webhook

| ID    | Ưu tiên   | Yêu cầu                                                                                                                                                                                                                                                     |
| ----- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| BE-26 | Cao         | Tra cứu công khai bằng tracking code hợp lệ chỉ trả mã, trạng thái, thời gian tạo, thành phố lấy/giao và lịch sử trạng thái công khai; không trả ID người gửi, thông tin kiện nhạy cảm hoặc tọa độ GPS.                     |
| BE-27 | Trung bình | ADMIN có thể xem và tạo revision bảng giá; revision mới tăng version, được tạo từ bản mới nhất và không sửa phí đã chốt trong shipment cũ.                                                                                            |
| BE-28 | Trung bình | ADMIN có thể đăng ký webhook với URL nằm trong allowlist cấu hình và secret tối thiểu 32 ký tự; API không trả secret khi liệt kê subscription.                                                                                              |
| BE-29 | Trung bình | Mỗi thay đổi trạng thái tạo event `shipment.status_changed` và delivery cho subscription hoạt động. Webhook gửi POST có chữ ký HMAC SHA-256, event ID, timeout; lỗi được retry theo lịch cấu hình tối đa 5 lần sau lần gửi đầu. |
| BE-30 | Trung bình | ADMIN có thể xem subscription và danh sách event/delivery, trạng thái gửi, số lần thử, lỗi cuối và thời điểm gửi.                                                                                                                            |
| BE-31 | Cao         | Health endpoint phải kiểm tra kết nối database và trả trạng thái ok khi dependency hoạt động; API phải cung cấp Swagger/OpenAPI cho các endpoint được công bố.                                                                             |

### 4.3 M3 — Database

| ID    | Ưu tiên   | Yêu cầu                                                                                                                                                                                                                                                             |
| ----- | ----------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| DB-01 | Cao         | PostgreSQL phải bật PostGIS và lưu tọa độ pickup/dropoff/driver dưới dạng geography point WGS84; hỗ trợ truy vấn khoảng cách và vùng lân cận.                                                                                                      |
| DB-02 | Cao         | Schema phải quản lý các thực thể User, RefreshSession, EmailVerificationCode, Driver, Address, Shipment, Parcel, DriverAssignment, ShipmentStatusHistory, PricingRule, WebhookSubscription, WebhookEvent và WebhookDelivery cùng khóa/quan hệ tương ứng. |
| DB-03 | Cao         | Email và trackingCode phải duy nhất; mỗi shipment tối đa một Parcel; dữ liệu trạng thái, dịch vụ, driver status, assignment status và delivery status phải được giới hạn bằng enum/ràng buộc.                                                  |
| DB-04 | Cao         | Cân nặng/kích thước phải dương; phí dùng decimal với độ chính xác phù hợp; tọa độ địa lý và thời điểm phải được lưu nhất quán.                                                                                                      |
| DB-05 | Cao         | `fee` và `feeBreakdown` của shipment là snapshot tại thời điểm đặt; dữ liệu đó không được thay đổi khi ADMIN chỉnh bảng giá.                                                                                                                |
| DB-06 | Cao         | Shipment status history chỉ được append; lịch sử phải liên kết shipment và actor, ghi trạng thái trước/sau, lý do (nếu có) và thời điểm.                                                                                                         |
| DB-07 | Cao         | Database phải ngăn assignment hoạt động trùng cho cùng shipment hoặc cùng driver; cần index phục vụ tìm assignment hết hạn, danh sách theo trạng thái, shipment theo chủ và truy vấn không gian tài xế.                                       |
| DB-08 | Cao         | Webhook event/delivery phải có liên kết và tính duy nhất cho cặp event-subscription; lưu status, attempts, nextAttemptAt, lease/lock và thông tin lỗi để xử lý retry an toàn.                                                                        |
| DB-09 | Cao         | Mọi thay đổi schema phải đi qua migration có thứ tự; migration đã chia sẻ không được sửa hồi tố; Prisma schema và SQL đặc thù (PostGIS, trigger, partial index, constraint) phải đồng bộ.                                                   |
| DB-10 | Trung bình | Seed phải dùng được lặp lại cho môi trường demo, không được biến tài khoản demo thành mặc định production. Không lưu secret môi trường trong schema hoặc migration.                                                                        |

### 4.4 M4 — Testing/QA

| ID    | Ưu tiên   | Yêu cầu kiểm thử/nghiệm thu                                                                                                                                                                                                      |
| ----- | ----------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| QA-01 | Cao         | Unit test phải bao phủ tính phí, định tuyến, geospatial/GPS, trạng thái đơn, dispatch và webhook retry/signature.                                                                                                         |
| QA-02 | Cao         | Test RBAC phải kiểm tra quyền endpoint cho vai trò được phép/không được phép; integration test phải kiểm tra thêm quyền sở hữu đơn và phân công tài xế.                                                     |
| QA-03 | Cao         | Test state machine phải xác nhận các chuyển trạng thái hợp lệ, từ chối chuyển trạng thái sai, xử lý trạng thái cuối và yêu cầu lý do hủy/thất bại.                                                          |
| QA-04 | Cao         | Integration test trên PostgreSQL/PostGIS phải kiểm tra ràng buộc, migration, transaction, snapshot phí, lịch sử append-only, geofence và luồng tạo đơn → phân công → giao → tracking.                               |
| QA-05 | Cao         | Frontend test phải kiểm tra API client và các ca biên của bản đồ, GPS, định vị lại camera, quy trình chuyến tài xế và luồng người gửi.                                                                          |
| QA-06 | Cao         | Negative test phải kiểm tra dữ liệu sai định dạng, UUID/tracking code không hợp lệ, tài nguyên không tồn tại, phân trang ngoài giới hạn, đăng nhập/OTP bị giới hạn tốc độ và lỗi dịch vụ phụ thuộc. |
| QA-07 | Cao         | Mọi yêu cầu dữ liệu riêng tư phải được kiểm tra bằng assertion về response shape; tracking công khai không chứa tọa độ GPS hoặc định danh người gửi.                                                        |
| QA-08 | Cao         | Thay đổi phải vượt qua các kiểm tra phù hợp: lint, typecheck, build, unit/API tests, integration tests khi liên quan DB và web tests khi liên quan frontend/map.                                                          |
| QA-09 | Trung bình | Báo cáo kiểm thử phải ghi commit, môi trường, lệnh chạy, kết quả, lỗi tái hiện được, phạm vi chưa kiểm thử và phân biệt lỗi code với lỗi hạ tầng/phụ thuộc ngoài.                                    |

## 5. State machine và quy tắc nghiệp vụ

### 5.1 Trạng thái shipment

Các giá trị trạng thái được lưu trong hệ thống:

`RECEIVED`, `EN_ROUTE_PICKUP`, `ARRIVED_PICKUP`, `IN_TRANSIT`, `OUT_FOR_DELIVERY`, `ARRIVED_DROPOFF`, `DELIVERED`, `CANCELLED`, `DELIVERY_FAILED`.

Các chuyển trạng thái được code hỗ trợ:

| Từ                                                                                           | Đến            | Điều kiện chính                                                                          |
| --------------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------- |
| RECEIVED                                                                                      | EN_ROUTE_PICKUP  | Tài xế nhận assignment hợp lệ.                                                          |
| EN_ROUTE_PICKUP                                                                               | ARRIVED_PICKUP   | Tài xế được gán; GPS đạt geofence điểm lấy.                                       |
| ARRIVED_PICKUP                                                                                | OUT_FOR_DELIVERY | Tài xế xác nhận đã nhận hàng.                                                        |
| OUT_FOR_DELIVERY                                                                              | ARRIVED_DROPOFF  | Tài xế được gán; GPS đạt geofence điểm giao.                                       |
| ARRIVED_DROPOFF                                                                               | DELIVERED        | Tài xế hoàn tất giao.                                                                    |
| IN_TRANSIT                                                                                    | OUT_FOR_DELIVERY | Tương thích luồng trạng thái chuyển tiếp.                                            |
| IN_TRANSIT / OUT_FOR_DELIVERY / ARRIVED_DROPOFF                                               | DELIVERY_FAILED  | Tài xế ghi lý do thất bại.                                                              |
| RECEIVED / EN_ROUTE_PICKUP / ARRIVED_PICKUP / IN_TRANSIT / OUT_FOR_DELIVERY / ARRIVED_DROPOFF | CANCELLED        | Hủy hợp lệ theo quyền; SENDER chỉ được hủy đơn RECEIVED chưa có tài xế nhận. |

`DELIVERED`, `CANCELLED` và `DELIVERY_FAILED` là trạng thái cuối trong luồng thông thường. `IN_TRANSIT` tồn tại trong enum và một số nhánh chuyển tiếp/API nhưng luồng giao hai chặng hiện dùng `OUT_FOR_DELIVERY` sau khi lấy hàng.

### 5.2 Quy tắc giá

- Loại dịch vụ: `STANDARD` hoặc `EXPRESS`.
- Công thức: `phí = (phí cơ bản + phí km + phụ phí cân nặng) × hệ số dịch vụ`.
- `phí km = khoảng cách tuyến OSRM (km) × đơn giá/km`.
- `phụ phí cân nặng = max(0, cân nặng − ngưỡng miễn phí) × đơn giá/kg vượt ngưỡng`.
- Hệ số STANDARD/EXPRESS lấy từ PricingRule mới nhất đang hoạt động và có hiệu lực.
- Kết quả được làm tròn đến đồng; phí và breakdown được lưu cùng shipment làm snapshot.

### 5.3 Quy tắc phân công và GPS

- Tài xế phải có tài khoản hoạt động, trạng thái AVAILABLE, vị trí gần đây và chưa có assignment PENDING/ACCEPTED khác.
- Assignment có thời hạn; khi hết hạn hoặc bị từ chối, hệ thống có thể phân công tiếp; quá số lần cấu hình thì cần dispatcher can thiệp.
- GPS phải có tọa độ WGS84, accuracy tối đa 200m, thời điểm hợp lệ/còn mới; kiểm soát tốc độ, khoảng cách/thời gian cập nhật để loại dữ liệu bất thường.
- Xác nhận đến điểm yêu cầu accuracy tối đa 50m, vị trí không quá 30 giây và cách điểm đích tối đa 100m.

## 6. Giao diện ngoài và hợp đồng tích hợp

### 6.1 Giao diện người dùng

- Màn hình xác thực: đăng nhập, đăng ký, nhập OTP, gửi lại mã.
- Màn hình SENDER: tổng quan, đơn của tôi, tạo đơn, tra cứu, hồ sơ.
- Màn hình DRIVER: ca trực/bản đồ GPS, lịch sử chuyến theo dữ liệu được cấp, hồ sơ tài xế.
- Màn hình DISPATCHER: tổng quan, tất cả đơn, hàng chờ, tra cứu, hồ sơ.
- Màn hình ADMIN: tổng quan, đơn, tài khoản, bảng giá, webhook, tracking, hồ sơ.
- Giao diện có bố cục desktop/mobile; bản đồ và định vị cần quyền/kết nối trình duyệt tương ứng.

### 6.2 API chính

Các đường dẫn sau nằm dưới `/api/v1`:

| Nhóm      | Endpoint chính                                                                                                                      | Quyền                                                                                   |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------- |
| Auth       | `POST /auth/register`, `/auth/verify-email`, `/auth/resend-verification`, `/auth/login`, `/auth/refresh`, `/auth/logout` | Hầu hết công khai; giới hạn tốc độ áp dụng.                                    |
| User       | `GET/PATCH /users/me`, `PATCH /users/me/password`                                                                                | Người dùng đăng nhập.                                                              |
| Admin user | `GET/POST /admin/users`, `PATCH /admin/users/:id/active`                                                                         | ADMIN.                                                                                   |
| Shipment   | `POST/GET /shipments`, `GET /shipments/:id`, `GET /shipments/:id/navigation`, `/live`, `POST /shipments/:id/transition`    | Theo role và quyền sở hữu/phân công.                                               |
| Tracking   | `GET /tracking/:trackingCode`                                                                                                      | Công khai, response giới hạn trường.                                                |
| Driver     | `GET /drivers/me/tasks`, `PATCH /drivers/me/location`, `/status`                                                               | DRIVER.                                                                                  |
| Dispatch   | `POST /shipments/:id/assign-driver`, `POST /assignments/:id/respond`, `GET /dispatch/queue`, `/dispatch/drivers`             | Dispatcher/Admin hoặc Driver theo endpoint.                                             |
| Pricing    | `POST /pricing/quote`                                                                                                              | SENDER/ADMIN. `GET /admin/pricing-rules`, `PUT /admin/pricing-rules/:id` chỉ ADMIN. |
| Geocoding  | `GET /geocoding/search`, `/reverse`                                                                                              | API có bearer auth.                                                                     |
| Webhooks   | `POST/GET /webhooks/subscriptions`, `GET /webhooks/events`                                                                       | ADMIN.                                                                                   |
| Health     | `GET /health`                                                                                                                      | Công khai; kiểm tra database.                                                          |

API kiểm tra dữ liệu đầu vào bằng DTO; lỗi thường được phản hồi theo nhóm HTTP 400, 401, 403, 404, 409, 429 hoặc 503 tùy nguyên nhân.

### 6.3 Tích hợp ngoài

- OSRM: tuyến, hình học tuyến, khoảng cách và thời gian ước tính; profile hiện tại là `driving`.
- Nominatim: tìm kiếm địa chỉ và reverse geocoding thông qua backend.
- SMTP: gửi OTP xác minh email.
- Webhook receiver của khách hàng: nhận event JSON; kiểm tra `X-Webhook-Signature` và `X-Webhook-Event-Id`.
- Map tile/style: cấu hình bản đồ có thể dùng hạ tầng tự lưu trữ hoặc nguồn công khai/fallback tùy môi trường.

## 7. Yêu cầu phi chức năng

| ID                                  | Yêu cầu                                                                                                                                                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| NFR-01 Bảo mật                    | Mật khẩu không lưu dạng rõ; refresh token/OTP được lưu dưới dạng hash; access token và quyền được kiểm tra ở backend. Secret chỉ lấy từ biến môi trường và không commit vào repository. |
| NFR-02 Riêng tư                   | Chỉ trả dữ liệu tối thiểu theo role. Tracking công khai không trả thông tin định danh người gửi hoặc GPS tài xế; thông tin vị trí trực tiếp chỉ hiển thị cho vai trò được phép.        |
| NFR-03 Toàn vẹn                   | Tạo shipment, ghi trạng thái, lịch sử và webhook event phải nhất quán; ràng buộc database là lớp bảo vệ bổ sung cho logic ứng dụng.                                                                 |
| NFR-04 Hiệu năng                  | Phân trang giới hạn tối đa 100 bản ghi; geocoding chỉ nhận tối đa 5 kết quả; GPS và webhook được throttling/batch để hạn chế tải. Mục tiêu latency/SLA cụ thể chưa được xác lập.       |
| NFR-05 Khả dụng                   | Lỗi từ SMTP/OSRM/Nominatim/database phải được thể hiện rõ; không được trả dữ liệu thành công giả. Tính khả dụng production của dịch vụ ngoài không được đảm bảo bởi ứng dụng.     |
| NFR-06 Tương thích               | Web phải hoạt động trên trình duyệt hiện đại hỗ trợ JavaScript, Fetch API, bản đồ WebGL và geolocation khi cần; bố cục phải thích ứng với màn hình nhỏ và lớn.                            |
| NFR-07 Khả năng bảo trì         | Backend chia theo module; API được mô tả bằng OpenAPI; DB thay đổi qua migration; kiểm thử chạy được bằng các script của repository.                                                                 |
| NFR-08 Khả năng quan sát         | Lỗi ứng dụng và gửi webhook phải được ghi log; admin có thể xem trạng thái delivery. Chưa có hệ thống metrics/alert production được đặc tả.                                                    |
| NFR-09 Độ chính xác không gian | Tọa độ lưu theo WGS84; khoảng cách phân công/geofence dùng tính toán địa lý, không dựa vào phép so sánh chuỗi hoặc tọa độ do frontend tự xác nhận.                                         |
| NFR-10 Bảo vệ lạm dụng          | Endpoint nhạy cảm có rate limit; URL webhook được giới hạn bởi allowlist origin và chính sách HTTPS/HTTP cấu hình.                                                                                      |

## 8. Kiểm thử và điều kiện nghiệm thu

### 8.1 Các luồng nghiệm thu tối thiểu

1. **Đăng ký và xác minh:** đăng ký email chưa dùng → nhận OTP → xác minh đúng → đăng nhập thành công; OTP sai/hết hạn/vượt số lần và email trùng phải bị từ chối.
2. **Tạo đơn:** SENDER nhập địa chỉ/tọa độ/kiện hợp lệ → nhận báo giá từ OSRM → tạo đơn → nhận tracking code → thấy phí snapshot và lịch sử RECEIVED.
3. **Phân quyền đơn:** SENDER A không xem/list/đổi trạng thái đơn của SENDER B; tài xế không được gán không truy cập chi tiết.
4. **Điều phối:** hệ thống chọn tài xế đủ điều kiện gần nhất; tài xế nhận đơn thì thành BUSY và shipment sang EN_ROUTE_PICKUP; từ chối/hết hạn sẽ thử phân công lại hoặc hiển thị hàng chờ.
5. **Giao hàng:** GPS thiếu/cũ/sai accuracy hoặc ngoài 100m không thể xác nhận đến; GPS hợp lệ trong geofence cho phép tiến trình lấy và giao; DELIVERED giải phóng assignment/tài xế.
6. **Thất bại/hủy:** DELIVERY_FAILED/CANCELLED không có lý do phải bị từ chối; lý do hợp lệ được lưu vào trạng thái/lịch sử.
7. **Tracking:** tracking code tồn tại trả đúng trường công khai và lịch sử; mã sai format trả lỗi dữ liệu; không có tọa độ tài xế/ID người gửi trong response.
8. **Webhook:** trạng thái mới tạo event; payload ký đúng HMAC; response thành công ghi DELIVERED; lỗi được retry theo lịch và cuối cùng đánh dấu FAILED sau giới hạn.
9. **Quản trị:** ADMIN tạo tài khoản được phép, khóa/mở tài khoản, tạo version giá mới; user thường không truy cập được endpoint quản trị.
10. **Frontend:** kiểm tra luồng form/hiển thị lỗi, tìm địa chỉ, map pins, cập nhật trạng thái tài xế, theo dõi live khi trang hiển thị và hủy polling đúng lúc.

### 8.2 Lệnh kiểm tra trong repository

- `npm test` — bộ kiểm thử backend mặc định.
- `npm run test:integration` — kiểm thử tích hợp với database test đã cấu hình.
- `npm run test:web` — kiểm thử JavaScript frontend/map.
- `npm run lint`, `npm run typecheck`, `npm run build` — chất lượng mã, kiểu và build backend.
- `npm run db:check-history` — kiểm tra chuỗi migration.

Các test hiện có được tổ chức theo module như auth/RBAC, shipment/state machine, dispatch, pricing/routing, geocoding, webhooks, workflow integration và frontend map/driver/sender. Báo cáo `docs/m4/TEST_REPORT.md` là báo cáo của một snapshot cũ và ghi nhận frontend chưa có; vì vậy khi nghiệm thu cần chạy lệnh trên phiên bản hiện tại thay vì dùng nguyên kết quả snapshot đó.

### 8.3 Điều kiện hoàn thành

- Yêu cầu chức năng trong phạm vi thay đổi có test tương ứng hoặc được xác nhận bằng kịch bản nghiệm thu.
- Không có lỗi lint/typecheck/build mới do thay đổi gây ra.
- Test liên quan qua; integration test chạy trên database test riêng, không dùng database production.
- Migration mới được kiểm tra trên database rỗng và database nâng cấp theo quy trình dự án.
- Không lộ secret, dữ liệu cá nhân hoặc GPS ngoài phạm vi quyền.
- Tài liệu API/hướng dẫn sử dụng được cập nhật khi hợp đồng hoặc hành vi người dùng thay đổi.

## 9. Phân công và ranh giới bàn giao M1–M4

| Thành viên               | Phạm vi sở hữu                                                                                                                                                     | Đầu vào/đầu ra bàn giao                                                                                                                                                                                      |
| -------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **M1 — Frontend**   | SPA, màn hình theo role, xác thực trên giao diện, form/validation, bản đồ, tìm kiếm địa chỉ, GPS client, luồng tài xế và hiển thị đơn/tracking. | Nhận API/OpenAPI và DTO từ M2; dùng MapLibre/map controllers hiện có; bàn giao giao diện chạy được, xử lý lỗi và test frontend. Không tự quyết định giá, quyền hoặc trạng thái hợp lệ. |
| **M2 — Backend**    | REST API, nghiệp vụ auth, role/ownership guard, pricing, shipment lifecycle, dispatch, tracking, geocoding, navigation/live location, webhook và health.           | Nhận schema/migrations từ M3; bàn giao OpenAPI và semantics lỗi cho M1; phối hợp M4 để có test nghiệp vụ/integration.                                                                                  |
| **M3 — Database**   | PostgreSQL/PostGIS, Prisma schema, migrations, quan hệ/ràng buộc/index/trigger, seed và quy tắc bảo vệ snapshot/lịch sử.                                     | Bàn giao schema ổn định, migration có thể tái lập và hướng dẫn test DB cho M2/M4; mọi thay đổi schema phải có migration, không sửa migration đã chia sẻ.                                     |
| **M4 — Testing/QA** | Test plan, unit/API/contract/RBAC/state-machine/database integration/frontend tests, negative tests và báo cáo lỗi.                                               | Nhận yêu cầu từ SRS, API contract từ M2, schema từ M3, UI từ M1; báo cáo lỗi có bước tái hiện và bằng chứng; không thay đổi yêu cầu nghiệp vụ nếu chưa thống nhất.                    |

## 10. Các vấn đề có thể mở rộng.

1. Có đưa E2E browser test (Playwright) vào pipeline nghiệm thu chính thức hay không.
2. Có cần đảm bảo thứ tự webhook theo thời điểm phát sinh hay receiver phải tự sắp xếp/deduplicate theo event ID.
3. Chính sách retention dữ liệu GPS, lịch sử, OTP đã tiêu thụ, webhook event/delivery.
4. SLA/timeout mục tiêu cho API, OSRM, geocoding và email.
5. Hành vi retry/giao lại/hoàn hàng và quy trình xử lý DELIVERY_FAILED ngoài trạng thái hiện có.
6. Quy trình bật mô phỏng GPS/Demo Tools và đảm bảo không ảnh hưởng môi trường production.
7. Các vai trò cụ thể được phép sửa/hủy shipment ngoài luồng hiện tại.

## 11. Thuật ngữ

| Thuật ngữ             | Giải thích                                                                                                  |
| ----------------------- | ------------------------------------------------------------------------------------------------------------- |
| Shipment                | Đơn giao nhận được tạo cho một kiện hàng.                                                           |
| Tracking code           | Mã vận đơn dùng tra cứu trạng thái công khai.                                                        |
| Assignment              | Bản ghi phân công một tài xế cho shipment, có trạng thái và thời hạn phản hồi.                  |
| Geofence                | Vùng bán kính 100m quanh điểm lấy/giao, có kiểm tra độ mới và độ chính xác GPS.               |
| Snapshot phí           | Giá và breakdown được chốt trong shipment tại thời điểm tạo, không đổi theo bảng giá về sau. |
| Outbox/Webhook delivery | Event trạng thái được lưu trước và gửi ra subscription theo cơ chế retry.                         |
| OTP                     | Mã dùng một lần 6 chữ số để xác minh email đăng ký/cấp tài khoản.                              |
