# Claude connector: "connect Claude, describe a device, get the whole design" (C1–C5)

Status: approved by the founder on 2026-10-28 for C1 and C2; C3–C5 still need approval. Follows `brief-to-field-plan.md`, `pro-build-plan.md` §0 (ground rules, time boxes, one review and one fix round) and ADR 012 ("the model thinks, we provide verified hands").

## 1. Goal

A member adds the AIoT connector to Claude and types, for example: *"I want to build a device that reads my car's speedometer, car brand X, …"*. Claude does the reasoning on the member's own Claude plan. AIoT provides the verified hands: catalog, checks, netlist, power, compile, revisions, KiCad, Build Sheet. The reply contains the design summary and links to the workspace, the Build Sheet PDF, the KiCad zip and the BOM.

This is "AI paid, deterministic free" in its purest form: AIoT tools cost nothing per call, and the thinking is paid on the member's Claude plan.

## 2. Today (checked in code, 2026-10-28)

- A Pro MCP surface exists, but it is local only: `services/api/mcp.ts` runs over stdio and calls the API on loopback only (`services/api/mcp-pro-tools.ts` registers the `mcp:true` tools). claude.ai and remote users cannot reach it.
- There is no `create_project` tool. Ops already has `Pro.createProject(subject, name)`.
- `SystemSpec` is site-shaped: at least 1 field and at least 2 nodes (field + gateway). A single device (car, robot, bench tool) does not fit.
- `device_flash` and the client tools are never exposed over MCP. That stays.

## 3. Slices

| # | Slice | Time box | Done when |
|---|---|---|---|
| **C1** | **Remote MCP + create_project** | 1.5 d | Claude Code connects to `https://<ops>/mcp` with a member token, creates a project and saves a valid revision |
| **C2** | **Single-device mode** | 1 d | A one-node device spec (no fields, no gateway) validates, verifies, renders in `/pro` and prints a Build Sheet |
| C3 | Vehicle domain pack | 1 d | Skill `vehicle-obd` plus parts (MCP2515/TJA1050 CAN, ESP32-CAM, 12→5 V automotive buck). Read-only by rule: writing to the CAN bus and odometer changes are refused |
| C4 | Results visible inside Claude | 1 d | Tools return SVG images of the wiring and board, plus links. MCP Apps preview is optional |
| C5 | Enclosure design | 1.5–2 d | A parametric case is generated from the board outline and connector cut-outs and exported as STEP/STL |

### C1 details

- **Transport:** MCP Streamable HTTP (`@modelcontextprotocol/sdk`, already a dependency) mounted on the ops server at `/mcp`. Stateless JSON responses are acceptable.
- **Auth, phase 1 (this slice):**
  - Personal access tokens. A member with the `pro` grant (or staff) creates a token on `/profile`. The token is shown once; only its sha256 is stored.
  - At most 5 tokens per member, with an expiry (default 90 days), a last-used time and revoke.
  - Sent as `Authorization: Bearer …`.
  - This works with Claude Code (`claude mcp add --transport http`) and with Claude Desktop through a header.
- **Auth, phase 2 (C1b, cut-first):** OAuth 2.1 with PKCE and dynamic client registration, so claude.ai custom connectors work. It reuses the member login, with a consent screen naming the scopes.
- **Tools:** the same registry the in-app agent uses, through the same dispatch (`services/ops/pro-tools.ts`), so authz, the input schema, rate limits, `untrusted` wrapping and the `save_revision` gate are identical. Excluded: `device_flash` and every `runsAt:'client'` tool.
- **New tool `create_project`:**
  - Input `{name}`. Output `{projectId, workspaceUrl}`. Effect: write.
  - Appended to the registry; existing tools are never reordered.
- **Every result that names a project** carries links: `/pro/:id`, `/pro/print/:id/:rev`, and the KiCad export endpoint.
- **Limits:** per-token rate limit (the same limiter as the in-app tools), request body at most 2 MB, and an audit log line per call (token id, tool, ms, ok). Token values are never logged.
- **Deploy (owner):** an nginx location for `/mcp` with `proxy_buffering off`. It is documented in the PR and never edited by agents.

### C2 details

- `SystemSpec` gains optional `site.kind: 'site' | 'device'`, default `'site'`. Existing specs stay valid unchanged, and `SYSTEM_SPEC_VERSION` stays 1.
- For `kind:'device'`:
  - `fields` may be empty and `nodes` may hold exactly 1.
  - A new node role `device` needs no `fieldId`.
  - No gateway or links are required.
  - Site-level climate becomes optional, and the power source may be `mains`, `battery` or `vehicle-12v`.
- Verification, derivation, `get_spec_schema` (with a second valid example: a one-node device), the agent prompt (choose device mode for single products), the `/pro` tree, 3D, site plan (hidden for devices), Board tab and Build Sheet all handle device mode.
- Tests: the device fixture validates and verifies; every existing site fixture still passes; the Build Sheet model renders a device.

## 4. Mockups

**Connecting (Claude Code)**
```
$ claude mcp add --transport http aiot https://ops.iot.ai.id/mcp \
    --header "Authorization: Bearer aiot_pat_••••••••"
✓ aiot connected · 21 tools
```

**Profile → Claude connector (new card on /profile)**
```
┌ Claude connector ─────────────────────────────────────────┐
│ Let Claude design with AIoT's verified parts and checks.  │
│ Endpoint  https://ops.iot.ai.id/mcp            [Copy]     │
│ Tokens                                                    │
│  • laptop-claude   created 28 Oct · used 2 h ago [Revoke] │
│ [+ New token]  (shown once · expires in 90 days)          │
│ Flashing a board always needs the desktop app and your OK.│
└───────────────────────────────────────────────────────────┘
```

**A reply in Claude after one prompt**
```
Speedometer reader for car X: device design, revision r2 (verified 18/18)

• Board: ESP32-S3 + OBD-II (CAN, read-only) + 12→5 V automotive buck
• Code: compiled ✓ (esp32s3) · Power: 0.9 W avg from vehicle 12 V
• Carrier board: 62 × 48 mm, 3 modules, 11 nets (KiCad 9, unrouted)
• BOM: Rp 410.000 – 560.000 (estimate)

Open workspace     https://iot.ai.id/pro/p_8f2…
Build Sheet (PDF)  https://iot.ai.id/pro/print/p_8f2…/2
KiCad project      Download from the Board tab
Next: assemble at a Lab Mitra, or flash from the desktop app.
```

## 5. Risks

- **Token leakage:** hash-only storage, shown once, expiry, revoke, a per-token rate limit, and no logging of token values.
- **Prompt injection from tool data:** outside text stays under `untrusted`. Physical actions are never possible over MCP.
- **Cost:** tools are deterministic and cheap. A rate limit caps abuse, and `compile_code` keeps its existing quota.
- **Schema drift in C2:** only an optional field is added; every existing fixture must still pass.
- **claude.ai connectors need OAuth (C1b).** Until it ships, the connector works with Claude Code and Claude Desktop only.

## 6. Out of scope

Flashing over MCP, writes to a car's CAN bus, chip-level PCB, and billing (pricing is still a founder decision).
