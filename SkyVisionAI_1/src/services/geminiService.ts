import { GoogleGenAI, Type } from "@google/genai";
import { InferenceClient } from "@huggingface/inference";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Destination {
  name: string;
  cityName: string;
  iataCode: string;
  matchPercentage: number;
  price: number;
  description: string;
  imagePrompt: string;
}

export interface TravelConcept {
  heroTitle: string;
  heroDescription: string;
  confidence: number;
  coordinates: string;
  imagePrompt: string;
  destinations: Destination[];
}

export async function generateTravelConcept(keywords: string[], origin: string, departure: string, returnDate: string): Promise<TravelConcept> {
  const prompt = `Based on these keywords: ${keywords.join(", ")}, starting from origin city with IATA code: ${origin}, traveling from ${departure} to ${returnDate}, generate a travel concept.
  Include a hero title, description, AI confidence percentage, mock coordinates, and 3 specific destination recommendations that would be interesting or accessible from ${origin} during those dates (take seasonality into account).
  for each destination, provide:
  - name: A creative display name (e.g., "The Neon Streets of Tokyo")
  - cityName: The actual city name (e.g., "Tokyo")
  - iataCode: The 3-letter IATA code for the main airport (e.g., "HND", "CDG", "JFK")
  - matchPercentage: A number (1-100)
  - price: A default estimated price in EUR
  - description: A 1-sentence description
  - imagePrompt: A specific image prompt for this location.
  Also provide a detailed high-quality image prompt for the hero section that matches the vibe.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          heroTitle: { type: Type.STRING },
          heroDescription: { type: Type.STRING },
          confidence: { type: Type.NUMBER },
          coordinates: { type: Type.STRING },
          imagePrompt: { type: Type.STRING },
          destinations: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                cityName: { type: Type.STRING },
                iataCode: { type: Type.STRING },
                matchPercentage: { type: Type.NUMBER },
                price: { type: Type.NUMBER },
                description: { type: Type.STRING },
                imagePrompt: { type: Type.STRING },
              },
              required: ["name", "cityName", "iataCode", "matchPercentage", "price", "description", "imagePrompt"],
            },
          },
        },
        required: ["heroTitle", "heroDescription", "confidence", "coordinates", "imagePrompt", "destinations"],
      },
    },
  });

  return JSON.parse(response.text.trim());
}

export async function generateKeywordSuggestions(currentKeywords: string[]): Promise<string[]> {
  if (currentKeywords.length === 0) {
    return ['Beach', 'Mountains', 'Adventure', 'Relaxation', 'Culture'];
  }

  const prompt = `Based on these travel keywords: ${currentKeywords.join(", ")}, suggest 5 more related, specific, and evocative travel-related words or short phrases that would help refine a travel search. Return ONLY a JSON array of strings.`;

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: prompt,
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.ARRAY,
        items: { type: Type.STRING },
      },
    },
  });

  try {
    return JSON.parse(response.text.trim());
  } catch (e) {
    console.error("Failed to parse suggestions", e);
    return [];
  }
}

export async function generateHeroImage(prompt: string): Promise<string> {
  const hfToken = import.meta.env.VITE_HUGGINGFACE_API_TOKEN;

  if (!hfToken) {
    throw new Error("Hugging Face API token not found. Please configure VITE_HUGGINGFACE_API_TOKEN.");
  }

  const client = new InferenceClient(hfToken);

  const finalPrompt = `Professional travel photography, high resolution, cinematic lighting, realistic: ${prompt}`;

  const imageBlob = await client.textToImage({
    provider: "fal-ai",
    model: "baidu/ERNIE-Image",
    inputs: finalPrompt,
    parameters: { num_inference_steps: 5 },
  });

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(imageBlob);
  });
}