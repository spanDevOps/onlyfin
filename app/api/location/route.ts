import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * POST /api/location - Get location details from client-provided coordinates
 * Client sends coordinates from browser Geolocation API
 * We reverse geocode to get city/country and add currency/language info
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { latitude, longitude, accuracy } = body;
    
    if (!latitude || !longitude) {
      return NextResponse.json({
        success: false,
        error: 'Latitude and longitude required'
      }, { status: 400 });
    }
    
    logger.info('LOCATION_REQUEST', 'Reverse geocoding client coordinates', {
      latitude,
      longitude,
      accuracy
    });
    
    // Use Nominatim (OpenStreetMap) for reverse geocoding - free, no API key
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=10&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'OnlyFin-App/1.0'
        }
      }
    );

    if (!response.ok) {
      throw new Error(`Nominatim API error: ${response.status}`);
    }

    const data = await response.json();
    
    const city = data.address?.city || data.address?.town || data.address?.village || 'Unknown';
    const country = data.address?.country || 'Unknown';
    const countryCode = data.address?.country_code?.toUpperCase() || 'XX';
    const state = data.address?.state || 'Unknown';
    
    logger.info('LOCATION_SUCCESS', 'Location retrieved from browser geolocation', {
      city,
      country,
      countryCode,
      state
    });
    
    return NextResponse.json({
      success: true,
      location: {
        country: country,
        countryCode: countryCode,
        city: city,
        region: state,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        currency: getCurrencyByCountry(countryCode),
        language: getLanguageByCountry(countryCode),
        latitude: latitude,
        longitude: longitude,
        accuracy: accuracy,
        source: 'browser-geolocation'
      }
    });
  } catch (error: any) {
    logger.error('LOCATION_ERROR', 'Failed to get location', {
      error: error.message,
      stack: error.stack
    });
    
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve location information'
    }, { status: 500 });
  }
}

// Helper function to get currency by country code
function getCurrencyByCountry(countryCode: string): string {
  const currencyMap: Record<string, string> = {
    'IN': 'INR',
    'US': 'USD',
    'GB': 'GBP',
    'CA': 'CAD',
    'AU': 'AUD',
    'DE': 'EUR',
    'FR': 'EUR',
    'IT': 'EUR',
    'ES': 'EUR',
    'JP': 'JPY',
    'CN': 'CNY',
    'BR': 'BRL',
    'MX': 'MXN',
    'RU': 'RUB',
    'KR': 'KRW',
    'SG': 'SGD',
    'HK': 'HKD',
    'CH': 'CHF',
    'SE': 'SEK',
    'NO': 'NOK',
    'DK': 'DKK'
  };
  return currencyMap[countryCode] || 'USD';
}

// Helper function to get language by country code
function getLanguageByCountry(countryCode: string): string {
  const languageMap: Record<string, string> = {
    'IN': 'en', // English is widely used for business in India
    'US': 'en',
    'GB': 'en',
    'CA': 'en',
    'AU': 'en',
    'DE': 'de',
    'FR': 'fr',
    'IT': 'it',
    'ES': 'es',
    'JP': 'ja',
    'CN': 'zh',
    'BR': 'pt',
    'MX': 'es',
    'RU': 'ru',
    'KR': 'ko',
    'SG': 'en',
    'HK': 'en',
    'CH': 'de',
    'SE': 'sv',
    'NO': 'no',
    'DK': 'da'
  };
  return languageMap[countryCode] || 'en';
}

// Helper function to get full country name from country code
function getCountryName(countryCode: string): string {
  const countryMap: Record<string, string> = {
    'IN': 'India',
    'US': 'United States',
    'GB': 'United Kingdom',
    'CA': 'Canada',
    'AU': 'Australia',
    'DE': 'Germany',
    'FR': 'France',
    'IT': 'Italy',
    'ES': 'Spain',
    'JP': 'Japan',
    'CN': 'China',
    'BR': 'Brazil',
    'MX': 'Mexico',
    'RU': 'Russia',
    'KR': 'South Korea',
    'SG': 'Singapore',
    'HK': 'Hong Kong',
    'CH': 'Switzerland',
    'SE': 'Sweden',
    'NO': 'Norway',
    'DK': 'Denmark'
  };
  return countryMap[countryCode] || countryCode;
}
