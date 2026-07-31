const analytics = (() => {
  function buildSummary(state) {
    const attempted = state.analytics.attempted || 0;
    const correct = state.analytics.correct || 0;
    const accuracy = attempted ? Math.round((correct / attempted) * 100) : 0;
    const averageTime = state.analytics.responseTimes.length
      ? Math.round(state.analytics.responseTimes.reduce((a, b) => a + b, 0) / state.analytics.responseTimes.length)
      : 0;
    const topics = Object.entries(state.analytics.topicStats || {}).sort((a, b) => b[1] - a[1]);
    return { attempted, correct, accuracy, averageTime, topics };
  }

  return { buildSummary };
})();
