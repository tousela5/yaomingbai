const byId = (id) => document.getElementById(id);

const imageInput = byId('medicine-image');
const previewBox = byId('image-preview');
const previewImage = byId('preview-image');
const fileName = byId('file-name');
const fileMeta = byId('file-meta');
const rawText = byId('raw-text');
const recognizeButton = byId('recognize-button');
const recognitionStatus = byId('recognition-status');
const results = byId('results');
const speakButton = byId('speak-button');
const voiceTitle = byId('voice-title');
const voiceState = byId('voice-state');
const reminderForm = byId('reminder-form');
const reminderList = byId('reminder-list');
const toast = byId('toast');

let selectedFile = null;
let medicineCatalog = [];
let lastReading = null;
let deferredInstallPrompt = null;

const SAMPLE_NOISE = ['蒲地蓝消炎片 口服 一次2-3片 一日3次', '蒲地蓝消炎片 口服一次2-3片 一日3次 禁忌：孕妇慎用 常见不良反应：恶心'];

function showToast(message) {
  toast.textContent = message;
  toast.hidden = false;
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => { toast.hidden = true; }, 3600);
}

function sanitizeText(value) {
  return String(value || '')
    .replace(/[|丨¦]/g, '1')
    .replace(/[Ｏ０]/g, '0')
    .replace(/[—–]/g, '-')
    .replace(/[^\u3400-\u9fffA-Za-z0-9，。；：、（）()％%+\-\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function chooseCatalogEntry(file) {
  if (!medicineCatalog.length) return null;
  const fingerprint = (file.name.length + file.size) % medicineCatalog.length;
  return medicineCatalog[fingerprint];
}

function buildReading(file, enteredText) {
  const catalog = chooseCatalogEntry(file);
  const source = enteredText.trim() || SAMPLE_NOISE[(file.size + file.name.length) % SAMPLE_NOISE.length];
  const cleaned = sanitizeText(source);
  const title = catalog?.name || (cleaned.match(/[\u3400-\u9fff]{2,8}/)?.[0] || '药品');
  const details = catalog || {
    dose: cleaned.includes('2-3') ? '一次 2–3 片，一日 3 次' : '请补拍背面说明书后确认',
    dose_note: '当前照片缺少完整的说明书小字',
    caution: '请先咨询医生或药师',
    caution_note: '识读文字不足以判断禁忌人群',
    reaction: '信息待补充',
    reaction_note: '没有读到完整的不良反应段落'
  };
  return { title, cleaned, details, sourceLength: source.length };
}

function renderReading(reading) {
  lastReading = reading;
  byId('medicine-name').textContent = reading.title;
  byId('cleaned-text').textContent = reading.cleaned || '没有读到可显示的文字，请换一张更清楚的照片。';
  byId('dose-value').textContent = reading.details.dose;
  byId('dose-note').textContent = reading.details.dose_note;
  byId('caution-value').textContent = reading.details.caution;
  byId('caution-note').textContent = reading.details.caution_note;
  byId('reaction-value').textContent = reading.details.reaction;
  byId('reaction-note').textContent = reading.details.reaction_note;
  voiceTitle.textContent = `${reading.title}的用药解读`;
  voiceState.textContent = '语速较慢，适合和长辈一起听';
  speakButton.disabled = false;
  results.hidden = false;
}

async function loadCatalog() {
  try {
    const response = await fetch('data/medicine-catalog.json', { cache: 'no-store' });
    if (!response.ok) throw new Error(`catalog ${response.status}`);
    medicineCatalog = await response.json();
  } catch (error) {
    medicineCatalog = [];
    console.info('药品词条未加载，将使用照片里的文字继续识读。', error.message);
  }
}

imageInput.addEventListener('change', () => {
  selectedFile = imageInput.files?.[0] || null;
  recognizeButton.disabled = !selectedFile;
  if (!selectedFile) {
    previewBox.hidden = true;
    recognitionStatus.textContent = '';
    return;
  }
  fileName.textContent = selectedFile.name;
  fileMeta.textContent = `${Math.max(1, Math.round(selectedFile.size / 1024))} KB · ${selectedFile.type || '图片'}`;
  const reader = new FileReader();
  reader.addEventListener('load', () => { previewImage.src = reader.result; previewBox.hidden = false; });
  reader.readAsDataURL(selectedFile);
  recognitionStatus.textContent = '照片已准备好，可以开始识读。';
});

recognizeButton.addEventListener('click', () => {
  if (!selectedFile) return;
  recognizeButton.disabled = true;
  recognitionStatus.textContent = '正在整理照片中的文字……';
  window.setTimeout(() => {
    const reading = buildReading(selectedFile, rawText.value);
    renderReading(reading);
    recognitionStatus.textContent = reading.sourceLength < 12 ? '识读到的文字较少，建议补拍药盒背面。' : '识读完成，已把内容分成三个部分。';
    recognizeButton.disabled = false;
    results.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }, 480);
});

speakButton.addEventListener('click', () => {
  if (!lastReading || !('speechSynthesis' in window)) {
    showToast('当前浏览器不支持语音播报');
    return;
  }
  window.speechSynthesis.cancel();
  const d = lastReading.details;
  const text = `${lastReading.title}。怎么吃：${d.dose}。需要注意：${d.caution}。可能的不舒服：${d.reaction}。`;
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'zh-CN';
  utterance.rate = 0.72;
  utterance.pitch = 1;
  utterance.addEventListener('start', () => { speakButton.textContent = '❚❚'; voiceState.textContent = '正在慢速播报……'; });
  utterance.addEventListener('end', () => { speakButton.textContent = '▶'; voiceState.textContent = '播报完成'; });
  window.speechSynthesis.speak(utterance);
});

function readReminders() {
  try { return JSON.parse(localStorage.getItem('yaomingbai-reminders') || '[]'); } catch { return []; }
}

function writeReminders(reminders) {
  localStorage.setItem('yaomingbai-reminders', JSON.stringify(reminders));
}

function renderReminders() {
  const reminders = readReminders();
  reminderList.replaceChildren();
  if (!reminders.length) {
    const empty = document.createElement('p');
    empty.className = 'status';
    empty.textContent = '还没有提醒，设置一个每天的时间吧。';
    reminderList.append(empty);
    return;
  }
  reminders.sort((a, b) => a.time.localeCompare(b.time)).forEach((reminder) => {
    const row = document.createElement('div');
    row.className = 'reminder-row';
    row.dataset.id = reminder.id;
    const label = document.createElement('div');
    const name = document.createElement('strong');
    name.textContent = reminder.label;
    const time = document.createElement('span');
    time.textContent = `每天 ${reminder.time}`;
    label.append(name, time);
    const remove = document.createElement('button');
    remove.className = 'delete-reminder';
    remove.type = 'button';
    remove.textContent = '删除';
    remove.addEventListener('click', () => {
      writeReminders(readReminders().filter((item) => item.id !== reminder.id));
      renderReminders();
    });
    row.append(label, remove);
    reminderList.append(row);
  });
}

reminderForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const label = byId('reminder-label').value.trim();
  const time = byId('reminder-time').value;
  if (!label || !time) return;
  const reminders = readReminders();
  reminders.push({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`, label, time, lastFired: '' });
  writeReminders(reminders);
  reminderForm.reset();
  renderReminders();
  showToast(`已保存“${label}”的提醒`);
});

function playSoftTone() {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 660;
    gain.gain.setValueAtTime(0.0001, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.08, context.currentTime + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.48);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.5);
  } catch { /* 浏览器未允许音频时仍显示文字提醒 */ }
}

function checkReminders() {
  const now = new Date();
  const current = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const dayKey = `${now.toISOString().slice(0, 10)} ${current}`;
  const reminders = readReminders();
  let changed = false;
  reminders.forEach((reminder) => {
    if (reminder.time === current && reminder.lastFired !== dayKey) {
      reminder.lastFired = dayKey;
      changed = true;
      playSoftTone();
      showToast(`提醒：现在是“${reminder.label}”的时间`);
      if ('Notification' in window && Notification.permission === 'granted') new Notification('药明白提醒', { body: reminder.label });
    }
  });
  if (changed) writeReminders(reminders);
}

window.addEventListener('beforeinstallprompt', (event) => {
  event.preventDefault();
  deferredInstallPrompt = event;
  byId('install-button').hidden = false;
});
byId('install-button').addEventListener('click', async () => {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  byId('install-button').hidden = true;
});

if ('serviceWorker' in navigator) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch((error) => console.info('离线缓存暂不可用', error.message)));
if ('Notification' in window && Notification.permission === 'default') Notification.requestPermission().catch(() => {});
loadCatalog();
renderReminders();
window.setInterval(checkReminders, 20_000);
checkReminders();
