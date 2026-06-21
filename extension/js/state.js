/*
  state.js
  --------
  localStorage에 저장되는 데이터와 별개로, 현재 화면에서만 필요한 런타임 상태를 만든다.
  예: 지금 열린 파일, 선택된 폴더, 자동 저장 타이머, Drive 동기화 진행 여부.
*/

import { STORAGE_KEYS } from './constants.js';

function getInitialActiveFileId(store) {
  const savedActiveFileId = localStorage.getItem(STORAGE_KEYS.activeFile);
  if (store.files.some(file => file.id === savedActiveFileId)) {
    return savedActiveFileId;
  }

  return [...store.files].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0]?.id || null;
}

/* store는 영구 데이터이고, 여기서 만든 state는 앱 실행 중 바뀌는 현재 상태다. */
export function createState(store) {
  const activeFileId = getInitialActiveFileId(store);
  const activeFile = store.files.find(file => file.id === activeFileId) || null;

  return {
    /* 실제 파일/폴더 데이터. localStorage와 Drive에 저장되는 핵심 데이터다. */
    memoStore: store,
    /* 현재 textarea가 보여주는 파일 id다. */
    activeFileId,
    /* 새 파일/새 폴더를 만들 기준 폴더다. */
    selectedFolderId: activeFile?.folderId || store.folders[0]?.id || 'folder-root',
    /* Shift 선택이나 다중 삭제 같은 기능을 위한 선택 파일 집합이다. */
    selectedFileIds: activeFileId ? new Set([activeFileId]) : new Set(),
    lastSelectedFileId: activeFileId,
    /* rename/context menu처럼 파일 트리에서 잠깐 필요한 UI 상태다. */
    renamingItem: null,
    contextTarget: null,
    /* 아직 저장 파일이 없을 때 임시 제목으로 쓰는 값이다. */
    draftTitle: 'Untitled',
    /* 본문 자동 저장 debounce 타이머다. */
    saveTimer: null,
    /* Drive 자동 저장 debounce 타이머다. */
    driveSyncTimer: null,
    /* Drive 원격 변경 확인 폴링 타이머다. */
    drivePollTimer: null,
    /* 마지막으로 확인한 Drive JSON 파일 modifiedTime이다. */
    lastRemoteModifiedTime: null,
    /* 원격 변경 확인 요청이 겹치지 않게 막는 플래그다. */
    remoteCheckInFlight: false,
    /* Drive와 첫 연결이 끝난 뒤에만 자동 업로드를 허용한다. */
    autoSyncReady: false,
    /* Drive에서 내려받은 payload 적용 중에는 다시 Drive 저장을 예약하지 않기 위한 플래그다. */
    applyingDrivePayload: false,
    /* 업로드 중 새 변경이 생기면 queued로 표시했다가 한 번 더 저장한다. */
    driveSyncInFlight: false,
    driveSyncQueued: false,
    /* 사용자가 Drive 재연결을 연속으로 누르는 것을 막는다. */
    driveConnectInFlight: false,
    /* 언어 변경 시 Drive 상태 문구도 다시 번역하기 위한 상태 key다. */
    driveStatusKey: null
  };
}
