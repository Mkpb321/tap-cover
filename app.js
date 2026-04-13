const MISSING_STREAK_LIMIT = 100;
const IMAGE_FILE_NAME = "image.png";
const COVER_FILE_NAME = "cover.json";

const state = {
  rootFolderName: "images",
  rootFolderUrl: new URL("./images/", document.baseURI).href,
  folders: [],
  activeFolderName: null,
  activeFolder: null,
  activeMode: null,
  editor: {
    rects: [],
    previewRect: null,
    imageNatural: null,
    imageUrl: null,
    imageFileName: null,
    pointer: null,
  },
  viewer: {
    rects: [],
    visibleMask: [],
    imageNatural: null,
    imageUrl: null,
    imageFileName: null,
  },
};

const folderList = document.getElementById("folderList");
const folderCount = document.getElementById("folderCount");
const workspace = document.getElementById("workspace");
const viewTitle = document.getElementById("viewTitle");
const contextBadge = document.getElementById("contextBadge");
const folderItemTemplate = document.getElementById("folderItemTemplate");
const refreshFoldersBtn = document.getElementById("refreshFoldersBtn");
const openInfoBtn = document.getElementById("openInfoBtn");
const closeInfoBtn = document.getElementById("closeInfoBtn");
const infoModal = document.getElementById("infoModal");

refreshFoldersBtn.addEventListener("click", async () => {
  await loadFolders({ keepActiveFolder: true });
});

openInfoBtn.addEventListener("click", openInfoModal);
closeInfoBtn.addEventListener("click", closeInfoModal);
infoModal.addEventListener("click", (event) => {
  if (event.target === infoModal) {
    closeInfoModal();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeInfoModal();
  }
});

async function loadFolders({ keepActiveFolder = false } = {}) {
  setFolderListLoading();
  refreshFoldersBtn.disabled = true;

  try {
    const folders = await scanNumberedFolders();
    state.folders = folders;

    if (!keepActiveFolder || !state.activeFolderName) {
      state.activeFolderName = null;
      state.activeFolder = null;
      state.activeMode = null;
      resetEditorState();
      resetViewerState();
      renderDefaultWorkspace(
        state.folders.length
          ? `Nummern 1 bis ${state.folders[state.folders.length - 1].name} geprüft`
          : "Keine passenden nummerierten Unterordner in ./images gefunden"
      );
    } else {
      const stillExists = state.folders.find((folder) => folder.name === state.activeFolderName);
      if (stillExists) {
        await openFolder(stillExists.name, { silentAlert: true });
      } else {
        state.activeFolderName = null;
        state.activeFolder = null;
        state.activeMode = null;
        resetEditorState();
        resetViewerState();
        renderDefaultWorkspace("Bisher geöffneter Eintrag ist nicht mehr vorhanden");
      }
    }

    renderFolderList();
  } catch (error) {
    console.error(error);
    state.folders = [];
    folderCount.textContent = "0";
    folderList.className = "folder-list empty-state-list";
    folderList.textContent = "Ordner konnten nicht geladen werden.";
    renderDirectoryError(error);
  } finally {
    refreshFoldersBtn.disabled = false;
  }
}

function setFolderListLoading() {
  folderCount.textContent = "…";
  folderList.className = "folder-list empty-state-list";
  folderList.textContent = `Prüfe nummerierte Ordner unter ./images mit Stop nach ${MISSING_STREAK_LIMIT} Lücken …`;
}

async function scanNumberedFolders() {
  const folders = [];
  let currentNumber = 1;
  let missingStreak = 0;

  while (missingStreak < MISSING_STREAK_LIMIT) {
    const folder = await buildNumberedFolderSummary(currentNumber);
    if (folder.exists) {
      folders.push(folder);
      missingStreak = 0;
    } else {
      missingStreak += 1;
    }
    currentNumber += 1;
  }

  return folders;
}

