
import { useEffect } from 'react';

declare global {
  interface Window {
    fbq: any;
    _fbq: any;
  }
}

/**
 * MetaPixel Component
 * 
 * Handles Facebook Pixel initialization.
 * Includes a robust simulation mode to prevent app crashes when:
 * 1. Running in development/preview environments
 * 2. Using invalid/mock Pixel IDs
 * 3. Network blockers are active
 */
export function MetaPixel() {
  useEffect(() => {
    // Prevent SSR execution
    if (typeof window === 'undefined') return;

    try {
      // Get Pixel ID safely
      let pixelId = '123456789012345'; // Default mock ID
      let isProduction = false;
      
      try {
        // @ts-ignore
        if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_META_PIXEL_ID) {
          // @ts-ignore
          pixelId = import.meta.env.VITE_META_PIXEL_ID;
          isProduction = true;
        }
      } catch (e) {
        // Ignore env errors
      }

      // Check if we should actually load the script
      // In simulation/dev mode with mock ID, we DON'T load the external script to avoid errors/hanging
      const shouldLoadScript = isProduction && pixelId !== '123456789012345';

      // Initialize the fbq function if it doesn't exist
      if (!window.fbq) {
        let n: any = function() {
          n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments);
        };
        
        if (!window._fbq) window._fbq = n;
        
        n.push = n;
        n.loaded = true;
        n.version = '2.0';
        n.queue = [];
        window.fbq = n;
      }

      // If we already initialized or loaded, just track PageView
      if (window.fbq.loaded && window.fbq.version) {
         window.fbq('init', pixelId);
         window.fbq('track', 'PageView');
         
         if (!shouldLoadScript) {
           console.log('🔌 [Meta Pixel] Simulation Mode Active (No script loaded)');
           console.log(`📊 [Meta Pixel] Tracking: PageView (ID: ${pixelId})`);
         }
         return;
      }

      // Only inject the script tag if we are in a production-like environment with a real ID
      if (shouldLoadScript) {
        const t = document.createElement('script');
        t.async = true;
        t.src = 'https://connect.facebook.net/en_US/fbevents.js';
        
        const s = document.getElementsByTagName('script')[0];
        if (s && s.parentNode) {
          s.parentNode.insertBefore(t, s);
          console.log('✅ [Meta Pixel] Loading external script...');
        }
      } else {
        console.log('🛡️ [Meta Pixel] Running in SAFE MODE - External script blocked to prevent crashes');
        
        // Mock the execution of track calls in the console for debugging
        const originalPush = window.fbq.push;
        window.fbq.push = function(args: any) {
          if (args && args[0] === 'track') {
             console.log(`📊 [Meta Pixel Simulated] ${args[1]}`, args[2] || '');
          }
          if (Array.isArray(window.fbq.queue)) {
             window.fbq.queue.push(args);
          }
        };
      }

      // Initialize and Track
      window.fbq('init', pixelId);
      window.fbq('track', 'PageView');
      
    } catch (error) {
      console.error('❌ [Meta Pixel] Initialization Error:', error);
    }
  }, []);
  
  return null;
}
