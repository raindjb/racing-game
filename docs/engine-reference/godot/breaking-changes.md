# Godot 4.5 Breaking Changes (from 4.4)

Last verified: 2026-05-17

## Core

| Change | GDScript Compat | C# Source Compat | C# Binary Compat |
|--------|----------------|------------------|------------------|
| `JSONRPC.set_scope()` → `set_method()` | ❌ | ❌ | ❌ |
| `Node.get_rpc_config()` → `get_node_rpc_config()` | ❌ | ✅ | ✅ |
| `Node.set_name()` param: `String` → `StringName` | ✅ | ✅ | ✅ |
| `Resource.duplicate(true)` now only duplicates subresources inside the resource file | ⚠️ Behavioral | ⚠️ Behavioral | ⚠️ Behavioral |

### `Resource.duplicate()` behavior change

- **Old (4.4):** Deep-duplicated everything, including external resources
- **New (4.5):** Only duplicates subresources inside the resource file
- **Fix:** Use `Resource.duplicate_deep(DEEP_DUPLICATE_ALL)` for old behavior

## Rendering

| Change | GDScript Compat | C# Compat |
|--------|----------------|-----------|
| `RenderingServer.instance_reset_physics_interpolation()` — REMOVED | ❌ | ✅ |
| `RenderingServer.instance_set_interpolated()` — REMOVED | ❌ | ✅ |
| `RenderingDevice.Features.Address` → `BufferDeviceAddress` | ✅ | ❌ (binary) |

## GLTF (C# Breaking)

All `int` fields changed to `long` (64-bit). Recompilation required.

| Class | Fields Changed |
|-------|---------------|
| `GLTFAccessor` | `byte_offset`, `component_type`, `count`, `sparse_count`, `sparse_indices_byte_offset`, `sparse_values_byte_offset` |
| `GLTFBufferView` | `byte_length`, `byte_offset`, `byte_stride` |

## Text

- `CanvasItem`, `Font`, `TextLine`, `TextParagraph`, `TextServer` draw methods: new optional `oversampling` parameter (all languages ❌ except adding the param)
- `RichTextLabel.add_image()` / `update_image()`: `size_in_percent` → `width_in_percent` + `height_in_percent`

## Physics

- **Jolt Physics:** `areas_detect_static_bodies` setting removed — overlaps between Area3D and static bodies always reported. Use collision masks/layers to filter.

## XR

- `OpenXRBindingModifierEditor`, `OpenXRInteractionProfileEditor`, `OpenXRInteractionProfileEditorBase`: Core → Editor API. In C#, wrap in `#if TOOLS`.

## Deprecated Features

| Deprecated | Notes |
|-----------|-------|
| `ParallaxBackground` + `ParallaxLayer` | Deprecated in 2D (GH-105964) |

## C# Specific

- **.NET 9 required** for Android exports
- `StringExtensions.PathJoin` no longer adds extra separators on empty strings
- `StringExtensions.GetExtension` returns `""` instead of original string when no extension exists
- `Quaternion(Vector3, Vector3)` constructor now computes shortest arc correctly
- Android: NativeAOT support added

## Project Settings

- `ProjectSettings.add_property_info()` now warns on `"usage"` key — use `set_as_basic()`, `set_restart_if_changed()`, or `set_as_internal()` instead

## New Features Worth Knowing

- **Stencil buffer** support (Forward+ & Compatibility renderers)
- **Shader baker** — precompile at export (up to 20× faster load on Metal/D3D12)
- **Abstract classes** in GDScript (`abstract` keyword)
- **Variadic arguments** in GDScript
- **Accessibility** — screen reader via AccessKit
- **FoldableContainer** node
- **SMAA anti-aliasing**
- **visionOS** export support
- **WASM SIMD** for Web exports
