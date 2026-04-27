# Cloudflare Workers 部署

## 入口

`src/worker.ts` 默认导出包含两个 handler：

| handler | 用途 |
|---------|------|
| `fetch(request, env)` | 暴露 HTTP 端点，便于手动触发与调试 |
| `scheduled(controller, env, ctx)` | 由 cron triggers 触发，定时推送 |

`fetch` 路由：

| 方法 | 路径 | 行为 |
|------|------|------|
| GET | `/` | 帮助文本 |
| GET | `/preview` | 渲染 demo 数据并返回 PNG（不推送，便于浏览器查看效果） |
| POST | `/push` | 渲染并推送一次到 Dot 设备，返回 Dot API 响应 |

## wrangler.toml 关键项

```toml
name = "quote-ai-usage"
main = "src/worker.ts"
compatibility_date = "2025-04-01"
compatibility_flags = ["nodejs_compat"]      # satori 内部需要 Buffer polyfill

[[rules]]
type = "Data"                                # *.ttf 作为 ArrayBuffer 注入
globs = ["**/*.ttf", "**/*.otf"]
fallthrough = true

# [triggers]
# crons = ["*/30 * * * *"]                   # 启用后每 30 分钟跑一次 scheduled
```

注意事项：

- **nodejs_compat 是必须的**：satori 运行时引用了 `Buffer` 等 Node 内置；
  这个 flag 让 Workers 自动注入 polyfill。
- **wasm 用相对路径 import**：`src/render.worker.ts` 引用
  `./vendor/resvg.wasm`，由 `scripts/copy-wasm.mjs`（`postinstall`）从
  `node_modules/@resvg/resvg-wasm/index_bg.wasm` 复制而来。Wrangler 默认把
  `.wasm` 解析为 `WebAssembly.Module` 类型 import，可直接传入 `initWasm`。
- **字体也由 wrangler 打入 bundle**：通过 `[[rules]]` 配置 `*.ttf` 为
  `Data` 类型，`import font from '../assets/fonts/Regular.ttf'` 即得到
  `ArrayBuffer`。两端共用同一份 ttf 文件。

## Secrets

设备 ID 与 API Key 都视为 secret 单独管理：

```bash
wrangler secret put DOT_API_KEY
wrangler secret put DOT_DEVICE_ID
# 可选：wrangler secret put DOT_API_BASE_URL
```

非敏感值（如自定义 base URL）也可写在 `[vars]`。

## 本地试跑

`wrangler dev` 用 `workerd` 在本机模拟生产 runtime，比 `tsx` 更接近真实部署
行为：

```bash
npm run worker:dev                 # 启动 wrangler dev
curl http://localhost:8787/        # 帮助
curl -o preview.png http://localhost:8787/preview
curl -X POST http://localhost:8787/push
```

> `wrangler dev` 第一次会询问是否登录；需要本地拥有 Cloudflare 账号才能
> 进入 remote runtime。本地 runtime 模式（`--local`，wrangler 4 默认）无需登录。

## 部署

```bash
npm run worker:deploy
```

启用定时推送：编辑 `wrangler.toml` 取消 `[triggers]` 注释，再次 deploy。
默认示例 `*/30 * * * *` 每 30 分钟一次；具体表达式按业务调整。

## 兼容性约束（已验证可跑）

| 模块 | Workers 状态 | 备注 |
|------|-------------|------|
| `satori` | ✅ | 需 `nodejs_compat` |
| `@resvg/resvg-wasm` | ✅ | 纯 wasm |
| `fetch` | ✅ | 平台原生 |
| `btoa` | ✅ | 平台原生，已替代 Buffer |
| `WebAssembly.Module` import | ✅ | wrangler 打包支持 |
| `*.ttf` data import | ✅ | 通过 `[[rules]] type = "Data"` |

## 故障排查

| 现象 | 可能原因 | 处理 |
|------|---------|------|
| 部署后 `/push` 返回 500 / `Buffer is not defined` | 没开 `nodejs_compat` | 添加 flag 重新部署 |
| 部署阶段报 `.ttf` 模块解析失败 | `[[rules]]` 没配置或字体文件缺失 | 确认 `wrangler.toml` 与 `assets/fonts/*.ttf` |
| `initWasm` 抛错或冷启动慢 | wasm 重复初始化 | `ensureResvgInit` 已做单例保护；模块作用域缓存随实例存活 |
| scheduled 任务静默失败 | 异常没冒泡 | 已用 `ctx.waitUntil(p.then(ok, err))`，失败会写入 console；查看 `wrangler tail` |
