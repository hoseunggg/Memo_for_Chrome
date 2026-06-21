/*
  dom.js
  ------
  HTML 요소 참조를 한 번에 모으는 계층이다.
  다른 모듈에서 document.getElementById를 흩뿌리지 않기 위해 refs 객체로 전달한다.
*/

/* memo.html의 id/class와 JS 사이의 연결 지점이다. */
export function getRefs() {
  return {
    body: document.body,
    documentTitle: document.getElementById('document-title'),
    documentTitleInput: document.getElementById('document-title-input'),
    memoBody: document.getElementById('memo-body'),
    memoStats: document.getElementById('memo-stats'),
    filePath: document.getElementById('file-path'),
    saveFile: document.getElementById('save-file'),
    downloadFile: document.getElementById('download-file'),
    downloadMenu: document.getElementById('download-menu'),
    downloadOptions: document.querySelectorAll('[data-format]'),
    driveStatus: document.getElementById('drive-status'),
    driveConnect: document.getElementById('drive-connect'),
    newFile: document.getElementById('new-file'),
    fileList: document.getElementById('file-list'),
    filePanel: document.getElementById('file-panel'),
    fileTree: document.getElementById('file-tree'),
    treeNewFile: document.getElementById('tree-new-file'),
    newFolder: document.getElementById('new-folder'),
    deleteItem: document.getElementById('delete-item'),
    settings: document.getElementById('settings'),
    settingsPanel: document.getElementById('settings-panel'),
    themeLabel: document.getElementById('theme-label'),
    settingLight: document.getElementById('setting-light'),
    settingDark: document.getElementById('setting-dark'),
    settingEnglish: document.getElementById('setting-english'),
    settingKorean: document.getElementById('setting-korean'),
    languageLabel: document.getElementById('language-label'),
    fontLabel: document.getElementById('font-label'),
    fontCurrent: document.getElementById('font-current'),
    fontList: document.getElementById('font-list'),
    fontOptions: document.querySelectorAll('.font-option'),
    contextMenu: document.getElementById('context-menu'),
    contextRename: document.getElementById('context-rename'),
    contextDelete: document.getElementById('context-delete'),
    clearMemo: document.getElementById('clear-memo')
  };
}
