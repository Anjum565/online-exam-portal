const { GoogleGenerativeAI } = require('@google/generative-ai');

/**
 * Service to generate exam questions using Google Gemini API or intelligent topic-based generator.
 * Supports:
 * - 'combined_objective': Combines Theory Concepts + Programming / Code Analysis (Strictly Objective MCQs)
 * - 'theory_objective': Theory Principles & Definitions Only (Objective MCQs)
 * - 'programming_objective': Programming Code Snippets, Output Prediction & Bug Tracing (Objective MCQs)
 * - 'subjective': Descriptive Essay Questions
 */
async function generateQuestionsFromLLM({
  subject,
  topic,
  difficulty = 'medium',
  questionCount = 5,
  examType = 'combined_objective',
  questionComposition = 'combined_objective',
  customApiKey = null
}) {
  const apiKey = customApiKey || process.env.GEMINI_API_KEY;
  const topicsList = topic ? topic.split(',').map(t => t.trim()).filter(Boolean) : ['Core Principles'];
  const formattedTopics = topicsList.length > 1 ? topicsList.join('; ') : (topic || 'Core Subject Concepts');

  // Determine mode
  const mode = questionComposition || examType || 'combined_objective';
  const isSubjective = mode === 'subjective';
  const isProgrammingOnly = mode === 'programming_objective';
  const isTheoryOnly = mode === 'theory_objective';
  const isCombined = !isSubjective && !isProgrammingOnly && !isTheoryOnly; // default combined objective

  const count = parseInt(questionCount) || 5;
  const theoryCount = isCombined ? Math.ceil(count / 2) : (isTheoryOnly ? count : 0);
  const progCount = isCombined ? (count - theoryCount) : (isProgrammingOnly ? count : 0);

  if (apiKey && !apiKey.includes('YOUR_FREE_TIER_GEMINI_API_KEY') && apiKey.trim().length > 10) {
    const modelsToTry = ['gemini-1.5-flash', 'gemini-2.0-flash', 'gemini-1.5-pro'];
    const genAI = new GoogleGenerativeAI(apiKey.trim());

    for (const modelName of modelsToTry) {
      try {
        console.log(`🤖 Requesting Google Gemini API (${modelName}) to generate ${count} questions [Mode: ${mode}] for "${subject}" - "${formattedTopics}"...`);
        const model = genAI.getGenerativeModel({ model: modelName });

        let promptText = '';

        if (isSubjective) {
          promptText = `You are an academic examiner. Generate exactly ${count} descriptive subjective exam questions for subject "${subject}" strictly covering topics: ${formattedTopics}. Difficulty: ${difficulty}.
Respond ONLY with a JSON array:
[
  {
    "type": "short",
    "category": "theory",
    "prompt": "Subjective question statement?",
    "options": [],
    "suggestedAnswer": "Key points expected in student answer.",
    "maxMarks": 5,
    "order": 1
  }
]`;
        } else {
          // OBJECTIVE MODES (MCQs)
          let compositionInstructions = '';
          if (isCombined) {
            compositionInstructions = `
STRICT DUAL COMPOSITION (COMBINED OBJECTIVE MODE):
- Exactly ${theoryCount} questions MUST be THEORETICAL / CONCEPTUAL MCQs:
  * Testing core theory, definitions, architectural trade-offs, protocols, and principles of ${formattedTopics}.
  * Set "category": "theory", "codeSnippet": "".
- Exactly ${progCount} questions MUST be PRACTICAL PROGRAMMING / CODE ANALYSIS MCQs:
  * Must feature concrete code snippets in the relevant programming language for ${subject} / ${formattedTopics}.
  * Must test code output prediction ("What is the output of the following code?"), bug identification, syntax rules, or logic tracing.
  * Provide the code snippet in "codeSnippet" and refer to it in "prompt".
  * Set "category": "programming".`;
          } else if (isProgrammingOnly) {
            compositionInstructions = `
STRICT PROGRAMMING OBJECTIVE MODE:
- ALL ${count} questions MUST be PROGRAMMING / CODE ANALYSIS MCQs with realistic code snippets testing output prediction, error detection, and runtime values.
- Set "category": "programming".`;
          } else {
            compositionInstructions = `
STRICT THEORY OBJECTIVE MODE:
- ALL ${count} questions MUST be THEORETICAL CONCEPTUAL MCQs testing definitions, principles, and concepts.
- Set "category": "theory", "codeSnippet": "".`;
          }

          promptText = `You are an expert computer science and technical examination board creator.
Generate exactly ${count} high-quality, scientifically accurate Multiple Choice Questions (MCQs) in STRICT OBJECTIVE MODE for the subject "${subject}" covering topics: "${formattedTopics}".
Difficulty level: ${difficulty}.
${compositionInstructions}

CRITICAL RULES:
1. ALL questions MUST be strictly OBJECTIVE Multiple Choice Questions (MCQs).
2. Absolutely NO subjective, descriptive, or essay questions.
3. Every question must have exactly 4 realistic, distinct options in the "options" array.
4. "correctOptionIndex" must be a number: 0, 1, 2, or 3 pointing to the correct choice.
5. "correctAnswer" must match the string options[correctOptionIndex].
6. Provide a clear, educational "explanation" of why this option is correct.
7. Set "maxMarks" to 2 per question.

Respond ONLY with a valid, clean JSON array with no markdown wrappers or text outside the array:
[
  {
    "type": "mcq",
    "category": "theory",
    "prompt": "What is the primary principle behind...?",
    "codeSnippet": "",
    "options": ["Choice A", "Choice B", "Choice C", "Choice D"],
    "correctOptionIndex": 1,
    "correctAnswer": "Choice B",
    "explanation": "Explanation here...",
    "maxMarks": 2,
    "order": 1
  },
  {
    "type": "mcq",
    "category": "programming",
    "prompt": "Consider the following code snippet. What will be printed to the console?",
    "codeSnippet": "let x = [1, 2, 3];\nx.length = 0;\nconsole.log(x[0]);",
    "options": ["undefined", "null", "0", "1"],
    "correctOptionIndex": 0,
    "correctAnswer": "undefined",
    "explanation": "Setting array length to 0 empties it, so accessing index 0 yields undefined.",
    "maxMarks": 2,
    "order": 2
  }
]`;
        }

        const result = await model.generateContent(promptText);
        const responseText = result.response.text() || '';
        const cleanJson = responseText.replace(/```json/gi, '').replace(/```/g, '').trim();
        const questions = JSON.parse(cleanJson);

        if (Array.isArray(questions) && questions.length > 0) {
          console.log(`✅ Google Gemini API (${modelName}) successfully generated ${questions.length} objective questions (Mode: ${mode}).`);
          return questions;
        }
      } catch (err) {
        console.warn(`⚠️ Gemini API model ${modelName} encountered: ${err.message}. Trying next model...`);
      }
    }
  }

  // Fallback generator: Strictly topic-tailored objective questions
  console.log(`ℹ️ Generating offline topic-tailored objective questions [Mode: ${mode}] for "${subject}" - "${formattedTopics}".`);
  return generateTopicTailoredQuestions(subject, topicsList, difficulty, count, mode);
}

