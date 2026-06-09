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

let dir = { x: 1, y: 0 };
let nextDir = { x: 1, y: 0 };
let food = null;
let score = 0;

function spawnFood() {
  let pos;
  do {
    pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  food = pos;
}
spawnFood();

document.addEventListener('keydown', (e) => {
  const map = {
    ArrowUp:    { x:  0, y: -1 },
    ArrowDown:  { x:  0, y:  1 },
    ArrowLeft:  { x: -1, y:  0 },
    ArrowRight: { x:  1, y:  0 },
  };
  const d = map[e.key];
  if (!d) return;
  if (d.x + dir.x === 0 && d.y + dir.y === 0) return;
  nextDir = d;
});

function update() {
  dir = nextDir;
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
  head.x = (head.x + COLS) % COLS;
  head.y = (head.y + ROWS) % ROWS;
  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 10;
    spawnFood();
  } else {
    snake.pop();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = '#f00';
  ctx.fillRect(food.x * GRID, food.y * GRID, GRID - 1, GRID - 1);

  ctx.fillStyle = '#0a0';
  for (const seg of snake) {
    ctx.fillRect(seg.x * GRID, seg.y * GRID, GRID - 1, GRID - 1);
  }

  ctx.fillStyle = '#fff';
  ctx.font = '16px monospace';
  ctx.fillText('分数: ' + score, 10, 20);
}

setInterval(update, 150);

function loop() {
  draw();
  requestAnimationFrame(loop);
}
loop();
