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
- Tap Cover scannt aufsteigend und stoppt nach **100 Nummern in Folge ohne `image.png` und ohne `cover.json`**

## Verwendung mit VS Code Live Server oder GitHub Pages
1. Lege die App-Dateien in einen Ordner.
2. Lege daneben den Ordner `images` an.
3. Lege darin die nummerierten Unterordner an.
4. Rufe die App über einen Webserver auf, z. B. per Rechtsklick in VS Code mit **Open with Live Server** oder über GitHub Pages.
5. Die App prüft automatisch `./images/1/image.png`, `./images/1/cover.json`, `./images/2/image.png`, `./images/2/cover.json`, ...
6. Klicke links auf einen Eintrag.

## Verhalten
- **Eintrag mit `cover.json`, aber ohne `image.png`** → Fehlermeldung per Alert
- **`image.png`, aber kein `cover.json`** → Editor zum Erstellen von Cover-Zonen
- **`image.png` und `cover.json`** → Lernansicht mit grauen Rechtecken
- **Ungültiges `cover.json`** → Alert und Öffnen des Editors

## Hinweis zur Scan-Logik
Es gibt ohne eigenes Backend keine freie Ordnerauflistung im Browser. Deshalb nutzt die App ein festes Schema über nummerierte Pfade und prüft direkt bekannte Dateien. Für jede Nummer wird `image.png` und `cover.json` abgefragt; ein Eintrag gilt als vorhanden, sobald mindestens eine dieser Dateien erreichbar ist. Das ist für GitHub Pages und andere statische Hosts robuster als das Prüfen von Ordner-URLs, hat aber diese Grenzen:
- Wenn mehr als 100 Nummern hintereinander weder `image.png` noch `cover.json` liefern, endet der Scan.
- Dateinamen müssen exakt stimmen.
- Leere Ordner ohne beide Dateien bleiben unsichtbar.
- Ein Doppelklick auf `index.html` ohne Webserver ist nicht ausreichend.


## Neu in diesem Stand
- Voll deckendes, helleres Grau für abgedeckte Bereiche
- Zusätzlicher Button **Alle aufdecken** in der Lernansicht
- Überarbeiteter Info-Dialog mit Zweck, Gesamt-Workflow und typischen Fehlerquellen


## GitHub Pages Hinweis
Da Tap Cover nur noch direkte Datei-URLs prüft und keine Ordner-URLs mehr benötigt, funktioniert derselbe Code auch auf GitHub Pages, solange `images/` im veröffentlichten Projektpfad liegt.


## GitHub Pages

Diese Version prüft nur direkte Datei-URLs wie `./images/7/image.png` und `./images/7/cover.json`.
Es werden **keine Ordner-URLs** wie `./images/7/` abgefragt. Das ist wichtig, weil GitHub Pages statische Dateien zuverlässig ausliefert, das Prüfen von Ordnerpfaden aber nicht für diese App taugt.
