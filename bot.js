const mineflayer = require('mineflayer');
const { pathfinder, Movements, goals } = require('mineflayer-pathfinder');
const config = require('./config');

// ─── Renkli log sistemi ────────────────────────────────────────────────────
const log = {
  info:    (msg) => console.log(`\x1b[36m[${time()}] [BİLGİ]\x1b[0m ${msg}`),
  success: (msg) => console.log(`\x1b[32m[${time()}] [TAMAM]\x1b[0m ${msg}`),
  warn:    (msg) => console.log(`\x1b[33m[${time()}] [UYARI]\x1b[0m ${msg}`),
  error:   (msg) => console.log(`\x1b[31m[${time()}] [HATA]\x1b[0m ${msg}`),
  chat:    (msg) => console.log(`\x1b[35m[${time()}] [SOHBET]\x1b[0m ${msg}`),
};

function time() {
  return new Date().toLocaleTimeString('tr-TR');
}

// ─── Durum değişkenleri ────────────────────────────────────────────────────
let bot;
let reconnectAttempt = 0;
let afkInterval      = null;
let statusInterval   = null;
let isConnected      = false;
let startTime        = null;

// ─── Bot oluştur ───────────────────────────────────────────────────────────
function createBot() {
  log.info(`Sunucuya bağlanılıyor: ${config.host}:${config.port} → Kullanıcı: ${config.username}`);

  bot = mineflayer.createBot({
    host:          config.host,
    port:          config.port,
    username:      config.username,
    version:       config.version || false,
    auth:          config.auth || 'offline',
    checkTimeoutInterval: 30000,
    keepAlive:     true,
  });

  bot.loadPlugin(pathfinder);

  // ── Bağlantı olayları ──────────────────────────────────────────────────
  bot.once('spawn', onSpawn);
  bot.on('chat', onChat);
  bot.on('kicked', onKicked);
  bot.on('error', onError);
  bot.on('end', onEnd);
  bot.on('death', onDeath);
  bot.on('health', onHealth);
}

// ─── Spawn olayı ──────────────────────────────────────────────────────────
function onSpawn() {
  isConnected    = true;
  startTime      = Date.now();
  reconnectAttempt = 0;

  log.success(`Sunucuya bağlandı! Konum: ${fmtPos(bot.entity.position)}`);

  // Pathfinder hareketi ayarla
  const mcData   = require('minecraft-data')(bot.version);
  const movements = new Movements(bot, mcData);
  movements.canDig         = false;
  movements.allow1by1towers = false;
  bot.pathfinder.setMovements(movements);

  // Sunucuya giriş mesajı
  if (config.loginMessage) {
    setTimeout(() => safeSay(config.loginMessage), 2000);
  }

  // Anti-AFK döngüsünü başlat
  startAntiAfk();

  // Durum raporu döngüsünü başlat
  startStatusLoop();

  log.info('Anti-AFK sistemi aktif ✔');
}

// ─── Anti-AFK sistemi ──────────────────────────────────────────────────────
function startAntiAfk() {
  clearInterval(afkInterval);

  afkInterval = setInterval(() => {
    if (!isConnected || !bot?.entity) return;

    const action = weightedRandom([
      { fn: doRandomWalk,   weight: 35 },
      { fn: doLookAround,   weight: 25 },
      { fn: doJump,         weight: 15 },
      { fn: doSneak,        weight: 10 },
      { fn: doSwing,        weight: 10 },
      { fn: doRotateView,   weight: 5  },
    ]);

    try { action(); } catch (_) {}

  }, config.afkInterval || 15000);
}

// Anti-AFK eylemleri
function doRandomWalk() {
  const pos    = bot.entity.position;
  const radius = config.walkRadius || 10;
  const tx     = pos.x + randBetween(-radius, radius);
  const tz     = pos.z + randBetween(-radius, radius);

  const goal = new goals.GoalXZ(Math.floor(tx), Math.floor(tz));
  bot.pathfinder.setGoal(goal, true);
  log.info(`Yürüyüş: (${Math.floor(tx)}, ${Math.floor(tz)})`);
}

function doLookAround() {
  const yaw   = Math.random() * Math.PI * 2 - Math.PI;
  const pitch = randBetween(-0.5, 0.5);
  bot.look(yaw, pitch, false);
  log.info('Etrafına bakıyor...');
}

