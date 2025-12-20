import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * GET /api/location - Get user's approximate location based on IP using IPinfo.io
 * This is called by the LLM when it needs location context
 * Requires IPINFO_API_TOKEN environment variable
 */
export async function GET(req: Request) {
  try {
    logger.info('LOCATION_REQUEST', 'LLM requesting user location');
    
    // Check for API token
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
    
    logger.debug('LOCATION_IP', `Detected IP: ${ip}`);
    
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
    
    logger.info('LOCATION_SUCCESS', 'Location retrieved successfully', {
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
        ip: ip // Include IP for debugging
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
