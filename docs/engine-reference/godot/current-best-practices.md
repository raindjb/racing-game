# Godot 4.5 — Current Best Practices

Last verified: 2026-05-17

## GDScript

### New in 4.5

```gdscript
# Abstract classes — prevent direct instantiation
class_name Enemy
extends Node2D
abstract

func take_damage(amount: int) -> void:
    pass  # abstract — subclass must implement

# Variadic arguments
func log_messages(prefix: String, *messages: String) -> void:
    for msg in messages:
        print(prefix, ": ", msg)
```

### General Best Practices

- Use `@export` for all tunable values — never hardcode gameplay numbers
- Cache node references with `@onready` or `$NodePath`
- Use `static func` for pure utility functions (no instance state)
- Signals over direct method calls for cross-system communication
- `class_name` at top of every reusable script for type safety

## C# Best Practices

### New in 4.5

```csharp
// Godot 4.5: StringExtensions changes
string ext = "file.txt".GetExtension(); // "txt" (not ".txt" like before)
string path = "".PathJoin("subdir");    // "subdir" (no leading separator)

// Shortest-arc quaternion (fixed in 4.5)
var rotation = new Quaternion(fromVector, toVector);
```

### General Best Practices

- Use `[Signal]` delegate pattern for signals
- `[Export]` on public properties for editor exposure
- Partial class required: `public partial class MyNode : Node2D`
- Use `Mathf` for math operations (not `System.Math`)
- Avoid `GetNode<T>()` in `_Process()` — cache in `_Ready()`

## Cross-Language (GDScript + C#)

- **GDScript → C#**: Use signals (not direct method calls) for `_Process()` communication
- **C# → GDScript**: Use `CallDeferred()` or signals
- **Shared config**: Store in `.tres` resource files, readable by both languages
- **Boundary**: One system = one language. Don't split a single system across languages.

## Object Pooling

For frequently spawned/despawned objects (obstacles, particles, pickups):

```gdscript
# Pool pattern in GDScript
var pool: Array[Node2D] = []

func get_from_pool() -> Node2D:
    if pool.is_empty():
        return scene.instantiate()
    return pool.pop_back()

func return_to_pool(node: Node2D) -> void:
    node.visible = false
    node.process_mode = Node.PROCESS_MODE_DISABLED
    pool.append(node)
```

## 2D Scene Structure

Recommended node hierarchy for a 2D game:

```
Main (Node2D)
├── GameWorld (Node2D)
│   ├── Background (Parallax2D or custom Node2D)
│   ├── Ground/Tracks (TileMapLayer or Node2D)
│   ├── Player (CharacterBody2D)
│   ├── Obstacles (Node2D) — pooled children
│   ├── Pickups (Node2D) — pooled children
│   └── Trains (Node2D) — pooled children
├── Effects (Node2D) — particles, screen shake
├── HUD (CanvasLayer)
│   ├── ScoreLabel
│   ├── HealthContainer
│   └── PowerUpTimers
├── Menu (CanvasLayer)
└── DeathScreen (CanvasLayer)
```

## Performance

- Use `PhysicsProcess` (60Hz) for movement/collision, `Process` (variable) for visual polish
- `CharacterBody2D` over `RigidBody2D` for player-controlled entities
- `Area2D` for collectibles and trigger zones (cheaper than full physics bodies)
- Object pools for any entity instantiated more than 10 times per session
- Disable `process_mode` on off-screen pooled objects
- Use `visible = false` to skip rendering of pooled objects
