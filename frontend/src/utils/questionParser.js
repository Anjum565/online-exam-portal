/**
 * Intelligent question parser for pasted text or JSON.
 * Parses ChatGPT, Claude, Word, textbook, or JSON questions into standardized questions:
 * - Automatically detects programming blocks (Java, Python, C/C++, JS, SQL, HTML, etc.)
 *   even when pasted without Markdown triple backticks (```)
 * - Identifies programming language (c, cpp, java, python, javascript, sql, html)
 * - Extracts clean question prompt and separated codeSnippet
 * - Extracts 4 options (A, B, C, D) for objective MCQs
 * - Supports open-ended coding questions (where students write programs)
 * - Identifies correct answer key (Answer: B, Ans: 1, etc.)
 * - Extracts explanation
 */

export function detectLanguage(code) {
  if (!code || typeof code !== 'string') return '';
  const lower = code.toLowerCase();
  if (lower.includes('#include') || lower.includes('printf(') || lower.includes('scanf(')) {
    if (lower.includes('cout') || lower.includes('cin') || lower.includes('namespace') || lower.includes('iostream')) {
      return 'cpp';
    }
    return 'c';
  }
  if (lower.includes('system.out') || lower.includes('public class') || lower.includes('public static void') || lower.includes('system.in')) {
    return 'java';
  }
  if (lower.includes('def ') || lower.includes('elif ') || lower.includes('print(') || lower.includes('__init__') || lower.includes('self.')) {
    return 'python';
  }
  if (lower.includes('console.log') || lower.includes('function') || lower.includes('=>') || lower.includes('const ') || lower.includes('let ')) {
    return 'javascript';
  }
  if (lower.includes('select ') && lower.includes('from ')) {
    return 'sql';
  }
  if (lower.includes('<html') || lower.includes('<div') || lower.includes('<!doctype')) {
    return 'html';
  }
  return '';
}

