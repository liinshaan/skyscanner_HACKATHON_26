import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface Destination {
  name: string;
  cityName: string;
  iataCode: string; // Used for Skyscanner lookup
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
    return [
      'Beach',
      'Mountains',
      'Adventure',
      'Relaxation',
      'Culture'
    ];
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

export async function generateHeroImage(prompt: string, baseImage?: string): Promise<string> {
  const hfToken = import.meta.env.VITE_HUGGINGFACE_API_TOKEN;
  
  if (!hfToken) {
    console.error("Hugging Face API token missing!");
    throw new Error("Hugging Face API token not found. Please configure VITE_HUGGINGFACE_API_TOKEN in the Secrets panel.");
  }

  // Stable Diffusion 1.5 is extremely reliable on the Inference API
  const model = "runwayml/stable-diffusion-v1-5"; 
  const url = `https://api-inference.huggingface.co/models/${model}`;

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  const callHF = async (retryCount = 0): Promise<Response> => {
    let body: any;
    let headers: Record<string, string> = {
      Authorization: `Bearer ${hfToken}`,
    };

    const finalPrompt = `Professional travel photography, high resolution, cinematic lighting, realistic: ${prompt}`;

    if (baseImage && retryCount === 0) {
      // For img2img, many SD models on HF Inference API accept the image as a blob
      // and the prompt as a header or inside a JSON inputs field.
      // We'll try the standard image blob approach first.
      try {
        const base64Data = baseImage.split(',')[1];
        const res = await fetch(`data:image/png;base64,${base64Data}`);
        const blob = await res.blob();
        
        headers["x-prompt"] = finalPrompt; // Some models use this
        // But for standard text-to-image fallback or simple Inference API:
        body = blob; 
        // Note: Standard HF Inference API for SD text2img uses JSON. 
        // For actual img2img via Inference API, we often need a different endpoint or specialized format.
        // To ensure success, we'll favor text2img with a strong prompt if img2img fails or is inconsistent.
      } catch (e) {
        body = JSON.stringify({ inputs: finalPrompt });
        headers["Content-Type"] = "application/json";
      }
    } else {
      body = JSON.stringify({ 
        inputs: finalPrompt,
        parameters: { guidance_scale: 7.5, num_inference_steps: 30 }
      });
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      headers,
      method: "POST",
      body: body,
    });

    if (response.status === 503 && retryCount < 8) {
      const errorData = await response.json().catch(() => ({}));
      const waitTime = Math.max((errorData.estimated_time || 5) * 1000, 3000);
      console.log(`HF Model loading... retry ${retryCount + 1}. Waiting ${waitTime}ms`);
      await sleep(waitTime);
      return callHF(retryCount + 1);
    }

    return response;
  };

  try {
    const response = await callHF();

    if (!response.ok) {
      const errorText = await response.text();
      console.error("HF API Error Response:", errorText);
      throw new Error(`HF Error: ${response.status} - ${errorText}`);
    }

    const resultBlob = await response.blob();
    if (!resultBlob.type.startsWith('image/')) {
      throw new Error(`Invalid response type: ${resultBlob.type}`);
    }

    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(resultBlob);
    });
  } catch (error) {
    console.error("Critical error in generateHeroImage:", error);
    // Return a colorful placeholder so the UI doesn't break
    return `https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&q=80&w=1200&h=600`;
  }
}
