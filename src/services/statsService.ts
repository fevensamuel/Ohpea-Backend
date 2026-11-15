/**
 * Dashboard aggregation. Returns exactly the shapes declared in
 * Ophea-Admin/src/types/api.ts (DashboardSummary, DashboardDimensionItem, ContributionSnapshot).
 * Aggregation is done in JS over small projections so it behaves the same on PostgreSQL and pg-mem.
 */

import { query, mapRow } from '../backend/database.js';
import { pick, ymd, parseJson, type Lang } from '../backend/adminDto.js';

type Dimension = 'gender' | 'sector' | 'field' | 'occupation' | 'region' | 'graduationLevel';

const pad = (n: number) => String(n).padStart(2, '0');
const monthKey = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;

function isoWeekKey(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((t.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
  return `${t.getUTCFullYear()}-W${pad(week)}`;
}

export class StatsService {
  public async getAdminSummary(regionId?: string | null) {
    const mem = await query(
      `SELECT id, membership_status, registration_status, gender, occupation_type, created_at
       FROM members ${regionId ? 'WHERE region_id = $1' : ''}`,
      regionId ? [regionId] : []
    );
    const members = mem.rows.map(mapRow);
    const now = new Date();
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let active = 0, inactive = 0, pending = 0, pendingReg = 0, female = 0, male = 0, gov = 0, priv = 0, other = 0, newThisMonth = 0;
    for (const m of members) {
      if (m.membershipStatus === 'active') active++;
      else if (m.membershipStatus === 'inactive') inactive++;
      else pending++;
      if (m.registrationStatus === 'pending') pendingReg++;
      if (m.gender === 'female') female++;
      else if (m.gender === 'male') male++;
      if (m.occupationType === 'government') gov++;
      else if (m.occupationType === 'private') priv++;
      else other++;
      if (m.createdAt && new Date(m.createdAt) >= firstOfMonth) newThisMonth++;
    }

    const pay = await query(
      `SELECT member_id, amount_etb, paid_at, period_end FROM payments
       WHERE status = 'paid' ${regionId ? 'AND member_id IN (SELECT id FROM members WHERE region_id = $1)' : ''}`,
      regionId ? [regionId] : []
    );
    let year = 0, month = 0;
    const paidCurrent = new Set<string>();
    const firstStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;
    for (const p of pay.rows) {
      const paidAt = new Date(p.paid_at);
      const amt = Number(p.amount_etb) || 0;
      if (paidAt.getFullYear() === now.getFullYear()) year += amt;
      if (paidAt >= firstOfMonth) month += amt;
      if ((ymd(p.period_end) || '') >= firstStr) paidCurrent.add(p.member_id);
    }
    const eligible = members.filter((m: any) => m.registrationStatus === 'approved' && m.membershipStatus === 'active');
    const unpaid = eligible.filter((m: any) => !paidCurrent.has(m.id)).length;

    return {
      totalMembers: members.length,
      activeMembers: active,
      pendingMembers: pending,
      inactiveMembers: inactive,
      femaleMembers: female,
      maleMembers: male,
      governmentSector: gov,
      privateSector: priv,
      totalCollectedThisYear: year,
      totalCollectedThisMonth: month,
      unpaidMembersCount: unpaid,
      // convenience aliases the admin shim also understands
      active,
      inactive,
      pending,
      pendingRegistrations: pendingReg,
      female,
      male,
      governmentCount: gov,
      privateCount: priv,
      otherCount: other,
      newThisMonth,
    };
  }

  public async getMembersByDimension(dimension: Dimension, lang: Lang = 'en', regionId?: string | null) {
    const cols: Record<Dimension, string> = {
      gender: 'gender',
      sector: 'sector_id',
      field: 'field_of_study_id',
      occupation: 'occupation_type',
      region: 'region_id',
      graduationLevel: 'graduation_level_id',
    };
    const col = cols[dimension];
    if (!col) return [];

    const params: any[] = [];
    let where = "WHERE registration_status = 'approved'";
    if (regionId) {
      where += ' AND region_id = $1';
      params.push(regionId);
    }
    const res = await query(`SELECT ${col} AS k FROM members ${where}`, params);
    const counts = new Map<string, number>();
    for (const r of res.rows) {
      const k = r.k == null ? '' : String(r.k);
      counts.set(k, (counts.get(k) || 0) + 1);
    }

    // label lookup
    const labels = new Map<string, string>();
    const lookupSql: Record<string, string> = {
      sector: 'SELECT id, label AS name FROM lookup_sectors',
      field: 'SELECT id, label AS name FROM lookup_fields_of_study',
      graduationLevel: 'SELECT id, label AS name FROM lookup_graduation_levels',
      region: 'SELECT id, name FROM regions',
    };
    if (lookupSql[dimension]) {
      const lr = await query(lookupSql[dimension]);
      for (const r of lr.rows) labels.set(r.id, pick(parseJson(r.name, {}), lang) || r.id);
    } else if (dimension === 'gender') {
      labels.set('male', 'Male');
      labels.set('female', 'Female');
    } else if (dimension === 'occupation') {
      labels.set('private', 'Private');
      labels.set('government', 'Government');
      labels.set('other', 'Other');
    }

    const total = Array.from(counts.values()).reduce((a, b) => a + b, 0);
    return Array.from(counts.entries())
      .filter(([k]) => k !== '')
      .map(([k, value]) => ({
        label: labels.get(k) || k,
        value,
        percentage: total ? Number(((value / total) * 100).toFixed(1)) : 0,
      }))
      .sort((a, b) => b.value - a.value);
  }

  public async getContributionsDashboard(params: { range?: '3m' | '6m' | '12m'; group?: 'week' | 'month' | 'year'; regionId?: string | null }) {
    const months = params.range === '3m' ? 3 : params.range === '6m' ? 6 : 12;
    const group = params.group || 'month';
    const regionId = params.regionId || undefined;
    const now = new Date();
    const since = new Date(now.getFullYear(), now.getMonth() - (months - 1), 1);

    const pay = await query(
      `SELECT p.member_id, p.amount_etb, p.method, p.paid_at, p.period_end, m.region_id
       FROM payments p LEFT JOIN members m ON p.member_id = m.id
       WHERE p.status = 'paid' ${regionId ? 'AND m.region_id = $1' : ''}`,
      regionId ? [regionId] : []
    );

    let totalYear = 0, totalMonth = 0;
    const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const timeline = new Map<string, number>();
    const methods = new Map<string, number>();
    const regionAmount = new Map<string, number>();
    const paidCurrent = new Set<string>();
    const firstStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-01`;

    // pre-fill month buckets so empty months show as 0
    if (group === 'month') {
      for (let i = 0; i < months; i++) timeline.set(monthKey(new Date(since.getFullYear(), since.getMonth() + i, 1)), 0);
    }

    for (const p of pay.rows) {
      const paidAt = new Date(p.paid_at);
      const amt = Number(p.amount_etb) || 0;
      if (paidAt.getFullYear() === now.getFullYear()) totalYear += amt;
      if (paidAt >= firstOfMonth) totalMonth += amt;
      if ((ymd(p.period_end) || '') >= firstStr) paidCurrent.add(p.member_id);
      if (paidAt >= since) {
        const key = group === 'year' ? String(paidAt.getFullYear()) : group === 'week' ? isoWeekKey(paidAt) : monthKey(paidAt);
        timeline.set(key, (timeline.get(key) || 0) + amt);
        methods.set(p.method, (methods.get(p.method) || 0) + amt);
        if (p.region_id) regionAmount.set(p.region_id, (regionAmount.get(p.region_id) || 0) + amt);
      }
    }

    const mem = await query(
      `SELECT id, region_id FROM members WHERE registration_status = 'approved' AND membership_status = 'active' ${regionId ? 'AND region_id = $1' : ''}`,
      regionId ? [regionId] : []
    );
    const unpaidByRegion = new Map<string, number>();
    let paidCount = 0, unpaidCount = 0;
    for (const m of mem.rows) {
      if (paidCurrent.has(m.id)) paidCount++;
      else {
        unpaidCount++;
        unpaidByRegion.set(m.region_id, (unpaidByRegion.get(m.region_id) || 0) + 1);
      }
    }

    const regs = await query('SELECT id, name FROM regions');
    const regionName = new Map<string, string>();
    for (const r of regs.rows) regionName.set(r.id, pick(parseJson(r.name, {}), 'en') || r.id);
    const regionIds = new Set<string>([...regionAmount.keys(), ...unpaidByRegion.keys()]);

    return {
      totalYear,
      totalMonth,
      paidCount,
      unpaidCount,
      timeline: Array.from(timeline.entries())
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([period, amount]) => ({ period, amount })),
      methodDistribution: Array.from(methods.entries()).map(([method, amount]) => ({ method, amount })),
      byRegion: Array.from(regionIds).map((id) => ({
        region: regionName.get(id) || id,
        amount: regionAmount.get(id) || 0,
        unpaid: unpaidByRegion.get(id) || 0,
      })),
    };
  }

  public async getPublicStats() {
    const memRes = await query("SELECT COUNT(*) AS total FROM members WHERE registration_status = 'approved'");
    return { totalMembers: parseInt(memRes.rows[0]?.total || '0', 10) };
  }
}

export const statsService = new StatsService();
