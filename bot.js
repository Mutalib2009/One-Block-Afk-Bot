const mineflayer = require('mineflayer');
const config     = require('./config');

// ── Renklı log ──────────────────────────────────────────────────────────────
const C = { reset:'\x1b[0m', red:'\x1b[31m', green:'\x1b[32m', yellow:'\x1b[33m', cyan:'\x1b[36m', magenta:'\x1b[35m' };
const now = () => new Date().toLocaleTimeString('tr-TR');
const L = {
  info  : (m) => console.log(`${C.cyan}[${now()}] ℹ  ${m}${C.reset}`),
  ok    : (m) => console.log(`${C.green}[${now()}] ✔  ${m}${C.reset}`),
  warn  : (m) => console.log(`${C.yellow}[${now()}] ⚠  ${m}${C.reset}`),
  err   : (m) => console.log(`${C.red}[${now()}] ✖  ${m}${C.reset}`),
  chat  : (m) => console.log(`${C.magenta}[${now()}] 💬 ${m}${C.reset}`),
};

// ── Durum ───────────────────────────────────────────────────────────────────
let bot            = null;
let afkTimer       = null;
let statusTimer    = null;
let reconnectTimer = null;
let attempt        = 0;
let alive          = false;
let startedAt      = null;

// ── Yardımcılar ─────────────────────────────────────────────────────────────
const sleep = ms => new Promise(r => setTimeout(r, ms));

function uptime() {
  if (!startedAt) return '0sn';
  const s = Math.floor((Date.now() - startedAt) / 1000);
  const m = Math.floor(s / 60), h = Math.floor(m / 60);
  if (h)  return `${h}s ${m % 60}d`;
  if (m)  return `${m}d ${s % 60}sn`;
  return `${s}sn`;
}

function say(msg) {
  try { bot?.chat(msg); } catch (_) {}
}

// ── Ana bağlantı fonksiyonu ─────────────────────────────────────────────────
function connect() {
  if (reconnectTimer) { clearTimeout(reconnectTimer); reconnectTimer = null; }

  attempt++;
  L.info(`Bağlanılıyor → ${config.host}:${config.port}  (Deneme ${attempt})`);

  try {
    bot = mineflayer.createBot({
      host          : config.host,
      port          : config.port,
      username      : config.username,
      version       : config.version,      // config.js'de doğru versiyon yazılmalı!
      auth          : 'offline',
      hideErrors    : false,
    });
  } catch (e) {
    L.err(`Bot oluşturulamadı: ${e.message}`);
    scheduleReconnect();
    return;
  }

  // ── Eventler ──────────────────────────────────────────────────────────────

  bot.on('login', () => {
    L.ok('Sunucuya giriş yapıldı (login)!');
  });

  bot.once('spawn', () => {
    alive     = true;
    startedAt = Date.now();
    attempt   = 0;

    const pos = bot.entity.position;
    L.ok(`Spawn oldu! X:${~~pos.x} Y:${~~pos.y} Z:${~~pos.z} | Versiyon: ${bot.version}`);

    setTimeout(() => say(config.spawnMsg || 'MarvisBot aktif! !yardim yaz.'), 2000);

    startAfk();
    startStatus();
  });

  bot.on('chat', handleChat);

  bot.on('death', () => {
    L.warn('Bot öldü, respawn yapıyor...');
    setTimeout(() => { try { bot.respawn(); } catch(_){} }, 1000);
  });

  bot.on('kicked', (reason) => {
    alive = false;
    let r = reason;
    try { r = JSON.parse(reason)?.text ?? reason; } catch(_){}
    L.warn(`Sunucudan atıldı: ${r}`);
  });

  bot.on('error', (err) => {
    // Sadece önemli hataları logla
    const code = err.code ?? '';
    if (code === 'ECONNREFUSED') {
      L.warn('Bağlantı reddedildi — sunucu kapalı olabilir.');
    } else if (code === 'ETIMEDOUT' || code === 'ESOCKETTIMEDOUT') {
      L.warn('Bağlantı zaman aşımı.');
    } else if (code === 'ENOTFOUND') {
      L.warn('Sunucu adresi bulunamadı — host adresini kontrol et.');
    } else {
      L.err(`Hata [${code}]: ${err.message}`);
    }
  });

  bot.on('end', (reason) => {
    stopAfk();
    alive = false;
    L.warn(`Bağlantı kesildi. Sebep: ${reason ?? 'bilinmiyor'}`);
    scheduleReconnect();
  });
}

// ── Yeniden bağlan ──────────────────────────────────────────────────────────
function scheduleReconnect() {
  const delay = Math.min(10000 * attempt, 120000);  // maks 2 dakika
  L.info(`${delay / 1000} saniye sonra yeniden bağlanılacak...`);
  reconnectTimer = setTimeout(connect, delay);
}

// ── Anti-AFK sistemi ────────────────────────────────────────────────────────
const MOVES = [
  () => walk('forward',  1200),
  () => walk('back',     900),
  () => walk('left',     700),
  () => walk('right',    700),
  () => jump(),
  () => lookRandom(),
  () => spin(),
  () => sneak(),
];

function walk(dir, ms) {
  bot.setControlState(dir, true);
  setTimeout(() => { try { bot.setControlState(dir, false); } catch(_){} }, ms);
  L.info(`Hareket: ${dir} (${ms}ms)`);
}

