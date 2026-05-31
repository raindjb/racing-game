# Subway Runner — HTML/Cavas → Godot 4.5.1 迁移计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将 `subway-runner.html`（1395 行单文件 Canvas 游戏）迁移到 Godot 4.5.1，拆分为独立场景/脚本，每个系统修改互不干扰。

**Architecture:** 使用 Godot 2D 场景树 + 自研深度透视工具类。CharacterBody2D 驱动玩家，Area2D 处理道具和碰撞，CanvasLayer 分离 UI。GDScript 写玩法/UI，C# 写纯逻辑计算和对象池。所有可调值 `@export` 暴露到编辑器。

**Tech Stack:** Godot 4.5.1, GDScript (玩法/UI), C# (纯逻辑/对象池), GUT (测试), Godot Physics

---

## 架构映射：HTML → Godot

| HTML 系统 | Godot 对应 | 文件 |
|-----------|-----------|------|
| `VP` 透视对象 | `Perspective` autoload (.gd) | `scripts/autoload/perspective.gd` |
| `GS/P` 游戏状态 | `GameManager` autoload (.gd) | `scripts/autoload/game_manager.gd` |
| 音效函数 `T()/sCoin()...` | `AudioManager` autoload (.gd) | `scripts/autoload/audio_manager.gd` |
| 玩家 `P` + `drawPlayer()` | `Player` scene (CharacterBody2D) | `scenes/player/player.tscn` |
| 障碍物 `OB_DEF` + `spawnOb()` | `Obstacle` scene + `ObstacleSpawner` (.cs) | `scenes/obstacles/`, `scripts/obstacles/` |
| 道具 `PU_DEF` + `spawnPu()` | `Pickup` scene + `PickupSpawner` (.cs) | `scenes/pickups/`, `scripts/pickups/` |
| 火车 `spawnTrain()` | `Train` scene + `TrainSpawner` (.cs) | `scenes/trains/`, `scripts/trains/` |
| `drawHUD()/drawMenu()/drawDeath()` | CanvasLayer scenes | `scenes/ui/` |
| 粒子/浮动文字/速度线 | GPUParticles2D + 自定义特效 | `scenes/effects/` |
| `update()` 主循环 | `Main._process()` + `Main._physics_process()` | `scenes/main.tscn` |

## 深度透视系统设计

HTML 版本的 `VP` 对象将迁移为 `Perspective` autoload，保持相同的数学公式：

```
深度 z:  0.0 (最远, 地平线) ← 物体生成 → 玩家 z=0.62 → 1.0+ (越过玩家)
屏幕 Y: screenY(z) = horizon_y + z^0.7 * (bottom_y - horizon_y)
缩放:   scale(sy)  = clamp((sy - horizon_y) / (player_sy - horizon_y), 0.08, 2.5)
轨道 X: laneX(lane, sy) = viewport_center + lane * spread * 3.2
```

## 场景树结构

```
Main (Node2D)
├── World (Node2D) — y_sort_enabled = true
│   ├── Sky (ColorRect)
│   ├── CityBackground (Node2D)
│   ├── Ground (Node2D) — tracks, ties, lamps, markers
│   ├── Player (CharacterBody2D)
│   ├── SpawnedEntities (Node2D) — obstacles, pickups, trains added here
├── Effects (Node2D) — particles, screen shake
├── HUD (CanvasLayer)
├── MenuScreen (CanvasLayer)
└── DeathScreen (CanvasLayer)
```

---

### Task 1: 项目骨架 + Autoload 单例

**Files:**
- Create: `godot-subway-runner/project.godot`
- Create: `godot-subway-runner/scripts/autoload/game_manager.gd`
- Create: `godot-subway-runner/scripts/autoload/perspective.gd`
- Create: `godot-subway-runner/scripts/autoload/audio_manager.gd`

- [ ] **Step 1: 创建 project.godot**

```ini
; Engine configuration file.
; It's best edited using the editor UI and not directly,
; but the values here are provided for reference.

config_version=5

[application]
config/name="Subway Runner"
config/version="1.0.0"
config/features=PackedStringArray("4.5", "Forward+")

[autoload]
GameManager="*res://scripts/autoload/game_manager.gd"
Perspective="*res://scripts/autoload/perspective.gd"
AudioManager="*res://scripts/autoload/audio_manager.gd"

[display]
window/size/viewport_width=360
window/size/viewport_height=640
window/size/resizable=true
window/stretch/mode="canvas_items"
window/stretch/aspect="expand"

[input]
move_left={ "key": "A", "key": "Left" }
move_right={ "key": "D", "key": "Right" }
jump={ "key": "W", "key": "Up" }
slide={ "key": "S", "key": "Down" }
start={ "key": "Space" }

[rendering]
renderer/rendering_method="mobile"
textures/canvas_textures/default_texture_filter=0
```

- [ ] **Step 2: 创建 GameManager autoload**

```gdscript
# scripts/autoload/game_manager.gd
extends Node

enum State { MENU, PLAY, DEAD }

var state: State = State.MENU
var score: float = 0.0
var high_score: int = 0
var distance: float = 0.0
var total_distance: float = 0.0
var base_speed: float = 200.0
var current_speed: float = 200.0
var combo: int = 0
var combo_timer: float = 0.0

const SAVE_KEY := "subway_high_score"

func _ready() -> void:
	load_high_score()

func reset() -> void:
	score = 0.0
	distance = 0.0
	total_distance = 0.0
	base_speed = 200.0
	current_speed = 200.0
	combo = 0
	combo_timer = 0.0

func add_score(amount: float) -> void:
	score += amount
	if score > high_score:
		high_score = int(score)

func load_high_score() -> void:
	var file := FileAccess.open("user://save.dat", FileAccess.READ)
	if file:
		high_score = file.get_32()
		file.close()

func save_high_score() -> void:
	var file := FileAccess.open("user://save.dat", FileAccess.WRITE)
	if file:
		file.store_32(high_score)
		file.close()

func start_game() -> void:
	reset()
	state = State.PLAY

func end_game() -> void:
	state = State.DEAD
	save_high_score()

signal game_started
signal game_ended
signal score_changed(new_score: float)
```

- [ ] **Step 3: 创建 Perspective autoload**

