/**
 * VibeArcade Touch Controller
 * Adds a transparent virtual joystick + buttons overlay for mobile play.
 * Synthesises keyboard events so each game needs zero changes.
 */
(function () {
  'use strict';

  // ── Key definitions ────────────────────────────────────────────────────────
  const KEY_INFO = {
    ArrowLeft:  { key: 'ArrowLeft',  code: 'ArrowLeft',  keyCode: 37, which: 37 },
    ArrowRight: { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, which: 39 },
    ArrowUp:    { key: 'ArrowUp',    code: 'ArrowUp',    keyCode: 38, which: 38 },
    ArrowDown:  { key: 'ArrowDown',  code: 'ArrowDown',  keyCode: 40, which: 40 },
    Space:      { key: ' ',          code: 'Space',       keyCode: 32, which: 32 },
    Enter:      { key: 'Enter',      code: 'Enter',       keyCode: 13, which: 13 },
  };

  const heldKeys = new Set();
  let touchMode = false;
  let fireRepeat = null;

  const joystick = { active: false, touchId: null, baseX: 0, baseY: 0 };

  // ── Synthetic key helpers ──────────────────────────────────────────────────
  function fireEvent(keyName, type) {
    const info = KEY_INFO[keyName];
    if (!info) return;
    window.dispatchEvent(new KeyboardEvent(type, {
      ...info, bubbles: true, cancelable: true, composed: true,
    }));
  }

  function pressKey(k) {
    if (heldKeys.has(k)) return;
    heldKeys.add(k);
    fireEvent(k, 'keydown');
  }

  function releaseKey(k) {
    if (!heldKeys.has(k)) return;
    heldKeys.delete(k);
    fireEvent(k, 'keyup');
  }

  function releaseAllDirs() {
    ['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].forEach(releaseKey);
  }

  // ── Touch-mode activation ─────────────────────────────────────────────────
  function activate() {
    if (touchMode) return;
    touchMode = true;
    // Lock viewport so the game doesn't scroll or zoom
    const vp = document.querySelector('meta[name="viewport"]');
    if (vp) vp.content = 'width=device-width, initial-scale=1.0, user-scalable=no';
    const overlay = document.getElementById('vibe-tc-overlay');
    if (overlay) overlay.style.display = 'block';
  }

  // ── Overlay markup & styles ───────────────────────────────────────────────
  function buildOverlay() {
    if (document.getElementById('vibe-tc-overlay')) return;

    const style = document.createElement('style');
    style.textContent = `
      #vibe-tc-overlay {
        display: none;
        position: fixed;
        inset: 0;
        pointer-events: none;
        z-index: 9999;
        user-select: none;
        -webkit-user-select: none;
        touch-action: none;
      }

      /* ── joystick ── */
      #vibe-stick-zone {
        position: absolute;
        left: 0; bottom: 0;
        width: 48%; height: 48%;
        pointer-events: all;
        touch-action: none;
      }
      #vibe-dpad {
        position: absolute;
        left: 50%; top: 50%;
        transform: translate(-50%, -50%);
        width: 130px; height: 130px;
      }
      .vibe-dpad-arrow {
        position: absolute;
        width: 36px; height: 36px;
        border-radius: 50%;
        border: 2px solid rgba(168,85,247,0.52);
        background: rgba(124,58,237,0.17);
        box-shadow: 0 0 18px rgba(124,58,237,0.22);
        color: rgba(220,190,255,0.72);
        font-family: 'Courier New', Courier, monospace;
        font-weight: bold;
        font-size: 14px;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
        transition: background 0.07s, box-shadow 0.07s, color 0.07s;
      }
      .vibe-dpad-arrow.lit {
        background: rgba(124,58,237,0.55);
        box-shadow: 0 0 32px rgba(168,85,247,0.65);
        color: #fff;
      }
      #vibe-dpad-up    { top: 0;    left: 50%; transform: translateX(-50%); }
      #vibe-dpad-down  { bottom: 0; left: 50%; transform: translateX(-50%); }
      #vibe-dpad-left  { left: 0;   top: 50%;  transform: translateY(-50%); }
      #vibe-dpad-right { right: 0;  top: 50%;  transform: translateY(-50%); }
      #vibe-dpad-dot {
        position: absolute;
        width: 28px; height: 28px;
        border-radius: 50%;
        background: radial-gradient(circle at 38% 33%, rgba(210,170,255,0.92), rgba(124,58,237,0.78));
        border: 2px solid rgba(168,85,247,0.85);
        box-shadow: 0 0 14px rgba(168,85,247,0.55);
        left: 51px; top: 51px;
        pointer-events: none;
        transition: left 0.05s linear, top 0.05s linear;
      }

      /* ── buttons ── */
      #vibe-btn-zone {
        position: absolute;
        right: 0; bottom: 0;
        width: 48%; height: 48%;
        pointer-events: none;
        display: flex;
        flex-direction: column;
        align-items: flex-end;
        justify-content: flex-end;
        padding: 0 20px 28px 0;
        gap: 14px;
      }
      .vibe-btn {
        pointer-events: all;
        touch-action: none;
        -webkit-tap-highlight-color: transparent;
        border-radius: 50%;
        border: 2px solid rgba(168,85,247,0.52);
        background: rgba(124,58,237,0.17);
        box-shadow: 0 0 18px rgba(124,58,237,0.22);
        color: rgba(220,190,255,0.72);
        font-family: 'Courier New', Courier, monospace;
        font-weight: bold;
        letter-spacing: 1px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        transition: background 0.07s, box-shadow 0.07s, color 0.07s;
      }
      .vibe-btn.pressed {
        background: rgba(124,58,237,0.55);
        box-shadow: 0 0 32px rgba(168,85,247,0.65);
        color: #fff;
      }
      #vibe-fire-btn  { width: 76px; height: 76px; font-size: 12px; }
      #vibe-start-btn { width: 54px; height: 54px; font-size: 10px; }
    `;
    document.head.appendChild(style);

    const overlay = document.createElement('div');
    overlay.id = 'vibe-tc-overlay';
    overlay.innerHTML = `
      <div id="vibe-stick-zone">
        <div id="vibe-dpad">
          <div class="vibe-dpad-arrow" id="vibe-dpad-up">▲</div>
          <div class="vibe-dpad-arrow" id="vibe-dpad-down">▼</div>
          <div class="vibe-dpad-arrow" id="vibe-dpad-left">◄</div>
          <div class="vibe-dpad-arrow" id="vibe-dpad-right">►</div>
          <div id="vibe-dpad-dot"></div>
        </div>
      </div>
      <div id="vibe-btn-zone">
        <div class="vibe-btn" id="vibe-fire-btn">FIRE</div>
        <div class="vibe-btn" id="vibe-start-btn">START</div>
      </div>
    `;
    document.body.appendChild(overlay);

    wireJoystick();
    wireButton(document.getElementById('vibe-fire-btn'),  'Space', true);
    wireButton(document.getElementById('vibe-start-btn'), 'Enter', false);
  }

  // ── Joystick ──────────────────────────────────────────────────────────────
  function wireJoystick() {
    const zone       = document.getElementById('vibe-stick-zone');
    const dot        = document.getElementById('vibe-dpad-dot');
    const arrowUp    = document.getElementById('vibe-dpad-up');
    const arrowDown  = document.getElementById('vibe-dpad-down');
    const arrowLeft  = document.getElementById('vibe-dpad-left');
    const arrowRight = document.getElementById('vibe-dpad-right');
    const DEAD = 14, MAX = 44, DOT_MAX = 28, DOT_CENTER = 51;

    function updateDpad(dx, dy) {
      const dist = Math.sqrt(dx * dx + dy * dy);
      const t = dist > 0 ? Math.min(dist, MAX) / MAX * DOT_MAX / dist : 0;
      dot.style.left = (DOT_CENTER + dx * t) + 'px';
      dot.style.top  = (DOT_CENTER + dy * t) + 'px';
      arrowLeft.classList.toggle('lit',  dx < -DEAD);
      arrowRight.classList.toggle('lit', dx > DEAD);
      arrowUp.classList.toggle('lit',    dy < -DEAD);
      arrowDown.classList.toggle('lit',  dy > DEAD);
    }

    function resetDpad() {
      dot.style.left = DOT_CENTER + 'px';
      dot.style.top  = DOT_CENTER + 'px';
      [arrowUp, arrowDown, arrowLeft, arrowRight].forEach(a => a.classList.remove('lit'));
    }

    zone.addEventListener('touchstart', e => {
      e.preventDefault();
      activate();
      if (joystick.active) return;
      const t = e.changedTouches[0];
      joystick.active = true;
      joystick.touchId = t.identifier;
      joystick.baseX = t.clientX;
      joystick.baseY = t.clientY;
    }, { passive: false });

    zone.addEventListener('touchmove', e => {
      e.preventDefault();
      if (!joystick.active) return;
      let touch = null;
      for (const t of e.changedTouches) {
        if (t.identifier === joystick.touchId) { touch = t; break; }
      }
      if (!touch) return;

      const dx = touch.clientX - joystick.baseX;
      const dy = touch.clientY - joystick.baseY;
      const dist = Math.sqrt(dx * dx + dy * dy);

      updateDpad(dx, dy);

      if (dist > DEAD) {
        if (dx < -DEAD) pressKey('ArrowLeft');  else releaseKey('ArrowLeft');
        if (dx > DEAD)  pressKey('ArrowRight'); else releaseKey('ArrowRight');
        if (dy < -DEAD) pressKey('ArrowUp');    else releaseKey('ArrowUp');
        if (dy > DEAD)  pressKey('ArrowDown');  else releaseKey('ArrowDown');
      } else {
        releaseAllDirs();
      }
    }, { passive: false });

    function endStick(e) {
      for (const t of e.changedTouches) {
        if (t.identifier === joystick.touchId) {
          joystick.active = false;
          joystick.touchId = null;
          resetDpad();
          releaseAllDirs();
          break;
        }
      }
    }
    zone.addEventListener('touchend',    endStick, { passive: false });
    zone.addEventListener('touchcancel', endStick, { passive: false });
  }

  // ── Action buttons ─────────────────────────────────────────────────────────
  function wireButton(btn, keyName, repeat) {
    const active = new Set();

    btn.addEventListener('touchstart', e => {
      e.preventDefault();
      e.stopPropagation();
      activate();
      for (const t of e.changedTouches) active.add(t.identifier);
      if (active.size === 1) {
        btn.classList.add('pressed');
        fireEvent(keyName, 'keydown');
        if (repeat) {
          clearInterval(fireRepeat);
          fireRepeat = setInterval(() => {
            fireEvent(keyName, 'keyup');
            fireEvent(keyName, 'keydown');
          }, 110);
        }
      }
    }, { passive: false });

    function release(e) {
      e.preventDefault();
      e.stopPropagation();
      for (const t of e.changedTouches) active.delete(t.identifier);
      if (active.size === 0) {
        btn.classList.remove('pressed');
        if (repeat) clearInterval(fireRepeat);
        fireEvent(keyName, 'keyup');
      }
    }
    btn.addEventListener('touchend',    release, { passive: false });
    btn.addEventListener('touchcancel', release, { passive: false });
  }

  // ── Boot ──────────────────────────────────────────────────────────────────
  function init() {
    buildOverlay();
    // First touch anywhere activates touch mode
    document.addEventListener('touchstart', activate, { passive: true });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
