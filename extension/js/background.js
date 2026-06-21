/* Google Drive 루트에 자동 생성할 메모 폴더 이름이다. */
const DRIVE_FOLDER_NAME = 'Memo';

/* 예전 단일 JSON 백업 파일명이다. 새 방식에서는 이 파일을 읽기/쓰기 대상으로 쓰지 않는다. */
const LEGACY_DRIVE_FILE_NAME = 'memo-for-chrome-store.json';

const DRIVE_SCOPE_ERROR = 'Google Drive OAuth is not configured yet.';
const FOLDER_MIME = 'application/vnd.google-apps.folder';
const TEXT_MIME = 'text/plain';
const APP_PROPERTY_KEY = 'memoForChrome';
const APP_PROPERTY_ID = 'memoId';

chrome.action.onClicked.addListener(() => {
  chrome.tabs.create({ url: chrome.runtime.getURL('memo.html') });
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  handleMessage(message)
    .then(result => sendResponse({ ok: true, result }))
    .catch(error => sendResponse({ ok: false, error: error.message || String(error) }));
  return true;
});

async function handleMessage(message) {
  if (message?.type === 'drive:auth') {
    await getAuthToken(true);
    return { signedIn: true };
  }

  if (message?.type === 'drive:resetAuth') {
    await chrome.identity.clearAllCachedAuthTokens();
    return { cleared: true };
  }

  if (message?.type === 'drive:save') {
    return saveStoreToDrive(message.payload, message.interactive);
  }

  if (message?.type === 'drive:load') {
    return loadStoreFromDrive(message.interactive);
  }

  if (message?.type === 'drive:meta') {
    return getDriveMeta(message.interactive);
  }

  throw new Error('Unknown background message.');
}

async function getAuthToken(interactive = true) {
  if (chrome.runtime.getManifest().oauth2?.client_id?.startsWith('REPLACE_WITH_')) {
    throw new Error(DRIVE_SCOPE_ERROR);
  }

  const result = await chrome.identity.getAuthToken({ interactive });
  const token = typeof result === 'string' ? result : result?.token;

  if (!token) {
    throw new Error('Google Drive sign-in did not return an access token.');
  }

  return token;
}

function withTimeout(promise, message, timeout = 12000) {
  return Promise.race([
    promise,
    new Promise((_, reject) => {
      setTimeout(() => reject(new Error(message)), timeout);
    })
  ]);
}

async function driveFetch(url, options = {}, interactive = false, retryAuth = true) {
  const token = await withTimeout(
    getAuthToken(interactive),
    interactive
      ? 'Google Drive permission window did not respond. Try again.'
      : 'Google Drive is not connected yet.'
  );
  let response;

  try {
    response = await withTimeout(
      fetch(url, {
        ...options,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(options.headers || {})
        }
      }),
      'Google Drive API request timed out.'
    );
  } catch {
    throw new Error('Cannot reach Google Drive API. Check extension site access for googleapis.com and make sure Google Drive API is enabled.');
  }

  if (response.status === 401) {
    await chrome.identity.removeCachedAuthToken({ token });
    if (retryAuth && interactive) {
      return driveFetch(url, options, interactive, false);
    }
    throw new Error('Google session expired. Try again.');
  }

  if (!response.ok) {
    const text = await response.text();
    let message = text || `Google Drive request failed: ${response.status}`;
    try {
      const data = JSON.parse(text);
      message = data.error?.message || message;
    } catch {}
    if (response.status === 403 && retryAuth && interactive && /insufficient|permission|scope|auth/i.test(message)) {
      await chrome.identity.clearAllCachedAuthTokens();
      return driveFetch(url, options, interactive, false);
    }
    throw new Error(message);
  }

  return response;
}

function escapeDriveQuery(value) {
  return value.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function safeDriveName(value, fallback = 'Untitled') {
  return (value || fallback)
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 120) || fallback;
}

