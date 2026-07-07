import { supabase } from "./supabase";

/**
 * Owner-only 治理後台 RPC 薄封裝（Phase 2，migration 276）。
 * 全部 SECURITY DEFINER + owner 守門；非 owner 呼叫回 403 / 42501。
 * 前端入口已 owner-only（AdminPanel 僅 isOwner 渲染），這裡不再重複守門。
 */

export type Tier = "free" | "member" | "insider" | "owner";
export const TIERS: Tier[] = ["free", "member", "insider", "owner"];

export interface AdminMember {
  id: string;
  email: string | null;
  display_name: string | null;
  tier: string;
  created_at: string;
  last_sign_in_at: string | null;
}

export interface AuditRow {
  id: number;
  occurred_at: string;
  user_id: string | null;
  email: string | null;
  rpc_name: string;
  user_tier: string | null;
  required_tier: string | null;
  granted: boolean;
}

export type LockType = "ui" | "full";

export interface GatedLayerRow {
  layer_key: string;
  category: string;
  label: string;
  rpc_name: string | null;
  required_tier: string;
  enabled: boolean;
  lock_type: LockType;
  sort_order: number | null;
  source_date: string | null;
  next_refresh: string | null;
  is_stale: boolean | null;
  refresh_cadence: string | null;
  row_count: number | null;
}

function unwrap<T>(data: unknown, error: { message: string } | null, ctx: string): T {
  if (error) throw new Error(`${ctx}: ${error.message}`);
  return (data ?? []) as T;
}

export async function listMembers(): Promise<AdminMember[]> {
  const { data, error } = await supabase.rpc("admin_list_members");
  return unwrap<AdminMember[]>(data, error, "admin_list_members");
}

export async function setMemberTier(target: string, tier: Tier): Promise<void> {
  const { error } = await supabase.rpc("admin_set_member_tier", { p_target: target, p_tier: tier });
  if (error) throw new Error(`admin_set_member_tier: ${error.message}`);
}

export async function listAudit(limit = 200, onlyDenied = false): Promise<AuditRow[]> {
  const { data, error } = await supabase.rpc("admin_list_audit", { p_limit: limit, p_only_denied: onlyDenied });
  return unwrap<AuditRow[]>(data, error, "admin_list_audit");
}

export async function listGatedLayers(): Promise<GatedLayerRow[]> {
  const { data, error } = await supabase.rpc("admin_list_gated_layers");
  return unwrap<GatedLayerRow[]>(data, error, "admin_list_gated_layers");
}

export async function setLayerGate(
  layerKey: string,
  requiredTier: Tier,
  enabled: boolean,
  lockType?: LockType,
): Promise<void> {
  // p_lock_type 省略（undefined）時後端 COALESCE 不改該欄（宣告性欄位，不動 DB grant）。
  const { error } = await supabase.rpc("admin_set_layer_gate", {
    p_layer_key: layerKey,
    p_required_tier: requiredTier,
    p_enabled: enabled,
    ...(lockType ? { p_lock_type: lockType } : {}),
  });
  if (error) throw new Error(`admin_set_layer_gate: ${error.message}`);
}
