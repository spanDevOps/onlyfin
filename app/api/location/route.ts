import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * GET /api/location - Get user's approximate location based on IP
 * This is called by the LLM when it needs location context
 * Updated to use Vercel's built-in geolocation headers for better accuracy
 */
export async function GET(req: Request) {
  try {
    logger.info('LOCATION_REQUEST', 'LLM requesting user location');
    
    // First try Vercel's built-in geolocation headers (most accurate)
    const vercelCountry = req.headers.get('x-vercel-ip-country');
    const vercelCity = req.headers.get('x-vercel-ip-city');
    const vercelRegion = req.headers.get('x-vercel-ip-region');
    const vercelTimezone = req.headers.get('x-vercel-ip-timezone');
    const vercelLatitude = req.headers.get('x-vercel-ip-latitude');
    const vercelLongitude = req.headers.get('x-vercel-ip-longitude');
    
    // If Vercel headers are available, use them (no external API needed)
    if (vercelCountry && vercelCity) {
      logger.info('LOCATION_VERCEL', 'Using Vercel geolocation headers', {
        country: vercelCountry,
        city: vercelCity,
        timezone: vercelTimezone
      });
      
      return NextResponse.json({
        success: true,
        location: {
          country: vercelCountry,
          countryCode: vercelCountry, // Vercel provides country code
          city: vercelCity,
          region: vercelRegion || 'Unknown',
          timezone: vercelTimezone || 'UTC',
          currency: getCurrencyByCountry(vercelCountry),
          language: getLanguageByCountry(vercelCountry),
          latitude: vercelLatitude ? parseFloat(vercelLatitude) : undefined,
          longitude: vercelLongitude ? parseFloat(vercelLongitude) : undefined,
          source: 'vercel-headers'
        }
      });
    }
    
    // Fallback to IP extraction with improved header priority
    const vercelForwardedFor = req.headers.get('x-vercel-forwarded-for');
    const vercelProxiedFor = req.headers.get('x-vercel-proxied-for');
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    
    // Priority: Vercel-specific headers > generic forwarded > real-ip
    let ip = 'unknown';
    if (vercelForwardedFor) {
      ip = vercelForwardedFor.split(',')[0].trim();
    } else if (vercelProxiedFor) {
      ip = vercelProxiedFor.split(',')[0].trim();
    } else if (forwarded) {
      ip = forwarded.split(',')[0].trim();
    } else if (realIp) {
      ip = realIp;
    }
    
    logger.debug('LOCATION_IP', `Detected IP: ${ip}`);
    
    // For localhost/development, return a default location
    if (ip === 'unknown' || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      logger.info('LOCATION_LOCALHOST', 'Localhost detected, returning default location');
      return NextResponse.json({
        success: true,
        location: {
          country: 'Unknown',
          city: 'Unknown',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          currency: 'USD',
          language: 'en',
          source: 'localhost',
          note: 'Location detection not available in development mode'
        }
      });
    }
    
    // Use IPinfo.io for better accuracy (as recommended by Perplexity)
    // Note: Add IPINFO_API_TOKEN to .env.local for better accuracy
    const ipinfoToken = process.env.IPINFO_API_TOKEN;
    const ipinfoUrl = ipinfoToken 
      ? `https://ipinfo.io/${ip}/json?token=${ipinfoToken}`
      : `https://ipinfo.io/${ip}/json`;
    
    logger.debug('LOCATION_IPINFO', `Fetching from IPinfo.io (authenticated: ${!!ipinfoToken})`, { ip });
    
    const geoResponse = await fetch(ipinfoUrl, {
      headers: {
        'User-Agent': 'OnlyFin-Bot/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (!geoResponse.ok) {
      throw new Error(`IPinfo API error: ${geoResponse.status}`);
    }
    
    const geoData = await geoResponse.json();
    
    logger.info('LOCATION_SUCCESS', 'Location retrieved successfully', {
      country: geoData.country,
      city: geoData.city,
      region: geoData.region,
      timezone: geoData.timezone,
      ip: ip,
      source: ipinfoToken ? 'ipinfo-api-authenticated' : 'ipinfo-api-free'
    });
    
    return NextResponse.json({
      success: true,
      location: {
        country: getCountryName(geoData.country) || 'Unknown',
        countryCode: geoData.country || 'XX',
        city: geoData.city || 'Unknown',
        region: geoData.region || 'Unknown',
        timezone: geoData.timezone || 'UTC',
        currency: getCurrencyByCountry(geoData.country),
        language: getLanguageByCountry(geoData.country),
        latitude: geoData.loc ? parseFloat(geoData.loc.split(',')[0]) : undefined,
        longitude: geoData.loc ? parseFloat(geoData.loc.split(',')[1]) : undefined,
        source: ipinfoToken ? 'ipinfo-api-authenticated' : 'ipinfo-api-free',
        ip: ip // Include IP for debugging
      }
    });
  } catch (error: any) {
    logger.error('LOCATION_ERROR', 'Failed to get location', {
      error: error.message,
      stack: error.stack
    });
    
    // Return a fallback response instead of error
    return NextResponse.json({
      success: true,
      location: {
        country: 'Unknown',
        city: 'Unknown',
        timezone: 'UTC',
        currency: 'USD',
        language: 'en',
        source: 'fallback',
        note: 'Location detection temporarily unavailable'
      }
    });
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
