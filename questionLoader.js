const questionLoader = (() => {
  async function loadQuestions() {
    const response = await fetch("./data/sentence-questions.json");
    return response.json();
  }

  return { loadQuestions };
})();
