module.exports = {
  // ─────────────────────────────────────────────────────────────────────────
  //  BURASI ÖNEMLİ — Doğru doldurmadan çalışmaz!
  // ─────────────────────────────────────────────────────────────────────────

  host    : 'majesteminecraft.aternos.me',   // Aternos adresi (örn: majesteminecraft.aternos.me)
  port    : 34482,                  // Aternos'ta özel port varsa onu yaz (örn: 34482)
  username: 'MarvisBot',            // Botun adı (whitelist varsa bunu ekle!)
  version : '1.21.1',              // Aternos panelindeki EXACT versiyon (örn: 1.20.1)

  // ─────────────────────────────────────────────────────────────────────────
  //  Admin listesi — bu oyuncular !dur !baslat !yeniden komutlarını kullanır
  //  Boş bırakırsan herkes kullanabilir
  // ─────────────────────────────────────────────────────────────────────────
  admins: ['.bnumuttt'],

  // ─────────────────────────────────────────────────────────────────────────
  //  Genel ayarlar (değiştirmek zorunda değilsin)
  // ─────────────────────────────────────────────────────────────────────────
  spawnMsg       : 'MarvisBot aktif! !yardim yaz.',
  afkInterval    : 12000,    // ms — her 12sn'de bir hareket
  statusInterval : 60000,    // ms — her 1dk'da bir konsola durum yaz
};
