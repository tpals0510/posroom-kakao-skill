const express = require("express");
const app = express();

// 카카오 요청 JSON 파싱 (이거 없으면 body가 비어서 로직이 꼬일 수 있음)
app.use(express.json({ limit: "1mb" }));

// (간단) 사용자별 대화 저장: 메모리 저장(서버 재시작하면 초기화됨)
const logs = new Map(); // key: userId, value: [{role, text, ts}...]

function pushLog(userId, role, text) {
  if (!logs.has(userId)) logs.set(userId, []);
  logs.get(userId).push({ role, text, ts: Date.now() });
  // 너무 길어지면 최근 40개만 유지
  if (logs.get(userId).length > 40) logs.get(userId).splice(0, logs.get(userId).length - 40);
}

function makeSummary(items) {
  // 완전 간단 요약(키워드 기반). 나중에 GPT로 바꿔도 됨.
  const text = items.map(x => `[${x.role}] ${x.text}`).join("\n");

  const hasPay = /결제|입금|카드|영수증/.test(text);
  const hasContact = /010[-\s]?\d{3,4}[-\s]?\d{4}/.test(text) || /연락처|전화/.test(text);
  const hasAddr = /주소|수령지|사서함/.test(text);
  const hasGuide = /이용|사용법|안내|주의/.test(text);

  const bullets = [];
  if (hasPay) bullets.push("결제 관련 문의/진행 내용이 포함되어 있습니다.");
  if (hasContact) bullets.push("연락처/이름 등 상담에 필요한 정보가 언급되었습니다.");
  if (hasAddr) bullets.push("수령지/사서함(주소) 관련 내용이 포함되어 있습니다.");
  if (hasGuide) bullets.push("이용안내/주의사항 관련 질문이 포함되어 있습니다.");

  if (bullets.length === 0) bullets.push("주요 키워드가 뚜렷하지 않아 최근 대화를 짧게 요약합니다.");

  // 최근 사용자 발화 3개만 뽑아서 핵심으로 보여주기
  const lastUser = items.filter(x => x.role === "user").slice(-3).map(x => `- ${x.text}`);

  return [
    "지금까지 대화 핵심 요약입니다.",
    "",
    "• 핵심 포인트",
    ...bullets.map(b => `- ${b}`),
    "",
    "• 최근 요청(사용자 기준)",
    ...(lastUser.length ? lastUser : ["- (최근 사용자 발화가 없습니다.)"])
  ].join("\n");
}

// Render 헬스체크용
app.get("/", (req, res) => {
  res.status(200).send("OK");
});

// (선택) 대화 로그 쌓기용 엔드포인트: 어떤 블록에서든 이쪽으로 보내면 저장됨
app.post("/kakao/log", (req, res) => {
  const userId = req.body?.userRequest?.user?.id || "unknown";
  const utterance = req.body?.userRequest?.utterance || "";

  if (utterance) pushLog(userId, "user", utterance);

  // 카카오 스킬 응답 형식
  return res.json({
    version: "2.0",
    template: {
      outputs: [
        { simpleText: { text: "기록했습니다." } }
      ]
    }
  });
});

// ✅ 요약 스킬 엔드포인트 (카카오 스킬 URL로 넣을 곳)
app.post("/kakao/summary", (req, res) => {
  const userId = req.body?.userRequest?.user?.id || "unknown";
  const utterance = req.body?.userRequest?.utterance || "";

  // 사용자가 "요약"이라고 말했을 때도, 일단 로그에 남김
  if (utterance) pushLog(userId, "user", utterance);

  const items = logs.get(userId) || [];
  const summary = makeSummary(items);

  // 이 응답이 5초 안에 돌아가야 함(지금은 즉시 반환)
  return res.json({
    version: "2.0",
    template: {
      outputs: [
        { simpleText: { text: summary } }
      ]
    }
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log("Server listening on", PORT));
