// shaders/background.js — 漩涡颜料背景（原创 GLSL 实现，技术要点：极坐标旋转 + 迭代三角函数颜料 + 三色混合 + 像素化）
// WebGL 不可用时降级为 CSS 渐变动画（body.bg-fallback，见 effects.css）。

const VERT = `
attribute vec2 aPos;
void main() { gl_Position = vec4(aPos, 0.0, 1.0); }
`;

const FRAG = `
precision mediump float;
uniform float uTime;
uniform vec2 uRes;

const vec4 C1 = vec4(0.208, 0.400, 0.286, 1.0);  // 深绿毛毡
const vec4 C2 = vec4(0.086, 0.174, 0.118, 1.0);  // 暗绿
const vec4 C3 = vec4(0.043, 0.090, 0.062, 1.0);  // 近黑
const float PIXELS = 720.0;      // 像素化粒度
const float SPIN = 1.6;          // 漩涡强度
const float SPEED = 0.35;

void main() {
  // 像素化 UV（复古块面感）
  vec2 px = floor(gl_FragCoord.xy / uRes.y * PIXELS) / PIXELS;
  vec2 uv = px - vec2(0.5 * uRes.x / uRes.y, 0.5);

  float t = uTime * SPEED;
  float len = length(uv);

  // 极坐标漩涡：靠近中心旋转更多
  float angle = atan(uv.y, uv.x) + SPIN * 2.2 / (0.35 + len) - t * 0.6;
  vec2 sp = vec2(cos(angle), sin(angle)) * len * 2.6;

  // 迭代颜料混合（5 轮 sin/cos 折叠）
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
  // 中心轻微提亮 + 边缘压暗
  col.rgb *= 1.06 - len * 0.55;
  gl_FragColor = col;
}
`;

let gl = null, canvas = null, uTime = null, uRes = null;
let raf = 0, start = 0, last = 0;
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
    gl.uniform1f(uTime, (now - start) / 1000);
    gl.uniform2f(uRes, canvas.width, canvas.height);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };
  raf = requestAnimationFrame(frame);
  return true;
}

export function stopBackground() { cancelAnimationFrame(raf); }
