const ui = (() => {
  function setStatus(message) {
    const target = document.getElementById("sentenceStatus");
    if (target) target.textContent = message;
  }

  function renderQuestionCard(question, state) {
    const container = document.getElementById("sentenceQuestionContainer");
    if (!container || !question) return;
    container.innerHTML = `
      <div class="sentence-card">
        <div class="sentence-question">${question.question}</div>
        <div class="sentence-options">
          ${question.options.map((option, index) => `
            <label class="option-item ${state.submitted && question.answer === option ? "correct" : ""} ${state.submitted && state.selectedAnswer === option && question.answer !== option ? "incorrect" : ""}">
              <input type="radio" name="sentenceOption" value="${option}" ${state.selectedAnswer === option ? "checked" : ""} ${state.submitted ? "disabled" : ""} />
              <span>${String.fromCharCode(65 + index)}. ${option}</span>
            </label>
          `).join("")}
        </div>
        ${state.submitted ? `
          <div class="sentence-feedback">
            <p><strong>Answer:</strong> ${question.answer}</p>
            <p><strong>Explanation:</strong> ${question.explanation}</p>
            <p><strong>Topic:</strong> ${question.topic} · <strong>Difficulty:</strong> ${question.difficulty}</p>
          </div>
        ` : ""}
      </div>
    `;
  }

  function renderAnalytics(state) {
    const analyticsPanel = document.getElementById("sentenceAnalytics");
    if (!analyticsPanel) return;
    const summary = analytics.buildSummary(state);
    analyticsPanel.innerHTML = `
      <div class="analytics-grid">
        <div class="analytics-card"><strong>${summary.attempted}</strong><span>Total Attempted</span></div>
        <div class="analytics-card"><strong>${summary.correct}</strong><span>Total Correct</span></div>
        <div class="analytics-card"><strong>${summary.accuracy}%</strong><span>Accuracy</span></div>
        <div class="analytics-card"><strong>${summary.averageTime}s</strong><span>Avg Response</span></div>
      </div>
      <div class="analytics-list">
        <div><strong>Strongest:</strong> ${summary.topics[0]?.[0] || "None"}</div>
        <div><strong>Weakest:</strong> ${summary.topics[summary.topics.length - 1]?.[0] || "None"}</div>
        <div><strong>Recent Scores:</strong> ${(state.analytics.recentScores || []).join(", ") || "None"}</div>
      </div>
    `;
  }

  function updateControls(state, filteredQuestions, currentQuestion) {
    document.getElementById("sentencePrevBtn").disabled = state.currentIndex === 0;
    document.getElementById("sentenceNextBtn").disabled = state.currentIndex >= filteredQuestions.length - 1;
    document.getElementById("sentenceSubmitBtn").disabled = !state.selectedAnswer || state.submitted;
    document.getElementById("sentenceBookmarkBtn").textContent = state.bookmarked.includes(currentQuestion?.id) ? "★ Bookmarked" : "☆ Bookmark";
  }

  return { setStatus, renderQuestionCard, renderAnalytics, updateControls };
})();
