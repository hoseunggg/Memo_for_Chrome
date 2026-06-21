/*
  editor.js
  ---------
  textarea 본문, titlebar 파일명, 단어/글자 수, txt 다운로드를 담당한다.
  파일 트리 구조 자체는 tree.js에 맡기고, 여기서는 "현재 파일의 내용"에 집중한다.
*/

import { DEFAULTS } from './constants.js';
import { t } from './i18n.js';
import { createId, persistStore } from './store.js';
import { safeFileName } from './utils.js';

/* 현재 textarea와 연결된 파일 객체를 찾는다. */
export function getActiveFile(app) {
  return app.state.memoStore.files.find(file => file.id === app.state.activeFileId) || null;
}

/* editor 계층의 public API를 만든다. app.editor로 붙는다. */
export function createEditor(app) {
  /* activeFileId 기준으로 textarea에 내용을 채운다. */
  function loadActiveFile() {
    const activeFile = getActiveFile(app);
    app.refs.memoBody.value = activeFile?.content || '';
    updateStats();
    updateTitle();
  }

  /* textarea 내용을 현재 파일에 저장한다. 파일명은 본문 첫 줄과 분리해서 유지한다. */
  function saveActiveFile() {
    let activeFile = getActiveFile(app);

    if (!activeFile) {
      /* active 파일이 없는데 저장이 호출되면 현재 폴더에 새 파일을 만든다. */
      activeFile = {
        id: createId('file'),
        folderId: app.state.selectedFolderId || app.state.memoStore.folders[0]?.id || DEFAULTS.rootFolderId,
        title: app.state.draftTitle || DEFAULTS.title,
        content: '',
        customTitle: Boolean(app.state.draftTitle && app.state.draftTitle !== DEFAULTS.title),
        updatedAt: Date.now()
      };
      app.state.memoStore.files.unshift(activeFile);
      app.state.activeFileId = activeFile.id;
      app.state.selectedFileIds = new Set([activeFile.id]);
      app.state.lastSelectedFileId = activeFile.id;
    }

    activeFile.content = app.refs.memoBody.value;
    activeFile.updatedAt = Date.now();
    persistStore(app);
    updateTitle();
    updateStats();
    app.tree.renderFileTree();
  }

  /* 입력마다 바로 저장하지 않고 잠깐 기다렸다 저장한다. */
  function debouncedSave() {
    if (!getActiveFile(app)) return;
    clearTimeout(app.state.saveTimer);
    app.state.saveTimer = setTimeout(saveActiveFile, 180);
  }

  /* 새 파일을 만들고 editor를 빈 상태로 전환한다. */
  function createFile() {
    const activeFile = getActiveFile(app);
    if (activeFile) saveActiveFile();

    const folderId = app.state.selectedFolderId || app.state.memoStore.folders[0]?.id || DEFAULTS.rootFolderId;
    const file = {
      id: createId('file'),
      folderId,
      title: DEFAULTS.title,
      content: '',
      customTitle: false,
      updatedAt: Date.now()
    };

    app.state.memoStore.files.unshift(file);
    app.state.activeFileId = file.id;
    app.state.selectedFolderId = folderId;
    app.state.selectedFileIds = new Set([file.id]);
    app.state.lastSelectedFileId = file.id;
    app.refs.memoBody.value = '';
    updateStats();
    updateTitle();
    persistStore(app);
    app.tree.renderFileTree();
    app.refs.memoBody.focus();
  }

  /* 앱 시작 시 이전 active 파일을 열고, 파일이 하나도 없을 때만 새 파일을 만든다. */
  function openInitialFile() {
    const activeFile = getActiveFile(app);
    if (!activeFile) {
      createFile();
      return;
    }

    app.state.selectedFolderId = activeFile.folderId;
    app.state.selectedFileIds = new Set([activeFile.id]);
    app.state.lastSelectedFileId = activeFile.id;
    loadActiveFile();
    app.tree.renderFileTree();
    persistStore(app, { sync: false });
    app.refs.memoBody.focus();
  }

  /* 파일 트리에서 파일을 클릭했을 때 현재 파일을 저장한 뒤 선택 파일을 연다. */
  function openFile(fileId) {
    if (getActiveFile(app)) saveActiveFile();
    app.state.activeFileId = fileId;
    app.state.selectedFileIds = new Set([fileId]);
    app.state.lastSelectedFileId = fileId;
    app.state.selectedFolderId = getActiveFile(app)?.folderId || app.state.selectedFolderId;
    loadActiveFile();
    app.tree.renderFileTree();
    persistStore(app);
    app.refs.memoBody.focus();
  }

  /* 현재 파일의 내용을 비우고 저장한다. */
  function clearActiveFile() {
    app.refs.memoBody.value = '';
    saveActiveFile();
    app.refs.memoBody.focus();
  }

  /* footer 오른쪽 단어/글자 수를 현재 언어로 갱신한다. */
  function updateStats() {
    const text = app.refs.memoBody.value.trim();
    const words = text ? text.split(/\s+/).length : 0;
    const chars = app.refs.memoBody.value.length;
    app.refs.memoStats.textContent = `${words} ${t('words')} · ${chars} ${t('chars')}`;
  }

  /* titlebar의 파일명과 footer 왼쪽 제작자 문구를 갱신한다. */
  function updateTitle() {
    const activeFile = getActiveFile(app);
    const fileTitle = activeFile?.title || app.state.draftTitle || DEFAULTS.title;
    app.refs.documentTitle.textContent = `${fileTitle} - ${t('appTitle')}`;
    app.refs.filePath.textContent = t('builtBy');
  }

  /* titlebar 파일명을 input으로 바꿔 직접 수정할 수 있게 한다. */
  function beginTitleEdit() {
    const activeFile = getActiveFile(app);
    app.refs.documentTitle.hidden = true;
    app.refs.documentTitleInput.hidden = false;
    app.refs.documentTitleInput.value = activeFile?.title || app.state.draftTitle || DEFAULTS.title;
    app.refs.documentTitleInput.focus();
    app.refs.documentTitleInput.select();
  }

  /* titlebar input 값을 파일명으로 저장한다. */
  function commitTitleEdit() {
    if (app.refs.documentTitleInput.hidden) return;

    const name = app.refs.documentTitleInput.value.trim() || DEFAULTS.title;
    const activeFile = getActiveFile(app);
    if (activeFile) {
      activeFile.title = name;
      activeFile.customTitle = true;
      activeFile.updatedAt = Date.now();
      persistStore(app);
      app.tree.renderFileTree();
    } else {
      app.state.draftTitle = name;
    }

    app.refs.documentTitle.hidden = false;
    app.refs.documentTitleInput.hidden = true;
    updateTitle();
  }

  /* 파일명 편집을 취소하고 버튼 상태로 되돌린다. */
  function cancelTitleEdit() {
    app.refs.documentTitle.hidden = false;
    app.refs.documentTitleInput.hidden = true;
  }

  /* 현재 textarea 내용을 선택한 확장자로 내려받는다. Drive 저장과 별개다. */
  function saveFileToDisk(format = 'txt') {
    const activeFile = getActiveFile(app);
    const title = activeFile?.title || DEFAULTS.title;
    const extension = format === 'md' ? 'md' : 'txt';
    const mimeType = extension === 'md' ? 'text/markdown;charset=utf-8' : 'text/plain;charset=utf-8';
    const blob = new Blob([app.refs.memoBody.value], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${safeFileName(title)}.${extension}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  return {
    loadActiveFile,
    saveActiveFile,
    debouncedSave,
    createFile,
    openInitialFile,
    openFile,
    clearActiveFile,
    updateStats,
    updateTitle,
    beginTitleEdit,
    commitTitleEdit,
    cancelTitleEdit,
    saveFileToDisk
  };
}
