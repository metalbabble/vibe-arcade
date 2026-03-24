export class HUD {
  constructor() {
    this._playerFill  = document.getElementById('player-health-fill');
    this._playerVal   = document.getElementById('player-health-val');
    this._enemyBars   = document.getElementById('enemy-bars');
    this._killCount   = document.getElementById('kill-count');
    this._damageFlash = document.getElementById('damage-flash');
    this._levelBanner = document.getElementById('level-banner');
    this._victoryBanner = document.getElementById('victory-banner');
    this._flashTimeout = null;
    this._healthFlashTimeout = null;
  }

  init(enemyCount) {
    this._enemyBars.innerHTML = '';
    this._enemyBarFills = [];
    for (let i = 0; i < enemyCount; i++) {
      const row = document.createElement('div');
      row.className = 'enemy-bar-row';
      row.innerHTML = `
        <div class="health-bar-outer" style="border-color:#ff4400">
          <div class="health-bar-inner" style="background:#ff4400;width:100%;height:100%"></div>
        </div>`;
      this._enemyBars.appendChild(row);
      this._enemyBarFills.push(row.querySelector('.health-bar-inner'));
    }
  }

  showLevelBanner(level) {
    const el = this._levelBanner;
    el.textContent = `LEVEL ${level}`;
    el.classList.add('visible');
    setTimeout(() => el.classList.remove('visible'), 2500);
  }

  update(player, enemies, totalKills) {
    const ph = Math.max(0, player.health);
    this._playerFill.style.width  = `${ph}%`;
    this._playerVal.textContent   = Math.round(ph);

    enemies.forEach((e, i) => {
      const fill = this._enemyBarFills[i];
      if (!fill) return;
      const pct = Math.max(0, (e.health / e.maxHealth) * 100);
      fill.style.width = `${pct}%`;
    });

    this._killCount.textContent = totalKills;
  }

  showVictory() {
    this._victoryBanner.classList.add('visible');
  }

  hideVictory() {
    this._victoryBanner.classList.remove('visible');
  }

  flashHealthBar() {
    if (this._healthFlashTimeout) clearTimeout(this._healthFlashTimeout);
    this._playerFill.style.transition = 'none';
    this._playerFill.style.background = '#ffffff';
    this._healthFlashTimeout = setTimeout(() => {
      this._playerFill.style.transition = 'background 200ms ease-out';
      this._playerFill.style.background = '';
    }, 80);
  }

  flashDamage() {
    if (this._flashTimeout) clearTimeout(this._flashTimeout);
    this._damageFlash.style.transition = 'none';
    this._damageFlash.style.background = 'rgba(255,255,255,0.75)';
    this._flashTimeout = setTimeout(() => {
      this._damageFlash.style.transition = 'background 150ms ease-out';
      this._damageFlash.style.background = 'rgba(255,255,255,0)';
    }, 60);
  }
}