```gdscript
# scripts/autoload/perspective.gd
extends Node

var viewport_size: Vector2
var horizon_y: float
var bottom_y: float

func _ready() -> void:
	get_viewport().size_changed.connect(_on_resize)
	_on_resize()

func _on_resize() -> void:
	viewport_size = get_viewport().get_visible_rect().size
	horizon_y = viewport_size.y * 0.2
	bottom_y = viewport_size.y * 0.94

func screen_y(depth: float) -> float:
	return horizon_y + pow(depth, 0.7) * (bottom_y - horizon_y)

func scale_at_sy(sy: float) -> float:
	var player_sy := screen_y(0.62)
	if sy <= horizon_y:
		return 0.08
	var t := (sy - horizon_y) / (player_sy - horizon_y)
	return clamp(t, 0.08, 2.5)

func lane_x(lane: float, sy: float) -> float:
	var sc := scale_at_sy(sy)
	var spread := viewport_size.x * 0.09 * sc
	return viewport_size.x * 0.5 + lane * spread * 3.2

func depth_to_position(lane: float, depth: float) -> Dictionary:
	var sy := screen_y(depth)
	return {
		"x": lane_x(lane, sy),
		"y": sy,
		"scale": scale_at_sy(sy)
	}

func player_position() -> Dictionary:
	return depth_to_position(0.0, 0.62)
```

- [ ] **Step 4: 创建 AudioManager autoload**

```gdscript
# scripts/autoload/audio_manager.gd
extends Node

var audio_players: Array[AudioStreamPlayer] = []
const POOL_SIZE := 8

func _ready() -> void:
	for i in POOL_SIZE:
		var player := AudioStreamPlayer.new()
		add_child(player)
		audio_players.append(player)
	process_mode = Node.PROCESS_MODE_ALWAYS

func _play_synth(freq: float, waveform: int, duration: float, volume: float = 0.08, glide: float = 0.0) -> void:
	var player := _get_free_player()
	if not player:
		return
	var generator := AudioStreamGenerator.new()
	generator.mix_rate = 44100
	generator.buffer_length = duration + 0.02
	player.stream = generator
	player.volume_db = linear_to_db(volume)
	player.play()
	# Audio generation happens in _process on the AudioStreamGeneratorPlayback
	# For simplicity, we'll use generated .tres audio files later

func _get_free_player() -> AudioStreamPlayer:
	for p in audio_players:
		if not p.playing:
			return p
	return null

func play_coin() -> void:
	_play_synth(880, 0, 0.07, 0.07)
	await get_tree().create_timer(0.05).timeout
	_play_synth(1320, 0, 0.05, 0.06)

func play_hit() -> void:
	_play_synth(70, 2, 0.3, 0.15)
	_play_synth(40, 1, 0.35, 0.12)

func play_jump() -> void:
	_play_synth(260, 3, 0.12, 0.05, 400)

func play_slide() -> void:
	_play_synth(180, 1, 0.08, 0.03, -80)

func play_die() -> void:
	_play_synth(180, 2, 0.4, 0.12)
	await get_tree().create_timer(0.12).timeout
	_play_synth(120, 2, 0.4, 0.12)
	await get_tree().create_timer(0.14).timeout
	_play_synth(80, 2, 0.6, 0.2)

func play_heal() -> void:
	_play_synth(523, 3, 0.12, 0.06)
	await get_tree().create_timer(0.08).timeout
	_play_synth(659, 3, 0.12, 0.06)
	await get_tree().create_timer(0.08).timeout
	_play_synth(784, 3, 0.15, 0.08)

func play_power_up() -> void:
	_play_synth(600, 3, 0.1, 0.06)
	await get_tree().create_timer(0.08).timeout
	_play_synth(800, 3, 0.1, 0.06)
	await get_tree().create_timer(0.08).timeout
	_play_synth(1000, 3, 0.12, 0.08)

func play_horn() -> void:
	_play_synth(140, 2, 0.5, 0.08)
	_play_synth(110, 2, 0.4, 0.08)
```

- [ ] **Step 5: 用 Godot 编辑器打开项目验证**

在桌面上双击 `godot4.exe`，点击 Import → 选择 `C:\Users\13751\godot-subway-runner\project.godot`，确认编辑器正常加载。

---

### Task 2: 玩家系统

**Files:**
- Create: `godot-subway-runner/scenes/player/player.tscn`
- Create: `godot-subway-runner/scripts/player/player.gd`

- [ ] **Step 1: 创建 Player 场景**

在 Godot 编辑器中：
1. 新建 Scene → Root 选 `CharacterBody2D`，命名为 `Player`
2. 添加 `CollisionShape2D` 子节点 → shape 选 `RectangleShape2D`, size=(24, 48)
3. 添加 `Sprite2D` 子节点 → 先用白色方块占位（后续替换为角色精灵）
4. 添加 `Area2D` 子节点（碰撞检测用）→ `CollisionShape2D` shape=(28, 52)
5. 保存为 `scenes/player/player.tscn`

- [ ] **Step 2: 编写 Player 脚本**

