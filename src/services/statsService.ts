/**
 * Statistics and Dashboard Aggregation Service (SQL dynamic aggregations)
 */

import { query, mapRow } from '../backend/database.js';
import { SupportedLanguage } from '../types.js';

export class StatsService {
  public async getAdminSummary(regionId?: string | null) {
    const filterSql = regionId ? 'WHERE region_id = $1' : '';
    const params = regionId ? [regionId] : [];

    const statsRes = await query(
      `SELECT
        COUNT(*) as total_members,
        COUNT(CASE WHEN membership_status = 'active' THEN 1 END) as active,
        COUNT(CASE WHEN membership_status = 'inactive' THEN 1 END) as inactive,
        COUNT(CASE WHEN membership_status = 'pending' THEN 1 END) as pending,
        COUNT(CASE WHEN registration_status = 'pending' THEN 1 END) as pending_registrations,
        COUNT(CASE WHEN gender = 'female' THEN 1 END) as female,
        COUNT(CASE WHEN gender = 'male' THEN 1 END) as male,
        COUNT(CASE WHEN occupation_type = 'government' THEN 1 END) as government_count,
        COUNT(CASE WHEN occupation_type = 'private' THEN 1 END) as private_count,
        COUNT(CASE WHEN occupation_type = 'other' THEN 1 END) as other_count,
        COUNT(CASE WHEN created_at >= date_trunc('month', NOW()) THEN 1 END) as new_this_month
      FROM members
      ${filterSql}`,
      params
    );

    const paymentsFilter = regionId ? 'WHERE region_id = $1 AND status = \'paid\' AND paid_at >= date_trunc(\'year\', NOW())' : 'WHERE status = \'paid\' AND paid_at >= date_trunc(\'year\', NOW())';
    const payRes = await query(
      `SELECT COALESCE(SUM(amount_etb), 0) as total_collected_this_year FROM payments ${paymentsFilter}`,
      params
    );

    const s = statsRes.rows[0];
    const p = payRes.rows[0];

    return {
      totalMembers: parseInt(s.total_members || '0', 10),
      active: parseInt(s.active || '0', 10),
      inactive: parseInt(s.inactive || '0', 10),
      pending: parseInt(s.pending || '0', 10),
      pendingRegistrations: parseInt(s.pending_registrations || '0', 10),
      female: parseInt(s.female || '0', 10),
      male: parseInt(s.male || '0', 10),
      governmentCount: parseInt(s.government_count || '0', 10),
      privateCount: parseInt(s.private_count || '0', 10),
      otherCount: parseInt(s.other_count || '0', 10),
      newThisMonth: parseInt(s.new_this_month || '0', 10),
      totalCollectedThisYear: parseFloat(p.total_collected_this_year || '0'),
    };
  }

  public async getMembersByDimension(
    dimension: 'gender' | 'sector' | 'field' | 'occupation' | 'region' | 'graduationLevel',
    lang: SupportedLanguage = 'en',
    regionId?: string | null
  ) {
    const whereParts: string[] = ["registration_status = 'approved'"];
    const params: any[] = [];
    if (regionId) {
      whereParts.push('m.region_id = $1');
      params.push(regionId);
    }
    const whereSql = `WHERE ${whereParts.join(' AND ')}`;

    let querySql = '';
    if (dimension === 'gender') {
      querySql = `
        SELECT m.gender as key, m.gender as label_json, COUNT(*) as count
        FROM members m ${whereSql}
        GROUP BY m.gender ORDER BY count DESC
      `;
    } else if (dimension === 'sector') {
      querySql = `
        SELECT s.code as key, s.label as label_json, COUNT(m.id) as count
        FROM lookup_sectors s
        LEFT JOIN members m ON m.sector_id = s.id ${whereParts.length > 0 ? `AND ${whereParts.join(' AND ')}` : ''}
        GROUP BY s.code, s.label ORDER BY count DESC
      `;
    } else if (dimension === 'field') {
      querySql = `
        SELECT f.code as key, f.label as label_json, COUNT(m.id) as count
        FROM lookup_fields_of_study f
        LEFT JOIN members m ON m.field_of_study_id = f.id ${whereParts.length > 0 ? `AND ${whereParts.join(' AND ')}` : ''}
        GROUP BY f.code, f.label ORDER BY count DESC
      `;
    } else if (dimension === 'occupation') {
      querySql = `
        SELECT o.code as key, o.label as label_json, COUNT(m.id) as count
        FROM lookup_occupation_types o
        LEFT JOIN members m ON m.occupation_type = o.code ${whereParts.length > 0 ? `AND ${whereParts.join(' AND ')}` : ''}
        GROUP BY o.code, o.label ORDER BY count DESC
      `;
    } else if (dimension === 'region') {
      querySql = `
        SELECT r.id as key, r.name as label_json, COUNT(m.id) as count
        FROM regions r
        LEFT JOIN members m ON m.region_id = r.id ${whereParts.length > 0 ? `AND ${whereParts.join(' AND ')}` : ''}
        GROUP BY r.id, r.name ORDER BY count DESC
      `;
    } else if (dimension === 'graduationLevel') {
      querySql = `
        SELECT g.code as key, g.label as label_json, COUNT(m.id) as count
        FROM lookup_graduation_levels g
        LEFT JOIN members m ON m.graduation_level_id = g.id ${whereParts.length > 0 ? `AND ${whereParts.join(' AND ')}` : ''}
        GROUP BY g.code, g.label ORDER BY count DESC
      `;
    }

    const res = await query(querySql, params);
    const totalCount = res.rows.reduce((sum: number, r: any) => sum + parseInt(r.count || '0', 10), 0) || 1;

    return res.rows.map((r: any) => {
      let label = r.key;
      if (typeof r.label_json === 'object' && r.label_json !== null) {
        label = r.label_json[lang] || r.label_json.en || r.key;
      } else if (typeof r.label_json === 'string') {
        try {
          const parsed = JSON.parse(r.label_json);
          label = parsed[lang] || parsed.en || r.key;
        } catch {
          label = r.label_json;
        }
      }

      const count = parseInt(r.count || '0', 10);
      return {
        key: r.key,
        label,
        count,
        percent: Number(((count / totalCount) * 100).toFixed(1)),
      };
    });
  }

