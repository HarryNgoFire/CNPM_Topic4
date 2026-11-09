/* MoveFlow UI: small dependency-free SPA for the NestJS REST API. */
(() => {
  const API_BASE = window.MOVEFLOW_API_BASE || `${location.origin}/api/v1`;
  const root = document.getElementById("app");
  const state = { token: null, refreshToken: null, user: null, view: "dashboard", authMode: "login", pendingEmail: "", lastShipments: [], lastQueue: [], lastUsers: [], lastPricing: [], quote: null, detail: null, taskRefreshTimer: null, taskRefreshPending: false };
  const STATUS = {
    RECEIVED: ["Đã tiếp nhận", "blue"],
    EN_ROUTE_PICKUP: ["Đang lấy hàng", "blue"],
    ARRIVED_PICKUP: ["Đã đến điểm lấy", "warning"],
    IN_TRANSIT: ["Đang vận chuyển", "warning"],
    OUT_FOR_DELIVERY: ["Đang giao hàng", "warning"],
    ARRIVED_DROPOFF: ["Đã đến điểm giao", "warning"],
    DELIVERED: ["Đã giao", "success"],
    DELIVERY_FAILED: ["Giao thất bại", "danger"],
    CANCELLED: ["Đã hủy", "neutral"],
    PENDING: ["Chờ phản hồi", "blue"],
    ACCEPTED: ["Đã nhận đơn", "success"],
    REJECTED: ["Đã từ chối", "danger"],
    EXPIRED: ["Hết thời hạn", "neutral"],
    COMPLETED: ["Hoàn tất", "success"]
  };
  const TITLES = { dashboard: "Tổng quan", shipments: "Quản lý đơn hàng", new: "Tạo đơn giao hàng", tracking: "Tra cứu đơn hàng", tasks: "Công việc tài xế", users: "Quản lý tài khoản", pricing: "Bảng giá dịch vụ", profile: "Tài khoản của tôi", details: "Chi tiết đơn hàng" };
  const fmtMoney = n => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(n || 0));
  const fmtDate = value => value ? new Date(value).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" }) : "—";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const initials = name => String(name || "MF").trim().split(/\s+/).slice(-2).map(x => x[0] || "").join("").toUpperCase() || "MF";
  const roleName = role => ({ SENDER: "Khách hàng", DRIVER: "Tài xế", DISPATCHER: "Điều phối", ADMIN: "Quản trị viên" }[role] || role || "Tài khoản");
  const badge = value => { const item = STATUS[value] || [value || "Không rõ", "neutral"]; return `<span class="badge ${item[1]}">${esc(item[0])}</span>`; };
  const showToast = (message, type = "success") => { let host = document.querySelector(".toast-host"); if (!host) { host = document.createElement("div"); host.className = "toast-host"; document.body.appendChild(host); } const toast = document.createElement("div"); toast.className = `toast ${type}`; toast.textContent = message; host.appendChild(toast); setTimeout(() => toast.remove(), 4200); };
  const errorMessage = data => { const message = data?.message; if (Array.isArray(message)) return message.join("; "); if (typeof message === "string" && message) return message; const err = data?.error; if (typeof err === "string") return err; if (err?.message) return Array.isArray(err.message) ? err.message.join("; ") : err.message; return "Có lỗi xảy ra. Vui lòng thử lại."; };
  async function api(path, options = {}, allowRefresh = true) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (state.token && !path.startsWith("/auth/")) headers.Authorization = `Bearer ${state.token}`;
    let response;
    try { response = await fetch(`${API_BASE}${path}`, { ...options, headers, signal: AbortSignal.timeout(20000) }); }
    catch { throw new Error("Không kết nối được máy chủ. Hãy kiểm tra backend và thử lại."); }

    // Refresh tokens rotate on every use. Keep both tokens in memory only, then retry once.
    if (response.status === 401 && allowRefresh && state.refreshToken && !path.startsWith("/auth/")) {
      try {
        const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: state.refreshToken }), signal: AbortSignal.timeout(10000)
        });
        const refreshed = await refreshResponse.json().catch(() => null);
        if (refreshResponse.ok && refreshed?.accessToken && refreshed?.refreshToken) {
          state.token = refreshed.accessToken; state.refreshToken = refreshed.refreshToken;
          state.user = refreshed.user || state.user;
          return api(path, options, false);
        }
      } catch { /* session expiration is handled below */ }
      state.token = null; state.refreshToken = null; state.user = null;
      renderAuth("login", "Phiên đăng nhập đã hết hạn hoặc tài khoản không còn hoạt động. Vui lòng đăng nhập lại.");
      throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }

    const raw = await response.text();
    let data = null; try { data = raw ? JSON.parse(raw) : null; } catch { data = { message: raw }; }
    if (!response.ok) { const message = errorMessage(data); const error = new Error(message); error.status = response.status; error.data = data; throw error; }
    return data;
  }
  const post = (path, body) => api(path, { method: "POST", body: JSON.stringify(body) });
  const patch = (path, body) => api(path, { method: "PATCH", body: JSON.stringify(body) });
  const get = path => api(path, { method: "GET" });
  const nav = view => {
    stopLiveTracking();
    if (activeDriverTripController) {
      activeDriverTripController.destroy();
      activeDriverTripController = null;
    }
    if (activeSenderMapController) {
      activeSenderMapController.destroy();
      activeSenderMapController = null;
    }
    if (view !== "tasks" && state.taskRefreshTimer) {
      clearInterval(state.taskRefreshTimer);
      state.taskRefreshTimer = null;
    }
    state.view = view;
    state.detail = null;
    document.querySelectorAll(".nav-item").forEach(item => item.classList.toggle("active", item.dataset.view === view));
    renderView();
    document.querySelector(".sidebar")?.classList.remove("open");
  };

  function renderAuth(mode = "login", notice = "") {
    state.authMode = mode; root.innerHTML = `
      <div class="auth-layout">
        <aside class="auth-visual">
          <div class="brand"><div class="brand-mark">M</div><span>MOVEFLOW</span></div>
          <div class="visual-copy"><div class="eyebrow">Giao nhận thông minh · Theo dõi minh bạch</div><h1>Giao hàng dễ dàng. Theo dõi an tâm.</h1><p>Một không gian quản lý đơn giao nhận, điều phối tài xế và theo dõi hành trình — rõ ràng từ điểm lấy đến điểm giao.</p>
            <div class="route-illustration"><div class="route-label">HÀNH TRÌNH ĐƠN HÀNG</div><div class="route-line"><div class="route-dot"></div><div><div style="font-weight:700;font-size:13px">Điểm lấy hàng</div><div class="route-label">Xác nhận · Đóng gói</div></div></div><div class="route-stroke"></div><div class="route-line"><div class="route-dot end"></div><div><div style="font-weight:700;font-size:13px">Điểm giao hàng</div><div class="route-label">Theo dõi · Hoàn tất</div></div></div></div>
          </div><div class="visual-footer">© ${new Date().getFullYear()} MoveFlow · Nền tảng giao nhận chặng cuối</div>
        </aside>
        <section class="auth-panel"><div class="auth-card"><div class="mobile-brand"><div class="brand-mark">M</div><span>MOVEFLOW</span></div>
          <div class="auth-topline"><span>WORKSPACE / ${mode === "verify" ? "EMAIL VERIFICATION" : "ACCOUNT ACCESS"}</span><span>● Hệ thống bảo mật</span></div>
          ${notice ? `<div class="notice ${notice.startsWith("Lỗi:") ? "error" : "info"}">${esc(notice.replace(/^Lỗi:\s*/, ""))}</div>` : ""}
          ${mode === "login" ? authLogin() : mode === "register" ? authRegister() : authVerify()}
          <div class="divider-label">MOVEFLOW DELIVERY PLATFORM</div><div class="small-muted">Bằng việc tiếp tục, bạn đồng ý sử dụng hệ thống đúng mục đích. Tài khoản quản lý được cấp riêng, không thể tự đăng ký từ màn hình khách hàng.</div>
        </div></section>
      </div>`;
    root.querySelectorAll("[data-auth-mode]").forEach(button => button.addEventListener("click", () => renderAuth(button.dataset.authMode)));
    root.querySelector("#auth-form")?.addEventListener("submit", submitAuth);
    root.querySelector("#resend-code")?.addEventListener("click", resendCode);
    root.querySelector("#back-login")?.addEventListener("click", () => renderAuth("login"));
  }
  function authLogin() { return `<div class="seg-tabs"><button class="active" type="button" data-auth-mode="login">Đăng nhập</button><button type="button" data-auth-mode="register">Tạo tài khoản</button></div><h2>Chào mừng trở lại</h2><p class="subhead">Đăng nhập để quản lý đơn hàng và hành trình giao nhận của bạn.</p><form id="auth-form"><div class="field"><label for="email">Email cá nhân</label><input id="email" name="email" type="email" autocomplete="email" placeholder="ban@gmail.com" required></div><div class="field"><label for="password">Mật khẩu</label><input id="password" name="password" type="password" autocomplete="current-password" maxlength="72" required></div><button class="btn btn-primary btn-block" type="submit">Đăng nhập <span>→</span></button></form><div class="notice info">Tài khoản phải xác minh email bằng mã OTP trước khi được đăng nhập lần đầu.</div>`; }
  function authRegister() { return `<div class="seg-tabs"><button type="button" data-auth-mode="login">Đăng nhập</button><button class="active" type="button" data-auth-mode="register">Tạo tài khoản</button></div><h2>Tạo tài khoản mới</h2><p class="subhead">Dùng Gmail cá nhân hoặc email bạn có quyền truy cập. Mã xác minh sẽ được gửi đến địa chỉ này.</p><form id="auth-form"><div class="field"><label for="name">Họ và tên</label><input id="name" name="name" autocomplete="name" placeholder="Nguyễn Minh Anh" minlength="2" maxlength="100" required></div><div class="field"><label for="email">Email cá nhân</label><input id="email" name="email" type="email" autocomplete="email" placeholder="ban@gmail.com" required></div><div class="field"><label for="password">Tạo mật khẩu</label><input id="password" name="password" type="password" autocomplete="new-password" minlength="10" maxlength="72" placeholder="Ít nhất 10 ký tự" required><small>Dùng mật khẩu riêng, dài ít nhất 10 ký tự; không dùng lại mật khẩu email.</small></div><button class="btn btn-primary btn-block" type="submit">Tạo tài khoản & gửi mã <span>→</span></button></form><div class="notice info">Để bảo vệ hệ thống, đăng ký công khai chỉ tạo tài khoản khách hàng. Tài khoản tài xế và quản lý do quản trị viên cấp.</div>`; }
  function authVerify() { return `<h2>Xác minh email</h2><p class="subhead">Nhập mã 6 chữ số đã gửi đến <b>${esc(state.pendingEmail)}</b>. Mã hết hạn sau 10 phút.</p><form id="auth-form"><div class="field"><label for="code">Mã xác thực OTP</label><input class="code-input" id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="000000" required></div><button class="btn btn-primary btn-block" type="submit">Xác minh tài khoản <span>→</span></button></form><div style="display:flex;justify-content:space-between;align-items:center;margin-top:15px"><button class="text-action" type="button" id="resend-code">Gửi lại mã</button><button class="text-action" type="button" id="back-login">Quay lại đăng nhập</button></div><div class="notice info">Không chia sẻ mã OTP cho bất kỳ ai. Nếu không thấy email, hãy kiểm tra thư mục Spam/Quảng cáo.</div>`; }
  async function submitAuth(event) {
    event.preventDefault(); const form = event.currentTarget; const button = form.querySelector('button[type="submit"]'); button.disabled = true; const old = button.innerHTML; button.textContent = "Đang xử lý…";
    const values = Object.fromEntries(new FormData(form).entries());
    try {
      if (state.authMode === "register") {
        const result = await post("/auth/register", { name: values.name.trim(), email: values.email.trim(), password: values.password });
        state.pendingEmail = result.email || values.email.trim(); renderAuth("verify", "Tài khoản đã tạo. Hãy nhập mã được gửi đến email của bạn.");
      } else if (state.authMode === "verify") {
        await post("/auth/verify-email", { email: state.pendingEmail, code: String(values.code).trim() });
        showToast("Email đã xác minh. Bạn có thể đăng nhập.", "success"); renderAuth("login", "Email đã xác minh thành công. Hãy đăng nhập để tiếp tục.");
      } else {
        const result = await post("/auth/login", { email: values.email.trim(), password: values.password });
        state.token = result.accessToken; state.refreshToken = result.refreshToken; state.user = result.user || await get("/users/me"); state.view = state.user.role === "DRIVER" ? "tasks" : "dashboard"; renderShell(); await renderView();
      }
    } catch (error) {
      if (state.authMode === "login" && (String(error.message).includes("EMAIL_NOT_VERIFIED") || String(error.data?.message).includes("EMAIL_NOT_VERIFIED"))) { state.pendingEmail = values.email.trim(); renderAuth("verify", "Email này chưa được xác minh. Hãy nhập mã OTP hoặc gửi lại mã."); }
      else { button.disabled = false; button.innerHTML = old; showToast(error.message, "error"); }
    }
  }
  async function resendCode() { const button = root.querySelector("#resend-code"); if (!state.pendingEmail) return; button.disabled = true; try { await post("/auth/resend-verification", { email: state.pendingEmail }); showToast("Nếu tài khoản cần xác minh, email sẽ được gửi. Vui lòng kiểm tra hộp thư.", "success"); } catch (error) { showToast(error.message, "error"); } finally { setTimeout(() => { if (button.isConnected) button.disabled = false; }, 3000); } }

  function navItems() {
    if (state.user.role === "SENDER") return [{ id: "dashboard", icon: "⌂", label: "Tổng quan" }, { id: "new", icon: "+", label: "Tạo đơn giao hàng" }, { id: "shipments", icon: "▤", label: "Đơn hàng của tôi" }, { id: "tracking", icon: "⌖", label: "Tra cứu đơn" }, { id: "profile", icon: "◉", label: "Tài khoản" }];
    if (state.user.role === "DRIVER") return [{ id: "tasks", icon: "⇢", label: "Công việc của tôi" }, { id: "profile", icon: "◉", label: "Tài khoản" }];
    const items = [{ id: "dashboard", icon: "⌂", label: "Tổng quan" }, { id: "shipments", icon: "▤", label: "Tất cả đơn hàng" }, { id: "tracking", icon: "⌖", label: "Tra cứu đơn" }];
    if (["ADMIN", "DISPATCHER"].includes(state.user.role)) items.push({ id: "users", icon: "♙", label: state.user.role === "ADMIN" ? "Tài khoản & phân quyền" : "Điều phối tài xế" });
    if (state.user.role === "ADMIN") items.push({ id: "pricing", icon: "₫", label: "Bảng giá dịch vụ" });
    items.push({ id: "profile", icon: "◉", label: "Tài khoản quản lý" }); return items;
  }
  function renderShell() {
    root.innerHTML = `<div class="shell"><aside class="sidebar"><div class="brand"><div class="brand-mark">M</div><span>MOVEFLOW</span></div><div class="nav-label">${state.user.role === "SENDER" ? "Không gian khách hàng" : state.user.role === "DRIVER" ? "Không gian tài xế" : "Trung tâm vận hành"}</div><nav>${navItems().map(item => `<button class="nav-item ${state.view === item.id ? "active" : ""}" data-view="${item.id}"><span class="nav-icon">${item.icon}</span>${item.label}</button>`).join("")}</nav><div class="sidebar-bottom"><div class="sidebar-tip"><b style="color:#fff">Cần hỗ trợ?</b><br>Tra cứu mã đơn hoặc liên hệ bộ phận vận hành để được hỗ trợ nhanh.</div><button class="nav-item" data-action="logout"><span class="nav-icon">↪</span>Đăng xuất</button></div></aside><section class="main-area"><header class="topbar"><div class="topbar-left"><button class="mobile-nav-toggle" data-action="toggle-nav" aria-label="Mở menu">☰</button><div><div class="crumb">WORKSPACE / ${esc(roleName(state.user.role).toUpperCase())}</div><div class="page-title" id="top-title">${esc(TITLES[state.view] || "Tổng quan")}</div></div></div><div class="top-actions"><span class="status-pill">● Email đã xác minh</span><button class="profile-trigger" data-view="profile"><span class="avatar">${esc(initials(state.user.name))}</span><span class="profile-text"><b>${esc(state.user.name)}</b><small>${esc(roleName(state.user.role))}</small></span></button></div></header><main class="content" id="page-content"><div class="page-loading">Đang tải dữ liệu…</div></main></section></div>`;
    root.querySelectorAll("[data-view]").forEach(button => button.addEventListener("click", () => nav(button.dataset.view)));
    root.querySelectorAll("[data-action]").forEach(button => button.addEventListener("click", () => { if (button.dataset.action === "logout") logout(); if (button.dataset.action === "toggle-nav") document.querySelector(".sidebar")?.classList.toggle("open"); }));
  }
  const content = () => root.querySelector("#page-content");
  async function safeGet(path, fallback = []) { try { return await get(path); } catch (error) { showToast(error.message, "error"); return fallback; } }
  async function renderView() {
    if (!state.user) return renderAuth("login");
    const target = content(); if (!target) return; target.innerHTML = '<div class="page-loading">Đang đồng bộ dữ liệu…</div>';
    const title = root.querySelector("#top-title"); if (title) title.textContent = TITLES[state.view] || "Tổng quan";
    try {
      if (state.view === "dashboard") await renderDashboard(target);
      else if (state.view === "shipments") await renderShipments(target);
      else if (state.view === "new") renderNewShipment(target);
      else if (state.view === "tracking") renderTracking(target);
      else if (state.view === "tasks") await renderTasks(target);
      else if (state.view === "users") await renderUsers(target);
      else if (state.view === "pricing") await renderPricing(target);
      else if (state.view === "profile") await renderProfile(target);
      else if (state.view === "details" && state.detail) await renderShipmentDetails(target, state.detail);
      else { state.view = "dashboard"; await renderDashboard(target); }
    } catch (error) { target.innerHTML = `<div class="panel"><div class="notice error">${esc(error.message)}</div><button class="btn btn-outline" data-action="retry">Thử tải lại</button></div>`; target.querySelector('[data-action="retry"]')?.addEventListener("click", renderView); }
  }
  function welcome(title, subtitle, actions = "") { return `<div class="welcome-row"><div><h1>${title}</h1><p>${subtitle}</p></div><div class="welcome-actions">${actions}</div></div>`; }
  function stat(label, value, note, icon, color = "") { return `<article class="stat-card"><div class="stat-top"><span>${label}</span><span class="stat-icon" style="${color}">${icon}</span></div><div class="stat-value">${value}</div><div class="stat-note">${note}</div></article>`; }
  function shipmentRows(items, actionLabel = "Chi tiết") { if (!items.length) return `<tr><td colspan="6"><div class="empty"><div class="empty-icon">▤</div>Chưa có đơn hàng để hiển thị.</div></td></tr>`; return items.map(item => `<tr><td class="id-cell">${esc(item.trackingCode || item.id?.slice(0, 8) || "—")}</td><td>${esc(item.serviceType || "STANDARD")}</td><td>${badge(item.status)}</td><td class="money">${fmtMoney(item.fee)}</td><td>${fmtDate(item.createdAt)}</td><td><button class="btn btn-outline btn-sm" data-action="details" data-id="${esc(item.id)}">${actionLabel}</button></td></tr>`).join(""); }
  function shipmentTable(items) { return `<div class="table-wrap"><table><thead><tr><th>Mã đơn</th><th>Dịch vụ</th><th>Trạng thái</th><th>Phí dự kiến</th><th>Ngày tạo</th><th></th></tr></thead><tbody>${shipmentRows(items)}</tbody></table></div>`; }
  async function renderDashboard(target) {
    const shipments = await safeGet("/shipments?page=1&limit=100"); state.lastShipments = Array.isArray(shipments) ? shipments : [];
    if (state.user.role === "SENDER") {
      const items = state.lastShipments; const active = items.filter(x => x.status !== "DELIVERED").length; const delivered = items.filter(x => x.status === "DELIVERED").length; const fee = items.reduce((sum, x) => sum + Number(x.fee || 0), 0);
      target.innerHTML = `${welcome(`Xin chào, ${esc(state.user.name.split(/\s+/).slice(-1)[0])} 👋`, "Đây là tổng quan hành trình giao nhận của bạn.", '<button class="btn btn-primary" data-view="new">＋ Tạo đơn mới</button>')}<div class="grid stats-grid">${stat("Tổng đơn hàng", items.length, "Tất cả đơn đã tạo", "▤")}${stat("Đang xử lý", active, "Đơn chưa giao hoàn tất", "⇢", "background:#fff4da;color:#9d6913")}${stat("Đã giao thành công", delivered, "Hoàn tất hành trình", "✓", "background:#e7f8f0;color:#177c59")}${stat("Tổng phí đơn hàng", fmtMoney(fee), "Tổng phí đã ghi nhận", "₫")}</div><div class="grid dashboard-grid"><section class="panel"><div class="panel-head"><div><h3>Đơn hàng gần đây</h3><p>Theo dõi tiến trình xử lý các đơn mới nhất</p></div><button class="link-button" data-view="shipments">Xem tất cả →</button></div>${shipmentTable(items.slice(0, 5))}</section><section class="panel"><div class="panel-head"><div><h3>Lối tắt</h3><p>Thao tác thường dùng</p></div></div><div class="quick-actions"><button class="quick-action" data-view="new"><span class="qa-icon">＋</span><b>Tạo đơn giao hàng</b><small>Nhập điểm lấy, điểm giao và kiện hàng</small></button><button class="quick-action" data-view="tracking"><span class="qa-icon">⌖</span><b>Tra cứu đơn hàng</b><small>Xem tiến độ bằng mã vận đơn</small></button><button class="quick-action" data-view="profile"><span class="qa-icon">◉</span><b>Tài khoản</b><small>Chỉnh hồ sơ và đổi mật khẩu</small></button><button class="quick-action" data-action="support"><span class="qa-icon">?</span><b>Hướng dẫn</b><small>Xem cách dùng những chức năng cơ bản</small></button></div></section></div>`;
    } else {
      const isAdmin = state.user.role === "ADMIN"; const queue = await safeGet("/dispatch/queue", []); state.lastQueue = Array.isArray(queue) ? queue : [];
      let users = []; if (isAdmin) { users = await safeGet("/admin/users", []); state.lastUsers = Array.isArray(users) ? users : []; }
      const delivered = state.lastShipments.filter(x => x.status === "DELIVERED").length; const active = state.lastShipments.filter(x => x.status !== "DELIVERED").length;
      target.innerHTML = `${welcome("Trung tâm vận hành", "Theo dõi đơn hàng, tình trạng điều phối và sức khỏe tài khoản.", '<button class="btn btn-primary" data-view="shipments">▤ Xem đơn hàng</button>')}<div class="grid stats-grid">${stat("Tổng đơn hàng", state.lastShipments.length, "Trong danh sách mới nhất", "▤")}${stat("Cần điều phối", state.lastQueue.length, "Chưa có tài xế nhận", "⇢", "background:#fff4da;color:#9d6913")}${stat("Đã giao thành công", delivered, "Hoàn tất hành trình", "✓", "background:#e7f8f0;color:#177c59")}${stat(isAdmin ? "Tài khoản" : "Đơn đang mở", isAdmin ? users.length : active, isAdmin ? "Khách hàng, tài xế và nhân sự" : "Chưa giao hoàn tất", isAdmin ? "♙" : "◷")}</div><div class="grid dashboard-grid"><section class="panel"><div class="panel-head"><div><h3>Đơn hàng mới nhất</h3><p>Danh sách cần theo dõi</p></div><button class="link-button" data-view="shipments">Mở danh sách →</button></div>${shipmentTable(state.lastShipments.slice(0, 6))}</section><section class="panel"><div class="panel-head"><div><h3>Hàng chờ điều phối</h3><p>Các đơn chưa có tài xế nhận</p></div><button class="link-button" data-view="users">Vận hành →</button></div>${state.lastQueue.slice(0, 5).map(q => `<div class="kpi-row"><span><b>${esc(q.trackingCode || q.id?.slice(0, 8))}</b><br><small>${fmtDate(q.createdAt)}</small></span><button class="btn btn-light btn-sm" data-action="assign" data-id="${esc(q.id)}">Phân công</button></div>`).join("") || '<div class="empty">Không có đơn đang chờ điều phối.</div>'}</section></div>`;
    }
    bindViewButtons(target);
  }
  async function renderShipments(target) {
    const result = await safeGet("/shipments?page=1&limit=100", []); const items = Array.isArray(result) ? result : []; state.lastShipments = items;
    target.innerHTML = `${welcome("Đơn hàng", state.user.role === "SENDER" ? "Quản lý và theo dõi các yêu cầu giao nhận của bạn." : "Giám sát trạng thái đơn hàng trên toàn hệ thống.", state.user.role === "SENDER" ? '<button class="btn btn-primary" data-view="new">＋ Tạo đơn mới</button>' : '')}<section class="panel"><div class="filters"><input id="shipment-search" placeholder="Tìm mã đơn…"><select id="shipment-filter"><option value="">Tất cả trạng thái</option><option value="RECEIVED">Đã tiếp nhận</option><option value="IN_TRANSIT">Đang vận chuyển</option><option value="OUT_FOR_DELIVERY">Đang giao hàng</option><option value="DELIVERED">Đã giao</option></select><button class="btn btn-outline btn-sm" data-action="reload-shipments">↻ Làm mới</button></div><div id="shipment-table">${shipmentTable(items)}</div><p class="small-muted">Danh sách đang hiển thị tối đa 100 đơn gần nhất.</p></section>`;
    const filter = () => { const search = (target.querySelector("#shipment-search")?.value || "").toLowerCase(); const status = target.querySelector("#shipment-filter")?.value || ""; const filtered = items.filter(x => String(x.trackingCode || x.id).toLowerCase().includes(search) && (!status || x.status === status)); target.querySelector("#shipment-table").innerHTML = shipmentTable(filtered); bindViewButtons(target); };
    target.querySelector("#shipment-search")?.addEventListener("input", filter); target.querySelector("#shipment-filter")?.addEventListener("change", filter); bindViewButtons(target);
  }
  let activeSenderMapController = null;
  let activeDriverTripController = null;
  let activeDetailMapEngine = null;
  let liveTrackingTimer = null;

  function stopLiveTracking() {
    if (liveTrackingTimer) {
      clearInterval(liveTrackingTimer);
      liveTrackingTimer = null;
    }
    if (activeDetailMapEngine) {
      activeDetailMapEngine.destroy();
      activeDetailMapEngine = null;
    }
  }

  function addressFields(prefix, title) {
    const pickup = prefix === "pickup";
    return `<div class="form-section">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
        <h3 style="margin:0">${title}</h3>
        ${pickup ? `<button type="button" class="btn btn-outline btn-sm" id="btn-gps-pickup">⌖ Vị trí GPS của tôi</button>` : ""}
      </div>
      <p class="small-muted">${pickup ? "Tìm kiếm địa chỉ hoặc kéo thả ghim A trên bản đồ bên dưới." : "Tìm kiếm địa chỉ hoặc kéo thả ghim B trên bản đồ bên dưới."}</p>
      
      <div class="field" style="position:relative">
        <label>Tìm kiếm địa chỉ (gợi ý tự động)</label>
        <input id="${prefix}-search-input" placeholder="Gõ ít nhất 3 ký tự để tìm kiếm…" autocomplete="off">
        <div id="${prefix}-search-results" style="display:none;position:absolute;top:100%;left:0;right:0;background:white;border:1px solid var(--line);border-radius:10px;box-shadow:var(--shadow);z-index:100;max-height:220px;overflow-y:auto"></div>
      </div>

      <div class="field">
        <label>Số nhà, tên đường</label>
        <input name="${prefix}Line" maxlength="255" placeholder="Số nhà, tên đường" required>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Phường / xã</label>
          <input name="${prefix}Ward" maxlength="100" required>
        </div>
        <div class="field">
          <label>Quận / huyện</label>
          <input name="${prefix}District" maxlength="100" required>
        </div>
      </div>
      <div class="field">
        <label>Tỉnh / thành phố</label>
        <input name="${prefix}City" value="Thành phố Hồ Chí Minh" maxlength="100" required>
      </div>
      <div class="field-row" style="display:none">
        <input name="${prefix}Lat" type="hidden">
        <input name="${prefix}Lng" type="hidden">
      </div>
    </div>`;
  }

  async function renderNewShipment(target) {
    state.quote = null;
    if (activeSenderMapController) {
      activeSenderMapController.destroy();
      activeSenderMapController = null;
    }

    target.innerHTML = `${welcome("Tạo đơn giao hàng", "Tạo yêu cầu giao nhận mới với định tuyến tự động OSRM và bản đồ MapLibre.")}<form id="shipment-form"><section class="panel"><div class="grid form-grid">${addressFields("pickup", "01 · Điểm lấy hàng")}${addressFields("dropoff", "02 · Điểm giao hàng")}</div><div class="form-section"><h3>Bản đồ lộ trình & vị trí ghim (A → B)</h3><p class="small-muted">Bạn có thể kéo thả trực tiếp ghim <b>A (Lấy hàng)</b> và <b>B (Giao hàng)</b> trên bản đồ để cập nhật tọa độ chính xác.</p><div id="sender-shipment-map" class="moveflow-map-container" style="height:380px"></div></div><div class="form-section"><h3>03 · Thông tin kiện hàng</h3><p>Thông tin này dùng để tính phụ phí khối lượng theo bảng giá hiện tại.</p><div class="grid form-grid"><div class="field"><label>Khối lượng (kg)</label><input name="weightKg" type="number" min="0.01" max="9999" step="0.01" value="1" required></div><div class="field"><label>Loại dịch vụ</label><select name="serviceType"><option value="STANDARD">Tiêu chuẩn</option><option value="EXPRESS">Hỏa tốc</option></select></div><div class="field"><label>Dài (cm)</label><input name="lengthCm" type="number" min="0.01" step="0.01" value="20" required></div><div class="field"><label>Rộng (cm)</label><input name="widthCm" type="number" min="0.01" step="0.01" value="15" required></div><div class="field"><label>Cao (cm)</label><input name="heightCm" type="number" min="0.01" step="0.01" value="10" required></div></div></div><div id="quote-result"></div><div class="form-actions"><button class="btn btn-outline" type="button" id="quote-button">Tính phí dự kiến</button><button class="btn btn-primary" type="submit">Tạo đơn giao hàng →</button></div><p class="small-muted">Quãng đường và lộ trình tính tự động qua OSRM driving profile. Bản đồ nguồn OpenStreetMap.</p></section></form>`;

    const form = target.querySelector("#shipment-form");
    const mapEl = target.querySelector("#sender-shipment-map");

    try {
      const { SenderMapController } = await import("./map/sender-map-controller.js");
      const { debounce } = await import("./map/api-clients.js");

      activeSenderMapController = new SenderMapController({
        mapElement: mapEl,
        form,
        api: { post },
        onQuoteChanged: (quote) => {
          state.quote = quote;
          const box = target.querySelector("#quote-result");
          if (!box) return;
          if (!quote) {
            box.innerHTML = "";
            return;
          }
          const durationMin = Math.round(Number(quote.durationSeconds || 0) / 60);
          box.innerHTML = `<div class="quote-box"><div><small>PHÍ GIAO HÀNG DỰ KIẾN</small><strong>${fmtMoney(quote.fee)}</strong><div style="font-size:16px;font-weight:700;margin-top:8px">Quãng đường: ${Number(quote.distanceKm).toFixed(2)} km (~${durationMin} phút)</div><div class="small-muted">Định tuyến đường bộ · Nguồn ${esc(quote.distanceSource || "OSRM")}</div></div><span class="badge blue">Version ${esc(quote.ruleVersion || "—")}</span></div>`;
        },
      });

      await activeSenderMapController.mount();

      target.querySelector("#btn-gps-pickup")?.addEventListener("click", async () => {
        try {
          await activeSenderMapController.fillPickupWithGps();
          showToast("Đã lấy vị trí GPS hiện tại cho điểm lấy hàng.");
        } catch (err) {
          showToast(err.message, "error");
        }
      });

      for (const prefix of ["pickup", "dropoff"]) {
        const searchInput = target.querySelector(`#${prefix}-search-input`);
        const dropdown = target.querySelector(`#${prefix}-search-results`);
        if (searchInput && dropdown) {
          const doSearch = debounce(async () => {
            const q = searchInput.value.trim();
            if (q.length < 3) {
              dropdown.style.display = "none";
              dropdown.innerHTML = "";
              return;
            }
            try {
              const results = await activeSenderMapController.geocoding.search(q, 5);
              if (!results || results.length === 0) {
                dropdown.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--muted)">Không tìm thấy địa chỉ phù hợp</div>';
                dropdown.style.display = "block";
                return;
              }
              dropdown.innerHTML = results.map((item, idx) => `
                <div class="search-item" data-idx="${idx}" style="padding:9px 12px;font-size:12px;cursor:pointer;border-bottom:1px solid #edf0f6">
                  <b>${esc(item.address?.line || item.label.split(",")[0])}</b>
                  <div style="font-size:11px;color:var(--muted)">${esc(item.label)}</div>
                </div>
              `).join("");
              dropdown.style.display = "block";

              dropdown.querySelectorAll(".search-item").forEach(itemEl => {
                itemEl.addEventListener("click", () => {
                  const item = results[Number(itemEl.dataset.idx)];
                  activeSenderMapController.selectSearchResult(prefix, item);
                  dropdown.style.display = "none";
                  searchInput.value = item.label;
                });
              });
            } catch (err) {
              dropdown.innerHTML = `<div style="padding:10px;font-size:12px;color:var(--red)">${esc(err.message)}</div>`;
              dropdown.style.display = "block";
            }
          }, 350);

          searchInput.addEventListener("input", doSearch);
          document.addEventListener("click", (e) => {
            if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
              dropdown.style.display = "none";
            }
          });
        }
      }
    } catch (err) {
      console.error("Map initialization failed", err);
    }

    target.querySelector("#quote-button").addEventListener("click", async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        const body = activeSenderMapController ? activeSenderMapController.getBookingPayload() : bookingPayload(new FormData(form));
        const quote = await post("/pricing/quote", body);
        state.quote = quote;
        if (activeSenderMapController && quote.geometry) {
          activeSenderMapController.engine?.setRoute(quote.geometry);
          activeSenderMapController.engine?.fitRelevantPoints();
        }
        const durationMin = Math.round(Number(quote.durationSeconds || 0) / 60);
        target.querySelector("#quote-result").innerHTML = `<div class="quote-box"><div><small>PHÍ GIAO HÀNG DỰ KIẾN</small><strong>${fmtMoney(quote.fee)}</strong><div style="font-size:16px;font-weight:700;margin-top:8px">Quãng đường tính phí: ${Number(quote.distanceKm).toFixed(2)} km (~${durationMin} phút)</div><div class="small-muted">Khoảng cách đường bộ · Nguồn ${esc(quote.distanceSource || "OSRM")}</div></div><span class="badge blue">Version ${esc(quote.ruleVersion || "—")}</span></div>`;
      } catch (error) {
        showToast(error.message, "error");
      } finally {
        button.disabled = false;
      }
    });

    form.addEventListener("submit", async event => {
      event.preventDefault();
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      try {
        const body = activeSenderMapController ? activeSenderMapController.getBookingPayload() : bookingPayload(new FormData(form));
        const result = await post("/shipments", body);
        showToast("Đơn hàng đã được tạo.", "success");
        state.detail = result.id;
        state.view = "details";
        renderShell();
        await renderView();
      } catch (error) {
        showToast(error.message, "error");
        submit.disabled = false;
      }
    });
    bindViewButtons(target);
  }
  function bookingPayload(formData) { for (const prefix of ["pickup", "dropoff"]) { if (!formData.get(`${prefix}Lat`) || !formData.get(`${prefix}Lng`)) throw new Error(`Chưa chọn vị trí trên bản đồ cho ${prefix === "pickup" ? "điểm lấy" : "điểm giao"}.`); } const n = key => Number(formData.get(key)); const text = key => String(formData.get(key) || "").trim(); return { pickupAddress: { line: text("pickupLine"), ward: text("pickupWard"), district: text("pickupDistrict"), city: text("pickupCity") || "Thành phố Hồ Chí Minh", lat: n("pickupLat"), lng: n("pickupLng") }, dropoffAddress: { line: text("dropoffLine"), ward: text("dropoffWard"), district: text("dropoffDistrict"), city: text("dropoffCity") || "Thành phố Hồ Chí Minh", lat: n("dropoffLat"), lng: n("dropoffLng") }, parcel: { weightKg: n("weightKg"), lengthCm: n("lengthCm"), widthCm: n("widthCm"), heightCm: n("heightCm") }, serviceType: text("serviceType") }; }
  function renderTracking(target) { target.innerHTML = `${welcome("Tra cứu đơn hàng", "Nhập mã vận đơn để xem trạng thái gần nhất và lịch sử xử lý.")}<section class="panel" style="max-width:800px"><form id="tracking-form"><div class="field"><label>Mã vận đơn</label><input name="trackingCode" placeholder="Ví dụ: A1B2C3D4E5F6A7B8" maxlength="16" minlength="12" style="text-transform:uppercase" required></div><button class="btn btn-primary" type="submit">Tra cứu trạng thái →</button></form><div id="tracking-result"></div></section>`; target.querySelector("#tracking-form").addEventListener("submit", async event => { event.preventDefault(); const code = String(new FormData(event.currentTarget).get("trackingCode")).trim().toUpperCase(); const box = target.querySelector("#tracking-result"); box.innerHTML = '<div class="page-loading">Đang tra cứu…</div>'; try { const result = await api(`/tracking/${encodeURIComponent(code)}`); const history = (result.history || []).map(item => `<div class="tracking-step"><b>${badge(item.toStatus)}</b><span>${fmtDate(item.occurredAt)}</span></div>`).join(""); box.innerHTML = `<div class="section-gap"><div class="panel-head"><div><h3>Đơn ${esc(result.trackingCode)}</h3><p>Tạo lúc ${fmtDate(result.createdAt)}</p></div>${badge(result.status)}</div><div class="tracking-result"><div class="tracking-step"><b>Điểm lấy</b><span>${esc(result.pickup?.city || "Địa chỉ lấy hàng đã lưu")}</span></div><div class="tracking-step"><b>Điểm giao</b><span>${esc(result.dropoff?.city || "Địa chỉ giao hàng đã lưu")}</span></div></div><div class="section-gap"><h3>Lịch sử trạng thái</h3><div class="tracking-result">${history || "Chưa có lịch sử bổ sung."}</div></div></div>`; } catch (error) { box.innerHTML = `<div class="notice error">${esc(error.message)}</div>`; } }); }
  async function renderTasks(target) {
    if (activeDriverTripController) {
      activeDriverTripController.destroy();
      activeDriverTripController = null;
    }

    const tasks = await safeGet("/drivers/me/tasks", []);
    const activeTask = tasks.find(task =>
      task.status === "ACCEPTED" &&
      task.shipment &&
      ["EN_ROUTE_PICKUP", "ARRIVED_PICKUP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "ARRIVED_DROPOFF", "RECEIVED"].includes(task.shipment.status)
    );

    let activeTripSection = "";
    if (activeTask) {
      if (state.taskRefreshTimer) {
        clearInterval(state.taskRefreshTimer);
        state.taskRefreshTimer = null;
      }
      activeTripSection = `
        <section class="panel section-gap driver-trip-panel" style="border: 2px solid var(--accent, #0ea5e9);">
          <div class="panel-head">
            <div>
              <span class="badge blue" id="trip-phase-badge">Đang khởi tạo lộ trình...</span>
              <h3 id="trip-title" style="margin-top:6px">Điều hướng đơn ${esc(activeTask.shipment.trackingCode || activeTask.shipmentId?.slice(0, 8))}</h3>
              <p id="trip-note" class="small-muted">Đang kết nối GPS thiết bị...</p>
            </div>
            <div id="trip-status-container">${badge(activeTask.shipment.status)}</div>
          </div>
          <div id="driver-trip-map" class="moveflow-map-container" style="height:380px;margin:12px 0;border-radius:8px"></div>
          <div id="driver-trip-actions" class="action-group">
            <button class="btn btn-primary" disabled>Đang kiểm tra cự ly...</button>
          </div>
        </section>
      `;
    }

    target.innerHTML = `${welcome("Công việc tài xế", activeTask ? "Đang điều hướng đơn hàng trực tiếp bằng MapLibre GL." : "Đơn được phân công sẽ tự làm mới tại đây mỗi 15 giây.", '<button class="btn btn-outline" data-action="refresh-tasks">↻ Làm mới</button><button class="btn btn-outline" data-action="update-driver-location">⌖ Cập nhật vị trí GPS</button><button class="btn btn-outline" data-action="driver-status" data-status="AVAILABLE">● Sẵn sàng</button><button class="btn btn-outline" data-action="driver-status" data-status="OFFLINE">Đang ngoại tuyến</button>')}<div class="notice info">Để được tự động phân công, hãy bật trạng thái sẵn sàng và cập nhật vị trí GPS. Vị trí cần được làm mới định kỳ để đảm bảo điều phối chính xác.</div>${activeTripSection}<div class="grid" style="gap:16px">${tasks.map(task => { const shipment = task.shipment || {}; const isActive = activeTask && activeTask.id === task.id; return `<article class="panel"><div class="panel-head"><div><h3>Đơn ${esc(shipment.trackingCode || task.shipmentId?.slice(0, 8))}</h3><p>Giao lúc phân công: ${fmtDate(task.assignedAt)}</p></div>${badge(task.status)}</div><div class="grid form-grid"><div class="tracking-step"><b>Điểm lấy hàng</b><span>${esc(shipment.pickup?.line || "—")}, ${esc(shipment.pickup?.district || "")}</span></div><div class="tracking-step"><b>Điểm giao hàng</b><span>${esc(shipment.dropoff?.line || "—")}, ${esc(shipment.dropoff?.district || "")}</span></div></div><div class="action-group section-gap">${task.status === "PENDING" ? `<button class="btn btn-primary btn-sm" data-action="respond-assignment" data-id="${esc(task.id)}" data-response="ACCEPT">Nhận đơn</button><button class="btn btn-danger btn-sm" data-action="respond-assignment" data-id="${esc(task.id)}" data-response="REJECT">Từ chối</button>` : ""}${isActive ? '<span class="small-muted" style="align-self:center">● Đang điều hướng trên bản đồ bên trên</span>' : ""}</div></article>`; }).join("") || '<section class="panel empty"><div class="empty-icon">⇢</div><h3>Chưa có công việc được phân công</h3><p>Các đơn mới sẽ xuất hiện tại đây khi được điều phối.</p></section>'}</div>`;

    bindViewButtons(target);

    if (activeTask) {
      try {
        const { DriverTripController } = await import("./map/driver-trip-controller.js");
        const mapEl = target.querySelector("#driver-trip-map");
        if (mapEl) {
          const badgeEl = target.querySelector("#trip-phase-badge");
          const noteEl = target.querySelector("#trip-note");
          const statusEl = target.querySelector("#trip-status-container");
          const actionsEl = target.querySelector("#driver-trip-actions");

          const updateUi = (data) => {
            const phase = activeDriverTripController?.phase || data?.phase;
            const status = activeDriverTripController?.shipmentStatus || data?.shipmentStatus;
            const arrival = activeDriverTripController?.arrival || data?.arrival || { eligible: false, distanceM: null };

            if (statusEl && status) statusEl.innerHTML = badge(status);

            const distStr = arrival.distanceM != null ? `${Math.round(arrival.distanceM)}m` : "đang tính...";

            if (phase === "TO_PICKUP") {
              if (badgeEl) { badgeEl.className = "badge blue"; badgeEl.textContent = "Chặng 1: Đến điểm lấy hàng"; }
              if (noteEl) noteEl.textContent = `Khoảng cách tới điểm lấy: ~${distStr}. ${arrival.eligible ? "✓ Đã trong phạm vi 100m. Bạn có thể bấm xác nhận đến." : "Cần tới trong bán kính 100m để mở nút xác nhận."}`;
              if (actionsEl) {
                actionsEl.innerHTML = `<button class="btn btn-primary" id="btn-driver-arrival" ${arrival.eligible ? "" : "disabled"} title="${arrival.eligible ? "" : "Cần tới trong phạm vi 100m"}">⚑ Đã đến điểm lấy hàng</button>`;
              }
            } else if (phase === "AT_PICKUP") {
              if (badgeEl) { badgeEl.className = "badge warning"; badgeEl.textContent = "Đã đến điểm lấy hàng"; }
              if (noteEl) noteEl.textContent = "Hãy kiểm tra kiện hàng từ người gửi và xác nhận đã lấy hàng.";
              if (actionsEl) {
                actionsEl.innerHTML = `<button class="btn btn-primary" id="btn-driver-pickup">📦 Xác nhận đã lấy hàng</button>`;
              }
            } else if (phase === "TO_DROPOFF") {
              if (badgeEl) { badgeEl.className = "badge blue"; badgeEl.textContent = "Chặng 2: Giao đến điểm nhận"; }
              if (noteEl) noteEl.textContent = `Khoảng cách tới điểm giao: ~${distStr}. ${arrival.eligible ? "✓ Đã trong phạm vi 100m. Bạn có thể bấm xác nhận đến." : "Cần tới trong bán kính 100m để mở nút xác nhận."}`;
              if (actionsEl) {
                actionsEl.innerHTML = `
                  <button class="btn btn-primary" id="btn-driver-arrival" ${arrival.eligible ? "" : "disabled"} title="${arrival.eligible ? "" : "Cần tới trong phạm vi 100m"}">⚑ Đã đến điểm giao hàng</button>
                  <button class="btn btn-danger btn-sm" id="btn-driver-failed">✕ Báo giao thất bại</button>
                `;
              }
            } else if (phase === "AT_DROPOFF") {
              if (badgeEl) { badgeEl.className = "badge warning"; badgeEl.textContent = "Đã đến điểm giao hàng"; }
              if (noteEl) noteEl.textContent = "Bàn giao kiện hàng cho người nhận và xác nhận hoàn tất.";
              if (actionsEl) {
                actionsEl.innerHTML = `
                  <button class="btn btn-success" id="btn-driver-deliver">✓ Xác nhận giao thành công</button>
                  <button class="btn btn-danger btn-sm" id="btn-driver-failed">✕ Báo giao thất bại</button>
                `;
              }
            } else if (phase === "COMPLETE") {
              if (badgeEl) { badgeEl.className = "badge success"; badgeEl.textContent = "Đơn hàng hoàn tất"; }
              if (noteEl) noteEl.textContent = "Bạn đã hoàn thành đơn giao hàng này.";
              if (actionsEl) {
                actionsEl.innerHTML = `<button class="btn btn-outline" id="btn-driver-finish">✓ Đóng hành trình</button>`;
              }
            }

            actionsEl?.querySelector("#btn-driver-arrival")?.addEventListener("click", async (e) => {
              e.currentTarget.disabled = true;
              try {
                await activeDriverTripController.confirmArrival();
                showToast("Đã xác nhận đến điểm.");
              } catch (err) {
                showToast(err.message, "error");
                e.currentTarget.disabled = false;
              }
            });

            actionsEl?.querySelector("#btn-driver-pickup")?.addEventListener("click", async (e) => {
              e.currentTarget.disabled = true;
              try {
                await activeDriverTripController.confirmPickup();
                showToast("Đã lấy hàng thành công.");
              } catch (err) {
                showToast(err.message, "error");
                e.currentTarget.disabled = false;
              }
            });

            actionsEl?.querySelector("#btn-driver-deliver")?.addEventListener("click", async (e) => {
              e.currentTarget.disabled = true;
              try {
                await activeDriverTripController.confirmDelivery();
                showToast("Đã giao hàng thành công!");
              } catch (err) {
                showToast(err.message, "error");
                e.currentTarget.disabled = false;
              }
            });

            actionsEl?.querySelector("#btn-driver-failed")?.addEventListener("click", async () => {
              const reason = window.prompt("Nhập lý do không thể giao hàng:");
              if (reason === null) return;
              if (!reason.trim()) {
                showToast("Vui lòng nhập lý do giao thất bại.", "error");
                return;
              }
              try {
                await activeDriverTripController.reportDeliveryFailure(reason.trim());
                showToast("Đã ghi nhận giao hàng thất bại.", "warning");
              } catch (err) {
                showToast(err.message, "error");
              }
            });

            actionsEl?.querySelector("#btn-driver-finish")?.addEventListener("click", async () => {
              if (activeDriverTripController) {
                activeDriverTripController.destroy();
                activeDriverTripController = null;
              }
              await renderTasks(target);
            });
          };

          activeDriverTripController = new DriverTripController({
            mapElement: mapEl,
            shipmentId: activeTask.shipmentId,
            api: { get, post, patch },
            onStateChanged: (evt) => {
              if (evt.type === "GPS_ERROR") {
                if (noteEl) noteEl.textContent = `Lỗi GPS: ${evt.error?.message || "Không thể lấy vị trí thiết bị"}`;
              } else if (evt.type === "NAV_ERROR") {
                if (noteEl) noteEl.textContent = `Lỗi lộ trình: ${evt.error?.message || "Không thể tính lộ trình"}`;
              } else {
                updateUi(evt);
              }
            },
          });

          await activeDriverTripController.mount();
        }
      } catch (err) {
        console.error("Failed to mount DriverTripController", err);
      }
    } else if (!state.taskRefreshTimer) {
      state.taskRefreshTimer = setInterval(() => {
        if (state.view !== "tasks" || state.taskRefreshPending) return;
        state.taskRefreshPending = true;
        renderView().finally(() => { state.taskRefreshPending = false; });
      }, 15000);
    }
  }
  async function renderUsers(target) {
    if (state.user.role !== "ADMIN") { const queue = await safeGet("/dispatch/queue", []); state.lastQueue = Array.isArray(queue) ? queue : []; target.innerHTML = `${welcome("Vận hành & điều phối", "Danh sách hàng chờ và trạng thái điều phối.")}<section class="panel"><div class="panel-head"><h3>Đơn chờ phân công</h3><button class="btn btn-outline btn-sm" data-action="reload-users">↻ Làm mới</button></div>${state.lastQueue.map(q => `<div class="kpi-row"><span><b>${esc(q.trackingCode || q.id.slice(0, 8))}</b><br><small>${fmtDate(q.createdAt)}</small></span><button class="btn btn-primary btn-sm" data-action="assign" data-id="${esc(q.id)}">Phân công tự động</button></div>`).join("") || '<div class="empty">Không có đơn cần điều phối.</div>'}</section>`; bindViewButtons(target); return; }
    const users = await safeGet("/admin/users", []); state.lastUsers = Array.isArray(users) ? users : [];
    target.innerHTML = `${welcome("Tài khoản & phân quyền", "Quản lý trạng thái tài khoản khách hàng, tài xế và nhân sự vận hành.")}<div class="notice info">Không thể tự cấp vai trò ADMIN từ giao diện đăng ký. Tài khoản tài xế/điều phối được tạo bởi quản trị viên và vẫn phải xác minh email trước khi đăng nhập.</div><section class="panel section-gap"><div class="panel-head"><div><h3>Tạo tài khoản nội bộ</h3><p>Chỉ tạo vai trò tài xế hoặc điều phối; gửi mã xác minh tới email của nhân sự.</p></div></div><form id="managed-user-form"><div class="grid form-grid"><div class="field"><label>Họ và tên</label><input name="name" minlength="2" maxlength="100" required></div><div class="field"><label>Email nhân sự</label><input name="email" type="email" required></div><div class="field"><label>Vai trò</label><select name="role"><option value="DRIVER">Tài xế</option><option value="DISPATCHER">Điều phối</option></select></div><div class="field"><label>Mật khẩu tạm thời</label><input name="password" type="password" minlength="10" maxlength="72" required><small>Chuyển mật khẩu tạm cho nhân sự qua kênh riêng, không gửi chung email OTP.</small></div></div><div class="form-actions"><button class="btn btn-primary" type="submit">＋ Tạo tài khoản & gửi OTP</button></div></form></section><section class="panel section-gap"><div class="panel-head"><div><h3>Danh sách tài khoản</h3><p>${users.length} tài khoản trong danh sách · tối đa 250</p></div><button class="btn btn-outline btn-sm" data-action="reload-users">↻ Làm mới</button></div><div class="table-wrap"><table><thead><tr><th>Người dùng</th><th>Vai trò</th><th>Email</th><th>Trạng thái</th><th>Xác minh</th><th>Thao tác</th></tr></thead><tbody>${users.map(user => `<tr><td><b>${esc(user.name)}</b><br><span class="small-muted">${fmtDate(user.createdAt)}</span></td><td>${esc(roleName(user.role))}</td><td>${esc(user.email)}</td><td>${user.active ? '<span class="badge success">Hoạt động</span>' : '<span class="badge danger">Đã khóa</span>'}</td><td>${user.emailVerified ? '<span class="badge success">Đã xác minh</span>' : '<span class="badge warning">Chưa xác minh</span>'}</td><td>${user.id === state.user.id ? '<span class="small-muted">Tài khoản hiện tại</span>' : `<button class="btn ${user.active ? "btn-danger" : "btn-light"} btn-sm" data-action="toggle-user" data-id="${esc(user.id)}" data-active="${!user.active}">${user.active ? "Khóa" : "Mở khóa"}</button>`}</td></tr>`).join("") || '<tr><td colspan="6">Chưa có dữ liệu.</td></tr>'}</tbody></table></div></section>`; bindViewButtons(target);
    target.querySelector("#managed-user-form")?.addEventListener("submit", async event => { event.preventDefault(); const form = event.currentTarget; const submit = form.querySelector('button[type="submit"]'); submit.disabled = true; const data = Object.fromEntries(new FormData(form)); try { const result = await post("/admin/users", data); showToast(`Đã tạo ${roleName(result.role)}. OTP được gửi tới ${result.email}.`); form.reset(); await renderUsers(target); } catch (error) { showToast(error.message, "error"); submit.disabled = false; } });
  }
  async function renderPricing(target) {
    if (state.user.role !== "ADMIN") { target.innerHTML = '<section class="panel"><div class="notice error">Bạn không có quyền quản lý bảng giá.</div></section>'; return; }
    const rules = await safeGet("/admin/pricing-rules", []); state.lastPricing = Array.isArray(rules) ? rules : []; const latest = state.lastPricing[0];
    target.innerHTML = `${welcome("Bảng giá dịch vụ", "Quản lý phiên bản bảng giá; mỗi lần lưu sẽ tạo bản quy tắc mới.")}<div class="grid dashboard-grid"><section class="panel"><div class="panel-head"><div><h3>Quy tắc đang hiển thị</h3><p>Phiên bản mới nhất trước</p></div></div><div class="table-wrap"><table><thead><tr><th>Version</th><th>Phí cơ bản</th><th>Đồng/km</th><th>Kg miễn phí</th><th>Phụ phí/kg</th></tr></thead><tbody>${rules.map(rule => `<tr><td>v${esc(rule.version)}</td><td>${fmtMoney(rule.baseFee)}</td><td>${fmtMoney(rule.ratePerKm)}</td><td>${esc(rule.freeWeightThreshold)}</td><td>${fmtMoney(rule.ratePerExtraKg)}</td></tr>`).join("")}</tbody></table></div></section><section class="panel"><div class="panel-head"><div><h3>Cập nhật bảng giá</h3><p>Tạo version mới từ quy tắc hiện hành</p></div></div>${latest ? `<form id="pricing-form" data-id="${esc(latest.id)}">${[['baseFee','Phí cơ bản',latest.baseFee],['ratePerKm','Phí mỗi km',latest.ratePerKm],['freeWeightThreshold','Số kg miễn phí',latest.freeWeightThreshold],['ratePerExtraKg','Phụ phí mỗi kg',latest.ratePerExtraKg],['standardMultiplier','Hệ số tiêu chuẩn',latest.standardMultiplier],['expressMultiplier','Hệ số hỏa tốc',latest.expressMultiplier]].map(([key,label,value]) => `<div class="field"><label>${label}</label><input name="${key}" type="number" min="0" step="0.01" value="${esc(value)}" required></div>`).join("")}<button class="btn btn-primary btn-block" type="submit">Tạo phiên bản bảng giá mới</button></form>` : '<div class="empty">Chưa có quy tắc bảng giá.</div>'}</section></div>`;
    target.querySelector("#pricing-form")?.addEventListener("submit", async event => { event.preventDefault(); const form = event.currentTarget; const body = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, Number(value)])); try { await api(`/admin/pricing-rules/${form.dataset.id}`, { method: "PUT", body: JSON.stringify(body) }); showToast("Đã tạo phiên bản bảng giá mới."); await renderPricing(target); } catch (error) { showToast(error.message, "error"); } });
  }
  async function renderProfile(target) {
    const profile = await get("/users/me"); state.user = { ...state.user, ...profile };
    target.innerHTML = `${welcome("Tài khoản của tôi", "Quản lý hồ sơ, bảo vệ mật khẩu và kiểm tra trạng thái xác minh.")}<div class="grid profile-grid"><section class="profile-summary"><div class="profile-large-avatar">${esc(initials(profile.name))}</div><h3>${esc(profile.name)}</h3><p>${esc(profile.email)}</p><span class="badge success">${esc(roleName(profile.role))}</span><div class="profile-details section-gap"><div class="detail-chip"><small>Email</small><b>${profile.emailVerified ? "Đã xác minh" : "Chưa xác minh"}</b></div><div class="detail-chip"><small>Tài khoản</small><b>${profile.active ? "Đang hoạt động" : "Đã khóa"}</b></div></div></section><div class="grid" style="gap:18px"><section class="panel"><div class="panel-head"><div><h3>Thông tin cá nhân</h3><p>Email không thể đổi tại đây để tránh mất quyền truy cập.</p></div></div><form id="profile-form"><div class="field"><label>Họ và tên</label><input name="name" value="${esc(profile.name)}" minlength="2" maxlength="100" required></div><div class="field"><label>Email</label><input value="${esc(profile.email)}" disabled></div><button class="btn btn-primary" type="submit">Lưu thay đổi</button></form></section><section class="panel"><div class="panel-head"><div><h3>Đổi mật khẩu</h3><p>Đổi mật khẩu sẽ thu hồi refresh session hiện có.</p></div></div><form id="password-form"><div class="field"><label>Mật khẩu hiện tại</label><input name="currentPassword" type="password" minlength="10" required></div><div class="field"><label>Mật khẩu mới</label><input name="newPassword" type="password" minlength="10" maxlength="72" required></div><button class="btn btn-outline" type="submit">Cập nhật mật khẩu</button></form></section></div></div>`;
    target.querySelector("#profile-form").addEventListener("submit", async event => { event.preventDefault(); try { const result = await patch("/users/me", { name: new FormData(event.currentTarget).get("name") }); state.user = { ...state.user, ...result }; renderShell(); await renderProfile(content()); showToast("Đã cập nhật hồ sơ."); } catch (error) { showToast(error.message, "error"); } });
    target.querySelector("#password-form").addEventListener("submit", async event => { event.preventDefault(); const data = Object.fromEntries(new FormData(event.currentTarget)); try { await patch("/users/me/password", data); showToast("Đã đổi mật khẩu. Vui lòng đăng nhập lại."); await logout(false); } catch (error) { showToast(error.message, "error"); } });
  }
  async function renderShipmentDetails(target, id) {
    stopLiveTracking();
    const shipment = await get(`/shipments/${encodeURIComponent(id)}`);
    const hasCoords = shipment.pickup?.lat != null && shipment.dropoff?.lat != null;
    const isTerminal = ["DELIVERED", "DELIVERY_FAILED", "CANCELLED"].includes(shipment.status);

    target.innerHTML = `${welcome("Chi tiết đơn hàng", `Mã vận đơn ${esc(shipment.trackingCode)} · Tạo lúc ${fmtDate(shipment.createdAt)}`, '<button class="btn btn-outline" data-view="shipments">← Quay lại đơn hàng</button>')}<div class="grid dashboard-grid"><section class="panel"><div class="panel-head"><div><h3>Thông tin vận chuyển</h3><p>Trạng thái và chi phí được lưu trên hệ thống</p></div>${badge(shipment.status)}</div><div class="kpi-row"><span>Mã vận đơn</span><b>${esc(shipment.trackingCode)}</b></div><div class="kpi-row"><span>Loại dịch vụ</span><b>${esc(shipment.serviceType)}</b></div><div class="kpi-row"><span>Phí đã chốt</span><b>${fmtMoney(shipment.fee)}</b></div><div class="kpi-row"><span>Khối lượng</span><b>${esc(shipment.parcel?.weightKg ?? "—")} kg</b></div>${state.user.role === "DRIVER" ? `<div class="section-gap"><button class="btn btn-primary btn-sm" data-view="tasks">↗ Mở bản đồ dẫn đường (Công việc tài xế)</button></div>` : ""}</section><section class="panel"><div class="panel-head"><div><h3>Địa chỉ</h3><p>Thông tin do người tạo đơn cung cấp</p></div></div><div class="tracking-step"><b>Điểm lấy hàng</b><span>${esc(shipment.pickup?.line)}, ${esc(shipment.pickup?.ward)}, ${esc(shipment.pickup?.district)}, ${esc(shipment.pickup?.city)}</span></div><div class="tracking-step section-gap"><b>Điểm giao hàng</b><span>${esc(shipment.dropoff?.line)}, ${esc(shipment.dropoff?.ward)}, ${esc(shipment.dropoff?.district)}, ${esc(shipment.dropoff?.city)}</span></div><div class="section-gap"><h3>Lịch sử</h3>${(shipment.history || []).map(item => `<div class="kpi-row"><span>${badge(item.toStatus)}</span><b>${fmtDate(item.occurredAt)}</b></div>`).join("") || '<p class="small-muted">Chưa có cập nhật.</p>'}</div></section></div>${hasCoords ? `<section class="panel section-gap"><div class="panel-head"><div><h3>Bản đồ hành trình & vị trí tài xế trực tiếp</h3><p id="live-driver-status" class="small-muted">${isTerminal ? "Đơn hàng đã hoàn tất hành trình." : "Đang kết nối vị trí trực tiếp..."}</p></div></div><div id="shipment-detail-map" class="moveflow-map-container" style="height:380px;border-radius:8px"></div></section>` : ""}`;
    bindViewButtons(target);

    if (hasCoords) {
      try {
        const { MapEngine } = await import("./map/map-engine.js");
        const mapEl = target.querySelector("#shipment-detail-map");
        if (mapEl) {
          activeDetailMapEngine = new MapEngine({ container: mapEl });
          await activeDetailMapEngine.ready();
          activeDetailMapEngine.setEndpoints({
            pickup: { lat: shipment.pickup.lat, lng: shipment.pickup.lng },
            dropoff: { lat: shipment.dropoff.lat, lng: shipment.dropoff.lng },
          });
          activeDetailMapEngine.fitRelevantPoints();

          const statusNote = target.querySelector("#live-driver-status");
          const pollLive = async () => {
            if (document.visibilityState !== "visible") return;
            try {
              const live = await get(`/shipments/${encodeURIComponent(id)}/live`);
              if (live.driver && activeDetailMapEngine) {
                activeDetailMapEngine.setDriverLocation(live.driver);
                activeDetailMapEngine.fitRelevantPoints();
                if (statusNote) {
                  statusNote.textContent = `Tài xế đang di chuyển · Cập nhật lúc ${fmtDate(live.driver.capturedAt)} (Độ chính xác ~${Math.round(live.driver.accuracyM || 0)}m)`;
                }
              } else if (["DELIVERED", "DELIVERY_FAILED", "CANCELLED"].includes(live.status)) {
                stopLiveTracking();
                if (statusNote) statusNote.textContent = "Đơn hàng đã hoàn tất hành trình.";
              } else {
                if (statusNote) statusNote.textContent = "Chưa có tài xế nhận đơn hoặc tài xế chưa cập nhật vị trí.";
              }
            } catch {
              // Not authorized or network error
            }
          };

          await pollLive();

          if (!isTerminal) {
            liveTrackingTimer = setInterval(pollLive, 10000);
          }
        }
      } catch (err) {
        console.error("Failed to mount shipment detail map", err);
      }
    }
  }
  function bindViewButtons(scope = root) {
    scope.querySelectorAll("[data-view]").forEach(button => { if (!button.dataset.bound) { button.dataset.bound = "1"; button.addEventListener("click", () => nav(button.dataset.view)); } });
    scope.querySelectorAll("[data-action]").forEach(button => { if (!button.dataset.bound) { button.dataset.bound = "1"; button.addEventListener("click", () => handleAction(button)); } });
  }
  async function handleAction(button) {
    const action = button.dataset.action; const id = button.dataset.id;
    try {
      if (action === "details") { state.detail = id; state.view = "details"; await renderView(); }
      else if (action === "assign") {
        button.disabled = true;
        const result = await post(`/shipments/${id}/assign-driver`, {});
        if (result.assignment === null) {
          const reason = result.reason === "MAX_ATTEMPTS"
            ? "Đơn đã hết số lần tự động phân công. Vui lòng kiểm tra tài xế và xử lý thủ công."
            : "Không tìm thấy tài xế phù hợp. Hãy yêu cầu tài xế bật trạng thái sẵn sàng và cập nhật vị trí GPS mới.";
          showToast(reason, "error");
        } else {
          showToast(result.status === "PENDING" ? "Đã gửi yêu cầu phân công. Tài xế sẽ thấy đơn trong tối đa 15 giây." : "Đơn đã có yêu cầu phân công đang chờ tài xế.");
        }
        await renderView();
      }
      else if (action === "toggle-user") { button.disabled = true; await patch(`/admin/users/${id}/active`, { active: button.dataset.active === "true" }); showToast("Đã cập nhật trạng thái tài khoản."); await renderView(); }
      else if (action === "reload-users") await renderView();
      else if (action === "reload-shipments") await renderView();
      else if (action === "refresh-tasks") await renderView();
      else if (action === "respond-assignment") { button.disabled = true; await post(`/assignments/${id}/respond`, { action: button.dataset.response }); showToast(button.dataset.response === "ACCEPT" ? "Đã nhận đơn." : "Đã từ chối đơn."); await renderView(); }
      else if (action === "transition") { button.disabled = true; await post(`/shipments/${id}/transition`, { toStatus: button.dataset.status }); showToast("Đã cập nhật trạng thái đơn."); await renderView(); }
      else if (action === "driver-status") { await patch("/drivers/me/status", { status: button.dataset.status }); showToast(`Trạng thái: ${button.dataset.status === "AVAILABLE" ? "Sẵn sàng" : "Ngoại tuyến"}.`); await renderView(); }
      else if (action === "update-driver-location") {
        if (!navigator.geolocation) throw new Error("Trình duyệt này không hỗ trợ lấy vị trí GPS.");
        button.disabled = true;
        const position = await new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(resolve, reject, { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }));
        await patch("/drivers/me/location", { lat: position.coords.latitude, lng: position.coords.longitude });
        showToast("Đã cập nhật vị trí GPS. Bạn có thể nhận phân công mới.");
        await renderView();
      }
      else if (action === "support") showToast("Kiểm tra README và docs/USER_GUIDE.md để xem hướng dẫn sử dụng.", "success");
      else if (action === "retry") await renderView();
    } catch (error) { button.disabled = false; showToast(error.message, "error"); }
  }
  async function logout(remote = true) {
    stopLiveTracking();
    if (activeDriverTripController) {
      activeDriverTripController.destroy();
      activeDriverTripController = null;
    }
    if (activeSenderMapController) {
      activeSenderMapController.destroy();
      activeSenderMapController = null;
    }
    if (state.taskRefreshTimer) { clearInterval(state.taskRefreshTimer); state.taskRefreshTimer = null; }
    if (remote && state.refreshToken) { try { await post("/auth/logout", { refreshToken: state.refreshToken }); } catch { /* session cleanup is best-effort; local credentials are discarded regardless */ } }
    state.token = null; state.refreshToken = null; state.user = null; state.view = "dashboard"; state.detail = null; renderAuth("login", "Bạn đã đăng xuất an toàn.");
  }

  renderAuth("login");
})();