function textFileName(title) {
  const name = safeDriveName(title);
  return name.toLowerCase().endsWith('.txt') ? name : `${name}.txt`;
}

function titleFromDriveName(name) {
  return name.toLowerCase().endsWith('.txt') ? name.slice(0, -4) || 'Untitled' : name || 'Untitled';
}

async function ensureDriveFolder(interactive = false) {
  const folderName = escapeDriveQuery(DRIVE_FOLDER_NAME);
  const query = encodeURIComponent(
    `name='${folderName}' and mimeType='${FOLDER_MIME}' and 'root' in parents and trashed=false`
  );
  const fields = encodeURIComponent('files(id,name,modifiedTime,parents,appProperties)');
  const response = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}`, {}, interactive);
  const data = await response.json();

  if (data.files?.length) {
    return chooseMemoFolder(data.files, interactive);
  }

  const createResponse = await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name,modifiedTime,parents', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      name: DRIVE_FOLDER_NAME,
      mimeType: FOLDER_MIME,
      parents: ['root']
    })
  }, interactive);

  return createResponse.json();
}

async function chooseMemoFolder(folders, interactive = false) {
  if (folders.length === 1) {
    return folders[0];
  }

  const candidates = await Promise.all(folders.map(async folder => {
    const children = await listChildren(folder.id, interactive);
    const textFiles = children.filter(child =>
      child.mimeType !== FOLDER_MIME &&
      !child.mimeType?.startsWith('application/vnd.google-apps.') &&
      child.name !== LEGACY_DRIVE_FILE_NAME
    );
    return {
      folder,
      childCount: children.length,
      textFileCount: textFiles.length,
      modifiedTime: latestModifiedTime(children) || folder.modifiedTime || ''
    };
  }));

  return candidates
    .sort((a, b) =>
      b.textFileCount - a.textFileCount ||
      b.childCount - a.childCount ||
      b.modifiedTime.localeCompare(a.modifiedTime)
    )[0].folder;
}

async function listChildren(parentId, interactive = false) {
  const query = encodeURIComponent(`'${parentId}' in parents and trashed=false`);
  const fields = encodeURIComponent('files(id,name,mimeType,modifiedTime,parents,appProperties)');
  const response = await driveFetch(`https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}`, {}, interactive);
  const data = await response.json();
  return data.files || [];
}

async function listTree(rootId, interactive = false) {
  const all = [];

  async function walk(parentId) {
    const children = await listChildren(parentId, interactive);
    all.push(...children);

    for (const child of children) {
      if (child.mimeType === FOLDER_MIME) {
        await walk(child.id);
      }
    }
  }

  await walk(rootId);
  return all;
}

function createMultipartBody(metadata, content, mimeType = TEXT_MIME) {
  const boundary = `memo_boundary_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  return {
    boundary,
    payload:
      delimiter +
      'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
      JSON.stringify(metadata) +
      delimiter +
      `Content-Type: ${mimeType}; charset=UTF-8\r\n\r\n` +
      content +
      closeDelimiter
  };
}

async function createFolder(name, parentId, memoId, interactive = false) {
  const response = await driveFetch('https://www.googleapis.com/drive/v3/files?fields=id,name,modifiedTime,parents,appProperties', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({
      name,
      mimeType: FOLDER_MIME,
      parents: [parentId],
      appProperties: {
        [APP_PROPERTY_KEY]: 'true',
        [APP_PROPERTY_ID]: memoId
      }
    })
  }, interactive);

  return response.json();
}

