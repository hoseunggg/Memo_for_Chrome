/*
  tree.js
  -------
  왼쪽 파일/폴더 트리 계층이다.
  폴더 펼치기, 파일 선택, 새 폴더/삭제 같은 파일 목록 UI를 담당한다.
*/

import { DEFAULTS } from './constants.js';
import { getActiveFile } from './editor.js';
import { createId, persistStore } from './store.js';
import { escapeHtml } from './utils.js';

/* 폴더 이름 정렬 기준. 숫자가 섞여도 자연스럽게 정렬한다. */
function compareByName(a, b) {
  return a.name.localeCompare(b.name, undefined, { sensitivity: 'base', numeric: true });
}

/* 파일 제목 정렬 기준. 제목이 없으면 Untitled로 본다. */
function compareByTitle(a, b) {
  return (a.title || DEFAULTS.title).localeCompare(b.title || DEFAULTS.title, undefined, {
    sensitivity: 'base',
    numeric: true
  });
}

/* tree 계층의 public API를 만든다. app.tree로 붙는다. */
export function createTree(app) {
  let draggedFileIds = [];

  /* id로 폴더 객체를 찾는다. */
  function getFolder(folderId) {
    return app.state.memoStore.folders.find(folder => folder.id === folderId) || null;
  }

  /* 폴더가 펼쳐져 있는지 expandedFolders 배열에서 확인한다. */
  function isFolderExpanded(folderId) {
    return app.state.memoStore.expandedFolders.includes(folderId);
  }

  /* 폴더 접기/펼치기 상태를 토글하고 저장한다. */
  function toggleFolder(folderId) {
    if (isFolderExpanded(folderId)) {
      app.state.memoStore.expandedFolders = app.state.memoStore.expandedFolders.filter(id => id !== folderId);
    } else {
      app.state.memoStore.expandedFolders.push(folderId);
    }
    persistStore(app);
    renderFileTree();
  }

  /* 파일 트리 전체를 현재 memoStore 기준으로 다시 그린다. */
  function renderFileTree() {
    app.refs.fileTree.innerHTML = '';
    app.state.memoStore.folders
      .filter(folder => folder.parentId === null)
      .sort(compareByName)
      .forEach(folder => renderFolderInto(app.refs.fileTree, folder, 0));
  }

  /* 폴더 하나, 그 안의 파일, 하위 폴더를 depth 기준으로 재귀 렌더링한다. */
  function renderFolderInto(root, folder, depth) {
    const expanded = isFolderExpanded(folder.id);
    const folderButton = document.createElement('div');
    folderButton.role = 'button';
    folderButton.tabIndex = 0;
    folderButton.className = `tree-item tree-folder${folder.id === app.state.selectedFolderId ? ' active' : ''}`;
    folderButton.style.setProperty('--depth', depth);
    folderButton.innerHTML = `
      <span class="tree-toggle">${expanded ? '▾' : '▸'}</span>
      <span class="tree-icon folder-icon" aria-hidden="true">
        <svg viewBox="0 0 24 24" focusable="false">
          <path d="M3.5 6.75h6.15l1.85 2.15h9v8.35a2 2 0 0 1-2 2h-13a2 2 0 0 1-2-2V6.75Z"/>
          <path d="M3.5 9h17"/>
        </svg>
      </span>
      <span>${escapeHtml(folder.name)}</span>
    `;
    folderButton.dataset.folderId = folder.id;
    bindFolderDropEvents(folderButton, folder.id);
    folderButton.addEventListener('contextmenu', event => openContextMenu(event, { type: 'folder', id: folder.id }));
    /* 폴더 row 전체를 클릭하면 선택 폴더가 되고 펼치기 상태도 함께 바뀐다. */
    folderButton.addEventListener('click', () => {
      selectFolder(folder.id, { render: false });
      toggleFolder(folder.id);
    });
    folderButton.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      event.preventDefault();
      selectFolder(folder.id, { render: false });
      toggleFolder(folder.id);
    });
    root.appendChild(folderButton);

    /* 접힌 폴더면 자식 파일/폴더는 렌더링하지 않는다. */
    if (!expanded) return;

    /* 현재 폴더 안의 파일들을 이름순으로 렌더링한다. */
    app.state.memoStore.files
      .filter(file => file.folderId === folder.id)
      .sort(compareByTitle)
      .forEach(file => {
        const fileButton = document.createElement('div');
        fileButton.role = 'button';
        fileButton.tabIndex = 0;
        fileButton.className = `tree-item tree-file${isFileSelected(file.id) ? ' active' : ''}`;
        fileButton.style.setProperty('--depth', depth);
        fileButton.draggable = true;
        fileButton.dataset.fileId = file.id;
        fileButton.innerHTML = `
          <span class="tree-spacer"></span>
          <span class="tree-icon file-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" focusable="false">
              <path d="M7 3.75h7.4L18 7.35v12.9H7a1 1 0 0 1-1-1V4.75a1 1 0 0 1 1-1Z"/>
              <path d="M14.25 3.95v3.8h3.75"/>
              <path d="M9 12.25h6"/>
              <path d="M9 15.25h6"/>
            </svg>
          </span>
          <span>${escapeHtml(file.title || DEFAULTS.title)}</span>
        `;
        fileButton.addEventListener('click', event => handleFileClick(event, file.id));
        fileButton.addEventListener('contextmenu', event => openContextMenu(event, { type: 'file', id: file.id }));
        fileButton.addEventListener('keydown', event => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          handleFileClick(event, file.id);
        });
        bindFileDragEvents(fileButton, file.id);
        root.appendChild(fileButton);
      });

    /* 현재 폴더의 하위 폴더를 다시 같은 방식으로 렌더링한다. */
    app.state.memoStore.folders
      .filter(child => child.parentId === folder.id)
      .sort(compareByName)
      .forEach(child => renderFolderInto(root, child, depth + 1));
  }

  /* 새 파일/새 폴더가 들어갈 기준 폴더를 바꾼다. */
  function selectFolder(folderId, { render = true } = {}) {
    app.state.selectedFolderId = folderId;
    app.state.selectedFileIds.clear();
    if (render) renderFileTree();
  }

  /* 화면에 펼쳐져서 보이는 파일만 위에서 아래 순서대로 모은다. */
  function getVisibleFiles() {
    const files = [];
    app.state.memoStore.folders
      .filter(folder => folder.parentId === null)
      .sort(compareByName)
      .forEach(folder => collectVisibleFiles(folder, files));
    return files;
  }

  /* Shift 범위 선택을 위해 펼쳐진 폴더 안의 파일들을 재귀로 수집한다. */
  function collectVisibleFiles(folder, files) {
    if (!isFolderExpanded(folder.id)) return;

    app.state.memoStore.files
      .filter(file => file.folderId === folder.id)
      .sort(compareByTitle)
      .forEach(file => files.push(file));

    app.state.memoStore.folders
      .filter(child => child.parentId === folder.id)
      .sort(compareByName)
      .forEach(child => collectVisibleFiles(child, files));
  }

  function isFileSelected(fileId) {
    return app.state.selectedFileIds.has(fileId);
  }

  function bindFileDragEvents(fileButton, fileId) {
    fileButton.addEventListener('dragstart', event => {
      if (!isFileSelected(fileId)) {
        app.state.selectedFileIds = new Set([fileId]);
        app.state.lastSelectedFileId = fileId;
        app.state.activeFileId = fileId;
      }
      draggedFileIds = [...app.state.selectedFileIds];
      fileButton.classList.add('dragging');
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', draggedFileIds.join(','));
    });

    fileButton.addEventListener('dragend', () => {
      draggedFileIds = [];
      app.refs.fileTree.querySelectorAll('.dragging, .drop-target').forEach(element => {
        element.classList.remove('dragging', 'drop-target');
      });
      renderFileTree();
    });
  }

  function bindFolderDropEvents(folderButton, folderId) {
    folderButton.addEventListener('dragover', event => {
      if (!draggedFileIds.length || !canMoveFilesToFolder(draggedFileIds, folderId)) return;
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
      folderButton.classList.add('drop-target');
    });

    folderButton.addEventListener('dragleave', () => {
      folderButton.classList.remove('drop-target');
    });

    folderButton.addEventListener('drop', event => {
      if (!draggedFileIds.length || !canMoveFilesToFolder(draggedFileIds, folderId)) return;
      event.preventDefault();
      event.stopPropagation();
      moveFilesToFolder(draggedFileIds, folderId);
    });
  }

  function canMoveFilesToFolder(fileIds, folderId) {
    return fileIds.some(fileId => {
      const file = app.state.memoStore.files.find(item => item.id === fileId);
      return file && file.folderId !== folderId;
    });
  }

  function moveFilesToFolder(fileIds, folderId) {
    const folder = getFolder(folderId);
    if (!folder) return;

    const ids = new Set(fileIds);
    let moved = false;
    app.state.memoStore.files.forEach(file => {
      if (ids.has(file.id) && file.folderId !== folderId) {
        file.folderId = folderId;
        file.updatedAt = Date.now();
        moved = true;
      }
    });

    if (!moved) return;
    app.state.selectedFolderId = folderId;
    app.state.selectedFileIds = new Set(fileIds);
    if (!app.state.memoStore.expandedFolders.includes(folderId)) {
      app.state.memoStore.expandedFolders.push(folderId);
    }
    persistStore(app);
    renderFileTree();
  }

  function openContextMenu(event, target) {
    event.preventDefault();
    event.stopPropagation();
    app.state.contextTarget = target;

    if (target.type === 'file') {
      app.state.selectedFileIds = new Set([target.id]);
      app.state.lastSelectedFileId = target.id;
      app.state.activeFileId = target.id;
    } else {
      selectFolder(target.id, { render: false });
    }

    app.refs.contextMenu.hidden = false;
    app.refs.contextMenu.style.left = `${event.clientX}px`;
    app.refs.contextMenu.style.top = `${event.clientY}px`;
    renderFileTree();
  }

  function renameContextTarget() {
    const target = app.state.contextTarget;
    if (!target) return;

    if (target.type === 'file') {
      const file = app.state.memoStore.files.find(item => item.id === target.id);
      if (!file) return;
      const nextName = window.prompt('File name', file.title || DEFAULTS.title);
      if (!nextName?.trim()) return;
      file.title = nextName.trim();
      file.customTitle = true;
      file.updatedAt = Date.now();
      persistStore(app);
      app.editor.updateTitle();
      renderFileTree();
    }

    if (target.type === 'folder') {
      const folder = getFolder(target.id);
      if (!folder || folder.parentId === null) return;
      const nextName = window.prompt('Folder name', folder.name || 'Folder');
      if (!nextName?.trim()) return;
      folder.name = nextName.trim();
      persistStore(app);
      renderFileTree();
    }

    app.refs.contextMenu.hidden = true;
    app.state.contextTarget = null;
  }

  function deleteContextTarget() {
    const target = app.state.contextTarget;
    if (!target) {
      deleteSelectedItem();
      return;
    }

    if (target.type === 'file') {
      app.state.selectedFileIds = new Set([target.id]);
      deleteSelectedItem();
    }

    if (target.type === 'folder') {
      deleteFolder(target.id);
    }

    app.refs.contextMenu.hidden = true;
    app.state.contextTarget = null;
  }

  /* 일반 클릭은 파일 하나 열기, Shift 클릭은 마지막 선택 파일부터 현재 파일까지 범위 선택이다. */
  function handleFileClick(event, fileId) {
    if (event.shiftKey && app.state.lastSelectedFileId) {
      selectFileRange(app.state.lastSelectedFileId, fileId);
      renderFileTree();
      return;
    }

    app.state.selectedFileIds = new Set([fileId]);
    app.state.lastSelectedFileId = fileId;
    app.editor.openFile(fileId);
  }

  function selectFileRange(fromFileId, toFileId) {
    const visibleFileIds = getVisibleFiles().map(file => file.id);
    const fromIndex = visibleFileIds.indexOf(fromFileId);
    const toIndex = visibleFileIds.indexOf(toFileId);

    if (fromIndex === -1 || toIndex === -1) {
      app.state.selectedFileIds = new Set([toFileId]);
      app.state.lastSelectedFileId = toFileId;
      app.editor.openFile(toFileId);
      return;
    }

    const [start, end] = [fromIndex, toIndex].sort((a, b) => a - b);
    app.state.selectedFileIds = new Set(visibleFileIds.slice(start, end + 1));
    app.state.activeFileId = toFileId;
    app.state.lastSelectedFileId = toFileId;
    app.state.selectedFolderId = getActiveFile(app)?.folderId || app.state.selectedFolderId;
    app.editor.loadActiveFile();
    persistStore(app);
  }

  /* 선택된 폴더 아래에 새 폴더를 만들고, Drive에도 바로 새 폴더 생성을 요청한다. */
  function createFolder() {
    const name = window.prompt('Folder name');
    if (!name?.trim()) return;

    const parentId = app.state.selectedFolderId || app.state.memoStore.folders[0]?.id || null;
    const folder = {
      id: createId('folder'),
      name: name.trim(),
      parentId
    };

    app.state.memoStore.folders.push(folder);
    app.state.selectedFolderId = folder.id;
    if (parentId && !app.state.memoStore.expandedFolders.includes(parentId)) {
      app.state.memoStore.expandedFolders.push(parentId);
    }

    persistStore(app, { sync: false });
    renderFileTree();
    app.drive.syncToDrive();
  }

  /* 현재 열린 파일 하나를 삭제한다. */
  function deleteSelectedItem() {
    const selectedIds = app.state.selectedFileIds.size
      ? [...app.state.selectedFileIds]
      : [app.state.activeFileId].filter(Boolean);
    if (!selectedIds.length) return;

    app.state.memoStore.files = app.state.memoStore.files.filter(file => !selectedIds.includes(file.id));
    app.state.activeFileId = app.state.memoStore.files[0]?.id || null;
    app.state.selectedFileIds = app.state.activeFileId ? new Set([app.state.activeFileId]) : new Set();
    app.state.lastSelectedFileId = app.state.activeFileId;
    app.refs.memoBody.value = '';
    persistStore(app);
    app.editor.loadActiveFile();
    renderFileTree();
  }

  function collectFolderIds(folderId, ids = new Set()) {
    ids.add(folderId);
    app.state.memoStore.folders
      .filter(folder => folder.parentId === folderId)
      .forEach(folder => collectFolderIds(folder.id, ids));
    return ids;
  }

  function deleteFolder(folderId) {
    const folder = getFolder(folderId);
    if (!folder || folder.parentId === null) return;

    const folderIds = collectFolderIds(folderId);
    app.state.memoStore.folders = app.state.memoStore.folders.filter(folder => !folderIds.has(folder.id));
    app.state.memoStore.files = app.state.memoStore.files.filter(file => !folderIds.has(file.folderId));
    app.state.memoStore.expandedFolders = app.state.memoStore.expandedFolders.filter(id => !folderIds.has(id));
    app.state.selectedFolderId = app.state.memoStore.folders[0]?.id || DEFAULTS.rootFolderId;

    if (app.state.activeFileId && !app.state.memoStore.files.some(file => file.id === app.state.activeFileId)) {
      app.state.activeFileId = app.state.memoStore.files[0]?.id || null;
      app.state.selectedFileIds = app.state.activeFileId ? new Set([app.state.activeFileId]) : new Set();
      app.state.lastSelectedFileId = app.state.activeFileId;
      app.editor.loadActiveFile();
    }

    persistStore(app);
    renderFileTree();
  }

  return {
    renderFileTree,
    createFolder,
    deleteSelectedItem,
    deleteContextTarget,
    renameContextTarget,
    selectFolder,
    getFolder
  };
}
