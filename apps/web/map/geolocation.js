/**
 * Browser Geolocation Lifecycle Manager for MoveFlow.
 */

export function formatGeolocationError(error) {
  if (!error) return "Không thể xác định vị trí.";
  switch (error.code) {
    case 1: // PERMISSION_DENIED
      return "Quyền truy cập vị trí bị từ chối. Vui lòng bật định vị trên trình duyệt.";
    case 2: // POSITION_UNAVAILABLE
      return "Không có tín hiệu GPS hoặc không thể xác định vị trí hiện tại.";
    case 3: // TIMEOUT
      return "Hết thời gian chờ nhận tín hiệu vị trí GPS.";
    default:
      return error.message || "Lỗi xác định vị trí GPS.";
  }
}

/**
 * Single-shot GPS position fetch.
 * Never returns fake/mock coordinates.
 */
export function getCurrentPositionOnce(options = {}) {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      return reject(new Error("Trình duyệt không hỗ trợ Geolocation"));
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        resolve({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
          capturedAt: new Date(pos.timestamp).toISOString(),
        });
      },
      (err) => reject(new Error(formatGeolocationError(err))),
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
        ...options,
      },
    );
  });
}

/**
 * Continuous GPS watch.
 * Discards backwards timestamps and returns an unwatch function.
 */
export function startLocationWatch({ onPosition, onError, options = {} }) {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    if (onError) onError(new Error("Trình duyệt không hỗ trợ Geolocation"));
    return () => {};
  }

  let lastTimestamp = 0;
  const watchId = navigator.geolocation.watchPosition(
    (pos) => {
      if (pos.timestamp < lastTimestamp) return;
      lastTimestamp = pos.timestamp;

      if (onPosition) {
        onPosition({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
          accuracyM: pos.coords.accuracy,
          capturedAt: new Date(pos.timestamp).toISOString(),
        });
      }
    },
    (err) => {
      if (onError) onError(new Error(formatGeolocationError(err)));
    },
    {
      enableHighAccuracy: true,
      timeout: 15000,
      maximumAge: 5000,
      ...options,
    },
  );

  return () => {
    try {
      navigator.geolocation.clearWatch(watchId);
    } catch {
      // ignore
    }
  };
}