  public async getContributionsDashboard(params: {
    range?: '3m' | '6m' | '12m';
    group?: 'week' | 'month' | 'year';
    regionId?: string | null;
  }) {
    const months = params.range === '3m' ? 3 : params.range === '6m' ? 6 : 12;
    const conds = ["status = 'paid'", `paid_at >= NOW() - INTERVAL '${months} month'`];
    const queryParams: any[] = [];

    if (params.regionId) {
      conds.push('region_id = $1');
      queryParams.push(params.regionId);
    }

    const whereClause = `WHERE ${conds.join(' AND ')}`;

    // Time series
    const timeRes = await query(
      `SELECT
        TO_CHAR(paid_at, 'YYYY-MM') as bucket,
        COALESCE(SUM(amount_etb), 0) as total_etb,
        COUNT(*) as payments_count
      FROM payments
      ${whereClause}
      GROUP BY bucket
      ORDER BY bucket ASC`,
      queryParams
    );

    // Totals
    const totRes = await query(
      `SELECT
        COALESCE(SUM(amount_etb), 0) as total_collected,
        COUNT(DISTINCT member_id) as paid_members,
        COUNT(*) as total_payments
      FROM payments
      ${whereClause}`,
      queryParams
    );

    // Total active/pending members for unpaid calculation
    const memCond = params.regionId ? 'WHERE region_id = $1' : '';
    const memRes = await query(
      `SELECT COUNT(*) as eligible_members FROM members ${memCond}`,
      queryParams
    );
    const eligible = parseInt(memRes.rows[0]?.eligible_members || '0', 10);
    const paidMembers = parseInt(totRes.rows[0]?.paid_members || '0', 10);

    // Breakdown by payment method
    const methodRes = await query(
      `SELECT method, COUNT(*) as count, COALESCE(SUM(amount_etb),0) as total_etb
       FROM payments ${whereClause} GROUP BY method`,
      queryParams
    );

    // Breakdown by period
    const periodRes = await query(
      `SELECT period, COUNT(*) as count, COALESCE(SUM(amount_etb),0) as total_etb
       FROM payments ${whereClause} GROUP BY period`,
      queryParams
    );

    return {
      timeSeries: timeRes.rows.map((r: any) => ({
        bucket: r.bucket,
        totalEtb: parseFloat(r.total_etb),
        paymentsCount: parseInt(r.payments_count, 10),
      })),
      totalCollected: parseFloat(totRes.rows[0]?.total_collected || '0'),
      totalPayments: parseInt(totRes.rows[0]?.total_payments || '0', 10),
      paidMembers,
      unpaidMembers: Math.max(0, eligible - paidMembers),
      byMethod: methodRes.rows.map((r: any) => ({
        method: r.method,
        count: parseInt(r.count, 10),
        totalEtb: parseFloat(r.total_etb),
      })),
      byPeriod: periodRes.rows.map((r: any) => ({
        period: r.period,
        count: parseInt(r.count, 10),
        totalEtb: parseFloat(r.total_etb),
      })),
    };
  }

  public async getPublicStats() {
    const memRes = await query(`
      SELECT 
        COUNT(CASE WHEN registration_status = 'approved' THEN 1 END) as approved_total,
        COUNT(CASE WHEN membership_status = 'active' THEN 1 END) as active_total
      FROM members
    `);

    const regRes = await query('SELECT COUNT(*) as count FROM regions WHERE is_active = true');
    const progRes = await query('SELECT COUNT(*) as count FROM programs WHERE is_active = true');
    const actRes = await query('SELECT COUNT(*) as count FROM activities WHERE is_public = true');

    return {
      approvedTotal: parseInt(memRes.rows[0].approved_total || '0', 10),
      activeTotal: parseInt(memRes.rows[0].active_total || '0', 10),
      regionsCount: parseInt(regRes.rows[0].count || '0', 10),
      programsCount: parseInt(progRes.rows[0].count || '0', 10),
      activitiesCount: parseInt(actRes.rows[0].count || '0', 10),
    };
  }
}

export const statsService = new StatsService();
