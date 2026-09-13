/**
 * Intelligent question parser for pasted text or JSON.
 * Parses ChatGPT, Claude, Word, textbook, or JSON questions into standardized MCQs:
 * - Extracts question prompt
 * - Extracts code snippet (inside ``` or indented)
 * - Extracts 4 options (A, B, C, D)
 * - Identifies correct answer key (Answer: B, Ans: 1, etc.)
 * - Extracts explanation
 */
export function parsePastedQuestions(rawText) {
  if (!rawText || !rawText.trim()) return [];
  const trimmed = rawText.trim();

  // 1. Check if raw JSON array was pasted
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item, idx) => {
          const opts = Array.isArray(item.options) && item.options.length > 0
            ? item.options
            : ['Choice A', 'Choice B', 'Choice C', 'Choice D'];
          const correctIdx = typeof item.correctOptionIndex === 'number'
            ? item.correctOptionIndex
            : (item.correctAnswer ? Math.max(0, opts.indexOf(item.correctAnswer)) : 0);

          return {
            type: 'mcq',
            category: item.category || (item.codeSnippet ? 'programming' : 'theory'),
            prompt: item.prompt || item.question || `Question ${idx + 1}`,
            codeSnippet: item.codeSnippet || '',
            options: opts,
            correctOptionIndex: correctIdx,
            correctAnswer: item.correctAnswer || opts[correctIdx] || opts[0],
            explanation: item.explanation || '',
            maxMarks: Number(item.maxMarks) || 2,
            order: idx + 1
          };
        });
      }
    } catch (e) {
      // Not valid JSON, continue to natural text parsing
    }
  }

  // 2. Natural Text Parser
  const questions = [];
  // Split by question markers: "1.", "Q1:", "Question 1.", etc.
  const blocks = trimmed.split(/(?:^|\n+)(?=(?:Q(?:uestion)?\s*\d+[:.)]|\d+[:.)]\s+))/i).filter(b => b.trim().length > 5);

  const rawBlocks = blocks.length > 0 ? blocks : [trimmed];

  rawBlocks.forEach((block, idx) => {
    let cleanBlock = block.trim().replace(/^(?:Q(?:uestion)?\s*\d+[:.)]|\d+[:.)])\s*/i, '');

    // Extract code block if wrapped in triple backticks
    let codeSnippet = '';
    const codeMatch = cleanBlock.match(/```(?:[a-zA-Z]*\n)?([\s\S]*?)```/);
    if (codeMatch) {
      codeSnippet = codeMatch[1].trim();
      cleanBlock = cleanBlock.replace(/```(?:[a-zA-Z]*\n)?[\s\S]*?```/, '').trim();
    }

    // Extract Explanation
    let explanation = '';
    const expMatch = cleanBlock.match(/(?:Explanation|Exp|Rationale)\s*[:=-]\s*([\s\S]*?)(?=$|\n\s*[A-D]\)|\n\s*Answer)/i);
    if (expMatch) {
      explanation = expMatch[1].trim();
      cleanBlock = cleanBlock.replace(/(?:Explanation|Exp|Rationale)\s*[:=-]\s*[\s\S]*?(?=$|\n\s*[A-D]\)|\n\s*Answer)/i, '').trim();
    }

    // Extract Answer key line if present
    let answerText = '';
    const ansMatch = cleanBlock.match(/(?:Answer|Ans|Correct(?:\s+Answer|\s+Option)?|Key|Right(?:\s+Answer)?)\s*[:=-]\s*([^\n]+)/i);
    if (ansMatch) {
      answerText = ansMatch[1].trim();
      cleanBlock = cleanBlock.replace(/(?:Answer|Ans|Correct(?:\s+Answer|\s+Option)?|Key|Right(?:\s+Answer)?)\s*[:=-]\s*[^\n]+/i, '').trim();
    }

    // Extract Options: A), B), C), D) or a., b., c., d. or [A], [B] or Option A: or *A), *B)
    const optionMatches = [...cleanBlock.matchAll(/(?:^|\n)\s*\*?\s*(?:[([A-Da-d][).\]]|(?:Option\s+[A-D][:.]))\s*([^\n]+)/gi)];
    let options = [];
    let markedCorrectIdx = -1;

    if (optionMatches.length >= 2) {
      options = optionMatches.map((m, optIdx) => {
        let text = m[1].trim();
        const fullMatch = m[0];
        // Check if marked with asterisk (*A) or text*) or (Correct) / [Correct]
        if (fullMatch.includes('*') || text.includes('*') || /\((?:correct|true|ans)\)/i.test(text) || /\[(?:correct|true|ans)\]/i.test(text)) {
          markedCorrectIdx = optIdx;
        }
        // Clean up markers from option text
        text = text.replace(/\s*\((?:correct|true|ans)\)/i, '')
                   .replace(/\s*\[(?:correct|true|ans)\]/i, '')
                   .replace(/^\*\s*/, '')
                   .replace(/\s*\*$/, '')
                   .trim();
        return text;
      });
    }

    // Prompt is whatever is left before the options
    let prompt = cleanBlock.split(/(?:^|\n)\s*\*?\s*(?:[([A-Da-d][).\]]|(?:Option\s+[A-D][:.]))/i)[0].trim();
    if (!prompt) prompt = `Question ${idx + 1}`;

    // Determine correctOptionIndex from marked option, answer text, or default to 0
    let correctIndex = 0;
    if (markedCorrectIdx !== -1) {
      correctIndex = markedCorrectIdx;
    } else if (answerText) {
      const letterMatch = answerText.match(/^[A-Da-d]/);
      if (letterMatch) {
        const char = letterMatch[0].toUpperCase();
        correctIndex = ['A', 'B', 'C', 'D'].indexOf(char);
        if (correctIndex === -1) correctIndex = 0;
      } else {
        const foundIdx = options.findIndex(opt => opt.toLowerCase() === answerText.toLowerCase());
        if (foundIdx !== -1) correctIndex = foundIdx;
      }
    }

    if (options.length < 2) {
      options = ['Choice A', 'Choice B', 'Choice C', 'Choice D'];
    }

    questions.push({
      type: 'mcq',
      category: codeSnippet ? 'programming' : 'theory',
      prompt,
      codeSnippet,
      options,
      correctOptionIndex: correctIndex,
      correctAnswer: options[correctIndex] || options[0],
      explanation,
      maxMarks: 2,
      order: idx + 1
    });
  });

  return questions;
}
