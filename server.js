const express = require("express");
const app = express();

app.use(express.json());

// 임시 대화 로그 저장 (서버 재시작 시 초기화됨)
let conversations = [];

// 카카오에서 오는 모든 요청 받기
app.post("/kakao", (req, res) => {
  const utterance = req.body.userRequest?.utterance;

  // 대화 저장
  if (utterance) {
    conversations.push(utterance);
  }

  // "요약해줘" 요청 처리
  if (utterance && utterance.includes("요약")) {
    const summary = conversations
      .slice(-10)
      .map((v, i) => `${i + 1}. ${v}`)
      .join("\n");

    return res.json({
      version: "2.0",
      template: {
        outputs: [
          {
            simpleText: {
              text: `최근 대화 요약입니다:\n\n${summary}`
            }
          }
        ]
      }
    });
  }

  // 기본 응답
  res.json({
    version: "2.0",
    template: {
      outputs: [
        {
          simpleText: {
            text: "말씀해주신 내용을 확인했습니다."
          }
        }
      ]
    }
  });
});

// Render용 포트
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