```gdscript
# scripts/player/player.gd
extends CharacterBody2D

enum Action { RUN, JUMP, SLIDE }

@export var lane_change_speed: float = 11.0
@export var jump_velocity: float = -380.0
@export var gravity: float = 980.0
@export var slide_duration: float = 0.5
@export var max_hp: int = 3
@export var invincible_duration: float = 1.5

var target_lane: int = 0
var current_lane: float = 0.0
var action: Action = Action.RUN
var jump_height: float = 0.0
var slide_timer: float = 0.0
var hp: int = max_hp
var invincible_timer: float = 0.0
var on_train: Node2D = null

# Power-up states
var magnet_active: bool = false
var magnet_timer: float = 0.0
var double_coin_active: bool = false
var double_coin_timer: float = 0.0
var skate_active: bool = false
var skate_timer: float = 0.0
var combo_count: int = 0
var combo_timer: float = 0.0

signal health_changed(new_hp: int)
signal died
signal power_up_changed

func _ready() -> void:
	reset()

func reset() -> void:
	target_lane = 0
	current_lane = 0.0
	action = Action.RUN
	jump_height = 0.0
	slide_timer = 0.0
	hp = max_hp
	invincible_timer = 0.0
	on_train = null
	magnet_active = false
	magnet_timer = 0.0
	double_coin_active = false
	double_coin_timer = 0.0
	skate_active = false
	skate_timer = 0.0
	combo_count = 0
	combo_timer = 0.0
	health_changed.emit(hp)

func _physics_process(delta: float) -> void:
	if GameManager.state != GameManager.State.PLAY:
		return
	
	_update_power_up_timers(delta)
	_update_invincibility(delta)
	_update_lane_position(delta)
	_update_jump(delta)
	_update_slide(delta)
	_update_position()
	_check_combo(delta)

func _update_power_up_timers(delta: float) -> void:
	if magnet_timer > 0:
		magnet_timer -= delta
		if magnet_timer <= 0:
			magnet_active = false
			power_up_changed.emit()
	if double_coin_timer > 0:
		double_coin_timer -= delta
		if double_coin_timer <= 0:
			double_coin_active = false
			power_up_changed.emit()
	if skate_timer > 0:
		skate_timer -= delta
		if skate_timer <= 0:
			skate_active = false
			power_up_changed.emit()

func _update_invincibility(delta: float) -> void:
	if invincible_timer > 0:
		invincible_timer -= delta

func _update_lane_position(delta: float) -> void:
	current_lane = move_toward(current_lane, float(target_lane), lane_change_speed * delta)

func _update_jump(delta: float) -> void:
	if action == Action.JUMP:
		jump_height += velocity.y * delta
		velocity.y += gravity * delta
		if jump_height >= 0:
			jump_height = 0.0
			velocity.y = 0.0
			action = Action.RUN

func _update_slide(delta: float) -> void:
	if action == Action.SLIDE:
		slide_timer -= delta
		if slide_timer <= 0:
			action = Action.RUN

func _update_position() -> void:
	var pos := Perspective.player_position()
	position.x = pos.x
	position.y = pos.y + jump_height * 0.3  # Jump offset

func _check_combo(delta: float) -> void:
	if combo_timer > 0:
		combo_timer -= delta
		if combo_timer <= 0:
			combo_count = 0

func move_left() -> void:
	if on_train:
		return
	target_lane = max(-1, target_lane - 1)

func move_right() -> void:
	if on_train:
		return
	target_lane = min(1, target_lane + 1)

func do_jump() -> void:
	if action != Action.RUN or on_train:
		return
	action = Action.JUMP
	velocity.y = jump_velocity
	jump_height = -0.1
	AudioManager.play_jump()

func do_slide() -> void:
	if action != Action.RUN or on_train:
		return
	action = Action.SLIDE
	slide_timer = slide_duration
	AudioManager.play_slide()

func can_dodge_obstacle(required_action: int, obstacle_lane: int) -> bool:
	var lane_diff := abs(current_lane - float(obstacle_lane))
	match required_action:
		0:  # Slide required
			return action == Action.SLIDE
		1:  # Jump required
			return action == Action.JUMP and jump_height < -0.3
		2:  # Lane change required
			return lane_diff > 0.3
	return false

func take_damage(amount: int) -> void:
	if invincible_timer > 0 or on_train:
		return
	if skate_active:
		skate_active = false
		skate_timer = 0.0
		power_up_changed.emit()
		return
	hp -= amount
	invincible_timer = invincible_duration
	health_changed.emit(hp)
	AudioManager.play_hit()
	if hp <= 0:
		died.emit()

func heal(amount: int) -> void:
	hp = min(hp + amount, max_hp)
	health_changed.emit(hp)
	AudioManager.play_heal()

func activate_magnet(duration: float) -> void:
	magnet_active = true
	magnet_timer = duration
	power_up_changed.emit()

func activate_double_coin(duration: float) -> void:
	double_coin_active = true
	double_coin_timer = duration
	power_up_changed.emit()

func activate_skate(duration: float) -> void:
	skate_active = true
	skate_timer = duration
	power_up_changed.emit()

func add_combo() -> void:
	combo_count += 1
	combo_timer = 1.0

func _input(event: InputEvent) -> void:
	if GameManager.state == GameManager.State.MENU:
		if event.is_action_pressed("jump") or event.is_action_pressed("slide") or event.is_action_pressed("start"):
			GameManager.start_game()
			return
	if GameManager.state == GameManager.State.DEAD:
		if event.is_action_pressed("jump") or event.is_action_pressed("start"):
			get_tree().reload_current_scene()
			return
	if GameManager.state != GameManager.State.PLAY:
		return
	
	if event.is_action_pressed("move_left"):
		move_left()
	elif event.is_action_pressed("move_right"):
		move_right()
	elif event.is_action_pressed("jump"):
		do_jump()
	elif event.is_action_pressed("slide"):
		do_slide()
```

---

### Task 3: 主场景 + 地面渲染

**Files:**
- Create: `godot-subway-runner/scenes/main.tscn`
- Create: `godot-subway-runner/scripts/main.gd`
- Create: `godot-subway-runner/scripts/ground_renderer.gd`

- [ ] **Step 1: 创建 Main 场景和主循环脚本**

```gdscript
# scripts/main.gd
extends Node2D

@onready var player: CharacterBody2D = $World/Player
@onready var ground: Node2D = $World/Ground

var slope: float = 0.0
var target_slope: float = 0.0
var slope_timer: float = 0.0
var frame_count: int = 0
var shake_intensity: float = 0.0
var shake_timer: float = 0.0
var slow_mo: float = 0.0

func _ready() -> void:
	GameManager.game_started.connect(_on_game_started)
	GameManager.game_ended.connect(_on_game_ended)
	player.died.connect(_on_player_died)

func _process(delta: float) -> void:
	if GameManager.state != GameManager.State.PLAY:
		return
	
	if slow_mo > 0:
		delta *= 0.25
		slow_mo -= delta
	
	delta = min(delta, 0.1)
	frame_count += 1
	
	_update_slope(delta)
	_update_speed(delta)
	_update_distance(delta)
	_update_shake(delta)
	
	queue_redraw()

func _update_slope(delta: float) -> void:
	slope_timer -= delta
	if slope_timer <= 0:
		target_slope = randf_range(-0.5, 0.5)
		slope_timer = randf_range(3.0, 7.0)
	slope = move_toward(slope, target_slope, delta * 0.45)

func _update_speed(delta: float) -> void:
	var speed_ramp := 1.0 + min(GameManager.total_distance / 12000.0, 1.0) * 0.35
	GameManager.base_speed = 200.0 * speed_ramp
	GameManager.current_speed = GameManager.base_speed * (1.0 - slope * 0.22)
	GameManager.current_speed = clamp(GameManager.current_speed, 160.0, 480.0)

func _update_distance(delta: float) -> void:
	var dd := GameManager.current_speed * delta
	GameManager.total_distance += dd
	GameManager.distance += dd
	GameManager.score += dd * 0.5
	GameManager.score_changed.emit(GameManager.score)

func _update_shake(delta: float) -> void:
	if shake_timer > 0:
		shake_timer -= delta
	else:
		shake_intensity = 0.0

func add_shake(intensity: float, duration: float) -> void:
	shake_intensity = intensity
	shake_timer = duration

func slow_motion(duration: float) -> void:
	slow_mo = duration

func _on_game_started() -> void:
	pass  # Spawners will react

func _on_game_ended() -> void:
	add_shake(8.0, 0.4)
	slow_motion(0.5)

func _on_player_died() -> void:
	GameManager.end_game()
```

