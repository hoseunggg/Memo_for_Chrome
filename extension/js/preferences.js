/*
  preferences.js
  --------------
  테마, 폰트, 언어 같은 사용자 설정 계층이다.
  설정값을 localStorage에 저장하고, 관련 UI 상태도 같이 갱신한다.
*/

import { DEFAULTS, STORAGE_KEYS } from './constants.js';
import { t } from './i18n.js';

/* preferences 계층의 public API를 만든다. app.preferences로 붙는다. */
export function createPreferences(app) {
  /* light/dark class와 버튼 active 상태를 동시에 갱신한다. */
  function setTheme(theme) {
    const nextTheme = theme === 'dark' ? 'dark' : DEFAULTS.theme;
    app.refs.body.classList.toggle('dark', nextTheme === 'dark');
    app.refs.body.classList.toggle('light', nextTheme === 'light');
    app.refs.settingLight.classList.toggle('active', nextTheme === 'light');
    app.refs.settingDark.classList.toggle('active', nextTheme === 'dark');
    localStorage.setItem(STORAGE_KEYS.theme, nextTheme);
    if (app.state.autoSyncReady && !app.state.applyingDrivePayload) app.drive.scheduleDriveSave();
  }

  /* body[data-font]를 바꿔 CSS에서 textarea 글꼴을 변경하게 한다. */
  function setFont(font) {
    const fonts = Array.from(app.refs.fontOptions).map(button => button.dataset.font);
    const nextFont = fonts.includes(font) ? font : DEFAULTS.font;
    const activeButton = Array.from(app.refs.fontOptions).find(button => button.dataset.font === nextFont);

    app.refs.body.dataset.font = nextFont;
    app.refs.fontOptions.forEach(button => {
      button.classList.toggle('active', button.dataset.font === nextFont);
    });

    if (activeButton) {
      /* 현재 선택된 폰트 버튼에도 실제 폰트 이름/미리보기 문구를 복사한다. */
      app.refs.fontCurrent.className = `font-current ${activeButton.className.replace('font-option', '').replace('active', '').trim()}`;
      app.refs.fontCurrent.querySelector('span').textContent = activeButton.querySelector('span').textContent;
      app.refs.fontCurrent.querySelector('small').textContent = activeButton.querySelector('small').textContent;
    }

    localStorage.setItem(STORAGE_KEYS.font, nextFont);
    if (app.state.autoSyncReady && !app.state.applyingDrivePayload) app.drive.scheduleDriveSave();
  }

  /* UI 언어를 바꾸고, 고정 문구/제목/통계/Drive 상태 문구를 다시 그린다. */
  function setLanguage(language) {
    const nextLanguage = language === 'ko' ? 'ko' : DEFAULTS.language;
    document.documentElement.lang = nextLanguage;
    localStorage.setItem(STORAGE_KEYS.language, nextLanguage);
    app.refs.settingEnglish.classList.toggle('active', nextLanguage === 'en');
    app.refs.settingKorean.classList.toggle('active', nextLanguage === 'ko');
    translateStaticUi();
    app.editor.updateTitle();
    app.editor.updateStats();
    if (app.state.driveStatusKey) app.refs.driveStatus.textContent = t(app.state.driveStatusKey);
    if (app.state.autoSyncReady && !app.state.applyingDrivePayload) app.drive.scheduleDriveSave();
  }

  /* HTML에 박혀 있던 정적 문구들을 현재 언어 기준으로 바꾼다. */
  function translateStaticUi() {
    app.refs.saveFile.title = t('save');
    app.refs.saveFile.setAttribute('aria-label', t('save'));
    app.refs.downloadFile.title = t('download');
    app.refs.downloadFile.setAttribute('aria-label', t('download'));
    app.refs.newFile.title = t('newFile');
    app.refs.newFile.setAttribute('aria-label', t('newFile'));
    app.refs.treeNewFile.title = t('newFile');
    app.refs.treeNewFile.setAttribute('aria-label', t('newFile'));
    app.refs.fileList.title = t('files');
    app.refs.fileList.setAttribute('aria-label', t('files'));
    if (app.refs.driveConnect) app.refs.driveConnect.textContent = t('drive');
    app.refs.settings.title = t('settings');
    app.refs.settings.setAttribute('aria-label', t('settings'));
    app.refs.themeLabel.textContent = t('theme');
    app.refs.settingLight.textContent = t('light');
    app.refs.settingDark.textContent = t('dark');
    app.refs.languageLabel.textContent = t('language');
    app.refs.settingEnglish.textContent = t('english');
    app.refs.settingKorean.textContent = t('korean');
    app.refs.fontLabel.textContent = t('font');
    app.refs.newFolder.title = t('newFolder');
    app.refs.newFolder.setAttribute('aria-label', t('newFolder'));
    app.refs.deleteItem.title = t('delete');
    app.refs.deleteItem.setAttribute('aria-label', t('delete'));
    app.refs.contextRename.textContent = t('rename');
    app.refs.contextDelete.textContent = t('delete');
    app.refs.clearMemo.setAttribute('aria-label', t('clearMemo'));
    app.refs.clearMemo.setAttribute('title', t('clearMemo'));
    document.querySelector('.file-panel-header > span').textContent = t('files');
  }

  /* 앱 시작 시 localStorage의 설정값을 읽어 UI에 적용한다. */
  function restorePreferences() {
    setTheme(localStorage.getItem(STORAGE_KEYS.theme) || DEFAULTS.theme);
    setFont(localStorage.getItem(STORAGE_KEYS.font) || DEFAULTS.font);
    setLanguage(localStorage.getItem(STORAGE_KEYS.language) || DEFAULTS.language);
  }

  return { setTheme, setFont, setLanguage, translateStaticUi, restorePreferences };
}