async function buildNumberedFolderSummary(folderNumber) {
  const name = String(folderNumber);
  const baseUrl = new URL(`./${name}/`, state.rootFolderUrl).href;
  const imageUrl = new URL(`./${name}/${IMAGE_FILE_NAME}`, state.rootFolderUrl).href;
  const coverUrl = new URL(`./${name}/${COVER_FILE_NAME}`, state.rootFolderUrl).href;

  const hasImage = await resourceExists(imageUrl);
  const hasCover = await resourceExists(coverUrl);
  const exists = hasImage || hasCover;

  if (!exists) {
    return {
      name,
      index: folderNumber,
      url: baseUrl,
      exists: false,
      imageCount: 0,
      hasImage: false,
      hasCover: false,
      coverState: "missing",
      imageUrl: null,
      imageFileName: null,
      coverUrl: null,
    };
  }

  let coverState = "missing";
  if (hasCover) {
    try {
      await fetchJsonFile(coverUrl);
      coverState = "valid";
    } catch {
      coverState = "invalid";
    }
  }

  return {
    name,
    index: folderNumber,
    url: baseUrl,
    exists,
    imageCount: hasImage ? 1 : 0,
    hasImage,
    hasCover,
    coverState,
    imageUrl: hasImage ? imageUrl : null,
    imageFileName: hasImage ? IMAGE_FILE_NAME : null,
    coverUrl: hasCover ? coverUrl : null,
  };
}

async function resourceExists(url) {
  try {
    const response = await fetch(withProbeCacheBust(url), {
      method: "GET",
      cache: "no-store",
    });

    if (response.body) {
      try {
        await response.body.cancel();
      } catch {
        // Ignore cancellation issues. We only need the status code.
      }
    }

    return response.ok;
  } catch {
    return false;
  }
}

function withProbeCacheBust(url) {
  const cacheBustedUrl = new URL(url, document.baseURI);
  cacheBustedUrl.searchParams.set("_tapcover_probe", String(Date.now()));
  return cacheBustedUrl.href;
}

function renderFolderList() {
  folderCount.textContent = String(state.folders.length);

  if (!state.folders.length) {
    folderList.className = "folder-list empty-state-list";
    folderList.textContent = "Unter ./images wurden keine nummerierten Einträge mit image.png oder cover.json erkannt.";
    return;
  }

  folderList.className = "folder-list";
  folderList.innerHTML = "";

  for (const folder of state.folders) {
    const fragment = folderItemTemplate.content.cloneNode(true);
    const button = fragment.querySelector(".folder-item");
    const nameEl = fragment.querySelector(".folder-item-name");
    const metaEl = fragment.querySelector(".folder-item-meta");

    nameEl.textContent = folder.name;
    metaEl.textContent = buildFolderMeta(folder);

    if (state.activeFolderName === folder.name) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => openFolder(folder.name));
    folderList.appendChild(fragment);
  }
}

function buildFolderMeta(folder) {
  if (!folder.hasImage) {
    return `${IMAGE_FILE_NAME} fehlt${folder.hasCover ? ` · ${COVER_FILE_NAME} vorhanden` : ""}`;
  }

  if (folder.coverState === "invalid") {
    return `${IMAGE_FILE_NAME} vorhanden · ungültiges ${COVER_FILE_NAME}`;
  }

  if (!folder.hasCover) {
    return `${IMAGE_FILE_NAME} vorhanden · kein ${COVER_FILE_NAME}`;
  }

  return `${IMAGE_FILE_NAME} und ${COVER_FILE_NAME} vorhanden`;
}

