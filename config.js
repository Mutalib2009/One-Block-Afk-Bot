// ══════════════════════════════════════════════
//   MARVİS AFKBot - Yapılandırma Dosyası
//   Buradan tüm ayarları değiştirebilirsin!
// ══════════════════════════════════════════════

module.exports = {

  // ── Sunucu Bağlantısı ─────────────────────────────────────────────
  host: 'majesteminecraft.aternos.me',  // ← Aternos adresini buraya yaz
  port: 34482,                            // Varsayılan Minecraft portu
  username: 'MarvisBot',                  // Botun kullanıcı adı
  version: 26.1.2,                         // false = otomatik algıla, ya da '1.20.1' gibi yaz
  auth: 'offline',                        // 'offline' = cracked | 'microsoft' = premium hesap

  // ── Yönetici Oyuncular ────────────────────────────────────────────
  // Bot komutlarını sadece bu kullanıcılar kullanabilir (boş bırakırsan herkes kullanır)
  adminPlayers: ['Senin_Kullanici_Adin'],

  // ── Sohbet Ayarları ───────────────────────────────────────────────
  commandPrefix: '!',                    // Komut ön eki
  loginMessage: 'Marvis Bot aktif! Komutlar için !yardım yaz.',
  respawnMessage: 'Yeniden doğdum, devam ediyorum!',

  // ── Anti-AFK Ayarları ─────────────────────────────────────────────
  afkInterval: 15000,      // Her kaç ms'de bir hareket etsin? (15000 = 15 saniye)
  walkRadius: 8,           // Kaç blok yarıçapında gezsin?

  // ── Sağlık Uyarısı ────────────────────────────────────────────────
  lowHealthWarning: 6,     // Can bu değerin altına düşünce uyarı ver

  // ── Yeniden Bağlanma ──────────────────────────────────────────────
  reconnectDelay: 10000,           // İlk yeniden bağlanma bekleme süresi (ms)
  maxReconnectAttempts: 999,       // Maksimum deneme (999 = neredeyse sonsuz)

  // ── Durum Raporu ──────────────────────────────────────────────────
  statusInterval: 60000,           // Konsolda durum raporu aralığı (ms)

};
