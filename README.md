# Cover Trainer

## Inhalt
- `index.html`
- `styles.css`
- `app.js`
- `images/` (dein Bildordner)

## Verwendung
1. Lege deine Unterordner in `images/` an.
2. Öffne `index.html` im Browser.
3. Klicke auf **images-Ordner auswählen** und wähle den Ordner `images`.
4. Klicke einen Unterordner an.

## Verhalten
- **kein Bild** → Fehlermeldung per Alert
- **Bild, aber kein `cover.json`** → Editor zum Erstellen von Cover-Zonen
- **Bild und `cover.json`** → Lernansicht mit grauen Rechtecken

## cover.json Format
Die App erzeugt Dateien in diesem Format:

```json
{
  "version": 1,
  "image": {
    "fileName": "bild.png",
    "width": 1920,
    "height": 1080
  },
  "rectangles": [
    {
      "id": "rect-1",
      "x": 120,
      "y": 200,
      "width": 320,
      "height": 90
    }
  ]
}
```

## Technischer Hinweis
Ein normales Browser-HTML darf lokale Ordner nicht automatisch selbst auslesen. Deshalb wählst du den `images`-Ordner einmal manuell aus. Danach arbeitet die App mit dessen Unterordnern.