export function isCodeLine(line) {
  const t = line.trim();
  if (!t) return false;

  // Strong programming constructs
  if (/^(?:#include|import |package |using namespace|from \w+ import)/.test(t)) return true;
  if (/^(?:public|private|protected)?\s*(?:static\s+)?(?:class|interface|enum)\s+\w+/.test(t)) return true;
  if (/^(?:public|private|protected)?\s*(?:static\s+)?(?:void|int|float|double|char|boolean|String|auto)\s+\w+\s*\(/.test(t)) return true;
  if (/^(?:def|function)\s+\w+\s*\(/.test(t)) return true;
  if (/^(?:int|float|double|char|bool|boolean|String|let|const|var)\s+\w+[\s=;,]/.test(t)) return true;
  if (/(?:printf|scanf|cout\s*<<|cin\s*>>|System\.out\.|console\.log|print)\s*[<(]/.test(t)) return true;
  if (/^(?:if|else if|elif|else|for|while|switch|case|default|return|throw|try|catch|finally)\b/.test(t)) return true;
  if (/^(?:SELECT|INSERT INTO|UPDATE|DELETE FROM|CREATE TABLE|ALTER TABLE)\b/i.test(t)) return true;
  if (t === '{' || t === '}' || t === '};') return true;
  if (t.endsWith(';') && /[\w)=]/.test(t)) return true;
  if (line.startsWith('    ') || line.startsWith('\t')) {
    if (/[{};=()+*-]/.test(t)) return true;
  }
  return false;
}

export function extractCodeAndPrompt(text) {
  // 1. Check for explicit Markdown backtick fences (```lang ... ``` or ``` ... ```)
  const fenceMatch = text.match(/```([a-zA-Z]*)\n?([\s\S]*?)```/);
  if (fenceMatch) {
    const snippet = fenceMatch[2].trim();
    const lang = (fenceMatch[1] || '').trim().toLowerCase() || detectLanguage(snippet);
    const cleanPrompt = text.replace(/```[a-zA-Z]*\n?[\s\S]*?```/, '').trim();
    return {
      prompt: cleanPrompt || 'Consider the following program code:',
      codeSnippet: snippet,
      language: lang
    };
  }

  // 2. Line-by-line heuristic detection for unescaped code
  const lines = text.split('\n');
  let firstCodeLine = -1;
  let lastCodeLine = -1;

  for (let i = 0; i < lines.length; i++) {
    if (isCodeLine(lines[i])) {
      if (firstCodeLine === -1) firstCodeLine = i;
      lastCodeLine = i;
    }
  }

  // If code lines were detected, extract continuous code block
  if (firstCodeLine !== -1 && lastCodeLine >= firstCodeLine) {
    const codeLines = lines.slice(firstCodeLine, lastCodeLine + 1);
    const snippet = codeLines.join('\n').trim();
    const promptLines = lines.slice(0, firstCodeLine).concat(lines.slice(lastCodeLine + 1));
    const cleanPrompt = promptLines.join('\n').trim();

    if (snippet.length > 5) {
      const lang = detectLanguage(snippet);
      return {
        prompt: cleanPrompt || 'Consider the following program code:',
        codeSnippet: snippet,
        language: lang
      };
    }
  }

  return {
    prompt: text.trim(),
    codeSnippet: '',
    language: ''
  };
}

export function parsePastedQuestions(rawText) {
  if (!rawText || !rawText.trim()) return [];
  const trimmed = rawText.trim();

  // 1. Check if raw JSON array was pasted
  if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map((item, idx) => {
          const isCoding = item.type === 'coding' || (!item.options && (item.category === 'programming' || item.codeSnippet));
          const opts = Array.isArray(item.options) && item.options.length > 0
            ? item.options
            : (isCoding ? [] : ['Choice A', 'Choice B', 'Choice C', 'Choice D']);
          const correctIdx = typeof item.correctOptionIndex === 'number'
            ? item.correctOptionIndex
            : (item.correctAnswer ? Math.max(0, opts.indexOf(item.correctAnswer)) : 0);

          const code = item.codeSnippet || '';
          const lang = item.language || detectLanguage(code);

          return {
            type: item.type || (isCoding ? 'coding' : 'mcq'),
            category: item.category || (code ? 'programming' : 'theory'),
            prompt: item.prompt || item.question || `Question ${idx + 1}`,
            codeSnippet: code,
            language: lang,
            options: opts,
            correctOptionIndex: correctIdx,
            correctAnswer: item.correctAnswer || (opts.length > 0 ? opts[correctIdx] : ''),
            explanation: item.explanation || '',
            maxMarks: Number(item.maxMarks) || (isCoding ? 5 : 2),
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

    // Question body text is everything before the options
    let bodyText = cleanBlock.split(/(?:^|\n)\s*\*?\s*(?:[([A-Da-d][).\]]|(?:Option\s+[A-D][:.]))/i)[0].trim();

    // Use intelligent code extractor to separate code from prompt
    const { prompt: extractedPrompt, codeSnippet, language } = extractCodeAndPrompt(bodyText);
    let finalPrompt = extractedPrompt || `Question ${idx + 1}`;

    // Determine if this is an open-ended coding question or MCQ
    const isCodingTask = !options.length || options.length < 2;
    const hasCodingIntent = /write\s+a\s+(?:program|function|script|query|code)|implement|solve|develop\s+a\s+program/i.test(finalPrompt);

    let type = 'mcq';
    if (isCodingTask && (codeSnippet || hasCodingIntent)) {
      type = 'coding';
    }

    // Determine correctOptionIndex for MCQs
    let correctIndex = 0;
    if (type === 'mcq') {
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
    }

    questions.push({
      type,
      category: (codeSnippet || type === 'coding') ? 'programming' : 'theory',
      prompt: finalPrompt,
      codeSnippet: codeSnippet || '',
      language: language || detectLanguage(codeSnippet),
      options: type === 'mcq' ? options : [],
      correctOptionIndex: correctIndex,
      correctAnswer: type === 'mcq' ? (options[correctIndex] || options[0]) : '',
      explanation,
      maxMarks: type === 'coding' ? 5 : 2,
      order: idx + 1
    });
  });

  return questions;
}
