/* Webserver der Produkt-Website: statische Seiten + Anfrage-Formular.
 * Anfragen werden immer nach /data/anfragen.jsonl geschrieben und – falls
 * SMTP per Env konfiguriert ist – zusätzlich per E-Mail zugestellt. */
const path = require('path');
const fs = require('fs');
const express = require('express');
const rateLimit = require('express-rate-limit');
const nodemailer = require('nodemailer');

const app = express();
app.set('trust proxy', 1);
app.disable('x-powered-by');
app.use(express.json({ limit: '50kb' }));

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Zu viele Anfragen. Bitte später erneut versuchen.' }
});

function smtpConfigured() {
  return Boolean(process.env.SMTP_HOST && process.env.MAIL_TO);
}

// Baut die Transport-Optionen. `secure` wird – wenn SMTP_SECURE nicht ausdrücklich
// gesetzt ist – aus dem Port abgeleitet: 465 = implizites TLS (secure), 587/25 =
// STARTTLS (nicht secure). Das verhindert den häufigsten Fehler „587 mit secure=true".
function smtpSettings() {
  const port = Number(process.env.SMTP_PORT) || 465;
  const secEnv = process.env.SMTP_SECURE;
  const secure = (secEnv === undefined || secEnv === '') ? port === 465 : String(secEnv) === 'true';
  return {
    host: process.env.SMTP_HOST,
    port,
    secure,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' } : undefined,
    connectionTimeout: 10000,
    greetingTimeout: 10000,
    socketTimeout: 15000
  };
}

function smtpSummary() {
  const s = smtpSettings();
  return `host=${s.host} port=${s.port} secure=${s.secure} auth=${s.auth ? s.auth.user : 'keine'} `
    + `from=${process.env.MAIL_FROM || process.env.SMTP_USER || '-'} to=${process.env.MAIL_TO || '-'}`;
}

async function sendMail(subject, text, replyTo) {
  const transport = nodemailer.createTransport(smtpSettings());
  await transport.sendMail({
    from: process.env.MAIL_FROM || process.env.SMTP_USER,
    to: process.env.MAIL_TO,
    replyTo: replyTo || undefined,
    subject,
    text
  });
}

// Beim Start einmal prüfen und klar loggen, ob der Mailversand wirklich funktioniert.
// So steht die echte Ursache (Auth, TLS/Port, Firewall) sofort im Container-Log.
function checkSmtpOnStartup() {
  if (!smtpConfigured()) {
    console.warn('[SMTP] Nicht konfiguriert – SMTP_HOST und/oder MAIL_TO fehlen. '
      + 'Anfragen werden nur in anfragen.jsonl gespeichert, es wird KEINE E-Mail versendet.');
    return;
  }
  console.log(`[SMTP] Konfiguration: ${smtpSummary()}`);
  nodemailer.createTransport(smtpSettings()).verify()
    .then(() => console.log('[SMTP] Verbindung und Anmeldung OK – Mailversand ist einsatzbereit.'))
    .catch((e) => console.error('[SMTP] Verbindung/Anmeldung FEHLGESCHLAGEN'
      + (e.code ? ` (${e.code})` : '') + ':', e.message,
      '– Anfragen werden trotzdem in anfragen.jsonl gespeichert.'));
}

app.post('/api/anfrage', limiter, async (req, res) => {
  try {
    const b = req.body || {};
    // Honeypot: von Menschen unsichtbar – wenn gefüllt, still verwerfen.
    if (b.website) return res.json({ ok: true });

    const name = String(b.name || '').trim().slice(0, 200);
    const email = String(b.email || '').trim().slice(0, 200);
    const org = String(b.org || '').trim().slice(0, 200);
    const paket = String(b.paket || '').trim().slice(0, 50);
    const nachricht = String(b.nachricht || '').trim().slice(0, 4000);

    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Bitte Name und eine gültige E-Mail-Adresse angeben.' });
    }

    const entry = { ts: new Date().toISOString(), name, email, org, paket, nachricht, ip: req.ip };
    fs.appendFileSync(path.join(DATA_DIR, 'anfragen.jsonl'), JSON.stringify(entry) + '\n');

    let mailed = false;
    if (smtpConfigured()) {
      try {
        await sendMail(
          `Neue Anfrage: ${paket || 'Materialverwaltung'} – ${name}`,
          `Neue Anfrage über die Website\n\nName: ${name}\nE-Mail: ${email}\nOrganisation: ${org || '-'}\nPaket: ${paket || '-'}\n\nNachricht:\n${nachricht || '-'}\n\nZeitpunkt: ${entry.ts}`,
          email
        );
        mailed = true;
        console.log(`[Mailversand OK] Anfrage von ${name} <${email}> an ${process.env.MAIL_TO} gesendet.`);
      } catch (e) {
        console.error('[Mailversand fehlgeschlagen]',
          `code=${e.code || '-'} command=${e.command || '-'} response=${e.response || '-'}`,
          `message=${e.message}`, `| Konfig: ${smtpSummary()}`);
      }
    } else {
      console.warn('[SMTP] Nicht konfiguriert (SMTP_HOST und/oder MAIL_TO fehlen) – Anfrage nur in anfragen.jsonl gespeichert.');
    }
    res.json({ ok: true, mailed });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Anfrage konnte nicht verarbeitet werden.' });
  }
});

app.get('/api/health', (req, res) => res.json({ ok: true }));

app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'] }));
app.use((req, res) => res.status(404).sendFile(path.join(__dirname, 'public', 'index.html')));

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log(`Website läuft auf Port ${port}`);
  checkSmtpOnStartup();
});
