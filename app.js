const IMAGE_FILE_NAME = "image.png";
const COVER_FILE_NAME = "cover.json";
const GAP_LIMIT = 2;
const MISSING_STREAK_LIMIT = GAP_LIMIT + 1;
const STORAGE_KEY = "tap-cover:v8";

const folderList = document.getElementById("folderList");
const folderCount = document.getElementById("folderCount");
const refreshFoldersBtn = document.getElementById("refreshFoldersBtn");
const viewTitle = document.getElementById("viewTitle");
const contextBadge = document.getElementById("contextBadge");
const workspace = document.getElementById("workspace");
const openInfoBtn = document.getElementById("openInfoBtn");
const closeInfoBtn = document.getElementById("closeInfoBtn");
const infoModal = document.getElementById("infoModal");
const folderItemTemplate = document.getElementById("folderItemTemplate");

const state = {
  rootFolderUrl: new URL("./images/", document.baseURI).href,
  folders: [],
  activeFolderName: null,
  activeFolder: null,
  activeMode: null,
  storage: loadStorage(),
  editor: {
    imageUrl: null,
    imageFileName: null,
    imageNatural: null,
    rects: [],
    previewRect: null,
    pointer: null,
  },
  viewer: {
    imageUrl: null,
    imageFileName: null,
    imageNatural: null,
    rects: [],
    visibleMask: [],
  },
};

refreshFoldersBtn.addEventListener("click", loadFolders);
openInfoBtn.addEventListener("click", openInfoModal);
closeInfoBtn.addEventListener("click", closeInfoModal);
infoModal.addEventListener("click", (event) => {
  if (event.target === infoModal) {
    closeInfoModal();
  }
});
window.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !infoModal.classList.contains("hidden")) {
    closeInfoModal();
  }
});

function loadStorage() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return { folders: {} };
    }
    const parsed = JSON.parse(raw);
    return {
      folders: typeof parsed?.folders === "object" && parsed.folders ? parsed.folders : {},
    };
  } catch {
    return { folders: {} };
  }
}

function saveStorage() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.storage));
  } catch {
    // Ignore storage issues gracefully.
  }
}

function getFolderMemory(folderName) {
  return state.storage.folders?.[folderName] || {};
}

function patchFolderMemory(folderName, patch) {
  const current = getFolderMemory(folderName);
  state.storage.folders[folderName] = { ...current, ...patch };
  saveStorage();
}

function markFolderOpened(folderName) {
  patchFolderMemory(folderName, { lastOpenedAt: new Date().toISOString() });
}

function getSavedVisibleMask(folderName, rectCount) {
  const memory = getFolderMemory(folderName);
  if (!Array.isArray(memory.visibleMask) || memory.visibleMask.length !== rectCount) {
    return null;
  }
  return memory.visibleMask.map((value) => value !== false);
}

function saveCurrentVisibleMask() {
  if (!state.activeFolderName || !state.viewer.rects.length) {
    return;
  }
  patchFolderMemory(state.activeFolderName, {
    visibleMask: state.viewer.visibleMask.map((value) => value !== false),
  });
}

async function loadFolders() {
  refreshFoldersBtn.disabled = true;
  setFolderListLoading();

  try {
    const folders = await scanNumberedFolders();
    state.folders = folders;

    if (!folders.length) {
      renderDefaultWorkspace("Keine Einträge gefunden");
    }

    const activeFolderName = state.activeFolderName;
    renderFolderList();

    if (activeFolderName) {
      const stillExists = folders.find((folder) => folder.name === activeFolderName);
      if (stillExists) {
        await openFolder(stillExists.name, { silentAlert: true, updateLastOpened: false });
      } else {
        state.activeFolderName = null;
        state.activeFolder = null;
        state.activeMode = null;
        resetEditorState();
        resetViewerState();
        renderDefaultWorkspace("Aktiver Eintrag nicht mehr gefunden");
      }
    }
  } catch (error) {
    console.error(error);
    state.folders = [];
    folderCount.textContent = "0";
    folderList.className = "folder-list empty-state-list";
    folderList.textContent = "Laden fehlgeschlagen";
    renderDirectoryError(error);
  } finally {
    refreshFoldersBtn.disabled = false;
  }
}

