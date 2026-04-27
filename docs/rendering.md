# 图片渲染方案（方案 B：satori + resvg-wasm）

## 选型对比

| 方案 | 真浏览器 | Workers 兼容 | 速度 | 费用 | 适合场景 |
|------|---------|-------------|------|------|---------|
| A. Cloudflare Browser Rendering | ✅ | ✅ | 数百 ms～1s | Workers Paid + 配额 | 渲染任意外部网页 / 完整 CSS / JS 驱动 |
| **B. satori + resvg-wasm（当选）** | ❌ | ✅ | 几十 ms | 免费 | 卡片式自渲染数据 |
| C. SVG `<foreignObject>` + resvg | ❌ | ✅ | 几十 ms | 免费 | 不推荐：text 渲染常出错 |

296×152 单色（最终 dither 成黑白）的 usage 卡片完全不需要真浏览器，方案 B 在
本地与 Workers 跑同一份代码，零差异，且无付费门槛。日后若需要嵌入 Grafana 等
外部网页截图，再叠加方案 A。

## 渲染管线

```
UsageData (业务数据)
   │
   ▼  buildTree(data)  —— 普通 JS 对象树（非 JSX，不依赖 React）
{ type, props: { style, children } }
   │
   ▼  satori(tree, { width:296, height:152, fonts })
   SVG 字符串
   │
   ▼  new Resvg(svg, { background:'white', fitTo:{ mode:'width', value:296 }})
   .render().asPng() → Uint8Array (PNG bytes)
   │
   ▼  pngBytesToBase64
   string (base64) → DotClient.pushImage
```

### 关键约束

- **尺寸**：`CARD_WIDTH = 296`、`CARD_HEIGHT = 152`，常量定义在 `src/render.ts`。
- **字体**：satori 必须提供 **静态 TTF**（不支持 variable font）。
  推荐 Inter 静态字重，文件命名 `assets/fonts/Regular.ttf`、`Bold.ttf`，
  字体不入仓库（`.gitignore`），需各环境自行准备。
- **flex 布局**：satori 实现 yoga 子集，**所有含子节点的容器必须显式
  `display: 'flex'`**；不支持 grid / float / 多数 CSS。
- **不支持 JS**：buildTree 是纯数据驱动的对象树。
- **resvg 单例初始化**：`ensureResvgInit(wasm)` 内部用 `resvgReady` 标志保证
  `initWasm` 只调一次，避免重复初始化报错。

## 当前模板（src/render.ts buildTree）

296×152 卡片，自上而下：

```
┌──────────────────────────────────────┐
│ AI USAGE · TODAY      (10px, 字距 1.2)│
│                                      │
│ $12.34                (38px, 700)    │
│ Anthropic + OpenAI · 24h (11px)      │
│                                      │
│  IN     OUT    CALLS     12:30       │
│  1.2M   345K   128       (右下时间)   │
└──────────────────────────────────────┘
```

字段定义：

```ts
interface UsageData {
  title: string;           // 顶部小字
  primary: string;         // 主数字
  secondary?: string;      // 副标题
  stats?: { label: string; value: string }[];  // 底部一排小卡
  updatedAt?: string;      // 右下角时间
}
```

## 后续可调优点

- 视觉适配 e-paper：黑白二值最终经 dither，灰度信息会丢失，应避免依赖 opacity；
  当前模板已用纯黑实现层级（仅靠字号 / 字重 / 字距区分）。
- Inter 字体的中文字符缺失；如要展示中文，需额外加载思源黑体子集。
- `border: 1`（黑边框）配合白底卡片效果待实测。
- Dither 算法：默认 `FLOYD_STEINBERG`，对小字号易产生噪点；若需可换 `ATKINSON`。