/**
 * Intelligent topic-tailored generator supporting combined theory + programming in objective mode.
 */
function generateTopicTailoredQuestions(subject, topicsList, difficulty, count, mode) {
  const topics = topicsList.length > 0 ? topicsList : ['Core Architecture'];
  const questions = [];

  const isSubjective = mode === 'subjective';
  const isProgrammingOnly = mode === 'programming_objective';
  const isTheoryOnly = mode === 'theory_objective';
  const isCombined = !isSubjective && !isProgrammingOnly && !isTheoryOnly;

  // Language heuristics based on subject / topic
  let detectedLang = 'javascript';
  const subLower = (subject + ' ' + topics.join(' ')).toLowerCase();
  if (subLower.includes('python')) detectedLang = 'python';
  else if (subLower.includes('java') && !subLower.includes('script')) detectedLang = 'java';
  else if (subLower.includes('c++') || subLower.includes('cpp')) detectedLang = 'cpp';
  else if (subLower.includes('sql') || subLower.includes('database') || subLower.includes('db')) detectedLang = 'sql';
  else if (subLower.includes('c#') || subLower.includes('.net')) detectedLang = 'csharp';

  // Programming Question Templates per language
  const programmingTemplates = {
    python: [
      {
        prompt: "What is the output of the following Python code snippet?",
        codeSnippet: `def compute_val(items):\n    return [x * 2 for x in items if x % 2 == 0]\n\nprint(compute_val([1, 2, 3, 4]))`,
        options: ["[4, 8]", "[2, 4, 6, 8]", "[2, 4]", "[4, 16]"],
        correctOptionIndex: 0,
        explanation: "The list comprehension filters for even numbers (2, 4) and doubles them, yielding [4, 8]."
      },
      {
        prompt: "Which line or expression will raise a TypeError in Python?",
        codeSnippet: `data = {"status": "ok", "code": 200}\n# Line 1: data.get("key", 0)\n# Line 2: "Code: " + data["code"]\n# Line 3: list(data.keys())`,
        options: ["Line 2: Concatenating string with integer", "Line 1: Default dict access", "Line 3: Extracting keys to list", "None; all lines execute successfully"],
        correctOptionIndex: 0,
        explanation: "In Python, string and integer cannot be directly concatenated with + without str() conversion."
      },
      {
        prompt: "What will the following code snippet return?",
        codeSnippet: `vals = [10, 20, 30]\nref = vals\nref.append(40)\nprint(len(vals))`,
        options: ["4", "3", "Error: Variable is immutable", "1"],
        correctOptionIndex: 0,
        explanation: "Lists are mutable reference types in Python; modifying ref alters vals, so length is 4."
      }
    ],
    sql: [
      {
        prompt: "What is the result of executing the following SQL query?",
        codeSnippet: `SELECT department, COUNT(*) AS total\nFROM Employees\nGROUP BY department\nHAVING COUNT(*) > 5;`,
        options: [
          "Returns departments having strictly more than 5 employee records",
          "Returns the first 5 records in each department",
          "Fails with syntax error because HAVING requires WHERE",
          "Calculates the average salary for 5 employees"
        ],
        correctOptionIndex: 0,
        explanation: "The HAVING clause filters aggregated groups after GROUP BY, selecting departments with count > 5."
      },
      {
        prompt: "Which statement best describes the effect of this transaction?",
        codeSnippet: `BEGIN TRANSACTION;\nUPDATE Accounts SET balance = balance - 100 WHERE id = 1;\nSAVEPOINT sp1;\nROLLBACK TO sp1;\nCOMMIT;`,
        options: [
          "The balance deduction remains committed because rollback only reverted to sp1",
          "The entire transaction is cancelled with no database updates",
          "A deadlock occurs on the Accounts table",
          "Syntax error at SAVEPOINT"
        ],
        correctOptionIndex: 0,
        explanation: "Rolling back to sp1 preserves changes made before the savepoint, so the update is committed."
      }
    ],
    javascript: [
      {
        prompt: "What will be printed to the console upon running this JavaScript code?",
        codeSnippet: `const numbers = [1, 2, 3];\nconst [first, ...rest] = numbers;\nconsole.log(rest);`,
        options: ["[2, 3]", "[1, 2]", "3", "undefined"],
        correctOptionIndex: 0,
        explanation: "Array destructuring with rest syntax extracts the remaining elements into a new array [2, 3]."
      },
      {
        prompt: "What is the output of the following asynchronous function?",
        codeSnippet: `async function test() {\n  const p = Promise.resolve(10);\n  const res = await p;\n  return res * 2;\n}\ntest().then(console.log);`,
        options: ["20", "Promise { <pending> }", "10", "NaN"],
        correctOptionIndex: 0,
        explanation: "The async function resolves the promise to 10, multiplies by 2, and prints 20."
      },
      {
        prompt: "What does the following snippet evaluate to?",
        codeSnippet: `const obj = { a: 1 };\nObject.freeze(obj);\nobj.a = 2;\nconsole.log(obj.a);`,
        options: ["1 (mutation is prevented)", "2", "TypeError in all modes", "undefined"],
        correctOptionIndex: 0,
        explanation: "Object.freeze() makes the object immutable; attempts to reassign properties fail silently (or throw in strict mode)."
      }
    ]
  };

  const genericProgTemplates = programmingTemplates[detectedLang] || programmingTemplates.javascript;

  for (let i = 1; i <= count; i++) {
    const currentTopic = topics[(i - 1) % topics.length];

    // Determine if this question should be theory or programming
    let qCategory = 'theory';
    if (isProgrammingOnly) {
      qCategory = 'programming';
    } else if (isTheoryOnly) {
      qCategory = 'theory';
    } else if (isCombined) {
      // In combined mode: even-numbered questions are programming, odd-numbered are theory
      qCategory = (i % 2 === 0) ? 'programming' : 'theory';
    }

    if (isSubjective) {
      questions.push({
        type: 'short',
        category: 'theory',
        prompt: `Analyze the core principles and operational challenges of "${currentTopic}" in ${subject}. Provide standard industry best practices.`,
        options: [],
        suggestedAnswer: `Model answer for ${currentTopic}: 1. Formal definition (2 pts), 2. Implementation mechanisms (2 pts), 3. Trade-offs (1 pt).`,
        maxMarks: 5,
        order: i
      });
      continue;
    }

    if (qCategory === 'programming') {
      const template = genericProgTemplates[(i - 1) % genericProgTemplates.length];
      questions.push({
        type: 'mcq',
        category: 'programming',
        prompt: `[Programming & Code Analysis] In the context of ${currentTopic} (${subject}), analyze the snippet below:\n${template.prompt}`,
        codeSnippet: template.codeSnippet,
        options: template.options,
        correctOptionIndex: template.correctOptionIndex,
        correctAnswer: template.options[template.correctOptionIndex],
        explanation: template.explanation,
        maxMarks: 2,
        order: i
      });
    } else {
      // Theory MCQ
      const options = [
        `It establishes foundational operational principles, boundaries, and standards for ${currentTopic}.`,
        `It operates strictly as an unvalidated heuristic with no theoretical backing.`,
        `It eliminates modular abstraction and introduces unconstrained system coupling.`,
        `It is deprecated in modern industry practice and replaced by arbitrary random selection.`
      ];

      questions.push({
        type: 'mcq',
        category: 'theory',
        prompt: `[Theory & Conceptual Principles] Which statement most accurately defines the core architecture and role of "${currentTopic}" in ${subject}?`,
        codeSnippet: '',
        options: options,
        correctOptionIndex: 0,
        correctAnswer: options[0],
        explanation: `In ${subject}, ${currentTopic} provides formal architectural standards, separation of concerns, and verifiable lifecycle management.`,
        maxMarks: 2,
        order: i
      });
    }
  }

  return questions;
}

module.exports = {
  generateQuestionsFromLLM
};
