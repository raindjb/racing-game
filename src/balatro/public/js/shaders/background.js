// shaders/background.js — 漩涡颜料背景（原创 GLSL 实现，技术要点：极坐标旋转 + 迭代三角函数颜料 + 三色混合 + 像素化）
// WebGL 不可用时降级为 CSS 渐变动画（body.bg-fallback，见 effects.css）。

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
uniform float uTime;
uniform float uBoss;           // 0=普通 1=Boss（渐变过渡）
uniform vec2 uRes;

const vec4 C1 = vec4(0.208, 0.400, 0.286, 1.0);  // 深绿毛毡
const vec4 C2 = vec4(0.086, 0.174, 0.118, 1.0);  // 暗绿
const vec4 C3 = vec4(0.043, 0.090, 0.062, 1.0);  // 近黑
// Boss 调色：暗红褐 + 深紫
const vec4 B1 = vec4(0.35, 0.13, 0.10, 1.0);    // 暗红
const vec4 B2 = vec4(0.14, 0.06, 0.06, 1.0);    // 深紫褐
const vec4 B3 = vec4(0.05, 0.02, 0.025, 1.0);   // 近黑紫
const float PIXELS = 720.0;
const float SPIN = 1.6;
const float SPEED = 0.35;

void main() {
  vec2 px = floor(gl_FragCoord.xy / uRes.y * PIXELS) / PIXELS;
  vec2 uv = px - vec2(0.5 * uRes.x / uRes.y, 0.5);

  float t = uTime * SPEED;
  float len = length(uv);

  // Boss 态：漩涡加速 1.6x + 脉动中心亮度
  float spinMult = mix(1.0, 1.6, uBoss);
  float pulse = 1.0 + uBoss * 0.35 * sin(uTime * 2.8 + len * 4.0);

  float angle = atan(uv.y, uv.x) + SPIN * spinMult * 2.2 / (0.35 + len) - t * 0.6;
  vec2 sp = vec2(cos(angle), sin(angle)) * len * 2.6 * pulse;

  vec2 q = sp;
  float acc = 0.0;
  for (int i = 1; i <= 5; i++) {
    float fi = float(i);
    q += vec2(
      sin(q.y * fi * 0.9 + t + fi * 1.7),
      cos(q.x * fi * 0.8 - t * 1.1 + fi * 0.9)
    ) * (0.55 / fi);
    acc += 0.6 / fi * (sin(q.x + t * 0.7) + cos(q.y - t * 0.5));
  }

  float v = smoothstep(-1.6, 1.6, acc);
  vec4 col = mix(C3, C2, smoothstep(0.0, 0.55, v));
  col = mix(col, C1, smoothstep(0.55, 1.0, v));
  // 混合 Boss 调色
  vec4 bCol = mix(B3, B2, smoothstep(0.0, 0.55, v));
  bCol = mix(bCol, B1, smoothstep(0.55, 1.0, v));
  col = mix(col, bCol, uBoss);
  // 亮度 + 边缘压暗（Boss 态边缘更暗更压迫）
  col.rgb *= 1.06 - len * mix(0.55, 0.85, uBoss);
  // Boss 暗角红晕
  if (uBoss > 0.01) {
    col.rgb += uBoss * 0.08 * (1.0 - len) * (0.7 + 0.3 * sin(uTime * 2.2));
  }
  gl_FragColor = col;
}
`;

let gl = null, canvas = null, uTime = null, uBoss = null, uRes = null;
let raf = 0, start = 0, last = 0, bossVal = 0, bossTarget = 0;
const FPS_CAP = 30;

export function initBackground() {
  canvas = document.getElementById('bg-canvas');
  if (!canvas) return false;
  gl = canvas.getContext('webgl', { antialias: false, depth: false });
  if (!gl) {
    document.body.classList.add('bg-fallback');   // CSS 降级
    return false;
  }

  const compile = (type, src) => {
    const s = gl.createShader(type);
    gl.shaderSource(s, src); gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
      console.warn('[balatro] shader 编译失败:', gl.getShaderInfoLog(s));
      return null;
    }
    return s;
  };
  const vs = compile(gl.VERTEX_SHADER, VERT);
  const fs = compile(gl.FRAGMENT_SHADER, FRAG);
  if (!vs || !fs) { document.body.classList.add('bg-fallback'); return false; }

  const prog = gl.createProgram();
  gl.attachShader(prog, vs); gl.attachShader(prog, fs);
  gl.linkProgram(prog); gl.useProgram(prog);

  // 全屏两个三角形
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  uTime = gl.getUniformLocation(prog, 'uTime');
  uBoss = gl.getUniformLocation(prog, 'uBoss');
  uRes = gl.getUniformLocation(prog, 'uRes');

  const resize = () => {
    // 半分辨率渲染（像素化风格 + 性能）
    canvas.width = Math.ceil(innerWidth / 2);
    canvas.height = Math.ceil(innerHeight / 2);
    gl.viewport(0, 0, canvas.width, canvas.height);
  };
  window.addEventListener('resize', resize);
  resize();

  start = performance.now();
  const frame = now => {
    raf = requestAnimationFrame(frame);
    if (now - last < 1000 / FPS_CAP) return;
    last = now;
    // Boss 渐变过渡（lerp）
    bossVal += (bossTarget - bossVal) * 0.08;
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.uniform1f(uBoss, bossVal);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  raf = requestAnimationFrame(frame);
  return true;
}

export function stopBackground() { cancelAnimationFrame(raf); }

/** Boss 背景切换：触发暗红漩涡 + 脉动 */
export function setBossBackground(on) {
  bossTarget = on ? 1.0 : 0.0;
}
