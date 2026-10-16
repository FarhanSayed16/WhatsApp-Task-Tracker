import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { apiError, apiSuccess, handleApiError } from "@/lib/errors";
import { supabase } from "@/lib/supabase";
import os from "os";

export async function GET(req: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin) return apiError("Unauthorized", "UNAUTHORIZED", 401);

    // Extract current port from request headers
    const hostHeader = req.headers.get("host") || "localhost:3000";
    const port = hostHeader.includes(":") ? hostHeader.split(":")[1] : "3000";

    // Detect network interfaces
    const nets = os.networkInterfaces();
    const interfaces: Array<{
      name: string;
      ip: string;
      url: string;
      isWifi: boolean;
    }> = [];

    let primaryWifiIp: string | null = null;
    let fallbackIp: string | null = null;

    for (const name of Object.keys(nets)) {
      const netList = nets[name];
      if (!netList) continue;

      for (const net of netList) {
        // Skip over non-IPv4 and internal (127.0.0.1) loopbacks
        if (net.family === "IPv4" && !net.internal) {
          const isWifi = /wi-?fi|wlan|wireless/i.test(name);
          const isVirtual = /vEthernet|virtual|docker|wsl|loopback/i.test(name);
          const url = `http://${net.address}:${port}`;

          if (!isVirtual) {
            interfaces.push({
              name,
              ip: net.address,
              url,
              isWifi,
            });

            if (isWifi && !primaryWifiIp) {
              primaryWifiIp = net.address;
            } else if (!fallbackIp) {
              fallbackIp = net.address;
            }
          }
        }
      }
    }

    const detectedIp = primaryWifiIp || fallbackIp || (interfaces.length > 0 ? interfaces[0].ip : null);
    const detectedUrl = detectedIp ? `http://${detectedIp}:${port}` : null;

    // Fetch saved base URL from org settings
    const { data: orgData } = await supabase
      .from("organizations")
      .select("settings")
      .eq("id", admin.orgId)
      .single();

    const orgSettings = (orgData?.settings as Record<string, any>) || {};
    const savedBaseUrl = orgSettings.public_base_url || null;
    const envUrl = process.env.APP_URL || process.env.NEXT_PUBLIC_APP_URL || null;

    return apiSuccess({
      detectedIp,
      detectedUrl,
      port,
      interfaces,
      savedBaseUrl,
      envUrl,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
