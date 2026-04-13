# Tap Cover

## Struktur
```text
images/
  1/
    image.png
    cover.json   (optional)
  2/
    image.png
    cover.json   (optional)
```

## Regeln
- Ordnernamen rein numerisch: `1`, `2`, `3`, ...
- Bilddatei exakt `image.png`
- `cover.json` optional
- Die App prüft direkte Datei-URLs unter `./images/<nummer>/...`
- Der Scan stoppt, sobald **3 Nummern in Folge fehlen**. Das entspricht einer erlaubten Lücke von höchstens **2**.

## Verhalten
- `image.png` ohne `cover.json` → Editor
- `image.png` mit gültiger `cover.json` → Lernansicht
- `cover.json` ohne `image.png` → Eintrag erscheint, beim Öffnen Alert
- ungültige `cover.json` → Alert und Editor

## Browser-Speicher
Tap Cover speichert lokal im Browser:
- Zeitpunkt des letzten Öffnens pro Eintrag
- Sichtbarkeit der Cover-Zonen pro Eintrag

Beim erneuten Öffnen wird der letzte Auf-/Zu-Zustand wiederhergestellt, solange die Anzahl der Rechtecke unverändert ist.

## Hosting
Die App muss über einen Webserver laufen, z. B.:
- VS Code Live Server
- GitHub Pages

Ein Doppelklick auf `index.html` reicht nicht.