function jump() {
  bot.setControlState('jump', true);
  setTimeout(() => { try { bot.setControlState('jump', false); } catch(_){} }, 500);
  L.info('Zıpladı');
}

function lookRandom() {
  const yaw   = (Math.random() * 360 - 180) * (Math.PI / 180);
  const pitch = (Math.random() * 60 - 30)   * (Math.PI / 180);
  try { bot.look(yaw, pitch, false); } catch(_){}
  L.info('Etrafına baktı');
}

function spin() {
  let step = 0;
  const iv = setInterval(() => {
    if (!alive || step++ >= 8) { clearInterval(iv); return; }
    try { bot.look(bot.entity.yaw + Math.PI / 4, 0, false); } catch(_){}
  }, 250);
  L.info('Döndü');
}

function sneak() {
  bot.setControlState('sneak', true);
  setTimeout(() => { try { bot.setControlState('sneak', false); } catch(_){} }, 800);
  L.info('Sindi');
}

function startAfk() {
  stopAfk();
  const interval = config.afkInterval ?? 12000;
  afkTimer = setInterval(() => {
    if (!alive || !bot?.entity) return;
    try {
      const fn = MOVES[Math.floor(Math.random() * MOVES.length)];
      fn();
    } catch(_) {}
  }, interval);
  L.info(`Anti-AFK başladı (her ${interval/1000}sn)`);
}

function stopAfk() {
  clearInterval(afkTimer);
  clearInterval(statusTimer);
  afkTimer    = null;
  statusTimer = null;
}

// ── Durum raporu ────────────────────────────────────────────────────────────
function startStatus() {
  statusTimer = setInterval(() => {
    if (!alive || !bot?.entity) return;
    const pos = bot.entity.position;
    const p   = Object.keys(bot.players ?? {}).length;
    L.info(`[DURUM] Uptime: ${uptime()} | Oyuncular: ${p} | HP: ${bot.health ?? '?'} | X:${~~pos.x} Y:${~~pos.y} Z:${~~pos.z}`);
  }, config.statusInterval ?? 60000);
}

// ── Sohbet komutları ────────────────────────────────────────────────────────
function handleChat(username, message) {
  if (username === bot.username) return;
  L.chat(`${username}: ${message}`);

  if (!message.startsWith('!')) return;
  const [cmd, ...args] = message.slice(1).trim().split(/\s+/);

  const isAdmin = config.admins.length === 0 || config.admins.includes(username);

  switch (cmd.toLowerCase()) {
    case 'yardim':
    case 'help':
      say('Komutlar: !durum !oyuncular !konum !dur !baslat !ping');
      break;

    case 'durum':
      say(`HP:${bot.health?.toFixed(0)} Yemek:${bot.food} Uptime:${uptime()} Oyuncu:${Object.keys(bot.players??{}).length}`);
      break;

    case 'oyuncular':
      say('Sunucuda: ' + (Object.keys(bot.players ?? {}).join(', ') || 'kimse yok'));
      break;

    case 'konum': {
      const p = bot.entity?.position;
      say(p ? `X:${~~p.x} Y:${~~p.y} Z:${~~p.z}` : 'Konum bilinmiyor');
      break;
    }

    case 'ping':
      say(`Pong! ${bot.player?.ping ?? '?'}ms`);
      break;

    case 'dur':
      if (!isAdmin) { say('Yetkin yok!'); return; }
      stopAfk();
      say('Anti-AFK durduruldu.');
      break;

    case 'baslat':
      if (!isAdmin) { say('Yetkin yok!'); return; }
      startAfk();
      say('Anti-AFK başlatıldı.');
      break;

    case 'yeniden':
      if (!isAdmin) { say('Yetkin yok!'); return; }
      say('Yeniden bağlanılıyor...');
      setTimeout(() => bot.quit(), 500);
      break;
  }
}

// ── İşlem çıkış ─────────────────────────────────────────────────────────────
process.on('SIGINT', () => {
  L.warn('Kapatılıyor...');
  try { bot?.quit('Kapatıldı'); } catch(_) {}
  process.exit(0);
});

process.on('uncaughtException', (e) => {
  L.err(`Kritik hata: ${e.message}`);
});

process.on('unhandledRejection', (e) => {
  L.err(`İşlenmemiş promise: ${e}`);
});

// ── Başlat ──────────────────────────────────────────────────────────────────
console.log('\x1b[36m');
console.log(' ███╗   ███╗ █████╗ ██████╗ ██╗   ██╗██╗███████╗');
console.log(' ████╗ ████║██╔══██╗██╔══██╗██║   ██║██║██╔════╝');
console.log(' ██╔████╔██║███████║██████╔╝██║   ██║██║███████╗');
console.log(' ██║╚██╔╝██║██╔══██║██╔══██╗╚██╗ ██╔╝██║╚════██║');
console.log(' ██║ ╚═╝ ██║██║  ██║██║  ██║ ╚████╔╝ ██║███████║');
console.log(' ╚═╝     ╚═╝╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚══════╝');
console.log('              AFKBot v3.0\x1b[0m\n');
L.info(`Host   : ${config.host}:${config.port}`);
L.info(`User   : ${config.username}`);
L.info(`Version: ${config.version}`);
L.info(`Admins : ${config.admins.join(', ') || 'Herkese açık'}`);
console.log('');

connect();
