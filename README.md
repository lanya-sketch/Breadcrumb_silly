# Breadcrumb (Chat Search) for SillyTavern

현재 채팅의 **전체 메시지를 빠르게 검색**하고, 결과를 클릭하면 **해당 메시지로 바로 이동**하는 SillyTavern 확장입니다.

마법봉(확장) 메뉴에 고정 버튼으로 추가되며, 긴 채팅에서도 메모리에 있는 메시지를 직접 검색하므로 빠릅니다.

## 기능

- 🔍 **마법봉 메뉴 버튼** — 확장 메뉴에 "채팅 검색" 항목 고정
- ⌨️ **Ctrl/⌘ + F** 단축키로 열기
- 🧠 **현재 채팅 전체 검색** — `getContext().chat` 배열을 직접 검색 (공백 = AND 조건)
- 🎯 **결과 클릭 → 해당 메시지로 스크롤 이동** (잠깐 강조 표시)
- ⬆️⬇️ **Enter / Shift+Enter** 로 결과 간 이동
- 🎨 현재 SillyTavern 테마 색을 따라감, 모바일 대응

## 설치

SillyTavern에서 **Extensions → Install Extension** 을 열고 이 저장소 주소를 붙여넣으세요:

```
https://github.com/your-name/SillyTavern-Breadcrumb
```

또는 `data/<user>/extensions/` (혹은 모든 사용자용은 `public/scripts/extensions/third-party/`) 폴더에 이 폴더를 그대로 넣으세요.

## 사용법

1. 채팅 화면에서 마법봉(🪄) 메뉴를 열고 **채팅 검색** 을 누르거나, **Ctrl/⌘ + F** 를 누릅니다.
2. 검색어를 입력합니다. 공백으로 여러 단어를 넣으면 모두 포함하는 메시지만 나옵니다(AND).
3. 결과를 **클릭** 하면 그 메시지로 이동합니다.
4. **Enter / Shift+Enter** 로 결과 사이를 이동할 수 있습니다.

## 참고

- 메시지가 가상 스크롤로 아직 DOM에 그려지지 않은 경우, 점프가 잠시 지연되거나 실패할 수 있습니다. 그럴 땐 채팅을 한 번 스크롤한 뒤 다시 시도하세요.
- 검색은 메시지의 원본 텍스트(`mes`)를 대상으로 합니다.

## 라이선스

AGPLv3 — 자유롭게 사용/수정/배포할 수 있습니다.
