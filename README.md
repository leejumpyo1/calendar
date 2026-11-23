# 우리 달력 ♥

알렉스 & 왕경의 공유 달력 — 할 일 · 약속 · 메모를 크게 보는 웹 앱.

- 프론트엔드: `index.html` 한 파일 (GitHub Pages)
- 백엔드: Google Sheets + Apps Script (`Code.gs`)
- 비밀번호로 보호 (비밀번호는 Apps Script에만 저장)
- 20초마다 자동 동기화, 홈 화면에 추가 가능 (PWA)

## 설정

### 1. Google 시트 + Apps Script
1. 새 Google 시트를 만듭니다 (이름 예: `우리 달력 DB`).
2. **확장 프로그램 → Apps Script**를 엽니다.
3. `Code.gs` 내용을 전부 붙여넣고, 맨 위 `PASSWORD = 'CHANGE-ME'`를 원하는 비밀번호로 바꿉니다.
4. 함수 목록에서 `setup`을 선택하고 **실행** → 권한 승인 (고급 → 안전하지 않음으로 이동 → 허용).
5. **배포 → 새 배포 → 유형 선택: 웹 앱**
   - 실행 사용자: **나**
   - 액세스 권한이 있는 사용자: **모든 사용자**
6. 나온 **웹 앱 URL** (`https://script.google.com/macros/s/.../exec`)을 복사합니다.

### 2. 프론트엔드에 URL 연결
`index.html`에서 `const API_URL = "PASTE_APPS_SCRIPT_URL_HERE";`를 복사한 URL로 바꿉니다.

### 3. GitHub Pages
Settings → Pages → Branch: `main` / root → Save.

## Code.gs를 수정했을 때
**배포 → 배포 관리 → 연필(수정) → 버전: 새 버전 → 배포**. 이렇게 하면 URL이 그대로 유지됩니다.

## 시트 구조 (`events` 시트)
`id, type(task/meet/note), title, date, time, endTime, place, note, who(alex/wang/both), repeat(weekly/monthly/yearly), doneOn(JSON), createdAt, updatedAt`