async function openFolder(folderName, { silentAlert = false } = {}) {
  const folder = state.folders.find((entry) => entry.name === folderName);
  if (!folder) {
    return;
  }

  state.activeFolderName = folder.name;
  state.activeFolder = folder;
  renderFolderList();

  try {
    if (!folder.imageUrl) {
      if (!silentAlert) {
        window.alert(`Im Ordner "${folder.name}" wurde keine ${IMAGE_FILE_NAME} gefunden.`);
      }
      renderDefaultWorkspace(`Fehler in Ordner ${folder.name}`);
      return;
    }

    if (folder.coverState === "invalid") {
      if (!silentAlert) {
        window.alert(`${COVER_FILE_NAME} in "${folder.name}" ist ungültig. Der Editor wird stattdessen geöffnet.`);
      }
      await openEditor(folder);
      return;
    }

    if (!folder.coverUrl) {
      await openEditor(folder);
      return;
    }

    const coverData = await fetchJsonFile(folder.coverUrl);
    await openViewer(folder, coverData);
  } catch (error) {
    console.error(error);
    renderDirectoryError(error);
  }
}

async function fetchJsonFile(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`Datei konnte nicht geladen werden: ${url} (HTTP ${response.status})`);
  }

  const text = await response.text();
  return JSON.parse(text);
}

async function openEditor(folder) {
  state.activeMode = "editor";
  resetViewerState();

  const imageNatural = await getImageDimensions(folder.imageUrl);

  state.editor.imageUrl = folder.imageUrl;
  state.editor.imageNatural = imageNatural;
  state.editor.imageFileName = folder.imageFileName;
  state.editor.rects = [];
  state.editor.previewRect = null;
  state.editor.pointer = null;

  renderEditorWorkspace(folder);
}

async function openViewer(folder, rawCoverJson) {
  state.activeMode = "viewer";
  resetEditorState();

  const imageNatural = await getImageDimensions(folder.imageUrl);
  const normalized = normalizeCoverJson(rawCoverJson, imageNatural);

  state.viewer.imageUrl = folder.imageUrl;
  state.viewer.imageNatural = imageNatural;
  state.viewer.imageFileName = folder.imageFileName;
  state.viewer.rects = normalized.rectangles;
  state.viewer.visibleMask = normalized.rectangles.map(() => true);

  renderViewerWorkspace(folder);
}

function normalizeCoverJson(raw, fallbackImageNatural) {
  const width = numberOrNull(raw?.image?.width)
    ?? numberOrNull(raw?.imageWidth)
    ?? numberOrNull(raw?.width)
    ?? fallbackImageNatural.width;

  const height = numberOrNull(raw?.image?.height)
    ?? numberOrNull(raw?.imageHeight)
    ?? numberOrNull(raw?.height)
    ?? fallbackImageNatural.height;

  if (!Array.isArray(raw?.rectangles)) {
    throw new Error("cover.json enthält kein gültiges Array 'rectangles'.");
  }

  const rectangles = raw.rectangles.map((rect, index) => {
    const x = numberOrNull(rect?.x);
    const y = numberOrNull(rect?.y);
    const rectWidth = numberOrNull(rect?.width);
    const rectHeight = numberOrNull(rect?.height);

    if ([x, y, rectWidth, rectHeight].some((value) => value === null)) {
      throw new Error(`Rechteck ${index + 1} in cover.json ist unvollständig.`);
    }

    return {
      id: rect?.id || `rect-${index + 1}`,
      x: clamp(Math.round(x), 0, width),
      y: clamp(Math.round(y), 0, height),
      width: clampNonNegative(Math.round(rectWidth)),
      height: clampNonNegative(Math.round(rectHeight)),
    };
  }).filter((rect) => rect.width > 0 && rect.height > 0);

  return {
    image: {
      width,
      height,
    },
    rectangles,
  };
}

function renderDefaultWorkspace(message = "Ordnerliste geladen") {
  viewTitle.textContent = "Bereit";
  contextBadge.textContent = `Statisches Hosting · ./images · ${message}`;

  workspace.innerHTML = `
    <div class="placeholder-card">
      <h3>Tap Cover ist bereit</h3>
      <p>${escapeHtml(message)}</p>
      <ol>
        <li>Lege nummerierte Ordner in <code>./images</code> an.</li>
        <li>Lege je Ordner exakt <code>image.png</code> ab.</li>
        <li>Optional lege <code>cover.json</code> dazu.</li>
        <li>Klicke links auf einen Ordner.</li>
      </ol>
    </div>
  `;
}

