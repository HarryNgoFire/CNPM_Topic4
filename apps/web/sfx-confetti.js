/**
 * MoveFlow SFX & Confetti Experience Module
 * - Pure Web Audio API Synthesizer (0 external audio files, 0 latency, 0 bandwidth)
 * - Hardware Accelerated Canvas Confetti Celebration (60fps, auto cleanup)
 */
(() => {
  let audioCtx = null;

  function getAudioContext() {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (audioCtx && audioCtx.state === "suspended") {
      audioCtx.resume();
    }
    return audioCtx;
  }

  function isSfxEnabled() {
    return localStorage.getItem("moveflow_sfx_enabled") !== "0";
  }

  function setSfxEnabled(enabled) {
    localStorage.setItem("moveflow_sfx_enabled", enabled ? "1" : "0");
  }

  // Pure Web Audio tone synthesizer
  function playTone(freq, type, durationMs, startDelayMs = 0, gainLevel = 0.15) {
    if (!isSfxEnabled()) return;
    try {
      const ctx = getAudioContext();
      if (!ctx) return;

      const startTime = ctx.currentTime + startDelayMs / 1000;
      const endTime = startTime + durationMs / 1000;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = type; // 'sine', 'triangle', 'sawtooth'
      osc.frequency.setValueAtTime(freq, startTime);

      // Smooth attack and exponential decay
      gain.gain.setValueAtTime(0.001, startTime);
      gain.gain.linearRampToValueAtTime(gainLevel, startTime + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, endTime);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(startTime);
      osc.stop(endTime);
    } catch {
      // AudioContext autoplay restrictions handled silently
    }
  }

  function playSfx(kind) {
    if (!isSfxEnabled()) return;
    switch (kind) {
      case "ding": // New order or task notification
        playTone(587.33, "sine", 220, 0, 0.18); // D5
        playTone(880.00, "sine", 400, 100, 0.22); // A5
        break;

      case "arrived": // Vehicle arrived at pickup or dropoff (<25m)
        playTone(659.25, "triangle", 120, 0, 0.20); // E5
        playTone(880.00, "triangle", 180, 130, 0.22); // A5
        break;

      case "delivered": // Delivery successfully completed
        playTone(523.25, "triangle", 150, 0, 0.22); // C5
        playTone(659.25, "triangle", 150, 120, 0.22); // E5
        playTone(783.99, "triangle", 180, 240, 0.25); // G5
        playTone(1046.50, "sine", 600, 380, 0.28); // C6
        break;

      case "click": // Quick interactive click
        playTone(900, "sine", 35, 0, 0.05);
        break;
    }
  }

  // Canvas Confetti Celebration
  function triggerConfetti() {
    try {
      const existing = document.getElementById("moveflow-confetti-canvas");
      if (existing) existing.remove();

      const canvas = document.createElement("canvas");
      canvas.id = "moveflow-confetti-canvas";
      canvas.style.position = "fixed";
      canvas.style.top = "0";
      canvas.style.left = "0";
      canvas.style.width = "100vw";
      canvas.style.height = "100vh";
      canvas.style.pointerEvents = "none";
      canvas.style.zIndex = "999999";
      document.body.appendChild(canvas);

      const ctx = canvas.getContext("2d");
      const dpr = window.devicePixelRatio || 1;
      canvas.width = window.innerWidth * dpr;
      canvas.height = window.innerHeight * dpr;
      ctx.scale(dpr, dpr);

      const colors = ["#2563eb", "#38bdf8", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6", "#f43f5e"];
      const particles = [];
      const count = 90;

      for (let i = 0; i < count; i++) {
        particles.push({
          x: window.innerWidth * (0.3 + Math.random() * 0.4),
          y: window.innerHeight * 0.6,
          vx: (Math.random() - 0.5) * 16,
          vy: -12 - Math.random() * 10,
          size: 6 + Math.random() * 6,
          color: colors[Math.floor(Math.random() * colors.length)],
          rotation: Math.random() * 360,
          rotationSpeed: (Math.random() - 0.5) * 12,
          wobble: Math.random() * 10,
          wobbleSpeed: 0.1 + Math.random() * 0.08,
          opacity: 1,
          gravity: 0.38 + Math.random() * 0.15
        });
      }

      let animId = null;
      const startTime = Date.now();
      const durationMs = 2800;

      function render() {
        const elapsed = Date.now() - startTime;
        if (elapsed > durationMs) {
          cancelAnimationFrame(animId);
          canvas.remove();
          return;
        }

        ctx.clearRect(0, 0, window.innerWidth, window.innerHeight);

        const fade = elapsed > durationMs - 700 ? (durationMs - elapsed) / 700 : 1;

        for (let i = 0; i < particles.length; i++) {
          const p = particles[i];
          p.x += p.vx;
          p.y += p.vy;
          p.vy += p.gravity;
          p.vx *= 0.985;
          p.rotation += p.rotationSpeed;
          p.wobble += p.wobbleSpeed;

          const wobbleX = p.x + Math.sin(p.wobble) * 6;

          ctx.save();
          ctx.translate(wobbleX, p.y);
          ctx.rotate((p.rotation * Math.PI) / 180);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.opacity * fade);
          ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
          ctx.restore();
        }

        animId = requestAnimationFrame(render);
      }

      animId = requestAnimationFrame(render);
    } catch (e) {
      console.warn("Confetti error:", e);
    }
  }

  // Global Interface
  window.MoveFlowSfx = {
    play: playSfx,
    triggerConfetti,
    isSfxEnabled,
    setSfxEnabled
  };
})();
