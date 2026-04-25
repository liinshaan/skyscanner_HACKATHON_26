/// <reference types="vite/client" />
/**
 * Skyscanner API Service - Live Search API V3
 */

const API_KEY = import.meta.env.VITE_SKYSCANNER_API_KEY;
const BASE_URL = 'https://partners.api.skyscanner.net/apiservices/v3/flights/live/search/create';

export async function getFlightPrice(destinationIata: string, originIata: string = 'MAD', travelDateDate: Date = new Date()): Promise<number | null> {
  if (!API_KEY) {
    console.warn("Skyscanner API key not found. Using simulated real price.");
    return null;
  }

  try {
    const body = {
      query: {
        market: 'ES',
        locale: 'es-ES',
        currency: 'EUR',
        queryLegs: [
          {
            originPlaceId: { iata: originIata },
            destinationPlaceId: { iata: destinationIata },
            date: {
              year: travelDateDate.getFullYear(),
              month: travelDateDate.getMonth() + 1,
              day: travelDateDate.getDate()
            }
          }
        ],
        adults: 1,
        cabinClass: 'CABIN_CLASS_ECONOMY'
      }
    };

    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY
      },
      body: JSON.stringify(body)
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Skyscanner API error:", response.status, errorText);
      return null;
    }

    const data = await response.json();
    
    // En la Live API, los resultados pueden venir en 'content.results.itineraries'
    if (data.content && data.content.results && data.content.results.itineraries) {
      const itineraries = data.content.results.itineraries;
      const itinKeys = Object.keys(itineraries);
      
      if (itinKeys.length > 0) {
        // Buscamos el precio más bajo entre las ofertas del primer itinerario
        const firstItin = itineraries[itinKeys[0]];
        if (firstItin.pricingOptions && firstItin.pricingOptions.length > 0) {
          const price = firstItin.pricingOptions[0].price.amount;
          // El precio viene en unidades (p.ej. 50000 para 500.00 dependiendo del formato, pero Skyscanner suele enviar entero de céntimos o similar)
          // Ajustamos según la escala devuelta (asumimos euros enteros si amount > 1000 usualmente)
          return Math.round(parseFloat(price) / (parseFloat(price) > 5000 ? 1000 : 1));
        }
      }
    }

    return null;
  } catch (error) {
    console.error("Error fetching Skyscanner price:", error);
    return null;
  }
}
