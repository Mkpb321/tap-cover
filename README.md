# Tap Cover

## Inhalt
- `index.html`
- `styles.css`
- `app.js`
- `images/`

## Erwartete Ordnerstruktur
Tap Cover arbeitet mit einer festen Struktur unter `images/`:

```text
images/
  1/
    image.png
    cover.json   (optional)
  2/
    image.png
    cover.json   (optional)
  3/
    image.png
```

## Wichtige Regeln
- Unterordner heißen numerisch: `1`, `2`, `3`, ...
- Bilddatei heißt exakt `image.png`
- Andere Bildtypen werden nicht berücksichtigt
- `cover.json` ist optional
- Tap Cover scannt aufsteigend und stoppt nach **100 fehlenden Ordnern in Folge**

## Verwendung mit VS Code Live Server
1. Lege die App-Dateien in einen Ordner.
2. Lege daneben den Ordner `images` an.
3. Lege darin die nummerierten Unterordner an.
4. Starte `index.html` per Rechtsklick in VS Code mit **Open with Live Server**.
5. Die App prüft automatisch `./images/1`, `./images/2`, `./images/3`, ...
6. Klicke links auf einen Ordner.

## Verhalten
- **Ordner vorhanden, aber kein `image.png`** → Fehlermeldung per Alert
- **`image.png`, aber kein `cover.json`** → Editor zum Erstellen von Cover-Zonen
- **`image.png` und `cover.json`** → Lernansicht mit grauen Rechtecken
- **Ungültiges `cover.json`** → Alert und Öffnen des Editors

## Hinweis zur Scan-Logik
Es gibt ohne eigenes Backend keine freie Ordnerauflistung im Browser. Deshalb nutzt die App ein festes Schema über nummerierte Ordner und prüft bekannte Pfade. Das ist für Live Server deutlich stabiler als das Parsen einer Verzeichnisliste, hat aber diese Grenzen:
- Wenn mehr als 100 Nummern hintereinander fehlen, endet der Scan.
- Dateinamen müssen exakt stimmen.
- Ein Doppelklick auf `index.html` ohne Webserver ist nicht ausreichend.


## Neu in diesem Stand
- Voll deckendes, helleres Grau für abgedeckte Bereiche
- Zusätzlicher Button **Alle aufdecken** in der Lernansicht
- Überarbeiteter Info-Dialog mit Zweck, Gesamt-Workflow und typischen Fehlerquellen
