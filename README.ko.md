[English](README.md) | 한국어

# Memo for Chrome

Google Drive 자동 동기화를 지원하는 미니멀 Chrome 확장 메모장입니다.

## 주요 기능

- **다중 파일 작업 공간** — 폴더로 파일을 정리하고 빠르게 전환
- **Google Drive 동기화** — 변경 사항을 Drive에 자동 백업
- **라이트 / 다크 테마**
- **한국어 / 영어 UI**
- **18가지 폰트** — 시스템 기본, Pretendard·Nanum·SUIT 등 한글 웹폰트, 모노 등
- **다운로드** — 현재 파일을 `.txt`로 저장
- **단어 · 글자 수** 실시간 표시

## 설치 방법

> Chrome 웹 스토어에 등록되지 않은 확장입니다. 압축 해제된 확장으로 직접 설치합니다.

### 1. Google OAuth 클라이언트 설정

1. [Google Cloud Console](https://console.cloud.google.com/) → **API 및 서비스 → 사용자 인증 정보**
2. **OAuth 2.0 클라이언트 ID 만들기** → 애플리케이션 유형: **Chrome 앱**
3. `chrome://extensions`에 표시되는 확장 ID를 **항목 ID**에 입력
4. **Google Auth Platform / OAuth 동의 화면** → **대상**에서 앱이 테스트 상태인 동안 사용할 Google 계정을 **테스트 사용자**로 추가
5. 프로젝트에서 **Google Drive API** 활성화

> Google이 `403: access_denied`와 함께 앱이 인증 절차를 완료하지 않았다고 표시하면, 현재 로그인한 Google 계정이 테스트 OAuth 앱 사용 권한을 받지 못한 상태입니다. 해당 이메일을 테스트 사용자로 추가하거나, 다른 계정과 공유하기 전에 OAuth 앱을 게시/검증해야 합니다.

### 2. 클라이언트 ID 입력

`manifest.json`을 열어 플레이스홀더를 교체합니다:

```json
"oauth2": {
  "client_id": "YOUR_CLIENT_ID.apps.googleusercontent.com",
  ...
}
```

### 3. 확장 로드

1. `chrome://extensions` 열기
2. **개발자 모드** 활성화
3. **압축 해제된 확장 로드** 클릭 → `extension/` 폴더 선택

## 동작 원리

| 레이어 | 파일 | 역할 |
|---|---|---|
| UI | `extension/memo.html` + `extension/css/memo.css` | 제목 표시줄·메뉴·파일 트리·편집기·상태 표시줄 |
| 앱 | `extension/js/app.js` | 모듈 앱 시작점 |
| 로직 | `extension/js/editor.js`, `extension/js/tree.js`, `extension/js/preferences.js`, `extension/js/store.js`, `extension/js/drive.js` | 에디터, 파일 트리, 설정, 저장, Drive 메시지 |
| 백그라운드 | `extension/js/background.js` | 서비스 워커 — OAuth 토큰으로 Drive API 호출 |

**동기화 흐름:** 시작 시 `js/drive.js`가 백그라운드 워커에 `drive:load` 메시지를 보냅니다. 워커는 `Drive/Memo` 폴더를 스캔해 실제 Drive 폴더와 `.txt` 파일을 앱 파일 트리로 복원합니다. 이후 앱은 5초마다 Drive 변경 여부를 확인하고, 로컬 편집은 디바운스 후 `drive:save`로 업로드합니다.

**저장 형식:** localStorage 키 `web-memo-files-v1`에는 로컬 파일 트리 캐시를 저장합니다. Google Drive에는 보이는 `Memo` 폴더 아래 실제 디렉토리와 개별 `.txt` 메모 파일로 저장합니다.

## 파일 구조

```
Memo_for_Chrome/
├── extension/
│   ├── manifest.json       # 확장 매니페스트 (MV3)
│   ├── memo.html           # 확장 페이지
│   ├── css/
│   │   └── memo.css
│   ├── js/
│   │   ├── app.js          # 시작점
│   │   ├── background.js   # Drive 서비스 워커
│   │   ├── drive.js        # 프론트 동기화 흐름
│   │   ├── editor.js       # 본문, 제목, 통계, 다운로드
│   │   ├── tree.js         # 파일/폴더 트리
│   │   ├── store.js        # localStorage 캐시와 동기화 payload
│   │   └── preferences.js  # 테마, 폰트, 언어
│   └── icons/
├── store-assets/           # Chrome 웹 스토어 스크린샷
├── release/                # 제출용 확장 ZIP
└── privacy.html            # 심사용 개인정보처리방침
```

## 권한

| 권한 | 이유 |
|---|---|
| `identity` | Google Drive OAuth 인증 |
| `storage` | 예약 (데이터는 현재 localStorage 사용) |
| `https://www.googleapis.com/*` | Drive API 호출 |
| `https://www.googleapis.com/auth/drive` | Drive의 `Memo` 폴더 안 파일 읽기 및 동기화 |

## 라이선스

MIT
