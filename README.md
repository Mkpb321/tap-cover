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

## Titel
Im Editor kann ein optionaler Titel gesetzt werden.

Beispiel:
```json
{
  "version": 1,
  "title": "Nervensystem – Übersicht",
  "image": {
    "fileName": "image.png",
    "width": 1200,
    "height": 800
  },
  "rectangles": []
}
```

Wenn `title` in `cover.json` vorhanden ist, wird er in der Ordnerliste angezeigt.

## Verhalten
- `image.png` ohne `cover.json` → Editor
- `image.png` mit gültiger `cover.json` → Lernansicht
- `cover.json` ohne `image.png` → Eintrag erscheint, beim Öffnen Alert
- ungültige `cover.json` → Alert und Editor

## Browser-Speicher
Tap Cover speichert lokal im Browser:
- Zeitpunkt des letzten Öffnens pro Eintrag
- Sichtbarkeit der Cover-Zonen pro Eintrag
- welcher Eintrag zuletzt geöffnet war

Beim Laden der Seite öffnet Tap Cover automatisch wieder den zuletzt geöffneten Eintrag, sofern er noch gefunden wird. Zusätzlich wird der letzte Auf-/Zu-Zustand wiederhergestellt, solange die Anzahl der Rechtecke unverändert ist.

## Hosting
Die App muss über einen Webserver laufen, z. B.:
- VS Code Live Server
- GitHub Pages

Ein Doppelklick auf `index.html` reicht nicht.
