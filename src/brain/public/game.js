const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const GRID = 20;
const COLS = canvas.width / GRID;
const ROWS = canvas.height / GRID;

let snake, dir, nextDir, food, score, gameOver, tick, highScore;

function init() {
  snake = [
    { x: 10, y: 10 },
    { x: 9, y: 10 },
    { x: 8, y: 10 },
  ];
  dir = { x: 1, y: 0 };
  nextDir = { x: 1, y: 0 };
  score = 0;
  gameOver = false;
  tick = 0;
  highScore = parseInt(localStorage.getItem('snakeHighScore') || '0');
  spawnFood();
}

function spawnFood() {
  let pos;
  do {
    pos = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (snake.some(s => s.x === pos.x && s.y === pos.y));
  food = pos;
}

document.addEventListener('keydown', (e) => {
  if (gameOver) {
    if (e.key === ' ') init();
    return;
  }
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
  if (gameOver) return;
  dir = nextDir;
  const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
  head.x = (head.x + COLS) % COLS;
  head.y = (head.y + ROWS) % ROWS;

  if (snake.some(s => s.x === head.x && s.y === head.y)) {
    gameOver = true;
    if (score > highScore) {
      highScore = score;
      localStorage.setItem('snakeHighScore', String(highScore));
    }
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 10;
    spawnFood();
  } else {
    snake.pop();
  }
}

function drawGrid() {
  ctx.strokeStyle = '#1a1a1a';
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= canvas.width; x += GRID) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y <= canvas.height; y += GRID) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }
}

function drawSnake() {
  for (let i = snake.length - 1; i >= 0; i--) {
    const seg = snake[i];
    const t = i / Math.max(snake.length - 1, 1);
    const r = Math.round(0 + t * 0);
    const g = Math.round(200 - t * 100);
    const b = Math.round(0 + t * 0);
    ctx.fillStyle = `rgb(${r},${g},${b})`;
    const shrink = i === 0 ? 0 : 1;
    ctx.fillRect(seg.x * GRID + shrink, seg.y * GRID + shrink, GRID - shrink * 2, GRID - shrink * 2);
  }
  // snake head eyes
  const h = snake[0];
  ctx.fillStyle = '#fff';
  const ex1 = h.x * GRID + (dir.x === 0 ? 5 : dir.x > 0 ? 12 : 5);
  const ey1 = h.y * GRID + (dir.y === 0 ? 5 : dir.y > 0 ? 12 : 5);
  const ex2 = h.x * GRID + (dir.x === 0 ? 13 : dir.x > 0 ? 12 : 5);
  const ey2 = h.y * GRID + (dir.y === 0 ? 13 : dir.y > 0 ? 12 : 5);
  ctx.fillRect(ex1, ey1, 3, 3);
  ctx.fillRect(ex2, ey2, 3, 3);
}

function drawFood() {
  tick++;
  const alpha = 0.5 + 0.5 * Math.sin(tick * 0.1);
  ctx.fillStyle = `rgba(255, 50, 50, ${alpha})`;
  ctx.fillRect(food.x * GRID, food.y * GRID, GRID - 1, GRID - 1);
}

function drawUI() {
  ctx.fillStyle = '#fff';
  ctx.font = '16px monospace';
  ctx.fillText('分数: ' + score, 10, 20);
  ctx.fillStyle = '#888';
  ctx.font = '12px monospace';
  ctx.fillText('最高分: ' + highScore, canvas.width - 100, 20);
}

function drawGameOver() {
  ctx.fillStyle = 'rgba(0,0,0,0.7)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.font = '32px monospace';
  ctx.fillText('Game Over', canvas.width / 2, canvas.height / 2 - 30);
  ctx.font = '20px monospace';
  ctx.fillText('分数: ' + score, canvas.width / 2, canvas.height / 2 + 10);
  if (score >= highScore && score > 0) {
    ctx.fillStyle = '#ff0';
    ctx.font = '16px monospace';
    ctx.fillText('新最高分!', canvas.width / 2, canvas.height / 2 + 35);
  }
  ctx.fillStyle = '#aaa';
  ctx.font = '14px monospace';
  ctx.fillText('按空格键重新开始', canvas.width / 2, canvas.height / 2 + 60);
  ctx.textAlign = 'left';
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();
  drawFood();
  drawSnake();
  drawUI();
  if (gameOver) drawGameOver();
}

setInterval(update, 150);

function loop() {
  draw();
  requestAnimationFrame(loop);
}

init();
loop();
