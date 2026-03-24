import { Game } from './Game.js';

const app = document.getElementById('app');
const game = new Game(app);

// Difficulty buttons
document.querySelectorAll('.diff-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.diff-btn').forEach(b => b.classList.remove('selected'));
    btn.classList.add('selected');
  });
});

const enterPrompt = document.getElementById('overlay-enter-prompt');
enterPrompt.onclick = () => {
  const selected = document.querySelector('.diff-btn.selected');
  game.difficulty = selected ? selected.dataset.diff : 'hard';
  game.startLevel(1);
};

document.addEventListener('keydown', e => {
  const overlay = document.getElementById('overlay');
  if (overlay.classList.contains('hidden')) return;

  if (e.code === 'Space' || e.code === 'Enter') {
    enterPrompt.click();
  } else if (e.code === 'ArrowLeft' || e.code === 'KeyA') {
    const btns = [...document.querySelectorAll('.diff-btn')];
    const idx = btns.findIndex(b => b.classList.contains('selected'));
    if (idx > 0) {
      btns[idx].classList.remove('selected');
      btns[idx - 1].classList.add('selected');
    }
  } else if (e.code === 'ArrowRight' || e.code === 'KeyD') {
    const btns = [...document.querySelectorAll('.diff-btn')];
    const idx = btns.findIndex(b => b.classList.contains('selected'));
    if (idx < btns.length - 1) {
      btns[idx].classList.remove('selected');
      btns[idx + 1].classList.add('selected');
    }
  }
});

document.addEventListener('pointerlockchange', () => {
  game.setPointerLocked(document.pointerLockElement != null);
});

document.addEventListener('pointerlockerror', () => {
  console.warn('Pointer lock failed');
});
