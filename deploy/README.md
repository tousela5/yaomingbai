# 发布记录

- **托管方式**：GitHub Pages（由 `.github/workflows/pages.yml` 按 `main` 分支自动发布）
- **稳定访问地址**：<https://tousela5.github.io/yaomingbai/>
- **地址清单**：`deploy/public-url.txt`
- **本地结构**：发布的是项目根目录，不会用 `scaffold/` 的示例页面覆盖首页。

## 复核发布结果

先确认静态文件和 PWA 清单完整：

```bash
npm run release:check
```

再从公网逐项请求首页、脚本、药品词条、Service Worker、图标以及原有的测试素材：

```bash
npm run release:verify
```

`release:verify` 不修改浏览器数据，也不会上传药盒照片到应用；它只读取公开 URL 的 HTTP 响应。

## 后续发布与回滚

1. 将修改提交并推送到 `main`。
2. 在仓库 Actions 中等待“发布药明白到 GitHub Pages”完成。
3. 用 `npm run release:verify` 检查新版本；若失败，先查看对应的 Pages deployment 日志。
4. 回滚到上一个已知正常的 `main` 提交并重新推送即可。

## 使用边界

这是纯静态 PWA：照片在浏览器本机处理，提醒保存在本机 `localStorage`。页面需要保持打开（或保持已安装的应用页面运行）才能在设定分钟检查提醒；它不是后台推送服务。语音播报依赖手机浏览器的 Web Speech API。首次访问公网 HTTPS 地址后，支持的浏览器会显示“添加到桌面”。iPhone 可使用 Safari 的“分享 → 添加到主屏幕”。
