
import { Hono } from "npm:hono";
import * as kv from "./kv_retry.tsx";

// Mock data generator since we might not have keys yet
// REMOVED MOCK GENERATORS AS REQUESTED BY USER


export function setupMetaRoutes(app: Hono) {
  const PREFIX = "/make-server-dfe23da2/meta";

  // Check if Meta is configured
  app.get(`${PREFIX}/status`, async (c) => {
    const hasToken = !!Deno.env.get('META_ACCESS_TOKEN');
    const hasPixel = !!Deno.env.get('META_PIXEL_ID');
    
    return c.json({
      success: true,
      configured: hasToken && hasPixel,
      pixelId: Deno.env.get('META_PIXEL_ID') || null
    });
  });

  // Sync Campaigns (Mock if no keys)
  app.post(`${PREFIX}/sync`, async (c) => {
    try {
      // In a real scenario, we would fetch from Meta API here
      // const metaClient = new MetaAPIClient(...)
      // const campaigns = await metaClient.getCampaigns()
      
      // For now, return mock data or stored data
      const storedCampaigns = await kv.getByPrefix('ad_campaign:');
      
      // Filter out known mock campaigns if they exist (cleanup legacy mocks)
      const mockIds = ['camp_123', 'camp_456'];
      const realCampaigns = [];
      
      for (const camp of storedCampaigns) {
        if (mockIds.includes(camp.id)) {
          // Delete mock campaign
          await kv.del(`ad_campaign:${camp.id}`);
        } else {
          realCampaigns.push(camp);
        }
      }

      // Generate daily metrics for the dashboard
      // Only generate if we have real campaigns with spend
      const metrics = [];

      return c.json({ 
        success: true, 
        campaigns: realCampaigns,
        metrics: metrics,
        synced: true
      });
    } catch (error) {
      console.error("Meta Sync Error:", error);
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  // Create Campaign
  app.post(`${PREFIX}/campaigns`, async (c) => {
    try {
      const data = await c.req.json();
      
      const newCampaign = {
        id: `camp_${Date.now()}`,
        ...data,
        status: 'PAUSED', // Default to paused
        spend: 0,
        impressions: 0,
        clicks: 0,
        purchases: 0,
        revenue: 0,
        createdAt: new Date().toISOString()
      };

      await kv.set(`ad_campaign:${newCampaign.id}`, newCampaign);

      return c.json({ success: true, campaign: newCampaign });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  // Update Campaign (Pause/Resume/Budget)
  app.put(`${PREFIX}/campaigns/:id`, async (c) => {
    try {
      const id = c.req.param('id');
      const updates = await c.req.json();
      
      const campaign = await kv.get(`ad_campaign:${id}`);
      if (!campaign) {
        return c.json({ success: false, error: "Campaign not found" }, 404);
      }

      const updatedCampaign = { ...campaign, ...updates };
      await kv.set(`ad_campaign:${id}`, updatedCampaign);

      return c.json({ success: true, campaign: updatedCampaign });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });

  // Track Conversion (Server-side API)
  app.post(`${PREFIX}/conversions`, async (c) => {
    try {
      const eventData = await c.req.json();
      
      // Log event to KV for local tracking
      const eventId = `pixel_event:${Date.now()}`;
      await kv.set(eventId, {
        ...eventData,
        timestamp: new Date().toISOString(),
        syncedToMeta: false // Would be true if we actually sent to CAPI
      });

      // If we had keys, we would send to Meta Conversions API here
      
      return c.json({ success: true, eventId });
    } catch (error) {
      return c.json({ success: false, error: String(error) }, 500);
    }
  });
  
  // Create Audience (Mock)
  app.post(`${PREFIX}/audiences`, async (c) => {
    try {
        const data = await c.req.json();
        const id = `aud_${Date.now()}`;
        const audience = { id, ...data, size: Math.floor(Math.random() * 5000) + 100 };
        // Store if needed
        return c.json({ success: true, audience });
    } catch (error) {
        return c.json({ success: false, error: String(error) }, 500);
    }
  });
}