- [ ] **Step 2: 创建地面渲染器**

```gdscript
# scripts/ground_renderer.gd
extends Node2D

func _draw() -> void:
	if GameManager.state == GameManager.State.MENU:
		_draw_ground()
		return
	
	var slope_offset: float = get_parent().get_node("../Main").slope * get_viewport().get_visible_rect().size.y * 0.1
	
	_draw_gravel(slope_offset)
	_draw_tracks(slope_offset)
	_draw_ties(slope_offset)
	_draw_lamps(slope_offset)
	_draw_distance_markers(slope_offset)

func _draw_gravel(slope_offset: float) -> void:
	var top_y := Perspective.screen_y(1.0) + slope_offset
	var bot_y := Perspective.screen_y(0.0)
	var grad_colors := [Color("#7a7a6a"), Color("#8a8a7a"), Color("#9a9a8a"), Color("#6a6a5a")]
	# Simplified: draw rect with gradient approximation
	draw_rect(Rect2(0, top_y, get_viewport().get_visible_rect().size.x, bot_y - top_y), grad_colors[1])

func _draw_tracks(slope_offset: float) -> void:
	var lanes := [-1, 0, 1]
	for lane in lanes:
		for rail in range(2):
			var offset := (float(rail) - 0.5) * get_viewport().get_visible_rect().size.x * 0.018
			var points: PackedVector2Array = []
			for z in range(1, 100):
				var depth := float(z) / 100.0
				if depth < 0.02 or depth > 0.98:
					continue
				var sy := Perspective.screen_y(depth) + slope_offset
				var sc := Perspective.scale_at_sy(sy)
				var lx := Perspective.lane_x(float(lane), sy) + offset * sc
				points.append(Vector2(lx, sy))
			if points.size() > 1:
				draw_polyline(points, Color("#8899aa"), 1.2)

func _draw_ties(slope_offset: float) -> void:
	var bot_y := Perspective.screen_y(0.0)
	var top_y := Perspective.screen_y(1.0)
	for z in range(1, 83):
		var depth := float(z) * 0.012
		if depth >= 0.98:
			continue
		var sy := Perspective.screen_y(depth) + slope_offset
		if sy > bot_y or sy < top_y:
			continue
		var sc := Perspective.scale_at_sy(sy)
		var tie_w := get_viewport().get_visible_rect().size.x * 0.09 * sc
		var tie_h := get_viewport().get_visible_rect().size.y * 0.004 * sc
		var alpha := clamp((depth - 0.02) / 0.15, 0.0, 1.0)
		draw_rect(Rect2(get_viewport().get_visible_rect().size.x / 2.0 - tie_w / 2, sy - tie_h / 2, tie_w, tie_h), Color(0.314, 0.216, 0.118, 0.7 * alpha))

func _draw_lamps(slope_offset: float) -> void:
	for z in range(1, 8):
		var depth := float(z) * 0.15
		if depth >= 0.9:
			continue
		var sy := Perspective.screen_y(depth) + slope_offset
		if sy > Perspective.screen_y(0.0) - 10 or sy < Perspective.screen_y(1.0) + 10:
			continue
		var sc := Perspective.scale_at_sy(sy)
		var pole_x := get_viewport().get_visible_rect().size.x / 2.0 + get_viewport().get_visible_rect().size.x * 0.21 * sc
		draw_rect(Rect2(pole_x - get_viewport().get_visible_rect().size.x * 0.004 * sc, sy - get_viewport().get_visible_rect().size.y * 0.06 * sc, get_viewport().get_visible_rect().size.x * 0.008 * sc, get_viewport().get_visible_rect().size.y * 0.06 * sc), Color("#555555"))
		draw_circle(Vector2(pole_x, sy - get_viewport().get_visible_rect().size.y * 0.06 * sc), get_viewport().get_visible_rect().size.x * 0.005 * sc, Color("#ffeaa7"))

func _draw_distance_markers(slope_offset: float) -> void:
	var mark_spacing := 0.08
	var track_off := GameManager.total_distance * 0.01
	var offset := fmod(track_off, mark_spacing)
	var bot_y := Perspective.screen_y(0.0)
	var top_y := Perspective.screen_y(1.0)
	var mz := offset
	while mz < 0.95:
		var msy := Perspective.screen_y(mz) + slope_offset
		if msy <= bot_y - 3 and msy >= top_y + 3:
			var msc := Perspective.scale_at_sy(msy)
			var vx := get_viewport().get_visible_rect().size.x / 2.0
			var mlx := vx - get_viewport().get_visible_rect().size.x * 0.14 * msc
			draw_rect(Rect2(mlx - get_viewport().get_visible_rect().size.x * 0.003 * msc, msy - get_viewport().get_visible_rect().size.y * 0.04 * msc, get_viewport().get_visible_rect().size.x * 0.006 * msc, get_viewport().get_visible_rect().size.y * 0.04 * msc), Color.WHITE)
		mz += mark_spacing
```

---

### Task 4: 障碍物系统

**Files:**
- Create: `godot-subway-runner/scenes/obstacles/obstacle_base.tscn`
- Create: `godot-subway-runner/scripts/obstacles/obstacle_base.gd`
- Create: `godot-subway-runner/scripts/obstacles/obstacle_data.gd`
- Create: `godot-subway-runner/scripts/obstacles/obstacle_spawner.gd`

- [ ] **Step 1: 障碍物数据定义**

```gdscript
# scripts/obstacles/obstacle_data.gd
class_name ObstacleData
extends Resource

enum ActionType { SLIDE = 0, JUMP = 1, LANE_CHANGE = 2 }

@export var type_name: String
@export var action: ActionType
@export var color: Color
@export var height_ratio: float
@export var visual_type: String

static func all_types() -> Array[Dictionary]:
	return [
		# Slide obstacles
		{name="barrier", action=0, color="#e74c3c", h=0.15, visual="barrier"},
		{name="pipe", action=0, color="#95a5a6", h=0.12, visual="pipe"},
		{name="low_fence", action=0, color="#f39c12", h=0.18, visual="low_fence"},
		{name="wire", action=0, color="#e67e22", h=0.10, visual="wire"},
		# Jump obstacles
		{name="signal", action=1, color="#2c3e50", h=0.45, visual="signal"},
		{name="ties", action=1, color="#8B4513", h=0.40, visual="ties"},
		{name="barrel", action=1, color="#e74c3c", h=0.42, visual="barrel"},
		{name="cone_wall", action=1, color="#ff6600", h=0.38, visual="cone_wall"},
		# Lane-change obstacles
		{name="cart", action=2, color="#f1c40f", h=0.70, visual="cart"},
		{name="tower", action=2, color="#7f8c8d", h=0.85, visual="tower"},
		{name="worker", action=2, color="#ff6600", h=0.75, visual="worker"},
	]
```

