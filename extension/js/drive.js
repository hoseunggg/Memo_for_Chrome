/*
  drive.js
  --------
  Google Drive 자동 동기화 계층이다.
  실제 Drive API 호출은 background.js가 맡고, 이 모듈은 runtime message만 보낸다.
*/

import { DRIVE_MESSAGES } from './constants.js';
import { t } from './i18n.js';
import { applySyncPayload, createSyncPayload, persistStore } from './store.js';

function withTimeout(promise, message, timeout = 14000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeout);
    })
  ]);
}

/* Chrome extension popup/page에서 background service worker로 메시지를 보낸다. */
async function sendDriveMessage(type, payload, options = {}) {
  if (typeof chrome === 'undefined' || !chrome.runtime?.sendMessage) {
    throw new Error('Drive sync only works inside the Chrome extension.');
  }

  const response = await withTimeout(
    chrome.runtime.sendMessage({ type, payload, ...options }),
    'Drive connection timed out. Click to connect again.'
  );
  if (!response?.ok) {
    throw new Error(response?.error || 'Drive sync failed.');
  }
  return response.result;
}

/* Drive 관련 동작을 app context에 묶어 반환한다. */
export function createDrive(app) {
  /* 에러처럼 번역 key가 아닌 실제 문구를 그대로 보여줄 때 사용한다. */
  function setDriveStatus(message) {
    app.state.driveStatusKey = null;
    app.refs.driveStatus.textContent = message;
    app.refs.driveStatus.title = message;
    app.refs.driveStatus.classList.remove('is-action');
    app.refs.driveConnect?.classList.remove('active');
  }

  /* 언어 변경 시 다시 번역할 수 있는 Drive 상태 문구를 key로 저장한다. */
  function setDriveStatusKey(key) {
    app.state.driveStatusKey = key;
    const message = t(key);
    app.refs.driveStatus.textContent = message;
    app.refs.driveStatus.title = message;
    app.refs.driveStatus.classList.toggle('is-action', key === 'driveConnectAction');
    app.refs.driveConnect?.classList.toggle('active', key === 'driveConnecting' || key === 'driveSyncing');
  }

  function setDriveConnectAction(errorMessage) {
    const message = t('driveConnectAction');
    app.state.driveStatusKey = 'driveConnectAction';
    app.refs.driveStatus.textContent = message;
    app.refs.driveStatus.title = errorMessage ? `${errorMessage} - ${message}` : message;
    app.refs.driveStatus.classList.add('is-action');
    app.refs.driveConnect?.classList.add('active');
  }

  function setDriveLoadedStatus(count) {
    const message = t('driveLoaded').replace('{count}', String(count));
    app.state.driveStatusKey = null;
    app.refs.driveStatus.textContent = message;
    app.refs.driveStatus.title = message;
    app.refs.driveStatus.classList.remove('is-action');
    app.refs.driveConnect?.classList.remove('active');
  }

  function stopDriveSync() {
    app.state.autoSyncReady = false;
    clearTimeout(app.state.driveSyncTimer);
    app.state.driveSyncTimer = null;
    stopRemotePolling();
  }

  function handleDriveFailure(error) {
    stopDriveSync();
    const message = error.message || t('driveSyncFailed');
    setDriveConnectAction(message);
  }

  /* 메모가 바뀔 때마다 즉시 업로드하지 않고 700ms 뒤 저장을 예약한다. */
  function scheduleDriveSave(delay = 1200) {
    if (!app.state.autoSyncReady || app.state.applyingDrivePayload) return;
    clearTimeout(app.state.driveSyncTimer);
    app.state.driveSyncTimer = setTimeout(() => {
      app.state.driveSyncTimer = null;
      syncToDrive();
    }, delay);
  }

  /* 현재 앱 상태를 Drive에 저장한다. 저장 중 변경이 생기면 queued로 한 번 더 저장한다. */
  async function syncToDrive() {
    if (!app.state.autoSyncReady) return;

    if (app.state.driveSyncInFlight) {
      app.state.driveSyncQueued = true;
      return;
    }

    app.state.driveSyncInFlight = true;
    try {
      setDriveStatusKey('driveSyncing');
      const meta = await sendDriveMessage(DRIVE_MESSAGES.save, createSyncPayload(app));
      if (meta?.modifiedTime) {
        app.state.lastRemoteModifiedTime = meta.modifiedTime;
      }
      if (meta?.memoStore) {
        app.state.applyingDrivePayload = true;
        app.state.memoStore = meta.memoStore;
        persistStore(app, { sync: false });
        app.state.applyingDrivePayload = false;
        app.tree.renderFileTree();
      }
      setDriveStatusKey('driveSynced');
    } catch (error) {
      handleDriveFailure(error);
    } finally {
      /* 업로드 중 들어온 변경이 있으면 저장을 한 번 더 예약한다. */
      app.state.driveSyncInFlight = false;
      if (app.state.driveSyncQueued) {
        app.state.driveSyncQueued = false;
        scheduleDriveSave();
      }
    }
  }

  /* Drive의 Memo 폴더 안 항목들 중 가장 최근 modifiedTime을 확인해서 다른 기기 변경 여부를 판단한다. */
  async function checkRemoteChanges() {
    if (!app.state.autoSyncReady || app.state.remoteCheckInFlight || app.state.driveSyncInFlight) return;
    if (app.state.driveSyncTimer) return;

    app.state.remoteCheckInFlight = true;
    try {
      const meta = await sendDriveMessage(DRIVE_MESSAGES.meta);
      if (!meta?.modifiedTime) return;

      if (!app.state.lastRemoteModifiedTime) {
        app.state.lastRemoteModifiedTime = meta.modifiedTime;
        return;
      }

      if (meta.modifiedTime === app.state.lastRemoteModifiedTime) return;

      setDriveStatusKey('driveSyncing');
      const payload = await sendDriveMessage(DRIVE_MESSAGES.load);
      if (payload) {
        app.state.lastRemoteModifiedTime = meta.modifiedTime;
        applySyncPayload(app, payload);
      }
      setDriveStatusKey('driveSynced');
    } catch (error) {
      handleDriveFailure(error);
    } finally {
      app.state.remoteCheckInFlight = false;
    }
  }

  /* 확장 프로그램이 열려 있는 동안 5초마다 Drive 변경 여부를 확인한다. */
  function startRemotePolling() {
    stopRemotePolling();
    app.state.drivePollTimer = setInterval(checkRemoteChanges, 5000);
  }

  function stopRemotePolling() {
    if (app.state.drivePollTimer) {
      clearInterval(app.state.drivePollTimer);
      app.state.drivePollTimer = null;
    }
  }

  /* 앱 시작 시 Drive 백업을 먼저 불러오고, 이후 자동 저장을 활성화한다. */
  async function startDriveSync() {
    try {
      setDriveStatusKey('driveConnecting');
      await sendDriveMessage(DRIVE_MESSAGES.auth);
      const payload = await loadDrivePayloadWithRetry();

      if (payload) {
        if (payload.modifiedTime) {
          app.state.lastRemoteModifiedTime = payload.modifiedTime;
        }
        applySyncPayload(app, payload);
        setDriveLoadedStatus(payload.memoStore?.files?.length || 0);
      } else {
        setDriveStatusKey('driveCreating');
      }

      app.state.autoSyncReady = true;
      if (!payload) {
        await syncToDrive();
      }
      startRemotePolling();
      return true;
    } catch (error) {
      handleDriveFailure(error);
      return false;
    }
  }

  async function loadDrivePayloadWithRetry() {
    try {
      return await sendDriveMessage(DRIVE_MESSAGES.load, null, { interactive: true });
    } catch (error) {
      await sendDriveMessage(DRIVE_MESSAGES.resetAuth);
      await sendDriveMessage(DRIVE_MESSAGES.auth);
      return sendDriveMessage(DRIVE_MESSAGES.load, null, { interactive: true });
    }
  }

  /* 상태바 클릭처럼 사용자 동작 안에서 OAuth 권한창을 다시 요청한다. */
  async function connectDrive({ resetAuth = false } = {}) {
    if (app.state.driveConnectInFlight) return;

    app.state.driveConnectInFlight = true;
    try {
      setDriveStatusKey('driveConnecting');
      if (resetAuth) {
        await sendDriveMessage(DRIVE_MESSAGES.resetAuth);
      }
      await sendDriveMessage(DRIVE_MESSAGES.auth);
      await startDriveSync();
    } catch (error) {
      handleDriveFailure(error);
    } finally {
      app.state.driveConnectInFlight = false;
    }
  }

  return {
    setDriveStatus,
    setDriveStatusKey,
    scheduleDriveSave,
    syncToDrive,
    checkRemoteChanges,
    startRemotePolling,
    stopRemotePolling,
    startDriveSync,
    connectDrive
  };
}