function doJump() {
  bot.setControlState('jump', true);
  setTimeout(() => bot.setControlState('jump', false), 600);
  log.info('Zıpladı!');
}

function doSneak() {
  bot.setControlState('sneak', true);
  setTimeout(() => bot.setControlState('sneak', false), randBetween(500, 2000));
  log.info('Sinerek hareket etti...');
}

function doSwing() {
  bot.swingArm('right');
  log.info('Kol salladı.');
}

function doRotateView() {
  let yaw = bot.entity.yaw;
  const steps = 8;
  let i = 0;
  const iv = setInterval(() => {
    if (i++ >= steps || !isConnected) { clearInterval(iv); return; }
    yaw += (Math.PI * 2) / steps;
    bot.look(yaw, 0, false);
  }, 300);
}

// ─── Durum raporu döngüsü ─────────────────────────────────────────────────
function startStatusLoop() {
  clearInterval(statusInterval);
  statusInterval = setInterval(() => {
    if (!isConnected || !bot?.entity) return;

    const players = Object.keys(bot.players).length;
    const uptime  = fmtUptime(Date.now() - startTime);
    const pos     = fmtPos(bot.entity.position);
    const hp      = bot.health?.toFixed(1) ?? '?';
    const food    = bot.food ?? '?';

    log.info(`━━ DURUM RAPORU ━━ Oyuncular: ${players} | HP: ${hp} | Yemek: ${food} | Konum: ${pos} | Uptime: ${uptime}`);
  }, config.statusInterval || 60000);
}

// ─── Sohbet komutları ─────────────────────────────────────────────────────
function onChat(username, message) {
  if (username === bot.username) return;
  log.chat(`${username}: ${message}`);

  const prefix = config.commandPrefix || '!';
  if (!message.startsWith(prefix)) return;

  const [cmd, ...args] = message.slice(prefix.length).trim().toLowerCase().split(/\s+/);

  // Sadece izin verilen oyuncular komut kullanabilsin
  if (config.adminPlayers.length > 0 && !config.adminPlayers.includes(username)) {
    if (['stop','restart','goto'].includes(cmd)) {
      safeSay(`${username}, bu komutu kullanma yetkin yok!`);
      return;
    }
  }

  switch (cmd) {
    case 'yardım':
    case 'help':
      safeSay(`§6[Marvis Bot] §fKomutlar: ${prefix}durum | ${prefix}oyuncular | ${prefix}konum | ${prefix}git <x> <z> | ${prefix}dur | ${prefix}yeniden | ${prefix}ping`);
      break;

    case 'durum':
    case 'status':
      const up = fmtUptime(Date.now() - startTime);
      safeSay(`§a[Marvis Bot] §fHP: ${bot.health?.toFixed(1)} | Yemek: ${bot.food} | Uptime: ${up} | Bağlı: ✔`);
      break;

    case 'oyuncular':
    case 'players':
      const list = Object.keys(bot.players).join(', ') || 'Kimse yok';
      safeSay(`§b[Marvis Bot] §fSunucudaki oyuncular: ${list}`);
      break;

    case 'konum':
    case 'pos':
      safeSay(`§e[Marvis Bot] §fKonum: ${fmtPos(bot.entity.position)}`);
      break;

    case 'git':
    case 'goto':
      if (args.length < 2) { safeSay('Kullanım: !git <x> <z>'); break; }
      const gx = parseInt(args[0]);
      const gz = parseInt(args[1]);
      if (isNaN(gx) || isNaN(gz)) { safeSay('Geçersiz koordinat!'); break; }
      bot.pathfinder.setGoal(new goals.GoalXZ(gx, gz));
      safeSay(`§a[Marvis Bot] §f(${gx}, ${gz}) konumuna gidiyorum!`);
      break;

    case 'dur':
    case 'stop':
      bot.pathfinder.setGoal(null);
      clearInterval(afkInterval);
      safeSay('§c[Marvis Bot] §fDurdum. Yeniden başlatmak için !yeniden kullan.');
      break;

    case 'yeniden':
    case 'restart':
      safeSay('§e[Marvis Bot] §fYeniden başlatılıyor...');
      setTimeout(() => { bot.quit(); }, 1000);
      break;

    case 'ping':
      safeSay(`§b[Marvis Bot] §fPong! 🏓 Gecikme: ${bot.player?.ping ?? '?'} ms`);
      break;

    case 'ver':
    case 'version':
      safeSay(`§d[Marvis Bot] §fMinecraft ${bot.version} | mineflayer`);
      break;

    default:
      safeSay(`§c[Marvis Bot] §fBilinmeyen komut: ${prefix}${cmd} — Yardım için: ${prefix}yardım`);
  }
}

