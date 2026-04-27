# 本地开发

## 准备

```bash
npm install                           # postinstall 会自动复制 resvg.wasm 到 src/vendor/
cp .env.example .env                  # 填入 DOT_API_KEY 和 DOT_DEVICE_ID
```

字体（必备，gitignored）：将任意静态 TTF 放入

```
assets/fonts/Regular.ttf   # weight 400
assets/fonts/Bold.ttf      # weight 700
```

详见 `assets/fonts/README.md`。推荐使用 Inter 静态字重。

## 环境变量

| 变量 | 说明 | 必填 |
|------|------|------|
| `DOT_API_KEY` | Dot 平台 API Key（无需 `dot_app_` 前缀，客户端自动拼接）| ✅ |
| `DOT_DEVICE_ID` | 设备序列号 | ✅ |
| `DOT_API_BASE_URL` | 覆盖默认 base URL `https://dot.mindreset.tech` | |
| `DEBUG_PNG` | 设置后把渲染结果同时写入此路径（用于人眼检查）| |

## 常用命令

```bash
npm run preview        # 渲染 demo 数据 → preview.png；不推送（--dry-run）
npm run dev            # 渲染 demo 数据 → 真推送到设备
npm run dev -- --dry-run                # 不推送
DEBUG_PNG=out.png npm run dev           # 推送 + 写入预览文件
npm run typecheck      # 同时检查 Node 与 Worker 两个 tsconfig
```

## 本地推送验证流程

1. `npm run preview` 生成 `preview.png`，肉眼检查 296×152 排版是否合理
2. 配置好 `.env` 中 `DOT_API_KEY` / `DOT_DEVICE_ID`
3. `npm run dev`：成功时控制台输出 `Pushed: { code: 200, ... }`，设备屏幕应在
   `refreshNow: true` 下立即刷新

## 故障排查

| 报错片段 | 原因 | 解决 |
|---------|------|------|
| `Missing font: .../Regular.ttf` | 没放字体 | 见 assets/fonts/README.md |
| `Missing DOT_API_KEY` / `DOT_DEVICE_ID` | 没设环境变量 | 配置 `.env` 后再跑 |
| `Dot API request failed (404): 设备不存在或未注册` | deviceId 写错或未授权 | 核对设备序列号 |
| `Dot API error (code 400): 无效的图像格式` | 图片不是 PNG / 尺寸不对 | 检查 `CARD_WIDTH/HEIGHT` 与 satori 输出 |
| `code 403` | API Key 无权操作该设备 | 在 Dot 后台确认绑定关系 |
