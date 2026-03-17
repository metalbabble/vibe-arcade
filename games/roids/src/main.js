import '../../../shared/touch-controller.js'

const canvas = document.getElementById('gameCanvas');
function scaleToFit() {
  const scale = Math.min(window.innerWidth / canvas.width, window.innerHeight / canvas.height, 1);
  canvas.style.width  = (canvas.width  * scale) + 'px';
  canvas.style.height = (canvas.height * scale) + 'px';
}
scaleToFit();
window.addEventListener('resize', scaleToFit);