// ─── Ölüm olayı ───────────────────────────────────────────────────────────
function onDeath() {
  log.warn('Bot öldü! Yeniden doğuyor...');
  bot.respawn?.();
  setTimeout(() => {
    if (config.respawnMessage) safeSay(config.respawnMessage);
  }, 2000);
}

// ─── Sağlık takibi ────────────────────────────────────────────────────────
function onHealth() {
  if (bot.health <= config.lowHealthWarning) {
    log.warn(`Düşük can: ${bot.health}`);
  }
}

// ─── Atılma / Hata / Bağlantı kesilmesi ──────────────────────────────────
function onKicked(reason) {
  isConnected = false;
  try {
    const parsed = JSON.parse(reason);
    log.warn(`Sunucudan atıldı: ${parsed?.text ?? reason}`);
  } catch {
    log.warn(`Sunucudan atıldı: ${reason}`);
  }
}

function onError(err) {
  if (err.code === 'ECONNREFUSED') {
    log.error('Bağlantı reddedildi. Sunucu kapalı olabilir.');
  } else {
    log.error(`Hata: ${err.message}`);
  }
}

function onEnd(reason) {
  isConnected = false;
  clearInterval(afkInterval);
  clearInterval(statusInterval);

  log.warn(`Bağlantı kesildi. Sebep: ${reason}`);
  scheduleReconnect();
}

// ─── Yeniden bağlanma mantığı ─────────────────────────────────────────────
function scheduleReconnect() {
  if (reconnectAttempt >= config.maxReconnectAttempts) {
    log.error(`Maksimum yeniden bağlanma denemesi aşıldı (${config.maxReconnectAttempts}). Duruluyor.`);
    process.exit(1);
  }

  reconnectAttempt++;
  const delay = Math.min(config.reconnectDelay * reconnectAttempt, 120000); // maks 2 dakika

  log.info(`${delay / 1000} saniye sonra yeniden bağlanılacak... (Deneme ${reconnectAttempt}/${config.maxReconnectAttempts})`);

  setTimeout(() => {
    log.info(`Yeniden bağlanılıyor... (${reconnectAttempt}. deneme)`);
    createBot();
  }, delay);
}

// ─── Yardımcı fonksiyonlar ────────────────────────────────────────────────
function safeSay(msg) {
  try { bot.chat(msg); } catch (_) {}
}

function fmtPos(pos) {
  if (!pos) return '?';
  return `X:${Math.floor(pos.x)} Y:${Math.floor(pos.y)} Z:${Math.floor(pos.z)}`;
}

function fmtUptime(ms) {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0)      return `${h}s ${m % 60}d ${s % 60}sn`;
  if (m > 0)      return `${m}d ${s % 60}sn`;
  return `${s}sn`;
}

function randBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function weightedRandom(items) {
  const total  = items.reduce((s, i) => s + i.weight, 0);
  let rand     = Math.random() * total;
  for (const item of items) {
    rand -= item.weight;
    if (rand <= 0) return item.fn;
  }
  return items[0].fn;
}

// ─── Çıkış sinyalleri ─────────────────────────────────────────────────────
process.on('SIGINT', () => {
  log.warn('Çıkış sinyali alındı. Bot kapatılıyor...');
  try { bot.quit('Bot kapatıldı'); } catch (_) {}
  process.exit(0);
});

process.on('uncaughtException', (err) => {
  log.error(`Beklenmeyen hata: ${err.message}`);
  if (!isConnected) scheduleReconnect();
});

// ─── Başlat ───────────────────────────────────────────────────────────────
console.log('\x1b[36m');
console.log('╔══════════════════════════════════════════╗');
console.log('║        MARVİS AFKBot  v2.0               ║');
console.log('║  Minecraft Sunucu Canlı Tutma Botu       ║');
console.log('╚══════════════════════════════════════════╝');
console.log('\x1b[0m');

createBot();
