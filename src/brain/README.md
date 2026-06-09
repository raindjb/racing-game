# 贪吃蛇小游戏

HTML5 Canvas 贪吃蛇，纯前端，浏览器本地运行。

## 运行

```bash
npm install
npm start
```

浏览器打开 http://localhost:3456

## 操作

- **方向键** — 控制蛇移动方向
- **空格键** — 游戏结束后重新开始

## 特性

- 20×20 网格，400×400 画布
- 蛇身渐变色，蛇头带眼睛
- 食物闪烁效果
- 网格线背景
- 穿墙模式（从对面穿出）
- 最高分记录（localStorage 持久化）
- Game Over 时显示是否刷新最高分

## 技术栈

- HTML5 Canvas
- 原生 JavaScript（ES Module）
- Express 静态文件服务
