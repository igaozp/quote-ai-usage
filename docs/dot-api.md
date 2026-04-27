# Dot Open Image API 摘要

官方文档：
<https://dot.mindreset.tech/api/doc/raw/service/open/image_api?locale=zh-Hans-CN>

## 端点

```
POST https://dot.mindreset.tech/api/authV2/open/device/:deviceId/image
```

| 项 | 值 |
|----|----|
| 方法 | POST |
| Content-Type | `application/json` |
| 认证 | `Authorization: Bearer dot_app_${API_KEY}` |
| 路径参数 | `deviceId`（设备序列号） |
| 限流 | 10 req/s |

> 注意 `Bearer` 后面的 token 必须是 `dot_app_` 前缀 + API Key 原始字符串
> 拼接而成。客户端在 `DotClient` 内部完成拼接，调用方只需传 API Key 本体。

## 请求体

| 字段 | 类型 | 必填 | 默认 | 说明 |
|------|------|------|------|------|
| `image` | string | ✅ | — | base64 编码的 PNG，**296×152 像素** |
| `refreshNow` | boolean | | `true` | 是否立即在屏幕上显示 |
| `link` | string | | — | 绑定的 http/https 或 scheme URL |
| `border` | 0 \| 1 | | 0 | 0 = 白色边框；1 = 黑色边框 |
| `ditherType` | string | | `DIFFUSION` | `DIFFUSION` / `ORDERED` / `NONE` |
| `ditherKernel` | string | | `FLOYD_STEINBERG` | 10 种算法之一 |
| `taskKey` | string | | — | 多内容时的目标 key |

`ditherKernel` 候选值：`FLOYD_STEINBERG` / `FALSE_FLOYD_STEINBERG` /
`JARVIS_JUDICE_NINKE` / `STUCKI` / `ATKINSON` / `BURKES` / `SIERRA` /
`TWO_ROW_SIERRA` / `SIERRA_LITE` / `BAYER`。

## 响应

```json
{
  "code": 200,
  "message": "设备图像API内容已切换",
  "result": { "message": "..." }
}
```

非成功响应：

| code | 含义 | 常见原因 |
|------|------|---------|
| 400 | 参数错误 | 图像格式无效 / border 非 0/1 |
| 403 | 权限不足 | API Key 无权操作该设备 |
| 404 | 不存在 | 设备未注册或 deviceId 错误 |
| 500 | 设备响应失败 | 设备离线 / 推送失败 |

## 客户端封装（src/dot-client.ts）

```ts
const client = new DotClient({ apiKey, baseUrl });
await client.pushImage(deviceId, {
  image: base64,            // 不含 data:image/png;base64, 前缀
  refreshNow: true,
  border: 0,
  ditherType: "DIFFUSION",
  ditherKernel: "FLOYD_STEINBERG",
});
```

错误处理三层都收敛为 `DotApiError`，携带 `status` / `code` / `body`：

1. HTTP 非 2xx
2. body 形态异常（缺 `code` 或 `message`）
3. `code !== 200`

`pngBytesToBase64(bytes: Uint8Array) → string`：仅依赖 Web 标准
`btoa`，分块（0x8000 字节）以避开 `String.fromCharCode.apply` 栈限制。

## cURL 示例

```bash
curl -X POST https://dot.mindreset.tech/api/authV2/open/device/${DEVICE_ID}/image \
  -H "Authorization: Bearer dot_app_${API_KEY}" \
  -H "Content-Type: application/json" \
  -d '{ "image": "<base64>", "border": 0, "ditherType": "DIFFUSION" }'
```
