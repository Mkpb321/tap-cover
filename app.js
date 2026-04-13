const state = {
  rootFolderName: null,
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

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "webp", "gif", "bmp", "svg"];

const folderInput = document.getElementById("folderInput");
const selectFolderBtn = document.getElementById("selectFolderBtn");
const folderList = document.getElementById("folderList");
const folderCount = document.getElementById("folderCount");
const workspace = document.getElementById("workspace");
const viewTitle = document.getElementById("viewTitle");
const contextBadge = document.getElementById("contextBadge");
const folderItemTemplate = document.getElementById("folderItemTemplate");

selectFolderBtn.addEventListener("click", () => {
  folderInput.value = "";
  folderInput.click();
});
folderInput.addEventListener("change", handleFolderSelection);

function handleFolderSelection(event) {
  const files = Array.from(event.target.files || []);

  if (!files.length) {
    return;
  }

  const structured = buildFolderStructure(files);
  state.rootFolderName = structured.rootFolderName;
  state.folders = structured.folders;
  state.activeFolderName = null;
  state.activeFolder = null;
  state.activeMode = null;
  resetEditorState();
  resetViewerState();

  renderFolderList();
  renderDefaultWorkspace(
    structured.folders.length
      ? `Ordner geladen: ${structured.rootFolderName}`
      : "Keine passenden Unterordner gefunden"
  );
}

function buildFolderStructure(files) {
  const usableFiles = files.filter((file) => file.webkitRelativePath && file.webkitRelativePath.includes("/"));
  const rootFolderName = usableFiles[0]?.webkitRelativePath.split("/")[0] || "images";
  const folderMap = new Map();

  for (const file of usableFiles) {
    const parts = file.webkitRelativePath.split("/").filter(Boolean);
    if (parts.length < 3) {
      continue;
    }

    const folderName = parts[1];
    const relativeWithinFolder = parts.slice(2).join("/");

    if (!folderMap.has(folderName)) {
      folderMap.set(folderName, {
        name: folderName,
        files: [],
      });
    }

    folderMap.get(folderName).files.push({
      file,
      name: file.name,
      relativeWithinFolder,
      lowerName: file.name.toLowerCase(),
      extension: getExtension(file.name),
    });
  }

  const folders = Array.from(folderMap.values())
    .map((folder) => enrichFolder(folder))
    .sort((a, b) => a.name.localeCompare(b.name, "de", { sensitivity: "base" }));

  return { rootFolderName, folders };
}

function enrichFolder(folder) {
  const files = [...folder.files].sort((a, b) => a.relativeWithinFolder.localeCompare(b.relativeWithinFolder, "de"));
  const imageFiles = files.filter((entry) => IMAGE_EXTENSIONS.includes(entry.extension));
  const coverFile = files.find((entry) => entry.lowerName === "cover.json");

  return {
    ...folder,
    files,
    imageFile: imageFiles[0] || null,
    imageCount: imageFiles.length,
    coverFile: coverFile || null,
  };
}

