const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const markerPath = path.join(root, 'deploy', 'public-url.txt');
const markerUrl = fs.existsSync(markerPath) ? fs.readFileSync(markerPath, 'utf8').trim() : '';
const inputUrl = process.argv[2] || markerUrl;

if (!inputUrl) {
  console.error('用法：npm run release:verify -- [公网地址]');
  process.exit(1);
}

let base;
try {
  base = new URL(inputUrl.endsWith('/') ? inputUrl : `${inputUrl}/`);
  if (base.protocol !== 'https:') throw new Error('地址必须使用 HTTPS');
} catch (error) {
  console.error(`公网地址无效：${error.message}`);
  process.exit(1);
}

const resources = [
  'index.html',
  'styles.css',
  'app.js',
  'manifest.json',
  'sw.js',
  'data/medicine-catalog.json',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'test-input/pudilan-substitute.jpg',
  'evidence/home.jpeg',
  'evidence/recognition-demo.jpeg'
];

async function fetchResource(relativePath) {
  const url = new URL(relativePath, base);
  const response = await fetch(url, {
    redirect: 'follow',
    signal: AbortSignal.timeout(20_000)
  });
  if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
  return { url, response, body: relativePath.endsWith('.png') || relativePath.endsWith('.jpg') ? null : await response.text() };
}

(async () => {
  const failures = [];
  const fetched = new Map();
  for (const resource of resources) {
    try {
      fetched.set(resource, await fetchResource(resource));
      console.log(`✓ ${resource}`);
    } catch (error) {
      failures.push(`${resource}: ${error.message}`);
      console.error(`✗ ${resource}: ${error.message}`);
    }
  }

  const html = fetched.get('index.html')?.body || '';
  for (const marker of ['id="recognition"', 'id="voice"', 'id="reminder"', 'medicine-image', 'speak-button', 'reminder-form']) {
    if (!html.includes(marker)) failures.push(`首页缺少功能标记：${marker}`);
  }

  const appText = fetched.get('app.js')?.body || '';
  for (const marker of ['FileReader', 'speechSynthesis', 'localStorage', 'checkReminders', 'beforeinstallprompt']) {
    if (!appText.includes(marker)) failures.push(`公网脚本缺少功能逻辑：${marker}`);
  }

  const manifestText = fetched.get('manifest.json')?.body;
  if (manifestText) {
    try {
      const manifest = JSON.parse(manifestText);
      if (!Array.isArray(manifest.icons) || manifest.icons.length < 2) failures.push('公网 manifest 没有完整图标列表。');
    } catch (error) {
      failures.push(`公网 manifest 不是有效 JSON：${error.message}`);
    }
  }

  const catalogText = fetched.get('data/medicine-catalog.json')?.body;
  if (catalogText) {
    try {
      const catalog = JSON.parse(catalogText);
      if (!Array.isArray(catalog) || !catalog.length) failures.push('公网药品词条为空。');
    } catch (error) {
      failures.push(`公网药品词条不是有效 JSON：${error.message}`);
    }
  }

  if (failures.length) {
    console.error(`\n公网复核未通过（${failures.length} 项）：`);
    failures.forEach((failure) => console.error(`- ${failure}`));
    process.exitCode = 1;
  } else {
    console.log(`\n公网复核通过：${base.href}`);
    console.log('首页、三项功能标记、PWA 资源和现有复核素材均可访问。');
  }
})().catch((error) => {
  console.error(`公网复核失败：${error.message}`);
  process.exitCode = 1;
});
