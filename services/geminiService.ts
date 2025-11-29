import { GoogleGenAI } from "@google/genai";

export const generateCommitMessage = async (
  filesAdded: string[], 
  filesModified: string[], 
  filesDeleted: string[]
): Promise<string> => {
  let apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  
  if (!apiKey) {
    try {
      const response = await fetch('/.env');
      const envText = await response.text();
      const match = envText.match(/VITE_GEMINI_API_KEY=(.+)/);
      apiKey = match ? match[1].trim() : '';
    } catch (e) {
      console.warn("Could not read env file");
    }
  }
  
  if (!apiKey) {
    console.warn("Gemini API Key not configured. Using default commit message.");
    return `chore: sync ${filesAdded.length} added, ${filesModified.length} modified, ${filesDeleted.length} deleted via GitSync`;
  }

  try {
    const ai = new GoogleGenAI({ apiKey });
    
    const prompt = `You are an expert developer. Generate a Conventional Commits message (one line only) for these changes:
Added: ${filesAdded.slice(0, 3).join(', ') || 'none'}${filesAdded.length > 3 ? ` +${filesAdded.length - 3}` : ''}
Modified: ${filesModified.slice(0, 3).join(', ') || 'none'}${filesModified.length > 3 ? ` +${filesModified.length - 3}` : ''}
Deleted: ${filesDeleted.length > 0 ? filesDeleted.length + ' files' : 'none'}
Output ONLY the commit message, no explanation.`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
    });

    const msg = response.text?.trim();
    return msg && msg.length > 0 ? msg : `chore: sync ${filesAdded.length + filesModified.length} files`;
  } catch (error) {
    console.warn("Gemini generation skipped:", error);
    return `chore: sync ${filesAdded.length} added, ${filesModified.length} modified files`;
  }
};
