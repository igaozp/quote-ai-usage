# quote-ai-usage

将 LLM AI 的 usage 信息（消费金额、token、调用次数等）以 296×152 PNG 图片
通过 [Dot 开放 API](https://dot.mindreset.tech) 定时推送到 quote/0 设备屏幕。
同一份代码同时支持本地 Node 运行与 Cloudflare Workers 部署。

## 技术栈

- **TypeScript / Node 18+**（本地）+ **Cloudflare Workers**（生产）
- **satori** 渲染对象树 → SVG
- **@resvg/resvg-wasm** 把 SVG → PNG（纯 wasm，双端可跑）
- **wrangler** 打包部署 + cron triggers 定时

## 快速开始

```bash
npm install                           # postinstall 自动 vendor wasm
cp .env.example .env                  # 填 DOT_API_KEY 和 DOT_DEVICE_ID
# 放置字体（gitignored，详见 assets/fonts/README.md）
#   assets/fonts/Regular.ttf   weight 400
#   assets/fonts/Bold.ttf      weight 700

npm run preview                       # 渲染 demo → preview.png（不推送）
npm run dev                           # 渲染 demo → 真推送到设备
```

## 命令

| 命令 | 说明 |
|------|------|
| `npm run preview` | 本地渲染 demo 数据并保存 `preview.png`，不推送 |
| `npm run dev` | 本地渲染 + 真推送 |
| `npm run typecheck` | 同时检查 Node 与 Worker 两个 tsconfig |
| `npm run worker:dev` | `wrangler dev` 在 workerd 中本地模拟 Worker |
| `npm run worker:deploy` | 部署到 Cloudflare Workers |

Worker HTTP 路由：`GET /preview` 直接返回 PNG，`POST /push` 触发一次推送。

## 部署到 Cloudflare Workers

```bash
wrangler secret put DOT_API_KEY
wrangler secret put DOT_DEVICE_ID
npm run worker:deploy
# 启用定时：编辑 wrangler.toml 取消 [triggers] 注释后重新 deploy
```

详细说明见 [`docs/cloudflare-workers.md`](./docs/cloudflare-workers.md)。

## 文档

完整设计与运维文档放在 [`docs/`](./docs/README.md)：

- `overview.md` — 目标与进度
- `architecture.md` — 双端分层与文件分工
- `dot-api.md` — Dot 图像 API 摘要
- `rendering.md` — 渲染选型与模板
- `local-development.md` — 本地跑通指南
- `cloudflare-workers.md` — Workers 部署细节
- `roadmap.md` — 后续路线图

## 目录结构

```
src/
  types.ts            Dot API 类型
  dot-client.ts       API 客户端 + base64 编码（双端）
  config.ts           env → AppConfig（双端）
  render.ts           satori + resvg 渲染核心（双端）
  render.node.ts      Node 资源加载（fs / require）
  render.worker.ts    Workers 资源加载（import wasm/ttf）
  index.ts            Node CLI 入口
  worker.ts           Workers fetch + scheduled 入口
  worker-assets.d.ts  *.wasm / *.ttf 模块声明
  vendor/resvg.wasm   postinstall 复制（gitignored）
assets/fonts/         Regular.ttf / Bold.ttf（gitignored）
scripts/copy-wasm.mjs postinstall 钩子
docs/                 完整设计文档
wrangler.toml         Workers 部署配置
tsconfig.json         TypeScript solution（references 入口）
tsconfig.base.json    共享 compilerOptions
tsconfig.node.json    Node 代码 tsconfig
tsconfig.worker.json  Worker 代码 tsconfig
```

## License

见 [`LICENSE`](./LICENSE)。