function renderDirectoryError(error) {
  viewTitle.textContent = "Fehler";
  contextBadge.textContent = "Fehler beim Laden";

  workspace.innerHTML = `
    <div class="error-card">
      <h3 class="error-title">Ordnerstruktur konnte nicht verarbeitet werden</h3>
      <p class="error-note">${escapeHtml(error?.message || "Unbekannter Fehler")}</p>
      <p class="error-note">Prüfe, ob die App über einen Webserver läuft, ob <code>./images</code> im Publish-Root liegt und ob die Dateien unter den erwarteten Pfaden erreichbar sind.</p>
    </div>
  `;
}

function renderEditorWorkspace(folder) {
  viewTitle.textContent = "Cover erstellen";
  contextBadge.textContent = `${folder.name} · Editor`;

  workspace.innerHTML = `
    <div class="workspace-card">
      <div class="toolbar">
        <div>
          <h3>${escapeHtml(folder.name)}</h3>
          <p class="editor-note">Zeichne per Maus oder Touch Rechtecke auf das Bild. Die Koordinaten werden relativ zur nativen Bildgröße gespeichert.</p>
        </div>
        <div class="toolbar-actions">
          <button id="undoRectBtn" class="btn btn-secondary" type="button">Letztes Rechteck entfernen</button>
          <button id="clearRectsBtn" class="btn btn-danger" type="button">Alle Rechtecke löschen</button>
          <button id="downloadCoverBtn" class="btn btn-primary" type="button">cover.json herunterladen</button>
        </div>
      </div>

      <div class="properties-grid">
        <div class="info-box">
          <span class="label">Bilddatei</span>
          <span class="value">${escapeHtml(state.editor.imageFileName)}</span>
        </div>
        <div class="info-box">
          <span class="label">Bildgröße</span>
          <span class="value">${state.editor.imageNatural.width} × ${state.editor.imageNatural.height}px</span>
        </div>
        <div class="info-box">
          <span class="label">Rechtecke</span>
          <span id="editorRectCount" class="value">${state.editor.rects.length}</span>
        </div>
      </div>

      <div class="image-board">
        <div class="image-stack">
          <img class="study-image" src="${state.editor.imageUrl}" alt="${escapeHtml(state.editor.imageFileName)}" draggable="false" />
          <div id="editorOverlay" class="overlay-layer editor-overlay"></div>
        </div>
      </div>
    </div>
  `;

  const overlay = document.getElementById("editorOverlay");
  overlay.addEventListener("pointerdown", startDrawingRect);
  overlay.addEventListener("pointermove", continueDrawingRect);
  overlay.addEventListener("pointerup", finishDrawingRect);
  overlay.addEventListener("pointerleave", finishDrawingRect);
  overlay.addEventListener("pointercancel", cancelDrawingRect);

  document.getElementById("undoRectBtn").addEventListener("click", undoLastRect);
  document.getElementById("clearRectsBtn").addEventListener("click", clearRects);
  document.getElementById("downloadCoverBtn").addEventListener("click", downloadCoverJson);

  renderEditorOverlay();
}

