/*
  events.js
  ---------
  DOM 이벤트 연결 계층이다.
  실제 동작은 editor/tree/preferences/drive에 맡기고, 여기서는 어떤 이벤트가 어떤 함수로 가는지만 묶는다.
*/

import { DEFAULTS } from './constants.js';

/* 전체 이벤트 바인딩 진입점이다. bootstrap에서 한 번만 호출한다. */
export function bindEvents(app) {
  bindMemoEvents(app);
  bindTitleEvents(app);
  bindPanelEvents(app);
  bindFontEvents(app);
  bindFileEvents(app);
  bindDriveEvents(app);
  bindContextEvents(app);
}

/* textarea 입력/클릭/포커스와 메모 비우기 버튼 이벤트다. */
function bindMemoEvents(app) {
  app.refs.memoBody.addEventListener('input', () => {
    app.editor.updateStats();
    app.editor.debouncedSave();
    app.editor.updateTitle();
  });
  app.refs.memoBody.addEventListener('click', () => {
    closeBannerPanels(app);
    closeDownloadMenu(app);
    app.editor.updateStats();
  });
  app.refs.memoBody.addEventListener('focus', () => {
    closeBannerPanels(app);
    closeDownloadMenu(app);
  });
  app.refs.clearMemo.addEventListener('click', app.editor.clearActiveFile);
}

/* titlebar 파일명 편집 이벤트다. */
function bindTitleEvents(app) {
  app.refs.documentTitle.addEventListener('click', app.editor.beginTitleEdit);
  app.refs.documentTitleInput.addEventListener('blur', app.editor.commitTitleEdit);
  app.refs.documentTitleInput.addEventListener('keydown', event => {
    if (event.key === 'Enter') app.editor.commitTitleEdit();
    if (event.key === 'Escape') app.editor.cancelTitleEdit();
  });
}

/* Settings, Files, New file처럼 상단 메뉴와 패널을 여는 이벤트다. */
function bindPanelEvents(app) {
  app.refs.settingLight.addEventListener('click', () => app.preferences.setTheme(DEFAULTS.theme));
  app.refs.settingDark.addEventListener('click', () => app.preferences.setTheme('dark'));
  app.refs.settingEnglish.addEventListener('click', () => app.preferences.setLanguage('en'));
  app.refs.settingKorean.addEventListener('click', () => app.preferences.setLanguage('ko'));
  app.refs.settings.addEventListener('click', () => toggleSettings(app));
  app.refs.fontCurrent.addEventListener('click', () => toggleFontList(app));
  app.refs.fileList.addEventListener('click', () => toggleFilePanel(app));
  app.refs.newFile.addEventListener('click', app.editor.createFile);
  app.refs.treeNewFile.addEventListener('click', app.editor.createFile);
  app.refs.newFolder.addEventListener('click', app.tree.createFolder);
  app.refs.deleteItem.addEventListener('click', app.tree.deleteSelectedItem);
}

/* 폰트 dropdown 안의 각 폰트 버튼 이벤트다. */
function bindFontEvents(app) {
  app.refs.fontOptions.forEach(button => {
    button.addEventListener('click', () => {
      app.preferences.setFont(button.dataset.font);
      app.refs.fontList.hidden = true;
      app.refs.fontCurrent.setAttribute('aria-expanded', 'false');
    });
  });
}

/* 명시 저장과 로컬 다운로드 버튼 이벤트다. */
function bindFileEvents(app) {
  app.refs.saveFile.addEventListener('click', () => {
    clearTimeout(app.state.saveTimer);
    app.editor.saveActiveFile();
    app.drive.syncToDrive();
  });
  app.refs.downloadFile.addEventListener('click', () => toggleDownloadMenu(app));
  app.refs.downloadOptions.forEach(button => {
    button.addEventListener('click', () => {
      app.editor.saveFileToDisk(button.dataset.format);
      closeDownloadMenu(app);
    });
  });
}

/* Drive 자동 연결이 실패했을 때 상태바를 클릭해서 권한창을 다시 띄운다. */
function bindDriveEvents(app) {
  app.refs.driveStatus.addEventListener('click', () => app.drive.connectDrive({ resetAuth: true }));
  app.refs.driveConnect?.addEventListener('click', () => {
    closeBannerPanels(app);
    app.drive.connectDrive({ resetAuth: true });
  });
}

/* 파일 트리 우클릭 메뉴 이벤트다. */
function bindContextEvents(app) {
  app.refs.contextRename.addEventListener('click', app.tree.renameContextTarget);
  app.refs.contextDelete.addEventListener('click', app.tree.deleteContextTarget);
  document.addEventListener('click', event => {
    if (!app.refs.contextMenu.hidden && !app.refs.contextMenu.contains(event.target)) {
      app.refs.contextMenu.hidden = true;
    }
  });
}

/* Settings 패널을 열고 닫는다. */
function toggleSettings(app) {
  const willOpen = app.refs.settingsPanel.hidden;
  closeBannerPanels(app);
  closeDownloadMenu(app);
  if (willOpen) {
    app.refs.settingsPanel.hidden = false;
    app.refs.settings.classList.add('active');
  }
}

/* 현재 폰트 버튼 아래 dropdown을 열고 닫는다. */
function toggleFontList(app) {
  const willOpen = app.refs.fontList.hidden;
  closeDownloadMenu(app);
  app.refs.fontList.hidden = !willOpen;
  app.refs.fontCurrent.setAttribute('aria-expanded', String(willOpen));
}

/* Files 패널을 열고 닫고, 열릴 때 파일 트리를 다시 그린다. */
function toggleFilePanel(app) {
  const willOpen = app.refs.filePanel.hidden;
  closeBannerPanels(app);
  closeDownloadMenu(app);
  if (willOpen) {
    app.refs.filePanel.hidden = false;
    app.refs.fileList.classList.add('active');
    app.tree.renderFileTree();
  }
}

/* 메모 본문을 클릭하면 상단 배너에서 열려 있던 패널들을 모두 닫는다. */
function closeBannerPanels(app) {
  app.refs.settingsPanel.hidden = true;
  app.refs.settings.classList.remove('active');
  app.refs.fontList.hidden = true;
  app.refs.fontCurrent.setAttribute('aria-expanded', 'false');
  app.refs.filePanel.hidden = true;
  app.refs.fileList.classList.remove('active');
  app.refs.contextMenu.hidden = true;
}

function toggleDownloadMenu(app) {
  const willOpen = app.refs.downloadMenu.hidden;
  closeBannerPanels(app);
  app.refs.downloadMenu.hidden = !willOpen;
  app.refs.downloadFile.setAttribute('aria-expanded', String(willOpen));
}

function closeDownloadMenu(app) {
  app.refs.downloadMenu.hidden = true;
  app.refs.downloadFile.setAttribute('aria-expanded', 'false');
}
