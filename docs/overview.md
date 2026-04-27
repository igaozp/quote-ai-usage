# quote-ai-usage 项目总览

## 目标

将 LLM AI 的 usage 信息（消费金额、token 用量、调用次数等）以 **296×152 PNG**
图片的形式，通过 **Dot 官方开放 API** 定时推送到 quote/0 设备屏幕。同一份代码同
时支持本地 Node 运行与 Cloudflare Workers 部署，部署侧通过 cron triggers 实现定
时推送。

## 当前进度

- [x] Dot 图像 API 对接（POST /api/authV2/open/device/:deviceId/image）
- [x] 基础渲染管线：satori → SVG → resvg-wasm → PNG
- [x] 本地 Node 入口（读环境变量 + 推送 / 预览）
- [x] Cloudflare Workers 入口（fetch + scheduled）
- [x] 双端共享代码 + 平台适配器隔离
- [ ] 真实 usage 数据源接入（Anthropic / OpenAI）
- [ ] 渲染模板与配色对实际 e-paper dither 效果的视觉调优
- [ ] 错误重试 / 限流 / 监控
