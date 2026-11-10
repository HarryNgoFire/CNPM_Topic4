/**
 * MoveFlow Demo & Developer Toolkit Module
 * Nhúng bộ công cụ kiểm thử toàn diện:
 * - Đăng nhập nhanh 1-Click cho 5 vai trò (Sender, Driver A, Driver B, Dispatcher, Admin)
 * - Tự động đổi vai trò thông minh khi bấm tác vụ (không bao giờ báo lỗi quyền)
 * - Tạo đơn mẫu chuẩn xác, tự động điều phối gán tài xế khả dụng
 * - Giả lập quy trình tài xế: Nhận đơn, Đến điểm A, Lấy hàng, Đến điểm B, Giao thành công
 * - 🎲 Đặt tài xế ngẫu nhiên (không dùng GPS thiết bị thật) & tự vẽ lộ trình OSRM tới điểm A
 * - ▶️ Mô phỏng xe chạy tự động mượt mà trên bản đồ theo lộ trình đường phố thực tế
 * - Bật/tắt thanh công cụ đồng bộ hoàn hảo với Cài đặt Admin
 */
(() => {
  const SAMPLES = {
    pickup: {
      line: "123 Đường Nguyễn Huệ",
      ward: "Bến Nghé",
      district: "Quận 1",
      city: "Thành phố Hồ Chí Minh",
      lat: 10.7745,
      lng: 106.7042
    },
    dropoff: {
      line: "456 Đường Nguyễn Thị Thập",
      ward: "Tân Phong",
      district: "Quận 7",
      city: "Thành phố Hồ Chí Minh",
      lat: 10.7385,
      lng: 106.7058
    },
    parcel: {
      weightKg: 2,
      lengthCm: 20,
      widthCm: 15,
      heightCm: 10
    },
    serviceType: "STANDARD"
  };

  let movementInterval = null;
  let movementStep = 0;
  let simulatedPoints = [];

  // --- Đồng bộ vị trí giả lập lên server theo đúng luật chống GPS ảo của backend ---
  // Backend (geo.ts): chỉ nhận 1 điểm / 5s, tốc độ giữa 2 điểm <= 55 m/s,
  // và geofence "đã đến" yêu cầu vị trí không cũ hơn 30s.
  const DEFAULT_SIM_SPEED_KMH = 100;     // ~27.8 m/s: mặc định vừa nhanh để demo vừa dưới ngưỡng 55 m/s
  const SERVER_MIN_INTERVAL_MS = 5000;
  const SERVER_SYNC_INTERVAL_MS = 5500;
  const SERVER_MAX_SPEED_MPS = 50;       // chừa biên an toàn so với 55 m/s
  const KEEPALIVE_INTERVAL_MS = 20000;
  let lastServerSync = { time: 0, point: null };
  let keepAliveTimer = null;

  function getSimSpeedKmh() {
    const raw = Number(localStorage.getItem("moveflow_sim_speed_kmh"));
    if (Number.isFinite(raw) && raw >= 5 && raw <= 1000) {
      return Math.round(raw);
    }
    return DEFAULT_SIM_SPEED_KMH;
  }

  function getSimSpeedMps() {
    return getSimSpeedKmh() / 3.6;
  }

  function setSimSpeedKmh(kmh, silent = false) {
    const num = Number(kmh);
    const clamped = Number.isFinite(num) ? Math.min(1000, Math.max(5, Math.round(num))) : DEFAULT_SIM_SPEED_KMH;
    localStorage.setItem("moveflow_sim_speed_kmh", String(clamped));

    // Đồng bộ tất cả control tốc độ trên màn hình (Cockpit & Demo Modal)
    document.querySelectorAll(".demo-speed-slider").forEach(el => {
      el.value = String(Math.min(500, clamped));
    });
    document.querySelectorAll(".demo-speed-input").forEach(el => {
      if (document.activeElement !== el) el.value = String(clamped);
    });
    document.querySelectorAll(".demo-speed-label-val").forEach(el => {
      el.textContent = `${clamped} km/h`;
    });
    document.querySelectorAll(".demo-speed-preset-btn").forEach(btn => {
      btn.classList.toggle("active", Number(btn.dataset.speed) === clamped);
    });
    const quickSelect = document.getElementById("trip-sim-speed-select");
    if (quickSelect) {
      const hasOption = Array.from(quickSelect.options).some(opt => Number(opt.value) === clamped);
      if (!hasOption) {
        let customOpt = quickSelect.querySelector('option[data-custom="1"]');
        if (!customOpt) {
          customOpt = document.createElement("option");
          customOpt.dataset.custom = "1";
          quickSelect.appendChild(customOpt);
        }
        customOpt.value = String(clamped);
        customOpt.textContent = `⚡ ${clamped} km/h`;
      }
      quickSelect.value = String(clamped);
    }

    if (!movementInterval) {
      const sheetSpeed = document.getElementById("sheet-speed");
      if (sheetSpeed) {
        sheetSpeed.textContent = `0 km/h (Đặt: ${clamped})`;
      }
    }

    if (!silent) {
      getMf()?.showToast?.(`⚡ Đã đặt tốc độ tài xế: ${clamped} km/h`, "info");
    }
    return clamped;
  }

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function distanceMeters(a, b) {
    if (!a || !b) return 0;
    const R = 6371000;
    const toRad = d => (d * Math.PI) / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 +
      Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * R * Math.asin(Math.sqrt(h));
  }

  async function pushLocationToServer(point, accuracyM = 10) {
    const mf = getMf();
    try {
      const res = await mf.patch("/drivers/me/location", {
        lat: Number(point.lat.toFixed(6)),
        lng: Number(point.lng.toFixed(6)),
        accuracyM,
        capturedAt: new Date().toISOString()
      });
      if (res?.accepted) {
        lastServerSync = { time: Date.now(), point: { lat: point.lat, lng: point.lng } };
        return { ok: true };
      }
      return { ok: false, reason: res?.reason || "REJECTED" };
    } catch (err) {
      return { ok: false, reason: "ERROR", error: err };
    }
  }

  // Gửi một điểm và chờ/thử lại cho tới khi server chấp nhận (dùng cho điểm quan trọng).
  async function syncLocationToServer(point, accuracyM = 10, onWait = null) {
    for (let attempt = 0; attempt < 4; attempt++) {
      let waitMs = SERVER_MIN_INTERVAL_MS + 300 - (Date.now() - lastServerSync.time);
      if (lastServerSync.point) {
        const needMs = (distanceMeters(lastServerSync.point, point) / SERVER_MAX_SPEED_MPS) * 1000;
        waitMs = Math.max(waitMs, needMs - (Date.now() - lastServerSync.time) + 300);
      }
      if (waitMs > 0) {
        onWait?.(Math.ceil(waitMs / 1000));
        await sleep(Math.min(waitMs, 60000));
      }
      const r = await pushLocationToServer(point, accuracyM);
      if (r.ok) return r;
      if (r.reason === "STATIONARY") return { ok: true }; // server giữ điểm cũ cách < 15m: chấp nhận được
      if (r.reason === "TOO_SOON") {
        lastServerSync.time = Date.now();                 // server có điểm mới hơn ta biết: chờ đủ 5s
        continue;
      }
      const msg = r.error?.message || "";
      if (/speed/i.test(msg)) {
        // Server có điểm cũ ở xa mà ta không biết: chờ thêm rồi thử lại
        lastServerSync.time = Date.now();
        onWait?.(20);
        await sleep(20000);
        continue;
      }
      return r;
    }
    return { ok: false, reason: "GAVE_UP" };
  }

  function stopKeepAlive() {
    if (keepAliveTimer) {
      clearInterval(keepAliveTimer);
      keepAliveTimer = null;
    }
  }

  // Sau khi xe giả lập dừng ở đích: giữ vị trí trên server "tươi" (< 30s) để nút
  // "Đã đến điểm" luôn qua được geofence. Dao động ±8m như nhiễu GPS thật
  // (backend bỏ qua điểm lệch < 15m trong 60s nên cần dao động nhỏ).
  function startArrivalKeepAlive(activeTrip, center) {
    stopKeepAlive();
    let flip = false;
    keepAliveTimer = setInterval(async () => {
      const mf = getMf();
      if (mf?.getActiveDriverTripController?.() !== activeTrip ||
          !["TO_PICKUP", "TO_DROPOFF"].includes(activeTrip.phase) ||
          movementInterval) {
        stopKeepAlive();
        return;
      }
      flip = !flip;
      const jitter = { lat: center.lat + (flip ? 0.000075 : -0.000075), lng: center.lng };
      await pushLocationToServer(jitter, 5);
    }, KEEPALIVE_INTERVAL_MS);
  }
  let currentTab = "quick";

  function isEnabled() {
    return localStorage.getItem("moveflow_demo_tools_enabled") !== "0";
  }

  function isMockGpsEnabled() {
    return localStorage.getItem("moveflow_mock_gps_enabled") === "1";
  }

  function setMockGpsEnabled(enabled, silent = false) {
    const flag = Boolean(enabled);
    localStorage.setItem("moveflow_mock_gps_enabled", flag ? "1" : "0");

    // Ẩn/hiện 2 nút "🎲 Vị trí ngẫu nhiên" và "▶️ Xe chạy" trên màn hình chuyến đi
    const quickBar = document.getElementById("trip-sim-quick-bar");
    if (quickBar) {
      quickBar.style.display = flag ? "flex" : "none";
    }

    // Đồng bộ trạng thái checkbox trong Demo Modal nếu đang mở
    document.querySelectorAll(".demo-mock-gps-checkbox").forEach(cb => {
      cb.checked = flag;
    });
    document.querySelectorAll(".demo-mock-gps-box").forEach(box => {
      box.classList.toggle("active", flag);
    });
    document.querySelectorAll(".demo-mock-gps-badge").forEach(b => {
      b.textContent = flag ? "MOCK ON (Đã khóa GPS thật)" : "MOCK OFF (Dùng GPS thiết bị)";
      b.style.color = flag ? "var(--blue)" : "var(--text-secondary)";
    });

    const mf = getMf();
    const activeTrip = mf?.getActiveDriverTripController?.();
    if (activeTrip?.setMockMode) {
      activeTrip.setMockMode(flag);
    }

    if (!flag) {
      stopMovementSimulation();
      stopKeepAlive();
    }

    if (!silent) {
      mf?.showToast?.(
        flag
          ? "🛰️ Đã BẬT chế độ Mock GPS: Đã chặn GPS thiết bị thật và hiện 2 nút điều khiển xe trên bản đồ."
          : "📡 Đã TẮT chế độ Mock GPS: Quay lại dùng GPS thực tế và ẩn 2 nút mô phỏng.",
        flag ? "success" : "info"
      );
    }
  }

  function getMf() {
    return window.MoveFlow;
  }

  // Helper: Đảm bảo người dùng đang đăng nhập đúng vai trò
  async function ensureRole(allowedRoles, fallbackEmail) {
    const mf = getMf();
    if (!mf) throw new Error("MoveFlow chưa sẵn sàng");
    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
    const currentRole = mf.state?.user?.role;
    if (!mf.state?.token || !currentRole || !roles.includes(currentRole)) {
      mf.showToast?.(`Chuyển sang ${fallbackEmail} để thực hiện tác vụ…`, "info");
      await mf.loginAs(fallbackEmail, "admin");
    }
  }

  // Helper: Đảm bảo Driver A sẵn sàng (AVAILABLE + Fresh GPS) để hệ thống điều phối tìm thấy
  async function ensureDriverReady() {
    const mf = getMf();
    if (!mf) return;
    try {
      const loginRes = await fetch(`${mf.state?.apiBase || location.origin + "/api/v1"}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "driver-a@gmail.com", password: "admin" })
      });
      const data = await loginRes.json();
      if (data?.accessToken) {
        await fetch(`${mf.state?.apiBase || location.origin + "/api/v1"}/drivers/me/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.accessToken}` },
          body: JSON.stringify({ status: "AVAILABLE" })
        });
        localStorage.setItem("moveflow_driver_status_driver-a@gmail.com", "AVAILABLE");
        const readyPt = {
          lat: Number((SAMPLES.pickup.lat + 0.00008).toFixed(6)),
          lng: Number((SAMPLES.pickup.lng + 0.00008).toFixed(6))
        };
        const locRes = await fetch(`${mf.state?.apiBase || location.origin + "/api/v1"}/drivers/me/location`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.accessToken}` },
          body: JSON.stringify({
            lat: readyPt.lat,
            lng: readyPt.lng,
            accuracyM: 10,
            capturedAt: new Date().toISOString()
          })
        });
        const locJson = await locRes.json().catch(() => null);
        if (locJson?.accepted) {
          lastServerSync = { time: Date.now(), point: readyPt };
        }
      }
    } catch (e) {
      console.warn("ensureDriverReady warning:", e);
    }
  }

  // Helper cho các nút bấm tắt 1-Click trong Demo Tools (04, 05, Chạy trọn gói):
  // Thử chuyển trạng thái bằng tài khoản hiện tại trước; nếu bị kẹt cooldown GPS 5s/55m/s
  // khi bấm liên tiếp quá nhanh thì dùng quyền Admin để chuyển trạng thái tức thì.
  async function transitionWithInstantFallback(shipmentId, toStatus, reason = undefined) {
    const mf = getMf();
    const payload = reason ? { toStatus, reason: String(reason).trim() } : { toStatus };
    try {
      return await mf.post(`/shipments/${shipmentId}/transition`, payload);
    } catch {
      const apiBase = mf?.state?.apiBase || location.origin + "/api/v1";
      const adminLogin = await fetch(`${apiBase}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: "admin@gmail.com", password: "admin" })
      });
      const adminData = await adminLogin.json();
      if (!adminData?.accessToken) throw new Error("Không thể xác thực quyền Admin dự phòng");
      const res = await fetch(`${apiBase}/shipments/${shipmentId}/transition`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${adminData.accessToken}` },
        body: JSON.stringify(payload)
      });
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.message || `Không thể chuyển sang ${toStatus}`);
      }
      return res.json();
    }
  }

  function createDom() {
    const existing = document.getElementById("moveflow-demo-toolbar-root");
    if (existing) existing.remove();

    if (!isEnabled()) return;

    const host = document.createElement("div");
    host.id = "moveflow-demo-toolbar-root";
    host.innerHTML = `
      <aside class="demo-floating-toolbox" id="demo-toolbox">
        <button class="demo-toolbar-trigger" id="btn-open-demo-modal" title="Mở bộ công cụ kiểm thử MoveFlow Demo Tools">
          <span>🛠️ Demo Tools</span>
        </button>
      </aside>

      <div class="demo-panel-overlay" id="demo-modal-overlay">
        <div class="demo-panel-modal">
          <div class="demo-panel-header">
            <h3><span>🛠️</span> MoveFlow Demo Toolkit</h3>
            <button class="demo-panel-close" id="btn-close-demo-modal" title="Đóng">✕</button>
          </div>

          <div class="demo-nav-tabs">
            <button type="button" class="demo-nav-tab-btn ${currentTab === 'quick' ? 'active' : ''}" data-tab="quick">
              <span>⚡</span> Tác vụ nhanh
            </button>
            <button type="button" class="demo-nav-tab-btn ${currentTab === 'accounts' ? 'active' : ''}" data-tab="accounts">
              <span>👤</span> Đổi tài khoản
            </button>
            <button type="button" class="demo-nav-tab-btn ${currentTab === 'gps' ? 'active' : ''}" data-tab="gps">
              <span>📍</span> GPS & Xe chạy
            </button>
          </div>

          <div class="demo-panel-body" id="demo-tab-content">
            <!-- Content will be rendered dynamically based on active tab -->
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(host);
    renderTabContent(host);
    bindEvents(host);
  }

  function renderTabContent(host) {
    const target = host.querySelector("#demo-tab-content");
    if (!target) return;
    const mf = getMf();
    const currentUser = mf?.state?.user;
    const currentEmail = currentUser?.email || "";

    const mockOn = isMockGpsEnabled();
    const currentSpeedKmh = getSimSpeedKmh();
    const speedPresets = [
      { kmh: 30, label: "🐢 30 km/h" },
      { kmh: 60, label: "🛵 60 km/h" },
      { kmh: 100, label: "🚗 100 km/h" },
      { kmh: 180, label: "⚡ 180 km/h" },
      { kmh: 360, label: "🚀 360 km/h" }
    ];
    const speedControlHtml = `
      <div class="demo-speed-box" style="padding:10px 12px;border-radius:10px;border:1px solid var(--border);background:var(--surface-alt);display:flex;flex-direction:column;gap:8px">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <span style="font-size:12.5px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:5px">
            <span>⚡ Tốc độ xe tài xế</span>
          </span>
          <div style="display:flex;align-items:center;gap:6px">
            <input type="number" class="demo-speed-input" min="5" max="1000" step="5" value="${currentSpeedKmh}" style="width:68px;padding:3px 6px;font-size:12px;font-weight:700;text-align:right;border:1px solid var(--border);border-radius:6px;background:var(--surface);color:var(--blue)">
            <span style="font-size:11.5px;font-weight:700;color:var(--blue)">km/h</span>
          </div>
        </div>
        <input type="range" class="demo-speed-slider" min="10" max="500" step="5" value="${Math.min(500, currentSpeedKmh)}" style="width:100%;accent-color:var(--blue);cursor:pointer;margin:0">
        <div style="display:flex;gap:5px;flex-wrap:wrap">
          ${speedPresets.map(p => `
            <button type="button" class="demo-speed-preset-btn ${currentSpeedKmh === p.kmh ? "active" : ""}" data-speed="${p.kmh}" style="flex:1;min-width:62px;padding:4px 6px;font-size:11px;font-weight:600;border-radius:6px;border:1px solid ${currentSpeedKmh === p.kmh ? "var(--blue)" : "var(--border)"};background:${currentSpeedKmh === p.kmh ? "var(--blue)" : "var(--surface)"};color:${currentSpeedKmh === p.kmh ? "#fff" : "var(--text-primary)"};cursor:pointer">
              ${p.label}
            </button>
          `).join("")}
        </div>
      </div>
    `;
    const mockSwitchHtml = `
      <div class="demo-mock-gps-box ${mockOn ? "active" : ""}">
        <div style="flex:1">
          <div style="font-size:13px;font-weight:700;color:var(--text-primary);display:flex;align-items:center;gap:6px">
            <span>🛰️ Chế độ Mock GPS</span>
          </div>
          <div class="demo-mock-gps-badge" style="font-size:11px;font-weight:600;margin-top:2px;color:${mockOn ? "var(--blue)" : "var(--text-secondary)"}">
            ${mockOn ? "MOCK ON (Đã khóa GPS thật)" : "MOCK OFF (Dùng GPS thiết bị)"}
          </div>
          <div style="font-size:10.5px;color:var(--text-secondary);margin-top:2px">
            Bật để chặn trình duyệt tự cập nhật GPS thật và hiện 2 nút <b>🎲 Vị trí ngẫu nhiên</b> &amp; <b>▶️ Xe chạy</b>.
          </div>
        </div>
        <label class="switch" title="Bật/tắt chế độ Mock GPS">
          <input type="checkbox" class="demo-mock-gps-checkbox" ${mockOn ? "checked" : ""}>
          <span class="switch-slider"></span>
        </label>
      </div>
    `;

    if (currentTab === "quick") {
      target.innerHTML = `
        <div class="demo-current-role-badge">
          <span>Tài khoản hiện tại:</span>
          <strong>${currentUser ? `${currentUser.name} (${currentUser.role})` : "Khách (Chưa đăng nhập)"}</strong>
        </div>

        ${mockSwitchHtml}

        ${speedControlHtml}

        <div>
          <div class="demo-section-title"><span>🚀</span> Kịch bản toàn trình tự động</div>
          <button type="button" class="demo-action-btn" id="btn-demo-full-flow" style="width:100%;background:linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);color:#fff;border:none;padding:12px;font-weight:700">
            <span>✨</span> Chạy Demo trọn gói (Tạo đơn → Gán xe → Giao)
          </button>
          <p style="font-size:11px;color:var(--text-secondary);margin:6px 0 0">
            Tự động kích hoạt toàn bộ quy trình: Tạo đơn Q.1 → Điều phối cho Tài xế A → Nhận cuốc → Lấy hàng → Giao hàng hoàn tất.
          </p>
        </div>

        <div>
          <div class="demo-section-title"><span>📦</span> Các bước quy trình (Từng bước)</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button type="button" class="demo-action-btn" id="btn-quick-create-shipment">
              <span>01.</span> Tạo nhanh đơn mẫu (Q.1 → Q.7)
            </button>
            <button type="button" class="demo-action-btn" id="btn-quick-dispatch">
              <span>02.</span> Điều phối đơn hàng cho Tài xế
            </button>
            <button type="button" class="demo-action-btn" id="btn-driver-accept">
              <span>03.</span> Tài xế: Chấp nhận cuốc giao
            </button>
            <button type="button" class="demo-action-btn" id="btn-driver-pickup-pkg">
              <span>04.</span> Tài xế: Đến điểm A & Đã lấy hàng
            </button>
            <button type="button" class="demo-action-btn" id="btn-driver-deliver-pkg">
              <span>05.</span> Tài xế: Đến điểm B & Đã giao thành công
            </button>
          </div>
        </div>

        <div style="border-top:1px solid var(--border-light);padding-top:10px">
          <div style="display:flex;justify-content:space-between;align-items:center">
            <span style="font-size:11px;color:var(--text-secondary)">Bật/tắt thanh công cụ này:</span>
            <button type="button" class="btn btn-sm btn-outline" id="btn-disable-demo-tools" style="padding:4px 8px;font-size:11px">
              Tắt Demo Toolbar
            </button>
          </div>
        </div>
      `;
    } else if (currentTab === "accounts") {
      target.innerHTML = `
        <div class="demo-current-role-badge">
          <span>Tài khoản hiện tại:</span>
          <strong>${currentUser ? `${currentUser.name} (${currentUser.role})` : "Khách (Chưa đăng nhập)"}</strong>
        </div>

        <div>
          <div class="demo-section-title"><span>👥</span> Chọn tài khoản đăng nhập (1-Click)</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button type="button" class="demo-action-btn ${currentEmail === 'sender@gmail.com' ? 'active-account' : ''}" data-demo-role="SENDER" data-email="sender@gmail.com">
              <span style="font-size:16px">👤</span>
              <div style="flex:1">
                <strong>Người gửi hàng (Sender)</strong>
                <div style="font-size:11px;color:var(--text-secondary)">sender@gmail.com</div>
              </div>
              ${currentEmail === 'sender@gmail.com' ? '<span style="color:var(--blue)">✓ Đang dùng</span>' : ''}
            </button>

            <button type="button" class="demo-action-btn ${currentEmail === 'driver-a@gmail.com' ? 'active-account' : ''}" data-demo-role="DRIVER" data-email="driver-a@gmail.com">
              <span style="font-size:16px">🛵</span>
              <div style="flex:1">
                <strong>Tài xế A (Driver A)</strong>
                <div style="font-size:11px;color:var(--text-secondary)">driver-a@gmail.com</div>
              </div>
              ${currentEmail === 'driver-a@gmail.com' ? '<span style="color:var(--blue)">✓ Đang dùng</span>' : ''}
            </button>

            <button type="button" class="demo-action-btn ${currentEmail === 'driver-b@gmail.com' ? 'active-account' : ''}" data-demo-role="DRIVER" data-email="driver-b@gmail.com">
              <span style="font-size:16px">🛵</span>
              <div style="flex:1">
                <strong>Tài xế B (Driver B)</strong>
                <div style="font-size:11px;color:var(--text-secondary)">driver-b@gmail.com</div>
              </div>
              ${currentEmail === 'driver-b@gmail.com' ? '<span style="color:var(--blue)">✓ Đang dùng</span>' : ''}
            </button>

            <button type="button" class="demo-action-btn ${currentEmail === 'dispatcher@gmail.com' ? 'active-account' : ''}" data-demo-role="DISPATCHER" data-email="dispatcher@gmail.com">
              <span style="font-size:16px">📡</span>
              <div style="flex:1">
                <strong>Điều phối viên (Dispatcher)</strong>
                <div style="font-size:11px;color:var(--text-secondary)">dispatcher@gmail.com</div>
              </div>
              ${currentEmail === 'dispatcher@gmail.com' ? '<span style="color:var(--blue)">✓ Đang dùng</span>' : ''}
            </button>

            <button type="button" class="demo-action-btn ${currentEmail === 'admin@gmail.com' ? 'active-account' : ''}" data-demo-role="ADMIN" data-email="admin@gmail.com">
              <span style="font-size:16px">⚡</span>
              <div style="flex:1">
                <strong>Quản trị viên (Admin)</strong>
                <div style="font-size:11px;color:var(--text-secondary)">admin@gmail.com</div>
              </div>
              ${currentEmail === 'admin@gmail.com' ? '<span style="color:var(--blue)">✓ Đang dùng</span>' : ''}
            </button>
          </div>
        </div>
      `;
    } else if (currentTab === "gps") {
      target.innerHTML = `
        <div class="demo-current-role-badge">
          <span>Tài khoản hiện tại:</span>
          <strong>${currentUser ? `${currentUser.name} (${currentUser.role})` : "Khách (Chưa đăng nhập)"}</strong>
        </div>

        ${mockSwitchHtml}

        ${speedControlHtml}

        <div>
          <div class="demo-section-title"><span>🎲</span> Vị trí tài xế (Không dùng GPS thật)</div>
          <button type="button" class="demo-action-btn" id="btn-modal-sim-random" style="width:100%;font-weight:700;background:var(--surface-alt);color:var(--blue);border-color:var(--border)">
            <span>🎲</span> Đặt vị trí tài xế ngẫu nhiên (~2km cách điểm A)
          </button>
          <p style="font-size:11px;color:var(--text-secondary);margin:6px 0 0">
            Đặt tài xế ở vị trí ngẫu nhiên trên bản đồ (tách biệt hoàn toàn khỏi GPS thật của thiết bị) và tự động vẽ lộ trình đường bộ tới điểm đến.
          </p>
        </div>

        <div>
          <div class="demo-section-title"><span>🚗</span> Mô phỏng xe chạy OSRM như thật</div>
          <div style="display:flex;flex-direction:column;gap:8px">
            <button type="button" class="demo-action-btn" id="btn-modal-sim-drive-pickup" style="background:var(--success-bg);color:var(--success);border-color:var(--border)">
              <span>▶️</span> Xe chạy tới Điểm lấy hàng A (Chặng 1)
            </button>
            <button type="button" class="demo-action-btn" id="btn-modal-sim-drive-dropoff" style="background:var(--success-bg);color:var(--success);border-color:var(--border)">
              <span>▶️</span> Xe chạy từ A đến B (Giao hàng Chặng 2)
            </button>
            <button type="button" class="demo-action-btn" id="btn-modal-sim-stop" style="background:var(--danger-bg);color:var(--danger);border-color:var(--border)">
              <span>⏹️</span> Dừng xe mô phỏng
            </button>
          </div>
          <div id="demo-simulation-status" style="font-size:11px;color:var(--text-secondary);margin-top:8px;padding:8px;background:var(--surface-alt);border-radius:6px;display:none">
            🚗 Đang mô phỏng xe di chuyển...
          </div>
        </div>

        <div>
          <div class="demo-section-title"><span>📍</span> Dịch chuyển tức thời (&lt;25m)</div>
          <div class="demo-grid-btns">
            <button type="button" class="demo-action-btn" id="btn-sim-goto-pickup">
              <span>📍</span> Tới sát A (&lt;25m)
            </button>
            <button type="button" class="demo-action-btn" id="btn-sim-goto-dropoff">
              <span>🏁</span> Tới sát B (&lt;25m)
            </button>
          </div>
        </div>
      `;
    }

    bindTabActions(host);
  }

  function bindEvents(host) {
    const overlay = host.querySelector("#demo-modal-overlay");
    const openBtn = host.querySelector("#btn-open-demo-modal");
    const closeBtn = host.querySelector("#btn-close-demo-modal");

    openBtn?.addEventListener("click", () => {
      renderTabContent(host);
      overlay.classList.add("open");
    });
    closeBtn?.addEventListener("click", () => overlay.classList.remove("open"));
    overlay?.addEventListener("click", e => {
      if (e.target === overlay) overlay.classList.remove("open");
    });

    // Tab switching
    host.querySelectorAll(".demo-nav-tab-btn").forEach(btn => {
      btn.onclick = () => {
        host.querySelectorAll(".demo-nav-tab-btn").forEach(b => b.classList.remove("active"));
        btn.classList.add("active");
        currentTab = btn.dataset.tab;
        renderTabContent(host);
      };
    });
  }

  function bindTabActions(host) {
    const overlay = host.querySelector("#demo-modal-overlay");
    const mf = getMf();

    // Mock GPS Toggle Switch
    host.querySelectorAll(".demo-mock-gps-checkbox").forEach(cb => {
      cb.addEventListener("change", e => {
        setMockGpsEnabled(e.target.checked);
      });
    });

    // Driver Speed Controls (Slider, Number Input, Presets)
    host.querySelectorAll(".demo-speed-slider").forEach(slider => {
      slider.addEventListener("input", e => {
        setSimSpeedKmh(e.target.value, true);
        renderTabContent(host);
      });
      slider.addEventListener("change", e => {
        setSimSpeedKmh(e.target.value, false);
      });
    });

    host.querySelectorAll(".demo-speed-input").forEach(input => {
      input.addEventListener("change", e => {
        const val = setSimSpeedKmh(e.target.value, false);
        e.target.value = String(val);
        renderTabContent(host);
      });
    });

    host.querySelectorAll(".demo-speed-preset-btn").forEach(btn => {
      btn.addEventListener("click", () => {
        setSimSpeedKmh(btn.dataset.speed, false);
        renderTabContent(host);
      });
    });

    // 1-Click Role Switching
    host.querySelectorAll("[data-demo-role]").forEach(btn => {
      btn.onclick = async () => {
        const email = btn.dataset.email;
        if (mf?.loginAs) {
          overlay.classList.remove("open");
          await mf.loginAs(email, "admin");
        }
      };
    });

    // 01. Quick Shipment Creation
    host.querySelector("#btn-quick-create-shipment")?.addEventListener("click", async () => {
      try {
        await ensureRole(["SENDER", "ADMIN"], "sender@gmail.com");
        const payload = {
          pickupAddress: SAMPLES.pickup,
          dropoffAddress: SAMPLES.dropoff,
          parcel: SAMPLES.parcel,
          serviceType: SAMPLES.serviceType
        };
        const result = await mf.post("/shipments", payload);
        mf.showToast("Đã tạo thành công đơn hàng #" + (result.trackingCode || result.id.slice(0, 8)) + "!");
        overlay.classList.remove("open");
        if (mf.state) {
          mf.state.detail = result.id;
          mf.state.view = "details";
          mf.renderShell();
          await mf.renderView();
        }
      } catch (err) {
        mf?.showToast(err.message, "error");
      }
    });

    // 02. Quick Dispatch
    host.querySelector("#btn-quick-dispatch")?.addEventListener("click", async () => {
      try {
        await ensureDriverReady();
        await ensureRole(["DISPATCHER", "ADMIN"], "dispatcher@gmail.com");
        let queue = await mf.get("/dispatch/queue");
        if (!queue || queue.length === 0) {
          mf.showToast("Hàng chờ trống. Đang tự động tạo đơn mẫu để điều phối…", "info");
          const sRes = await fetch(`${mf.state?.apiBase || location.origin + "/api/v1"}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "sender@gmail.com", password: "admin" })
          });
          const sData = await sRes.json();
          await fetch(`${mf.state?.apiBase || location.origin + "/api/v1"}/shipments`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${sData.accessToken}` },
            body: JSON.stringify({
              pickupAddress: SAMPLES.pickup,
              dropoffAddress: SAMPLES.dropoff,
              parcel: SAMPLES.parcel,
              serviceType: SAMPLES.serviceType
            })
          });
          queue = await mf.get("/dispatch/queue");
        }

        if (queue && queue.length > 0) {
          const top = queue[0];
          const res = await mf.post(`/shipments/${top.id}/assign-driver`, {});
          mf.showToast(res.assignment ? "Đã điều phối đơn #" + (top.trackingCode || top.id.slice(0, 8)) + " cho Tài xế!" : "Đã gửi đề nghị phân công đơn hàng.");
          overlay.classList.remove("open");
          await mf.renderView();
        }
      } catch (err) {
        mf?.showToast(err.message, "error");
      }
    });

    // 03. Driver Accept Task
    host.querySelector("#btn-driver-accept")?.addEventListener("click", async () => {
      try {
        await ensureRole("DRIVER", "driver-a@gmail.com");
        const tasks = await mf.get("/drivers/me/tasks");
        const pending = (Array.isArray(tasks) ? tasks : []).find(t => t.status === "PENDING");
        if (!pending) {
          mf.showToast("Không có đơn chờ nào. Hãy bấm 'Điều phối đơn hàng' trước.", "info");
          return;
        }
        await mf.post(`/assignments/${pending.id}/respond`, { action: "ACCEPT" });
        mf.showToast("Tài xế đã nhận đơn hàng thành công!");
        overlay.classList.remove("open");
        mf.state.view = "tasks";
        mf.renderShell();
        await mf.renderView();
      } catch (err) {
        mf?.showToast(err.message, "error");
      }
    });

    // 04. Driver Pickup Package
    host.querySelector("#btn-driver-pickup-pkg")?.addEventListener("click", async () => {
      try {
        stopMovementSimulation();
        await ensureRole("DRIVER", "driver-a@gmail.com");
        const tasks = await mf.get("/drivers/me/tasks");
        const active = (Array.isArray(tasks) ? tasks : []).find(t =>
          t.status === "ACCEPTED" &&
          t.shipment &&
          !["DELIVERED", "DELIVERY_FAILED", "CANCELLED"].includes(t.shipment.status)
        );
        if (!active) {
          mf.showToast("Tài xế chưa có đơn nào đang nhận.", "info");
          return;
        }
        const shipmentId = active.shipmentId;
        const pLat = Number(((active.shipment?.pickup?.lat ?? SAMPLES.pickup.lat) + 0.00008).toFixed(6));
        const pLng = Number(((active.shipment?.pickup?.lng ?? SAMPLES.pickup.lng) + 0.00008).toFixed(6));
        await pushLocationToServer({ lat: pLat, lng: pLng }, 5);
        mf.getActiveDriverTripController?.()?.setMockLocation?.({ lat: pLat, lng: pLng }, true);

        if (active.shipment.status === "EN_ROUTE_PICKUP" || active.shipment.status === "RECEIVED") {
          await transitionWithInstantFallback(shipmentId, "ARRIVED_PICKUP");
        }
        await transitionWithInstantFallback(shipmentId, "OUT_FOR_DELIVERY");
        mf.showToast("Tài xế đã đến điểm A và nhận hàng (Bắt đầu đi giao)!");
        overlay.classList.remove("open");
        await mf.renderView();
      } catch (err) {
        mf?.showToast(err.message, "error");
      }
    });

    // 05. Driver Deliver Package
    host.querySelector("#btn-driver-deliver-pkg")?.addEventListener("click", async () => {
      try {
        stopMovementSimulation();
        stopKeepAlive();
        await ensureRole("DRIVER", "driver-a@gmail.com");
        const tasks = await mf.get("/drivers/me/tasks");
        const active = (Array.isArray(tasks) ? tasks : []).find(t =>
          t.status === "ACCEPTED" &&
          t.shipment &&
          !["DELIVERED", "DELIVERY_FAILED", "CANCELLED"].includes(t.shipment.status)
        );
        if (!active) {
          mf.showToast("Tài xế chưa có đơn nào đang nhận.", "info");
          return;
        }
        const shipmentId = active.shipmentId;
        const dLat = Number(((active.shipment?.dropoff?.lat ?? SAMPLES.dropoff.lat) + 0.00008).toFixed(6));
        const dLng = Number(((active.shipment?.dropoff?.lng ?? SAMPLES.dropoff.lng) + 0.00008).toFixed(6));
        await pushLocationToServer({ lat: dLat, lng: dLng }, 5);
        mf.getActiveDriverTripController?.()?.setMockLocation?.({ lat: dLat, lng: dLng }, true);

        if (["EN_ROUTE_PICKUP", "RECEIVED"].includes(active.shipment.status)) {
          await transitionWithInstantFallback(shipmentId, "ARRIVED_PICKUP");
          await transitionWithInstantFallback(shipmentId, "OUT_FOR_DELIVERY");
        } else if (active.shipment.status === "ARRIVED_PICKUP") {
          await transitionWithInstantFallback(shipmentId, "OUT_FOR_DELIVERY");
        }
        if (["OUT_FOR_DELIVERY", "IN_TRANSIT"].includes(active.shipment.status) || active.shipment.status !== "ARRIVED_DROPOFF") {
          try { await transitionWithInstantFallback(shipmentId, "ARRIVED_DROPOFF"); } catch { /* ok */ }
        }
        await transitionWithInstantFallback(shipmentId, "DELIVERED");
        window.MoveFlowSfx?.play("delivered");
        window.MoveFlowSfx?.triggerConfetti();
        mf.showToast("Đơn hàng đã được giao thành công! 🎉", "success");
        overlay.classList.remove("open");
        await mf.renderView();
      } catch (err) {
        mf?.showToast(err.message, "error");
      }
    });

    // Full Flow Simulation
    host.querySelector("#btn-demo-full-flow")?.addEventListener("click", async () => {
      try {
        stopMovementSimulation();
        stopKeepAlive();
        overlay.classList.remove("open");
        mf.showToast("🚀 Bắt đầu kịch bản Demo toàn trình...", "info");

        await ensureDriverReady();

        mf.showToast("01/05: Người gửi tạo đơn hàng mẫu...", "info");
        await ensureRole(["SENDER", "ADMIN"], "sender@gmail.com");
        const shipment = await mf.post("/shipments", {
          pickupAddress: SAMPLES.pickup,
          dropoffAddress: SAMPLES.dropoff,
          parcel: SAMPLES.parcel,
          serviceType: SAMPLES.serviceType
        });
        mf.state.detail = shipment.id;
        mf.state.view = "details";
        mf.renderShell();
        await mf.renderView();

        await new Promise(r => setTimeout(r, 1200));

        mf.showToast("02/05: Điều phối viên phân công cho Tài xế A...", "info");
        await ensureRole(["DISPATCHER", "ADMIN"], "dispatcher@gmail.com");
        await mf.post(`/shipments/${shipment.id}/assign-driver`, {});

        await new Promise(r => setTimeout(r, 1200));

        mf.showToast("03/05: Tài xế A nhận đơn & Đến lấy hàng...", "info");
        await ensureRole("DRIVER", "driver-a@gmail.com");
        const tasks = await mf.get("/drivers/me/tasks");
        const pending = (Array.isArray(tasks) ? tasks : []).find(t => t.shipmentId === shipment.id);
        if (pending) {
          await mf.post(`/assignments/${pending.id}/respond`, { action: "ACCEPT" });
        }
        await pushLocationToServer({
          lat: SAMPLES.pickup.lat + 0.00008,
          lng: SAMPLES.pickup.lng + 0.00008
        }, 5);
        await new Promise(r => setTimeout(r, 800));
        await transitionWithInstantFallback(shipment.id, "ARRIVED_PICKUP");
        await transitionWithInstantFallback(shipment.id, "OUT_FOR_DELIVERY");

        mf.showToast("04/05: Đang di chuyển giao kiện hàng...", "info");
        mf.state.view = "tasks";
        mf.renderShell();
        await mf.renderView();

        await new Promise(r => setTimeout(r, 1500));
        await pushLocationToServer({
          lat: SAMPLES.dropoff.lat + 0.00008,
          lng: SAMPLES.dropoff.lng + 0.00008
        }, 5);
        await transitionWithInstantFallback(shipment.id, "ARRIVED_DROPOFF");
        await transitionWithInstantFallback(shipment.id, "DELIVERED");

        window.MoveFlowSfx?.play("delivered");
        window.MoveFlowSfx?.triggerConfetti();
        mf.showToast("05/05: Hoàn tất chuyến giao hàng thành công! 🎉", "success");
        await mf.renderView();
      } catch (err) {
        mf?.showToast("Demo lỗi: " + err.message, "error");
      }
    });

    // Random Driver Location
    host.querySelector("#btn-modal-sim-random")?.addEventListener("click", async () => {
      await randomizeDriverLocation();
    });

    // Drive to Pickup
    host.querySelector("#btn-modal-sim-drive-pickup")?.addEventListener("click", async () => {
      overlay.classList.remove("open");
      await startMovementSimulation("PICKUP");
    });

    // Drive to Dropoff
    host.querySelector("#btn-modal-sim-drive-dropoff")?.addEventListener("click", async () => {
      overlay.classList.remove("open");
      await startMovementSimulation("DROPOFF");
    });

    // Stop Drive
    host.querySelector("#btn-modal-sim-stop")?.addEventListener("click", stopMovementSimulation);

    // Teleport to Pickup (<25m)
    host.querySelector("#btn-sim-goto-pickup")?.addEventListener("click", async () => {
      await teleportToTarget("pickup");
    });

    // Teleport to Dropoff (<25m)
    host.querySelector("#btn-sim-goto-dropoff")?.addEventListener("click", async () => {
      await teleportToTarget("dropoff");
    });

    // Disable Demo Tools
    host.querySelector("#btn-disable-demo-tools")?.addEventListener("click", () => {
      if (window.confirm("Bạn có chắc muốn tắt thanh công cụ Demo? Bạn có thể bật lại bất kỳ lúc nào trong mục Cài đặt Tài khoản (dành riêng cho Quản trị viên Admin).")) {
        mf?.setDemoEnabled(false);
      }
    });
  }

  // Helper: Đảm bảo có một chuyến đi tài xế đang mở trực tiếp trên màn hình
  async function ensureActiveDriverTrip() {
    const mf = getMf();
    if (!mf) throw new Error("MoveFlow chưa sẵn sàng");

    // 1. Chuyển sang tài xế Driver A nếu chưa phải
    await ensureRole("DRIVER", "driver-a@gmail.com");

    // 2. Chuyển view sang màn hình công việc tài xế nếu chưa ở đó
    if (mf.state?.view !== "tasks") {
      mf.state.view = "tasks";
      mf.renderShell?.();
      await mf.renderView?.();
    }

    // 3. Nếu controller đã tồn tại trên màn hình, trả về luôn
    let activeTrip = mf.getActiveDriverTripController?.();
    if (activeTrip) {
      if (activeTrip.engine?.ready) {
        try { await activeTrip.engine.ready(); } catch { /* ignore */ }
      }
      return activeTrip;
    }

    // 4. Nếu chưa có controller, kiểm tra danh sách nhiệm vụ của tài xế
    let tasks = [];
    try {
      tasks = await mf.get("/drivers/me/tasks");
    } catch {
      tasks = [];
    }
    const taskList = Array.isArray(tasks) ? tasks : [];

    // Tìm đơn đang chạy (ACCEPTED)
    let activeTask = taskList.find(t =>
      t.status === "ACCEPTED" &&
      t.shipment &&
      ["EN_ROUTE_PICKUP", "ARRIVED_PICKUP", "IN_TRANSIT", "OUT_FOR_DELIVERY", "ARRIVED_DROPOFF", "RECEIVED"].includes(t.shipment.status)
    );

    // Nếu có đơn PENDING, tự động nhận đơn
    if (!activeTask) {
      const pending = taskList.find(t => t.status === "PENDING");
      if (pending) {
        await mf.post(`/assignments/${pending.id}/respond`, { action: "ACCEPT" });
      } else {
        // Chưa có đơn nào: Tự động tạo đơn mẫu & điều phối gán cho Driver A
        mf.showToast?.("Đang chuẩn bị chuyến đi mẫu cho tài xế…", "info");
        await ensureDriverReady();

        const sRes = await fetch(`${mf.state?.apiBase || location.origin + "/api/v1"}/auth/login`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: "sender@gmail.com", password: "admin" })
        });
        const sData = await sRes.json();
        const shipRes = await fetch(`${mf.state?.apiBase || location.origin + "/api/v1"}/shipments`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${sData.accessToken}` },
          body: JSON.stringify({
            pickupAddress: SAMPLES.pickup,
            dropoffAddress: SAMPLES.dropoff,
            parcel: SAMPLES.parcel,
            serviceType: SAMPLES.serviceType
          })
        });
        const shipData = await shipRes.json();

        if (shipData?.id) {
          const dRes = await fetch(`${mf.state?.apiBase || location.origin + "/api/v1"}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email: "dispatcher@gmail.com", password: "admin" })
          });
          const dData = await dRes.json();
          await fetch(`${mf.state?.apiBase || location.origin + "/api/v1"}/shipments/${shipData.id}/assign-driver`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${dData.accessToken}` },
            body: JSON.stringify({})
          });

          const driverTasks = await mf.get("/drivers/me/tasks");
          const newPending = (Array.isArray(driverTasks) ? driverTasks : []).find(t => t.shipmentId === shipData.id);
          if (newPending) {
            await mf.post(`/assignments/${newPending.id}/respond`, { action: "ACCEPT" });
          }
        }
      }

      // Re-render màn hình tasks để khởi tạo DriverTripController và MapLibre
      mf.state.view = "tasks";
      mf.renderShell?.();
      await mf.renderView?.();
    }

    // Đợi controller và MapLibre khởi tạo xong
    for (let i = 0; i < 20; i++) {
      activeTrip = mf.getActiveDriverTripController?.();
      if (activeTrip) {
        if (activeTrip.engine?.ready) {
          try { await activeTrip.engine.ready(); } catch { /* ignore */ }
        }
        return activeTrip;
      }
      await new Promise(r => setTimeout(r, 150));
    }

    return activeTrip;
  }

  // Lấy lộ trình đường bộ thực tế từ OSRM giữa 2 điểm bất kỳ (dùng cho chế độ Mock GPS
  // để vạch chỉ đường luôn bắt đầu chính xác từ vị trí xe giả lập tới điểm đích).
  async function fetchMockOsrmRoute(fromPt, toPt) {
    if (!fromPt || !toPt) return null;
    try {
      const url = `https://router.project-osrm.org/route/v1/driving/${fromPt.lng},${fromPt.lat};${toPt.lng},${toPt.lat}?overview=full&geometries=geojson&steps=false`;
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      if (!res.ok) return null;
      const data = await res.json();
      const geom = data?.routes?.[0]?.geometry;
      if (geom && geom.type === "LineString" && Array.isArray(geom.coordinates) && geom.coordinates.length >= 2) {
        return geom;
      }
    } catch {
      // fallback to straight line if OSRM public server is unreachable
    }
    return {
      type: "LineString",
      coordinates: [
        [fromPt.lng, fromPt.lat],
        [toPt.lng, toPt.lat]
      ]
    };
  }

  // 1. ĐẶT VỊ TRÍ TÀI XẾ NGẪU NHIÊN (Không theo GPS thật của trình duyệt)
  async function randomizeDriverLocation() {
    const mf = getMf();
    try {
      stopMovementSimulation();
      stopKeepAlive();
      if (!isMockGpsEnabled()) setMockGpsEnabled(true, true);
      const overlay = document.getElementById("demo-modal-overlay");
      if (overlay) overlay.classList.remove("open");

      const activeTrip = await ensureActiveDriverTrip();
      if (!activeTrip) {
        mf?.showToast?.("Không tìm thấy chuyến đi tài xế đang hoạt động.", "error");
        return;
      }

      let baseLat = SAMPLES.pickup.lat;
      let baseLng = SAMPLES.pickup.lng;
      if (activeTrip.destination?.lat != null && activeTrip.destination?.lng != null) {
        baseLat = activeTrip.destination.lat;
        baseLng = activeTrip.destination.lng;
      }

      // Tạo vị trí ngẫu nhiên cách điểm đích khoảng 1.4 - 2.5 km
      const distanceKm = 1.3 + Math.random() * 1.3;
      const angle = Math.random() * Math.PI * 2;
      const randLat = Number((baseLat + (distanceKm / 111) * Math.sin(angle)).toFixed(6));
      const randLng = Number((baseLng + (distanceKm / 109) * Math.cos(angle)).toFixed(6));
      const randPt = { lat: randLat, lng: randLng };

      // Lấy lộ trình đường phố OSRM trực tiếp từ vị trí ngẫu nhiên tới điểm đích
      const customGeo = await fetchMockOsrmRoute(randPt, { lat: baseLat, lng: baseLng });
      if (customGeo) {
        activeTrip.route = { ...(activeTrip.route || {}), geometry: customGeo };
      }

      // Cập nhật vị trí mock + vẽ lại đường xanh trên bản đồ
      activeTrip.setMockLocation(randPt, true);
      activeTrip.engine?.fitRelevantPoints?.();
      const sheetCoords = document.getElementById("sheet-coords");
      if (sheetCoords) sheetCoords.textContent = `${randLat.toFixed(5)}, ${randLng.toFixed(5)}`;

      // Đồng bộ ngầm lên server (nếu được phép theo ngưỡng tốc độ)
      pushLocationToServer(randPt, 10).catch(() => {});

      mf?.showToast?.(`🎲 Đã đặt tài xế tại vị trí ngẫu nhiên (~${distanceKm.toFixed(1)} km đến đích)! Bấm '▶️ Xe chạy' để xe bắt đầu chạy.`);
      updateSimControlsUi("ready");
    } catch (err) {
      mf?.showToast?.(err.message, "error");
    }
  }

  // 2. NỘI SUY TỌA ĐỘ TUYẾN ĐƯỜNG ĐỂ XE CHẠY MƯỢT MÀ
  function interpolateRouteCoordinates(coords) {
    if (!Array.isArray(coords) || coords.length === 0) return [];
    const points = [];
    for (let i = 0; i < coords.length; i++) {
      const c = coords[i];
      const curr = Array.isArray(c)
        ? { lng: Number(c[0]), lat: Number(c[1]) }
        : { lng: Number(c.lng), lat: Number(c.lat) };
      points.push(curr);

      if (i < coords.length - 1) {
        const n = coords[i + 1];
        const next = Array.isArray(n)
          ? { lng: Number(n[0]), lat: Number(n[1]) }
          : { lng: Number(n.lng), lat: Number(n.lat) };

        const dLat = next.lat - curr.lat;
        const dLng = next.lng - curr.lng;
        const distM = Math.hypot(dLat * 111000, dLng * 109000);

        if (distM > 15) {
          const subSteps = Math.min(Math.floor(distM / 15), 10);
          for (let s = 1; s < subSteps; s++) {
            const r = s / subSteps;
            points.push({
              lat: Number((curr.lat + dLat * r).toFixed(6)),
              lng: Number((curr.lng + dLng * r).toFixed(6))
            });
          }
        }
      }
    }
    return points;
  }

  function generateIntermediatePoints(start, end, steps = 80) {
    const points = [];
    for (let i = 0; i <= steps; i++) {
      const ratio = i / steps;
      points.push({
        lat: Number((start.lat + (end.lat - start.lat) * ratio).toFixed(6)),
        lng: Number((start.lng + (end.lng - start.lng) * ratio).toFixed(6))
      });
    }
    return points;
  }

  function calculateBearing(pt1, pt2) {
    if (!pt1 || !pt2) return null;
    const lat1 = (pt1.lat * Math.PI) / 180;
    const lat2 = (pt2.lat * Math.PI) / 180;
    const dLng = ((pt2.lng - pt1.lng) * Math.PI) / 180;
    const y = Math.sin(dLng) * Math.cos(lat2);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const brng = (Math.atan2(y, x) * 180) / Math.PI;
    return (brng + 360) % 360;
  }

  // 3. MÔ PHỎNG XE CHẠY THỰC TẾ TRÊN BẢN ĐỒ
  async function startMovementSimulation(targetKind = null) {
    stopMovementSimulation();
    const mf = getMf();

    try {
      if (!isMockGpsEnabled()) setMockGpsEnabled(true, true);
      const overlay = document.getElementById("demo-modal-overlay");
      if (overlay) overlay.classList.remove("open");

      const activeTrip = await ensureActiveDriverTrip();
      if (!activeTrip) {
        mf?.showToast?.("Chưa tìm thấy chuyến đi nào để mô phỏng xe chạy.", "error");
        return;
      }

      // Kiểm tra trạng thái hiện tại
      if (activeTrip.phase === "AT_PICKUP") {
        mf?.showToast?.("🛵 Xe đã đến Điểm lấy hàng A! Vui lòng bấm '📦 Xác nhận đã lấy hàng' trên màn hình để tiếp tục chặng giao hàng B.", "info");
        return;
      }
      if (activeTrip.phase === "AT_DROPOFF") {
        mf?.showToast?.("🏁 Xe đã đến Điểm giao hàng B! Vui lòng bấm '✓ Xác nhận giao thành công' trên màn hình.", "info");
        return;
      }
      if (activeTrip.phase === "COMPLETE") {
        mf?.showToast?.("Chuyến đi đã hoàn tất thành công! Hãy tạo hoặc nhận đơn mới để tiếp tục demo.", "info");
        return;
      }

      const isToPickup = targetKind === "PICKUP" || activeTrip.phase === "TO_PICKUP";
      const phaseName = isToPickup ? "Điểm lấy hàng A" : "Điểm giao hàng B";

      const statusEl = document.getElementById("demo-simulation-status");
      if (statusEl) {
        statusEl.style.display = "block";
        statusEl.textContent = `🚗 Đang tải lộ trình OSRM tới ${phaseName}...`;
      }

      stopKeepAlive();

      // Lưu lại vị trí xe hiện tại (nếu đã có từ mock hoặc di chuyển trước đó)
      const currentDriverPoint = activeTrip.currentLocation || activeTrip.loadSavedMockLocation?.();

      // Đảm bảo bật mock mode trước khi refresh để không bị vị trí cũ kéo lùi
      activeTrip.setMockMode(true);
      await activeTrip.refreshNavigation();

      if (currentDriverPoint && Number.isFinite(currentDriverPoint.lat) && Number.isFinite(currentDriverPoint.lng)) {
        activeTrip.currentLocation = currentDriverPoint;
      }

      const toLatLng = c => {
        const p = Array.isArray(c) ? { lng: Number(c[0]), lat: Number(c[1]) } : { lng: Number(c?.lng), lat: Number(c?.lat) };
        return Number.isFinite(p.lat) && Number.isFinite(p.lng) ? p : null;
      };
      const dest = activeTrip.destination || (isToPickup ? SAMPLES.pickup : SAMPLES.dropoff);
      let startPoint = activeTrip.currentLocation || { lat: dest.lat + 0.012, lng: dest.lng + 0.012 };

      // Nếu xe đang ở quá sát đích (< 25m) mà người dùng bấm "▶️ Xe chạy",
      // tự động lùi xe ra ~1.5km để có quãng đường cho xe chạy mô phỏng
      if (distanceMeters(startPoint, dest) < 25) {
        const angle = Math.random() * Math.PI * 2;
        startPoint = {
          lat: Number((dest.lat + (1.5 / 111) * Math.sin(angle)).toFixed(6)),
          lng: Number((dest.lng + (1.5 / 109) * Math.cos(angle)).toFixed(6))
        };
        activeTrip.setMockLocation(startPoint, true);
      }

      // Đảm bảo lộ trình OSRM xuất phát đúng từ vị trí hiện tại của xe (startPoint) tới đích (dest)
      let routeCoords = activeTrip?.route?.geometry?.coordinates;
      const firstCoordPt = Array.isArray(routeCoords) && routeCoords.length ? toLatLng(routeCoords[0]) : null;
      if (!firstCoordPt || distanceMeters(startPoint, firstCoordPt) > 60) {
        const freshGeo = await fetchMockOsrmRoute(startPoint, dest);
        if (freshGeo) {
          activeTrip.route = { ...(activeTrip.route || {}), geometry: freshGeo };
          routeCoords = freshGeo.coordinates;
        }
      }

      let path = [];
      if (Array.isArray(routeCoords) && routeCoords.length >= 2) {
        path = routeCoords.map(toLatLng).filter(Boolean);
      } else {
        path = [startPoint, { lat: dest.lat, lng: dest.lng }];
      }
      // Bắt đầu đúng tại vị trí xe hiện tại và kết thúc đúng tại điểm đích
      if (path.length && distanceMeters(startPoint, path[0]) > 2) path.unshift({ lat: startPoint.lat, lng: startPoint.lng });
      if (path.length && distanceMeters(path[path.length - 1], dest) > 2) path.push({ lat: dest.lat, lng: dest.lng });

      const cumulative = [0];
      for (let i = 1; i < path.length; i++) {
        cumulative.push(cumulative[i - 1] + distanceMeters(path[i - 1], path[i]));
      }
      const totalM = cumulative[cumulative.length - 1] || 0;

      if (path.length < 2 || totalM < 1) {
        mf?.showToast?.("Xe đã ở ngay điểm đích hoặc không tìm thấy lộ trình di chuyển.", "info");
        stopMovementSimulation();
        return;
      }

      // Đồng bộ ngầm điểm xuất phát lên server (không chặn giao diện)
      pushLocationToServer(startPoint, 10).catch(() => {});

      updateSimControlsUi("driving");
      window.MoveFlowSfx?.play("ding");
      const initialSpeedMps = getSimSpeedMps();
      const etaSec = Math.round(totalM / initialSpeedMps);
      mf?.showToast?.(`🚗 Xe bắt đầu chạy tới ${phaseName} (${(totalM / 1000).toFixed(2)} km • ${getSimSpeedKmh()} km/h • ~${etaSec}s)…`, "info");

      const TICK_MS = 100;
      const detailEngine = mf?.getActiveDetailMapEngine?.();
      let traveled = 0;
      let segIdx = 0;
      let tick = 0;
      let lastTickAt = performance.now();
      let uploading = false;
      let finishing = false;

      const finishDrive = async () => {
        finishing = true;
        stopMovementSimulation();
        const lastPt = { lat: dest.lat, lng: dest.lng };
        // Xóa vạch xanh đã đi hết khi xe cán đích
        activeTrip.route = null;
        activeTrip.engine?.setRoute?.(null);
        detailEngine?.setRoute?.(null);
        activeTrip.setMockLocation(lastPt, true);
        const sheetSpeed = document.getElementById("sheet-speed");
        if (sheetSpeed) sheetSpeed.textContent = "0 km/h";
        const sheetCoords = document.getElementById("sheet-coords");
        if (sheetCoords) sheetCoords.textContent = `${lastPt.lat.toFixed(5)}, ${lastPt.lng.toFixed(5)}`;

        // Đồng bộ điểm cuối ngầm lên server và duy trì keep-alive
        pushLocationToServer(lastPt, 5).catch(() => {});
        startArrivalKeepAlive(activeTrip, lastPt);

        window.MoveFlowSfx?.play("arrived");
        if (isToPickup) {
          mf?.showToast?.("🛵 Xe đã đến Điểm lấy hàng A! Hãy bấm '⚑ Đã đến điểm lấy hàng' rồi '📦 Xác nhận đã lấy hàng'.", "success");
        } else {
          mf?.showToast?.("🏁 Xe đã đến Điểm giao hàng B! Hãy bấm '⚑ Đã đến điểm giao hàng' rồi '✓ Xác nhận giao thành công'.", "success");
        }
        updateSimControlsUi("arrived");
      };

      movementInterval = setInterval(() => {
        if (finishing) return;
        // Controller bị huỷ (đổi màn hình / đăng xuất) thì dừng
        if (mf?.getActiveDriverTripController?.() !== activeTrip) {
          stopMovementSimulation();
          return;
        }

        const now = performance.now();
        const dt = Math.min((now - lastTickAt) / 1000, 0.5);
        lastTickAt = now;
        tick++;

        const baseSpeedMps = getSimSpeedMps();
        const speedMps = baseSpeedMps * (1 + 0.05 * Math.sin(tick * 0.12));
        traveled = Math.min(totalM, traveled + speedMps * dt);
        while (segIdx < path.length - 2 && cumulative[segIdx + 1] < traveled) segIdx++;

        const a = path[segIdx];
        const b = path[segIdx + 1];
        const segLen = cumulative[segIdx + 1] - cumulative[segIdx];
        const r = segLen > 0 ? Math.min(1, Math.max(0, (traveled - cumulative[segIdx]) / segLen)) : 1;
        const pt = { lat: a.lat + (b.lat - a.lat) * r, lng: a.lng + (b.lng - a.lng) * r };
        const bearing = calculateBearing(a, b);

        // Rút ngắn trực tiếp thanh xanh chỉ đường (polyline) theo đúng phần đường còn lại phía trước mũi xe
        const remainingCoords = [
          [pt.lng, pt.lat],
          ...path.slice(segIdx + 1).map(p => [p.lng, p.lat])
        ];
        const remainingGeo = {
          type: "LineString",
          coordinates: remainingCoords
        };
        activeTrip.route = { ...(activeTrip.route || {}), geometry: remainingGeo };

        const pct = Math.round((traveled / totalM) * 100);
        const remainingM = Math.max(0, Math.round(totalM - traveled));
        if (statusEl) {
          statusEl.textContent = `🚗 Đang chạy tới ${phaseName}: ${pct}% • còn ${remainingM} m • ${pt.lat.toFixed(5)}, ${pt.lng.toFixed(5)}`;
        }
        const sheetEta = document.getElementById("sheet-eta");
        if (sheetEta) sheetEta.textContent = `🚗 ${pct}% • ~${Math.ceil(remainingM / baseSpeedMps)}s`;
        const sheetSpeed = document.getElementById("sheet-speed");
        if (sheetSpeed) sheetSpeed.textContent = `${Math.round(speedMps * 3.6)} km/h`;
        const sheetCoords = document.getElementById("sheet-coords");
        if (sheetCoords) sheetCoords.textContent = `${pt.lat.toFixed(5)}, ${pt.lng.toFixed(5)}`;

        // Cập nhật marker + rút ngắn đường xanh + khoảng cách cục bộ; camera bám theo xe mỗi ~1s
        activeTrip.setMockLocation(pt, tick % 10 === 0, bearing);
        activeTrip.engine?.setRoute?.(remainingGeo);
        if (detailEngine) {
          detailEngine.setDriverLocation(pt, false, bearing);
          detailEngine.setRoute?.(remainingGeo);
        }

        // Đồng bộ vị trí lên server mỗi ~5.5s (để người gửi / điều phối thấy xe chạy)
        if (!uploading && Date.now() - lastServerSync.time >= SERVER_SYNC_INTERVAL_MS) {
          uploading = true;
          pushLocationToServer(pt, 10)
            .then(res => { if (!res.ok) console.warn("[MoveFlowDemo] Server từ chối vị trí:", res.reason, res.error?.message || ""); })
            .finally(() => { uploading = false; });
        }

        if (traveled >= totalM) finishDrive();
      }, TICK_MS);
    } catch (err) {
      stopMovementSimulation();
      mf?.showToast?.(err.message, "error");
    }
  }

  function stopMovementSimulation() {
    if (movementInterval) {
      clearInterval(movementInterval);
      movementInterval = null;
    }
    const statusEl = document.getElementById("demo-simulation-status");
    if (statusEl) {
      statusEl.style.display = "none";
    }
    const sheetSpeed = document.getElementById("sheet-speed");
    if (sheetSpeed) {
      sheetSpeed.textContent = "0 km/h";
    }
    const mf = getMf();
    const trip = mf?.getActiveDriverTripController?.();
    if (trip?.currentLocation) {
      trip.saveMockLocation?.(trip.currentLocation, true);
      pushLocationToServer(trip.currentLocation, 10).catch(() => {});
    }
    updateSimControlsUi("stopped");
  }

  function updateSimControlsUi(mode) {
    const driveBtn = document.getElementById("btn-trip-sim-drive");
    const stopBtn = document.getElementById("btn-trip-sim-stop");
    const modalDrivePickup = document.getElementById("btn-modal-sim-drive-pickup");
    const modalDriveDropoff = document.getElementById("btn-modal-sim-drive-dropoff");
    const modalStop = document.getElementById("btn-modal-sim-stop");

    if (mode === "driving") {
      if (driveBtn) { driveBtn.disabled = true; driveBtn.textContent = "🚗 Xe đang chạy…"; }
      if (stopBtn) stopBtn.style.display = "inline-block";
      if (modalDrivePickup) modalDrivePickup.disabled = true;
      if (modalDriveDropoff) modalDriveDropoff.disabled = true;
      if (modalStop) modalStop.style.display = "block";
    } else {
      if (driveBtn) { driveBtn.disabled = false; driveBtn.textContent = "▶️ Xe chạy"; }
      if (stopBtn) stopBtn.style.display = "none";
      if (modalDrivePickup) modalDrivePickup.disabled = false;
      if (modalDriveDropoff) modalDriveDropoff.disabled = false;
    }
  }

  async function teleportToTarget(type) {
    const mf = getMf();
    try {
      if (!isMockGpsEnabled()) setMockGpsEnabled(true, true);
      const overlay = document.getElementById("demo-modal-overlay");
      if (overlay) overlay.classList.remove("open");

      const activeTrip = await ensureActiveDriverTrip();
      if (!activeTrip) {
        mf?.showToast?.("Chưa tìm thấy chuyến đi nào.", "error");
        return;
      }

      let targetLat = type === "pickup" ? SAMPLES.pickup.lat : SAMPLES.dropoff.lat;
      let targetLng = type === "pickup" ? SAMPLES.pickup.lng : SAMPLES.dropoff.lng;

      if (activeTrip.destination?.lat != null && activeTrip.destination?.lng != null) {
        targetLat = activeTrip.destination.lat;
        targetLng = activeTrip.destination.lng;
      }

      const simLat = Number((targetLat + 0.0001).toFixed(6));
      const simLng = Number((targetLng + 0.0001).toFixed(6));

      stopMovementSimulation();
      stopKeepAlive();
      activeTrip.route = null;
      activeTrip.engine?.setRoute?.(null);
      activeTrip.setMockLocation({ lat: simLat, lng: simLng }, true);
      const sheetCoords = document.getElementById("sheet-coords");
      if (sheetCoords) sheetCoords.textContent = `${simLat.toFixed(5)}, ${simLng.toFixed(5)}`;

      pushLocationToServer({ lat: simLat, lng: simLng }, 5).catch(() => {});
      startArrivalKeepAlive(activeTrip, { lat: simLat, lng: simLng });

      mf?.showToast?.(`Đã định vị tài xế tới sát điểm ${type === "pickup" ? "lấy A" : "giao B"} (< 25m)!`);
    } catch (err) {
      mf?.showToast?.(err.message, "error");
    }
  }

  // Global public interface
  window.MoveFlowDemo = {
    init: createDom,
    updateVisibility: createDom,
    isMockGpsEnabled,
    setMockGpsEnabled,
    getSimSpeedKmh,
    setSimSpeedKmh,
    fetchMockOsrmRoute,
    transitionWithInstantFallback,
    ensureActiveDriverTrip,
    randomizeDriverLocation,
    startMovementSimulation,
    stopMovementSimulation,
    teleportToTarget
  };

  // Auto-init
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", createDom);
  } else {
    createDom();
  }
})();
