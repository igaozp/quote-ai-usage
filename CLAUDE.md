# CLAUDE.md

本文件为后续 Claude Code 在此仓库工作时提供必要上下文。完整设计文档在
[`docs/`](./docs/README.md)，本文只列改代码前必须知道的事。

## 项目一句话

把 LLM 用量信息渲染成 296×152 PNG，通过 Dot 开放 API 定时推到 quote/0 设备。
同一份 TypeScript 代码同时跑在本地 Node 与 Cloudflare Workers。

## 双端兼容是硬约束

- 平台无关代码（`src/render.ts`, `src/dot-client.ts`, `src/config.ts`,
  `src/types.ts`）只能依赖 Web 标准：`fetch`、`btoa`、`ArrayBuffer`、
  `WebAssembly`。**不要引入 `Buffer`、`fs`、`process` 等 Node 专属 API**。
- 平台差异只在两个适配器：
  - `src/render.node.ts` — Node 端用 `fs.readFile` / `require.resolve`
  - `src/render.worker.ts` — Workers 端用 `import` 加载 wasm 与 ttf
- Workers 通过 `nodejs_compat` flag 让 satori 内部的 `Buffer` 引用可用，
  **业务代码不要依赖这个 polyfill**。

## 类型一致

- `RenderFont.data` 是 `ArrayBuffer`（不是 `Buffer`、不是 `Uint8Array`）。
  Node 端用 `buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength)`
  转成独立 ArrayBuffer。
- TypeScript 用 solution-style 配置，IDE（VSCode/Zed）按 references 自动选对：
  - `tsconfig.json` — solution 入口，`files: []` + 两个 `references`
  - `tsconfig.base.json` — 共享 compilerOptions
  - `tsconfig.node.json` — Node 代码，`types: ["node"]`，`lib` 含 DOM
  - `tsconfig.worker.json` — Worker 代码，`types: ["@cloudflare/workers-types"]`，
    `lib` 用 `WebWorker` 不含 DOM 与 node
- `npm run typecheck` 同时跑 node 与 worker 两个 project；改完代码必须两个都过。

## 资源管线

- **wasm**：`scripts/copy-wasm.mjs` 在 `postinstall` 时把
  `node_modules/@resvg/resvg-wasm/index_bg.wasm` 复制到 `src/vendor/resvg.wasm`。
  Worker 通过相对路径 `import resvgWasm from "./vendor/resvg.wasm"` 引用。
  vendor 目录被 gitignore，删了重新 `npm install` 即可。
- **字体**：`assets/fonts/Regular.ttf` 与 `Bold.ttf` 必须由用户/部署环境
  自行提供（gitignore），satori 不接受 variable font，必须用静态 TTF。
- **wrangler.toml** 中 `[[rules]] type = "Data"` 让 ttf 作为
  `ArrayBuffer` 注入；`*.wasm` 是 wrangler 内置识别。

## 渲染约束（satori）

- 容器节点必须显式 `display: 'flex'`，否则 yoga 布局不生效。
- 不支持 grid / float / 复杂 CSS / JS / variable font。
- 颜色尽量纯黑白：屏幕最终经 dither，灰度信息会丢失。
- 当前模板见 `src/render.ts` 的 `buildTree()`，字段契约见 `UsageData`。

## Dot API 调用约定

- 客户端封装在 `src/dot-client.ts`。`apiKey` 不带 `dot_app_` 前缀，
  `DotClient` 内部拼。
- 错误统一抛 `DotApiError`（携 status / code / body）。三层覆盖：
  HTTP 非 2xx、body 形态异常、`code !== 200`。
- 限流 10 req/s；当前用法（每设备每 30 分钟一次）远低于阈值。
- 推送的 PNG 尺寸固定 296×152；改尺寸要同步改 `CARD_WIDTH/HEIGHT`。

## 入口与触发

- 本地：`src/index.ts`，跑 `npm run dev`（推送）或 `npm run preview`
  （`--dry-run` + `DEBUG_PNG=preview.png`）。
- Workers：`src/worker.ts`，导出 `fetch` + `scheduled`。路由：
  - `GET /` 帮助
  - `GET /preview` 仅渲染返回 PNG
  - `POST /push` 渲染 + 推送
- 定时通过 `wrangler.toml` 的 `[triggers] crons`（默认注释掉）。

## 配置读取

- `src/config.ts` 的 `loadConfig(env)` 接收任意 env-shaped 对象：本地传
  `process.env`，Workers 传 `env` 绑定。新增配置都加到 `EnvLike` 与
  `AppConfig` 里，两端共用。
- secrets：`DOT_API_KEY`、`DOT_DEVICE_ID` 都按 secret 管理（`wrangler secret put`
  或本地 `.env`），不要硬编码、不要 commit。

## 不要做的事

- 不要把 `Buffer`、`fs`、`require` 引入到平台无关文件。
- 不要在 `tsconfig.worker.json` 加 `@types/node`，会与 workers-types 冲突。
- 不要把字体或 vendor 的 wasm commit 进仓库。
- 不要绕过 `DotClient` 直接 `fetch` Dot API（会丢错误处理）。
- 不要用 variable font；satori 会渲染失败。
- 不要在 satori 树里加非 flex 布局或复杂 CSS。

## 待办（详见 docs/roadmap.md）

1. 真实 usage 数据源（Anthropic / OpenAI）替换 `demoData()`
2. 模板调优 + 中文字体
3. 重试 / 监控
4. 多设备 / 多 taskKey
