/*
  i18n.js
  -------
  현재 언어와 번역 문자열을 다루는 작은 계층이다.
  UI 모듈들은 직접 localStorage를 읽지 않고 t(key)를 통해 문구를 가져온다.
*/

import { DEFAULTS, I18N, STORAGE_KEYS } from './constants.js';

/* localStorage에 저장된 언어를 읽고, 없으면 기본 언어를 사용한다. */
export function getLanguage() {
  return localStorage.getItem(STORAGE_KEYS.language) || DEFAULTS.language;
}

/* 번역 key를 현재 언어의 문자열로 바꾼다. 없으면 영어, 그래도 없으면 key 자체를 반환한다. */
export function t(key) {
  const language = getLanguage();
  return I18N[language]?.[key] || I18N[DEFAULTS.language][key] || key;
}
