/**
 * Deterministic pseudo-random sampler & shuffler for question pools & options.
 * Ensures:
 * 1. Question order is shuffled uniquely per student attempt.
 * 2. If pool > count, a randomized subset of `count` questions is picked.
 * 3. Options (A, B, C, D) are shuffled uniquely, with correctOptionIndex updated accurately.
 * 4. Refreshes in the same student session remain 100% consistent.
 */
function getSeededRandomQuestions(allQuestions, count, seedStr, optionsConfig = {}) {
  const { shuffleOptions = true } = optionsConfig;
  if (!allQuestions || !Array.isArray(allQuestions) || allQuestions.length === 0) return [];

  const targetCount = Math.min(Math.max(1, parseInt(count, 10) || allQuestions.length), allQuestions.length);

  // Simple string hash to initialize 32-bit integer seed
  let seed = 0;
  const str = String(seedStr || 'default_seed');
  for (let i = 0; i < str.length; i++) {
    seed = (seed * 31 + str.charCodeAt(i)) >>> 0;
  }

  // Linear Congruential Generator (LCG) pseudo-random function
  const lcg = () => {
    seed = (1664525 * seed + 1013904223) >>> 0;
    return seed / 4294967296;
  };

  // 1. Fisher-Yates shuffle on the question pool
  const pool = [...allQuestions];
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(lcg() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }

  // 2. Sample targetCount questions
  const selected = pool.slice(0, targetCount);

  // 3. Shuffle options for each question so adjacent seats have different A, B, C, D order
  return selected.map((q, idx) => {
    const qObj = (typeof q.toObject === 'function') ? q.toObject() : { ...q };

    if (shuffleOptions && Array.isArray(qObj.options) && qObj.options.length > 1) {
      const origOptions = [...qObj.options];
      const correctText = qObj.correctAnswer || origOptions[qObj.correctOptionIndex] || origOptions[0];

      // Shuffle options
      const shuffledOptions = [...origOptions];
      for (let i = shuffledOptions.length - 1; i > 0; i--) {
        const j = Math.floor(lcg() * (i + 1));
        [shuffledOptions[i], shuffledOptions[j]] = [shuffledOptions[j], shuffledOptions[i]];
      }

      // Find new index of the correct answer in shuffled choices
      let newCorrectIdx = shuffledOptions.findIndex(
        opt => opt && opt.trim().toLowerCase() === String(correctText).trim().toLowerCase()
      );
      if (newCorrectIdx === -1) newCorrectIdx = 0;

      qObj.options = shuffledOptions;
      qObj.correctOptionIndex = newCorrectIdx;
      qObj.correctAnswer = shuffledOptions[newCorrectIdx];
    }

    qObj.order = idx + 1;
    return qObj;
  });
}

module.exports = {
  getSeededRandomQuestions
};
