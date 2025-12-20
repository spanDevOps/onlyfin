import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * GET /api/location - Get user's approximate location
 * Uses Vercel's geolocation headers (most accurate) with IPinfo.io as fallback
 * This is called by the LLM when it needs location context
 */
export async function GET(req: Request) {
  try {
    logger.info('LOCATION_REQUEST', 'LLM requesting user location');
    
    // PRIORITY 1: Use Vercel's geolocation headers (most accurate - bypasses edge routing)
    const vercelCountry = req.headers.get('x-vercel-ip-country');
    const vercelCity = req.headers.get('x-vercel-ip-city');
    const vercelRegion = req.headers.get('x-vercel-ip-region');
    const vercelTimezone = req.headers.get('x-vercel-ip-timezone');
    const vercelLatitude = req.headers.get('x-vercel-ip-latitude');
    const vercelLongitude = req.headers.get('x-vercel-ip-longitude');
    
    logger.debug('LOCATION_VERCEL_HEADERS', 'Vercel geolocation headers', {
      country: vercelCountry,
      city: vercelCity,
      region: vercelRegion,
      timezone: vercelTimezone
    });
    
    // If Vercel headers are available, use them (they contain the real user location)
    if (vercelCountry && vercelCity) {
      logger.info('LOCATION_SUCCESS_VERCEL', 'Using Vercel geolocation headers', {
        country: vercelCountry,
        city: vercelCity,
        timezone: vercelTimezone
      });
      
      return NextResponse.json({
        success: true,
        location: {
          country: getCountryName(vercelCountry) || vercelCountry,
          countryCode: vercelCountry,
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
    
    // PRIORITY 2: Fallback to IPinfo.io if Vercel headers not available
    logger.warn('LOCATION_NO_VERCEL_HEADERS', 'Vercel headers not available, falling back to IPinfo.io');
    
    const ipinfoToken = process.env.IPINFO_API_TOKEN;
    if (!ipinfoToken) {
      logger.error('LOCATION_ERROR', 'IPINFO_API_TOKEN not configured');
      return NextResponse.json({
        success: false,
        error: 'Location service not configured. Please add IPINFO_API_TOKEN to environment variables.'
      }, { status: 500 });
    }
    
    // Extract IP from headers
    const forwarded = req.headers.get('x-forwarded-for');
    const realIp = req.headers.get('x-real-ip');
    
    let ip = 'unknown';
    if (forwarded) {
      ip = forwarded.split(',')[0].trim();
    } else if (realIp) {
      ip = realIp;
    }
    
    logger.info('LOCATION_IP_EXTRACTED', `Extracted IP: ${ip}`, { 
      source: forwarded ? 'x-forwarded-for' : realIp ? 'x-real-ip' : 'none'
    });
    
    // For localhost/development, return a note
    if (ip === 'unknown' || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.')) {
      logger.info('LOCATION_LOCALHOST', 'Localhost detected');
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
    
    // Use IPinfo.io with API token
    const ipinfoUrl = `https://ipinfo.io/${ip}/json?token=${ipinfoToken}`;
    
    logger.debug('LOCATION_IPINFO', 'Fetching from IPinfo.io', { ip });
    
    const geoResponse = await fetch(ipinfoUrl, {
      headers: {
        'User-Agent': 'OnlyFin-Bot/1.0',
        'Accept': 'application/json'
      }
    });
    
    if (!geoResponse.ok) {
      const errorText = await geoResponse.text();
      logger.error('LOCATION_IPINFO_ERROR', `IPinfo API error: ${geoResponse.status}`, { error: errorText });
      throw new Error(`IPinfo API error: ${geoResponse.status} - ${errorText}`);
    }
    
    const geoData = await geoResponse.json();
    
    logger.info('LOCATION_SUCCESS_IPINFO', 'Location retrieved from IPinfo.io', {
      country: geoData.country,
      city: geoData.city,
      region: geoData.region,
      timezone: geoData.timezone,
      ip: ip
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
        source: 'ipinfo-api',
        ip: ip
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
