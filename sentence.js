const sentenceModule = (() => {
  const STORAGE_KEY = "sentenceCompletionState";
  const state = {
    questions: [],
    currentIndex: 0,
    currentMode: "sequential",
    difficulty: "All",
    topic: "All",
    submitted: false,
    selectedAnswer: null,
    bookmarked: [],
    questionTimerId: null,
    questionTimeLeft: 30,
    attempts: [],
    timer: 20 * 60,
    testMode: false,
    testQuestions: [],
    testIndex: 0,
    testStarted: false,
    testTimeLeft: 20 * 60,
    testAnswers: [],
    testResult: null,
    analytics: {
      attempted: 0,
      correct: 0,
      responseTimes: [],
      topicStats: {},
      recentScores: [],
      bookmarks: [],
    },
  };

  function init() {
    loadState();
    bindEvents();
    render();
  }

  function bindEvents() {
    document.getElementById("sentenceStartBtn")?.addEventListener("click", () => {
      startPractice();
    });

    document.getElementById("sentenceNextBtn")?.addEventListener("click", nextQuestion);
    document.getElementById("sentencePrevBtn")?.addEventListener("click", previousQuestion);
    document.getElementById("sentenceSubmitBtn")?.addEventListener("click", submitAnswer);
    document.getElementById("sentenceBookmarkBtn")?.addEventListener("click", toggleBookmark);
    document.getElementById("sentenceQuestionContainer")?.addEventListener("click", (event) => {
      const optionInput = event.target.closest('label')?.querySelector('input[name="sentenceOption"]');
      if (!optionInput) return;
      state.selectedAnswer = optionInput.value;
      saveState();
      render();
    });
    document.getElementById("sentenceModeSelect")?.addEventListener("change", (event) => {
      state.currentMode = event.target.value;
      render();
    });
    document.getElementById("sentenceDifficultyFilter")?.addEventListener("change", (event) => {
      state.difficulty = event.target.value;
      render();
    });
    document.getElementById("sentenceTopicFilter")?.addEventListener("change", (event) => {
      state.topic = event.target.value;
      render();
    });

    document.addEventListener("keydown", (event) => {
      if (event.key === "ArrowRight") {
        event.preventDefault();
        nextQuestion();
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        previousQuestion();
      }
      if (event.key === "Enter") {
        event.preventDefault();
        submitAnswer();
      }
    });
  }

  async function loadQuestions() {
    const response = await fetch("./data/sentence-questions.json");
    state.questions = await response.json();
    state.analytics.topicStats = summarizeTopics(state.questions);
    render();
    saveState();
  }

  function loadState() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved);
      Object.assign(state, parsed);
    } catch (error) {
      console.warn("Unable to parse sentence state", error);
    }
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      currentMode: state.currentMode,
      difficulty: state.difficulty,
      topic: state.topic,
      bookmarked: state.bookmarked,
      attempts: state.attempts,
      analytics: state.analytics,
      testMode: state.testMode,
      testResult: state.testResult,
    }));
  }

  function clearQuestionTimer() {
    if (state.questionTimerId) {
      window.clearInterval(state.questionTimerId);
      state.questionTimerId = null;
    }
  }

  function updateTimerDisplay() {
    const timerElement = document.getElementById("sentenceTimer");
    if (!timerElement) return;

    const safeTime = Math.max(0, state.questionTimeLeft);
    timerElement.textContent = `${String(safeTime).padStart(2, "0")}s`;
    timerElement.classList.toggle("warning", safeTime <= 10);
  }

  function startQuestionTimer() {
    const filteredQuestions = getFilteredQuestions();
    const currentQuestion = filteredQuestions[state.currentIndex] || filteredQuestions[0];

    if (!currentQuestion || state.submitted) {
      updateTimerDisplay();
      return;
    }

    clearQuestionTimer();
    state.questionTimeLeft = 30;
    state.lastStartedAt = Date.now();
    updateTimerDisplay();

    state.questionTimerId = window.setInterval(() => {
      state.questionTimeLeft -= 1;
      updateTimerDisplay();

      if (state.questionTimeLeft <= 0) {
        clearQuestionTimer();
        submitAnswer(true);
      }
    }, 1000);
  }

  function render() {
    if (!state.questions.length) {
      loadQuestions();
      return;
    }

    const filteredQuestions = getFilteredQuestions();
    const currentQuestion = filteredQuestions[state.currentIndex] || filteredQuestions[0];
    const questionContainer = document.getElementById("sentenceQuestionContainer");
    const questionNumber = document.getElementById("sentenceQuestionNumber");
    const progress = document.getElementById("sentenceProgressBar");
    const topicText = document.getElementById("sentenceTopicText");
    const difficultyText = document.getElementById("sentenceDifficultyText");

    if (!questionContainer || !currentQuestion) return;

    const progressPercent = filteredQuestions.length ? Math.round(((state.currentIndex + 1) / filteredQuestions.length) * 100) : 0;
    progress.style.width = `${Math.min(100, progressPercent)}%`;
    clearQuestionTimer();
    if (!state.submitted && currentQuestion) {
      startQuestionTimer();
    } else {
      updateTimerDisplay();
    }
    questionNumber.textContent = `Question ${state.currentIndex + 1}/${filteredQuestions.length || 1}`;
    topicText.textContent = currentQuestion.topic;
    difficultyText.textContent = currentQuestion.difficulty;

    const showOptions = state.submitted || state.questionTimeLeft <= 0;

    questionContainer.innerHTML = `
      <div class="sentence-card">
        <div class="sentence-question">${currentQuestion.question}</div>
        <div class="sentence-answer-input">
          <input type="text" id="sentenceAnswerInput" placeholder="Type your answer here..." value="${state.selectedAnswer || ""}" ${state.submitted ? "disabled" : ""} />
        </div>
        ${showOptions ? `
          <div class="sentence-options">
            ${currentQuestion.options.map((option, index) => `
              <label class="option-item ${state.submitted && currentQuestion.answer === option ? "correct" : ""} ${state.submitted && state.selectedAnswer === option && currentQuestion.answer !== option ? "incorrect" : ""}">
                <input type="radio" name="sentenceOption" value="${option}" ${state.selectedAnswer === option ? "checked" : ""} ${state.submitted ? "disabled" : ""} />
                <span>${String.fromCharCode(65 + index)}. ${option}</span>
              </label>
            `).join("")}
          </div>
        ` : ""}
        ${state.submitted || state.questionTimeLeft <= 0 ? `
          <div class="sentence-feedback">
            <p><strong>Answer:</strong> ${currentQuestion.answer}</p>
            <p><strong>Explanation:</strong> ${currentQuestion.explanation}</p>
            <p><strong>Topic:</strong> ${currentQuestion.topic} · <strong>Difficulty:</strong> ${currentQuestion.difficulty}</p>
          </div>
        ` : ""}
      </div>
    `;

    const answerInput = document.getElementById("sentenceAnswerInput");
    if (answerInput) {
      answerInput.addEventListener("input", (event) => {
        state.selectedAnswer = event.target.value.trim();
        saveState();
      });
    }

    const previousBtn = document.getElementById("sentencePrevBtn");
    const nextBtn = document.getElementById("sentenceNextBtn");
    const submitBtn = document.getElementById("sentenceSubmitBtn");
    previousBtn.disabled = state.currentIndex === 0;
    nextBtn.disabled = state.currentIndex >= filteredQuestions.length - 1;
    submitBtn.disabled = !state.selectedAnswer || state.submitted;
    document.getElementById("sentenceBookmarkBtn").textContent = state.bookmarked.includes(currentQuestion.id) ? "★ Bookmarked" : "☆ Bookmark";

    renderAnalytics();
  }

  function startPractice() {
    state.currentIndex = 0;
    state.submitted = false;
    state.selectedAnswer = null;
    state.testMode = false;
    render();
  }

  function nextQuestion() {
    const filteredQuestions = getFilteredQuestions();
    if (!filteredQuestions.length) return;
    state.currentIndex = Math.min(filteredQuestions.length - 1, state.currentIndex + 1);
    state.submitted = false;
    state.selectedAnswer = null;
    render();
  }

  function previousQuestion() {
    const filteredQuestions = getFilteredQuestions();
    if (!filteredQuestions.length) return;
    state.currentIndex = Math.max(0, state.currentIndex - 1);
    state.submitted = false;
    state.selectedAnswer = null;
    render();
  }

  function submitAnswer(autoSubmitted = false) {
    const filteredQuestions = getFilteredQuestions();
    if (!filteredQuestions.length) return;
    const question = filteredQuestions[state.currentIndex];
    const hasSelection = Boolean(state.selectedAnswer);
    if (!hasSelection && !autoSubmitted) return;

    const isCorrect = hasSelection && state.selectedAnswer === question.answer;
    const startedAt = Date.now() - (state.lastStartedAt || Date.now());
    state.lastStartedAt = null;
    const responseTime = Math.max(1, Math.round(startedAt / 1000));

    state.analytics.attempted += 1;
    state.analytics.responseTimes.push(responseTime);
    state.analytics.topicStats[question.topic] = (state.analytics.topicStats[question.topic] || 0) + (isCorrect ? 1 : 0);
    if (isCorrect) state.analytics.correct += 1;
    state.analytics.recentScores.push(isCorrect ? 1 : 0);
    state.analytics.recentScores = state.analytics.recentScores.slice(-8);

    state.attempts.push({
      id: question.id,
      question: question.question,
      selected: state.selectedAnswer,
      correct: question.answer,
      isCorrect,
      topic: question.topic,
      difficulty: question.difficulty,
    });

    clearQuestionTimer();
    state.submitted = true;
    saveState();
    render();
  }

  function toggleBookmark() {
    const filteredQuestions = getFilteredQuestions();
    const question = filteredQuestions[state.currentIndex];
    if (!question) return;
    if (state.bookmarked.includes(question.id)) {
      state.bookmarked = state.bookmarked.filter((id) => id !== question.id);
    } else {
      state.bookmarked.push(question.id);
    }
    state.analytics.bookmarks = state.bookmarked.slice();
    saveState();
    render();
  }

  function getFilteredQuestions() {
    return state.questions.filter((question) => {
      const difficultyMatch = state.difficulty === "All" || question.difficulty.toLowerCase() === state.difficulty.toLowerCase();
      const topicMatch = state.topic === "All" || question.topic === state.topic;
      return difficultyMatch && topicMatch;
    });
  }

  function summarizeTopics(questions) {
    return questions.reduce((acc, question) => {
      acc[question.topic] = 0;
      return acc;
    }, {});
  }

  function renderAnalytics() {
    const analyticsPanel = document.getElementById("sentenceAnalytics");
    if (!analyticsPanel) return;
    const averageTime = state.analytics.responseTimes.length
      ? Math.round(state.analytics.responseTimes.reduce((a, b) => a + b, 0) / state.analytics.responseTimes.length)
      : 0;
    const accuracy = state.analytics.attempted
      ? Math.round((state.analytics.correct / state.analytics.attempted) * 100)
      : 0;
    const strongest = Object.entries(state.analytics.topicStats).sort((a, b) => b[1] - a[1])[0] || ["None", 0];
    const weakest = Object.entries(state.analytics.topicStats).sort((a, b) => a[1] - b[1])[0] || ["None", 0];

    analyticsPanel.innerHTML = `
      <div class="analytics-grid">
        <div class="analytics-card"><strong>${state.analytics.attempted}</strong><span>Total Attempted</span></div>
        <div class="analytics-card"><strong>${state.analytics.correct}</strong><span>Total Correct</span></div>
        <div class="analytics-card"><strong>${accuracy}%</strong><span>Accuracy</span></div>
        <div class="analytics-card"><strong>${averageTime}s</strong><span>Avg Response</span></div>
      </div>
      <div class="analytics-list">
        <div><strong>Strongest:</strong> ${strongest[0]}</div>
        <div><strong>Weakest:</strong> ${weakest[0]}</div>
        <div><strong>Recent Scores:</strong> ${state.analytics.recentScores.join(", ") || "None"}</div>
      </div>
    `;
  }

  return { init, loadQuestions, render, startPractice, nextQuestion, previousQuestion, submitAnswer, toggleBookmark, getFilteredQuestions, state };
})();

window.addEventListener("DOMContentLoaded", () => {
  sentenceModule.init();
});
