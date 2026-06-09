const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const GRID = 20;
const COLS = canvas.width / GRID;
const ROWS = canvas.height / GRID;

let snake = [
  { x: 10, y: 10 },
  { x: 9, y: 10 },
  { x: 8, y: 10 },
];

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = '#0a0';
  for (const seg of snake) {
    ctx.fillRect(seg.x * GRID, seg.y * GRID, GRID - 1, GRID - 1);
  }
  requestAnimationFrame(draw);
}

draw();
