# Last-Mile Express Logistics & Parcel Tracking System

> **Project repository blueprint** — hệ thống quản lý giao hàng chặng cuối, phân công tài xế và theo dõi kiện hàng. Repository này định nghĩa cấu trúc dự án, quy ước phát triển, tài liệu kỹ thuật và các điểm cần hoàn thiện; các thư mục/file được đánh dấu `TODO`, `Proposed` hoặc `placeholder` chưa phải chức năng đã triển khai.

---

## Mục lục

- [1. Giới thiệu dự án](#1-giới-thiệu-dự-án)
- [2. Mục tiêu và phạm vi](#2-mục-tiêu-và-phạm-vi)
- [3. Công nghệ sử dụng](#3-công-nghệ-sử-dụng)
- [4. Kiến trúc tổng quan](#4-kiến-trúc-tổng-quan)
- [5. Cây thư mục toàn bộ repository](#5-cây-thư-mục-toàn-bộ-repository)
- [6. Giải thích các thư mục và file](#6-giải-thích-các-thư-mục-và-file)
- [7. Quy ước database: Prisma và SQL](#7-quy-ước-database-prisma-và-sql)
- [8. Authentication và bảo mật](#8-authentication-và-bảo-mật)
- [9. Chatbot Gemini](#9-chatbot-gemini)
- [10. Cài đặt môi trường phát triển](#10-cài-đặt-môi-trường-phát-triển)
- [11. Quy trình phát triển](#11-quy-trình-phát-triển)
- [12. Kiểm thử và tiêu chí hoàn thành](#12-kiểm-thử-và-tiêu-chí-hoàn-thành)
- [13. Quy ước Git và code review](#13-quy-ước-git-và-code-review)
- [14. Cấu hình môi trường và quản lý secret](#14-cấu-hình-môi-trường-và-quản-lý-secret)
- [15. Triển khai, backup và khôi phục](#15-triển-khai-backup-và-khôi-phục)
- [16. Các quyết định nhóm cần chốt](#16-các-quyết-định-nhóm-cần-chốt)
- [17. Lộ trình triển khai gợi ý](#17-lộ-trình-triển-khai-gợi-ý)
- [18. Tài liệu tham khảo](#18-tài-liệu-tham-khảo)

---

## 1. Giới thiệu dự án

Last-Mile Express Logistics & Parcel Tracking System là hệ thống hỗ trợ các nghiệp vụ giao hàng chặng cuối, từ lúc người gửi tạo đơn đến khi kiện hàng được giao và trạng thái được cập nhật. Hệ thống hướng đến việc quản lý tập trung đơn hàng, tính phí vận chuyển, phân công tài xế, tra cứu hành trình, lưu lịch sử trạng thái và tích hợp webhook.

Dự án cũng đề xuất một chatbot hỗ trợ người dùng dựa trên Gemini API. Chatbot được thiết kế như một module phụ trợ; các thông tin có tính nghiệp vụ như giá cước và trạng thái đơn hàng vẫn phải lấy từ backend/database, không được để AI tự suy đoán.

### Trạng thái của repository

Repository này là **blueprint/khung triển khai**. Không mặc định rằng tất cả chức năng, migration, endpoint, diagram hoặc test đã được viết xong. Hãy kiểm tra trạng thái từng hạng mục trong tài liệu requirements, traceability matrix và issue board của nhóm.

---

## 2. Mục tiêu và phạm vi

### 2.1. Phạm vi nghiệp vụ cốt lõi (MVP)

- Người gửi tạo đơn hàng với thông tin điểm lấy hàng, điểm giao hàng và thông tin kiện hàng.
- Hệ thống tính phí theo các quy tắc đã cấu hình và lưu lại mức phí tại thời điểm tạo đơn.
- Sinh mã tracking duy nhất, khó đoán và dùng để tra cứu trạng thái.
- Phân công tài xế phù hợp theo quy tắc dispatch.
- Tài xế nhận/từ chối đơn được phân công và cập nhật trạng thái theo state machine.
- Người dùng tra cứu đơn hàng công khai qua tracking code nhưng chỉ xem được dữ liệu được phép công khai.
- Ghi lịch sử thay đổi trạng thái và các sự kiện kiểm toán cần thiết.
- Phát sinh và gửi webhook event đến hệ thống bên ngoài, có cơ chế retry.
- Quản trị viên quản lý người dùng, tài xế và quy tắc giá cước.
- Bảo vệ API bằng authentication, role-based authorization và kiểm tra quyền sở hữu dữ liệu.

### 2.2. Hạng mục mở rộng đề xuất

- Xác minh email khi đăng ký.
- Quên mật khẩu và đặt lại mật khẩu.
- Quản lý phiên đăng nhập, xoay vòng và thu hồi refresh token.
- Chatbot Gemini trả lời câu hỏi thường gặp.
- Tùy chọn lưu lịch sử chat nếu có yêu cầu rõ ràng về quyền riêng tư, thời hạn lưu và xóa dữ liệu.

Những hạng mục mở rộng cần được nhóm xác nhận và cập nhật vào SRS, Use Case, API contract và test plan trước khi triển khai.

---

## 3. Công nghệ sử dụng

| Thành phần | Công nghệ đề xuất | Vai trò |
|---|---|---|
| Frontend | Next.js, TypeScript | Giao diện người gửi, tài xế, điều phối, quản trị và chatbot |
| Backend | Node.js, NestJS, TypeScript | API, nghiệp vụ, xác thực, phân quyền và tích hợp bên ngoài |
| Database | PostgreSQL 15+ | Lưu dữ liệu nghiệp vụ quan hệ |
| Dữ liệu địa lý | PostGIS | Truy vấn tọa độ, khoảng cách và hỗ trợ phân công theo vị trí |
| ORM/schema | Prisma | Khai báo model, quan hệ và quản lý migration |
| API contract | REST, OpenAPI 3.1 | Chuẩn hóa hợp đồng giữa frontend và backend |
| Authentication | JWT access token + refresh session | Xác thực và quản lý phiên đăng nhập |
| Password hashing | bcrypt hoặc Argon2id | Lưu mật khẩu an toàn dưới dạng hash |
| Chatbot | Gemini API qua backend | Trả lời câu hỏi theo chính sách hệ thống |
| Testing | Jest, Supertest, Playwright | Unit, integration và end-to-end test |
| Load testing | autocannon hoặc công cụ tương đương | Đo tải và độ ổn định |
| Local environment | Docker Compose | Khởi tạo dịch vụ phục vụ phát triển |
| CI | GitHub Actions | Tự động chạy lint, typecheck, test và build |

> Phiên bản thư viện, model Gemini, quota miễn phí và điều khoản sử dụng cần được kiểm tra lại tại thời điểm triển khai. Không xem các phiên bản hoặc giới hạn chưa được xác minh là cố định.

---

## 4. Kiến trúc tổng quan

Dự án được đề xuất theo kiến trúc **Modular Monolith**: một backend triển khai thống nhất nhưng chia module theo nghiệp vụ. Cách này giúp nhóm dễ phát triển, kiểm thử và demo hơn so với việc chia thành nhiều microservice quá sớm.

### 4.1. Luồng tổng quát

1. Người dùng thao tác trên frontend Next.js.
2. Frontend gửi HTTP request đến REST API của NestJS.
3. Backend validate dữ liệu, xác thực người dùng và kiểm tra quyền.
4. Service nghiệp vụ xử lý quy tắc và truy cập PostgreSQL qua Prisma.
5. Với truy vấn không gian đặc thù, backend có thể dùng SQL có bind tham số để tận dụng PostGIS.
6. Khi có sự kiện cần gửi ra ngoài, hệ thống tạo webhook event và xử lý retry.
7. Khi người dùng dùng chatbot, backend áp dụng quota/policy rồi mới gọi Gemini API.

### 4.2. Ranh giới module backend

- `AuthModule`: đăng ký, đăng nhập, xác minh email, refresh, logout và reset password.
- `UsersModule`: hồ sơ người dùng, trạng thái tài khoản và quản lý vai trò.
- `ShipmentsModule`: tạo đơn, truy vấn đơn và chuyển trạng thái hợp lệ.
- `TrackingModule`: API tra cứu công khai với DTO chỉ chứa trường được phép.
- `PricingModule`: tính phí và quản lý phiên bản quy tắc giá.
- `DispatchModule`: phân công, nhận/từ chối và phân công lại.
- `DriversModule`: hồ sơ, trạng thái sẵn sàng và vị trí tài xế.
- `AuditModule`: ghi lại hành động quan trọng.
- `WebhooksModule`: tạo, ký, gửi và retry webhook.
- `AiChatModule`: kiểm soát đầu vào/đầu ra và gọi Gemini.
- `HealthModule`: health/readiness endpoint.

### 4.3. Nguyên tắc kiến trúc

- Controller chỉ tiếp nhận request, validate DTO và gọi service.
- Quy tắc nghiệp vụ và kiểm tra quyền phải nằm ở backend, không dựa vào việc ẩn nút trên giao diện.
- Không trả trực tiếp database entity cho API công khai; dùng DTO riêng.
- Thay đổi trạng thái, lịch sử trạng thái và event cần nhất quán giao dịch.
- Không để Gemini tự thực thi câu lệnh database hoặc tự quyết định trạng thái đơn hàng.
- Không để API key của Gemini xuất hiện trong bundle frontend.

---

## 5. Cây thư mục toàn bộ repository

Cây dưới đây mô tả **cấu trúc mục tiêu đầy đủ**. Các file đánh dấu `TODO` hoặc chưa được tạo cần được bổ sung trong quá trình phát triển. Không phải tất cả file trong cây đều đã có nội dung triển khai trong blueprint ban đầu.

```text
last-mile-logistics/
│
├── apps/
│   ├── web/                              # Frontend Next.js
│   │   ├── public/                       # Ảnh, icon, asset tĩnh
│   │   └── src/
│   │       ├── app/
│   │       │   ├── (auth)/
│   │       │   │   ├── login/            # Đăng nhập
│   │       │   │   ├── register/         # Đăng ký
│   │       │   │   ├── verify-email/     # Xác minh email
│   │       │   │   └── forgot-password/  # Quên/đặt lại mật khẩu
│   │       │   ├── (dashboard)/
│   │       │   │   ├── shipments/        # Quản lý đơn của người gửi
│   │       │   │   ├── driver/           # Giao diện tài xế
│   │       │   │   ├── dispatcher/       # Giao diện điều phối
│   │       │   │   └── admin/            # Giao diện quản trị
│   │       │   ├── tracking/[trackingCode]/ # Trang tra cứu công khai
│   │       │   ├── chat/                 # Trang/chatbot
│   │       │   ├── layout.tsx
│   │       │   └── page.tsx
│   │       ├── components/
│   │       │   ├── ui/                   # Component giao diện dùng chung
│   │       │   ├── auth/                 # Form đăng nhập/đăng ký
│   │       │   ├── shipment/             # Component đơn hàng
│   │       │   ├── tracking/             # Component tracking
│   │       │   └── chat/                 # Chat window, message, input
│   │       ├── hooks/                    # Custom React hooks
│   │       ├── lib/
│   │       │   ├── api-client.ts         # HTTP client
│   │       │   ├── auth.ts               # Helper phía frontend
│   │       │   └── validation.ts         # Schema validate giao diện
│   │       ├── services/                 # Hàm gọi API theo module
│   │       ├── types/                    # TypeScript types
│   │       └── middleware.ts             # Điều hướng/bảo vệ route phù hợp
│   │
│   └── api/                              # Backend NestJS
│       └── src/
│           ├── main.ts                   # Bootstrap ứng dụng
│           ├── app.module.ts             # Module gốc
│           ├── common/
│           │   ├── decorators/           # Decorator role/current user
│           │   ├── guards/               # AuthGuard, RolesGuard
│           │   ├── interceptors/         # Logging/response interceptors
│           │   ├── filters/              # Exception filters
│           │   ├── pipes/                # Validation pipes
│           │   └── dto/                  # DTO dùng chung
│           ├── config/
│           │   ├── env.validation.ts     # Validate biến môi trường
│           │   └── configuration.ts      # Cấu hình ứng dụng
│           ├── database/
│           │   ├── prisma.module.ts
│           │   └── prisma.service.ts     # Kết nối Prisma
│           └── modules/
│               ├── auth/                 # Đăng ký/đăng nhập/session
│               │   ├── auth.module.ts
│               │   ├── auth.controller.ts
│               │   ├── auth.service.ts
│               │   ├── strategies/
│               │   ├── dto/
│               │   └── tests/
│               ├── users/                # Quản lý người dùng
│               ├── drivers/              # Hồ sơ/vị trí tài xế
│               ├── shipments/            # Nghiệp vụ đơn hàng
│               ├── tracking/             # Tra cứu đơn
│               ├── pricing/              # Tính và quản lý giá
│               ├── dispatch/             # Phân công tài xế
│               ├── audit/                # Nhật ký kiểm toán
│               ├── webhooks/             # Webhook và retry
│               ├── notifications/        # Email/thông báo
│               ├── ai-chat/              # Gemini integration
│               │   ├── ai-chat.module.ts
│               │   ├── ai-chat.controller.ts
│               │   ├── ai-chat.service.ts
│               │   ├── gemini.adapter.ts
│               │   ├── prompts/
│               │   ├── dto/
│               │   └── tests/
│               └── health/               # Health/readiness
│
├── prisma/
│   ├── schema.prisma                     # Schema chuẩn của database
│   ├── seed.ts                           # Seed dữ liệu demo
│   └── migrations/
│       ├── migration_lock.toml
│       └── <timestamp>_<migration>/
│           └── migration.sql             # Lịch sử thay đổi database
│
├── database/
│   ├── sql/
│   │   ├── extensions/                   # Extension PostgreSQL/PostGIS
│   │   ├── spatial/                      # Spatial query/index/function
│   │   ├── seed/                         # Seed SQL nếu thực sự cần
│   │   ├── reports/                      # Query báo cáo
│   │   └── generated/
│   │       └── schema.sql                # SQL tổng hợp sinh tự động
│   └── README.md
│
├── docs/
│   ├── requirements/
│   │   ├── SRS.md                        # Đặc tả yêu cầu tổng thể
│   │   ├── functional-requirements.md
│   │   ├── non-functional-requirements.md
│   │   ├── business-rules.md
│   │   ├── user-stories.md
│   │   ├── use-cases.md
│   │   ├── acceptance-criteria.md
│   │   └── traceability-matrix.csv       # FR -> UC -> API -> Test
│   ├── architecture/
│   │   ├── architecture.md
│   │   ├── ADR/                          # Architecture Decision Records
│   │   │   ├── 0001-stack.md
│   │   │   ├── 0002-prisma-sql-source-of-truth.md
│   │   │   └── 0003-gemini-chatbot.md
│   │   └── diagrams/
│   │       ├── system-context.mmd
│   │       ├── use-case.mmd
│   │       ├── erd.mmd
│   │       ├── shipment-state-machine.mmd
│   │       ├── sequence-login.mmd
│   │       ├── sequence-create-shipment.mmd
│   │       ├── sequence-gemini-chat.mmd
│   │       └── deployment.mmd
│   ├── api/
│   │   └── openapi.yaml                   # API contract
│   ├── database/
│   │   ├── data-dictionary.md
│   │   └── prisma-policy.md
│   ├── security/
│   │   ├── threat-model.md
│   │   ├── auth-flows.md
│   │   ├── secrets-and-privacy.md
│   │   └── security-checklist.md
│   ├── testing/
│   │   ├── test-plan.md
│   │   ├── test-cases/
│   │   └── test-report.md
│   ├── deployment/
│   │   ├── setup-guide.md
│   │   ├── runbook.md
│   │   └── backup-restore.md
│   ├── operations/
│   │   └── incident-response.md
│   └── decisions/
│       └── open-items.md
│
├── tests/
│   ├── integration/                      # Kiểm thử tích hợp
│   ├── e2e/                              # Kiểm thử xuyên hệ thống
│   ├── security/                         # Kiểm thử bảo mật
│   └── performance/                      # Kiểm thử hiệu năng
│
├── scripts/
│   ├── db-reset.sh                       # Reset DB dev; cảnh báo dữ liệu bị xóa
│   ├── db-backup.sh                      # Backup database
│   └── db-restore.sh                     # Khôi phục backup
│
├── .github/
│   ├── workflows/
│   │   ├── ci.yml                        # Lint/typecheck/test/build
│   │   └── security-scan.yml             # Quét dependency/secret
│   ├── ISSUE_TEMPLATE/
│   └── PULL_REQUEST_TEMPLATE.md
│
├── docker/
│   ├── api.Dockerfile
│   └── web.Dockerfile
├── docker-compose.yml                    # Môi trường local
├── .env.example                          # Chỉ chứa placeholder
├── .gitignore
├── package.json
├── package-lock.json
├── README.md                             # Tài liệu tổng quan này
└── LICENSE
```

---

## 6. Giải thích các thư mục và file

### 6.1. `apps/web/` — Frontend

Chứa toàn bộ giao diện Next.js. Route được chia theo nhóm người dùng và chức năng:

- `(auth)/`: đăng nhập, đăng ký, xác minh email và quên mật khẩu.
- `(dashboard)/shipments/`: người gửi xem/tạo/quản lý đơn thuộc quyền của mình.
- `(dashboard)/driver/`: tài xế xem công việc được phân công và cập nhật trạng thái hợp lệ.
- `(dashboard)/dispatcher/`: điều phối và theo dõi phân công.
- `(dashboard)/admin/`: quản trị người dùng, tài xế và giá cước.
- `tracking/[trackingCode]/`: trang tra cứu công khai.
- `chat/`: giao diện chatbot.

Frontend chỉ hỗ trợ trải nghiệm người dùng; mọi quyền truy cập dữ liệu phải được kiểm tra lại ở backend. Không đặt API key Gemini trong frontend.

### 6.2. `apps/api/` — Backend

Chứa REST API và nghiệp vụ hệ thống. Mỗi module nên có ranh giới rõ ràng; tùy quy mô, module có thể bổ sung `dto/`, `entities/` (nếu dùng), `repositories/`, `policies/` và `tests/`.

- `common/`: thành phần kỹ thuật dùng chung.
- `config/`: đọc và xác thực cấu hình.
- `database/`: Prisma service.
- `modules/auth/`: xác thực và quản lý phiên.
- `modules/shipments/`: tạo đơn và chuyển trạng thái.
- `modules/tracking/`: trả dữ liệu công khai tối thiểu.
- `modules/pricing/`: tính phí từ quy tắc đã cấu hình.
- `modules/dispatch/`: phân công tài xế.
- `modules/webhooks/`: ký payload, retry và xử lý lỗi gửi.
- `modules/ai-chat/`: adapter gọi Gemini, giới hạn đầu vào và xử lý fallback.

### 6.3. `prisma/` — Schema và migration

- `schema.prisma`: mô hình dữ liệu ứng dụng chuẩn.
- `migrations/`: lịch sử thay đổi theo phiên bản.
- `seed.ts`: dữ liệu giả phục vụ demo/test; không chứa dữ liệu thật.
- `migration_lock.toml`: thông tin provider migration do Prisma quản lý.

Mọi thay đổi schema cần được review, tạo migration và kiểm thử trên database mới. Không sửa tùy tiện migration đã áp dụng ở môi trường dùng chung; hãy tạo migration mới.

### 6.4. `database/sql/` — SQL bổ sung

Chỉ dùng cho phần SQL có chủ đích:

- `extensions/`: extension như PostGIS khi cần.
- `spatial/`: spatial index, function hoặc truy vấn địa lý.
- `seed/`: dữ liệu demo bằng SQL nếu cần.
- `reports/`: query phục vụ báo cáo.
- `generated/schema.sql`: bản SQL tổng hợp sinh từ lịch sử migration để nộp/kiểm tra.

Không chỉnh tay file SQL tổng hợp rồi coi nó là nguồn chuẩn thứ hai. Quy tắc chi tiết nằm ở `docs/database/prisma-policy.md`.

### 6.5. `docs/requirements/` — Tài liệu yêu cầu

- `SRS.md`: phạm vi, actor, yêu cầu chức năng/phi chức năng, giả định và tiêu chí nghiệm thu.
- `functional-requirements.md`: danh sách FR có mã định danh ổn định.
- `non-functional-requirements.md`: hiệu năng, bảo mật, khả dụng, khả năng bảo trì.
- `business-rules.md`: quy tắc giá, trạng thái đơn, phân công và điều kiện nghiệp vụ.
- `user-stories.md`: nhu cầu theo góc nhìn từng vai trò.
- `use-cases.md`: luồng chính, luồng thay thế và ngoại lệ.
- `acceptance-criteria.md`: điều kiện để chấp nhận từng tính năng.
- `traceability-matrix.csv`: liên kết yêu cầu với Use Case, API và test.

Khi thêm chatbot hoặc luồng bảo mật, cập nhật các tài liệu này đồng bộ; không chỉ thêm một module code.

### 6.6. `docs/architecture/` — Thiết kế kiến trúc

- `architecture.md`: mô tả module, ranh giới, luồng dữ liệu và nguyên tắc.
- `ADR/`: lưu quyết định quan trọng, lý do và hệ quả.
- `diagrams/`: lưu source diagram để dễ chỉnh sửa và xuất ảnh.

Các sơ đồ khuyến nghị gồm system context, use case, ERD, state machine đơn hàng, sequence đăng nhập, tạo đơn, chat Gemini và deployment.

### 6.7. `docs/api/openapi.yaml` — Hợp đồng API

Mô tả endpoint, request/response schema, status code, lỗi, cơ chế authentication và quyền truy cập. Cần cập nhật cùng lúc với code; không để tài liệu API khác hành vi thực tế.

### 6.8. `docs/database/` — Quy tắc dữ liệu

- `data-dictionary.md`: định nghĩa trường dữ liệu, ý nghĩa, kiểu, constraint, mức độ nhạy cảm và thời hạn lưu.
- `prisma-policy.md`: quy tắc schema, migration, SQL bổ sung và kiểm thử tính nhất quán.

### 6.9. `docs/security/` — Bảo mật

- `threat-model.md`: tài sản, mối đe dọa, tác động và biện pháp giảm thiểu.
- `auth-flows.md`: đăng ký, xác minh, đăng nhập, refresh, logout và reset password.
- `secrets-and-privacy.md`: quản lý secret, log và dữ liệu cá nhân.
- `security-checklist.md`: checklist kiểm tra trước demo/release.

### 6.10. `docs/testing/` và `tests/`

`docs/testing/` lưu chiến lược, test case và báo cáo. `tests/` lưu code test tự động.

- Unit test: kiểm tra logic nhỏ như tính phí và state machine.
- Integration test: kiểm tra database, transaction, webhook và auth session.
- E2E test: kiểm tra luồng hoàn chỉnh từ API/UI.
- Security test: kiểm tra IDOR, brute force, token hết hạn, injection và rò rỉ dữ liệu.
- Performance test: đo tải và latency theo tiêu chí nhóm thống nhất.

### 6.11. `docs/deployment/`, `docs/operations/` và `scripts/`

- `setup-guide.md`: cài đặt cho thành viên mới.
- `runbook.md`: vận hành, kiểm tra sức khỏe và xử lý lỗi thường gặp.
- `backup-restore.md`: quy trình sao lưu/khôi phục.
- `incident-response.md`: xử lý lộ secret, tài khoản bị chiếm quyền, lạm dụng API hoặc sự cố dữ liệu.
- `scripts/`: script hỗ trợ phát triển/vận hành; phải có cảnh báo rõ trước thao tác phá hủy dữ liệu.

### 6.12. `.github/`, Docker và file gốc

- `.github/workflows/ci.yml`: tự động lint, typecheck, test và build.
- `.github/workflows/security-scan.yml`: quét dependency/secret nếu đã cấu hình công cụ phù hợp.
- `docker/`: Dockerfile frontend/backend.
- `docker-compose.yml`: dịch vụ local, tối thiểu PostgreSQL/PostGIS.
- `.env.example`: danh sách biến cần thiết với giá trị placeholder.
- `.gitignore`: loại trừ secret, dependency, build output và file sinh tự động.
- `package.json` / lockfile: scripts và dependency của workspace.
- `LICENSE`: giấy phép, cần chọn theo yêu cầu môn học/nhóm.

---

## 7. Quy ước database: Prisma và SQL

### 7.1. Nguồn chuẩn

1. `prisma/schema.prisma` là nơi khai báo model, quan hệ và constraint mà Prisma hỗ trợ.
2. `prisma/migrations/` là lịch sử migration chính thức.
3. SQL bổ sung chỉ dành cho phần cần thiết như PostGIS, spatial index/function hoặc truy vấn báo cáo.
4. Nếu cần một file SQL tổng hợp để nộp, hãy sinh nó từ migration đã review và ghi rõ đây là file generated.
5. Không duy trì hai file schema tổng hợp được chỉnh sửa thủ công độc lập.

### 7.2. Quy trình thay đổi database

1. Chỉnh `schema.prisma`.
2. Sinh migration bằng Prisma CLI trong môi trường phát triển.
3. Review nội dung SQL được sinh ra.
4. Thêm SQL bổ sung có bind tham số nếu cần.
5. Áp dụng migration trên database dev/test.
6. Chạy test và xác minh trên database sạch.
7. Commit schema cùng migration và cập nhật data dictionary/ERD nếu cấu trúc thay đổi.

### 7.3. An toàn dữ liệu

- Dùng ràng buộc unique, foreign key, index và transaction khi phù hợp.
- Mã tracking phải duy nhất và khó đoán.
- Không trả trực tiếp toàn bộ entity cho public tracking.
- Không nối chuỗi SQL từ dữ liệu người dùng.
- Seed chỉ sử dụng dữ liệu giả.
- Không chạy script reset trên database production.

---

## 8. Authentication và bảo mật

### 8.1. Đăng ký

1. Validate dữ liệu đầu vào tại backend.
2. Chuẩn hóa email và kiểm tra unique constraint.
3. Hash mật khẩu bằng thư viện được duy trì; bcrypt là lựa chọn phù hợp nếu đã thống nhất trong dự án, Argon2id có thể được cân nhắc.
4. Nếu bật xác minh email, tạo token ngẫu nhiên dùng một lần, lưu hash và thời hạn.
5. Gửi email xác minh; không ghi token vào log.
6. Chỉ kích hoạt tài khoản theo chính sách xác minh đã thống nhất.

### 8.2. Đăng nhập

- Rate limit theo IP và tài khoản.
- Dùng thông báo lỗi chung để tránh tiết lộ email có tồn tại hay không.
- So sánh password với hash đã lưu bằng thư viện phù hợp.
- Kiểm tra trạng thái tài khoản và role.
- Cấp access token có thời hạn ngắn.
- Refresh token phải có thời hạn, có khả năng xoay vòng và thu hồi.
- Nếu dùng cookie để lưu refresh token, cấu hình `HttpOnly`, `Secure`, `SameSite` và biện pháp CSRF phù hợp.

### 8.3. Quên mật khẩu và quản lý phiên

- Token reset ngẫu nhiên, hết hạn, dùng một lần; chỉ lưu hash.
- Thông báo yêu cầu reset không được tiết lộ email có tồn tại.
- Giới hạn số lần yêu cầu reset.
- Sau khi đổi mật khẩu, cân nhắc thu hồi tất cả refresh session.
- Logout phải thu hồi phiên phía server; xóa token phía client là chưa đủ.

### 8.4. Phân quyền

- Backend kiểm tra authentication, role và quyền sở hữu bản ghi.
- Không tin `role`, `userId` hoặc thông tin sở hữu do frontend tự gửi.
- Người gửi không được xem đơn của người gửi khác.
- Tài xế chỉ cập nhật đơn được phân công và chỉ chuyển sang trạng thái hợp lệ.
- Không cho phép người dùng tự đăng ký thành admin.
- Public tracking chỉ trả các trường được phép công khai.

### 8.5. Bảo vệ secret

Không commit `.env`, database password, JWT secret, webhook signing secret hoặc `GEMINI_API_KEY`. Nếu secret bị lộ, cần thu hồi/xoay vòng ngay và kiểm tra log sử dụng.

---

## 9. Chatbot Gemini

### 9.1. Phạm vi MVP đề xuất

Chatbot ưu tiên trả lời FAQ và hướng dẫn sử dụng hệ thống. Không tự tính giá chính thức, không tự xác nhận trạng thái giao hàng và không được tự thực thi thao tác nghiệp vụ.

### 9.2. Luồng request

1. Frontend gửi câu hỏi đến `POST /api/v1/ai/chat`.
2. Backend validate DTO và áp dụng authentication/rate limit.
3. Backend lọc hoặc loại bỏ dữ liệu nhạy cảm không cần thiết.
4. Gemini adapter gọi model đã cấu hình.
5. Backend xử lý timeout, quota, lỗi provider và giới hạn nội dung phản hồi.
6. Frontend hiển thị câu trả lời cùng thông báo AI có thể sai.

### 9.3. Bảo mật chatbot

- API key chỉ tồn tại ở backend.
- Giới hạn độ dài input, output token, số request, concurrency và thời gian chờ.
- Không gửi mật khẩu, token, thông tin thanh toán hoặc địa chỉ đầy đủ lên AI nếu không cần thiết.
- Không để model tự thực thi SQL hay tự quyết định quyền truy cập.
- Nếu cần tra cứu đơn cá nhân, backend phải xác thực và kiểm tra quyền trước khi lấy dữ liệu.
- Mặc định không lưu lịch sử chat trong MVP.
- Xác minh model, quota miễn phí, điều khoản dữ liệu và khả năng sử dụng tại thời điểm triển khai.
- Khi Gemini lỗi hoặc hết quota, các chức năng giao hàng cốt lõi vẫn phải hoạt động.

---

## 10. Cài đặt môi trường phát triển

> Các lệnh dưới đây là quy trình tham khảo. Cần điều chỉnh theo package manager, scripts và cấu trúc workspace thực tế của repository.

### 10.1. Yêu cầu

- Node.js phiên bản LTS tương thích với các dependency đã chọn.
- npm hoặc package manager đã được nhóm thống nhất.
- Docker và Docker Compose.
- Git.
- Tài khoản Google AI Studio/API key nếu phát triển chatbot.

### 10.2. Chuẩn bị biến môi trường

```bash
cp .env.example .env
```

Điền các giá trị local cần thiết. Không chia sẻ `.env` qua Git hoặc kênh chat công khai.

### 10.3. Khởi động database local

```bash
docker compose up -d db
```

Chờ database healthy trước khi chạy migration. Cấu hình mặc định trong Docker Compose chỉ dành cho local development; không dùng mật khẩu demo trong production.

### 10.4. Cài dependency và khởi tạo Prisma

Sau khi cấu hình scripts trong workspace:

```bash
npm install
npx prisma generate
npx prisma migrate dev
```

Nếu repository dùng npm workspaces hoặc Prisma được cài ở một workspace cụ thể, chạy lệnh tại đúng thư mục và theo scripts thực tế. Chỉ chạy seed sau khi đã kiểm tra dữ liệu demo.

### 10.5. Chạy ứng dụng

Lệnh chạy frontend/backend phụ thuộc vào scripts trong `package.json`. Nhóm cần bổ sung hướng dẫn chính xác sau khi khởi tạo workspace, ví dụ scripts `dev`, `dev:web`, `dev:api`, `test` và `build`.

### 10.6. Kiểm tra sau khi khởi động

- Database đã sẵn sàng và migration chạy thành công.
- Health endpoint trả kết quả hợp lệ.
- Đăng ký/đăng nhập hoạt động.
- API kiểm tra role và ownership đúng.
- Tạo đơn, tính phí và tra cứu tracking hoạt động.
- Webhook xử lý lỗi/retry đúng.
- Chatbot có thể tắt khi chưa cấu hình API key và trả fallback an toàn.

---

## 11. Quy trình phát triển

### 11.1. Workflow đề xuất

1. Tạo issue mô tả yêu cầu và tiêu chí nghiệm thu.
2. Tạo branch theo tính năng hoặc bug.
3. Cập nhật SRS/API/diagram nếu yêu cầu thay đổi hành vi.
4. Viết code và test tương ứng.
5. Chạy lint, typecheck, test và build.
6. Tạo Pull Request, mô tả thay đổi và ảnh hưởng database/API.
7. Review ít nhất bởi một thành viên khác.
8. Merge sau khi CI thành công.
9. Kiểm tra migration và cập nhật tài liệu.

### 11.2. Quy tắc commit gợi ý

- `feat(auth): add password reset flow`
- `feat(ai-chat): add Gemini FAQ endpoint`
- `fix(tracking): hide private shipment fields`
- `test(dispatch): cover driver reassignment`
- `docs(database): clarify Prisma migration policy`
- `refactor(pricing): isolate fee calculation service`

Không commit secret, file build, `node_modules`, dữ liệu người dùng thật hoặc database dump chứa dữ liệu nhạy cảm.

---

## 12. Kiểm thử và tiêu chí hoàn thành

### 12.1. Unit test

Kiểm tra logic tính phí, chuyển trạng thái, tạo tracking code, chính sách phân quyền, token expiry/rotation và giới hạn chatbot.

### 12.2. Integration test

Kiểm tra Prisma/PostgreSQL, migration, transaction giữa đơn hàng/lịch sử/outbox, session authentication và truy vấn PostGIS.

### 12.3. End-to-end test

Các luồng quan trọng cần có test:

- Đăng ký, đăng nhập, refresh và logout.
- Người gửi không đọc được đơn của người khác.
- Tài xế không cập nhật đơn chưa được phân công.
- Public tracking không lộ email, số điện thoại hoặc địa chỉ riêng tư.
- Từ chối/hết hạn phân công dẫn đến xử lý đúng.
- Webhook lỗi được retry mà không làm mất giao dịch nghiệp vụ.
- Chatbot từ chối input quá dài, bị rate limit đúng và có fallback khi provider lỗi.

### 12.4. Security test

- Brute-force và credential stuffing.
- IDOR/broken access control.
- JWT không hợp lệ/hết hạn.
- Refresh token reuse.
- Reset token replay.
- SQL injection.
- CORS/cookie/CSRF theo cơ chế xác thực đã chọn.
- Rò rỉ secret trong repository và log.
- Prompt injection, lạm dụng quota và rò rỉ dữ liệu chatbot.

### 12.5. Tiêu chí hoàn thành một tính năng

Một tính năng chỉ nên được đánh dấu hoàn thành khi:

- Có yêu cầu và tiêu chí nghiệm thu rõ ràng.
- Có implementation trong code.
- Có kiểm tra phân quyền và xử lý lỗi.
- Có test phù hợp đã chạy.
- API/documentation được cập nhật.
- Không có secret hoặc dữ liệu nhạy cảm bị commit.
- Đã được review và tích hợp vào nhánh chính.

---

## 13. Quy ước Git và code review

- Dùng nhánh `main` cho phiên bản ổn định; có thể dùng `develop` nếu workflow nhóm cần.
- Mỗi tính năng nên có branch riêng.
- Không push thẳng thay đổi lớn vào nhánh chính.
- Migration phải được review cùng thay đổi model/service.
- PR cần nêu: mục tiêu, thay đổi, cách test, migration, thay đổi API và rủi ro bảo mật.
- Không merge nếu CI thất bại hoặc có lỗi nghiêm trọng chưa xử lý.
- Không commit `.env`, API key, token, dữ liệu cá nhân thật hay file backup database.
- Dùng issue board để theo dõi người phụ trách, tiến độ và tiêu chí hoàn thành.

---

## 14. Cấu hình môi trường và quản lý secret

Tạo `.env.example` với tên biến và placeholder, chẳng hạn:

```dotenv
DATABASE_URL="postgresql://app:change_me@localhost:5432/last_mile?schema=public"

JWT_ACCESS_SECRET="replace_with_long_random_secret"
JWT_ACCESS_TTL="15m"
REFRESH_TOKEN_TTL_DAYS="7"

FRONTEND_ORIGIN="http://localhost:3000"

GEMINI_API_KEY=""
GEMINI_MODEL="choose-a-currently-available-model"
AI_CHAT_ENABLED="false"
AI_CHAT_MAX_INPUT_CHARS="2000"
AI_CHAT_MAX_OUTPUT_TOKENS="500"
AI_CHAT_TIMEOUT_MS="15000"

WEBHOOK_SIGNING_SECRET="replace_with_long_random_secret"
```

Đây là danh sách minh họa, cần đồng bộ với config validation thực tế.

- `.env` phải nằm trong `.gitignore`.
- Không đưa secret vào biến frontend có tiền tố `NEXT_PUBLIC_`.
- Production nên dùng secret manager hoặc cơ chế quản lý secret của nền tảng triển khai.
- Không ghi token, password hoặc API key vào log.
- Có quy trình xoay vòng secret khi bị lộ.
- Dùng dữ liệu giả trong seed và test.

---

## 15. Triển khai, backup và khôi phục

### 15.1. Trước khi triển khai

- Chạy lint, typecheck, unit/integration/E2E test theo phạm vi release.
- Xác nhận migration chạy trên database mới.
- Kiểm tra CORS, TLS, secret và cấu hình production.
- Kiểm tra role/ownership và public tracking.
- Xác minh Gemini model, quota, điều khoản dữ liệu và fallback.
- Chuẩn bị phương án rollback ứng dụng và database.

### 15.2. Backup và restore

- Chọn lịch backup phù hợp với mức độ quan trọng của dữ liệu.
- Lưu backup ở vị trí tách biệt và giới hạn quyền truy cập.
- Không lưu backup có dữ liệu nhạy cảm vào Git.
- Định kỳ thử khôi phục trên môi trường riêng.
- Ghi lại thời điểm backup, kết quả restore và các bước xử lý lỗi.

### 15.3. Xử lý sự cố

Nếu phát hiện lộ API key, JWT secret hoặc webhook secret:

1. Thu hồi/xoay vòng secret.
2. Kiểm tra log truy cập và dấu hiệu lạm dụng.
3. Đánh giá dữ liệu hoặc tài khoản có thể bị ảnh hưởng.
4. Khắc phục nguyên nhân và bổ sung kiểm thử.
5. Ghi nhận sự cố và biện pháp phòng ngừa.

---

## 16. Các quyết định nhóm cần chốt

Các mục dưới đây cần được xác nhận và ghi nhận trong `docs/decisions/open-items.md`:

- Frontend và backend có dùng monorepo hay repository riêng.
- Package manager và phiên bản Node.js.
- Provider gửi email xác minh/reset password.
- Dùng bcrypt hay Argon2id cho password hashing.
- Refresh token được lưu bằng cookie hay cơ chế khác; nếu dùng cookie, chiến lược CSRF.
- Có bắt buộc xác minh email trước khi sử dụng hệ thống hay không.
- Chatbot chỉ FAQ hay được phép tra cứu đơn của người dùng đã đăng nhập.
- Có lưu lịch sử chat hay không; khuyến nghị MVP là không lưu.
- Model Gemini cụ thể, Free Tier quota, khu vực hỗ trợ và điều khoản xử lý dữ liệu.
- Quy tắc giới hạn chatbot và cách tắt nhanh khi bị lạm dụng.
- Chính sách retention/xóa dữ liệu và audit log.
- Cách sinh file SQL tổng hợp từ migration.

---

## 17. Lộ trình triển khai gợi ý

### Giai đoạn 1 — Nền tảng

- Khởi tạo monorepo và scripts.
- Cấu hình Docker Compose/PostgreSQL/PostGIS.
- Hoàn thiện Prisma schema và migration ban đầu.
- Thiết lập lint, typecheck và CI.

### Giai đoạn 2 — Authentication và phân quyền

- Đăng ký/đăng nhập, password hashing.
- JWT access token và refresh session.
- Guard, role và ownership policy.
- Bổ sung xác minh email/reset password theo phạm vi được duyệt.

### Giai đoạn 3 — Nghiệp vụ giao hàng

- Pricing và shipment.
- State machine và status history.
- Dispatch và driver workflow.
- Public tracking.
- Audit và webhook.

### Giai đoạn 4 — Frontend và chatbot

- Giao diện theo từng vai trò.
- Tích hợp REST API.
- Gemini FAQ endpoint qua backend.
- Rate limit, fallback, kiểm soát dữ liệu và kiểm thử.

### Giai đoạn 5 — Kiểm thử và bàn giao

- E2E/security/performance test.
- Hoàn thiện OpenAPI, SRS, ERD và traceability matrix.
- Kiểm tra backup/restore và hướng dẫn cài đặt.
- Chuẩn bị dữ liệu demo giả và kịch bản trình bày.

Lộ trình trên là gợi ý; nhóm nên phân công theo năng lực và tiến độ thực tế, đồng thời ưu tiên hoàn thiện luồng nghiệp vụ cốt lõi trước các tính năng mở rộng.

---

## 18. Tài liệu tham khảo

- [Next.js Documentation](https://nextjs.org/docs)
- [NestJS Documentation](https://docs.nestjs.com/)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [PostGIS Documentation](https://postgis.net/documentation/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [OpenAPI Specification](https://spec.openapis.org/oas/latest.html)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [Google Gemini API Quickstart](https://ai.google.dev/gemini-api/docs/quickstart)
- [Google Gemini API Pricing](https://ai.google.dev/gemini-api/docs/pricing)
- [Docker Compose Documentation](https://docs.docker.com/compose/)
- [GitHub Actions Documentation](https://docs.github.com/actions)

---

## Ghi chú cuối

README này mô tả cấu trúc mục tiêu và quy ước phát triển cho dự án. Hãy cập nhật nội dung khi nhóm chốt công nghệ hoặc thay đổi yêu cầu. Các file khung, sơ đồ và API mẫu không thay thế implementation thực tế; cần xác minh mọi lệnh và endpoint với code hiện hành trước khi sử dụng.
