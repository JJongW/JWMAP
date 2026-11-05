# OOMAP Slack 봇

알림 채널(`SLACK_CHANNEL_ID`)로 알림을 보내고, 스레드 답장·@oomap 태그를 받아 Mac mini의 Claude CLI로 처리한다.

## 구성
- `admin/scripts/lib/slack.mjs` — 글·파일 보내기 공통 모듈 (`slackPost`, `slackUpload`). 실패해도 본 작업을 멈추지 않는다.
- `admin/scripts/slack-post.mjs` — 명령줄에서 보내기. 봇이 띄운 Claude는 `$SLACK_THREAD_TS`로 지금 스레드에 이미지를 올린다.
- `admin/scripts/slack-bot.mjs` — Socket Mode 봇. launchd `com.oomap.slack-bot`(KeepAlive)이 띄운다. 로그는 `admin/.slack-bot/bot.log`.
- `oomap-bot-manifest.yaml` — Slack 앱 설정.

## 동작
- `SLACK_ALLOWED_USERS`에 있는 사람 말만 듣는다.
- 봇이 올린 글의 스레드 답장, 이미 대화 중인 스레드, @oomap 태그에 반응한다. 👀 → 처리 → ✅/❌.
- 스레드마다 Claude 세션 하나를 이어 쓴다 (`admin/.slack-bot/state.json`).
- Claude는 `--permission-mode auto`로 JWMAP 폴더에서 돈다. 인스타 게시·DB 삭제는 스레드에서 분명히 지시했을 때만 한다.

## 환경 변수 (`project/.env`, 값은 출력 금지)
`SLACK_BOT_TOKEN`(xoxb) · `SLACK_APP_TOKEN`(xapp) · `SLACK_CHANNEL_ID` · `SLACK_ALLOWED_USERS`

## 운영
```bash
launchctl kickstart -k gui/$(id -u)/com.oomap.slack-bot   # 재시작
tail -f admin/.slack-bot/bot.log
```