async function patchMetadata(fileId, metadata, interactive = false) {
  const response = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?fields=id,name,modifiedTime,parents,appProperties`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify(metadata)
  }, interactive);

  return response.json();
}

async function uploadTextFile(existingId, name, parentId, memoId, content, interactive = false) {
  const metadata = {
    name,
    mimeType: TEXT_MIME,
    appProperties: {
      [APP_PROPERTY_KEY]: 'true',
      [APP_PROPERTY_ID]: memoId
    },
    ...(existingId ? {} : { parents: [parentId] })
  };
  const body = createMultipartBody(metadata, content || '', TEXT_MIME);
  const fields = encodeURIComponent('id,name,modifiedTime,parents,appProperties');
  const url = existingId
    ? `https://www.googleapis.com/upload/drive/v3/files/${existingId}?uploadType=multipart&fields=${fields}`
    : `https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=${fields}`;

  const response = await driveFetch(url, {
    method: existingId ? 'PATCH' : 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${body.boundary}` },
    body: body.payload
  }, interactive);

  return response.json();
}

async function moveIfNeeded(item, parentId, interactive = false) {
  if (!item?.id || item.parents?.includes(parentId)) {
    return item;
  }

  const removeParents = encodeURIComponent((item.parents || []).join(','));
  const addParents = encodeURIComponent(parentId);
  const fields = encodeURIComponent('id,name,modifiedTime,parents,appProperties');
  const response = await driveFetch(
    `https://www.googleapis.com/drive/v3/files/${item.id}?addParents=${addParents}&removeParents=${removeParents}&fields=${fields}`,
    { method: 'PATCH' },
    interactive
  );
  return response.json();
}

async function trashFile(fileId, interactive = false) {
  await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json; charset=UTF-8' },
    body: JSON.stringify({ trashed: true })
  }, interactive);
}

function findManagedItem(existingItems, memoId, parentId, mimeType) {
  return existingItems.find(item =>
    item.appProperties?.[APP_PROPERTY_KEY] === 'true' &&
    item.appProperties?.[APP_PROPERTY_ID] === memoId &&
    (!parentId || item.parents?.includes(parentId)) &&
    (!mimeType || item.mimeType === mimeType)
  ) || null;
}

function latestModifiedTime(items) {
  return items
    .map(item => item?.modifiedTime)
    .filter(Boolean)
    .sort()
    .at(-1) || null;
}

function folderDepth(folder, folderMap) {
  let depth = 0;
  let current = folder;
  while (current?.parentId) {
    depth += 1;
    current = folderMap.get(current.parentId);
  }
  return depth;
}

async function saveStoreToDrive(payload, interactive = false) {
  const root = await ensureDriveFolder(interactive);
  const existingItems = await listTree(root.id, interactive);
  const existingById = new Map(existingItems.map(item => [item.id, item]));
  const keepDriveIds = new Set([root.id]);
  const updatedStore = structuredClone(payload.memoStore);
  const folderMap = new Map(updatedStore.folders.map(folder => [folder.id, folder]));
  const changedItems = [];

  const rootFolder = updatedStore.folders.find(folder => folder.parentId === null) || updatedStore.folders[0];
  if (rootFolder) {
    rootFolder.driveId = root.id;
  }

  const sortedFolders = updatedStore.folders
    .filter(folder => folder !== rootFolder)
    .sort((a, b) => folderDepth(a, folderMap) - folderDepth(b, folderMap));

  for (const folder of sortedFolders) {
    const parentDriveId = folderMap.get(folder.parentId)?.driveId || root.id;
    const name = safeDriveName(folder.name, 'Folder');
    let driveFolder = folder.driveId ? existingById.get(folder.driveId) : null;
    driveFolder ||= findManagedItem(existingItems, folder.id, parentDriveId, FOLDER_MIME);

    if (driveFolder) {
      driveFolder = await patchMetadata(driveFolder.id, {
        name,
        appProperties: {
          [APP_PROPERTY_KEY]: 'true',
          [APP_PROPERTY_ID]: folder.id
        }
      }, interactive);
      driveFolder = await moveIfNeeded({ ...driveFolder, parents: existingById.get(driveFolder.id)?.parents }, parentDriveId, interactive);
    } else {
      driveFolder = await createFolder(name, parentDriveId, folder.id, interactive);
    }

    folder.driveId = driveFolder.id;
    keepDriveIds.add(driveFolder.id);
    changedItems.push(driveFolder);
  }

  const uploadedFiles = await Promise.all(updatedStore.files.map(async file => {
    const parentDriveId = folderMap.get(file.folderId)?.driveId || root.id;
    const name = textFileName(file.title);
    let driveFile = file.driveId ? existingById.get(file.driveId) : null;
    driveFile ||= findManagedItem(existingItems, file.id, parentDriveId, null);

    const uploaded = await uploadTextFile(driveFile?.id || null, name, parentDriveId, file.id, file.content || '', interactive);
    const moved = await moveIfNeeded({ ...uploaded, parents: driveFile?.parents || uploaded.parents }, parentDriveId, interactive);
    file.driveId = uploaded.id;
    return moved || uploaded;
  }));

  uploadedFiles.forEach(file => {
    keepDriveIds.add(file.id);
    changedItems.push(file);
  });

  const staleManagedItems = existingItems.filter(item =>
    item.appProperties?.[APP_PROPERTY_KEY] === 'true' &&
    !keepDriveIds.has(item.id)
  );
  await Promise.all(staleManagedItems.map(item => trashFile(item.id, interactive)));

  return {
    modifiedTime: latestModifiedTime(changedItems) || new Date().toISOString(),
    memoStore: updatedStore
  };
}