- [ ] **Step 2: 障碍物基类脚本**

```gdscript
# scripts/obstacles/obstacle_base.gd
extends Area2D

@export var obstacle_type: String = "barrier"
@export var required_action: int = 0  # 0=slide, 1=jump, 2=lane_change
@export var lane: int = 0
@export var color: Color = Color.RED
@export var height_ratio: float = 0.15

var depth: float = 0.02
var passed: bool = false
var wob_offset: float = randf() * PI * 2

signal obstacle_passed

func _ready() -> void:
	body_entered.connect(_on_body_entered)
	var data := _get_type_data()
	if data:
		color = Color(data.color)
		height_ratio = data.h
	_draw_visual()

func _get_type_data() -> Dictionary:
	for d in ObstacleData.all_types():
		if d.name == obstacle_type:
			return d
	return {}

func _process(delta: float) -> void:
	if GameManager.state != GameManager.State.PLAY:
		return
	
	depth += GameManager.current_speed * delta / (get_viewport().get_visible_rect().size.y * 0.75)
	
	if depth > 1.08:
		if not passed:
			obstacle_passed.emit()
		queue_free()
		return
	
	_update_position()
	_check_proximity_hint()

func _update_position() -> void:
	var pos := Perspective.depth_to_position(float(lane), depth)
	position = Vector2(pos.x, pos.y)
	scale = Vector2(pos.scale, pos.scale)

func _check_proximity_hint() -> void:
	var player_depth: float = 0.62
	if depth > 0.52 and depth < 0.68 and not passed:
		show_action_hint()

func show_action_hint() -> void:
	# Visual hint showing required action (arrow indicators)
	# Implemented in subclasses or via child sprite
	pass

func _on_body_entered(body: CharacterBody2D) -> void:
	if not body is CharacterBody2D or passed:
		return
	if body.has_method("can_dodge_obstacle") and body.can_dodge_obstacle(required_action, lane):
		if depth > 0.62:
			passed = true
			body.add_combo()
		return
	if body.has_method("take_damage"):
		body.take_damage(1)
		passed = true

func _draw_visual() -> void:
	# Placeholder: draw colored rectangle
	var u: float = get_viewport().get_visible_rect().size.x * 0.025
	var w: float = u * 10
	var h: float = u * height_ratio * 20
	match obstacle_type:
		"barrier":
			# Red/white striped bar
			_draw_barrier(w, h)
		"pipe":
			_draw_pipe(w, h)
		"low_fence":
			_draw_low_fence(w, h)
		"wire":
			_draw_wire(w, h)
		"signal":
			_draw_signal(w, h)
		"ties":
			_draw_ties_stack(w, h)
		"barrel":
			_draw_barrel(w, h)
		"cone_wall":
			_draw_cone_wall(w, h)
		"cart":
			_draw_cart(w, h)
		"tower":
			_draw_tower(w, h)
		"worker":
			_draw_worker(w, h)
		_:
			draw_rect(Rect2(-w/2, -h/2, w, h), color)

func _draw_barrier(w: float, h: float) -> void:
	draw_rect(Rect2(-w/2, -h/2, w, h), Color.RED)
	for i in range(-4, 5, 2):
		draw_rect(Rect2(i * w/10, -h/2, w/5, h), Color.WHITE)

func _draw_pipe(w: float, h: float) -> void:
	draw_rect(Rect2(-w/2, -h/2, w, h * 0.6), Color("#95a5a6"))

func _draw_low_fence(w: float, h: float) -> void:
	draw_rect(Rect2(-w/2, -h/2, w, h), Color.ORANGE)
	for fx in range(-4, 5):
		draw_rect(Rect2(fx * w/10, -h, w/40, h), Color.ORANGE)

func _draw_wire(w: float, h: float) -> void:
	draw_arc(Vector2.ZERO, w/4, 0, PI, 16, Color("#e67e22"), w/20)
	draw_circle(Vector2(-w/2, 0), w/20, Color("#e67e22"))
	draw_circle(Vector2(w/2, 0), w/20, Color("#e67e22"))

func _draw_signal(w: float, h: float) -> void:
	draw_rect(Rect2(-w/4, -h/2, w/2, h), Color("#2c3e50"))
	draw_circle(Vector2.ZERO, w/8, Color.RED)
	draw_rect(Rect2(-w/30, 0, w/15, h/4), Color("#555555"))

func _draw_ties_stack(w: float, h: float) -> void:
	var brown := Color("#8B4513")
	for i in range(4):
		var y_offset := -h/2 + i * h/4
		var width := w * (1.0 - i * 0.15)
		draw_rect(Rect2(-width/2, y_offset, width, h/5), brown)

func _draw_barrel(w: float, h: float) -> void:
	draw_rect(Rect2(-w/5, -h/2, w/2.5, h), Color.RED)
	draw_rect(Rect2(-w/5, -h/2, w/2.5, h/5), Color("#c0392b"))
	draw_rect(Rect2(-w/5, h/2 - h/8, w/2.5, h/8), Color("#c0392b"))

func _draw_cone_wall(w: float, h: float) -> void:
	for cx in range(-4, 5, 2):
		var cx_pos := float(cx) * w / 10
		var points := PackedVector2Array([
			Vector2(cx_pos, -h/2),
			Vector2(cx_pos - w/8, h/2),
			Vector2(cx_pos + w/8, h/2)
		])
		draw_polygon(points, PackedColorArray([Color.ORANGE, Color.ORANGE, Color.ORANGE]))

func _draw_cart(w: float, h: float) -> void:
	draw_rect(Rect2(-w/2, -h/2, w, h), Color.YELLOW)
	draw_circle(Vector2(-w/4, h/2 * 0.3), w/10, Color.BLACK)
	draw_circle(Vector2(w/4, h/2 * 0.3), w/10, Color.BLACK)

func _draw_tower(w: float, h: float) -> void:
	draw_rect(Rect2(-w/3, -h/2, w/1.5, h), Color.GRAY)
	draw_circle(Vector2.ZERO, w/12, Color.RED)

func _draw_worker(w: float, h: float) -> void:
	# Simplified worker
	draw_rect(Rect2(-w/6, -h/2, w/3, h * 0.3), Color.ORANGE)
	draw_rect(Rect2(-w/8, -h/2 + h * 0.3, w/4, h * 0.4), Color("#1a1a2e"))
	draw_circle(Vector2.ZERO, w/10, Color("#f5c6a0"))
```

