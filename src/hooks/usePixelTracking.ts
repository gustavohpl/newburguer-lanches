
import { projectId } from '../utils/supabase/info';

const SERVER_URL = `https://${projectId}.supabase.co/functions/v1/make-server-dfe23da2/meta`;

export function usePixelTracking() {
  
  // Track events both in browser (Pixel) and server (Supabase/CAPI)
  const trackEvent = async (eventType: string, data: any) => {
    try {
      // 1. Browser Tracking (Pixel)
      if (window.fbq) {
        window.fbq('track', eventType, data);
      }

      // 2. Server Tracking (Supabase -> Meta Conversions API)
      // We send this to our backend which handles the CAPI call or DB logging
      fetch(`${SERVER_URL}/conversions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event_name: eventType,
          event_time: Math.floor(Date.now() / 1000),
          custom_data: data,
          event_source_url: window.location.href
        })
      }).catch(err => console.error('Tracking Error:', err));
      
    } catch (error) {
      console.error('Pixel Error:', error);
    }
  };

  return { trackEvent };
}
