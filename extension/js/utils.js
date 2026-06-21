/*
  utils.js
  --------
  특정 계층에 속하지 않는 작은 순수 함수 모음이다.
  store/editor/tree가 서로를 import하지 않도록 공통 문자열 처리를 여기로 뺐다.
*/

import { DEFAULTS } from './constants.js';

/* 다운로드 파일명에 사용할 수 없는 문자를 정리한다. */
export function safeFileName(value) {
  return value
    .trim()
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .slice(0, 80) || DEFAULTS.title;
}

/* 파일/폴더 이름을 innerHTML에 넣기 전에 HTML 문자를 안전하게 바꾼다. */
export function escapeHtml(value) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
