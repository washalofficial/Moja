import { GoogleGenAI } from "@google/genai";

const API_KEY = process.env.API_KEY || '';

export const generateCommitMessage = async (
  filesAdded: string[], 
  filesModified: string[], 
  filesDeleted: string[]
): Promise<string> => {
  if (!API_KEY) {
    console.warn("Gemini API Key missing, using default commit message.");
    return "chore: sync files via GitSync Mobile";
  }

  try {
    const ai = new GoogleGenAI({ apiKey: API_KEY });
    
    const prompt = `
      You are an expert developer writing git commit messages.
      Based on the following file changes, generate a concise and descriptive commit message (Conventional Commits format).
      
      Files Added:
      ${filesAdded.join('\n') || 'None'}
      
      Files Modified:
      ${filesModified.join('\n') || 'None'}
      
      Files Deleted:
      ${filesDeleted.join('\n') || 'None'}
      
      Output ONLY the commit message string. No markdown, no explanations.
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    return response.text.trim();
  } catch (error) {
    console.error("Gemini generation failed:", error);
    return "chore: batch update via GitSync Mobile";
  }
};
