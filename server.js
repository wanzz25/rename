/*
 * Wanzz Bot — Admin Panel Backend
 * Jalankan: node server.js
 * Port default: 3000
 * Letakkan file ini di folder bot (sama level dengan settings.js)
 */

const express  = require('express');
const fs       = require('fs');
const path     = require('path');
const cors     = require('cors');

const app  = express();
const PORT = process.env.PORT || 3000;

// Path ke settings.js bot — sesuaikan jika beda folder
const SETTINGS_PATH = path.join(__dirname, '..', 'settings.js');
const PANEL_PASS    = process.env.PANEL_PASS || 'wanzz2026'; // ganti di env

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ── MIDDLEWARE AUTH ──
function authMiddleware(req, res, next) {
  const token = req.headers['x-panel-token'];
  if (token !== PANEL_PASS) return res.status(401).json({ ok: false, msg: 'Unauthorized' });
  next();
}

// ── LOGIN ──
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  if (password === PANEL_PASS) {
    return res.json({ ok: true, token: PANEL_PASS });
  }
  return res.status(401).json({ ok: false, msg: 'Password salah!' });
});

// ── READ SETTINGS ──
app.get('/api/settings', authMiddleware, (req, res) => {
  try {
    const raw = fs.readFileSync(SETTINGS_PATH, 'utf8');

    // Parse field-field yang bisa diubah
    const fields = {};

    // Helper: ambil nilai string dari baris
    const getStr = (key) => {
      const rx = new RegExp(`(?:global\\.)?${key}\\s*=\\s*['\`]([^'\`]*)['\`]`);
      const m  = raw.match(rx);
      return m ? m[1] : '';
    };

    // Single fields
    ['owner','namaOwner','packname','botname','botname2',
     'namaSaluran','idSaluran','linkOwner','linkGrup','linkSaluran',
     'custompairing','dana','gopay','packsticker','delayJpm','delayPushkontak'
    ].forEach(k => { fields[k] = getStr(k); });

    // Harga
    const hPrem = raw.match(/prem:\s*["']([^"']*)["']/);
    const hSewa = raw.match(/sewa:\s*["']([^"']*)["']/);
    fields['harga.prem'] = hPrem ? hPrem[1] : '';
    fields['harga.sewa'] = hSewa ? hSewa[1] : '';

    // Image
    ['menu','menuv2','menuv3','welcome','left','reply','canvas','qris'].forEach(k => {
      const rx = new RegExp(`${k}:\\s*["'\`]([^"'\`]*)["'\`]`);
      const m  = raw.match(rx);
      fields[`image.${k}`] = m ? m[1] : '';
    });

    // Panel
    ['egg','nestid','loc','domain','apikey','capikey'].forEach(k => {
      const rx = new RegExp(`global\\.${k}\\s*=\\s*["']([^"']*)["']`);
      const m  = raw.match(rx);
      fields[k] = m ? m[1] : '';
    });

    return res.json({ ok: true, fields });
  } catch (e) {
    return res.status(500).json({ ok: false, msg: e.message });
  }
});

// ── SAVE SETTINGS ──
app.post('/api/settings', authMiddleware, (req, res) => {
  try {
    const { changes } = req.body; // { fieldKey: newValue, ... }
    if (!changes || !Object.keys(changes).length)
      return res.status(400).json({ ok: false, msg: 'Tidak ada perubahan' });

    let raw = fs.readFileSync(SETTINGS_PATH, 'utf8');
    const updated = [];

    for (const [key, val] of Object.entries(changes)) {
      if (!val && val !== '0') continue;

      // Validasi field yang boleh diubah
      const ALLOWED = [
        'owner','namaOwner','packname','botname','botname2',
        'namaSaluran','idSaluran','linkOwner','linkGrup','linkSaluran',
        'custompairing','dana','gopay','packsticker','delayJpm','delayPushkontak',
        'harga.prem','harga.sewa',
        'image.menu','image.menuv2','image.menuv3','image.welcome',
        'image.left','image.reply','image.canvas','image.qris',
        'egg','nestid','loc','domain','apikey','capikey'
      ];
      if (!ALLOWED.includes(key)) continue;

      // Handle special keys
      if (key === 'harga.prem') {
        raw = raw.replace(/(prem:\s*)["']([^"']*)["']/, `$1"${val}"`);
        updated.push(key);
      } else if (key === 'harga.sewa') {
        raw = raw.replace(/(sewa:\s*)["']([^"']*)["']/, `$1"${val}"`);
        updated.push(key);
      } else if (key.startsWith('image.')) {
        const imgKey = key.replace('image.', '');
        const rx = new RegExp(`(${imgKey}:\\s*)["'\`]([^"'\`]*)["'\`]`);
        if (rx.test(raw)) { raw = raw.replace(rx, `$1"${val}"`); updated.push(key); }
      } else {
        // global.X = "..." atau X = "..."
        const rx1 = new RegExp(`(global\\.${key}\\s*=\\s*)["'\`][^"'\`]*["'\`]`);
        const rx2 = new RegExp(`(${key}\\s*=\\s*)["'\`][^"'\`]*["'\`]`);
        if (rx1.test(raw)) { raw = raw.replace(rx1, `$1"${val}"`); updated.push(key); }
        else if (rx2.test(raw)) { raw = raw.replace(rx2, `$1"${val}"`); updated.push(key); }
      }
    }

    if (!updated.length)
      return res.status(400).json({ ok: false, msg: 'Tidak ada field yang berhasil diubah' });

    // Backup dulu sebelum save
    fs.writeFileSync(SETTINGS_PATH + '.bak', fs.readFileSync(SETTINGS_PATH));
    fs.writeFileSync(SETTINGS_PATH, raw, 'utf8');

    return res.json({ ok: true, updated, msg: `${updated.length} field berhasil disimpan` });
  } catch (e) {
    return res.status(500).json({ ok: false, msg: e.message });
  }
});

app.listen(PORT, () => {
  console.log(`\n⚡ Wanzz Panel Backend running at http://localhost:${PORT}`);
  console.log(`⚡ Settings path: ${SETTINGS_PATH}`);
  console.log(`⚡ Password: ${PANEL_PASS}\n`);
});