- [ ] **Step 3: 障碍物生成器**

```gdscript
# scripts/obstacles/obstacle_spawner.gd
extends Node2D

@export var obstacle_scene: PackedScene
@export var min_spawn_interval: float = 0.9
@export var max_spawn_interval: float = 2.8

var spawn_timer: float = 0.0
var pool: Array[Area2D] = []

func _ready() -> void:
	spawn_timer = randf_range(min_spawn_interval, max_spawn_interval)

func _process(delta: float) -> void:
	if GameManager.state != GameManager.State.PLAY:
		return
	
	spawn_timer -= delta
	if spawn_timer <= 0:
		spawn_obstacle()
		var dist_factor := min(GameManager.total_distance / 20000.0, 0.4)
		spawn_timer = randf_range(min_spawn_interval, max_spawn_interval) * (1.0 - dist_factor)
		spawn_timer = max(0.9, spawn_timer)

func spawn_obstacle() -> void:
	var types := ObstacleData.all_types()
	var r := randf()
	var cat: int
	if r < 0.35:
		cat = 0
	elif r < 0.65:
		cat = 1
	else:
		cat = 2
	
	var candidates: Array[Dictionary] = []
	for d in types:
		if d.action == cat:
			candidates.append(d)
	
	if candidates.is_empty():
		return
	
	var chosen := candidates[randi() % candidates.size()]
	var lane := randi_range(-1, 1)
	
	# Avoid stacking on same lane
	for ob in get_children():
		if ob is Area2D and ob.get("lane") == lane and ob.get("depth") > 0.6:
			return
	
	var obstacle: Area2D = obstacle_scene.instantiate()
	obstacle.obstacle_type = chosen.name
	obstacle.required_action = chosen.action
	obstacle.lane = lane
	obstacle.color = Color(chosen.color)
	obstacle.height_ratio = chosen.h
	obstacle.depth = 0.02
	add_child(obstacle)
```

---

### Task 5: 道具系统

**Files:**
- Create: `godot-subway-runner/scenes/pickups/pickup_base.tscn`
- Create: `godot-subway-runner/scripts/pickups/pickup_base.gd`
- Create: `godot-subway-runner/scripts/pickups/pickup_data.gd`
- Create: `godot-subway-runner/scripts/pickups/pickup_spawner.gd`

- [ ] **Step 1: 道具数据定义**

```gdscript
# scripts/pickups/pickup_data.gd
class_name PickupData
extends Resource

enum Effect { COIN, HEAL, MAGNET, DOUBLE_COIN, SKATE }

@export var type_name: String
@export var effect: Effect
@export var color: Color
@export var shape: String
@export var icon: String

static func all_types() -> Array[Dictionary]:
	return [
		{name="coin", effect=0, color="#f1c40f", shape="circle", icon="$"},
		{name="medkit", effect=1, color="#e74c3c", shape="cross", icon="+"},
		{name="magnet", effect=2, color="#3498db", shape="horseshoe", icon="U"},
		{name="double", effect=3, color="#f39c12", shape="star", icon="x2"},
		{name="skate", effect=4, color="#2ecc71", shape="board", icon="SK8"},
	]
```

- [ ] **Step 2: 道具基类脚本**

```gdscript
# scripts/pickups/pickup_base.gd
extends Area2D

@export var pickup_type: String = "coin"
@export var effect: int = 0  # 0=coin, 1=heal, 2=magnet, 3=double, 4=skate
@export var lane: int = 0
@export var color: Color = Color.GOLD

var depth: float = 0.02
var bob_offset: float = randf() * PI * 2
var rotation_speed: float = 2.5

func _ready() -> void:
	body_entered.connect(_on_body_entered)

func _process(delta: float) -> void:
	if GameManager.state != GameManager.State.PLAY:
		return
	
	depth += GameManager.current_speed * delta / (get_viewport().get_visible_rect().size.y * 0.75)
	
	# Magnet attraction
	var player := get_tree().get_first_node_in_group("player")
	if player and player.magnet_active and depth > 0.15 and depth < 0.5:
		lane = move_toward(float(lane), player.current_lane, delta * 2.5)
	
	if depth > 1.05:
		queue_free()
		return
	
	_update_position(delta)

func _update_position(delta: float) -> void:
	var pos := Perspective.depth_to_position(lane, depth)
	position = Vector2(pos.x, pos.y)
	scale = Vector2(pos.scale, pos.scale)
	bob_offset += delta * 2.5
	position.y += sin(Time.get_ticks_msec() * 0.007 + bob_offset) * pos.scale * 3.0

func _on_body_entered(body: CharacterBody2D) -> void:
	if not body is CharacterBody2D:
		return
	if depth < 0.52 or depth > 0.7:
		return
	if abs(body.current_lane - float(lane)) > 0.55:
		return
	_apply_effect(body)
	queue_free()

func _apply_effect(player: CharacterBody2D) -> void:
	AudioManager.play_coin()
	match effect:
		0:  # Coin
			var amount := 100 if player.double_coin_active else 50
			GameManager.add_score(amount)
		1:  # Heal
			player.heal(player.max_hp)
		2:  # Magnet
			player.activate_magnet(5.0)
			AudioManager.play_power_up()
		3:  # Double coin
			player.activate_double_coin(8.0)
			AudioManager.play_power_up()
		4:  # Skate
			player.activate_skate(30.0)
			AudioManager.play_power_up()
	GameManager.add_score(5)
```

- [ ] **Step 3: 道具生成器**

