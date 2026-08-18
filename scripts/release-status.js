const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const marker = path.join(root, 'deploy', 'public-url.txt');
const requiredFiles = [
  'index.html',
  'styles.css',
  'app.js',
  'manifest.json',
  'sw.js',
  'data/medicine-catalog.json',
  'icons/icon-192.png',
  'icons/icon-512.png'
];
const preservedDemoFiles = [
  'test-input/pudilan-substitute.jpg',
  'evidence/home.jpeg',
  'evidence/recognition-demo.jpeg',
  'source/yaomingbai.zip'
];

const errors = [];
const warnings = [];

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

if (!fs.existsSync(marker)) {
  errors.push('缺少 deploy/public-url.txt；发布后请写入稳定的 HTTPS 公网地址。');
}

let publicUrl = '';
if (fs.existsSync(marker)) {
  publicUrl = read('deploy/public-url.txt').trim();
  if (!publicUrl) {
    errors.push('deploy/public-url.txt 为空。');
  } else {
    try {
      const parsed = new URL(publicUrl);
      if (parsed.protocol !== 'https:') errors.push('公网地址必须使用 HTTPS，才能可靠启用 PWA 和语音/提醒能力。');
      if (parsed.username || parsed.password || parsed.search || parsed.hash) errors.push('公网地址不应包含账号、密码、查询参数或片段。');
      if (/^(localhost|127\.0\.0\.1|0\.0\.0\.0)$/i.test(parsed.hostname)) errors.push('公网地址不能是本机地址。');
    } catch {
      errors.push(`公网地址不是有效 URL：${publicUrl}`);
    }
  }
}

for (const relativePath of requiredFiles) {
  if (!exists(relativePath)) errors.push(`缺少发布所需文件：${relativePath}`);
}
for (const relativePath of preservedDemoFiles) {
  if (!exists(relativePath)) errors.push(`不能删除用于复核的本地素材：${relativePath}`);
}

if (exists('manifest.json')) {
  try {
    const manifest = JSON.parse(read('manifest.json'));
    if (!manifest.name || !manifest.short_name) errors.push('manifest.json 缺少应用名称。');
    if (manifest.start_url !== './index.html') warnings.push('manifest start_url 不是 ./index.html，请确认子路径部署时仍从应用首页启动。');
    if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) errors.push('manifest.json 至少需要 192x192 和 512x512 图标。');
    for (const icon of manifest.icons || []) {
      if (!icon.src || /^[a-z]+:/i.test(icon.src)) continue;
      const iconPath = path.posix.normalize(path.posix.join(path.posix.dirname('manifest.json'), icon.src));
      if (!exists(iconPath)) errors.push(`manifest 图标文件不存在：${icon.src}`);
    }
  } catch (error) {
    errors.push(`manifest.json 不是有效 JSON：${error.message}`);
  }
}

if (exists('index.html')) {
  const html = read('index.html');
  for (const markerText of ['id="recognition"', 'id="voice"', 'id="reminder"', 'manifest.json', 'app.js', 'styles.css']) {
    if (!html.includes(markerText)) errors.push(`首页缺少现有功能或资源标记：${markerText}`);
  }
}

if (exists('app.js')) {
  const app = read('app.js');
  for (const markerText of ['FileReader', 'speechSynthesis', 'localStorage', 'checkReminders', 'beforeinstallprompt']) {
    if (!app.includes(markerText)) errors.push(`页面脚本缺少现有功能逻辑：${markerText}`);
  }
}

if (errors.length) {
  console.error('发布检查未通过：');
  errors.forEach((message) => console.error(`- ${message}`));
  process.exitCode = 1;
} else {
  console.log('发布检查通过：静态入口、PWA 清单、离线脚本和核心资源齐全。');
  console.log(`已配置公网地址：${publicUrl}`);
  if (warnings.length) {
    console.warn('提示：');
    warnings.forEach((message) => console.warn(`- ${message}`));
  }
}