async function readDriveFileContent(fileId, interactive = false) {
  const response = await driveFetch(`https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`, {}, interactive);
  return response.text();
}

async function loadStoreFromDrive(interactive = false) {
  const root = await ensureDriveFolder(interactive);
  const items = await listTree(root.id, interactive);
  const folders = [{ id: 'folder-root', name: DRIVE_FOLDER_NAME, parentId: null, driveId: root.id }];
  const files = [];
  const folderIdByDriveId = new Map([[root.id, 'folder-root']]);

  const driveFolders = items
    .filter(item => item.mimeType === FOLDER_MIME)
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true }));

  for (const folder of driveFolders) {
    const parentDriveId = folder.parents?.[0] || root.id;
    const parentId = folderIdByDriveId.get(parentDriveId) || 'folder-root';
    const id = folder.appProperties?.[APP_PROPERTY_ID] || `folder-${folder.id}`;
    folderIdByDriveId.set(folder.id, id);
    folders.push({
      id,
      name: folder.name || 'Folder',
      parentId,
      driveId: folder.id
    });
  }

  const driveFiles = items
    .filter(item => item.mimeType !== FOLDER_MIME && item.name !== LEGACY_DRIVE_FILE_NAME)
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base', numeric: true }));

  for (const file of driveFiles) {
    if (file.mimeType?.startsWith('application/vnd.google-apps.')) {
      continue;
    }

    const parentDriveId = file.parents?.[0] || root.id;
    const folderId = folderIdByDriveId.get(parentDriveId) || 'folder-root';
    const content = await readDriveFileContent(file.id, interactive);
    files.push({
      id: file.appProperties?.[APP_PROPERTY_ID] || `file-${file.id}`,
      folderId,
      title: titleFromDriveName(file.name),
      content,
      customTitle: true,
      updatedAt: file.modifiedTime ? new Date(file.modifiedTime).getTime() : Date.now(),
      driveId: file.id
    });
  }

  if (!files.length && folders.length === 1) {
    return null;
  }

  return {
    version: 1,
    savedAt: new Date().toISOString(),
    modifiedTime: latestModifiedTime(items) || root.modifiedTime || null,
    memoStore: {
      folders,
      files,
      expandedFolders: folders.map(folder => folder.id)
    },
    activeFileId: [...files].sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0]?.id || null
  };
}

async function getDriveMeta(interactive = false) {
  const root = await ensureDriveFolder(interactive);
  const items = await listTree(root.id, interactive);
  return {
    modifiedTime: latestModifiedTime(items) || root.modifiedTime || null
  };
}