function renderFolderList() {
  folderCount.textContent = String(state.folders.length);

  if (!state.folders.length) {
    folderList.className = "folder-list empty-state-list";
    folderList.textContent = "Im gewählten Ordner wurden keine Unterordner mit Dateien gefunden.";
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
  if (!folder.imageFile) {
    return "Kein Bild gefunden";
  }

  if (!folder.coverFile) {
    return folder.imageCount > 1
      ? `${folder.imageCount} Bilder · kein cover.json`
      : "Bild vorhanden · kein cover.json";
  }

  return folder.imageCount > 1
    ? `${folder.imageCount} Bilder · cover.json vorhanden`
    : "Bild und cover.json vorhanden";
}

async function openFolder(folderName) {
  const folder = state.folders.find((entry) => entry.name === folderName);
  if (!folder) {
    return;
  }

  state.activeFolderName = folder.name;
  state.activeFolder = folder;
  renderFolderList();

  if (!folder.imageFile) {
    window.alert(`Im Ordner "${folder.name}" wurde kein Bild gefunden.`);
    renderDefaultWorkspace(`Fehler in ${folder.name}`);
    return;
  }

  if (!folder.coverFile) {
    await openEditor(folder);
    return;
  }

  try {
    const rawText = await readTextFile(folder.coverFile.file);
    const rawJson = JSON.parse(rawText);
    await openViewer(folder, rawJson);
  } catch (error) {
    console.error(error);
    window.alert(`cover.json in "${folder.name}" ist ungültig. Der Editor wird stattdessen geöffnet.`);
    await openEditor(folder);
  }
}

async function openEditor(folder) {
  state.activeMode = "editor";
  resetViewerState();

  const imageUrl = await readImageAsDataUrl(folder.imageFile.file);
  const imageNatural = await getImageDimensions(imageUrl);

  state.editor.imageUrl = imageUrl;
  state.editor.imageNatural = imageNatural;
  state.editor.imageFileName = folder.imageFile.name;
  state.editor.rects = [];
  state.editor.previewRect = null;
  state.editor.pointer = null;

  renderEditorWorkspace(folder);
}

async function openViewer(folder, rawCoverJson) {
  state.activeMode = "viewer";
  resetEditorState();

  const imageUrl = await readImageAsDataUrl(folder.imageFile.file);
  const imageNatural = await getImageDimensions(imageUrl);
  const normalized = normalizeCoverJson(rawCoverJson, imageNatural);

  state.viewer.imageUrl = imageUrl;
  state.viewer.imageNatural = imageNatural;
  state.viewer.imageFileName = folder.imageFile.name;
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

  const sourceRects = Array.isArray(raw?.rectangles)
    ? raw.rectangles
    : Array.isArray(raw?.rects)
      ? raw.rects
      : Array.isArray(raw?.boxes)
        ? raw.boxes
        : [];

  const rectangles = sourceRects
    .map((rect, index) => ({
      id: rect.id || `rect-${index + 1}`,
      x: clampNonNegative(numberOrNull(rect.x) ?? 0),
      y: clampNonNegative(numberOrNull(rect.y) ?? 0),
      width: clampNonNegative(numberOrNull(rect.width) ?? numberOrNull(rect.w) ?? 0),
      height: clampNonNegative(numberOrNull(rect.height) ?? numberOrNull(rect.h) ?? 0),
    }))
    .filter((rect) => rect.width > 0 && rect.height > 0);

  return {
    image: {
      width,
      height,
    },
    rectangles,
  };
}

function renderDefaultWorkspace(title = "Bereit") {
  viewTitle.textContent = title;
  contextBadge.textContent = state.rootFolderName
    ? `${state.rootFolderName} ausgewählt`
    : "Kein Ordner geladen";

  workspace.innerHTML = `
    <div class="placeholder-card">
      <h3>Bereit</h3>
      <p>Wähle links einen Unterordner aus der Liste aus.</p>
      <p class="meta-text">${escapeHtml(title)}</p>
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
          <p class="editor-note">Ziehe Rechtecke über Bereiche, die beim Lernen verdeckt sein sollen.</p>
        </div>
        <div class="toolbar-actions">
          <button id="undoRectBtn" class="btn btn-secondary" type="button">Letztes löschen</button>
          <button id="clearRectsBtn" class="btn btn-danger" type="button">Alle löschen</button>
          <button id="downloadCoverBtn" class="btn btn-primary" type="button">cover.json downloaden</button>
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
  anchor.download = "cover.json";
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

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Datei konnte nicht gelesen werden."));
    reader.readAsText(file);
  });
}

function readImageAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("Bild konnte nicht gelesen werden."));
    reader.readAsDataURL(file);
  });
}

function getImageDimensions(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = reject;
    img.src = src;
  });
}

function getExtension(fileName) {
  const parts = fileName.toLowerCase().split(".");
  return parts.length > 1 ? parts.pop() : "";
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

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

renderDefaultWorkspace();
