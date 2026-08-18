# 药明白

药明白是一个不依赖后端的静态网页工具，面向需要更大文字、更慢语速的长辈。它把药盒照片中的文字整理成「怎么吃」「需要注意」「可能的不舒服」三块，也可以用浏览器语音播报并在本机保存每日提醒。

## 公网访问

当前已发布到 GitHub Pages：

**<https://tousela5.github.io/yaomingbai/>**

这个地址使用 HTTPS，适合长期收藏，也满足 Service Worker 和 PWA 安装所需的安全上下文。发布工作流在 `.github/workflows/pages.yml`；推送到 `main` 后会自动发布项目根目录，因此首页、药品词条、离线脚本和现有复核素材使用的相对路径不会改变。

长辈可以在手机浏览器打开上面的地址后添加到桌面：Android/Chrome 使用页面里的“添加到桌面”（若浏览器提供），iPhone/Safari 使用“分享 → 添加到主屏幕”。首次安装后，应用会使用 `manifest.json` 中的名称、颜色和图标。

## 发布前后复核

```bash
# 检查本地入口、三项功能标记、PWA 图标和原有素材
npm run release:check

# 从公网检查首页、静态资源、Service Worker、药品词条和复核素材
npm run release:verify
```

发布记录和回滚说明见 [`deploy/README.md`](deploy/README.md)，稳定地址单独记录在 [`deploy/public-url.txt`](deploy/public-url.txt)。

## 本地预览

在项目目录执行：

```bash
npm run serve
```

然后用浏览器打开 `http://localhost:8080`。药品词条在 `data/medicine-catalog.json`，提醒保存在浏览器的 localStorage 中，照片不会上传。

## 文件说明

- `index.html`：页面结构和三项功能入口。
- `app.js`：图片选择、文字整理、语音播报和提醒状态。
- `styles.css`：适老化字号、低饱和绿色和移动端布局。
- `manifest.json`、`icons/`、`sw.js`：可添加到桌面的 PWA 清单、图标与离线缓存。
- `test-input/`、`evidence/`、`source/`：保留的本地测试输入、截图和原始素材，没有被发布流程删除。

## 使用边界

照片只在当前浏览器中处理，提醒只保存在当前设备；提醒检查需要页面或已安装的应用页面保持运行，不能替代系统级后台推送。识读结果仅作说明书文字整理，不能代替医生或药师的判断；语音播报是否可用取决于浏览器的 Web Speech API。
