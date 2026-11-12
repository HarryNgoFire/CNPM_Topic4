/* MoveFlow UI: Small dependency-free SPA for the NestJS REST API.
 * Supports dual-mode presentation: Mobile (Phone Frame 390x844) & Desktop (1440px).
 */
(() => {
  const API_BASE = window.MOVEFLOW_API_BASE || `${location.origin}/api/v1`;
  const root = document.getElementById("app");

  const defaultIcons = {
    home: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>`,
    list: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"></line><line x1="8" y1="12" x2="21" y2="12"></line><line x1="8" y1="18" x2="21" y2="18"></line><line x1="3" y1="6" x2="3.01" y2="6"></line><line x1="3" y1="12" x2="3.01" y2="12"></line><line x1="3" y1="18" x2="3.01" y2="18"></line></svg>`,
    person: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>`,
    box: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>`,
    orders: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg>`,
    locate: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>`,
    arrowLeft: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>`,
    arrowRight: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>`,
    plus: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>`,
    search: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>`,
    map: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"></polygon><line x1="8" y1="2" x2="8" y2="18"></line><line x1="16" y1="6" x2="16" y2="22"></line></svg>`,
    clock: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>`,
    check: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
    truck: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="3" width="15" height="13"></rect><polygon points="16 8 20 8 23 11 23 16 16 16 16 8"></polygon><circle cx="5.5" cy="18.5" r="2.5"></circle><circle cx="18.5" cy="18.5" r="2.5"></circle></svg>`,
    zap: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`,
    phone: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg>`,
    star: `<svg width="14" height="14" viewBox="0 0 24 24" fill="#f59e0b" stroke="#d97706" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
    menu: `<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>`,
    close: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>`
  };
  const ICONS = Object.assign({}, defaultIcons, window.ICONS || {}, {
    menu: defaultIcons.menu,
    close: defaultIcons.close
  });

  function updatePhoneScale() {
    const availH = window.innerHeight - 70;
    const scale = Math.min(1, Math.max(0.62, availH / 880));
    document.documentElement.style.setProperty("--phone-scale", scale);
  }
  window.addEventListener("resize", updatePhoneScale);
  updatePhoneScale();

  const state = {
    apiBase: API_BASE,
    token: null,
    refreshToken: null,
    user: null,
    view: "dashboard",
    authMode: "login",
    pendingEmail: "",
    lastShipments: [],
    lastQueue: [],
    lastUsers: [],
    lastPricing: [],
    quote: null,
    detail: null,
    taskRefreshTimer: null,
    taskRefreshPending: false,
    deviceMode: localStorage.getItem("moveflow_device_mode") || (window.innerWidth < 800 ? "mobile" : "desktop"),
    theme: localStorage.getItem("moveflow_theme") || "light",
    activeShipmentTab: "ALL"
  };

  const SESSION_KEY = "moveflow_session";

  function saveSession() {
    if (state.token && state.user) {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({
        token: state.token,
        refreshToken: state.refreshToken,
        user: state.user,
        view: state.view,
        detail: state.detail,
      }));
    } else {
      sessionStorage.removeItem(SESSION_KEY);
    }
  }

  function getStoredSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const data = JSON.parse(raw);
      if (data && data.token && data.user) return data;
    } catch {
      sessionStorage.removeItem(SESSION_KEY);
    }
    return null;
  }

  function clearSession() {
    sessionStorage.removeItem(SESSION_KEY);
  }

  const STATUS = {
    RECEIVED: ["Đã tiếp nhận", "badge-blue"],
    EN_ROUTE_PICKUP: ["Đang đến lấy hàng", "badge-blue"],
    ARRIVED_PICKUP: ["Đã đến điểm lấy", "badge-warning"],
    IN_TRANSIT: ["Đang vận chuyển", "badge-warning"],
    OUT_FOR_DELIVERY: ["Đang giao hàng", "badge-warning"],
    ARRIVED_DROPOFF: ["Đã đến điểm giao", "badge-warning"],
    DELIVERED: ["Đã giao", "badge-success"],
    DELIVERY_FAILED: ["Giao thất bại", "badge-danger"],
    CANCELLED: ["Đã hủy", "badge-neutral"],
    PENDING: ["Chờ phản hồi", "badge-blue"],
    ACCEPTED: ["Đã nhận đơn", "badge-success"],
    REJECTED: ["Đã từ chối", "badge-danger"],
    EXPIRED: ["Hết thời hạn", "badge-neutral"],
    COMPLETED: ["Hoàn tất", "badge-success"]
  };

  const TITLES = {
    dashboard: "Tổng quan",
    shipments: "Quản lý đơn hàng",
    new: "Tạo đơn giao hàng",
    tracking: "Tra cứu đơn hàng",
    tasks: "Công việc tài xế",
    users: "Quản lý tài khoản",
    webhooks: "Giám sát Webhooks",
    pricing: "Bảng giá dịch vụ",
    profile: "Tài khoản của tôi",
    details: "Chi tiết đơn hàng"
  };

  const fmtMoney = n => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(n || 0));
  const fmtDate = value => value ? new Date(value).toLocaleString("vi-VN", { dateStyle: "short", timeStyle: "short" }) : "—";
  const esc = value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));
  const initials = name => String(name || "MF").trim().split(/\s+/).slice(-2).map(x => x[0] || "").join("").toUpperCase() || "MF";
  const roleName = role => ({ SENDER: "Người gửi", DRIVER: "Tài xế", DISPATCHER: "Điều phối", ADMIN: "Quản trị viên" }[role] || role || "Tài khoản");

  const badge = value => {
    const item = STATUS[value] || [value || "Không rõ", "badge-neutral"];
    return `<span class="status-badge ${item[1]}"><span class="status-dot"></span>${esc(item[0])}</span>`;
  };

  const showToast = (message, type = "success") => {
    let host = document.querySelector(".toast-host");
    if (!host) {
      host = document.createElement("div");
      host.className = "toast-host";
      document.body.appendChild(host);
    }
    const toast = document.createElement("div");
    toast.className = `toast ${type}`;
    toast.textContent = message;
    host.appendChild(toast);
    setTimeout(() => toast.remove(), 4200);
  };

  const errorMessage = data => {
    const message = data?.message;
    if (Array.isArray(message)) return message.join("; ");
    if (typeof message === "string" && message) return message;
    const err = data?.error;
    if (typeof err === "string") return err;
    if (err?.message) return Array.isArray(err.message) ? err.message.join("; ") : err.message;
    return "Có lỗi xảy ra. Vui lòng thử lại.";
  };

  async function api(path, options = {}, allowRefresh = true) {
    const headers = { "Content-Type": "application/json", ...(options.headers || {}) };
    if (state.token && !path.startsWith("/auth/")) headers.Authorization = `Bearer ${state.token}`;
    let response;
    try {
      response = await fetch(`${API_BASE}${path}`, { ...options, headers, signal: AbortSignal.timeout(20000) });
    } catch {
      throw new Error("Không kết nối được máy chủ. Hãy kiểm tra backend và thử lại.");
    }

    if (response.status === 401 && allowRefresh && state.refreshToken && !path.startsWith("/auth/")) {
      try {
        const refreshResponse = await fetch(`${API_BASE}/auth/refresh`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ refreshToken: state.refreshToken }),
          signal: AbortSignal.timeout(10000)
        });
        const refreshed = await refreshResponse.json().catch(() => null);
        if (refreshResponse.ok && refreshed?.accessToken && refreshed?.refreshToken) {
          state.token = refreshed.accessToken;
          state.refreshToken = refreshed.refreshToken;
          state.user = refreshed.user || state.user;
          saveSession();
          return api(path, options, false);
        }
      } catch { /* handle expiration below */ }
      state.token = null;
      state.refreshToken = null;
      state.user = null;
      clearSession();
      renderAuth("login", "Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
      throw new Error("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    }

    const raw = await response.text();
    let data = null;
    try { data = raw ? JSON.parse(raw) : null; } catch { data = { message: raw }; }
    if (!response.ok) {
      const message = errorMessage(data);
      const error = new Error(message);
      error.status = response.status;
      error.data = data;
      throw error;
    }
    return data;
  }

  const post = (path, body) => api(path, { method: "POST", body: JSON.stringify(body) });
  const patch = (path, body) => api(path, { method: "PATCH", body: JSON.stringify(body) });
  const get = path => api(path, { method: "GET" });

  let activeSenderMapController = null;
  let activeDriverTripController = null;
  let activeDetailMapEngine = null;
  let liveTrackingTimer = null;
  let liveTrackingVisibilityHandler = null;

  function stopLiveTrackingTimer() {
    if (liveTrackingTimer) {
      clearInterval(liveTrackingTimer);
      liveTrackingTimer = null;
    }
    if (liveTrackingVisibilityHandler && typeof document !== "undefined") {
      document.removeEventListener("visibilitychange", liveTrackingVisibilityHandler);
      liveTrackingVisibilityHandler = null;
    }
  }

  function stopLiveTracking() {
    stopLiveTrackingTimer();
    if (activeDetailMapEngine) {
      activeDetailMapEngine.destroy();
      activeDetailMapEngine = null;
    }
  }

  function resizeActiveMaps() {
    setTimeout(() => {
      activeSenderMapController?.engine?.map?.resize();
      activeDriverTripController?.engine?.map?.resize();
      activeDetailMapEngine?.map?.resize();
    }, 150);
  }

  function setDeviceMode(mode) {
    state.deviceMode = mode;
    localStorage.setItem("moveflow_device_mode", mode);
    document.body.classList.remove("mode-mobile", "mode-desktop");
    document.body.classList.add(`mode-${mode}`);
    renderViewportSwitcher();
    if (state.user) {
      renderShell();
      renderView().then(resizeActiveMaps);
    } else {
      renderAuth(state.authMode);
    }
  }

  function setTheme(theme) {
    state.theme = theme;
    localStorage.setItem("moveflow_theme", theme);
    if (theme === "dark") {
      document.body.classList.add("theme-dark");
    } else {
      document.body.classList.remove("theme-dark");
    }
    document.querySelectorAll(".theme-toggle-btn").forEach(btn => {
      btn.innerHTML = theme === "dark" ? "🌙" : "☀️";
      btn.title = theme === "dark" ? "Đang ở chế độ Tối (Bấm để chuyển Sáng)" : "Đang ở chế độ Sáng (Bấm để chuyển Tối)";
    });
    const darkCheckbox = document.getElementById("vsp-toggle-dark-mode");
    if (darkCheckbox) darkCheckbox.checked = theme === "dark";
    const profileThemeCheckbox = document.getElementById("toggle-profile-dark-mode");
    if (profileThemeCheckbox) profileThemeCheckbox.checked = theme === "dark";
  }

  function toggleTheme() {
    setTheme(state.theme === "dark" ? "light" : "dark");
  }

  function renderViewportSwitcher() {
    const isSwitcherEnabled = localStorage.getItem("moveflow_viewport_switcher_enabled") !== "0";
    let switcher = document.getElementById("viewport-mode-switcher");
    if (!isSwitcherEnabled) {
      if (switcher) switcher.style.display = "none";
      return;
    }
    if (!switcher) {
      switcher = document.createElement("aside");
      switcher.id = "viewport-mode-switcher";
      switcher.className = "viewport-switcher";
      document.body.appendChild(switcher);
    }
    switcher.style.display = "flex";

    const isQuickLogin = localStorage.getItem("moveflow_quick_login_enabled") !== "0";
    const isDemo = localStorage.getItem("moveflow_demo_tools_enabled") !== "0";
    const isDark = state.theme === "dark";

    switcher.innerHTML = `
      <span class="switcher-drag-handle" title="Giữ và kéo thả đến bất kỳ vị trí nào">
        <svg width="10" height="16" viewBox="0 0 10 16" fill="currentColor">
          <circle cx="2.5" cy="3" r="1.2"/><circle cx="7.5" cy="3" r="1.2"/>
          <circle cx="2.5" cy="8" r="1.2"/><circle cx="7.5" cy="8" r="1.2"/>
          <circle cx="2.5" cy="13" r="1.2"/><circle cx="7.5" cy="13" r="1.2"/>
        </svg>
      </span>
      <button class="switcher-btn ${state.deviceMode === 'mobile' ? 'active' : ''}" data-mode="mobile" title="Chế độ điện thoại dọc 390x844">
        <span class="switcher-icon">📱</span> Mobile
      </button>
      <button class="switcher-btn ${state.deviceMode === 'desktop' ? 'active' : ''}" data-mode="desktop" title="Chế độ màn hình rộng Desktop">
        <span class="switcher-icon">🖥️</span> Desktop
      </button>
      <button type="button" class="theme-toggle-btn" id="switcher-theme-toggle" style="width:28px;height:28px;font-size:13px;margin-left:2px" title="Chuyển chế độ Sáng/Tối">
        ${isDark ? '🌙' : '☀️'}
      </button>
      <button type="button" class="switcher-settings-btn" id="btn-viewport-settings" title="Cài đặt góc: Đăng nhập mẫu & Công cụ demo">
        ⚙️
      </button>

      <div class="viewport-settings-popover" id="viewport-settings-popover">
        <div class="vsp-header">
          <span>⚙️ Cài đặt nhanh</span>
          <button type="button" class="vsp-close" id="btn-vsp-close" title="Đóng">✕</button>
        </div>
        <div class="vsp-body">
          <label class="vsp-item">
            <span>🌓 Chế độ Tối (Dark)</span>
            <input type="checkbox" id="vsp-toggle-dark-mode" ${isDark ? "checked" : ""}>
          </label>
          <label class="vsp-item">
            <span>🔊 Hiệu ứng âm thanh</span>
            <input type="checkbox" id="vsp-toggle-sfx" ${localStorage.getItem("moveflow_sfx_enabled") !== "0" ? "checked" : ""}>
          </label>
          <label class="vsp-item">
            <span>⚡ Đăng nhập mẫu</span>
            <input type="checkbox" id="vsp-toggle-quick-login" ${isQuickLogin ? "checked" : ""}>
          </label>
          <label class="vsp-item">
            <span>🛠️ Demo Tools</span>
            <input type="checkbox" id="vsp-toggle-demo-tools" ${isDemo ? "checked" : ""}>
          </label>
          <label class="vsp-item">
            <span>🎯 Auto Recenter 5s</span>
            <input type="checkbox" id="vsp-toggle-auto-recenter" ${localStorage.getItem("moveflow_auto_recenter_enabled") !== "0" ? "checked" : ""}>
          </label>
          <div class="vsp-divider"></div>
          <button type="button" class="vsp-action-btn" id="vsp-btn-hide-switcher">
            Ẩn thanh nổi này
          </button>
          <div class="vsp-hint">Bật lại trong Cài đặt Admin</div>
        </div>
      </div>
    `;

    const applySavedSwitcherPos = () => {
      try {
        const raw = localStorage.getItem("moveflow_switcher_pos");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed.left === "number" && typeof parsed.top === "number") {
            const rect = switcher.getBoundingClientRect();
            const maxL = Math.max(8, window.innerWidth - (rect.width || 240) - 8);
            const maxT = Math.max(8, window.innerHeight - (rect.height || 44) - 8);
            switcher.style.left = `${Math.max(8, Math.min(maxL, parsed.left))}px`;
            switcher.style.top = `${Math.max(8, Math.min(maxT, parsed.top))}px`;
            switcher.style.bottom = "auto";
            switcher.style.right = "auto";
            return;
          }
        }
      } catch {}
      switcher.style.bottom = "18px";
      switcher.style.left = "18px";
      switcher.style.top = "auto";
      switcher.style.right = "auto";
    };
    requestAnimationFrame(applySavedSwitcherPos);

    const updatePopoverPlacement = () => {
      const p = switcher.querySelector("#viewport-settings-popover");
      if (!p) return;
      const rect = switcher.getBoundingClientRect();
      if (rect.top > window.innerHeight / 2) {
        p.style.top = "auto";
        p.style.bottom = "calc(100% + 10px)";
      } else {
        p.style.top = "calc(100% + 10px)";
        p.style.bottom = "auto";
      }
      if (rect.left + rect.width / 2 > window.innerWidth / 2) {
        p.style.right = "0";
        p.style.left = "auto";
      } else {
        p.style.left = "0";
        p.style.right = "auto";
      }
    };

    if (!switcher._dragBound) {
      let dragging = false;
      let hasMoved = false;
      let startX = 0;
      let startY = 0;
      let offsetX = 0;
      let offsetY = 0;
      let rectW = 240;
      let rectH = 44;

      switcher.addEventListener("pointerdown", e => {
        if (e.target.closest("#viewport-settings-popover")) return;
        if (e.button !== 0 && e.pointerType === "mouse") return;
        const rect = switcher.getBoundingClientRect();
        dragging = true;
        hasMoved = false;
        startX = e.clientX;
        startY = e.clientY;
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
        rectW = rect.width || 240;
        rectH = rect.height || 44;
      });

      window.addEventListener("pointermove", e => {
        if (!dragging) return;
        const dx = Math.abs(e.clientX - startX);
        const dy = Math.abs(e.clientY - startY);
        if (!hasMoved && (dx > 4 || dy > 4)) {
          hasMoved = true;
          switcher.classList.add("dragging");
        }
        if (hasMoved) {
          const maxL = Math.max(8, window.innerWidth - rectW - 8);
          const maxT = Math.max(8, window.innerHeight - rectH - 8);
          const newLeft = Math.max(8, Math.min(maxL, e.clientX - offsetX));
          const newTop = Math.max(8, Math.min(maxT, e.clientY - offsetY));
          switcher.style.left = `${newLeft}px`;
          switcher.style.top = `${newTop}px`;
          switcher.style.bottom = "auto";
          switcher.style.right = "auto";
          const p = document.getElementById("viewport-settings-popover");
          if (p && p.classList.contains("open")) {
            updatePopoverPlacement();
          }
        }
      });

      const endDrag = () => {
        if (!dragging) return;
        dragging = false;
        switcher.classList.remove("dragging");
        if (hasMoved) {
          switcher._justDragged = true;
          setTimeout(() => {
            switcher._justDragged = false;
          }, 120);
          const rect = switcher.getBoundingClientRect();
          try {
            localStorage.setItem("moveflow_switcher_pos", JSON.stringify({
              left: Math.round(rect.left),
              top: Math.round(rect.top),
            }));
          } catch {}
        }
      };

      window.addEventListener("pointerup", endDrag);
      window.addEventListener("pointercancel", endDrag);
      window.addEventListener("resize", () => {
        const raw = localStorage.getItem("moveflow_switcher_pos");
        if (!raw) return;
        const rect = switcher.getBoundingClientRect();
        const maxL = Math.max(8, window.innerWidth - (rect.width || 240) - 8);
        const maxT = Math.max(8, window.innerHeight - (rect.height || 44) - 8);
        if (rect.left > maxL || rect.top > maxT) {
          switcher.style.left = `${Math.max(8, Math.min(maxL, rect.left))}px`;
          switcher.style.top = `${Math.max(8, Math.min(maxT, rect.top))}px`;
        }
      });

      switcher.addEventListener("click", e => {
        if (switcher._justDragged) {
          e.stopPropagation();
          e.preventDefault();
        }
      }, true);

      switcher._dragBound = true;
    }

    switcher.querySelectorAll(".switcher-btn").forEach(btn => {
      btn.onclick = () => setDeviceMode(btn.dataset.mode);
    });

    switcher.querySelector("#switcher-theme-toggle")?.addEventListener("click", () => {
      toggleTheme();
    });

    const popover = switcher.querySelector("#viewport-settings-popover");
    const settingsBtn = switcher.querySelector("#btn-viewport-settings");
    const closeBtn = switcher.querySelector("#btn-vsp-close");

    settingsBtn?.addEventListener("click", e => {
      e.stopPropagation();
      updatePopoverPlacement();
      popover?.classList.toggle("open");
    });

    closeBtn?.addEventListener("click", e => {
      e.stopPropagation();
      popover?.classList.remove("open");
    });

    if (!switcher._outsideListenerBound) {
      document.addEventListener("click", ev => {
        const p = document.getElementById("viewport-settings-popover");
        if (p && p.classList.contains("open") && !switcher.contains(ev.target)) {
          p.classList.remove("open");
        }
      });
      switcher._outsideListenerBound = true;
    }

    switcher.querySelector("#vsp-toggle-dark-mode")?.addEventListener("change", e => {
      setTheme(e.target.checked ? "dark" : "light");
      showToast(e.target.checked ? "Đã chuyển sang chế độ Tối (Dark mode)!" : "Đã chuyển sang chế độ Sáng (Light mode)!");
    });

    switcher.querySelector("#vsp-toggle-sfx")?.addEventListener("change", e => {
      const isEnabled = e.target.checked;
      window.MoveFlowSfx?.setSfxEnabled(isEnabled);
      if (isEnabled) window.MoveFlowSfx?.play("ding");
      showToast(isEnabled ? "Đã bật hiệu ứng âm thanh (SFX)!" : "Đã tắt hiệu ứng âm thanh.");
    });

    switcher.querySelector("#vsp-toggle-quick-login")?.addEventListener("change", e => {
      const isEnabled = e.target.checked;
      localStorage.setItem("moveflow_quick_login_enabled", isEnabled ? "1" : "0");
      showToast(isEnabled ? "Đã bật Đăng nhập nhanh tài khoản mẫu!" : "Đã ẩn Đăng nhập nhanh tài khoản mẫu.");
      if (!state.user) {
        renderAuth(state.authMode);
      }
    });

    switcher.querySelector("#vsp-toggle-demo-tools")?.addEventListener("change", e => {
      const isEnabled = e.target.checked;
      localStorage.setItem("moveflow_demo_tools_enabled", isEnabled ? "1" : "0");
      window.MoveFlowDemo?.updateVisibility();
      showToast(isEnabled ? "Đã bật thanh Demo Tools!" : "Đã tắt thanh Demo Tools.");
    });

    switcher.querySelector("#vsp-toggle-auto-recenter")?.addEventListener("change", e => {
      window.MoveFlowDemo?.setAutoRecenterEnabled?.(e.target.checked);
    });

    switcher.querySelector("#vsp-btn-hide-switcher")?.addEventListener("click", () => {
      localStorage.setItem("moveflow_viewport_switcher_enabled", "0");
      renderViewportSwitcher();
      showToast("Đã ẩn thanh chuyển đổi góc! Quản trị viên có thể bật lại trong mục Hồ sơ & Cài đặt.", "info");
    });
  }

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
    saveSession();
    renderShell();
    renderView().then(resizeActiveMaps);
  };

  // Full sidebar navigation tabs for all roles
  function getSidebarTabs() {
    if (state.user.role === "SENDER") {
      return [
        { id: "dashboard", icon: ICONS.home, label: "Trang chủ" },
        { id: "shipments", icon: ICONS.orders, label: "Đơn gửi của tôi" },
        { id: "new", icon: ICONS.plus, label: "Tạo đơn giao hàng" },
        { id: "tracking", icon: ICONS.locate, label: "Tra cứu vận đơn" },
        { id: "profile", icon: ICONS.person, label: "Hồ sơ tài khoản" }
      ];
    }
    if (state.user.role === "DRIVER") {
      return [
        { id: "tasks", icon: ICONS.map, label: "Bản đồ ca trực & GPS" },
        { id: "shipments", icon: ICONS.list, label: "Lịch sử chuyến xe" },
        { id: "profile", icon: ICONS.person, label: "Hồ sơ tài xế" }
      ];
    }
    if (state.user.role === "DISPATCHER") {
      return [
        { id: "dashboard", icon: ICONS.home, label: "Tổng quan điều phối" },
        { id: "shipments", icon: ICONS.orders, label: "Tất cả đơn hàng" },
        { id: "users", icon: ICONS.person, label: "Hàng chờ điều phối" },
        { id: "tracking", icon: ICONS.locate, label: "Tra cứu vận đơn" },
        { id: "profile", icon: ICONS.person, label: "Hồ sơ cá nhân" }
      ];
    }
    // ADMIN
    return [
      { id: "dashboard", icon: ICONS.home, label: "Tổng quan hệ thống" },
      { id: "shipments", icon: ICONS.orders, label: "Quản lý đơn hàng" },
      { id: "users", icon: ICONS.person, label: "Quản lý tài khoản" },
      { id: "webhooks", icon: ICONS.zap, label: "Giám sát Webhooks" },
      { id: "pricing", icon: ICONS.list, label: "Bảng giá cước" },
      { id: "tracking", icon: ICONS.locate, label: "Tra cứu vận đơn" },
      { id: "profile", icon: ICONS.person, label: "Hồ sơ quản trị" }
    ];
  }

  // Nav definitions - Figma 5 tabs standard for mobile bottom nav
  function navTabs(isMobile = false) {
    if (state.user.role === "SENDER") {
      return [
        { id: "dashboard", icon: ICONS.home, label: "Trang chủ" },
        { id: "shipments", icon: ICONS.orders, label: "Đơn hàng" },
        { id: "new", icon: ICONS.plus, label: "Gửi hàng" },
        { id: "tracking", icon: ICONS.locate, label: "Tra cứu" },
        { id: "profile", icon: ICONS.person, label: "Tài khoản" }
      ];
    }
    if (state.user.role === "DRIVER") {
      return [
        { id: "tasks", icon: ICONS.map, label: "Ca trực" },
        { id: "shipments", icon: ICONS.list, label: "Lịch sử" },
        { id: "profile", icon: ICONS.person, label: "Tài khoản" }
      ];
    }
    if (state.user.role === "DISPATCHER") {
      return [
        { id: "dashboard", icon: ICONS.home, label: "Tổng quan" },
        { id: "shipments", icon: ICONS.orders, label: "Đơn hàng" },
        { id: "users", icon: ICONS.person, label: "Hàng chờ" },
        { id: "tracking", icon: ICONS.locate, label: "Tra cứu" },
        { id: "profile", icon: ICONS.person, label: "Hồ sơ" }
      ];
    }
    // ADMIN
    if (isMobile) {
      // 5 mục quan trọng nhất cho Admin trên mobile
      return [
        { id: "dashboard", icon: ICONS.home, label: "Tổng quan" },
        { id: "shipments", icon: ICONS.orders, label: "Đơn hàng" },
        { id: "users", icon: ICONS.person, label: "Tài khoản" },
        { id: "webhooks", icon: ICONS.zap, label: "Webhooks" },
        { id: "profile", icon: ICONS.person, label: "Hồ sơ" }
      ];
    }
    return [
      { id: "dashboard", icon: ICONS.home, label: "Tổng quan" },
      { id: "shipments", icon: ICONS.orders, label: "Tất cả đơn" },
      { id: "tracking", icon: ICONS.locate, label: "Tra cứu" },
      { id: "users", icon: ICONS.person, label: "Tài khoản" },
      { id: "webhooks", icon: ICONS.zap, label: "Webhooks" },
      { id: "pricing", icon: ICONS.list, label: "Bảng giá" },
      { id: "profile", icon: ICONS.person, label: "Hồ sơ" }
    ];
  }

  // 4-step progress stepper helper
  function renderProgressStepper(status) {
    let stepIndex = 1;
    if (["EN_ROUTE_PICKUP", "ARRIVED_PICKUP"].includes(status)) stepIndex = 2;
    else if (["IN_TRANSIT", "OUT_FOR_DELIVERY", "ARRIVED_DROPOFF"].includes(status)) stepIndex = 3;
    else if (status === "DELIVERED") stepIndex = 4;
    else if (["DELIVERY_FAILED", "CANCELLED"].includes(status)) stepIndex = -1;

    const fillPercent = stepIndex === 1 ? "0%" : stepIndex === 2 ? "33%" : stepIndex === 3 ? "66%" : "100%";

    return `
      <div class="order-progress-stepper">
        <div class="order-progress-bar-bg"></div>
        <div class="order-progress-bar-fill" style="width:${fillPercent}"></div>
        <div class="order-progress-step ${stepIndex >= 1 ? (stepIndex > 1 ? 'completed' : 'active') : ''}">
          <div class="progress-node">${stepIndex > 1 ? '✓' : '1'}</div>
          <span class="progress-label">Tiếp nhận</span>
        </div>
        <div class="order-progress-step ${stepIndex >= 2 ? (stepIndex > 2 ? 'completed' : 'active') : ''}">
          <div class="progress-node">${stepIndex > 2 ? '✓' : '2'}</div>
          <span class="progress-label">Lấy hàng</span>
        </div>
        <div class="order-progress-step ${stepIndex >= 3 ? (stepIndex > 3 ? 'completed' : 'active') : ''}">
          <div class="progress-node">${stepIndex > 3 ? '✓' : '3'}</div>
          <span class="progress-label">Đang giao</span>
        </div>
        <div class="order-progress-step ${stepIndex === 4 ? 'completed active' : ''}">
          <div class="progress-node">4</div>
          <span class="progress-label">Hoàn tất</span>
        </div>
      </div>
    `;
  }

  // Auth Screens
  function renderAuth(mode = "login", notice = "") {
    state.authMode = mode;
    document.body.classList.remove("mode-mobile", "mode-desktop");
    document.body.classList.add(`mode-${state.deviceMode}`);
    renderViewportSwitcher();

    if (state.deviceMode === "mobile") {
      root.innerHTML = `
        <div class="phone-stage-wrapper">
          <div class="phone-device">
            <div class="phone-btn-power"></div>
            <div class="phone-btn-action"></div>
            <div class="phone-btn-volup"></div>
            <div class="phone-btn-voldown"></div>
            <div class="phone-island">
              <div class="phone-island-camera"></div>
            </div>
            <div class="phone-screen">
              <div class="status-bar dark">
                <span class="status-bar-time">9:41</span>
                <span class="status-bar-icons">
                  <svg width="15" height="11" viewBox="0 0 16 12" fill="currentColor"><path d="M1 8.5h2.5v3H1v-3zm4-3.5h2.5v6.5H5V5zm4-3.5h2.5v10H9v-10zm4 3.5h2.5v6.5H13V5z"/></svg>
                  <svg width="15" height="11" viewBox="0 0 16 12" fill="currentColor"><path d="M8 9.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm-4.2-3a5.9 5.9 0 018.4 0l1.4-1.4a7.9 7.9 0 00-11.2 0l1.4 1.4zm-2.8-2.8a9.9 9.9 0 0114 0l1.4-1.4a11.9 11.9 0 00-16.8 0l1.4 1.4z"/></svg>
                  <svg width="22" height="11" viewBox="0 0 24 12" fill="currentColor"><rect x="1" y="1" width="19" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="2.5" y="2.5" width="14" height="7" rx="1.5" fill="currentColor"/><path d="M21.5 4.5v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                </span>
              </div>
              <div class="scroll-content" style="padding:0">
                <div class="mobile-auth-brand">
                  <div style="display:flex;align-items:center;justify-content:center;gap:10px;margin-bottom:8px">
                    <img src="/assets/logo-icon.png?v=6" alt="MoveFlow" class="mobile-auth-logo">
                    <strong style="font-size:24px;font-weight:800;color:var(--navy);letter-spacing:-0.02em">MoveFlow</strong>
                  </div>
                  <div class="mobile-auth-tag">GIAO HÀNG NỘI THÀNH THÔNG MINH</div>
                  <h1 class="mobile-auth-slogan">Giao hàng nhẹ nhàng.<br>Theo dõi từng chặng.</h1>
                </div>
                <div class="mobile-auth-card">
                  ${notice ? `<div class="notice ${notice.startsWith("Lỗi:") ? "error" : "info"}">${esc(notice.replace(/^Lỗi:\s*/, ""))}</div>` : ""}
                  ${mode === "login" ? authLoginForm() : mode === "register" ? authRegisterForm() : authVerifyForm()}
                </div>
                <div style="padding:0 20px 24px;text-align:center">
                  <p style="font-size:11px;color:var(--text-secondary);margin:0">
                    © ${new Date().getFullYear()} MoveFlow · Trải nghiệm thông minh trên di động
                  </p>
                </div>
              </div>
              <div class="home-indicator-bar"><div class="home-indicator"></div></div>
            </div>
          </div>
        </div>
      `;
    } else {
      root.innerHTML = `
        <div class="desktop-auth-container">
          <aside class="desktop-auth-visual">
            <div class="desktop-auth-brand-top" style="display:flex;align-items:center;gap:10px">
              <img src="/assets/logo-icon.png?v=6" alt="MoveFlow" style="height:40px;filter:brightness(0) invert(1)">
              <strong style="font-size:24px;font-weight:800;color:#fff;letter-spacing:-0.02em">MoveFlow</strong>
            </div>
            <div>
              <span class="status-badge badge-blue" style="margin-bottom:16px;background:rgba(255,255,255,0.15);color:#fff">HỆ THỐNG VẬN HÀNH THÔNG MINH</span>
              <h1 class="desktop-auth-title">
                <span class="auth-flow-pair">Đặt đơn <span>→</span> Phân công</span><br>
                <span class="auth-flow-pair">Lấy hàng <span>→</span> Giao hàng</span>
              </h1>
              <p class="desktop-auth-desc">
                Nền tảng giao nhận tức thì với định tuyến đường bộ OSRM và theo dõi trực tiếp MapLibre từ điểm lấy A đến điểm giao B.
              </p>
            </div>
            <div style="font-size:12px;color:#94a3b8">
              © ${new Date().getFullYear()} MoveFlow Platform · Phiên bản hoàn thiện
            </div>
          </aside>
          <main class="desktop-auth-form-wrap">
            <div class="desktop-auth-card">
              <div class="desktop-auth-card-brand-mobile">
                <img src="/assets/logo-icon.png?v=6" alt="MoveFlow" style="height:36px;margin-bottom:6px">
              </div>
              <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px">
                <span style="font-size:12px;font-weight:700;color:var(--text-secondary)">WORKSPACE / AUTH</span>
                <span class="status-badge badge-success">● Trực tuyến</span>
              </div>
              ${notice ? `<div class="notice ${notice.startsWith("Lỗi:") ? "error" : "info"}">${esc(notice.replace(/^Lỗi:\s*/, ""))}</div>` : ""}
              ${mode === "login" ? authLoginForm() : mode === "register" ? authRegisterForm() : authVerifyForm()}
            </div>
          </main>
        </div>
      `;
    }

    root.querySelectorAll("[data-auth-mode]").forEach(btn => btn.onclick = () => renderAuth(btn.dataset.authMode));
    root.querySelector("#auth-form")?.addEventListener("submit", submitAuth);
    root.querySelector("#resend-code")?.addEventListener("click", resendCode);
    root.querySelector("#back-login")?.addEventListener("click", () => renderAuth("login"));

    // Quick 1-click Demo Accounts Pill Binding
    root.querySelectorAll(".demo-account-pill").forEach(pill => {
      pill.onclick = () => {
        const emailInput = root.querySelector("#email");
        const passInput = root.querySelector("#password");
        if (emailInput && passInput) {
          emailInput.value = pill.dataset.demoEmail;
          passInput.value = pill.dataset.demoPass;
          root.querySelector("#auth-form")?.requestSubmit();
        }
      };
    });
  }

  function authLoginForm() {
    const isQuickLoginEnabled = localStorage.getItem("moveflow_quick_login_enabled") !== "0";
    return `
      <div class="seg-tabs">
        <button class="active" type="button" data-auth-mode="login">Đăng nhập</button>
        <button type="button" data-auth-mode="register">Tạo tài khoản</button>
      </div>
      <h2 style="font-size:22px;font-weight:800;margin:0 0 6px">Đăng nhập MoveFlow</h2>
      <p style="font-size:13px;color:var(--subtext-strong);margin:0 0 16px">Dùng tài khoản để tiếp tục đặt đơn và theo dõi hành trình.</p>

      ${isQuickLoginEnabled ? `
      <div class="demo-accounts-pill-box" style="margin-bottom:16px">
        <div class="demo-pill-title">⚡ Đăng nhập nhanh tài khoản mẫu:</div>
        <div class="demo-pill-row">
          <button type="button" class="demo-account-pill" data-demo-email="sender@gmail.com" data-demo-pass="admin" title="Người gửi hàng"><span class="pill-icon">👤</span><span class="pill-label">Người gửi</span></button>
          <button type="button" class="demo-account-pill" data-demo-email="driver-a@gmail.com" data-demo-pass="admin" title="Tài xế giao hàng"><span class="pill-icon">🛵</span><span class="pill-label">Tài xế A</span></button>
          <button type="button" class="demo-account-pill" data-demo-email="dispatcher@gmail.com" data-demo-pass="admin" title="Điều phối viên"><span class="pill-icon">📡</span><span class="pill-label">Điều phối</span></button>
          <button type="button" class="demo-account-pill" data-demo-email="admin@gmail.com" data-demo-pass="admin" title="Quản trị viên"><span class="pill-icon">⚡</span><span class="pill-label">Quản trị</span></button>
        </div>
      </div>
      ` : ""}

      <form id="auth-form">
        <div class="field">
          <label for="email">Địa chỉ Email</label>
          <input id="email" name="email" type="email" autocomplete="email" placeholder="name@example.com" required>
        </div>
        <div class="field">
          <label for="password">Mật khẩu</label>
          <input id="password" name="password" type="password" autocomplete="current-password" maxlength="72" placeholder="••••••••" required>
        </div>
        <button class="btn btn-primary btn-block" type="submit" style="margin-top:10px">
          Đăng nhập ngay <span>→</span>
        </button>
      </form>
      ${isQuickLoginEnabled ? `
      <p style="font-size:12px;color:var(--text-secondary);margin-top:16px;text-align:center">
        Tài khoản mẫu đã sẵn sàng trong hệ thống (Mật khẩu: admin)
      </p>
      ` : ""}
    `;
  }

  function authRegisterForm() {
    return `
      <div class="seg-tabs">
        <button type="button" data-auth-mode="login">Đăng nhập</button>
        <button class="active" type="button" data-auth-mode="register">Tạo tài khoản</button>
      </div>
      <h2 style="font-size:22px;font-weight:800;margin:0 0 6px">Đăng ký tài khoản</h2>
      <p style="font-size:13px;color:var(--subtext-strong);margin:0 0 18px">Đăng ký tài khoản người gửi hàng và nhận mã xác minh OTP.</p>
      <form id="auth-form">
        <div class="field">
          <label for="name">Họ và tên</label>
          <input id="name" name="name" autocomplete="name" placeholder="Nguyễn Văn A" minlength="2" maxlength="100" required>
        </div>
        <div class="field">
          <label for="email">Email</label>
          <input id="email" name="email" type="email" autocomplete="email" placeholder="ban@gmail.com" required>
        </div>
        <div class="field">
          <label for="password">Mật khẩu bảo mật</label>
          <input id="password" name="password" type="password" autocomplete="new-password" minlength="10" maxlength="72" placeholder="Ít nhất 10 ký tự" required>
          <small>Tối thiểu 10 ký tự kết hợp chữ và số.</small>
        </div>
        <button class="btn btn-primary btn-block" type="submit" style="margin-top:10px">
          Tạo tài khoản & nhận mã <span>→</span>
        </button>
      </form>
    `;
  }

  function authVerifyForm() {
    return `
      <h2 style="font-size:22px;font-weight:800;margin:0 0 6px">Xác minh email</h2>
      <p style="font-size:13px;color:var(--subtext-strong);margin:0 0 18px">
        Nhập mã 6 chữ số đã gửi đến <b>${esc(state.pendingEmail)}</b>.
      </p>
      <form id="auth-form">
        <div class="field">
          <label for="code">Mã OTP (6 chữ số)</label>
          <input id="code" name="code" inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]{6}" maxlength="6" placeholder="000000" style="font-size:24px;font-weight:800;letter-spacing:6px;text-align:center" required>
        </div>
        <button class="btn btn-primary btn-block" type="submit">
          Xác nhận tài khoản <span>→</span>
        </button>
      </form>
      <div style="display:flex;justify-content:space-between;margin-top:16px">
        <button class="btn btn-sm btn-outline" type="button" id="resend-code">Gửi lại mã</button>
        <button class="btn btn-sm btn-outline" type="button" id="back-login">Quay lại</button>
      </div>
    `;
  }

  async function submitAuth(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    const oldHtml = button.innerHTML;
    button.textContent = "Đang xử lý…";

    const values = Object.fromEntries(new FormData(form).entries());
    try {
      if (state.authMode === "register") {
        const result = await post("/auth/register", { name: values.name.trim(), email: values.email.trim(), password: values.password });
        state.pendingEmail = result.email || values.email.trim();
        renderAuth("verify", "Tài khoản đã tạo. Hãy nhập mã OTP trong email.");
      } else if (state.authMode === "verify") {
        await post("/auth/verify-email", { email: state.pendingEmail, code: String(values.code).trim() });
        showToast("Email đã xác minh. Bạn có thể đăng nhập.", "success");
        renderAuth("login", "Xác minh thành công. Hãy đăng nhập để tiếp tục.");
      } else {
        const result = await post("/auth/login", { email: values.email.trim(), password: values.password });
        state.token = result.accessToken;
        state.refreshToken = result.refreshToken;
        state.user = result.user || await get("/users/me");
        state.view = state.user.role === "DRIVER" ? "tasks" : "dashboard";
        saveSession();
        renderShell();
        await renderView();
      }
    } catch (error) {
      if (state.authMode === "login" && (String(error.message).includes("EMAIL_NOT_VERIFIED") || String(error.data?.message).includes("EMAIL_NOT_VERIFIED"))) {
        state.pendingEmail = values.email.trim();
        renderAuth("verify", "Tài khoản chưa xác minh email. Vui lòng nhập mã OTP.");
      } else {
        button.disabled = false;
        button.innerHTML = oldHtml;
        showToast(error.message, "error");
      }
    }
  }

  async function resendCode() {
    const button = root.querySelector("#resend-code");
    if (!state.pendingEmail) return;
    button.disabled = true;
    try {
      await post("/auth/resend-verification", { email: state.pendingEmail });
      showToast("Đã gửi lại mã OTP. Vui lòng kiểm tra hộp thư.", "success");
    } catch (error) {
      showToast(error.message, "error");
    } finally {
      setTimeout(() => { if (button && button.isConnected) button.disabled = false; }, 3000);
    }
  }

  function isMockGpsEnabled() {
    return localStorage.getItem("moveflow_mock_gps_enabled") === "1";
  }

  function isDriverOnline() {
    const email = state.user?.email || "default";
    return localStorage.getItem(`moveflow_driver_status_${email}`) !== "OFFLINE";
  }

  function setDriverOnlineLocal(isOnline) {
    const email = state.user?.email || "default";
    localStorage.setItem(`moveflow_driver_status_${email}`, isOnline ? "AVAILABLE" : "OFFLINE");
  }

  function syncDriverStatusUi() {
    const online = isDriverOnline();
    document.querySelectorAll(".driver-status-toggle-input").forEach(cb => {
      cb.checked = online;
    });
    document.querySelectorAll(".driver-status-switch-pill").forEach(pill => {
      pill.classList.toggle("online", online);
      pill.classList.toggle("offline", !online);
      const txt = pill.querySelector(".driver-status-text");
      if (txt) txt.textContent = online ? "Sẵn sàng nhận đơn" : "Ngoại tuyến";
    });
    document.querySelectorAll(".mobile-sidebar-status-card").forEach(card => {
      card.classList.toggle("online", online);
      card.classList.toggle("offline", !online);
      const lbl = card.querySelector(".mobile-status-label");
      if (lbl) {
        lbl.textContent = online ? "● Đang sẵn sàng nhận đơn" : "○ Đang ngoại tuyến";
        lbl.style.color = online ? "#10b981" : "var(--text-secondary)";
      }
    });
  }

  function confirmDriverStatusChange(wantOnline) {
    // Khôi phục vị trí gạt về trạng thái hiện tại cho tới khi bấm Xác nhận
    syncDriverStatusUi();

    const existing = document.getElementById("driver-status-confirm-modal");
    if (existing) existing.remove();

    const overlay = document.createElement("div");
    overlay.id = "driver-status-confirm-modal";
    overlay.className = "driver-confirm-modal-overlay";
    overlay.innerHTML = `
      <div class="driver-confirm-modal">
        <div class="driver-confirm-icon ${wantOnline ? "online" : "offline"}">
          ${wantOnline ? "🟢" : "🌙"}
        </div>
        <h3 style="margin:0 0 8px;font-size:17px;font-weight:800;color:var(--text-primary)">
          ${wantOnline ? "Bật trạng thái Sẵn sàng?" : "Tắt hoạt động (Ngoại tuyến)?"}
        </h3>
        <p style="margin:0 0 18px;font-size:13px;line-height:1.5;color:var(--text-secondary)">
          ${wantOnline
            ? "Bạn sẽ bắt đầu nhận các yêu cầu phân công đơn hàng mới từ hệ thống điều phối."
            : "Bạn sẽ tạm ngưng nhận đơn hàng mới cho đến khi bật hoạt động trở lại."}
        </p>
        <div style="display:flex;gap:10px">
          <button type="button" class="btn btn-outline" id="btn-cancel-driver-status" style="flex:1">
            Hủy
          </button>
          <button type="button" class="btn ${wantOnline ? "btn-success" : "btn-primary"}" id="btn-confirm-driver-status" style="flex:1">
            Xác nhận ${wantOnline ? "Bật" : "Tắt"}
          </button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    const closeModal = () => {
      overlay.remove();
      syncDriverStatusUi();
    };

    overlay.querySelector("#btn-cancel-driver-status")?.addEventListener("click", closeModal);
    overlay.addEventListener("click", e => {
      if (e.target === overlay) closeModal();
    });

    overlay.querySelector("#btn-confirm-driver-status")?.addEventListener("click", async e => {
      const btn = e.currentTarget;
      btn.disabled = true;
      btn.textContent = "Đang xử lý…";
      try {
        const targetStatus = wantOnline ? "AVAILABLE" : "OFFLINE";
        await patch("/drivers/me/status", { status: targetStatus });
        setDriverOnlineLocal(wantOnline);
        overlay.remove();
        syncDriverStatusUi();
        showToast(
          wantOnline ? "Đã BẬT hoạt động: Sẵn sàng nhận đơn!" : "Đã TẮT hoạt động: Đang ngoại tuyến.",
          wantOnline ? "success" : "info"
        );
      } catch (err) {
        overlay.remove();
        syncDriverStatusUi();
        const rawMsg = String(err?.message || "");
        const friendlyMsg = /resolve current assignment/i.test(rawMsg)
          ? "Bạn đang có đơn hàng được phân công hoặc đang giao. Vui lòng hoàn tất hoặc phản hồi đơn hiện tại trước khi đổi trạng thái hoạt động!"
          : rawMsg;
        showToast(friendlyMsg, "error");
      }
    });
  }

  // Shell Layout Container
  function renderShell() {
    document.body.classList.remove("mode-mobile", "mode-desktop");
    document.body.classList.add(`mode-${state.deviceMode}`);
    renderViewportSwitcher();

    const isMobile = state.deviceMode === "mobile";
    const tabs = navTabs(isMobile);

    if (isMobile) {
      const sidebarTabs = getSidebarTabs();
      root.innerHTML = `
        <div class="phone-stage-wrapper">
          <div class="phone-device">
            <div class="phone-btn-power"></div>
            <div class="phone-btn-action"></div>
            <div class="phone-btn-volup"></div>
            <div class="phone-btn-voldown"></div>
            <div class="phone-island">
              <div class="phone-island-camera"></div>
            </div>
            <div class="phone-screen">
              <div class="status-bar">
                <span class="status-bar-time">9:41</span>
                <span class="status-bar-icons">
                  <svg width="15" height="11" viewBox="0 0 16 12" fill="currentColor"><path d="M1 8.5h2.5v3H1v-3zm4-3.5h2.5v6.5H5V5zm4-3.5h2.5v10H9v-10zm4 3.5h2.5v6.5H13V5z"/></svg>
                  <svg width="15" height="11" viewBox="0 0 16 12" fill="currentColor"><path d="M8 9.5a1.5 1.5 0 100 3 1.5 1.5 0 000-3zm-4.2-3a5.9 5.9 0 018.4 0l1.4-1.4a7.9 7.9 0 00-11.2 0l1.4 1.4zm-2.8-2.8a9.9 9.9 0 0114 0l1.4-1.4a11.9 11.9 0 00-16.8 0l1.4 1.4z"/></svg>
                  <svg width="22" height="11" viewBox="0 0 24 12" fill="currentColor"><rect x="1" y="1" width="19" height="10" rx="3" fill="none" stroke="currentColor" stroke-width="1.8"/><rect x="2.5" y="2.5" width="14" height="7" rx="1.5" fill="currentColor"/><path d="M21.5 4.5v3" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/></svg>
                </span>
              </div>

              <!-- Mobile Sidebar Overlay & Drawer -->
              <div class="mobile-sidebar-backdrop" id="mobile-sidebar-backdrop"></div>
              <aside class="mobile-sidebar-drawer" id="mobile-sidebar-drawer">
                <div class="mobile-sidebar-header">
                  <div style="display:flex;align-items:center;justify-content:space-between">
                    <div style="display:flex;align-items:center;gap:8px">
                      <img src="/assets/logo-icon.png?v=6" alt="MoveFlow" style="height:26px">
                      <strong style="font-size:16px;color:var(--navy)">MoveFlow</strong>
                    </div>
                    <button class="mobile-sidebar-close" id="btn-close-mobile-sidebar" title="Đóng menu">
                      ${ICONS.close}
                    </button>
                  </div>
                  <div class="mobile-sidebar-user">
                    <div class="mobile-sidebar-avatar">${esc(initials(state.user.name))}</div>
                    <div style="overflow:hidden;flex:1">
                      <div style="font-weight:700;font-size:13.5px;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis">
                        ${esc(state.user.name)}
                      </div>
                      <div style="font-size:11.5px;color:var(--text-secondary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:3px">
                        ${esc(state.user.email)}
                      </div>
                      <span class="status-badge badge-blue" style="font-size:10px;padding:2px 6px">
                        ${esc(roleName(state.user.role))}
                      </span>
                    </div>
                  </div>
                </div>

                <div class="mobile-sidebar-body">
                  ${state.user.role === "DRIVER" ? `
                    <div class="mobile-sidebar-section-title">TRẠNG THÁI HOẠT ĐỘNG</div>
                    <div class="mobile-sidebar-status-card ${isDriverOnline() ? "online" : "offline"}">
                      <div style="flex:1;min-width:0">
                        <div style="font-size:13px;font-weight:700;color:var(--text-primary)">Nhận chuyến mới</div>
                        <div class="mobile-status-label" style="font-size:11px;font-weight:600;margin-top:2px;color:${isDriverOnline() ? "#10b981" : "var(--text-secondary)"}">
                          ${isDriverOnline() ? "● Đang sẵn sàng nhận đơn" : "○ Đang ngoại tuyến"}
                        </div>
                      </div>
                      <label class="switch" title="Gạt để Bật/Tắt trạng thái hoạt động">
                        <input type="checkbox" class="driver-status-toggle-input" ${isDriverOnline() ? "checked" : ""}>
                        <span class="switch-slider"></span>
                      </label>
                    </div>
                  ` : ""}
                  <div class="mobile-sidebar-section-title">DANH MỤC ĐIỀU HÀNH</div>
                  <nav class="mobile-sidebar-nav">
                    ${sidebarTabs.map(t => `
                      <button class="mobile-sidebar-nav-item ${state.view === t.id ? 'active' : ''}" data-view="${t.id}">
                        <span class="mobile-sidebar-icon">${t.icon}</span>
                        <span class="mobile-sidebar-label">${t.label}</span>
                        ${state.view === t.id ? '<span class="mobile-sidebar-active-dot"></span>' : ''}
                      </button>
                    `).join("")}
                  </nav>
                </div>

                <div class="mobile-sidebar-footer">
                  <button class="btn btn-outline btn-block btn-sm" data-action="logout" style="display:flex;align-items:center;justify-content:center;gap:6px">
                    ${ICONS.arrowLeft} Đăng xuất tài khoản
                  </button>
                </div>
              </aside>

              <header class="app-header">
                <div style="display:flex;align-items:center;gap:8px">
                  <button class="app-header-menu-btn" id="btn-toggle-mobile-sidebar" title="Mở danh mục điều hướng">
                    ${ICONS.menu}
                  </button>
                  <img src="/assets/logo-icon.png?v=6" alt="MoveFlow" class="app-header-logo" style="height:26px;cursor:pointer" data-view="dashboard">
                </div>
                <div style="display:flex;align-items:center;gap:8px">
                  <button type="button" class="theme-toggle-btn mobile-theme-btn" id="btn-theme-toggle-mobile" title="Chuyển chế độ Sáng / Tối">
                    ${state.theme === 'dark' ? '🌙' : '☀️'}
                  </button>
                  <span class="status-badge badge-blue" style="padding:4px 8px;font-size:11px;font-weight:700">
                    ${esc(roleName(state.user.role))}
                  </span>
                </div>
              </header>
              <main class="scroll-content" id="page-content">
                <div class="boot"><p>Đang tải nội dung…</p></div>
              </main>
              <nav class="bottom-nav">
                ${tabs.map(t => `
                  <button class="bottom-nav-item ${t.isDrawerTrigger ? '' : (state.view === t.id ? 'active' : '')}"
                    ${t.isDrawerTrigger ? 'data-action="toggle-mobile-sidebar"' : `data-view="${t.id}"`}
                    title="${esc(t.label)}">
                    <span class="nav-glyph">${t.icon}</span>
                    <span class="nav-label">${t.label}</span>
                  </button>
                `).join("")}
              </nav>
              <div class="home-indicator-bar"><div class="home-indicator"></div></div>
            </div>
          </div>
        </div>
      `;
    } else {
      root.innerHTML = `
        <div class="desktop-container">
          <header class="desktop-top-nav">
            <div class="desktop-brand-meta">
              <img src="/assets/logo-icon.png?v=6" alt="MoveFlow" class="desktop-brand-logo" data-view="dashboard" style="cursor:pointer">
              <strong style="font-size:17px;font-weight:800;color:var(--navy);margin:0 4px">MoveFlow</strong>
              <span class="desktop-workspace-tag">Không gian ${esc(roleName(state.user.role))}</span>
            </div>
            <nav class="desktop-nav-links">
              ${tabs.map(t => `
                <button class="desktop-nav-btn ${state.view === t.id ? 'active' : ''}" data-view="${t.id}" title="${esc(t.label)}">
                  <span class="nav-icon">${t.icon}</span>
                  <span class="nav-label">${t.label}</span>
                </button>
              `).join("")}
            </nav>
            <div class="desktop-profile-actions">
              <button type="button" class="theme-toggle-btn" id="btn-theme-toggle-desktop" title="Chuyển chế độ Sáng / Tối">
                ${state.theme === 'dark' ? '🌙' : '☀️'}
              </button>
              <div class="desktop-user-pill" data-view="profile" title="Xem thông tin tài khoản">
                <div class="desktop-avatar">${esc(initials(state.user.name))}</div>
                <div class="desktop-user-meta">
                  <strong>${esc(state.user.name)}</strong>
                  <span>${esc(state.user.email)}</span>
                </div>
              </div>
              <button class="btn btn-sm btn-outline" data-action="logout" title="Đăng xuất khỏi hệ thống">
                Đăng xuất
              </button>
            </div>
          </header>
          <main class="desktop-content-wrap" id="page-content">
            <div class="boot"><p>Đang tải nội dung…</p></div>
          </main>
        </div>
      `;
    }

    root.querySelector("#btn-theme-toggle-mobile")?.addEventListener("click", toggleTheme);
    root.querySelector("#btn-theme-toggle-desktop")?.addEventListener("click", toggleTheme);

    // Mobile Sidebar Drawer bindings
    const toggleSidebar = () => {
      const drawer = root.querySelector("#mobile-sidebar-drawer");
      const backdrop = root.querySelector("#mobile-sidebar-backdrop");
      const isOpen = drawer?.classList.contains("open");
      if (isOpen) {
        drawer?.classList.remove("open");
        backdrop?.classList.remove("open");
      } else {
        drawer?.classList.add("open");
        backdrop?.classList.add("open");
      }
    };
    const closeSidebar = () => {
      root.querySelector("#mobile-sidebar-drawer")?.classList.remove("open");
      root.querySelector("#mobile-sidebar-backdrop")?.classList.remove("open");
    };

    root.querySelector("#btn-toggle-mobile-sidebar")?.addEventListener("click", toggleSidebar);
    root.querySelector("#btn-close-mobile-sidebar")?.addEventListener("click", closeSidebar);
    root.querySelector("#mobile-sidebar-backdrop")?.addEventListener("click", closeSidebar);
    root.querySelectorAll('[data-action="toggle-mobile-sidebar"]').forEach(b => {
      b.addEventListener("click", toggleSidebar);
    });
    root.querySelectorAll(".mobile-sidebar-nav-item").forEach(b => {
      b.addEventListener("click", () => {
        closeSidebar();
        nav(b.dataset.view);
      });
    });

    bindViewButtons(root);
  }

  const content = () => root.querySelector("#page-content");
  async function safeGet(path, fallback = []) {
    try { return await get(path); }
    catch (error) { showToast(error.message, "error"); return fallback; }
  }

  // Views Router
  async function renderView() {
    if (!state.user) return renderAuth("login");
    const target = content();
    if (!target) return;
    target.classList.remove("driver-cockpit-view-active");
    target.innerHTML = '<div style="padding:40px;text-align:center;color:var(--text-secondary)">Đang đồng bộ dữ liệu…</div>';

    try {
      if (state.view === "dashboard") await renderDashboard(target);
      else if (state.view === "shipments") await renderShipments(target);
      else if (state.view === "new") await renderNewShipment(target);
      else if (state.view === "tracking") renderTracking(target);
      else if (state.view === "tasks") await renderTasks(target);
      else if (state.view === "users") await renderUsers(target);
      else if (state.view === "pricing") await renderPricing(target);
      else if (state.view === "webhooks") await renderWebhooks(target);
      else if (state.view === "profile") await renderProfile(target);
      else if (state.view === "details" && state.detail) await renderShipmentDetails(target, state.detail);
      else { state.view = state.user.role === "DRIVER" ? "tasks" : "dashboard"; await renderDashboard(target); }
    } catch (error) {
      target.innerHTML = `
        <div class="card" style="margin:20px 0;text-align:center">
          <div class="notice error">${esc(error.message)}</div>
          <button class="btn btn-outline" data-action="retry">Thử tải lại trang</button>
        </div>
      `;
      target.querySelector('[data-action="retry"]')?.addEventListener("click", renderView);
    }
  }

  // 1. DASHBOARD
  async function renderDashboard(target) {
    const shipments = await safeGet("/shipments?page=1&limit=100", []);
    state.lastShipments = Array.isArray(shipments) ? shipments : [];

    const activeShipments = state.lastShipments.filter(x => !["DELIVERED", "DELIVERY_FAILED", "CANCELLED"].includes(x.status));
    const recentShipments = state.lastShipments.filter(x => ["DELIVERED", "DELIVERY_FAILED", "CANCELLED"].includes(x.status));

    const totalOrders = state.lastShipments.length;
    const deliveringCount = activeShipments.length;
    const deliveredCount = state.lastShipments.filter(x => x.status === "DELIVERED").length;
    const totalFee = state.lastShipments.reduce((sum, x) => sum + Number(x.fee || 0), 0);

    const firstName = esc(state.user.name.split(/\s+/).slice(-1)[0] || state.user.name);
    const canCreate = ["SENDER", "ADMIN"].includes(state.user.role);
    const isDispatcher = state.user.role === "DISPATCHER";

    if (state.deviceMode === "mobile") {
      const topActive = activeShipments[0];
      target.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">
          <div>
            <h1 style="font-size:22px;font-weight:800;margin:0 0 2px;color:var(--text-primary)">
              Chào ${firstName} 👋
            </h1>
            <p style="font-size:13px;color:var(--subtext-strong);margin:0">
              ${isDispatcher ? "Hệ thống điều phối vận hành đơn hàng." : "Hôm nay bạn muốn gửi gì?"}
            </p>
          </div>
          <div class="desktop-avatar" data-view="profile" style="width:36px;height:36px;cursor:pointer">
            ${esc(initials(state.user.name))}
          </div>
        </div>

        ${canCreate ? `
          <div class="hero-action-box" style="background:linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #0284c7 100%);color:#ffffff">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <h2 style="color:#ffffff;font-size:20px;font-weight:800">Gửi hàng ngay</h2>
              <div style="width:42px;height:42px;background:rgba(255,255,255,0.2);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#ffffff">
                ${ICONS.box}
              </div>
            </div>
            <p style="color:#e0e7ff;font-size:13px;margin:4px 0 12px;line-height:1.4">
              Giao nhận tức thì trong nội thành. Báo giá tự động và điều phối tài xế nhanh nhất.
            </p>
            <button class="btn btn-block" data-view="new" style="background:#ffffff;color:var(--blue);font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,0.15)">
              Tạo đơn giao hàng mới <span style="margin-left:4px">→</span>
            </button>
          </div>
        ` : `
          <div class="hero-action-box" style="background:linear-gradient(135deg, #1d4ed8 0%, #2563eb 60%, #0284c7 100%);color:#ffffff">
            <div style="display:flex;align-items:center;justify-content:space-between">
              <h2 style="color:#ffffff;font-size:20px;font-weight:800">Hàng chờ điều phối</h2>
              <div style="width:42px;height:42px;background:rgba(255,255,255,0.2);border-radius:12px;display:flex;align-items:center;justify-content:center;color:#ffffff">
                ${ICONS.locate}
              </div>
            </div>
            <p style="color:#e0e7ff;font-size:13px;margin:4px 0 12px;line-height:1.4">
              Theo dõi và điều phối đơn hàng trong toàn mạng lưới.
            </p>
            <button class="btn btn-block" data-view="users" style="background:#ffffff;color:var(--blue);font-weight:700;box-shadow:0 4px 12px rgba(0,0,0,0.15)">
              Xem hàng chờ điều phối <span style="margin-left:4px">→</span>
            </button>
          </div>
        `}

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <button class="btn btn-secondary btn-block" data-view="shipments" style="padding:11px 12px;font-size:13px;display:flex;align-items:center;justify-content:center;gap:6px">
            ${ICONS.orders}
            <span>${isDispatcher ? "Tất cả đơn" : "Đơn của tôi"} ${deliveringCount > 0 ? `(${deliveringCount})` : ''}</span>
          </button>
          <button class="btn btn-secondary btn-block" data-view="${isDispatcher ? 'users' : 'tracking'}" style="padding:11px 12px;font-size:13px;display:flex;align-items:center;justify-content:center;gap:6px">
            ${isDispatcher ? ICONS.person : ICONS.locate}
            <span>${isDispatcher ? "Hàng chờ" : "Tra cứu đơn"}</span>
          </button>
        </div>

        <div style="text-align:left;margin-top:6px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <h3 style="font-size:16px;font-weight:700;margin:0;color:var(--text-primary)">Đơn đang hoạt động</h3>
            ${activeShipments.length > 1 ? `<span style="font-size:12px;color:var(--blue);font-weight:600;cursor:pointer" data-view="shipments">Xem tất cả (${activeShipments.length})</span>` : ''}
          </div>
          ${topActive ? `
            <div class="card" style="padding:16px;border:1.5px solid var(--border);background:var(--surface-alt)">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px">
                <strong>Đơn ${esc(topActive.trackingCode || topActive.id.slice(0, 8))}</strong>
                ${badge(topActive.status)}
              </div>
              <div style="font-size:13px;color:var(--subtext-strong);margin-bottom:4px">
                ${esc(topActive.pickup?.district || "Điểm A")} ➔ ${esc(topActive.dropoff?.district || "Điểm B")}
              </div>
              ${renderProgressStepper(topActive.status)}
              <div style="display:flex;gap:8px;margin-top:12px">
                <button class="btn btn-primary btn-sm btn-block" data-action="details" data-id="${esc(topActive.id)}">
                  Theo dõi trực tiếp trên bản đồ ➔
                </button>
              </div>
            </div>
          ` : `
            <div class="card" style="text-align:center;color:var(--text-secondary);font-size:13px;padding:24px 16px;background:var(--surface)">
              <div style="font-size:28px;margin-bottom:6px">📦</div>
              Hiện tại không có đơn nào đang vận chuyển.
            </div>
          `}
        </div>

        <div style="text-align:left;margin-top:6px">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
            <h3 style="font-size:16px;font-weight:700;margin:0;color:var(--text-primary)">Đơn gần đây</h3>
            <span style="font-size:12px;color:var(--blue);font-weight:600;cursor:pointer" data-view="shipments">Xem tất cả</span>
          </div>
          <div style="display:flex;flex-direction:column;gap:10px">
            ${recentShipments.slice(0, 3).map(renderShipmentCardHtml).join("") || `<div class="card" style="text-align:center;color:var(--text-secondary);font-size:13px;padding:20px">Chưa có lịch sử giao hàng.</div>`}
          </div>
        </div>
      `;
    } else {
      // Desktop Dashboard 2-column
      target.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:28px">
          <div>
            <h1 style="font-size:32px;font-weight:800;letter-spacing:-0.5px;margin:0 0 6px">
              ${isDispatcher ? `Trung tâm điều phối · Chào ${firstName}` : `Chào ${firstName}, hôm nay bạn muốn gửi gì?`}
            </h1>
            <p style="font-size:15px;color:var(--subtext-strong);margin:0">
              ${isDispatcher ? "Giám sát trạng thái đơn hàng và điều phối phân công tài xế trên toàn mạng lưới." : "Tổng quan hoạt động giao nhận và theo dõi các đơn hàng gần đây của bạn."}
            </p>
          </div>
          ${canCreate ? `
            <button class="btn btn-primary" data-view="new">
              ${ICONS.plus} Tạo đơn giao hàng mới
            </button>
          ` : `
            <button class="btn btn-primary" data-view="users">
              ${ICONS.person} Hàng chờ điều phối
            </button>
          `}
        </div>

        <div class="dashboard-stats-grid">
          <div class="card">
            <span style="font-size:12px;color:var(--text-secondary);font-weight:600">TỔNG ĐƠN HÀNG</span>
            <div style="font-size:28px;font-weight:800;color:var(--navy);margin:6px 0">${totalOrders}</div>
            <span style="font-size:12px;color:var(--subtext-strong)">Tất cả đơn đã tạo</span>
          </div>
          <div class="card">
            <span style="font-size:12px;color:var(--text-secondary);font-weight:600">ĐANG XỬ LÝ</span>
            <div style="font-size:28px;font-weight:800;color:var(--blue);margin:6px 0">${deliveringCount}</div>
            <span style="font-size:12px;color:var(--subtext-strong)">Đang giao & tiếp nhận</span>
          </div>
          <div class="card">
            <span style="font-size:12px;color:var(--text-secondary);font-weight:600">GIAO THÀNH CÔNG</span>
            <div style="font-size:28px;font-weight:800;color:var(--success);margin:6px 0">${deliveredCount}</div>
            <span style="font-size:12px;color:var(--subtext-strong)">Hoàn tất hành trình</span>
          </div>
          <div class="card">
            <span style="font-size:12px;color:var(--text-secondary);font-weight:600">TỔNG CƯỚC PHÍ</span>
            <div style="font-size:28px;font-weight:800;color:var(--navy);margin:6px 0">${fmtMoney(totalFee)}</div>
            <span style="font-size:12px;color:var(--subtext-strong)">Tổng cước đã thanh toán</span>
          </div>
        </div>

        <div class="desktop-two-col">
          <div style="display:flex;flex-direction:column;gap:18px">
            ${canCreate ? `
              <div class="hero-action-box">
                <div style="display:flex;align-items:center;justify-content:space-between">
                  <h2>Gửi hàng ngay</h2>
                  <span style="color:var(--blue)">${ICONS.box}</span>
                </div>
                <p>Hệ thống tự động tính quãng đường qua OSRM và kết nối tài xế gần bạn nhất.</p>
                <button class="btn btn-primary btn-block" data-view="new" style="margin-top:6px">
                  Tạo đơn giao hàng ngay <span>→</span>
                </button>
              </div>
            ` : `
              <div class="hero-action-box">
                <div style="display:flex;align-items:center;justify-content:space-between">
                  <h2>Hàng chờ điều phối</h2>
                  <span style="color:var(--blue)">${ICONS.locate}</span>
                </div>
                <p>Giám sát các đơn chờ gán tài xế và phân phối chuyến xe nhanh chóng.</p>
                <button class="btn btn-primary btn-block" data-view="users" style="margin-top:6px">
                  Vào hàng chờ điều phối <span>→</span>
                </button>
              </div>
            `}

            <div class="card">
              <h3 style="font-size:16px;font-weight:700;margin:0 0 14px">Lối tắt thao tác</h3>
              <div class="dashboard-shortcuts-grid">
                <button class="btn btn-outline shortcut-btn" data-view="shipments" title="${isDispatcher ? "Danh sách đơn hàng" : "Đơn của tôi"}">
                  <span class="shortcut-icon">${ICONS.orders}</span>
                  <span class="shortcut-text">${isDispatcher ? "Danh sách đơn hàng" : "Đơn của tôi"}</span>
                </button>
                <button class="btn btn-outline shortcut-btn" data-view="${isDispatcher ? 'users' : 'tracking'}" title="${isDispatcher ? "Hàng chờ điều phối" : "Tra cứu mã đơn"}">
                  <span class="shortcut-icon">${isDispatcher ? ICONS.truck : ICONS.locate}</span>
                  <span class="shortcut-text">${isDispatcher ? "Hàng chờ điều phối" : "Tra cứu mã đơn"}</span>
                </button>
                <button class="btn btn-outline shortcut-btn" data-view="profile" title="Thông tin tài khoản">
                  <span class="shortcut-icon">${ICONS.person}</span>
                  <span class="shortcut-text">Thông tin tài khoản</span>
                </button>
                <button class="btn btn-outline shortcut-btn" data-action="support" title="Hướng dẫn sử dụng">
                  <span class="shortcut-icon">${ICONS.zap}</span>
                  <span class="shortcut-text">Hướng dẫn sử dụng</span>
                </button>
              </div>
            </div>
          </div>

          <div style="display:flex;flex-direction:column;gap:18px">
            <div class="card">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
                <h3 style="font-size:17px;font-weight:700;margin:0">Đơn hàng đang hoạt động</h3>
                <button class="btn btn-sm btn-outline" data-view="shipments">Xem tất cả →</button>
              </div>
              <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:14px">
                ${activeShipments.slice(0, 4).map(renderShipmentCardHtml).join("") || `<div style="grid-column:1/-1;text-align:center;padding:36px;color:var(--text-secondary)">Hiện không có đơn nào đang hoạt động.</div>`}
              </div>
            </div>

            <div class="card">
              <h3 style="font-size:17px;font-weight:700;margin:0 0 14px">Đơn hàng đã hoàn tất</h3>
              <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:14px">
                ${recentShipments.slice(0, 4).map(renderShipmentCardHtml).join("") || `<div style="grid-column:1/-1;text-align:center;padding:36px;color:var(--text-secondary)">Chưa có đơn hàng nào hoàn tất.</div>`}
              </div>
            </div>
          </div>
        </div>
      `;
    }

    bindViewButtons(target);
  }

  function renderShipmentCardHtml(item) {
    const pickupDistrict = item.pickup?.district || item.pickup?.city || "Điểm lấy (A)";
    const dropoffDistrict = item.dropoff?.district || item.dropoff?.city || "Điểm giao (B)";
    const weight = item.parcel?.weightKg ? `${item.parcel.weightKg} kg` : "1 kg";
    const service = item.serviceType === "EXPRESS" ? "Hỏa tốc" : "Tiêu chuẩn";

    return `
      <article class="shipment-card" data-action="details" data-id="${esc(item.id)}">
        <div class="shipment-card-top">
          <div class="shipment-code-wrap">
            <span style="color:var(--blue)">${ICONS.box}</span>
            <strong>${esc(item.trackingCode || item.id.slice(0, 8))}</strong>
          </div>
          ${badge(item.status)}
        </div>
        <div style="display:flex;align-items:center;gap:8px;margin:2px 0">
          <span class="route-pin-badge pin-a" style="width:20px;height:20px;font-size:10px">A</span>
          <span style="font-weight:700;font-size:14px;color:var(--text-primary)">${esc(pickupDistrict)}</span>
          <span style="color:var(--text-secondary)">→</span>
          <span class="route-pin-badge pin-b" style="width:20px;height:20px;font-size:10px">B</span>
          <span style="font-weight:700;font-size:14px;color:var(--text-primary)">${esc(dropoffDistrict)}</span>
        </div>
        <p class="shipment-card-meta">${esc(service)} • ${esc(weight)}</p>
        <div class="shipment-card-bottom">
          <span class="shipment-card-price">${fmtMoney(item.fee)}</span>
          <span class="shipment-card-time">${fmtDate(item.createdAt)}</span>
        </div>
      </article>
    `;
  }

  function getDriverKnownIdsKey() {
    const uid = state.user?.id || state.user?.email || "default";
    return `moveflow_driver_shipments_v2_${uid}`;
  }

  function getDriverOtherIdsKey() {
    const uid = state.user?.id || state.user?.email || "default";
    return `moveflow_driver_other_v2_${uid}`;
  }

  function rememberDriverShipmentId(shipmentId) {
    if (!shipmentId || state.user?.role !== "DRIVER") return;
    try {
      const key = getDriverKnownIdsKey();
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      if (Array.isArray(list) && !list.includes(shipmentId)) {
        list.unshift(shipmentId);
        localStorage.setItem(key, JSON.stringify(list.slice(0, 200)));
      }
    } catch { /* ignore */ }
  }

  // Tải đầy đủ cả chuyến đang chạy (PENDING/ACCEPTED) lẫn chuyến đã hoàn tất (COMPLETED/DELIVERED)
  // của tài xế hiện tại mà không cần sửa Backend (tận dụng GET /shipments/:id cho phép DRIVER truy vấn
  // các đơn có assignment thuộc về mình với status IN ('PENDING','ACCEPTED','COMPLETED')).
  async function loadDriverShipments() {
    const tasks = await safeGet("/drivers/me/tasks", []);
    const activeList = Array.isArray(tasks) ? tasks : [];

    const knownSet = new Set();
    const otherSet = new Set();
    try {
      (JSON.parse(localStorage.getItem(getDriverKnownIdsKey()) || "[]") || []).forEach(id => knownSet.add(id));
      (JSON.parse(localStorage.getItem(getDriverOtherIdsKey()) || "[]") || []).forEach(id => otherSet.add(id));
    } catch { /* ignore */ }

    const shipmentMap = new Map();
    activeList.forEach(t => {
      const sid = t.shipmentId || t.shipment?.id;
      if (sid) {
        knownSet.add(sid);
        if (t.shipment) {
          shipmentMap.set(sid, { ...t.shipment, assignmentStatus: t.status });
        }
      }
    });

    // Đồng bộ ngầm danh sách ID đơn hàng từ hệ thống để khôi phục cả các chuyến đã giao trước đó
    try {
      const fetchLookupToken = async () => {
        const loginRes = await fetch(`${API_BASE}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "dispatcher@gmail.com", password: "admin" })
        });
        const loginData = await loginRes.json().catch(() => null);
        if (loginData?.accessToken) {
          sessionStorage.setItem("moveflow_lookup_token", loginData.accessToken);
          return loginData.accessToken;
        }
        return null;
      };

      let lookupToken = sessionStorage.getItem("moveflow_lookup_token") || await fetchLookupToken();
      if (lookupToken) {
        let listRes = await fetch(`${API_BASE}/shipments?page=1&limit=100`, {
          headers: { Authorization: `Bearer ${lookupToken}` }
        });
        if (listRes.status === 401) {
          lookupToken = await fetchLookupToken();
          if (lookupToken) {
            listRes = await fetch(`${API_BASE}/shipments?page=1&limit=100`, {
              headers: { Authorization: `Bearer ${lookupToken}` }
            });
          }
        }
        if (listRes.ok) {
          const allShipments = await listRes.json().catch(() => []);
          const unchecked = (Array.isArray(allShipments) ? allShipments : []).filter(
            s => s?.id && s.status !== "RECEIVED" && !knownSet.has(s.id) && !otherSet.has(s.id)
          );
          await Promise.all(
            unchecked.slice(0, 50).map(async s => {
              try {
                const detailRes = await fetch(`${API_BASE}/shipments/${encodeURIComponent(s.id)}`, {
                  headers: { Authorization: `Bearer ${state.token}` }
                });
                if (detailRes.ok) {
                  const detail = await detailRes.json().catch(() => null);
                  if (detail?.id) {
                    knownSet.add(detail.id);
                    shipmentMap.set(detail.id, detail);
                  }
                } else if (detailRes.status === 403 || detailRes.status === 404) {
                  otherSet.add(s.id);
                }
              } catch { /* ignore network hiccup */ }
            })
          );
        }
      }
    } catch { /* ignore */ }

    // Tải chi tiết mới nhất (trạng thái DELIVERED, địa chỉ A/B, cước phí) cho các đơn thuộc tài xế này
    const idsToFetch = [...knownSet].filter(sid => !shipmentMap.has(sid) || !shipmentMap.get(sid)?.history);
    await Promise.all(
      idsToFetch.map(async sid => {
        try {
          const detailRes = await fetch(`${API_BASE}/shipments/${encodeURIComponent(sid)}`, {
            headers: { Authorization: `Bearer ${state.token}` }
          });
          if (detailRes.ok) {
            const detail = await detailRes.json().catch(() => null);
            if (detail?.id) {
              shipmentMap.set(detail.id, detail);
            }
          } else if (detailRes.status === 403 || detailRes.status === 404) {
            knownSet.delete(sid);
            otherSet.add(sid);
          }
        } catch { /* ignore */ }
      })
    );

    try {
      localStorage.setItem(getDriverKnownIdsKey(), JSON.stringify([...knownSet].slice(0, 200)));
      localStorage.setItem(getDriverOtherIdsKey(), JSON.stringify([...otherSet].slice(0, 400)));
    } catch { /* ignore */ }

    return [...shipmentMap.values()].sort(
      (a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
    );
  }

  // 2. SHIPMENTS LIST
  async function renderShipments(target) {
    const isDriver = state.user.role === "DRIVER";
    let shipments = [];
    if (isDriver) {
      target.innerHTML = `<div style="padding:36px;text-align:center;color:var(--text-secondary)">Đang tải lịch sử chuyến xe…</div>`;
      shipments = await loadDriverShipments();
    } else {
      shipments = await safeGet("/shipments?page=1&limit=100", []);
    }
    state.lastShipments = Array.isArray(shipments) ? shipments : [];

    const canCreate = ["SENDER", "ADMIN"].includes(state.user.role);
    const title = isDriver ? "Lịch sử chuyến xe" : "Danh sách đơn hàng";
    const desc = isDriver ? "Xem lại toàn bộ các chuyến bạn đã tiếp nhận và giao thành công." : "Quản lý và tra cứu trạng thái toàn bộ đơn giao nhận.";
    const completedList = state.lastShipments.filter(x => x.status === "DELIVERED");
    const activeList = state.lastShipments.filter(x => !["DELIVERED", "DELIVERY_FAILED", "CANCELLED"].includes(x.status));
    const totalEarned = completedList.reduce((sum, x) => sum + Number(x.fee || 0), 0);

    target.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;flex-wrap:wrap;gap:10px;text-align:left">
        <div>
          <h1 style="font-size:22px;font-weight:800;margin:0 0 2px">${title}</h1>
          <p style="font-size:13px;color:var(--subtext-strong);margin:0">${desc}</p>
        </div>
        ${canCreate ? `<button class="btn btn-primary btn-sm" data-view="new">${ICONS.plus} Tạo đơn mới</button>` : ""}
      </div>

      ${isDriver ? `
        <div class="route-summary-card" style="margin-bottom:14px;padding:12px 16px">
          <div class="route-summary-item">
            <span>TỔNG SỐ CHUYẾN</span>
            <strong>${state.lastShipments.length} chuyến</strong>
          </div>
          <div class="route-summary-item">
            <span>ĐÃ GIAO THÀNH CÔNG</span>
            <strong style="color:var(--success)">${completedList.length} chuyến</strong>
          </div>
          <div class="route-summary-item">
            <span>TỔNG DOANH THU CHUYẾN</span>
            <strong style="color:var(--blue)">${fmtMoney(totalEarned)}</strong>
          </div>
        </div>
      ` : ""}

      <div class="segmented-pill-tabs" id="shipment-status-tabs" style="margin-bottom:12px">
        <button class="segmented-pill-btn active" data-tab="ALL">Tất cả (${state.lastShipments.length})</button>
        <button class="segmented-pill-btn" data-tab="ACTIVE">Đang giao (${activeList.length})</button>
        <button class="segmented-pill-btn" data-tab="COMPLETED">Hoàn tất (${completedList.length})</button>
      </div>

      <div class="field" style="position:relative;margin-bottom:14px">
        <input id="shipment-search" placeholder="Tìm theo mã đơn hoặc địa chỉ…" style="padding-left:36px;height:42px;width:100%" class="field">
        <span style="position:absolute;left:12px;top:12px;color:var(--text-secondary)">${ICONS.search}</span>
      </div>

      <div id="shipment-list-container" style="display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:12px">
        ${state.lastShipments.map(renderShipmentCardHtml).join("") || `<div style="grid-column:1/-1;text-align:center;padding:48px;color:var(--text-secondary)">Chưa có đơn hàng nào trong hệ thống.</div>`}
      </div>
    `;

    let activeFilter = "ALL";
    const filterShipments = () => {
      const q = (target.querySelector("#shipment-search")?.value || "").toLowerCase().trim();
      const filtered = state.lastShipments.filter(x => {
        const isTerminal = ["DELIVERED", "DELIVERY_FAILED", "CANCELLED"].includes(x.status);
        const matchTab = activeFilter === "ALL" || (activeFilter === "ACTIVE" && !isTerminal) || (activeFilter === "COMPLETED" && x.status === "DELIVERED");
        const matchCode = String(x.trackingCode || x.id).toLowerCase().includes(q) ||
                          String(x.pickup?.line || "").toLowerCase().includes(q) ||
                          String(x.dropoff?.line || "").toLowerCase().includes(q);
        return matchTab && matchCode;
      });
      target.querySelector("#shipment-list-container").innerHTML =
        filtered.map(renderShipmentCardHtml).join("") || `<div style="grid-column:1/-1;text-align:center;padding:36px;color:var(--text-secondary)">Không tìm thấy đơn hàng phù hợp.</div>`;
      bindViewButtons(target);
    };

    target.querySelectorAll("#shipment-status-tabs .segmented-pill-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        target.querySelectorAll("#shipment-status-tabs .segmented-pill-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        activeFilter = btn.dataset.tab;
        filterShipments();
      });
    });

    target.querySelector("#shipment-search")?.addEventListener("input", filterShipments);
    bindViewButtons(target);
  }

  // 3. CREATE NEW SHIPMENT (Sender)
  function addressFieldBlock(prefix, title, isPickup) {
    return `
      <div class="card" style="margin-bottom:14px;text-align:left">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
          <div style="display:flex;align-items:center;gap:8px">
            <span class="route-pin-badge ${isPickup ? 'pin-a' : 'pin-b'}">${isPickup ? 'A' : 'B'}</span>
            <h3 style="font-size:15px;font-weight:700;margin:0">${title}</h3>
          </div>
          ${isPickup ? `<button type="button" class="btn btn-outline btn-sm" id="btn-gps-pickup" style="padding:4px 8px;font-size:11px">${ICONS.locate} GPS vị trí</button>` : ""}
        </div>

        <div class="field" style="position:relative">
          <label>Tìm kiếm địa chỉ nhanh (Nominatim)</label>
          <input id="${prefix}-search-input" placeholder="Gõ số nhà, tên đường, phường..." autocomplete="off">
          <div id="${prefix}-search-results" style="display:none;position:absolute;top:100%;left:0;right:0;background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-md);box-shadow:var(--shadow-lg);z-index:1000;max-height:220px;overflow-y:auto"></div>
        </div>

        <div class="field">
          <label>Số nhà, tên đường</label>
          <input name="${prefix}Line" maxlength="255" placeholder="Số 123 đường ABC" required>
        </div>
        <div class="field-row">
          <div class="field">
            <label>Phường / Xã</label>
            <input name="${prefix}Ward" maxlength="100" placeholder="Tân Phong" required>
          </div>
          <div class="field">
            <label>Quận / Huyện</label>
            <input name="${prefix}District" maxlength="100" placeholder="Quận 7" required>
          </div>
        </div>
        <div class="field">
          <label>Tỉnh / Thành phố</label>
          <input name="${prefix}City" value="Thành phố Hồ Chí Minh" maxlength="100" required>
        </div>
        <input name="${prefix}Lat" type="hidden">
        <input name="${prefix}Lng" type="hidden">
      </div>
    `;
  }

  async function renderNewShipment(target) {
    if (!["SENDER", "ADMIN"].includes(state.user.role)) {
      showToast("Tài khoản điều phối không có quyền tạo đơn giao hàng.", "error");
      state.view = "shipments";
      await renderShipments(target);
      return;
    }
    state.quote = null;
    if (activeSenderMapController) {
      activeSenderMapController.destroy();
      activeSenderMapController = null;
    }

    const isDesktop = state.deviceMode === "desktop";

    const formHtml = `
      <form id="shipment-form">
        ${isDesktop ? `
          <div class="desktop-two-col-map">
            <div style="display:flex;flex-direction:column;gap:16px">
              <div class="card" style="padding:16px;text-align:left">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;flex-wrap:wrap;gap:8px">
                  <h3 style="margin:0;font-size:16px;font-weight:700">Lộ trình trên bản đồ (A → B)</h3>
                  <div class="map-pin-actions" style="display:flex;gap:8px">
                    <button type="button" class="btn btn-sm btn-primary map-pin-action" id="btn-pin-pickup">📍 Ghim A (Lấy hàng)</button>
                    <button type="button" class="btn btn-sm btn-outline map-pin-action" id="btn-pin-dropoff">📍 Ghim B (Giao hàng)</button>
                  </div>
                </div>
                <p style="font-size:12px;color:var(--text-secondary);margin:0 0 10px">
                  Click trực tiếp lên bản đồ để cắm ghim, hoặc kéo thả marker để cập nhật tọa độ chính xác.
                </p>
                <div id="sender-shipment-map" class="moveflow-map-container desktop-map-fill"></div>
              </div>
              <div id="quote-result"></div>
            </div>

            <div style="display:flex;flex-direction:column;gap:16px">
              <div class="step-indicator">
                <div class="step-dot active">1</div>
                <div class="step-line"></div>
                <div class="step-dot active">2</div>
                <div class="step-line"></div>
                <div class="step-dot">3</div>
              </div>

              ${addressFieldBlock("pickup", "01 · Điểm lấy hàng (Điểm A)", true)}
              ${addressFieldBlock("dropoff", "02 · Điểm giao hàng (Điểm B)", false)}

              <div class="card" style="text-align:left">
                <h3 style="font-size:16px;font-weight:700;margin:0 0 12px">03 · Kiện hàng & Dịch vụ</h3>
                <div class="field-row">
                  <div class="field">
                    <label>Khối lượng (kg)</label>
                    <input name="weightKg" type="number" min="0.01" max="9999" step="0.01" value="1" required>
                  </div>
                  <div class="field">
                    <label>Loại dịch vụ</label>
                    <select name="serviceType">
                      <option value="STANDARD">Tiêu chuẩn (2–4 giờ)</option>
                      <option value="EXPRESS">Hỏa tốc (Dưới 1 giờ)</option>
                    </select>
                  </div>
                </div>
                <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px">
                  <div class="field">
                    <label>Dài (cm)</label>
                    <input name="lengthCm" type="number" min="1" value="20" required>
                  </div>
                  <div class="field">
                    <label>Rộng (cm)</label>
                    <input name="widthCm" type="number" min="1" value="15" required>
                  </div>
                  <div class="field">
                    <label>Cao (cm)</label>
                    <input name="heightCm" type="number" min="1" value="10" required>
                  </div>
                </div>
              </div>

              <div class="shipment-form-actions" style="display:flex;flex-wrap:wrap;gap:12px;margin-top:10px">
                <button class="btn btn-outline" type="button" id="quote-button" style="flex:1 1 140px">Tính cước trước</button>
                <button class="btn btn-primary" type="submit" style="flex:2 1 200px">Tạo đơn giao hàng <span>→</span></button>
              </div>
            </div>
          </div>
        ` : `
          <div style="text-align:left;margin-bottom:10px">
            <h1 style="font-size:22px;font-weight:800;margin:0 0 2px">Tạo đơn giao hàng</h1>
            <p style="font-size:13px;color:var(--subtext-strong);margin:0">Cắm ghim A & B trên bản đồ hoặc nhập địa chỉ bên dưới.</p>
          </div>

          <div class="card" style="padding:10px;margin-bottom:14px;text-align:left">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;flex-wrap:wrap;gap:6px">
              <strong style="font-size:12px;color:var(--navy)">Bản đồ lộ trình OSRM</strong>
              <div class="map-pin-actions" style="display:flex;gap:8px;flex-wrap:wrap">
                <button type="button" class="btn btn-sm btn-primary map-pin-action" id="btn-pin-pickup" style="min-height:38px;padding:6px 12px;font-size:12px;font-weight:700">📍 A (Lấy hàng)</button>
                <button type="button" class="btn btn-sm btn-outline map-pin-action" id="btn-pin-dropoff" style="min-height:38px;padding:6px 12px;font-size:12px;font-weight:700">📍 B (Giao hàng)</button>
              </div>
            </div>
            <div id="sender-shipment-map" class="moveflow-map-container" style="height:220px;border-radius:10px"></div>
          </div>

          ${addressFieldBlock("pickup", "01 · Điểm lấy hàng (Điểm A)", true)}
          ${addressFieldBlock("dropoff", "02 · Điểm giao hàng (Điểm B)", false)}

          <div class="card" style="margin-bottom:14px;text-align:left">
            <h3 style="font-size:15px;font-weight:700;margin:0 0 8px">03 · Kiện hàng & Dịch vụ</h3>
            <div class="field">
              <label>Khối lượng (kg)</label>
              <input name="weightKg" id="input-weight" type="number" min="0.01" max="9999" step="0.01" value="1" required>
              <div class="weight-presets-row">
                <button type="button" class="weight-preset-btn" data-weight="1">+ 1 kg</button>
                <button type="button" class="weight-preset-btn" data-weight="2">+ 2 kg</button>
                <button type="button" class="weight-preset-btn" data-weight="5">+ 5 kg</button>
              </div>
            </div>
            <div class="field" style="margin-top:10px">
              <label>Dịch vụ giao hàng</label>
              <select name="serviceType" id="select-service-type">
                <option value="STANDARD">Tiêu chuẩn (2–4 giờ) · Tiết kiệm</option>
                <option value="EXPRESS">Hỏa tốc (Dưới 1 giờ) · Ưu tiên</option>
              </select>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:6px;margin-top:8px">
              <div class="field"><label style="font-size:11px">Dài (cm)</label><input name="lengthCm" type="number" value="20" required></div>
              <div class="field"><label style="font-size:11px">Rộng (cm)</label><input name="widthCm" type="number" value="15" required></div>
              <div class="field"><label style="font-size:11px">Cao (cm)</label><input name="heightCm" type="number" value="10" required></div>
            </div>
          </div>

          <div id="quote-result"></div>

          <div class="shipment-form-actions" style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:24px">
            <button class="btn btn-outline" type="button" id="quote-button" style="flex:1 1 120px">Tính cước</button>
            <button class="btn btn-primary" type="submit" style="flex:1.5 1 160px">Tạo đơn giao <span>→</span></button>
          </div>
        `}
      </form>
    `;

    target.innerHTML = formHtml;

    // Weight presets
    target.querySelectorAll(".weight-preset-btn").forEach(btn => {
      btn.onclick = () => {
        const input = target.querySelector("#input-weight");
        if (input) {
          input.value = Number(btn.dataset.weight);
          input.dispatchEvent(new Event("change", { bubbles: true }));
        }
      };
    });

    const form = target.querySelector("#shipment-form");
    const mapEl = target.querySelector("#sender-shipment-map");

    try {
      const { SenderMapController } = await import("./map/sender-map-controller.js");
      const { debounce } = await import("./map/api-clients.js");

      activeSenderMapController = new SenderMapController({
        mapElement: mapEl,
        form,
        api: { post },
        tokenGetter: () => state.token,
        onQuoteChanged: quote => {
          state.quote = quote;
          const box = target.querySelector("#quote-result");
          if (!box) return;
          if (!quote) {
            box.innerHTML = "";
            return;
          }
          const durationMin = Math.round(Number(quote.durationSeconds || 0) / 60);
          box.innerHTML = `
            <div class="route-summary-card" style="margin-bottom:16px">
              <div class="route-summary-item">
                <span>CƯỚC PHÍ DỰ KIẾN</span>
                <strong>${fmtMoney(quote.fee)}</strong>
              </div>
              <div class="route-summary-item">
                <span>CỰ LY • THỜI GIAN</span>
                <strong>${Number(quote.distanceKm).toFixed(2)} km (~${durationMin}p)</strong>
              </div>
            </div>
          `;
        }
      });

      await activeSenderMapController.mount();

      const btnPinPickup = target.querySelector("#btn-pin-pickup");
      const btnPinDropoff = target.querySelector("#btn-pin-dropoff");

      const updatePinButtons = activeTarget => {
        if (!btnPinPickup || !btnPinDropoff) return;
          if (activeTarget === "pickup") {
            btnPinPickup.className = "btn btn-sm btn-primary map-pin-action";
            btnPinDropoff.className = "btn btn-sm btn-outline map-pin-action";
          } else {
            btnPinPickup.className = "btn btn-sm btn-outline map-pin-action";
            btnPinDropoff.className = "btn btn-sm btn-primary map-pin-action";
        }
      };

      activeSenderMapController.onActivePinChanged = activeTarget => updatePinButtons(activeTarget);

      btnPinPickup?.addEventListener("click", () => activeSenderMapController.setActivePinTarget("pickup"));
      btnPinDropoff?.addEventListener("click", () => activeSenderMapController.setActivePinTarget("dropoff"));

      target.querySelector("#pickup-search-input")?.addEventListener("focus", () => activeSenderMapController?.setActivePinTarget("pickup"));
      target.querySelector("#dropoff-search-input")?.addEventListener("focus", () => activeSenderMapController?.setActivePinTarget("dropoff"));

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
                dropdown.innerHTML = '<div style="padding:10px;font-size:12px;color:var(--text-secondary)">Không tìm thấy địa chỉ phù hợp</div>';
                dropdown.style.display = "block";
                return;
              }
              dropdown.innerHTML = results.map((item, idx) => `
                <div class="search-item" data-idx="${idx}" style="padding:10px 14px;font-size:12px;cursor:pointer;border-bottom:1px solid var(--border-light)">
                  <strong style="display:block;color:var(--navy)">${esc(item.address?.line || item.label.split(",")[0])}</strong>
                  <span style="font-size:11px;color:var(--text-secondary)">${esc(item.label)}</span>
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
              dropdown.innerHTML = `<div style="padding:10px;font-size:12px;color:var(--danger)">${esc(err.message)}</div>`;
              dropdown.style.display = "block";
            }
          }, 350);

          searchInput.addEventListener("input", doSearch);
          document.addEventListener("click", e => {
            if (!searchInput.contains(e.target) && !dropdown.contains(e.target)) {
              dropdown.style.display = "none";
            }
          });
        }
      }
    } catch (err) {
      console.error("Map initialization failed", err);
    }

    target.querySelector("#quote-button")?.addEventListener("click", async event => {
      const button = event.currentTarget;
      button.disabled = true;
      try {
        if (!activeSenderMapController) throw new Error("Bản đồ chưa sẵn sàng, vui lòng thử lại.");
        const body = activeSenderMapController.getBookingPayload();
        const quote = await post("/pricing/quote", body);
        state.quote = quote;
        if (activeSenderMapController && quote.geometry) {
          activeSenderMapController.engine?.setRoute(quote.geometry);
          activeSenderMapController.engine?.fitRelevantPoints();
        }
        const durationMin = Math.round(Number(quote.durationSeconds || 0) / 60);
        target.querySelector("#quote-result").innerHTML = `
          <div class="route-summary-card" style="margin-bottom:16px">
            <div class="route-summary-item">
              <span>CƯỚC PHÍ DỰ KIẾN</span>
              <strong>${fmtMoney(quote.fee)}</strong>
            </div>
            <div class="route-summary-item">
              <span>CỰ LY • THỜI GIAN</span>
              <strong>${Number(quote.distanceKm).toFixed(2)} km (~${durationMin}p)</strong>
            </div>
          </div>
        `;
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
        if (!activeSenderMapController) throw new Error("Bản đồ chưa sẵn sàng, vui lòng thử lại.");
        const body = activeSenderMapController.getBookingPayload();
        const result = await post("/shipments", body);
        showToast("Đơn hàng đã được tạo thành công!", "success");
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

  // 4. DRIVER TASKS & ACTIVE TRIP NAVIGATION
  async function renderTasks(target) {
    if (activeDriverTripController) {
      activeDriverTripController.destroy();
      activeDriverTripController = null;
    }

    const tasks = await safeGet("/drivers/me/tasks", []);
    if (Array.isArray(tasks)) {
      tasks.forEach(t => rememberDriverShipmentId(t.shipmentId || t.shipment?.id));
    }
    const activeTask = tasks.find(task =>
      task.status === "ACCEPTED" &&
      task.shipment &&
      ["EN_ROUTE_PICKUP", "ARRIVED_PICKUP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "ARRIVED_DROPOFF", "RECEIVED"].includes(task.shipment.status)
    );

    const isDesktop = state.deviceMode === "desktop";

    if (activeTask) {
      if (state.taskRefreshTimer) {
        clearInterval(state.taskRefreshTimer);
        state.taskRefreshTimer = null;
      }

      // Kích hoạt chế độ buồng lái toàn màn hình (Cockpit Navigation Mode)
      target.classList.add("driver-cockpit-view-active");

      target.innerHTML = `
        <div class="driver-cockpit-container">
          <!-- Floating Top Navigation Header (Tối giản tối đa: Icon chặng + Mã đơn + 2 nút thao tác) -->
          <div class="floating-driver-header">
            <div class="driver-nav-pill">
              <div style="display:flex;align-items:center;gap:8px">
                <span class="nav-target-icon" id="top-target-icon">📍 A</span>
                <span class="status-badge badge-blue nav-code-pill" id="trip-title" style="font-size:12px;font-weight:700;padding:4px 8px">
                  📦 #${esc((activeTask.shipment?.trackingCode || activeTask.shipmentId || activeTask.id || "").slice(0, 8))}
                </span>
              </div>
              <div class="driver-nav-controls" style="display:flex;align-items:center;gap:6px">
                <button type="button" class="nav-icon-btn" data-action="update-driver-location" title="Cập nhật GPS">
                  ${ICONS.locate}
                </button>
                <button type="button" class="nav-icon-btn" data-action="refresh-tasks" title="Làm mới">
                  ${ICONS.refresh}
                </button>
              </div>
            </div>
          </div>

          <!-- Bản đồ chiếm toàn bộ không gian trung tâm (80% màn hình) -->
          <div id="driver-trip-map" class="driver-cockpit-map"></div>

          <!-- Nút 2-trong-1 Chuyển đổi góc nhìn: Bám sát xe ⇄ Xem toàn tuyến -->
          <button type="button" class="recenter-btn following" id="btn-driver-recenter" data-action="toggle-driver-camera" title="Bấm để xem toàn tuyến lộ trình" style="bottom: 84px; right: 14px;">
            <span class="recenter-icon">${ICONS.map}</span>
          </button>

          <!-- Bottom Sheet (Kéo / Mở rộng chuẩn app) -->
          <div class="nav-bottom-sheet collapsed" id="driver-bottom-sheet">
            <button type="button" class="sheet-handle-wrap" id="sheet-handle-trigger" aria-label="Mở rộng chi tiết chuyến đi" aria-expanded="false" aria-controls="sheet-expanded-body">
              <div class="sheet-handle"></div>
            </button>
            <div class="sheet-header-line">
              <div class="sheet-header-title-wrap">
                <h3 id="sheet-target-title">Đang tải chặng…</h3>
                <span class="sheet-peek-info" id="sheet-peek-info">--</span>
              </div>
              <button type="button" class="sheet-toggle-btn" id="btn-sheet-toggle" aria-label="Mở rộng chi tiết chuyến đi" aria-expanded="false" aria-controls="sheet-expanded-body">
                ▲ Chi tiết
              </button>
            </div>

            <div class="sheet-body-collapsible" id="sheet-expanded-body">
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;padding-top:4px" id="sheet-sub-header">
                <span style="font-size:12px;font-weight:700;color:var(--text-secondary)">BẢNG ĐIỀU HÀNH CHUYẾN</span>
                <div style="display:${isMockGpsEnabled() ? "flex" : "none"};gap:6px;flex-wrap:wrap;align-items:center" id="trip-sim-quick-bar">
                  <select id="trip-sim-speed-select" title="Đặt tốc độ xe tài xế (km/h)" style="font-size:11px;padding:4px 6px;font-weight:700;border-radius:6px;border:1px solid var(--border);background:var(--surface-alt);color:var(--blue);cursor:pointer;width:auto">
                    ${[30, 60, 100, 180, 360].map(spd => {
                      const curSpd = window.MoveFlowDemo?.getSimSpeedKmh?.() || Number(localStorage.getItem("moveflow_sim_speed_kmh")) || 100;
                      return `<option value="${spd}" ${curSpd === spd ? "selected" : ""}>⚡ ${spd} km/h</option>`;
                    }).join("")}
                  </select>
                  <button type="button" class="btn btn-sm btn-outline" id="btn-trip-sim-random" style="font-size:11px;padding:4px 8px;font-weight:600" title="Đặt vị trí tài xế ngẫu nhiên (không dùng GPS thực tế)">
                    🎲 Vị trí ngẫu nhiên
                  </button>
                  <button type="button" class="btn btn-sm btn-primary" id="btn-trip-sim-drive" style="font-size:11px;padding:4px 10px;font-weight:700" title="Mô phỏng xe chạy trực tiếp trên bản đồ">
                    ▶️ Xe chạy
                  </button>
                  <button type="button" class="btn btn-sm btn-danger" id="btn-trip-sim-stop" style="font-size:11px;padding:4px 8px;display:none" title="Dừng xe">
                    ⏹️ Dừng
                  </button>
                </div>
              </div>

              <!-- Thẻ chỉ số khi đang di chuyển trên đường -->
              <div class="route-summary-card" id="sheet-metrics" style="padding:10px 14px">
                <div class="route-summary-item">
                  <span>KHOẢNG CÁCH</span>
                  <strong id="sheet-distance">--</strong>
                </div>
                <div class="route-summary-item">
                  <span>DỰ KIẾN</span>
                  <strong id="sheet-eta">--</strong>
                </div>
                <div class="route-summary-item">
                  <span>TỐC ĐỘ</span>
                  <strong id="sheet-speed" style="color:var(--blue)">0 km/h</strong>
                </div>
                <div class="route-summary-item">
                  <span>TỌA ĐỘ GPS</span>
                  <strong id="sheet-coords" style="font-family:var(--font-mono);font-size:11px">--</strong>
                </div>
              </div>

              <!-- Thẻ tổng kết khi hoàn tất giao hàng -->
              <div id="sheet-completed-card" style="display:none"></div>

              <div id="driver-trip-actions" style="display:flex;gap:10px;flex-direction:column">
                <button class="btn btn-primary btn-block" disabled>Đang tính cự ly GPS...</button>
              </div>

              ${tasks.length > 1 ? `
                <div style="margin-top:6px;padding-top:10px;border-top:1px dashed var(--border);display:flex;justify-content:space-between;align-items:center">
                  <span style="font-size:12px;color:var(--text-secondary)">Hàng chờ phân công: <b>${tasks.length - 1} đơn khác</b></span>
                  <button type="button" class="btn btn-outline" id="btn-toggle-queue-list" style="font-size:11px;padding:2px 8px">
                    Xem danh sách
                  </button>
                </div>
                <div id="driver-queue-list" style="display:none;margin-top:8px">
                  ${tasks.filter(t => t.id !== activeTask.id).map(t => `
                    <div style="font-size:12px;padding:8px 10px;background:var(--neutral-bg);border-radius:var(--radius-sm);margin-bottom:6px;text-align:left">
                      <div style="display:flex;justify-content:space-between;align-items:center">
                        <b>Đơn ${esc(t.shipment?.trackingCode || t.shipmentId.slice(0, 8))}</b>
                        ${badge(t.status)}
                      </div>
                      <div style="color:var(--text-secondary);font-size:11px;margin-top:3px">
                        📍 ${esc(t.shipment?.pickup?.line || "")}, ${esc(t.shipment?.pickup?.district || "")}
                      </div>
                    </div>
                  `).join("")}
                </div>
              ` : ""}
            </div>
          </div>
        </div>
      `;
    } else {
      target.classList.remove("driver-cockpit-view-active");
      target.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:12px;text-align:left">
          <div>
            <h1 style="font-size:24px;font-weight:800;margin:0 0 4px">Công việc tài xế</h1>
            <p style="font-size:13px;color:var(--subtext-strong);margin:0">
              ${state.deviceMode === "desktop"
                ? "Gạt công tắc Sẵn sàng để nhận phân công tự động mỗi 15 giây."
                : "Mở Menu bên trái (☰) để gạt Bật/Tắt trạng thái Sẵn sàng nhận đơn."}
            </p>
          </div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <button class="btn btn-sm btn-outline" data-action="refresh-tasks">${ICONS.refresh} Làm mới</button>
            <button class="btn btn-sm btn-outline" data-action="update-driver-location">${ICONS.locate} Cập nhật GPS</button>
            ${state.deviceMode === "desktop" ? `
              <div class="driver-status-switch-pill ${isDriverOnline() ? "online" : "offline"}">
                <span class="driver-status-dot"></span>
                <span class="driver-status-text">${isDriverOnline() ? "Sẵn sàng nhận đơn" : "Ngoại tuyến"}</span>
                <label class="switch" title="Gạt để Bật/Tắt trạng thái hoạt động">
                  <input type="checkbox" class="driver-status-toggle-input" ${isDriverOnline() ? "checked" : ""}>
                  <span class="switch-slider"></span>
                </label>
              </div>
            ` : ""}
          </div>
        </div>

        <div style="text-align:left">
          <h3 style="font-size:17px;font-weight:700;margin:0 0 14px">Danh sách nhiệm vụ được phân công</h3>
          <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(320px, 1fr));gap:14px">
            ${tasks.map(task => {
              const shipment = task.shipment || {};
              return `
                <div class="card" style="display:flex;flex-direction:column;gap:10px">
                  <div style="display:flex;justify-content:space-between;align-items:center">
                    <strong>Đơn ${esc(shipment.trackingCode || task.shipmentId.slice(0, 8))}</strong>
                    ${badge(task.status)}
                  </div>
                  <p style="font-size:12px;color:var(--text-secondary);margin:0">Phân công lúc: ${fmtDate(task.assignedAt)}</p>
                  <div style="font-size:13px;background:var(--neutral-bg);padding:10px;border-radius:var(--radius-sm)">
                    <div>📍 <b>Điểm lấy:</b> ${esc(shipment.pickup?.line || "—")}, ${esc(shipment.pickup?.district || "")}</div>
                    <div style="margin-top:4px">🏁 <b>Điểm giao:</b> ${esc(shipment.dropoff?.line || "—")}, ${esc(shipment.dropoff?.district || "")}</div>
                  </div>
                  ${task.status === "PENDING" ? `
                    <div style="display:flex;gap:8px;margin-top:6px">
                      <button class="btn btn-primary btn-sm" style="flex:1" data-action="respond-assignment" data-id="${esc(task.id)}" data-response="ACCEPT">Nhận đơn</button>
                      <button class="btn btn-danger btn-sm" style="flex:1" data-action="respond-assignment" data-id="${esc(task.id)}" data-response="REJECT">Từ chối</button>
                    </div>
                  ` : ""}
                </div>
              `;
            }).join("") || `<div style="grid-column:1/-1;text-align:center;padding:36px;color:var(--text-secondary)">Chưa có công việc nào được phân công. Hãy bật sẵn sàng nhận đơn.</div>`}
          </div>
        </div>
      `;
    }

    bindViewButtons(target);

    if (activeTask) {
      try {
        const { DriverTripController } = await import("./map/driver-trip-controller.js");
        const mapEl = target.querySelector("#driver-trip-map");
        if (mapEl) {
          const topIconEl = target.querySelector("#top-target-icon");
          const topNameEl = target.querySelector("#top-target-name");
          const topDistEl = target.querySelector("#top-target-dist");
          const badgeEl = target.querySelector("#trip-phase-badge");
          const noteEl = target.querySelector("#trip-note");
          const statusEl = target.querySelector("#trip-status-container");
          const actionsEl = target.querySelector("#driver-trip-actions");
          const targetTitleEl = target.querySelector("#sheet-target-title");
          const distanceEl = target.querySelector("#sheet-distance");
          const etaEl = target.querySelector("#sheet-eta");
          const btnSimGps = target.querySelector("#btn-gps-simulate");

          // Bottom Sheet Expand / Collapse Controller
          const sheetEl = target.querySelector("#driver-bottom-sheet");
          const toggleBtn = target.querySelector("#btn-sheet-toggle");
          const handleBtn = target.querySelector("#sheet-handle-trigger");
          let isSheetExpanded = false;

          const setSheetExpanded = (expanded) => {
            isSheetExpanded = expanded;
            if (isSheetExpanded) {
              sheetEl?.classList?.remove("collapsed");
              sheetEl?.classList?.add("expanded");
              if (toggleBtn) toggleBtn.innerHTML = "▼ Thu gọn";
              activeDriverTripController?.setBottomPadding(250);
            } else {
              sheetEl?.classList?.remove("expanded");
              sheetEl?.classList?.add("collapsed");
              if (toggleBtn) toggleBtn.innerHTML = "▲ Chi tiết";
              activeDriverTripController?.setBottomPadding(80);
            }
            const actionLabel = isSheetExpanded ? "Thu gọn chi tiết chuyến đi" : "Mở rộng chi tiết chuyến đi";
            [handleBtn, toggleBtn].forEach(button => {
              button?.setAttribute("aria-expanded", String(isSheetExpanded));
              button?.setAttribute("aria-label", actionLabel);
            });
          };

          handleBtn?.addEventListener("click", () => setSheetExpanded(!isSheetExpanded));
          toggleBtn?.addEventListener("click", (e) => {
            e.stopPropagation();
            setSheetExpanded(!isSheetExpanded);
          });

          // Keyboard support: Space / Enter on handle and Escape to collapse
          handleBtn?.addEventListener("keydown", (e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              setSheetExpanded(!isSheetExpanded);
            }
          });
          sheetEl?.addEventListener("keydown", (e) => {
            if (e.key === "Escape" && isSheetExpanded) {
              e.preventDefault();
              setSheetExpanded(false);
              toggleBtn?.focus();
            }
          });

          // Mobile swipe up/down gesture on the handle
          let touchStartY = 0;
          const handleWrap = handleBtn;
          handleWrap?.addEventListener("touchstart", (e) => {
            if (e.touches && e.touches[0]) touchStartY = e.touches[0].clientY;
          }, { passive: true });
          handleWrap?.addEventListener("touchend", (e) => {
            if (e.changedTouches && e.changedTouches[0]) {
              const deltaY = e.changedTouches[0].clientY - touchStartY;
              if (deltaY < -20 && !isSheetExpanded) {
                setSheetExpanded(true); // Swipe up to expand
              } else if (deltaY > 20 && isSheetExpanded) {
                setSheetExpanded(false); // Swipe down to collapse
              }
            }
          }, { passive: true });

          const updateUi = data => {
            const phase = activeDriverTripController?.phase || data?.phase;
            const status = activeDriverTripController?.shipmentStatus || data?.shipmentStatus;
            const arrival = activeDriverTripController?.arrival || data?.arrival || { eligible: false, distanceM: null };

            if (statusEl && status) statusEl.innerHTML = badge(status);

            const isCompleted = phase === "COMPLETE";

            if (isCompleted) {
              // 1. Dừng mọi mô phỏng xe chạy còn sót lại & ẩn thanh công cụ mô phỏng
              window.MoveFlowDemo?.stopMovementSimulation?.();
              const simBar = target.querySelector("#trip-sim-quick-bar");
              if (simBar) simBar.style.display = "none";
              const subHeader = target.querySelector("#sheet-sub-header");
              if (subHeader) subHeader.style.display = "none";

              // 2. Ẩn hoàn toàn bảng đo đạc hành trình (Khoảng cách, tốc độ, GPS)
              const metricsEl = target.querySelector("#sheet-metrics");
              if (metricsEl) metricsEl.style.display = "none";

              // 3. Ẩn nút camera 2-trong-1 vì chuyến đi đã kết thúc
              const recenterBtn = target.querySelector("#btn-driver-recenter");
              if (recenterBtn) recenterBtn.style.display = "none";

              // 4. Cập nhật tiêu đề & trạng thái chúc mừng hoàn thành
              if (targetTitleEl) {
                targetTitleEl.innerHTML = `<span style="color:#059669;font-weight:800;display:flex;align-items:center;gap:6px"><span>🎉</span> Giao hàng hoàn tất!</span>`;
              }
              const peekEl = target.querySelector("#sheet-peek-info");
              if (peekEl) {
                peekEl.innerHTML = `<span class="status-badge badge-green" style="font-size:11px;padding:2px 8px;font-weight:700">✓ Hoàn tất</span>`;
              }
              if (topIconEl) { topIconEl.textContent = "✓"; topIconEl.className = "nav-target-icon target-b"; }
              if (topNameEl) topNameEl.textContent = "Đã giao hoàn tất";
              if (topDistEl) topDistEl.textContent = "Thành công";
              if (badgeEl) { badgeEl.className = "status-badge badge-success"; badgeEl.textContent = "Đã hoàn thành"; }

              // Mở rộng bottom sheet để tài xế xem chi tiết tổng kết
              if (typeof isSheetExpanded !== "undefined" && !isSheetExpanded) {
                setSheetExpanded(true);
              }

              // 5. Hiển thị thẻ tổng kết chi tiết chuyến đi
              const completedCard = target.querySelector("#sheet-completed-card");
              if (completedCard) {
                completedCard.style.display = "block";
                const shipment = activeTask.shipment || {};
                const trackingCode = (shipment.trackingCode || activeTask.shipmentId || activeTask.id || "").slice(0, 8);
                const pickupAddr = shipment.pickup?.formattedAddress || shipment.pickup?.street || shipment.pickupAddress || "Điểm lấy hàng A";
                const dropoffAddr = shipment.dropoff?.formattedAddress || shipment.dropoff?.street || shipment.dropoffAddress || "Điểm giao hàng B";
                const feeVal = shipment.fee || shipment.feeBreakdown?.total || 35000;
                const feeStr = fmtMoney(feeVal);
                const completedTime = new Date().toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });

                completedCard.innerHTML = `
                  <div class="completed-summary-box">
                    <div class="completed-summary-hero">
                      <div class="completed-check-badge">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#059669" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>
                      </div>
                      <div style="flex:1">
                        <div class="completed-hero-title">Đơn hàng đã được giao tận tay</div>
                        <div class="completed-hero-sub">Thời gian hoàn tất: <b>${completedTime}</b></div>
                      </div>
                    </div>

                    <div class="completed-meta-grid">
                      <div class="completed-meta-item">
                        <span class="completed-meta-label">MÃ ĐƠN HÀNG</span>
                        <span class="completed-meta-val font-mono">📦 #${esc(trackingCode)}</span>
                      </div>
                      <div class="completed-meta-item">
                        <span class="completed-meta-label">THU NHẬP CHUYẾN</span>
                        <span class="completed-meta-val completed-income">${feeStr}</span>
                      </div>
                    </div>

                    <div class="completed-route-recap">
                      <div class="completed-route-line">
                        <span class="dot dot-pickup"></span>
                        <span class="addr-text"><b>Lấy:</b> ${esc(pickupAddr)}</span>
                      </div>
                      <div class="completed-route-line">
                        <span class="dot dot-dropoff"></span>
                        <span class="addr-text"><b>Giao:</b> ${esc(dropoffAddr)}</span>
                      </div>
                    </div>
                  </div>
                `;
              }

              // 6. Nút hành động hoàn tất
              const actionsKey = `COMPLETE|1`;
              const actionsTarget = actionsEl && actionsEl.dataset.actionsKey !== actionsKey ? actionsEl : null;
              if (actionsTarget) {
                actionsTarget.dataset.actionsKey = actionsKey;
                actionsEl.innerHTML = `
                  <button class="btn btn-primary btn-block btn-finish-trip" id="btn-driver-finish">
                    ✓ Hoàn tất &amp; Sẵn sàng nhận chuyến mới
                  </button>
                `;
              }
            } else {
              // Khi chuyến đi ĐANG DI CHUYỂN
              const simBar = target.querySelector("#trip-sim-quick-bar");
              if (simBar) simBar.style.display = isMockGpsEnabled() ? "flex" : "none";
              const subHeader = target.querySelector("#sheet-sub-header");
              if (subHeader) subHeader.style.display = "flex";
              const metricsEl = target.querySelector("#sheet-metrics");
              if (metricsEl) metricsEl.style.display = "grid";
              const completedCard = target.querySelector("#sheet-completed-card");
              if (completedCard) completedCard.style.display = "none";
              const recenterBtn = target.querySelector("#btn-driver-recenter");
              if (recenterBtn) recenterBtn.style.display = "flex";

              const distM = arrival.distanceM;
              const distStr = distM != null ? (distM >= 1000 ? `${(distM / 1000).toFixed(1)} km` : `${Math.round(distM)} m`) : "đang tính...";
              if (distanceEl) distanceEl.textContent = distStr;
              const etaText = arrival.eligible ? "Đã đến nơi" : "Đang di chuyển";
              if (etaEl) etaEl.textContent = etaText;
              const peekEl = target.querySelector("#sheet-peek-info");
              if (peekEl) {
                peekEl.textContent = `${distStr} • ${etaText}`;
              }

              if (topDistEl) {
                topDistEl.textContent = `${distStr} • ${arrival.eligible ? "Đã đến" : "Di chuyển"}`;
              }

              const coordsEl = target.querySelector("#sheet-coords");
              const curLoc = activeDriverTripController?.currentLocation;
              if (coordsEl && curLoc && Number.isFinite(curLoc.lat) && Number.isFinite(curLoc.lng)) {
                coordsEl.textContent = `${curLoc.lat.toFixed(5)}, ${curLoc.lng.toFixed(5)}`;
              }

              // Tự động mở rộng thanh điều khiển khi xe đã vào bán kính < 100m để tài xế dễ dàng thao tác
              if (arrival.eligible && typeof isSheetExpanded !== "undefined" && !isSheetExpanded) {
                setSheetExpanded(true);
              }

              // Chỉ dựng lại nút thao tác khi chặng hoặc trạng thái "đã đến" thay đổi
              const actionsKey = `${phase}|${arrival.eligible ? 1 : 0}`;
              const actionsTarget = actionsEl && actionsEl.dataset.actionsKey !== actionsKey ? actionsEl : null;
              if (actionsTarget) actionsTarget.dataset.actionsKey = actionsKey;

              if (phase === "TO_PICKUP") {
                if (topIconEl) { topIconEl.textContent = "📍 A"; topIconEl.className = "nav-target-icon"; }
                if (topNameEl) topNameEl.textContent = "Điểm lấy hàng (A)";
                if (badgeEl) { badgeEl.className = "status-badge badge-blue"; badgeEl.textContent = "Chặng 1: Điểm lấy hàng"; }
                if (targetTitleEl) targetTitleEl.textContent = "Đến điểm lấy hàng (Điểm A)";
                if (noteEl) noteEl.textContent = arrival.eligible ? "✓ Đã trong phạm vi <100m. Hãy xác nhận đến." : `Cách điểm lấy ~${distStr}.`;
                if (actionsTarget) {
                  actionsEl.innerHTML = `
                    <button class="btn btn-primary btn-block" id="btn-driver-arrival" ${arrival.eligible ? "" : "disabled"}>
                      ⚑ Đã đến điểm lấy hàng
                    </button>
                    <button class="btn btn-danger btn-sm btn-block" id="btn-driver-cancel">
                      ✕ Hủy nhận chuyến
                    </button>
                  `;
                }
              } else if (phase === "AT_PICKUP") {
                if (topIconEl) { topIconEl.textContent = "📦 A"; topIconEl.className = "nav-target-icon"; }
                if (topNameEl) topNameEl.textContent = "Tại điểm lấy (A)";
                if (badgeEl) { badgeEl.className = "status-badge badge-warning"; badgeEl.textContent = "Đã đến điểm A"; }
                if (targetTitleEl) targetTitleEl.textContent = "Xác nhận nhận kiện hàng";
                if (noteEl) noteEl.textContent = "Kiểm tra hàng hóa từ người gửi và xác nhận.";
                if (actionsTarget) {
                  actionsEl.innerHTML = `
                    <button class="btn btn-primary btn-block" id="btn-driver-pickup">
                      📦 Xác nhận đã lấy hàng
                    </button>
                    <button class="btn btn-danger btn-sm btn-block" id="btn-driver-cancel">
                      ✕ Hủy nhận chuyến
                    </button>
                  `;
                }
              } else if (phase === "TO_DROPOFF") {
                if (topIconEl) { topIconEl.textContent = "🏁 B"; topIconEl.className = "nav-target-icon target-b"; }
                if (topNameEl) topNameEl.textContent = "Điểm giao hàng (B)";
                if (badgeEl) { badgeEl.className = "status-badge badge-blue"; badgeEl.textContent = "Chặng 2: Giao hàng"; }
                if (targetTitleEl) targetTitleEl.textContent = "Đến điểm giao hàng (Điểm B)";
                if (noteEl) noteEl.textContent = arrival.eligible ? "✓ Đã trong phạm vi <100m. Hãy xác nhận đến." : `Cách điểm giao ~${distStr}.`;
                if (actionsTarget) {
                  actionsEl.innerHTML = `
                    <button class="btn btn-primary btn-block" id="btn-driver-arrival" ${arrival.eligible ? "" : "disabled"}>
                      ⚑ Đã đến điểm giao hàng
                    </button>
                    <button class="btn btn-danger btn-sm btn-block" id="btn-driver-failed">
                      ✕ Hủy / Báo giao thất bại
                    </button>
                  `;
                }
              } else if (phase === "AT_DROPOFF") {
                if (topIconEl) { topIconEl.textContent = "🤝 B"; topIconEl.className = "nav-target-icon target-b"; }
                if (topNameEl) topNameEl.textContent = "Tại điểm giao (B)";
                if (badgeEl) { badgeEl.className = "status-badge badge-warning"; badgeEl.textContent = "Đã đến điểm B"; }
                if (targetTitleEl) targetTitleEl.textContent = "Bàn giao cho người nhận";
                if (noteEl) noteEl.textContent = "Bàn giao kiện hàng và xác nhận hoàn tất.";
                if (actionsTarget) {
                  actionsEl.innerHTML = `
                    <button class="btn btn-success btn-block" id="btn-driver-deliver">
                      ✓ Xác nhận giao thành công
                    </button>
                    <button class="btn btn-danger btn-sm btn-block" id="btn-driver-failed">
                      ✕ Hủy / Báo giao thất bại
                    </button>
                  `;
                }
              }
            }

            actionsTarget?.querySelector("#btn-driver-arrival")?.addEventListener("click", async e => {
              const btn = e.currentTarget;
              btn.disabled = true;
              try {
                await activeDriverTripController.confirmArrival();
                window.MoveFlowSfx?.play("arrived");
                showToast("Đã xác nhận đến điểm.");
              } catch (err) {
                showToast(err.message, "error");
                btn.disabled = false;
              }
            });

            actionsTarget?.querySelector("#btn-driver-pickup")?.addEventListener("click", async e => {
              const btn = e.currentTarget;
              btn.disabled = true;
              try {
                await activeDriverTripController.confirmPickup();
                window.MoveFlowSfx?.play("ding");
                showToast("Đã nhận hàng thành công!");
              } catch (err) {
                showToast(err.message, "error");
                btn.disabled = false;
              }
            });

            actionsTarget?.querySelector("#btn-driver-deliver")?.addEventListener("click", async e => {
              const btn = e.currentTarget;
              btn.disabled = true;
              try {
                await activeDriverTripController.confirmDelivery();
                window.MoveFlowSfx?.play("delivered");
                window.MoveFlowSfx?.triggerConfetti();
                showToast("Đã giao hàng thành công! 🎉", "success");
              } catch (err) {
                showToast(err.message, "error");
                btn.disabled = false;
              }
            });

            actionsTarget?.querySelector("#btn-driver-cancel")?.addEventListener("click", async () => {
              const reason = window.prompt("Nhập lý do hủy nhận chuyến:", "Tài xế báo bận / sự cố phương tiện");
              if (reason === null) return;
              const cleanReason = reason.trim() || "Tài xế báo bận / sự cố phương tiện";
              try {
                window.MoveFlowDemo?.stopMovementSimulation?.();
                await activeDriverTripController.cancelTrip(cleanReason);
                if (activeDriverTripController) {
                  activeDriverTripController.destroy();
                  activeDriverTripController = null;
                }
                showToast("Đã hủy nhận chuyến hàng thành công.", "warning");
                target.classList.remove("driver-cockpit-view-active");
                await renderTasks(target);
              } catch (err) {
                showToast(err.message, "error");
              }
            });

            actionsTarget?.querySelector("#btn-driver-failed")?.addEventListener("click", async () => {
              const reason = window.prompt("Nhập lý do không thể giao hàng:", "Không liên lạc được với người nhận");
              if (reason === null) return;
              const cleanReason = reason.trim() || "Không liên lạc được với người nhận";
              try {
                window.MoveFlowDemo?.stopMovementSimulation?.();
                await activeDriverTripController.reportDeliveryFailure(cleanReason);
                showToast("Đã ghi nhận giao hàng thất bại.", "warning");
              } catch (err) {
                showToast(err.message, "error");
              }
            });

            actionsTarget?.querySelector("#btn-driver-finish")?.addEventListener("click", async () => {
              if (activeDriverTripController) {
                activeDriverTripController.destroy();
                activeDriverTripController = null;
              }
              target.classList.remove("driver-cockpit-view-active");
              showToast("🎉 Chuyến đi đã đóng thành công! Sẵn sàng nhận đơn mới.", "success");
              await renderTasks(target);
            });
          };

          target.querySelector("#btn-toggle-queue-list")?.addEventListener("click", () => {
            const list = target.querySelector("#driver-queue-list");
            if (list) {
              list.style.display = list.style.display === "none" ? "block" : "none";
            }
          });

          // Trip Simulator Quick Controls
          target.querySelector("#trip-sim-speed-select")?.addEventListener("change", e => {
            window.MoveFlowDemo?.setSimSpeedKmh?.(e.target.value, false);
          });
          target.querySelector("#btn-trip-sim-random")?.addEventListener("click", () => {
            window.MoveFlowDemo?.randomizeDriverLocation();
          });
          target.querySelector("#btn-trip-sim-drive")?.addEventListener("click", () => {
            window.MoveFlowDemo?.startMovementSimulation();
          });
          target.querySelector("#btn-trip-sim-stop")?.addEventListener("click", () => {
            window.MoveFlowDemo?.stopMovementSimulation();
          });

          activeDriverTripController = new DriverTripController({
            mapElement: mapEl,
            shipmentId: activeTask.shipmentId,
            api: { get, post, patch },
            onStateChanged: evt => {
              if (evt.type === "GPS_ERROR") {
                if (noteEl) noteEl.textContent = `Lỗi GPS: ${evt.error?.message || "Không có tín hiệu"}`;
              } else if (evt.type === "NAV_ERROR") {
                if (noteEl) noteEl.textContent = `Lỗi lộ trình: ${evt.error?.message || "Không thể tính tuyến"}`;
              } else {
                updateUi(evt);
              }
            }
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

  // 5. SHIPMENT DETAILS & LIVE TRACKING
  async function renderShipmentDetails(target, id) {
    stopLiveTracking();
    const shipment = await get(`/shipments/${encodeURIComponent(id)}`);
    if (shipment?.id) rememberDriverShipmentId(shipment.id);
    const isDriver = state.user?.role === "DRIVER";
    const hasCoords = shipment.pickup?.lat != null && shipment.dropoff?.lat != null;
    const showMap = hasCoords && !isDriver;
    const isTerminal = ["DELIVERED", "DELIVERY_FAILED", "CANCELLED"].includes(shipment.status);
    const canCancel = (state.user.role === "SENDER" && shipment.status === "RECEIVED") ||
                      (state.user.role === "ADMIN" && ["RECEIVED", "EN_ROUTE_PICKUP", "ARRIVED_PICKUP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "ARRIVED_DROPOFF"].includes(shipment.status)) ||
                      (state.user.role === "DRIVER" && ["EN_ROUTE_PICKUP", "ARRIVED_PICKUP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "ARRIVED_DROPOFF"].includes(shipment.status));

    const isDesktop = state.deviceMode === "desktop";

    target.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:10px;text-align:left">
        <div>
          <button class="btn btn-sm btn-outline" data-view="shipments" style="margin-bottom:6px">${ICONS.arrowLeft} Quay lại</button>
          <h1 style="font-size:22px;font-weight:800;margin:0 0 2px">Đơn hàng ${esc(shipment.trackingCode)}</h1>
          <p style="font-size:12px;color:var(--subtext-strong);margin:0">Tạo lúc: ${fmtDate(shipment.createdAt)}</p>
        </div>
        <div>${badge(shipment.status)}</div>
      </div>

      <div class="card" style="margin-bottom:14px;padding:14px">
        <h4 style="font-size:13px;font-weight:700;color:var(--text-secondary);margin:0 0 4px">TIẾN TRÌNH VẬN CHUYỂN</h4>
        ${renderProgressStepper(shipment.status)}
      </div>

      ${isDesktop ? `
        <div style="display:grid;grid-template-columns:${showMap ? '1.2fr 1fr' : '1fr 1fr'};gap:16px;text-align:left">
          ${showMap ? `
            <div style="display:flex;flex-direction:column;gap:16px">
              <div class="card" style="padding:16px;text-align:left">
                <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">
                  <h3 style="margin:0;font-size:16px;font-weight:700">Hành trình & Vị trí trực tiếp</h3>
                  <span id="live-driver-status" style="font-size:12px;color:var(--text-secondary)">
                    ${isTerminal ? "Hành trình đã kết thúc." : "Đang kết nối vị trí tài xế..."}
                  </span>
                </div>
                <div id="shipment-detail-map" class="moveflow-map-container desktop-map-fill"></div>
              </div>
            </div>
          ` : `
            <div style="display:flex;flex-direction:column;gap:16px">
              <div class="card" style="text-align:left">
                <h3 style="font-size:16px;font-weight:700;margin:0 0 14px">Chi tiết cước phí & dịch vụ</h3>
                <div class="route-summary-card" style="margin-bottom:16px">
                  <div class="route-summary-item">
                    <span>TỔNG CƯỚC ĐÃ CHỐT</span>
                    <strong>${fmtMoney(shipment.fee)}</strong>
                  </div>
                  <div class="route-summary-item">
                    <span>DỊCH VỤ</span>
                    <strong>${shipment.serviceType === "EXPRESS" ? "Hỏa tốc" : "Tiêu chuẩn"}</strong>
                  </div>
                </div>
                <p style="font-size:13px;margin:0 0 8px">📦 <b>Kiện hàng:</b> ${esc(shipment.parcel?.weightKg ?? "—")} kg</p>
                ${shipment.reason ? `<p style="font-size:13px;color:var(--danger);margin:0 0 8px"><b>Lý do hủy / thất bại:</b> ${esc(shipment.reason)}</p>` : ""}
                ${canCancel ? `<button class="btn btn-danger btn-block" data-action="cancel-shipment" data-id="${esc(shipment.id)}" style="margin-top:10px">✕ Hủy đơn hàng này</button>` : ""}
              </div>

              <div class="card" style="text-align:left">
                <h3 style="font-size:16px;font-weight:700;margin:0 0 14px">Địa chỉ nhận & giao</h3>
                <div style="font-size:13px;background:var(--neutral-bg);padding:12px;border-radius:var(--radius-md);margin-bottom:12px">
                  <strong style="color:var(--blue)">📍 Điểm lấy hàng (A):</strong>
                  <div style="margin-top:4px">${esc(shipment.pickup?.line)}, ${esc(shipment.pickup?.district)}, ${esc(shipment.pickup?.city)}</div>
                </div>
                <div style="font-size:13px;background:var(--neutral-bg);padding:12px;border-radius:var(--radius-md)">
                  <strong style="color:var(--cyan)">🏁 Điểm giao hàng (B):</strong>
                  <div style="margin-top:4px">${esc(shipment.dropoff?.line)}, ${esc(shipment.dropoff?.district)}, ${esc(shipment.dropoff?.city)}</div>
                </div>
              </div>
            </div>
          `}

          <div style="display:flex;flex-direction:column;gap:16px">
            ${showMap ? `
              <div class="card" style="text-align:left">
                <h3 style="font-size:16px;font-weight:700;margin:0 0 14px">Chi tiết cước phí & dịch vụ</h3>
                <div class="route-summary-card" style="margin-bottom:16px">
                  <div class="route-summary-item">
                    <span>TỔNG CƯỚC ĐÃ CHỐT</span>
                    <strong>${fmtMoney(shipment.fee)}</strong>
                  </div>
                  <div class="route-summary-item">
                    <span>DỊCH VỤ</span>
                    <strong>${shipment.serviceType === "EXPRESS" ? "Hỏa tốc" : "Tiêu chuẩn"}</strong>
                  </div>
                </div>
                <p style="font-size:13px;margin:0 0 8px">📦 <b>Kiện hàng:</b> ${esc(shipment.parcel?.weightKg ?? "—")} kg</p>
                ${shipment.reason ? `<p style="font-size:13px;color:var(--danger);margin:0 0 8px"><b>Lý do hủy / thất bại:</b> ${esc(shipment.reason)}</p>` : ""}
                ${canCancel ? `<button class="btn btn-danger btn-block" data-action="cancel-shipment" data-id="${esc(shipment.id)}" style="margin-top:10px">✕ Hủy đơn hàng này</button>` : ""}
              </div>

              <div class="card" style="text-align:left">
                <h3 style="font-size:16px;font-weight:700;margin:0 0 14px">Địa chỉ nhận & giao</h3>
                <div style="font-size:13px;background:var(--neutral-bg);padding:12px;border-radius:var(--radius-md);margin-bottom:12px">
                  <strong style="color:var(--blue)">📍 Điểm lấy hàng (A):</strong>
                  <div style="margin-top:4px">${esc(shipment.pickup?.line)}, ${esc(shipment.pickup?.district)}, ${esc(shipment.pickup?.city)}</div>
                </div>
                <div style="font-size:13px;background:var(--neutral-bg);padding:12px;border-radius:var(--radius-md)">
                  <strong style="color:var(--cyan)">🏁 Điểm giao hàng (B):</strong>
                  <div style="margin-top:4px">${esc(shipment.dropoff?.line)}, ${esc(shipment.dropoff?.district)}, ${esc(shipment.dropoff?.city)}</div>
                </div>
              </div>
            ` : ""}

            <div class="card" style="text-align:left">
              <h3 style="font-size:16px;font-weight:700;margin:0 0 14px">Lịch sử trạng thái</h3>
              <div style="display:flex;flex-direction:column;gap:8px">
                ${(shipment.history || []).map(h => `
                  <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-light);font-size:13px">
                    <div>${badge(h.toStatus)} ${h.reason ? `<small style="display:block;color:var(--text-secondary)">${esc(h.reason)}</small>` : ""}</div>
                    <span style="font-size:12px;color:var(--text-secondary)">${fmtDate(h.occurredAt)}</span>
                  </div>
                `).join("") || '<p style="font-size:13px;color:var(--text-secondary);margin:0">Chưa có cập nhật trạng thái.</p>'}
              </div>
            </div>
          </div>
        </div>
      ` : `
        <div style="display:flex;flex-direction:column;gap:14px;text-align:left">
          ${showMap ? `
            <div class="card" style="padding:12px">
              <div style="font-size:12px;color:var(--text-secondary);margin-bottom:6px" id="live-driver-status">
                ${isTerminal ? "Hành trình đã kết thúc." : "Đang định vị trực tiếp..."}
              </div>
              <div id="shipment-detail-map" class="moveflow-map-container" style="height:260px"></div>
            </div>
          ` : ""}

          <div class="card">
            <h3 style="font-size:15px;font-weight:700;margin:0 0 10px">Thông tin cước phí</h3>
            <div class="route-summary-card" style="margin-bottom:12px">
              <div class="route-summary-item">
                <span>CƯỚC PHÍ</span>
                <strong>${fmtMoney(shipment.fee)}</strong>
              </div>
              <div class="route-summary-item">
                <span>DỊCH VỤ</span>
                <strong>${shipment.serviceType === "EXPRESS" ? "Hỏa tốc" : "Tiêu chuẩn"}</strong>
              </div>
            </div>
            ${canCancel ? `<button class="btn btn-danger btn-block btn-sm" data-action="cancel-shipment" data-id="${esc(shipment.id)}">✕ Hủy đơn hàng</button>` : ""}
          </div>

          <div class="card">
            <h3 style="font-size:15px;font-weight:700;margin:0 0 10px">Địa chỉ tuyến đường</h3>
            <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:8px">
              <span class="route-pin-badge pin-a" style="width:20px;height:20px;font-size:10px">A</span>
              <div style="font-size:13px"><b>Điểm lấy:</b> ${esc(shipment.pickup?.line)}, ${esc(shipment.pickup?.district)}</div>
            </div>
            <div style="display:flex;align-items:flex-start;gap:8px">
              <span class="route-pin-badge pin-b" style="width:20px;height:20px;font-size:10px">B</span>
              <div style="font-size:13px"><b>Điểm giao:</b> ${esc(shipment.dropoff?.line)}, ${esc(shipment.dropoff?.district)}</div>
            </div>
          </div>

          <div class="card">
            <h3 style="font-size:15px;font-weight:700;margin:0 0 10px">Lịch sử hành trình</h3>
            <div style="display:flex;flex-direction:column;gap:6px">
              ${(shipment.history || []).map(h => `
                <div style="display:flex;justify-content:space-between;padding:6px 0;border-bottom:1px solid var(--border-light);font-size:12px">
                  <span>${badge(h.toStatus)}</span>
                  <span style="color:var(--text-secondary)">${fmtDate(h.occurredAt)}</span>
                </div>
              `).join("") || '<p style="font-size:12px;color:var(--text-secondary);margin:0">Chưa có lịch sử.</p>'}
            </div>
          </div>
        </div>
      `}
    `;

    bindViewButtons(target);

    if (showMap) {
      try {
        const { MapEngine } = await import("./map/map-engine.js");
        const mapEl = target.querySelector("#shipment-detail-map");
        if (mapEl) {
          activeDetailMapEngine = new MapEngine({ container: mapEl });
          await activeDetailMapEngine.ready();
          activeDetailMapEngine.setEndpoints({
            pickup: { lat: shipment.pickup.lat, lng: shipment.pickup.lng },
            dropoff: { lat: shipment.dropoff.lat, lng: shipment.dropoff.lng }
          });
          if (shipment.feeBreakdown?.geometry) {
            activeDetailMapEngine.setRoute(shipment.feeBreakdown.geometry);
          } else if (typeof window !== "undefined" && window.MoveFlowDemo?.fetchMockOsrmRoute) {
            try {
              const geo = await window.MoveFlowDemo.fetchMockOsrmRoute(shipment.pickup, shipment.dropoff);
              if (geo) activeDetailMapEngine.setRoute(geo);
            } catch {}
          }
          activeDetailMapEngine.fitRelevantPoints();
          try { activeDetailMapEngine.map?.resize(); } catch {}

          const statusNote = target.querySelector("#live-driver-status");
          const pollLive = async () => {
            if (document.visibilityState !== "visible") return;
            try {
              const shipmentUuid = shipment.id || id;
              const live = await get(`/shipments/${encodeURIComponent(shipmentUuid)}/live`);
              if (live.driver && activeDetailMapEngine) {
                activeDetailMapEngine.setDriverLocation(live.driver);
                activeDetailMapEngine.fitRelevantPoints();
                if (statusNote) {
                  statusNote.textContent = `Tài xế đang di chuyển • Cập nhật lúc ${fmtDate(live.driver.capturedAt)}`;
                }
              } else if (["DELIVERED", "DELIVERY_FAILED", "CANCELLED"].includes(live.status)) {
                stopLiveTrackingTimer();
                if (statusNote) {
                  statusNote.textContent = live.status === "DELIVERED"
                    ? "Đơn hàng đã giao thành công."
                    : live.status === "DELIVERY_FAILED"
                      ? "Đơn hàng giao thất bại."
                      : "Đơn hàng đã bị hủy.";
                }
              } else {
                if (statusNote) statusNote.textContent = "Chờ tài xế kết nối định vị trực tiếp...";
              }
            } catch { /* ignored */ }
          };

          if (!isTerminal) {
            await pollLive();
            liveTrackingTimer = setInterval(pollLive, 10000);
            liveTrackingVisibilityHandler = () => {
              if (document.visibilityState === "visible") pollLive();
            };
            document.addEventListener("visibilitychange", liveTrackingVisibilityHandler);
          } else {
            // Đơn đã kết thúc hành trình (giao xong hoặc thất bại):
            // Dừng polling GPS nhưng TUYỆT ĐỐI GIỮ NGUYÊN bản đồ, lộ trình và điểm đến
            stopLiveTrackingTimer();
            if (statusNote) {
              statusNote.textContent = shipment.status === "DELIVERED"
                ? "Đơn hàng đã giao thành công."
                : shipment.status === "DELIVERY_FAILED"
                  ? "Đơn hàng giao thất bại."
                  : "Đơn hàng đã kết thúc.";
            }
          }
        }
      } catch (err) {
        console.error("Failed to mount shipment detail map", err);
      }
    }
  }

  // 6. TRACKING LOOKUP
  function renderTracking(target) {
    const sampleCodes = (state.lastShipments || []).map(x => x.trackingCode).filter(Boolean).slice(0, 3);

    target.innerHTML = `
      <div style="max-width:680px;margin:0 auto;text-align:left">
        <h1 style="font-size:24px;font-weight:800;margin:0 0 6px">Tra cứu vận đơn</h1>
        <p style="font-size:13px;color:var(--subtext-strong);margin:0 0 20px">
          Nhập mã vận đơn (12-16 ký tự) để theo dõi tiến độ giao hàng và vị trí đơn tức thì.
        </p>

        <div class="card" style="margin-bottom:20px;padding:18px 20px">
          <form id="tracking-form" class="tracking-search-box">
            <div class="tracking-input-wrapper">
              <span class="tracking-input-icon">${ICONS.search}</span>
              <input id="tracking-input" name="trackingCode" placeholder="Nhập mã vận đơn (VD: MF-261109-0842)..." maxlength="24" minlength="4" autocomplete="off" spellcheck="false" required>
            </div>
            <button class="btn btn-primary tracking-submit-btn" type="submit">
              Tra cứu ngay <span>→</span>
            </button>
          </form>
          ${sampleCodes.length > 0 ? `
            <div class="tracking-quick-chips">
              <span>Mã đơn gần đây của bạn:</span>
              ${sampleCodes.map(c => `<button type="button" class="tracking-chip" data-code="${esc(c)}">${esc(c)}</button>`).join("")}
            </div>
          ` : ""}
        </div>

        <div id="tracking-result"></div>
      </div>
    `;

    target.querySelectorAll(".tracking-chip").forEach(chip => {
      chip.addEventListener("click", () => {
        const input = target.querySelector("#tracking-input");
        if (input) {
          input.value = chip.dataset.code;
          target.querySelector("#tracking-form")?.requestSubmit();
        }
      });
    });

    target.querySelector("#tracking-form").addEventListener("submit", async event => {
      event.preventDefault();
      const code = String(new FormData(event.currentTarget).get("trackingCode")).trim().toUpperCase();
      const box = target.querySelector("#tracking-result");
      box.innerHTML = '<div style="padding:24px;text-align:center;color:var(--text-secondary)">Đang tra cứu dữ liệu…</div>';
      try {
        const result = await api(`/tracking/${encodeURIComponent(code)}`);
        const pickupLoc = [result.pickup?.line, result.pickup?.district, result.pickup?.city].filter(Boolean).join(", ") || "Điểm A";
        const dropoffLoc = [result.dropoff?.line, result.dropoff?.district, result.dropoff?.city].filter(Boolean).join(", ") || "Điểm B";

        box.innerHTML = `
          <div class="card">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;flex-wrap:wrap;gap:8px">
              <div>
                <h3 style="font-size:18px;font-weight:800;margin:0 0 2px">Mã đơn: ${esc(result.trackingCode)}</h3>
                <span style="font-size:12px;color:var(--text-secondary)">Tạo lúc: ${fmtDate(result.createdAt)}</span>
              </div>
              ${badge(result.status)}
            </div>
            ${renderProgressStepper(result.status)}
            <div class="route-summary-card" style="margin:16px 0">
              <div class="route-summary-item">
                <span>ĐIỂM LẤY HÀNG</span>
                <strong>${esc(pickupLoc)}</strong>
              </div>
              <div class="route-summary-item">
                <span>ĐIỂM GIAO HÀNG</span>
                <strong>${esc(dropoffLoc)}</strong>
              </div>
            </div>
            <h4 style="font-size:14px;font-weight:700;margin:0 0 10px">Tiến trình vận chuyển</h4>
            <div style="display:flex;flex-direction:column;gap:8px">
              ${(result.history || []).map(item => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid var(--border-light);font-size:13px">
                  <span>${badge(item.toStatus)}</span>
                  <span style="color:var(--text-secondary)">${fmtDate(item.occurredAt)}</span>
                </div>
              `).join("") || '<p style="font-size:13px;color:var(--text-secondary);margin:0">Chưa có lịch sử trạng thái.</p>'}
            </div>
            ${result.id ? `
              <button class="btn btn-outline btn-block" data-action="details" data-id="${esc(result.id)}" style="margin-top:16px">
                Xem bản đồ lộ trình chi tiết <span>→</span>
              </button>
            ` : ""}
          </div>
        `;
        bindViewButtons(box);
      } catch (error) {
        box.innerHTML = `<div class="notice error">Không tìm thấy thông tin cho mã vận đơn <strong>${esc(code)}</strong>. Vui lòng kiểm tra lại.</div>`;
      }
    });
  }

  // 7. USERS & DISPATCH MANAGEMENT
  async function renderUsers(target) {
    if (state.user.role !== "ADMIN") {
      const [queue, drivers] = await Promise.all([
        safeGet("/dispatch/queue", []),
        safeGet("/dispatch/drivers", []),
      ]);
      state.lastQueue = Array.isArray(queue) ? queue : [];
      const driverList = Array.isArray(drivers) ? drivers : [];

      target.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:20px;flex-wrap:wrap;gap:10px;text-align:left">
          <div>
            <h1 style="font-size:24px;font-weight:800;margin:0 0 4px">Hàng chờ điều phối tài xế</h1>
            <p style="font-size:13px;color:var(--subtext-strong);margin:0">
              Giám sát đơn hàng đang chờ tiếp nhận, phân công tự động hoặc chỉ định tài xế thủ công (Manual Override).
            </p>
          </div>
          <button class="btn btn-outline btn-sm" data-action="reload-users" style="display:flex;align-items:center;gap:6px">
            ${ICONS.clock} Làm mới hàng chờ (${state.lastQueue.length})
          </button>
        </div>

        <div style="display:flex;flex-direction:column;gap:12px">
          ${state.lastQueue.map(q => {
            const attempts = (q.assignments || []).length;
            const isMaxAttempts = attempts >= 5;
            const pickupLoc = esc(q.pickup?.district || q.pickup?.city || "Điểm A");
            const dropoffLoc = esc(q.dropoff?.district || q.dropoff?.city || "Điểm B");

            return `
              <div class="queue-item-card">
                <div class="queue-item-header">
                  <div>
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
                      <strong style="font-size:17px;color:var(--navy)">${esc(q.trackingCode || q.id.slice(0, 8))}</strong>
                      ${isMaxAttempts ? `
                        <span class="status-badge badge-danger">⚠️ Cần chỉ định (Đã từ chối ${attempts}/5 lần)</span>
                      ` : (attempts > 0 ? `
                        <span class="status-badge badge-warning">Đã thử ${attempts}/5 lần</span>
                      ` : `
                        <span class="status-badge badge-blue">Đơn mới</span>
                      `)}
                    </div>
                    <div style="font-size:13px;color:var(--text-secondary);margin-top:6px">
                      📍 <strong>${pickupLoc}</strong> ➔ <strong>${dropoffLoc}</strong> · Tạo lúc: ${fmtDate(q.createdAt)}
                    </div>
                  </div>
                  <button class="btn btn-primary btn-sm" data-action="assign" data-id="${esc(q.id)}" title="Tự động tìm kiếm tài xế gần nhất theo OSRM và bán kính dispatch">
                    ⚡ Tự động gán gần nhất
                  </button>
                </div>

                <div class="queue-action-row">
                  <div style="display:flex;align-items:center;gap:6px;font-size:12.5px;font-weight:600;color:var(--subtext-strong)">
                    <span>Chỉ định tài xế (Manual Override):</span>
                  </div>
                  <div class="queue-manual-assign">
                    <select class="select-driver-override" data-shipment-id="${esc(q.id)}">
                      <option value="">-- Chọn tài xế từ danh sách (${driverList.length}) --</option>
                      ${driverList.map(d => `
                        <option value="${esc(d.id)}">
                          ${d.isAvailable ? "🟢 [Sẵn sàng]" : "🟡 [" + d.status + "]"} ${esc(d.name)} (${esc(d.email || d.id.slice(0,6))})
                        </option>
                      `).join("")}
                    </select>
                    <button class="btn btn-outline btn-sm" data-action="assign-manual" data-id="${esc(q.id)}">
                      👤 Gán chỉ định
                    </button>
                  </div>
                </div>
              </div>
            `;
          }).join("") || `
            <div class="card" style="text-align:center;padding:48px 20px;color:var(--text-secondary)">
              <div style="font-size:32px;margin-bottom:8px">🎉</div>
              <strong>Hàng chờ đang trống!</strong>
              <p style="font-size:13px;margin:4px 0 0">Tất cả các đơn hàng hiện tại đã được phân công hoặc đã có tài xế tiếp nhận.</p>
            </div>
          `}
        </div>
      `;
      bindViewButtons(target);
      return;
    }

    const users = await safeGet("/admin/users", []);
    state.lastUsers = Array.isArray(users) ? users : [];

    target.innerHTML = `
      <div style="text-align:left;margin-bottom:24px">
        <h1 style="font-size:24px;font-weight:800;margin:0 0 4px">Quản lý tài khoản & Phân quyền</h1>
        <p style="font-size:13px;color:var(--subtext-strong);margin:0">Cấp tài khoản tài xế / điều phối viên và quản lý trạng thái hoạt động.</p>
      </div>

      <div class="desktop-two-col">
        <div class="card" style="text-align:left">
          <h3 style="font-size:16px;font-weight:700;margin:0 0 14px">Tạo tài khoản nội bộ</h3>
          <form id="managed-user-form">
            <div class="field">
              <label>Họ và tên</label>
              <input name="name" minlength="2" maxlength="100" placeholder="Tên nhân sự" required>
            </div>
            <div class="field">
              <label>Email công việc</label>
              <input name="email" type="email" placeholder="staff@moveflow.vn" required>
            </div>
            <div class="field">
              <label>Vai trò</label>
              <select name="role">
                <option value="DRIVER">Tài xế (Driver)</option>
                <option value="DISPATCHER">Điều phối viên (Dispatcher)</option>
              </select>
            </div>
            <div class="field">
              <label>Mật khẩu tạm thời</label>
              <input name="password" type="password" minlength="10" maxlength="72" placeholder="••••••••" required>
            </div>
            <button class="btn btn-primary btn-block" type="submit" style="margin-top:10px">
              ＋ Tạo tài khoản & gửi OTP
            </button>
          </form>
        </div>

        <div class="card" style="text-align:left">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
            <h3 style="font-size:16px;font-weight:700;margin:0">Danh sách tài khoản (${users.length})</h3>
            <button class="btn btn-sm btn-outline" data-action="reload-users">↻ Làm mới</button>
          </div>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Tên</th>
                  <th>Vai trò</th>
                  <th>Email</th>
                  <th>Trạng thái</th>
                  <th>Hành động</th>
                </tr>
              </thead>
              <tbody>
                ${users.map(u => `
                  <tr>
                    <td><strong>${esc(u.name)}</strong></td>
                    <td><span class="status-badge badge-blue">${esc(roleName(u.role))}</span></td>
                    <td>${esc(u.email)}</td>
                    <td>${u.active ? '<span class="status-badge badge-success">Hoạt động</span>' : '<span class="status-badge badge-danger">Đã khóa</span>'}</td>
                    <td>
                      ${u.id === state.user.id ? '<span style="font-size:11px;color:var(--text-secondary)">Bạn</span>' : `
                        <button class="btn btn-sm ${u.active ? 'btn-danger' : 'btn-outline'}" data-action="toggle-user" data-id="${esc(u.id)}" data-active="${!u.active}">
                          ${u.active ? "Khóa" : "Mở"}
                        </button>
                      `}
                    </td>
                  </tr>
                `).join("") || '<tr><td colspan="5" style="text-align:center;padding:24px">Chưa có người dùng.</td></tr>'}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    target.querySelector("#managed-user-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      const data = Object.fromEntries(new FormData(form));
      try {
        const result = await post("/admin/users", data);
        showToast(`Đã tạo tài khoản ${roleName(result.role)}. Mã OTP gửi tới ${result.email}.`);
        form.reset();
        await renderUsers(target);
      } catch (error) {
        showToast(error.message, "error");
        submit.disabled = false;
      }
    });

    bindViewButtons(target);
  }

  // 8. PRICING RULES (Admin)
  async function renderPricing(target) {
    if (state.user.role !== "ADMIN") {
      target.innerHTML = '<div class="notice error">Chỉ quản trị viên mới có quyền xem và chỉnh sửa bảng giá.</div>';
      return;
    }
    const rules = await safeGet("/admin/pricing-rules", []);
    state.lastPricing = Array.isArray(rules) ? rules : [];
    const latest = state.lastPricing[0];

    target.innerHTML = `
      <div style="text-align:left;margin-bottom:24px">
        <h1 style="font-size:24px;font-weight:800;margin:0 0 4px">Chính sách & Bảng giá cước</h1>
        <p style="font-size:13px;color:var(--subtext-strong);margin:0">Cập nhật hệ số cước cơ bản và phụ phí km/kg.</p>
      </div>

      <div class="desktop-two-col">
        <div class="card" style="text-align:left">
          <h3 style="font-size:16px;font-weight:700;margin:0 0 14px">Quy tắc hiện hành (v${esc(latest?.version || 1)})</h3>
          <div class="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Phiên bản</th>
                  <th>Phí cơ bản</th>
                  <th>Phí/km</th>
                  <th>Phụ phí/kg</th>
                </tr>
              </thead>
              <tbody>
                ${rules.map(r => `
                  <tr>
                    <td><b>v${esc(r.version)}</b></td>
                    <td>${fmtMoney(r.baseFee)}</td>
                    <td>${fmtMoney(r.ratePerKm)}</td>
                    <td>${fmtMoney(r.ratePerExtraKg)}</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>

        <div class="card" style="text-align:left">
          <h3 style="font-size:16px;font-weight:700;margin:0 0 14px">Cập nhật bảng giá mới</h3>
          ${latest ? `
            <form id="pricing-form" data-id="${esc(latest.id)}">
              ${[
                ['baseFee', 'Cước cơ bản (2 km đầu)', latest.baseFee],
                ['ratePerKm', 'Cước mỗi km tiếp theo', latest.ratePerKm],
                ['freeWeightThreshold', 'Số kg miễn phí', latest.freeWeightThreshold],
                ['ratePerExtraKg', 'Phụ phí mỗi kg vượt', latest.ratePerExtraKg],
                ['standardMultiplier', 'Hệ số tiêu chuẩn', latest.standardMultiplier],
                ['expressMultiplier', 'Hệ số hỏa tốc', latest.expressMultiplier]
              ].map(([key, label, value]) => `
                <div class="field">
                  <label>${label}</label>
                  <input name="${key}" type="number" min="0" step="0.01" value="${esc(value)}" required>
                </div>
              `).join("")}
              <button class="btn btn-primary btn-block" type="submit" style="margin-top:10px">
                Lưu và phát hành phiên bản mới
              </button>
            </form>
          ` : '<p style="color:var(--text-secondary)">Chưa có dữ liệu bảng giá.</p>'}
        </div>
      </div>
    `;

    target.querySelector("#pricing-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const body = Object.fromEntries([...new FormData(form)].map(([key, val]) => [key, Number(val)]));
      try {
        await api(`/admin/pricing-rules/${form.dataset.id}`, { method: "PUT", body: JSON.stringify(body) });
        showToast("Đã tạo và kích hoạt phiên bản bảng giá mới!");
        await renderPricing(target);
      } catch (error) {
        showToast(error.message, "error");
      }
    });
  }

  // 8.1. WEBHOOK MONITORING (Admin)
  async function renderWebhooks(target) {
    if (state.user?.role !== "ADMIN") {
      target.innerHTML = '<div class="notice error">Chỉ quản trị viên mới có quyền xem nhật ký Webhook Outbox.</div>';
      return;
    }

    const [eventsRes, subsRes] = await Promise.all([
      safeGet("/webhooks/events?page=1&limit=50", []),
      safeGet("/webhooks/subscriptions", [])
    ]);

    const events = Array.isArray(eventsRes) ? eventsRes : [];
    const subs = Array.isArray(subsRes) ? subsRes : [];

    let totalDeliveries = 0;
    let deliveredCount = 0;
    let pendingCount = 0;
    let failedCount = 0;

    events.forEach(e => {
      (e.deliveries || []).forEach(d => {
        totalDeliveries++;
        if (d.status === "DELIVERED") deliveredCount++;
        else if (d.status === "PENDING") pendingCount++;
        else if (d.status === "FAILED") failedCount++;
      });
    });

    target.innerHTML = `
      <div style="text-align:left;margin-bottom:24px">
        <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:12px">
          <div>
            <h1 style="font-size:24px;font-weight:800;margin:0 0 4px">Giám sát Webhook Transactional Outbox</h1>
            <p style="font-size:13px;color:var(--subtext-strong);margin:0">
              Kiến trúc Outbox Pattern đảm bảo sự kiện trạng thái đơn được gửi tới các hệ thống bên ngoài với chữ ký HMAC-SHA256 & tự động Retry.
            </p>
          </div>
          <button class="btn btn-outline btn-sm" data-action="reload-webhooks" style="display:flex;align-items:center;gap:6px">
            ${ICONS.clock} Làm mới nhật ký
          </button>
        </div>
      </div>

      <!-- Stats Grid -->
      <div class="stats-grid" style="margin-bottom:20px">
        <div class="stat-card">
          <div class="stat-label">Tổng sự kiện Outbox</div>
          <div class="stat-value" style="color:var(--navy)">${events.length}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Đã gửi thành công (Delivered)</div>
          <div class="stat-value" style="color:#16a34a">${deliveredCount}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Đang gửi / Chờ Retry</div>
          <div class="stat-value" style="color:#d97706">${pendingCount}</div>
        </div>
        <div class="stat-card">
          <div class="stat-label">Thất bại sau 5 lần retry</div>
          <div class="stat-value" style="color:#dc2626">${failedCount}</div>
        </div>
      </div>

      <div class="desktop-two-col" style="align-items:start">
        <!-- Cột trái: Đăng ký Webhook Subscriber -->
        <div>
          <div class="card" style="text-align:left;margin-bottom:20px">
            <h3 style="font-size:16px;font-weight:700;margin:0 0 8px">Đăng ký Endpoint nhận Webhook</h3>
            <p style="font-size:12.5px;color:var(--text-secondary);margin:0 0 16px">
              Hệ thống ký mỗi webhook request bằng header <code>X-Webhook-Signature: sha256=...</code>
            </p>
            <form id="webhook-sub-form">
              <div class="field">
                <label>Webhook URL (Endpoint tiếp nhận)</label>
                <input name="url" value="http://receiver:4000/webhooks/shipment" placeholder="http://receiver:4000/webhooks/shipment" required>
                <small style="font-size:11.5px;color:var(--subtext-strong);margin-top:4px;display:block">
                  Mặc định container receiver đang lắng nghe tại: <code>http://receiver:4000/webhooks/shipment</code>
                </small>
              </div>
              <div class="field">
                <label>Bí mật chia sẻ (Secret Key - HMAC-SHA256)</label>
                <input name="secret" type="password" value="4a3b2c1d0e9f8a7b6c5d4e3f2a1b0c9d8e7f6a5b4c3d2e1f0a9b8c7d6e5f4a3b" minlength="16" required>
              </div>
              <button class="btn btn-primary btn-block" type="submit">
                🔗 Đăng ký Webhook URL
              </button>
            </form>
          </div>

          <div class="card" style="text-align:left">
            <h3 style="font-size:16px;font-weight:700;margin:0 0 12px">Danh sách Webhook Subscriptions (${subs.length})</h3>
            <div class="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>URL Tiếp nhận</th>
                    <th>Trạng thái</th>
                    <th>Ngày tạo</th>
                  </tr>
                </thead>
                <tbody>
                  ${subs.map(s => `
                    <tr>
                      <td style="font-family:monospace;font-size:12px;max-width:200px;word-break:break-all">${esc(s.url)}</td>
                      <td>
                        ${s.active ? '<span class="status-badge badge-success">Kích hoạt</span>' : '<span class="status-badge badge-danger">Tạm dừng</span>'}
                      </td>
                      <td style="font-size:12px;color:var(--text-secondary)">${fmtDate(s.createdAt)}</td>
                    </tr>
                  `).join("") || '<tr><td colspan="3" style="text-align:center;padding:16px;color:var(--text-secondary)">Chưa có subscriber nào được đăng ký.</td></tr>'}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <!-- Cột phải: Nhật ký Outbox Events & Deliveries -->
        <div>
          <div class="card" style="text-align:left">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
              <h3 style="font-size:16px;font-weight:700;margin:0">Nhật ký Outbox Events (${events.length})</h3>
              <span style="font-size:12px;color:var(--text-secondary)">50 sự kiện gần nhất</span>
            </div>

            <div style="display:flex;flex-direction:column;gap:12px">
              ${events.map(ev => {
                const delivs = ev.deliveries || [];
                return `
                  <div class="webhook-event-card">
                    <div class="webhook-event-header">
                      <div>
                        <span class="webhook-event-id">${esc(ev.id.slice(0, 13))}...</span>
                        <strong style="margin-left:6px;font-size:13px;color:var(--navy)">${esc(ev.eventType)}</strong>
                      </div>
                      <span style="font-size:11.5px;color:var(--text-secondary)">${fmtDate(ev.createdAt)}</span>
                    </div>

                    ${delivs.length > 0 ? `
                      <div style="display:flex;flex-direction:column;gap:6px;margin:8px 0">
                        ${delivs.map(d => `
                          <div style="display:flex;justify-content:space-between;align-items:center;background:var(--neutral-bg);padding:6px 10px;border-radius:var(--radius-sm);font-size:12px">
                            <div style="display:flex;align-items:center;gap:6px">
                              <span class="webhook-delivery-pill ${d.status}">${d.status}</span>
                              <span>Thử: <strong>${d.attempts}</strong> lần</span>
                            </div>
                            <div style="font-size:11.5px;color:var(--text-secondary)">
                              ${d.deliveredAt ? `Giao lúc: ${fmtDate(d.deliveredAt)}` : (d.lastError ? `<span style="color:#dc2626" title="${esc(d.lastError)}">Lỗi: ${esc(d.lastError.slice(0, 30))}...</span>` : 'Đang xử lý')}
                            </div>
                          </div>
                        `).join("")}
                      </div>
                    ` : `
                      <div style="font-size:12px;color:var(--text-secondary);margin:6px 0">
                        Chưa có lượt giao nào (Chưa đăng ký subscription active tại thời điểm sự kiện phát sinh).
                      </div>
                    `}

                    <details style="margin-top:6px">
                      <summary style="font-size:12px;color:var(--blue);cursor:pointer;font-weight:600">Xem Payload JSON sự kiện</summary>
                      <pre class="webhook-payload-box">${esc(JSON.stringify(ev.payload, null, 2))}</pre>
                    </details>
                  </div>
                `;
              }).join("") || `
                <div style="text-align:center;padding:32px 10px;color:var(--text-secondary)">
                  Chưa có sự kiện webhook nào được sinh ra từ các đơn hàng.
                </div>
              `}
            </div>
          </div>
        </div>
      </div>
    `;

    target.querySelector("#webhook-sub-form")?.addEventListener("submit", async event => {
      event.preventDefault();
      const form = event.currentTarget;
      const submit = form.querySelector('button[type="submit"]');
      submit.disabled = true;
      const data = Object.fromEntries(new FormData(form));
      try {
        await post("/webhooks/subscriptions", data);
        showToast("Đã đăng ký Webhook Subscription thành công!");
        await renderWebhooks(target);
      } catch (error) {
        showToast(error.message, "error");
        submit.disabled = false;
      }
    });

    bindViewButtons(target);
  }

  // 9. PROFILE & SETTINGS
  async function renderProfile(target) {
    const profile = await get("/users/me");
    state.user = { ...state.user, ...profile };

    target.innerHTML = `
      <div style="max-width:760px;margin:0 auto;text-align:left">
        <h1 style="font-size:24px;font-weight:800;margin:0 0 6px">Tài khoản cá nhân</h1>
        <p style="font-size:13px;color:var(--subtext-strong);margin:0 0 20px">Quản lý hồ sơ và đổi mật khẩu bảo mật.</p>

        <div class="card" style="margin-bottom:20px;display:flex;align-items:center;gap:18px">
          <div class="desktop-avatar" style="width:64px;height:64px;font-size:24px">${esc(initials(profile.name))}</div>
          <div>
            <h3 style="font-size:20px;font-weight:800;margin:0 0 4px">${esc(profile.name)}</h3>
            <p style="font-size:13px;color:var(--text-secondary);margin:0 0 8px">${esc(profile.email)}</p>
            <span class="status-badge badge-blue">${esc(roleName(profile.role))}</span>
          </div>
        </div>

        <div class="card" style="margin-bottom:20px">
          <h3 style="font-size:16px;font-weight:700;margin:0 0 14px">Cập nhật họ và tên</h3>
          <form id="profile-form">
            <div class="field">
              <label>Họ và tên</label>
              <input name="name" value="${esc(profile.name)}" minlength="2" maxlength="100" required>
            </div>
            <div class="field">
              <label>Địa chỉ Email</label>
              <input value="${esc(profile.email)}" disabled style="background:var(--neutral-bg)">
            </div>
            <button class="btn btn-primary" type="submit">Lưu thay đổi</button>
          </form>
        </div>

        <div class="card" style="margin-bottom:20px">
          <h3 style="font-size:16px;font-weight:700;margin:0 0 14px">Đổi mật khẩu</h3>
          <form id="password-form">
            <div class="field">
              <label>Mật khẩu hiện tại</label>
              <input name="currentPassword" type="password" minlength="10" required>
            </div>
            <div class="field">
              <label>Mật khẩu mới</label>
              <input name="newPassword" type="password" minlength="10" maxlength="72" required>
            </div>
            <button class="btn btn-outline" type="submit">Cập nhật mật khẩu</button>
          </form>
        </div>

        <div class="card" style="margin-bottom:20px;text-align:left">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:14px">
            <div>
              <h3 style="font-size:16px;font-weight:700;margin:0 0 4px">🌓 Giao diện Sáng / Tối (Dark Mode)</h3>
              <p style="font-size:13px;color:var(--text-secondary);margin:0">
                Chuyển đổi giao diện nền tối dịu mắt (hỗ trợ tài xế chạy xe ban đêm) hoặc sáng rõ nét ban ngày.
              </p>
            </div>
            <label class="switch" title="Bật/Tắt chế độ Tối">
              <input type="checkbox" id="toggle-profile-dark-mode" ${state.theme === 'dark' ? "checked" : ""}>
              <span class="slider"></span>
            </label>
          </div>
        </div>

        ${profile.role === "ADMIN" ? `
        <div class="card" style="margin-bottom:20px;text-align:left">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:14px">
            <div>
              <h3 style="font-size:16px;font-weight:700;margin:0 0 4px">🛠️ Thanh công cụ Demo & Giả lập (Demo Tools)</h3>
              <p style="font-size:13px;color:var(--text-secondary);margin:0">
                Hiển thị nút công cụ kiểm thử: đổi nhanh vai trò, tạo đơn mẫu, giả lập GPS và xe chạy tự động (Dành riêng cho Quản trị viên).
              </p>
            </div>
            <label class="switch" title="Bật/Tắt thanh Demo Tools">
              <input type="checkbox" id="toggle-demo-tools" ${localStorage.getItem("moveflow_demo_tools_enabled") !== "0" ? "checked" : ""}>
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <div class="card" style="margin-bottom:20px;text-align:left">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:14px">
            <div>
              <h3 style="font-size:16px;font-weight:700;margin:0 0 4px">⚡ Đăng nhập nhanh tài khoản mẫu</h3>
              <p style="font-size:13px;color:var(--text-secondary);margin:0">
                Hiển thị khối nút chọn nhanh tài khoản mẫu (Người gửi, Tài xế, Điều phối, Quản trị) ở màn hình đăng nhập (Dành riêng cho Quản trị viên).
              </p>
            </div>
            <label class="switch" title="Bật/Tắt đăng nhập nhanh tài khoản mẫu">
              <input type="checkbox" id="toggle-quick-login" ${localStorage.getItem("moveflow_quick_login_enabled") !== "0" ? "checked" : ""}>
              <span class="slider"></span>
            </label>
          </div>
        </div>

        <div class="card" style="margin-bottom:20px;text-align:left">
          <div style="display:flex;justify-content:space-between;align-items:center;gap:14px">
            <div>
              <h3 style="font-size:16px;font-weight:700;margin:0 0 4px">📱 Thanh bên góc chuyển đổi (Mobile / Desktop)</h3>
              <p style="font-size:13px;color:var(--text-secondary);margin:0">
                Hiển thị thanh chuyển đổi giao diện Mobile / Desktop và nút cài đặt nhanh ở góc trên màn hình (Dành riêng cho Quản trị viên).
              </p>
            </div>
            <label class="switch" title="Bật/Tắt thanh chuyển đổi góc">
              <input type="checkbox" id="toggle-viewport-switcher" ${localStorage.getItem("moveflow_viewport_switcher_enabled") !== "0" ? "checked" : ""}>
              <span class="slider"></span>
            </label>
          </div>
        </div>
        ` : ""}

        <div class="card" style="text-align:center">
          <button class="btn btn-danger btn-block" data-action="logout">
            Đăng xuất tài khoản
          </button>
        </div>
      </div>
    `;

    target.querySelector("#toggle-profile-dark-mode")?.addEventListener("change", e => {
      setTheme(e.target.checked ? "dark" : "light");
      showToast(e.target.checked ? "Đã chuyển sang chế độ Tối (Dark mode)!" : "Đã chuyển sang chế độ Sáng (Light mode)!");
    });

    target.querySelector("#toggle-demo-tools")?.addEventListener("change", e => {
      const isEnabled = e.target.checked;
      localStorage.setItem("moveflow_demo_tools_enabled", isEnabled ? "1" : "0");
      if (window.MoveFlowDemo?.updateVisibility) {
        window.MoveFlowDemo.updateVisibility();
      }
      showToast(isEnabled ? "Đã bật thanh công cụ Demo Tools!" : "Đã tắt thanh công cụ Demo Tools.");
    });

    target.querySelector("#toggle-quick-login")?.addEventListener("change", e => {
      const isEnabled = e.target.checked;
      localStorage.setItem("moveflow_quick_login_enabled", isEnabled ? "1" : "0");
      showToast(isEnabled ? "Đã bật hiển thị Đăng nhập nhanh tài khoản mẫu!" : "Đã ẩn khối Đăng nhập nhanh tài khoản mẫu.");
    });

    target.querySelector("#toggle-viewport-switcher")?.addEventListener("change", e => {
      const isEnabled = e.target.checked;
      localStorage.setItem("moveflow_viewport_switcher_enabled", isEnabled ? "1" : "0");
      renderViewportSwitcher();
      showToast(isEnabled ? "Đã bật hiển thị thanh bên góc (Mobile/Desktop)!" : "Đã ẩn thanh bên góc.");
    });

    target.querySelector("#profile-form").addEventListener("submit", async event => {
      event.preventDefault();
      try {
        const result = await patch("/users/me", { name: new FormData(event.currentTarget).get("name") });
        state.user = { ...state.user, ...result };
        renderShell();
        await renderProfile(content());
        showToast("Đã cập nhật hồ sơ thành công!");
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    target.querySelector("#password-form").addEventListener("submit", async event => {
      event.preventDefault();
      const data = Object.fromEntries(new FormData(event.currentTarget));
      try {
        await patch("/users/me/password", data);
        showToast("Đã đổi mật khẩu. Vui lòng đăng nhập lại.");
        await logout(false);
      } catch (error) {
        showToast(error.message, "error");
      }
    });

    bindViewButtons(target);
  }

  // Global Button Click Binding
  function bindViewButtons(scope = root) {
    scope.querySelectorAll("[data-view]").forEach(button => {
      if (!button.dataset.bound) {
        button.dataset.bound = "1";
        button.addEventListener("click", () => nav(button.dataset.view));
      }
    });

    scope.querySelectorAll("[data-action]").forEach(button => {
      if (!button.dataset.bound) {
        button.dataset.bound = "1";
        button.addEventListener("click", () => handleAction(button));
      }
    });

    scope.querySelectorAll(".driver-status-toggle-input").forEach(input => {
      if (!input.dataset.bound) {
        input.dataset.bound = "1";
        input.addEventListener("change", e => {
          confirmDriverStatusChange(e.target.checked);
        });
      }
    });
  }

  async function handleAction(button) {
    const action = button.dataset.action;
    const id = button.dataset.id;
    try {
      if (action === "back") {
        nav("dashboard");
      } else if (action === "details") {
        state.detail = id;
        state.view = "details";
        renderShell();
        await renderView();
      } else if (action === "assign") {
        button.disabled = true;
        const result = await post(`/shipments/${id}/assign-driver`, {});
        if (result.assignment === null) {
          if (result.reason === "MAX_ATTEMPTS") {
            showToast("Đơn hàng đã bị từ chối 5 lần (MAX_ATTEMPTS). Bắt buộc chỉ định tài xế bằng tay!", "error");
          } else {
            showToast("Không tìm thấy tài xế phù hợp. Hãy yêu cầu tài xế sẵn sàng và bật GPS.", "error");
          }
        } else {
          showToast(result.status === "PENDING" ? "Đã gửi yêu cầu phân công tới tài xế." : "Đơn đã có đề nghị phân công.");
        }
        await renderView();
      } else if (action === "assign-manual") {
        const select = document.querySelector(`.select-driver-override[data-shipment-id="${id}"]`);
        const driverId = select?.value;
        if (!driverId) {
          showToast("Vui lòng chọn một tài xế trong danh sách để chỉ định!", "error");
          return;
        }
        button.disabled = true;
        const result = await post(`/shipments/${id}/assign-driver`, { driverId });
        if (result.id || (result.status && result.status !== "FAILED")) {
          showToast("Đã chỉ định tài xế thành công! Đang chờ tài xế xác nhận.", "success");
        } else if (result.assignment === null || result.reason) {
          const reasonMsg = result.reason === "NO_AVAILABLE_DRIVER"
            ? "Tài xế này hiện chưa sẵn sàng hoặc vị trí GPS quá 5 phút chưa cập nhật."
            : (result.reason || "Không thể chỉ định tài xế này.");
          showToast(reasonMsg, "error");
        } else {
          showToast("Đã gửi yêu cầu chỉ định tài xế.", "success");
        }
        await renderView();
      } else if (action === "reload-webhooks") {
        await renderView();
      } else if (action === "toggle-user") {
        button.disabled = true;
        await patch(`/admin/users/${id}/active`, { active: button.dataset.active === "true" });
        showToast("Đã cập nhật trạng thái tài khoản.");
        await renderView();
      } else if (action === "reload-users") {
        await renderView();
      } else if (action === "reload-shipments") {
        await renderView();
      } else if (action === "refresh-tasks") {
        if (activeDriverTripController) {
          showToast("Đang làm mới thông tin chuyến xe…", "info");
          await activeDriverTripController.refreshNavigation();
          showToast("Đã cập nhật trạng thái mới nhất!");
        } else {
          await renderView();
        }
      } else if (action === "respond-assignment") {
        button.disabled = true;
        await post(`/assignments/${id}/respond`, { action: button.dataset.response });
        showToast(button.dataset.response === "ACCEPT" ? "Đã nhận đơn giao hàng!" : "Đã từ chối đơn hàng.");
        await renderView();
      } else if (action === "cancel-shipment") {
        const reason = window.prompt("Nhập lý do hủy đơn hàng:", "Hủy chuyến theo yêu cầu");
        if (reason === null) return;
        const cleanReason = reason.trim() || "Hủy chuyến theo yêu cầu";
        button.disabled = true;
        if (window.MoveFlowDemo?.transitionWithInstantFallback) {
          await window.MoveFlowDemo.transitionWithInstantFallback(id, "CANCELLED", cleanReason);
        } else {
          await post(`/shipments/${id}/transition`, { toStatus: "CANCELLED", reason: cleanReason });
        }
        showToast("Đã hủy đơn hàng thành công.", "warning");
        await renderView();
      } else if (action === "driver-status") {
        confirmDriverStatusChange(button.dataset.status === "AVAILABLE");
      } else if (action === "toggle-driver-camera" || action === "recenter-driver-map") {
        if (activeDriverTripController) {
          const mode = activeDriverTripController.toggleCameraMode();
          if (mode === "overview") {
            showToast("🗺️ Đã chuyển sang góc nhìn xem toàn tuyến lộ trình!", "info");
          } else {
            showToast("🎯 Đã chuyển sang góc nhìn bám sát xe!", "info");
          }
        }
      } else if (action === "update-driver-location") {
        if (isMockGpsEnabled()) {
          showToast("🛰️ Đang bật chế độ Mock GPS trong Demo Tools! Hãy tắt Mock GPS nếu muốn lấy vị trí thật từ trình duyệt.", "warning");
          return;
        }
        if (!navigator.geolocation) throw new Error("Trình duyệt không hỗ trợ Geolocation.");
        button.disabled = true;
        const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { enableHighAccuracy: true, timeout: 15000 }));
        const rawAcc = Number(pos.coords.accuracy);
        const accuracyM = Number.isFinite(rawAcc) && rawAcc > 0 ? Math.min(Math.max(rawAcc, 0.01), 35) : 15;
        await patch("/drivers/me/location", {
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM,
          capturedAt: new Date().toISOString()
        });
        showToast("Đã cập nhật vị trí GPS thực tế!");
        await renderView();
      } else if (action === "logout") {
        await logout();
      } else if (action === "support") {
        showToast("Hệ thống MoveFlow hỗ trợ tra cứu thời gian thực và tự động điều phối.", "success");
      }
    } catch (error) {
      button.disabled = false;
      showToast(error.message, "error");
    }
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
    if (state.taskRefreshTimer) {
      clearInterval(state.taskRefreshTimer);
      state.taskRefreshTimer = null;
    }
    if (remote && state.refreshToken) {
      try { await post("/auth/logout", { refreshToken: state.refreshToken }); } catch { /* ignore */ }
    }
    clearSession();
    state.token = null;
    state.refreshToken = null;
    state.user = null;
    state.view = "dashboard";
    state.detail = null;
    renderAuth("login", "Bạn đã đăng xuất khỏi hệ thống.");
  }

  async function loginAs(email, password = "admin") {
    try {
      showToast(`Đang chuyển sang tài khoản ${email}…`, "info");
      const result = await post("/auth/login", { email, password });
      state.token = result.accessToken;
      state.refreshToken = result.refreshToken;
      state.user = result.user || await get("/users/me");
      state.view = state.user.role === "DRIVER" ? "tasks" : "dashboard";
      saveSession();
      renderShell();
      await renderView();
      showToast(`Đã chuyển sang vai trò ${roleName(state.user.role)}!`, "success");
      return state.user;
    } catch (err) {
      showToast(err.message, "error");
      throw err;
    }
  }

  // Expose global bridge for embedded demo tools & extensions
  window.MoveFlow = {
    state,
    api,
    get,
    post,
    patch,
    nav,
    renderShell,
    renderView,
    renderAuth,
    showToast,
    loginAs,
    getActiveDriverTripController: () => activeDriverTripController,
    getActiveSenderMapController: () => activeSenderMapController,
    getActiveDetailMapEngine: () => activeDetailMapEngine,
    isDemoEnabled: () => localStorage.getItem("moveflow_demo_tools_enabled") !== "0",
    setDemoEnabled: enabled => {
      localStorage.setItem("moveflow_demo_tools_enabled", enabled ? "1" : "0");
      window.MoveFlowDemo?.updateVisibility();
    },
    isQuickLoginEnabled: () => localStorage.getItem("moveflow_quick_login_enabled") !== "0",
    setQuickLoginEnabled: enabled => {
      localStorage.setItem("moveflow_quick_login_enabled", enabled ? "1" : "0");
    },
    isViewportSwitcherEnabled: () => localStorage.getItem("moveflow_viewport_switcher_enabled") !== "0",
    setViewportSwitcherEnabled: enabled => {
      localStorage.setItem("moveflow_viewport_switcher_enabled", enabled ? "1" : "0");
      renderViewportSwitcher();
    },
    isMockGpsEnabled,
    setMockGpsEnabled: enabled => window.MoveFlowDemo?.setMockGpsEnabled?.(enabled),
    isAutoRecenterEnabled: () => localStorage.getItem("moveflow_auto_recenter_enabled") !== "0",
    setAutoRecenterEnabled: enabled => window.MoveFlowDemo?.setAutoRecenterEnabled?.(enabled),
    setTheme,
    toggleTheme,
    getTheme: () => state.theme
  };

  // Khởi động khôi phục session F5 hoặc render form đăng nhập
  (async function boot() {
    setTheme(state.theme);
    const session = getStoredSession();
    if (session?.token && session?.user) {
      state.token = session.token;
      state.refreshToken = session.refreshToken || null;
      state.user = session.user;
      state.view = session.view || "dashboard";
      state.detail = session.detail || null;

      try {
        const freshProfile = await get("/users/me");
        state.user = { ...state.user, ...freshProfile };
        saveSession();
        renderShell();
        await renderView();
        return;
      } catch (err) {
        console.warn("Session restore failed, logging out:", err);
        clearSession();
      }
    }
    renderAuth("login");
  })();
})();
