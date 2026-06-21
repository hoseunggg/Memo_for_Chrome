/*
  constants.js
  ------------
  앱 전체에서 공유하는 고정값만 모아둔다.
  다른 모듈이 문자열을 직접 반복하지 않게 해서 오타와 변경 비용을 줄인다.
*/

/* localStorage에 저장할 key 이름이다. */
export const STORAGE_KEYS = {
  legacyContent: 'web-memo-notepad-content',
  files: 'web-memo-files-v1',
  activeFile: 'web-memo-active-file',
  theme: 'theme',
  font: 'memo-font',
  language: 'memo-language'
};

/* 앱이 처음 켜졌을 때 또는 잘못된 값이 들어왔을 때 쓸 기본값이다. */
export const DEFAULTS = {
  title: 'Untitled',
  rootFolderId: 'folder-root',
  inboxFolderId: 'folder-inbox',
  welcomeFileId: 'file-welcome',
  theme: 'light',
  font: 'system',
  language: 'en'
};

/* popup 쪽 JS와 background service worker가 주고받는 메시지 type이다. */
export const DRIVE_MESSAGES = {
  auth: 'drive:auth',
  save: 'drive:save',
  load: 'drive:load',
  meta: 'drive:meta',
  resetAuth: 'drive:resetAuth'
};

/* 화면에 보이는 고정 문구 번역표다. 새 언어를 추가하면 이 객체에 같은 key를 채우면 된다. */
export const I18N = {
  en: {
    appTitle: 'Memo for Chrome',
    save: 'Save',
    download: 'Download',
    newFile: 'New file',
    files: 'Files',
    drive: 'Drive',
    settings: 'Settings',
    theme: 'Theme',
    light: 'Light',
    dark: 'Dark',
    language: 'Language',
    english: 'English',
    korean: '한국어',
    font: 'Font',
    newFolder: 'New folder',
    delete: 'Delete',
    rename: 'Rename',
    clearMemo: 'Clear memo',
    builtBy: 'Built by Hoseung',
    words: 'words',
    chars: 'chars',
    driveConnecting: 'Connecting Drive...',
    driveCreating: 'Creating Drive memo...',
    driveSyncing: 'Syncing...',
    driveSynced: 'Synced',
    driveLoaded: 'Loaded {count} Drive files',
    driveConnectAction: 'Click to connect Drive',
    driveSyncFailed: 'Drive sync failed'
  },
  ko: {
    appTitle: 'Chrome 메모장',
    save: '저장',
    download: '다운로드',
    newFile: '새 파일',
    files: '파일',
    drive: 'Drive',
    settings: '설정',
    theme: '테마',
    light: '라이트',
    dark: '다크',
    language: '언어',
    english: 'English',
    korean: '한국어',
    font: '글꼴',
    newFolder: '새 폴더',
    delete: '삭제',
    rename: '이름 변경',
    clearMemo: '메모 비우기',
    builtBy: 'Built by Hoseung',
    words: '단어',
    chars: '글자',
    driveConnecting: 'Drive 연결 중...',
    driveCreating: 'Drive 메모 생성 중...',
    driveSyncing: '동기화 중...',
    driveSynced: '동기화됨',
    driveLoaded: 'Drive 파일 {count}개 불러옴',
    driveConnectAction: '클릭해서 Drive 연결',
    driveSyncFailed: 'Drive 동기화 실패'
  }
};
