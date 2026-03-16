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
      #vibe-stick-base {
        position: absolute;
        display: none;
        width: 118px; height: 118px;
        border-radius: 50%;
        background: rgba(124,58,237,0.13);
        border: 2px solid rgba(168,85,247,0.42);
        box-shadow: 0 0 22px rgba(124,58,237,0.22), inset 0 0 14px rgba(124,58,237,0.08);
        transform: translate(-50%,-50%);
        pointer-events: none;
      }
      #vibe-stick-thumb {
        position: absolute;
        width: 46px; height: 46px;
        border-radius: 50%;
        background: radial-gradient(circle at 38% 33%, rgba(210,170,255,0.92), rgba(124,58,237,0.78));
        border: 2px solid rgba(168,85,247,0.85);
        box-shadow: 0 0 14px rgba(168,85,247,0.55);
        top: 50%; left: 50%;
        transform: translate(-50%,-50%);
        pointer-events: none;
        transition: top 0.04s linear, left 0.04s linear;
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
        <div id="vibe-stick-base">
          <div id="vibe-stick-thumb"></div>
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
    const zone  = document.getElementById('vibe-stick-zone');
    const base  = document.getElementById('vibe-stick-base');
    const thumb = document.getElementById('vibe-stick-thumb');
    const DEAD = 14, MAX = 44;

    zone.addEventListener('touchstart', e => {
      e.preventDefault();
      activate();
      if (joystick.active) return;
      const t = e.changedTouches[0];
      joystick.active = true;
      joystick.touchId = t.identifier;
      joystick.baseX = t.clientX;
      joystick.baseY = t.clientY;
      base.style.left = t.clientX + 'px';
      base.style.top  = t.clientY + 'px';
      base.style.display = 'block';
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
      const clamped = Math.min(dist, MAX);
      const angle = Math.atan2(dy, dx);

      thumb.style.left = `calc(50% + ${Math.cos(angle) * clamped}px)`;
      thumb.style.top  = `calc(50% + ${Math.sin(angle) * clamped}px)`;

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
          base.style.display = 'none';
          thumb.style.left = '50%';
          thumb.style.top  = '50%';
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
