# 架构

## 分层

```
┌────────────────────────────┐  ┌────────────────────────────┐
│  src/index.ts              │  │  src/worker.ts             │
│  Node 入口                  │  │  Workers 入口               │
│  (process.env, fs, argv)   │  │  (fetch / scheduled, env)  │
└──────────┬─────────────────┘  └──────────┬─────────────────┘
           │                                │
           ▼                                ▼
┌────────────────────────────┐  ┌────────────────────────────┐
│  src/render.node.ts        │  │  src/render.worker.ts      │
│  - fs.readFile 读字体/wasm  │  │  - import *.ttf / *.wasm    │
│  - require.resolve         │  │  - wrangler bundler 处理     │
└──────────┬─────────────────┘  └──────────┬─────────────────┘
           │                                │
           └──────────────┬─────────────────┘
                          ▼
        ┌────────────────────────────────────┐
        │  src/render.ts (平台无关)           │
        │  - satori(树) → SVG                 │
        │  - Resvg(SVG) → PNG (Uint8Array)    │
        │  - ensureResvgInit() 单例 wasm 初始化│
        └──────────────┬─────────────────────┘
                       ▼
        ┌────────────────────────────────────┐
        │  src/dot-client.ts                 │
        │  - DotClient.pushImage(deviceId,…) │
        │  - pngBytesToBase64 (纯 btoa)       │
        │  - DotApiError                     │
        └──────────────┬─────────────────────┘
                       ▼
              Dot Open Image API
        https://dot.mindreset.tech
```

## 核心设计原则

1. **平台无关代码做主体**：`render.ts` / `dot-client.ts` / `config.ts` /
   `types.ts` 都只依赖 Web 标准（`fetch`、`btoa`、`ArrayBuffer`、
   `WebAssembly`），Node 与 Workers 都能直接使用。
2. **平台差异隔离在适配器**：`render.node.ts`（fs / require）和
   `render.worker.ts`（binary import）是仅有的两个平台特定文件。新增运行环境时
   只需新增一个适配器。
3. **二进制资源同源**：字体文件统一放在 `assets/fonts/`，Node 端走 `fs.readFile`，
   Workers 端走 `import` 由 wrangler 打包；wasm 通过 `scripts/copy-wasm.mjs`
   vendored 到 `src/vendor/`，避免跨 `node_modules` 边界 import。
4. **类型一致**：`RenderFont.data` 收紧为 `ArrayBuffer`，两端都拷贝/产出独立
   ArrayBuffer，避免 Node `Buffer` 类型污染 Worker tsconfig。
5. **配置一处定义**：`loadConfig(env)` 接收任意 env-shaped 对象（`process.env`
   或 Workers `env` 绑定），返回相同 `AppConfig`。

## 文件清单

| 路径 | 角色 | 平台 |
|------|------|------|
| `src/types.ts` | Dot API 请求/响应类型 | 双端 |
| `src/dot-client.ts` | Dot API 客户端 + base64 编码 | 双端 |
| `src/config.ts` | env → AppConfig | 双端 |
| `src/render.ts` | satori + resvg 渲染核心 | 双端 |
| `src/render.node.ts` | Node 资源加载适配 | Node |
| `src/render.worker.ts` | Workers 资源加载适配 | Workers |
| `src/index.ts` | Node CLI 入口 | Node |
| `src/worker.ts` | Workers 入口 (fetch + scheduled) | Workers |
| `src/worker-assets.d.ts` | `*.wasm` / `*.ttf` 模块声明 | Workers |
| `src/vendor/resvg.wasm` | postinstall 复制的 wasm（gitignored）| 双端可用 |
| `assets/fonts/Regular.ttf` | 体重 400 的字体（gitignored）| 双端 |
| `assets/fonts/Bold.ttf` | 体重 700 的字体（gitignored）| 双端 |
| `scripts/copy-wasm.mjs` | postinstall 钩子：复制 resvg wasm | build-time |
| `wrangler.toml` | Workers 部署配置 | Workers |
| `tsconfig.json` | Node 代码 typecheck | build-time |
| `tsconfig.worker.json` | Worker 代码 typecheck | build-time |
