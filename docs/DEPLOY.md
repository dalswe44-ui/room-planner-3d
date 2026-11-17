# 공개 배포 (Vercel) — 사용자가 할 일

헤드(Claude)는 계정을 만들거나 API 키를 입력할 수 없다. 아래는 사용자가 직접 한다. 순서대로 하면 약 15분.

## 1. Claude API 키 만들기
1. Claude Console(platform.claude.com)에 가입하고 결제 수단 또는 크레딧을 등록한다.
2. 워크스페이스에 **월 지출 한도**를 건다(예: 공모전 기간 동안 소액). 이 한도가 비용의 진짜 안전장치다.
3. API 키를 하나 만든다. 키는 어디에도 붙여 넣지 말고(대화, 코드, 깃허브) 다음 단계의 Vercel 설정 칸에만 넣는다.

## 2. Vercel에 올리기
1. vercel.com에 GitHub 계정으로 가입한다.
2. "Add New → Project"에서 이 저장소를 고른다. 프레임워크는 Vite로 자동 인식된다(빌드 `npm run build`, 출력 `dist`).
3. "Environment Variables"에 `ANTHROPIC_API_KEY` = (1에서 만든 키)를 넣는다. 선택: `READ_LIMIT_PER_HOUR`(기본 20), `ANTHROPIC_MODEL`(기본 claude-sonnet-5-5).
4. Deploy를 누른다. 끝나면 `https://<프로젝트 이름>.vercel.app` 주소가 나온다.

## 3. 확인
- `https://<주소>/api/read-layout`을 열었을 때 `{"available":true}`가 보이면 키가 설정된 것이다(키 값은 보이지 않는다).
- 로그인하지 않은 시크릿 창과 휴대폰에서 주소를 열어 방이 보이는지(SPEC X-1), 사진·배치도 탭에서 배치도 사진을 올려 읽히는지 확인한다.
- 이후 GitHub `main`에 올라가는 커밋은 Vercel이 자동으로 다시 배포한다.

## 블라인드 심사 주의
- Vercel 프로젝트 이름과 주소에 이름·학번·계정명이 들어가지 않게 정한다(예: `room-planner-3d-demo`).
- 공모전 서류에는 GitHub 저장소 주소(계정명 포함)를 쓰지 않는다.