```gdscript
# scripts/pickups/pickup_spawner.gd
extends Node2D

@export var pickup_scene: PackedScene

var spawn_timer: float = 0.0

func _ready() -> void:
	spawn_timer = randf_range(2.0, 4.5)

func _process(delta: float) -> void:
	if GameManager.state != GameManager.State.PLAY:
		return
	
	spawn_timer -= delta
	if spawn_timer <= 0:
		spawn_pickup()
		spawn_timer = randf_range(2.0, 4.5)
		if randf() < 0.2:
			await get_tree().create_timer(0.15).timeout
			if GameManager.state == GameManager.State.PLAY:
				spawn_pickup()

func spawn_pickup() -> void:
	var types := ["coin", "coin", "coin", "coin", "medkit", "magnet", "double", "skate"]
	var chosen_type := types[randi() % types.size()]
	var data_list := PickupData.all_types()
	var data: Dictionary
	for d in data_list:
		if d.name == chosen_type:
			data = d
			break
	
	var pickup: Area2D = pickup_scene.instantiate()
	pickup.pickup_type = data.name
	pickup.effect = data.effect
	pickup.lane = randi_range(-1, 1)
	pickup.color = Color(data.color)
	pickup.depth = 0.02
	add_child(pickup)
```

---

### Task 6: 火车系统

**Files:**
- Create: `godot-subway-runner/scenes/trains/train.tscn`
- Create: `godot-subway-runner/scripts/trains/train.gd`
- Create: `godot-subway-runner/scripts/trains/train_spawner.gd`

- [ ] **Step 1: 火车脚本**

```gdscript
# scripts/trains/train.gd
extends Node2D

@export var train_color: Color = Color.RED
@export var num_cars: int = 3
@export var train_width: int = 1  # 1 or 2 lanes
@export var lane: int = 0
@export var climbable: bool = false

var depth: float = 0.02
var horn_timer: float = 0.0
var graffiti_count: int = 0

func _ready() -> void:
	horn_timer = randf_range(1.5, 3.0)
	graffiti_count = randi_range(0, 2)
	_draw_train()

func _process(delta: float) -> void:
	if GameManager.state != GameManager.State.PLAY:
		return
	
	depth += GameManager.current_speed * delta / (get_viewport().get_visible_rect().size.y * 0.75)
	
	horn_timer -= delta
	if horn_timer <= 0 and depth > 0.08 and depth < 0.75:
		AudioManager.play_horn()
		horn_timer = randf_range(2.0, 4.0)
	
	if depth > 1.12:
		queue_free()
		return
	
	_update_position()

func _update_position() -> void:
	var pos := Perspective.depth_to_position(float(lane), depth)
	position = Vector2(pos.x, pos.y)
	scale = Vector2(pos.scale, pos.scale)

func _draw_train() -> void:
	# Simplified train drawing with Rect2 and circles
	var u: float = get_viewport().get_visible_rect().size.x * 0.028
	var total_w := float(train_width) * u * 10
	
	for c in range(num_cars):
		var cz := float(c) * u * 4.8
		# Car body
		var car := ColorRect.new()
		car.color = train_color
		car.size = Vector2(u * 4.3, u * 5)
		car.position = Vector2(cz - total_w / 2 + u * 0.5, -u * 4)
		add_child(car)
	
	# Engine (front)
	var engine := ColorRect.new()
	engine.color = train_color
	engine.size = Vector2(u * 5, u * 5.8)
	engine.position = Vector2(-total_w / 2 + u * 0.3 - u * 2, -u * 4.8)
	add_child(engine)

func covers_lane(player_lane: float) -> bool:
	if train_width == 2:
		return player_lane >= float(lane) - 0.3 and player_lane <= float(lane) + 1.3
	else:
		return abs(player_lane - float(lane)) < 0.45
```

- [ ] **Step 2: 火车生成器**

```gdscript
# scripts/trains/train_spawner.gd
extends Node2D

@export var train_scene: PackedScene

var spawn_timer: float = 9.0
var train_colors := [Color("#c0392b"), Color("#2980b9"), Color("#27ae60"), Color("#f39c12"), Color("#1a1a1a")]

func _process(delta: float) -> void:
	if GameManager.state != GameManager.State.PLAY:
		return
	
	spawn_timer -= delta
	if spawn_timer <= 0:
		spawn_train()
		var dist_factor := min(GameManager.total_distance / 20000.0, 0.4)
		spawn_timer = randf_range(8.0, 14.0) * (1.0 - dist_factor)

func spawn_train() -> void:
	var train: Node2D = train_scene.instantiate()
	train.train_color = train_colors[randi() % train_colors.size()]
	
	var two_lane := randf() < 0.45
	if two_lane:
		train.train_width = 2
		train.lane = -1 if randf() < 0.5 else 0
		train.num_cars = randi_range(2, 4)
	else:
		train.train_width = 1
		train.lane = randi_range(-1, 1)
		train.num_cars = randi_range(1, 5) if randf() < 0.3 else randi_range(1, 2)
		train.climbable = randf() < 0.35
	
	train.depth = 0.02
	add_child(train)
```

---

### Task 7: UI 系统

**Files:**
- Create: `godot-subway-runner/scenes/ui/hud.tscn`
- Create: `godot-subway-runner/scripts/ui/hud.gd`
- Create: `godot-subway-runner/scenes/ui/menu_screen.tscn`
- Create: `godot-subway-runner/scripts/ui/menu_screen.gd`
- Create: `godot-subway-runner/scenes/ui/death_screen.tscn`
- Create: `godot-subway-runner/scripts/ui/death_screen.gd`

- [ ] **Step 1: HUD 脚本**

```gdscript
# scripts/ui/hud.gd
extends CanvasLayer

@onready var score_label: Label = $ScoreLabel
@onready var distance_label: Label = $DistanceLabel
@onready var hearts_container: HBoxContainer = $HeartsContainer
@onready var power_up_container: VBoxContainer = $PowerUpContainer
@onready var pause_button: Button = $PauseButton

func _ready() -> void:
	GameManager.score_changed.connect(_on_score_changed)
	_update_hearts(3)

func _process(_delta: float) -> void:
	if GameManager.state != GameManager.State.PLAY:
		return
	score_label.text = str(int(GameManager.score))
	distance_label.text = str(int(GameManager.total_distance)) + "m"

func _on_score_changed(new_score: float) -> void:
	score_label.text = str(int(new_score))

func _update_hearts(hp: int) -> void:
	for child in hearts_container.get_children():
		child.queue_free()
	for i in range(3):
		var heart := Label.new()
		heart.text = "❤" if i < hp else "♡"
		heart.add_theme_color_override("font_color", Color.RED if i < hp else Color.DIM_GRAY)
		hearts_container.add_child(heart)

func update_power_up_timers(player) -> void:
	for child in power_up_container.get_children():
		child.queue_free()
	if player.magnet_active:
		var label := Label.new()
		label.text = "Magnet: %.1fs" % player.magnet_timer
		label.add_theme_color_override("font_color", Color("#3498db"))
		power_up_container.add_child(label)
	if player.double_coin_active:
		var label := Label.new()
		label.text = "x2 Coin: %.1fs" % player.double_coin_timer
		label.add_theme_color_override("font_color", Color("#f39c12"))
		power_up_container.add_child(label)
	if player.skate_active:
		var label := Label.new()
		label.text = "Skate: %.1fs" % player.skate_timer
		label.add_theme_color_override("font_color", Color("#2ecc71"))
		power_up_container.add_child(label)
```