function setFolderListLoading() {
  folderCount.textContent = "…";
  folderList.className = "folder-list empty-state-list";
  folderList.textContent = "Prüfe Einträge …";
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
  const imageUrl = new URL(`./${name}/${IMAGE_FILE_NAME}`, state.rootFolderUrl).href;
  const coverUrl = new URL(`./${name}/${COVER_FILE_NAME}`, state.rootFolderUrl).href;

  const hasImage = await resourceExists(imageUrl);
  const hasCover = await resourceExists(coverUrl);
  const exists = hasImage || hasCover;

  if (!exists) {
    return {
      name,
      index: folderNumber,
      exists: false,
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
    exists: true,
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
        // Ignore cancellation issues.
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
    folderList.textContent = "Keine passenden Einträge";
    return;
  }

  folderList.className = "folder-list";
  folderList.innerHTML = "";

  for (const folder of state.folders) {
    const fragment = folderItemTemplate.content.cloneNode(true);
    const button = fragment.querySelector(".folder-item");
    const nameEl = fragment.querySelector(".folder-item-name");
    const metaEl = fragment.querySelector(".folder-item-meta");
    const lastEl = fragment.querySelector(".folder-item-last");

    nameEl.textContent = folder.name;
    metaEl.textContent = buildFolderMeta(folder);
    lastEl.textContent = buildLastOpenedText(folder.name);

    if (state.activeFolderName === folder.name) {
      button.classList.add("active");
    }

    button.addEventListener("click", () => openFolder(folder.name));
    folderList.appendChild(fragment);
  }
}

function buildFolderMeta(folder) {
  if (!folder.hasImage) {
    return "ohne image";
  }
  if (folder.coverState === "invalid") {
    return "cover fehlerhaft";
  }
  if (!folder.hasCover) {
    return "ohne cover";
  }
  return "bereit";
}

function buildLastOpenedText(folderName) {
  const { lastOpenedAt } = getFolderMemory(folderName);
  if (!lastOpenedAt) {
    return "Noch nie geöffnet";
  }

  const date = new Date(lastOpenedAt);
  if (Number.isNaN(date.getTime())) {
    return "Noch nie geöffnet";
  }

  return `Zuletzt ${new Intl.DateTimeFormat("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date)}`;
}

async function openFolder(folderName, { silentAlert = false, updateLastOpened = true } = {}) {
  const folder = state.folders.find((entry) => entry.name === folderName);
  if (!folder) {
    return;
  }

  if (updateLastOpened) {
    markFolderOpened(folder.name);
  }

  state.activeFolderName = folder.name;
  state.activeFolder = folder;
  renderFolderList();

  try {
    if (!folder.imageUrl) {
      state.activeMode = null;
      if (!silentAlert) {
        window.alert(`Im Eintrag "${folder.name}" wurde keine ${IMAGE_FILE_NAME} gefunden.`);
      }
      renderDefaultWorkspace(`Eintrag ${folder.name}`);
      return;
    }

    if (folder.coverState === "invalid") {
      if (!silentAlert) {
        window.alert(`${COVER_FILE_NAME} in "${folder.name}" ist ungültig. Der Editor wird geöffnet.`);
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
  const response = await fetch(withProbeCacheBust(url), { cache: "no-store" });
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
  state.viewer.visibleMask = getSavedVisibleMask(folder.name, normalized.rectangles.length)
    || normalized.rectangles.map(() => true);

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
    image: { width, height },
    rectangles,
  };
}

function renderDefaultWorkspace(message = "Bereit") {
  viewTitle.textContent = "Bereit";
  contextBadge.textContent = "./images";
  workspace.innerHTML = `<div class="placeholder-card">${escapeHtml(message)}</div>`;
}

function renderDirectoryError(error) {
  viewTitle.textContent = "Fehler";
  contextBadge.textContent = "Laden";
  workspace.innerHTML = `<div class="error-card">${escapeHtml(error?.message || "Unbekannter Fehler")}</div>`;
}

function renderEditorWorkspace(folder) {
  viewTitle.textContent = folder.name;
  contextBadge.textContent = "Editor";

  workspace.innerHTML = `
    <div class="workspace-card">
      <div class="toolbar">
        <div class="toolbar-title">Ordner ${escapeHtml(folder.name)}</div>
        <div class="toolbar-actions">
          <button id="undoRectBtn" class="btn" type="button">Zurück</button>
          <button id="clearRectsBtn" class="btn btn-danger" type="button">Leeren</button>
          <button id="downloadCoverBtn" class="btn btn-primary" type="button">cover.json</button>
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
  viewTitle.textContent = folder.name;
  contextBadge.textContent = "Lernen";

  workspace.innerHTML = `
    <div class="workspace-card">
      <div class="toolbar">
        <div class="toolbar-title">Ordner ${escapeHtml(folder.name)}</div>
        <div class="toolbar-actions">
          <button id="revealAllBtn" class="btn" type="button">Alle auf</button>
          <button id="resetCoverBtn" class="btn" type="button">Alle zu</button>
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
    saveCurrentVisibleMask();
    renderViewerOverlay();
  });

  document.getElementById("resetCoverBtn").addEventListener("click", () => {
    state.viewer.visibleMask = state.viewer.rects.map(() => true);
    saveCurrentVisibleMask();
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
  saveCurrentVisibleMask();
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
