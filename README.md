# Materialverwaltung – Produkt-Website

Landingpage der **Materialverwaltung** (Vorstellung, Preise, Anfrage-Formular,
Impressum & Datenschutz) als eigener Docker-Container. Kleiner Node-Server liefert
die statischen Seiten aus und nimmt Anfragen über `POST /api/anfrage` entgegen.

- Anfragen werden **immer** in `/app/data/anfragen.jsonl` gespeichert (Docker-Volume)
- und – falls SMTP konfiguriert ist – zusätzlich **per E-Mail** zugestellt.
- Kein Tracking, keine Cookies, keine externen Inhalte (siehe Datenschutzerklärung).

## Deploy in Portainer (Hetzner)

1. **Stacks → Add stack → Repository**
   - Repository URL: dieses Repo
   - Reference: `refs/heads/main`
   - Compose path: `docker-compose.yml`
2. **Environment variables** (für die Mailzustellung der Anfragen):

   | Variable | Beispiel | Bedeutung |
   |---|---|---|
   | `SMTP_HOST` | `smtp.example.de` | Mailserver |
   | `SMTP_PORT` | `465` | Port (465 = SSL, 587 = STARTTLS) |
   | `SMTP_SECURE` | *(leer)* | Leer lassen → wird aus dem Port abgeleitet (465 = `true`, 587 = `false`). Nur setzen, um es zu erzwingen. |
   | `SMTP_USER` | `noreply@example.de` | SMTP-Benutzer |
   | `SMTP_PASS` | – | SMTP-Passwort |
   | `MAIL_FROM` | `noreply@example.de` | Absenderadresse |
   | `MAIL_TO` | `kontakt@example.de` | **Empfänger der Anfragen (Pflicht für Mailversand!)** |
   | `WEB_PORT` | `8080` | Host-Port (Standard 8080) |

   Ohne SMTP-Konfiguration funktioniert das Formular trotzdem – die Anfragen landen
   dann nur in `anfragen.jsonl` (Volume `website-data`).

### Mailversand prüfen / Fehlersuche

Kommen keine E-Mails an, verrät das **Container-Log** die Ursache (Portainer →
Container `materialverwaltung-website` → Logs). Direkt beim Start steht dort eine
Zeile `[SMTP] …`:

- `[SMTP] Verbindung und Anmeldung OK …` → Versand funktioniert. Formular testen;
  bei jeder Anfrage erscheint `[Mailversand OK] …`.
- `[SMTP] Verbindung/Anmeldung FEHLGESCHLAGEN (<code>): <grund>` → häufige Codes:
  `EAUTH`/`535` = falscher Benutzer/Passwort · `ETIMEDOUT`/`ECONNREFUSED` = Port
  (465/587) ausgehend geblockt oder falsch · `ENOTFOUND` = falscher `SMTP_HOST`
  · TLS-/Zertifikatfehler = `SMTP_SECURE`/Port passt nicht zusammen.
- `[SMTP] Nicht konfiguriert …` → `SMTP_HOST` und/oder `MAIL_TO` fehlen.

Wichtig: Das Formular meldet dem Besucher immer „Danke" (die Anfrage ist in
`anfragen.jsonl` gesichert) – ob die E-Mail rausging, steht **nur im Log**. Nach
Änderung der SMTP-Variablen den Stack neu deployen.
3. **Deploy the stack.** Healthcheck: `http://<host>:8080/api/health` → `{"ok":true}`.
4. Im Nginx Proxy Manager einen Proxy-Host auf Port `8080` anlegen (Domain + Let's Encrypt).

Das Image wird per GitHub Actions gebaut und nach
`ghcr.io/lukasf03/materialverwaltung-website:latest` gepusht (Package auf „Public" stellen).

## Vor Veröffentlichung anpassen

- [ ] `public/impressum.html`: **Beispieldaten durch echte Betreiberdaten ersetzen**
- [ ] `public/datenschutz.html`: Abschnitt 1 (Verantwortlicher) ersetzen
- [ ] SMTP-Variablen in Portainer setzen und Formular einmal testen

## Anfragen einsehen

Zusätzlich zur E-Mail liegen alle Anfragen als JSON-Zeilen im Volume:

```bash
docker exec materialverwaltung-website cat /app/data/anfragen.jsonl
```

## Lokal testen

```bash
npm install
npm start          # http://localhost:8080
```
