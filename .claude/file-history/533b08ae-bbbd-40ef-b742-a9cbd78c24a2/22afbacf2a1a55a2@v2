---
name: openclaw-token-plan-setup
description: "OpenClaw installed with Xiaomi Token Plan, tricky config steps documented"
metadata: 
  node_type: memory
  type: reference
  originSessionId: 533b08ae-bbbd-40ef-b742-a9cbd78c24a2
---

OpenClaw 2026.5.22 installed globally via npm at C:\nodejs.

**Key gotchas when configuring Xiaomi Token Plan:**
- Token Plan keys start with `tp-` prefix — NOT compatible with the default Xiaomi provider URL
- Must use baseUrl: `https://token-plan-cn.xiaomimimo.com/v1` (not `api.xiaomimimo.com`)
- Token Plan model IDs use dots: `mimo-v2.5`, `mimo-v2.5-pro` (NOT `mimo-v2-flash`, `mimo-v2-pro`)
- Auth profiles stored at `~/.openclaw/agents/main/agent/auth-profiles.json`
- Auth freeze state at `~/.openclaw/agents/main/agent/auth-state.json` — delete/clear when stuck on billing/auth errors
- Don't delete startup .cmd or gateway scheduled task breaks — if broken, just run `openclaw gateway` in foreground
- npm graceful-fs can go missing on Node v24 — manually extract from tarball into npm's node_modules

Current working settings in `~/.openclaw/openclaw.json`:
- primary model: `xiaomi/mimo-v2.5`
- xiaomi plugin enabled with Token Plan endpoint
