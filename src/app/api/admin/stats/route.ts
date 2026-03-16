/**
 * GET /api/admin/stats
 * Returns admin dashboard statistics.
 *
 * Security: requires admin role, rate limited.
 */
import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase";
import { requireAdmin, applyAuthCookies } from "@/lib/auth";
import { checkRateLimit } from "@/lib/rate-limit";

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  // Require admin auth
  const authResult = await requireAdmin(req);
  if ('error' in authResult) return authResult.error;
  const { user, cookieUpdates } = authResult;

  // Rate limiting
  const rl = checkRateLimit(`admin:${user.id}`, { maxRequests: 30 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: 'Rate limit exceeded. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil(rl.resetMs / 1000)) } }
    );
  }

  try {
    const supabase = createSupabaseAdminClient();

    // Total jobs count
    const { count: totalJobs } = await supabase
      .from("jobs")
      .select("*", { count: "exact", head: true });

    // Total revenue (sum of completed payments)
    const { data: revenueData } = await supabase
      .from("payments")
      .select("amount")
      .eq("status", "completed");

    const totalRevenue =
      revenueData?.reduce((sum, p) => sum + (p.amount || 0), 0) || 0;

    // Recent jobs (last 20)
    const { data: recentJobs } = await supabase
      .from("jobs")
      .select("id, status, style, background, created_at")
      .order("created_at", { ascending: false })
      .limit(20);

    const response = NextResponse.json({
      totalJobs: totalJobs || 0,
      totalRevenue,
      recentJobs: recentJobs || [],
    });
    applyAuthCookies(response, cookieUpdates);
    return response;
  } catch (error) {
    console.error("Admin stats error:", error);
    return NextResponse.json(
      { error: "Failed to load stats" },
      { status: 500 }
    );
  }
}
