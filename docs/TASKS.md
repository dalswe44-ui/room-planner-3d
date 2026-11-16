# 작업 목록

| task-id | 담당 | 상태 | 선행 | 완료 기준 요약 | 보고서 |
|---|---|---|---|---|---|
| T-000 | 헤드 | 완료 | | 뼈대, 계약과 계약 테스트, store, 빈 화면이 typecheck·lint·test·build 통과 | docs/log/PROMPT_LOG.md |
| T-001 | spec-report | 완료 | T-000 | SPEC(완료 기준 체크리스트 포함), 사례 보고서 뼈대, 전후 비교 측정 양식 | docs/reports/T-001.md |
| T-002 | room-input | 완료 | T-001 | 길이 입력 부품, 단위 전환, 방 치수 입력 | docs/reports/T-002.md |
| T-002b | room-input | 진행 | T-002 | LengthInput이 거부 상태를 부모에게 알림(onValidityChange) | docs/reports/T-002b.md |
| T-003 | scene-engine | 진행 | T-002 | 2D 평면 뷰와 3D 뷰, 포인터 → 방 좌표, 검증용 조회 | docs/reports/T-003.md |
| T-004 | furniture-placement | 대기 | T-003 | 가구 추가·목록, 끌기, 90도 회전, 겹침·방 이탈 경고, 벽까지 거리 | docs/reports/T-004.md |
| T-005 | qa-verifier | 대기 | T-004 | SPEC 체크리스트 대조, 전체 명령 실행, 수치·화면 검증 | docs/reports/qa/T-005.md |

## 사용자가 직접 해야 하는 일

| 일 | 상태 |
|---|---|
| 프롬프트 6개와 CLAUDE.md를 읽고 직접 고쳐 커밋 | 대기 |
| "활용 전" 측정(종이와 줄자로 자기 방의 배치 검토) | 대기 |
| 주최 측 문의(설계서 끝의 다섯 가지) | 대기 |
| 참가신청서 양식 내려받기, 분야 확인, 서명 | 대기 |
| GitHub 계정 연결 또는 원격 저장소 준비, 호스팅 계정 연결과 공개 승인 | 대기 |
| 실기기(휴대폰)에서 확인 | 대기 |
| docs/SPEC.md의 "(확인)" 값과 "(제안)" 항목 확인 (docs/DECISIONS.md의 "사용자 확인 필요") | 대기 |
| 배치도 읽기 기능의 방식 선택: ① 가져오기 방식 ② 앱 안에서 자동 인식 | 대기 |

## 헤드가 직접 한 한두 줄 수정

| 날짜 | 파일 | 내용 |
|---|---|---|
| 2026-11-16 | docs/SPEC.md (spec-report 소유) | 2절 끌기 규칙과 P-2를 변 기준 스냅으로 고침. T-001의 미해결 질문 1에 대한 결정 |
| 2026-11-16 | docs/submission/report.md, docs/reports/T-001.md | spec-report가 응답으로 돌려준 내용을 그대로 저장 |
