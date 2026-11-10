/**
 * OHPEA Universal TypeScript API Client
 * Drop-in client library for connecting separate Public Websites and Admin Portals to the OHPEA REST API.
 */

export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  fields?: Record<string, string>;
  message?: string;
  meta?: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
  };
}

export class OhpeaApiClient {
  private baseUrl: string;
  private tokenKey = 'ohpea_jwt_token';

  constructor(baseUrl: string = 'http://localhost:3000/api') {
    this.baseUrl = baseUrl.replace(/\/+$/, '');
  }

  // Token management (supports browser localStorage and in-memory fallback)
  private memoryToken: string | null = null;

  public setToken(token: string) {
    this.memoryToken = token;
    try {
      if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
        (globalThis as any).localStorage.setItem(this.tokenKey, token);
      }
    } catch {
      // Ignore storage errors in restrictive environments
    }
  }

  public getToken(): string | null {
    try {
      if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
        return (globalThis as any).localStorage.getItem(this.tokenKey) || this.memoryToken;
      }
    } catch {
      // Ignore storage errors
    }
    return this.memoryToken;
  }

  public clearToken() {
    this.memoryToken = null;
    try {
      if (typeof globalThis !== 'undefined' && (globalThis as any).localStorage) {
        (globalThis as any).localStorage.removeItem(this.tokenKey);
      }
    } catch {
      // Ignore storage errors
    }
  }

  // Base HTTP Request Wrapper
  private async request<T = any>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;
    const headers: Record<string, string> = {
      ...(options.headers as Record<string, string>),
    };

    const token = this.getToken();
    if (token && !headers['Authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    if (!(options.body instanceof FormData) && !headers['Content-Type']) {
      headers['Content-Type'] = 'application/json';
    }

    try {
      const response = await fetch(url, { ...options, headers });
      const json = (await response.json()) as ApiResponse<T>;
      return json;
    } catch (err: any) {
      return {
        success: false,
        error: err.message || 'Network request failed',
      };
    }
  }

  /* =========================================================================
     1. PUBLIC WEBSITE ENDPOINTS
     ========================================================================= */

  public async getHealth() {
    return this.request('/health');
  }

  public async getSiteSettings() {
    return this.request('/public/site-settings');
  }

  public async getPublicStats() {
    return this.request('/public/stats');
  }

  public async getLookups(lang: string = 'en') {
    return this.request(`/public/lookups?lang=${lang}`);
  }

  public async getPrograms() {
    return this.request('/public/programs');
  }

  public async getProgramBySlug(slug: string) {
    return this.request(`/public/programs/${slug}`);
  }

  public async getObjectives(kind?: 'general' | 'official' | 'main' | 'specific') {
    return this.request(`/public/objectives${kind ? `?kind=${kind}` : ''}`);
  }

  public async getPartners() {
    return this.request('/public/partners');
  }

  public async getActivities(limit: number = 10) {
    return this.request(`/public/activities?limit=${limit}`);
  }

  public async getAnnouncements(params: {
    type?: string;
    when?: 'upcoming' | 'past';
    q?: string;
    page?: number;
    pageSize?: number;
  } = {}) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/public/announcements?${query}`);
  }

  public async getAnnouncementBySlug(slug: string) {
    return this.request(`/public/announcements/${slug}`);
  }

  /**
   * Submit registration with optional file attachments (idDocument, credentials)
   */
  public async registerMember(formData: FormData | Record<string, any>, otpToken?: string) {
    let body: any;
    const headers: Record<string, string> = {};

    if (otpToken) {
      headers['x-otp-token'] = otpToken;
    }

    if (formData instanceof FormData) {
      body = formData;
    } else {
      body = JSON.stringify(formData);
    }

    return this.request('/public/registrations', {
      method: 'POST',
      headers,
      body,
    });
  }

  public async requestOtp(email: string, phone?: string, lang: string = 'en') {
    return this.request('/public/registrations/otp/request', {
      method: 'POST',
      body: JSON.stringify({ email, phone, lang }),
    });
  }

  public async verifyOtp(email: string, code: string) {
    return this.request<{ otpToken: string }>('/public/registrations/otp/verify', {
      method: 'POST',
      body: JSON.stringify({ email, code }),
    });
  }

  public async submitContact(data: { name: string; email: string; phone?: string; subject: string; message: string }) {
    return this.request('/public/contact', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async subscribeNewsletter(email: string, name?: string) {
    return this.request('/public/newsletter', {
      method: 'POST',
      body: JSON.stringify({ email, name }),
    });
  }

  public async getTranslations(lang: string) {
    return this.request(`/public/translations/${lang}`);
  }

  /* =========================================================================
     2. ADMIN AUTHENTICATION
     ========================================================================= */

  public async login(usernameOrEmail: string, password: string) {
    const res = await this.request<{ token: string; user: any }>('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ usernameOrEmail, password }),
    });
    if (res.success && res.data?.token) {
      this.setToken(res.data.token);
    }
    return res;
  }

  public async getMe() {
    return this.request('/auth/me');
  }

  public async changePassword(currentPassword: string, newPassword: string) {
    return this.request('/auth/change-password', {
      method: 'POST',
      body: JSON.stringify({ currentPassword, newPassword }),
    });
  }

  public async logout() {
    const res = await this.request('/auth/logout', { method: 'POST' });
    this.clearToken();
    return res;
  }

  /* =========================================================================
     3. ADMIN MEMBER MANAGEMENT
     ========================================================================= */

  public async getMembers(params: {
    q?: string;
    registrationStatus?: string;
    membershipStatus?: string;
    gender?: string;
    regionId?: string;
    sectorId?: string;
    page?: number;
    pageSize?: number;
    sort?: string;
  } = {}) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/admin/members?${query}`);
  }

  public async getMemberById(id: string) {
    return this.request(`/admin/members/${id}`);
  }

  public async updateMember(id: string, data: any) {
    return this.request(`/admin/members/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  public async approveMember(id: string) {
    return this.request(`/admin/members/${id}/approve`, { method: 'POST' });
  }

  public async rejectMember(id: string, reason: string) {
    return this.request(`/admin/members/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  public async setMemberStatus(id: string, membershipStatus: 'active' | 'inactive' | 'pending') {
    return this.request(`/admin/members/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ membershipStatus }),
    });
  }

  public async createMemberAdmin(data: any) {
    return this.request('/admin/members', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async getPendingRegistrationsCount() {
    return this.request<{ pendingCount: number }>('/admin/registrations/pending-count');
  }

  public getDocumentDownloadUrl(memberId: string, docId: string): string {
    return `${this.baseUrl}/admin/members/${memberId}/documents/${docId}`;
  }

  public getMembersExportUrl(format: 'xlsx' | 'pdf' = 'xlsx'): string {
    return `${this.baseUrl}/admin/members/export?format=${format}`;
  }

  /* =========================================================================
     4. ADMIN DASHBOARD & FINANCIALS
     ========================================================================= */

  public async getDashboardSummary(regionId?: string) {
    const query = regionId ? `?regionId=${regionId}` : '';
    return this.request(`/admin/dashboard/summary${query}`);
  }

  public async getMembersByDimension(
    dimension: 'gender' | 'sector' | 'field' | 'occupation' | 'region' | 'graduationLevel',
    lang: string = 'en',
    regionId?: string
  ) {
    const params = new URLSearchParams({ dimension, lang });
    if (regionId) params.append('regionId', regionId);
    return this.request(`/admin/dashboard/members-by?${params.toString()}`);
  }

  public async getContributionsDashboard(range: '3m' | '6m' | '12m' = '12m', group: 'week' | 'month' | 'year' = 'month', regionId?: string) {
    const params = new URLSearchParams({ range, group });
    if (regionId) params.append('regionId', regionId);
    return this.request(`/admin/dashboard/contributions?${params.toString()}`);
  }

  public async getRecentActivity() {
    return this.request('/admin/dashboard/recent-activity');
  }

  public async getPayments(params: { memberId?: string; regionId?: string; status?: string; page?: number; pageSize?: number } = {}) {
    const query = new URLSearchParams(params as any).toString();
    return this.request(`/admin/payments?${query}`);
  }

  public async recordPayment(data: {
    memberId: string;
    amountEtb: number;
    period: 'weekly' | 'monthly' | 'yearly';
    paidForDate: string;
    method: 'cash' | 'bank_transfer' | 'mobile_money' | 'other';
    bank?: string;
    reference?: string;
    note?: string;
  }) {
    return this.request('/admin/payments', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async voidPayment(id: string, note?: string) {
    return this.request(`/admin/payments/${id}/void`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    });
  }

  public getReceiptPdfUrl(paymentId: string): string {
    return `${this.baseUrl}/admin/payments/${paymentId}/receipt?format=pdf`;
  }

  public async getUnpaidMembers(period: string = 'monthly', date?: string) {
    const params = new URLSearchParams({ period });
    if (date) params.append('date', date);
    return this.request(`/admin/payments/unpaid?${params.toString()}`);
  }

  public async getContributionPlans() {
    return this.request('/admin/contribution-plans');
  }

  public getPaymentsExportUrl(): string {
    return `${this.baseUrl}/admin/payments/export?format=xlsx`;
  }

  /* =========================================================================
     5. ADMIN CONTENT CMS, SMS, & USERS
     ========================================================================= */

  public async getAnnouncementsAdmin() {
    return this.request('/admin/announcements');
  }

  public async createAnnouncement(data: any) {
    return this.request('/admin/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async publishAnnouncement(id: string) {
    return this.request(`/admin/announcements/${id}/publish`, { method: 'PATCH' });
  }

  public async archiveAnnouncement(id: string) {
    return this.request(`/admin/announcements/${id}/archive`, { method: 'PATCH' });
  }

  public async getMessages() {
    return this.request('/admin/messages');
  }

  public async updateMessageStatus(id: string, status: 'new' | 'read' | 'replied' | 'archived') {
    return this.request(`/admin/messages/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  public async getSubscribers() {
    return this.request('/admin/subscribers');
  }

  public async sendSms(data: { memberId?: string; phone?: string; message: string }) {
    return this.request('/admin/sms/send', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async createSmsCampaign(data: {
    name: string;
    message: string;
    audienceFilter?: any;
    scheduledAt?: string;
  }) {
    return this.request('/admin/sms/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async getSmsCampaigns() {
    return this.request('/admin/sms/campaigns');
  }

  public async getSmsBalance() {
    return this.request('/admin/sms/balance');
  }

  public async getPermissionsMeta() {
    return this.request('/admin/meta/permissions');
  }

  public async getUsers() {
    return this.request('/admin/users');
  }

  public async createUser(data: any) {
    return this.request('/admin/users', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  public async updateUserActive(id: string, isActive: boolean) {
    return this.request(`/admin/users/${id}/active`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
  }

  public async getAuditLogs(page: number = 1, pageSize: number = 25) {
    return this.request(`/admin/audit-logs?page=${page}&pageSize=${pageSize}`);
  }
}

export const ohpeaApi = new OhpeaApiClient();