function renderViewerWorkspace(folder) {
  viewTitle.textContent = "Lernansicht";
  contextBadge.textContent = `${folder.name} · Viewer`;

  workspace.innerHTML = `
    <div class="workspace-card">
      <div class="toolbar">
        <div>
          <h3>${escapeHtml(folder.name)}</h3>
          <p class="viewer-note">Alle Zonen starten grau. Antippen oder anklicken schaltet zwischen grau und transparent um.</p>
        </div>
        <div class="toolbar-actions">
          <button id="revealAllBtn" class="btn btn-secondary" type="button">Alle aufdecken</button>
          <button id="resetCoverBtn" class="btn btn-secondary" type="button">Alle wieder abdecken</button>
        </div>
      </div>

      <div class="properties-grid">
        <div class="info-box">
          <span class="label">Bilddatei</span>
          <span class="value">${escapeHtml(state.viewer.imageFileName)}</span>
        </div>
        <div class="info-box">
          <span class="label">Bildgröße</span>
          <span class="value">${state.viewer.imageNatural.width} × ${state.viewer.imageNatural.height}px</span>
        </div>
        <div class="info-box">
          <span class="label">Cover-Zonen</span>
          <span class="value">${state.viewer.rects.length}</span>
        </div>
      </div>

      <div class="image-board">
        <div class="image-stack">
          <img class="study-image" src="${state.viewer.imageUrl}" alt="${escapeHtml(state.viewer.imageFileName)}" draggable="false" />
          <div id="viewerOverlay" class="overlay-layer"></div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("revealAllBtn").addEventListener("click", () => {
    state.viewer.visibleMask = state.viewer.rects.map(() => false);
    renderViewerOverlay();
  });

  document.getElementById("resetCoverBtn").addEventListener("click", () => {
    state.viewer.visibleMask = state.viewer.rects.map(() => true);
    renderViewerOverlay();
  });

  renderViewerOverlay();
}

function renderEditorOverlay() {
  const overlay = document.getElementById("editorOverlay");
  if (!overlay) {
    return;
  }

  overlay.innerHTML = "";

  for (const rect of state.editor.rects) {
    overlay.appendChild(createRectElement(rect, state.editor.imageNatural, "editor-rect"));
  }

  if (state.editor.previewRect) {
    overlay.appendChild(createRectElement(state.editor.previewRect, state.editor.imageNatural, "editor-rect preview"));
  }

  const countEl = document.getElementById("editorRectCount");
  if (countEl) {
    countEl.textContent = String(state.editor.rects.length);
  }
}

function renderViewerOverlay() {
  const overlay = document.getElementById("viewerOverlay");
  if (!overlay) {
    return;
  }

  overlay.innerHTML = "";

  state.viewer.rects.forEach((rect, index) => {
    const covered = state.viewer.visibleMask[index] !== false;
    const el = createRectElement(
      rect,
      state.viewer.imageNatural,
      `cover-rect ${covered ? "covered" : "transparent"}`
    );
    el.addEventListener("click", () => toggleCoverRect(index));
    el.addEventListener("pointerdown", (event) => event.preventDefault());
    overlay.appendChild(el);
  });
}

function createRectElement(rect, imageNatural, className) {
  const el = document.createElement("button");
  el.type = "button";
  el.className = className;
  el.style.left = `${(rect.x / imageNatural.width) * 100}%`;
  el.style.top = `${(rect.y / imageNatural.height) * 100}%`;
  el.style.width = `${(rect.width / imageNatural.width) * 100}%`;
  el.style.height = `${(rect.height / imageNatural.height) * 100}%`;
  el.setAttribute("aria-label", `Rechteck ${rect.id || ""}`.trim());
  return el;
}

function toggleCoverRect(index) {
  state.viewer.visibleMask[index] = !state.viewer.visibleMask[index];
  renderViewerOverlay();
}

function startDrawingRect(event) {
  if (event.button !== 0 && event.pointerType !== "touch") {
    return;
  }

  event.preventDefault();
  const localPoint = getNaturalPointFromEvent(event);
  if (!localPoint) {
    return;
  }

  state.editor.pointer = {
    pointerId: event.pointerId,
    startX: localPoint.x,
    startY: localPoint.y,
  };

  const overlay = document.getElementById("editorOverlay");
  overlay?.setPointerCapture?.(event.pointerId);

  state.editor.previewRect = {
    id: `preview-${Date.now()}`,
    x: localPoint.x,
    y: localPoint.y,
    width: 0,
    height: 0,
  };

  renderEditorOverlay();
}

function continueDrawingRect(event) {
  if (!state.editor.pointer || state.editor.pointer.pointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  const point = getNaturalPointFromEvent(event);
  if (!point) {
    return;
  }

  state.editor.previewRect = buildRectFromPoints(
    state.editor.pointer.startX,
    state.editor.pointer.startY,
    point.x,
    point.y
  );

  renderEditorOverlay();
}

function finishDrawingRect(event) {
  if (!state.editor.pointer || state.editor.pointer.pointerId !== event.pointerId) {
    return;
  }

  event.preventDefault();
  const point = getNaturalPointFromEvent(event) || {
    x: state.editor.pointer.startX,
    y: state.editor.pointer.startY,
  };

  const rect = buildRectFromPoints(
    state.editor.pointer.startX,
    state.editor.pointer.startY,
    point.x,
    point.y
  );

  if (rect.width >= 8 && rect.height >= 8) {
    rect.id = `rect-${state.editor.rects.length + 1}`;
    state.editor.rects.push(rect);
  }

  state.editor.previewRect = null;
  state.editor.pointer = null;
  renderEditorOverlay();
}

function cancelDrawingRect(event) {
  if (!state.editor.pointer || state.editor.pointer.pointerId !== event.pointerId) {
    return;
  }

  state.editor.pointer = null;
  state.editor.previewRect = null;
  renderEditorOverlay();
}

function buildRectFromPoints(x1, y1, x2, y2) {
  return {
    x: Math.round(Math.min(x1, x2)),
    y: Math.round(Math.min(y1, y2)),
    width: Math.round(Math.abs(x2 - x1)),
    height: Math.round(Math.abs(y2 - y1)),
  };
}

function getNaturalPointFromEvent(event) {
  const overlay = document.getElementById("editorOverlay");
  if (!overlay || !state.editor.imageNatural) {
    return null;
  }

  const rect = overlay.getBoundingClientRect();
  if (!rect.width || !rect.height) {
    return null;
  }

  const localX = clamp(event.clientX - rect.left, 0, rect.width);
  const localY = clamp(event.clientY - rect.top, 0, rect.height);

  return {
    x: Math.round((localX / rect.width) * state.editor.imageNatural.width),
    y: Math.round((localY / rect.height) * state.editor.imageNatural.height),
  };
}

function undoLastRect() {
  state.editor.rects.pop();
  renderEditorOverlay();
}

function clearRects() {
  state.editor.rects = [];
  state.editor.previewRect = null;
  renderEditorOverlay();
}

function downloadCoverJson() {
  if (!state.editor.imageNatural || !state.editor.imageFileName) {
    return;
  }

  const payload = {
    version: 1,
    image: {
      fileName: state.editor.imageFileName,
      width: state.editor.imageNatural.width,
      height: state.editor.imageNatural.height,
    },
    rectangles: state.editor.rects.map((rect, index) => ({
      id: `rect-${index + 1}`,
      x: rect.x,
      y: rect.y,
      width: rect.width,
      height: rect.height,
    })),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = COVER_FILE_NAME;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function resetEditorState() {
  state.editor.rects = [];
  state.editor.previewRect = null;
  state.editor.imageNatural = null;
  state.editor.imageUrl = null;
  state.editor.imageFileName = null;
  state.editor.pointer = null;
}

function resetViewerState() {
  state.viewer.rects = [];
  state.viewer.visibleMask = [];
  state.viewer.imageNatural = null;
  state.viewer.imageUrl = null;
  state.viewer.imageFileName = null;
}

function getImageDimensions(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("Bild konnte nicht geladen werden."));
    img.src = src;
  });
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function clampNonNegative(value) {
  return Math.max(0, value);
}

function openInfoModal() {
  infoModal.classList.remove("hidden");
  infoModal.setAttribute("aria-hidden", "false");
}

function closeInfoModal() {
  infoModal.classList.add("hidden");
  infoModal.setAttribute("aria-hidden", "true");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

renderDefaultWorkspace();
loadFolders();
