import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Destination {
  name: string;
  country: string;
  description: string;
  similarity: number;
  tags: string[];
  estimatedPrice: number;
  imageKeyword: string;
}

export const geminiService = {
  // Get keyword recommendations based on current words
  async getRecommendations(currentWords: string[]): Promise<string[]> {
    const prompt = `Given these keywords describing a travel destination: ${currentWords.join(", ")}, suggest 5 more descriptive words or short phrases that would enhance the visual concept. Return only the words as a JSON array of strings.`;
    
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: { type: Type.STRING }
          }
        }
      });
      return JSON.parse(response.text || "[]");
    } catch (error) {
      console.error("Error getting recommendations:", error);
      return ["tropical", "adventure", "serene", "historic", "vibrant"];
    }
  },

  // Match the final prompt to N real-world destinations
  async matchDestinations(finalPrompt: string, count: number, origin: string = "MAD"): Promise<Destination[]> {
    const prompt = `Analyze this visual description: "${finalPrompt}". 
    Identify ${count} real-world travel destinations (city and country) that best match this aesthetic/vibe. 
    Assume flight origin is ${origin}.
    
    For each destination, provide:
    1. Name
    2. Country
    3. A 2-sentence description
    4. A similarity percentage (0-100)
    5. 3 short tags
    6. estimatedPrice (An estimated round-trip flight price in Euros from ${origin})
    7. imageKeyword (A specific search keyword to find a beautiful photo of this place)
    
    Return the response as a JSON array of objects.`;

    try {
      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                country: { type: Type.STRING },
                description: { type: Type.STRING },
                similarity: { type: Type.NUMBER },
                tags: { 
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                },
                estimatedPrice: { type: Type.NUMBER },
                imageKeyword: { type: Type.STRING }
              },
              required: ["name", "country", "description", "similarity", "tags", "estimatedPrice", "imageKeyword"]
            }
          }
        }
      });
      return JSON.parse(response.text || "[]");
    } catch (error) {
      console.error("Error matching destinations:", error);
      return [];
    }
  }
};
