// Fix: Align with @google/genai coding guidelines.
// Use process.env.API_KEY directly and remove runtime checks, assuming it's always available.
// Refactor the prompt to use the `config.systemInstruction` property for better clarity and performance.
import { GoogleGenAI } from "@google/genai";
import { GLAccount } from '../types';

// Per coding guidelines, the API key must be obtained exclusively from the environment variable `process.env.API_KEY`.
// We assume this variable is pre-configured, valid, and accessible.
// FIX: Removed non-null assertion from API_KEY as per coding guidelines.
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getChatResponse = async (
  userInput: string,
  glAccounts: GLAccount[]
): Promise<string> => {
  // Per coding guidelines, we assume the API key is configured, so no runtime check is needed.

  const model = 'gemini-2.5-flash';
  
  const formattedData = glAccounts.map(acc => ({
      "GL Account": acc.glAccount,
      "Account Number": acc.glAccountNumber,
      "Department": acc.responsibleDept,
      "Category": acc.mainHead,
      "Review Status": acc.reviewStatus,
      "Current Stage": acc.currentChecker || 'Finalized',
      "Reviewer": acc.reviewer,
      "SPOC": acc.spoc,
      "Mistake Count": acc.mistakeCount
  }));

const systemInstruction = `You are FinSight AI, an intelligent assistant for financial auditing and workflow analysis.
Your task is to answer questions based ONLY on the JSON data provided in the user's prompt. The data represents General Ledger (GL) accounts and their current review status.
Do not make up information or answer questions outside of this data context. If the answer is not in the data, state that clearly.

Response style requirements:
- Never return JSON, code blocks containing JSON, or raw key-value pairs.
- Reply in polished Markdown prose sized for an executive reader: a short intro sentence followed by concise bullets or paragraphs.
- Use bullet points only when they improve clarity; otherwise keep responses brief and narrative.
- When precise numbers or counts are relevant, highlight them inline (e.g., **12 accounts**).

Data Schema Guide:
- "Review Status": The status of the item (e.g., Pending, Mismatch, Finalized).
- "Current Stage": The current person/team responsible for the next action (e.g., Checker 1, Checker 2, Finalized).`;
  
  // FIX: Refactored prompt for better clarity by providing data in a structured way.
  const userPrompt = `
Here is the GL account data:
\`\`\`json
${JSON.stringify(formattedData, null, 2)}
\`\`\`

Based on the data above, please answer the following question:
"${userInput}"
  `;

  try {
    const response = await ai.models.generateContent({
      model: model,
      contents: userPrompt,
      config: {
        systemInstruction,
      },
    });
    return response.text;
  } catch (error) {
    console.error("Error calling Gemini API:", error);
    return "Sorry, I encountered an error while processing your request. Please check the console for details.";
  }
};
