import { NextResponse } from 'next/server';
import { logger } from '@/lib/logger';

export const runtime = 'nodejs';

/**
 * GET /api/location - Get user's approximate location based on IP
 * This is called by the LLM when it needs location context
 */
export async function GET(req: Request) {
  try {
    logger.info('LOCATION_REQUEST', 'LLM requesting user location');
    
    // Get IP from headers (Vercel provides this)
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : req.headers.get('x-real-ip') || 'unknown';
    
    logger.debug('LOCATION_IP', `Detected IP: ${ip}`);
    
    // For localhost/development, return a default location
    if (ip === 'unknown' || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.')) {
      logger.info('LOCATION_LOCALHOST', 'Localhost detected, returning default location');
      return NextResponse.json({
        success: true,
        location: {
          country: 'Unknown',
          city: 'Unknown',
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          currency: 'USD',
          language: 'en',
          note: 'Location detection not available in development mode'
        }
      });
    }
    
    // Use ipapi.co for geolocation (free tier: 1000 requests/day)
    const geoResponse = await fetch(`https://ipapi.co/${ip}/json/`, {
      headers: {
        'User-Agent': 'OnlyFin-Bot/1.0'
      }
    });
    
    if (!geoResponse.ok) {
      throw new Error(`Geolocation API error: ${geoResponse.status}`);
    }
    
    const geoData = await geoResponse.json();
    
    logger.info('LOCATION_SUCCESS', 'Location retrieved successfully', {
      country: geoData.country_name,
      city: geoData.city,
      timezone: geoData.timezone
    });
    
    return NextResponse.json({
      success: true,
      location: {
        country: geoData.country_name || 'Unknown',
        countryCode: geoData.country_code || 'XX',
        city: geoData.city || 'Unknown',
        region: geoData.region || 'Unknown',
        timezone: geoData.timezone || 'UTC',
        currency: geoData.currency || 'USD',
        language: geoData.languages?.split(',')[0] || 'en',
        latitude: geoData.latitude,
        longitude: geoData.longitude
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
        note: 'Location detection temporarily unavailable'
      }
    });
  }
}
