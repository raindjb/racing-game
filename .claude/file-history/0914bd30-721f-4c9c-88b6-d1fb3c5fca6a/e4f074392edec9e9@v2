# Godot 4.5 Deprecated APIs

Last verified: 2026-05-17

## Don't Use → Use Instead

| Deprecated API | Replacement | Since |
|---------------|-------------|-------|
| `ParallaxBackground` node | Use custom parallax with `Node2D` + manual offset | 4.5 |
| `ParallaxLayer` node | Use custom parallax with `Node2D` + manual offset | 4.5 |
| `JSONRPC.set_scope()` | `JSONRPC.set_method()` | 4.5 |
| `Node.get_rpc_config()` | `Node.get_node_rpc_config()` | 4.5 |
| `RenderingServer.instance_reset_physics_interpolation()` | REMOVED — no replacement | 4.5 |
| `RenderingServer.instance_set_interpolated()` | REMOVED — no replacement | 4.5 |
| `Resource.duplicate(true)` for deep copy | `Resource.duplicate_deep(DEEP_DUPLICATE_ALL)` | 4.5 |
| `RichTextLabel.add_image()` with `size_in_percent` | Use `width_in_percent` + `height_in_percent` | 4.5 |
| `ProjectSettings.add_property_info()` with `"usage"` key | Use `set_as_basic()`, `set_restart_if_changed()`, `set_as_internal()` | 4.5 |
| Jolt `areas_detect_static_bodies` setting | REMOVED — use collision masks/layers | 4.5 |

## Still Valid from 4.0-4.4 (Check Before Using)

| Old API | Replacement | Since |
|---------|-------------|-------|
| `TileMap` node | `TileMapLayer` | 4.3 |
| `@onready var node = get_node(...)` | `@onready var node = $NodePath` | 4.0 |
| `kinematic_char.move_and_slide()` | `CharacterBody2D.move_and_slide()` | 4.0 |
| `yield()` | `await` | 4.0 |
| `signal.connect(target, "method")` | `signal.connect(target.method.bind(...))` | 4.0 |
