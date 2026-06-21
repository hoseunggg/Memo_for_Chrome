/*
  store.js
  --------
  영구 저장 계층이다.
  localStorage 읽기/쓰기, 기본 저장소 생성, Drive payload 생성/적용을 담당한다.
*/

import { DEFAULTS, STORAGE_KEYS } from './constants.js';

/* 파일/폴더 id가 겹치지 않도록 prefix + 시간 + 랜덤값으로 만든다. */
export function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/* 저장된 파일 트리가 없을 때 사용할 기본 폴더/파일 구조를 만든다. */
export function createDefaultStore() {
  /* 예전 단일 메모 버전 데이터가 남아 있으면 첫 파일 내용으로 가져온다. */
  const legacyContent = localStorage.getItem(STORAGE_KEYS.legacyContent) || '';

  return {
    folders: [
      { id: DEFAULTS.rootFolderId, name: 'Memo', parentId: null },
      { id: DEFAULTS.inboxFolderId, name: 'Inbox', parentId: DEFAULTS.rootFolderId }
    ],
    expandedFolders: [DEFAULTS.rootFolderId, DEFAULTS.inboxFolderId],
    files: [{
      id: DEFAULTS.welcomeFileId,
      folderId: DEFAULTS.inboxFolderId,
      title: DEFAULTS.title,
      content: legacyContent,
      customTitle: false,
      updatedAt: Date.now()
    }]
  };
}

/* localStorage에서 파일/폴더 구조를 읽는다. 없거나 깨졌으면 기본 구조로 복구한다. */
export function loadStore() {
  const saved = localStorage.getItem(STORAGE_KEYS.files);
  if (!saved) {
    const initialStore = createDefaultStore();
    localStorage.setItem(STORAGE_KEYS.files, JSON.stringify(initialStore));
    return initialStore;
  }

  try {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed.folders) && Array.isArray(parsed.files)) {
      parsed.expandedFolders = Array.isArray(parsed.expandedFolders)
        ? parsed.expandedFolders
        : parsed.folders.map(folder => folder.id);
      return parsed;
    }
  } catch {}

  return createDefaultStore();
}

/* 현재 memoStore를 localStorage에 저장하고, 필요하면 Drive 자동 저장도 예약한다. */
export function persistStore(app, { sync = true } = {}) {
  localStorage.setItem(STORAGE_KEYS.files, JSON.stringify(app.state.memoStore));
  localStorage.setItem(STORAGE_KEYS.activeFile, app.state.activeFileId || '');
  if (sync && app.state.autoSyncReady && !app.state.applyingDrivePayload) {
    app.drive.scheduleDriveSave();
  }
}

/* Drive에 저장할 전체 백업 묶음이다. 파일 데이터와 사용자 설정을 같이 싣는다. */
export function createSyncPayload(app) {
  return {
    version: 1,
    savedAt: new Date().toISOString(),
    memoStore: app.state.memoStore,
    activeFileId: app.state.activeFileId,
    theme: localStorage.getItem(STORAGE_KEYS.theme) || DEFAULTS.theme,
    font: localStorage.getItem(STORAGE_KEYS.font) || DEFAULTS.font,
    language: localStorage.getItem(STORAGE_KEYS.language) || DEFAULTS.language
  };
}

/* Drive에서 내려받은 백업을 현재 앱 상태와 localStorage에 적용한다. */
export function applySyncPayload(app, payload) {
  if (!payload?.memoStore || !Array.isArray(payload.memoStore.folders) || !Array.isArray(payload.memoStore.files)) {
    throw new Error('Invalid Drive memo data.');
  }

  app.state.memoStore = payload.memoStore;
  app.state.memoStore.expandedFolders = Array.isArray(app.state.memoStore.expandedFolders)
    ? app.state.memoStore.expandedFolders
    : app.state.memoStore.folders.map(folder => folder.id);
  app.state.activeFileId = payload.activeFileId && payload.memoStore.files.some(file => file.id === payload.activeFileId)
    ? payload.activeFileId
    : [...payload.memoStore.files].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0]?.id || null;
  app.state.selectedFileIds = app.state.activeFileId ? new Set([app.state.activeFileId]) : new Set();
  app.state.lastSelectedFileId = app.state.activeFileId;
  /* Drive 데이터를 적용하는 동안에는 다시 Drive 저장이 예약되지 않게 막는다. */
  app.state.applyingDrivePayload = true;

  /* 파일 구조는 바로 저장하고, 테마/폰트/언어는 각 담당 모듈을 통해 UI까지 갱신한다. */
  persistStore(app, { sync: false });
  if (payload.theme) app.preferences.setTheme(payload.theme);
  if (payload.font) app.preferences.setFont(payload.font);
  if (payload.language) app.preferences.setLanguage(payload.language);
  app.state.applyingDrivePayload = false;

  /* 최종적으로 에디터와 파일 트리를 내려받은 상태로 다시 그린다. */
  app.editor.loadActiveFile();
  app.tree.renderFileTree();
}
