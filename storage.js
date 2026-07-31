const storage = (() => {
  const KEY = "sentenceCompletionState";

  function load() {
    const saved = localStorage.getItem(KEY);
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch (error) {
      return null;
    }
  }

  function save(value) {
    localStorage.setItem(KEY, JSON.stringify(value));
  }

  return { load, save };
})();
