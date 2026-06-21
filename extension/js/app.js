/*
  app.js
  -------
  모듈 버전의 시작점이다.
  이 파일은 세부 로직을 직접 처리하지 않고, 각 계층을 조립한 뒤 bootstrap 순서만 관리한다.
*/

import { getRefs } from './dom.js';
import { createState } from './state.js';
import { loadStore } from './store.js';
import { createPreferences } from './preferences.js';
import { createEditor } from './editor.js';
import { createTree } from './tree.js';
import { createDrive } from './drive.js';
import { bindEvents } from './events.js';

/* app 객체는 모든 모듈이 공유하는 작은 컨테이너다. refs/state/각 기능 모듈을 한곳에 묶는다. */
function createApp() {
  const app = {
    /* DOM 참조는 dom.js에서 한 번에 수집한다. */
    refs: getRefs(),
    /* 저장소에서 읽은 데이터로 런타임 상태를 만든다. */
    state: createState(loadStore())
  };

  /* 서로 필요한 기능을 app에 붙인다. 이후 모듈들은 app.editor, app.tree처럼 접근한다. */
  app.drive = createDrive(app);
  app.preferences = createPreferences(app);
  app.editor = createEditor(app);
  app.tree = createTree(app);

  return app;
}

/* 실제 앱 실행 순서다. 계층 분리 후에는 bootstrap이 거의 목차처럼 읽히는 게 이상적이다. */
async function bootstrap() {
  const app = createApp();

  /* 이벤트 연결 -> 설정 복원 -> Drive/Memo 동기화 -> 이전/최근 파일 열기 순서로 시작한다. */
  bindEvents(app);
  app.preferences.restorePreferences();
  await app.drive.startDriveSync();
  app.editor.openInitialFile();

  return app;
}

/* 모듈이 로드되면 앱을 시작한다. */
bootstrap().catch(error => {
  console.error(error);
});