- [ ] **Step 2: 菜单脚本**

```gdscript
# scripts/ui/menu_screen.gd
extends CanvasLayer

@onready var title_label: Label = $CenterContainer/VBoxContainer/TitleLabel
@onready var high_score_label: Label = $CenterContainer/VBoxContainer/HighScoreLabel
@onready var start_button: Button = $CenterContainer/VBoxContainer/StartButton

func _ready() -> void:
	GameManager.game_started.connect(_on_game_started)
	GameManager.game_ended.connect(_on_game_ended)
	show()

func _on_game_started() -> void:
	hide()

func _on_game_ended() -> void:
	pass  # Death screen handles this

func _on_start_button_pressed() -> void:
	GameManager.start_game()
```

- [ ] **Step 3: 死亡画面脚本**

```gdscript
# scripts/ui/death_screen.gd
extends CanvasLayer

@onready var panel: Panel = $Panel
@onready var final_score_label: Label = $Panel/VBoxContainer/FinalScore
@onready var high_score_label: Label = $Panel/VBoxContainer/HighScore
@onready var distance_label: Label = $Panel/VBoxContainer/Distance
@onready var restart_button: Button = $Panel/VBoxContainer/RestartButton

func _ready() -> void:
	GameManager.game_ended.connect(_on_game_ended)
	GameManager.game_started.connect(_on_game_started)
	hide()

func _on_game_ended() -> void:
	await get_tree().create_timer(0.6).timeout
	final_score_label.text = "Score: %d" % int(GameManager.score)
	high_score_label.text = "Best: %d" % GameManager.high_score
	distance_label.text = "Distance: %dm" % int(GameManager.total_distance)
	show()

func _on_game_started() -> void:
	hide()

func _on_restart_button_pressed() -> void:
	get_tree().reload_current_scene()
```

---

### Task 8: 特效 + 粒子

**Files:**
- Create: `godot-subway-runner/scenes/effects/particle_burst.tscn`
- Create: `godot-subway-runner/scripts/effects/particle_burst.gd`
- Create: `godot-subway-runner/scripts/effects/floating_text.gd`

- [ ] **Step 1: 粒子爆发效果**

```gdscript
# scripts/effects/particle_burst.gd
extends GPUParticles2D

func emit_at(pos: Vector2, count: int, particle_color: Color, speed: float = 2.0) -> void:
	position = pos
	amount = count
	var mat := process_material as ParticleProcessMaterial
	if mat:
		mat.color = particle_color
		mat.initial_velocity_min = speed * 0.4
		mat.initial_velocity_max = speed
	emitting = true
	await get_tree().create_timer(lifetime + 0.1).timeout
	queue_free()

static func burst(parent: Node, pos: Vector2, count: int, color: Color, speed: float = 2.0) -> void:
	var scene := load("res://scenes/effects/particle_burst.tscn")
	var burst := scene.instantiate()
	parent.add_child(burst)
	burst.emit_at(pos, count, color, speed)
```

- [ ] **Step 2: 浮动文字效果**

```gdscript
# scripts/effects/floating_text.gd
extends Label

var velocity: Vector2 = Vector2(0, -60)
var lifetime: float = 1.2
var elapsed: float = 0.0

func _ready() -> void:
	horizontal_alignment = HORIZONTAL_ALIGNMENT_CENTER
	add_theme_font_size_override("font_size", 18)

func _process(delta: float) -> void:
	elapsed += delta
	position += velocity * delta
	var alpha := clamp(1.0 - elapsed / lifetime, 0.0, 1.0)
	modulate.a = alpha
	if elapsed >= lifetime:
		queue_free()

static func show(parent: Node, pos: Vector2, text: String, color: Color, size: float = 1.0) -> void:
	var scene := load("res://scenes/effects/floating_text.tscn")
	var ft := scene.instantiate()
	ft.position = pos
	ft.text = text
	ft.add_theme_color_override("font_color", color)
	ft.add_theme_font_size_override("font_size", int(18 * size))
	parent.add_child(ft)
```

---

### Task 9: 组装 + 测试

- [ ] **Step 1: 完整场景树组装**

在编辑器中手动构建 Main 场景树，或通过脚本验证：

```
Main (Node2D, script: main.gd)
├── World (Node2D, y_sort_enabled=true)
│   ├── Sky (ColorRect) — gradient from dark blue to light blue
│   ├── Ground (Node2D, script: ground_renderer.gd)
│   ├── Player (PackedScene: player.tscn)
│   │   └── add_to_group("player")
│   ├── ObstacleSpawner (Node2D, script: obstacle_spawner.gd)
│   ├── PickupSpawner (Node2D, script: pickup_spawner.gd)
│   └── TrainSpawner (Node2D, script: train_spawner.gd)
├── HUD (CanvasLayer, script: hud.gd)
├── MenuScreen (CanvasLayer, script: menu_screen.gd)
└── DeathScreen (CanvasLayer, script: death_screen.gd)
```

- [ ] **Step 2: 在编辑器中运行验证**

1. 在 Godot 编辑器中打开 `project.godot`
2. 设置 `main.tscn` 为主场景
3. 按 F5 运行 — 应看到菜单界面
4. 点击开始 — 应进入游戏，角色在轨道上
5. 按 ← → ↑ ↓ — 应切换跑道、跳跃、滑铲
6. 等待障碍物/道具/火车生成 — 验证碰撞和拾取

- [ ] **Step 3: 高对比度测试**

- 正常速度玩法 30 秒，确认不掉帧（F3 开启性能监视器）
- 故意撞障碍物 3 次，验证死亡流程
- 拾取各种道具，验证计时和效果
- 等待火车生成，验证碰撞和攀爬

---

## 后续阶段（本计划不覆盖）

- 角色精灵替换（程序化绘制 → 美术资产）
- 音效替换（合成音 → AudioStream 文件）
- 触屏输入适配
- HTML5 Web 导出
- C# 对象池优化（当前 GDScript 可用，后期按需提取）
- 地形坡道细腻化
