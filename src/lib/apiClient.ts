import { Aset, Bidang, Cabang, DashboardStats, UtilizationStats, User, Pengajuan, RiwayatKalibrasi, AuditLog, SmtpConfig, EmailLog, ProyeksiPendapatanAset, Order } from '../types';

// Helper to get Authorization Bearer Headers for JWT
function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const token = localStorage.getItem('sucofindo_jwt_token');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  return headers;
}

// Helper to fetch with automatic timeout (default 10 seconds, or custom for slow operations like SMTP)
async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 10000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal
    });
    return response;
  } finally {
    clearTimeout(timer);
  }
}

export const apiClient = {
  // Database Status
  async getDbStatus(): Promise<any> {
    try {
      const res = await fetchWithTimeout('/api/db/status', { headers: getAuthHeaders() });
      if (!res.ok) return { mongoConnected: false };
      const json = await res.json();
      return json;
    } catch {
      return { mongoConnected: false };
    }
  },

  async reconnectDb(): Promise<any> {
    try {
      const res = await fetchWithTimeout('/api/db/reconnect', { method: 'POST', headers: getAuthHeaders() });
      if (!res.ok) return { mongoConnected: false, message: 'Server error' };
      const json = await res.json();
      return json;
    } catch (err: any) {
      return { mongoConnected: false, message: err?.message || 'Server error' };
    }
  },

  // Stats
  async getStats(): Promise<DashboardStats> {
    try {
      const res = await fetchWithTimeout('/api/stats', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return json.stats || {
        totalAset: 0,
        digunakan: 0,
        tersedia: 0,
        dalamPemeliharaan: 0,
        dipinjamkan: 0,
        prosesDisposal: 0,
        disposal: 0,
        tidakTersedia: 0,
        selesaiPakai: 0,
        idle: 0,
        maintenance: 0,
        butuhKalibrasiSegera: 0,
        pengajuanPending: 0,
        asetPerBidang: [],
        asetPerKategori: [],
        kalibrasiAlerts: []
      };
    } catch (err) {
      console.warn('getStats fetch error:', err);
      return {
        totalAset: 0,
        digunakan: 0,
        tersedia: 0,
        dalamPemeliharaan: 0,
        dipinjamkan: 0,
        prosesDisposal: 0,
        disposal: 0,
        tidakTersedia: 0,
        selesaiPakai: 0,
        idle: 0,
        maintenance: 0,
        butuhKalibrasiSegera: 0,
        pengajuanPending: 0,
        asetPerBidang: [],
        asetPerKategori: [],
        kalibrasiAlerts: []
      };
    }
  },

  // Utilization Stats
  async getUtilizationStats(): Promise<UtilizationStats> {
    try {
      const res = await fetchWithTimeout('/api/stats/utilization', { headers: getAuthHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      return {
        overall: json.overall || { rate: 0, digunakan: 0, aktif: 0 },
        operasional: json.operasional,
        perBidang: json.perBidang || [],
        perKategori: json.perKategori || []
      };
    } catch (err) {
      console.warn('getUtilizationStats fetch error:', err);
      return {
        overall: { rate: 0, digunakan: 0, aktif: 0 },
        perBidang: [],
        perKategori: []
      };
    }
  },

  // Cabang (Branch) Management (Staff PUMA)
  async getCabangs(): Promise<Cabang[]> {
    try {
      const res = await fetchWithTimeout('/api/cabangs', { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    } catch (err) {
      console.warn('getCabangs fetch error:', err);
      return [];
    }
  },

  async createCabang(cabangData: Partial<Cabang>): Promise<Cabang> {
    const res = await fetchWithTimeout('/api/cabangs', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(cabangData)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal menambahkan cabang');
    return json.data;
  },

  async updateCabang(id: string, cabangData: Partial<Cabang>): Promise<Cabang> {
    const res = await fetchWithTimeout(`/api/cabangs/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(cabangData)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal memperbarui cabang');
    return json.data;
  },

  async deleteCabang(id: string): Promise<boolean> {
    const res = await fetchWithTimeout(`/api/cabangs/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal menghapus cabang');
    return true;
  },

  // Bidang (Department) Management - Customizable per Cabang by Fungsi UMUM
  async getBidang(cabang?: string): Promise<Bidang[]> {
    try {
      const query = cabang && cabang !== 'ALL' ? `?cabang=${encodeURIComponent(cabang)}` : '';
      const res = await fetchWithTimeout(`/api/bidang${query}`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    } catch (err) {
      console.warn('getBidang fetch error:', err);
      return [];
    }
  },

  async createBidang(bidangData: Partial<Bidang>): Promise<Bidang> {
    const res = await fetchWithTimeout('/api/bidang', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(bidangData)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal menambahkan bidang');
    return json.data;
  },

  async updateBidang(id: string, bidangData: Partial<Bidang>): Promise<Bidang> {
    const res = await fetchWithTimeout(`/api/bidang/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(bidangData)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal memperbarui bidang');
    return json.data;
  },

  async deleteBidang(id: string): Promise<boolean> {
    const res = await fetchWithTimeout(`/api/bidang/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal menghapus bidang');
    return true;
  },

  // Users
  async getUsers(page?: number, limit?: number, cabang?: string): Promise<User[]> {
    try {
      const params = new URLSearchParams();
      if (page && limit) {
        params.append('page', String(page));
        params.append('limit', String(limit));
      }
      if (cabang && cabang !== 'ALL') {
        params.append('cabang', cabang);
      }
      const queryStr = params.toString() ? `?${params.toString()}` : '';
      const res = await fetchWithTimeout(`/api/users${queryStr}`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    } catch (err) {
      console.warn('getUsers fetch error:', err);
      return [];
    }
  },

  // Auth Login, Heartbeat, Logout & Switch Role
  async login(username: string, password: string): Promise<{ user: User; expiresAt: number; token?: string }> {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    let json: any;
    try {
      json = await res.json();
    } catch (e) {
      if (!res.ok) {
        throw new Error(`Server error (${res.status}): Serverless Function Vercel mengalami kendala. Silakan periksa log Vercel.`);
      }
      throw new Error('Format respon server tidak valid.');
    }

    if (!res.ok || !json.success) {
      throw new Error(json.message || 'Gagal login. Periksa username dan password Anda.');
    }
    if (json.data?.token) {
      localStorage.setItem('sucofindo_jwt_token', json.data.token);
    }
    return {
      user: json.data.user,
      expiresAt: json.data.expiresAt || (Date.now() + 2 * 60 * 60 * 1000),
      token: json.data?.token
    };
  },

  async heartbeat(userId: string): Promise<void> {
    try {
      await fetch('/api/auth/heartbeat', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ userId })
      });
    } catch (err) {
      console.warn('Heartbeat error:', err);
    }
  },

  async logout(userId?: string): Promise<void> {
    try {
      if (userId) {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: getAuthHeaders(),
          body: JSON.stringify({ userId })
        });
      }
    } catch (err) {
      console.warn('Logout API error:', err);
    } finally {
      localStorage.removeItem('sucofindo_jwt_token');
    }
  },

  async switchRole(userId: string): Promise<User> {
    const res = await fetch('/api/auth/switch-role', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId })
    });
    const json = await res.json();
    if (json.token) {
      localStorage.setItem('sucofindo_jwt_token', json.token);
    }
    return json.user;
  },

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<User> {
    const res = await fetch('/api/users/change-password', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ userId, oldPassword, newPassword })
    });
    const json = await res.json();
    if (!json.success) {
      throw new Error(json.message || 'Gagal mengubah password.');
    }
    return json.user;
  },

  // Get Assets with query filters
  async getAsets(params?: { search?: string; status?: string; bidang?: string; kategori?: string; kondisi?: string; cabang?: string; page?: number; limit?: number }): Promise<Aset[]> {
    try {
      const query = new URLSearchParams();
      if (params?.search) query.append('search', params.search);
      if (params?.status) query.append('status', params.status);
      if (params?.bidang) query.append('bidang', params.bidang);
      if (params?.kategori) query.append('kategori', params.kategori);
      if (params?.kondisi) query.append('kondisi', params.kondisi);
      if (params?.cabang && params.cabang !== 'ALL') query.append('cabang', params.cabang);
      if ((params as any)?.sumber_aset) query.append('sumber_aset', (params as any).sumber_aset);
      if (params?.page) query.append('page', String(params.page));
      if (params?.limit) query.append('limit', String(params.limit));

      const res = await fetchWithTimeout(`/api/asets?${query.toString()}`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    } catch (err) {
      console.warn('getAsets fetch error:', err);
      return [];
    }
  },

  // Confirm receipt of PUMA-procured asset at branch / SBU with optional revenue projections
  async terimaAsetDiCabang(id: string, options?: { catatan?: string; proyeksi?: Array<{ tahun: number; nilai: number }> } | string): Promise<Aset> {
    const payload = typeof options === 'string' ? { catatan: options } : (options || {});
    const res = await fetch(`/api/asets/${encodeURIComponent(id)}/terima-cabang`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(payload)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal mengonfirmasi penerimaan aset di cabang');
    return json.data;
  },

  // Get revenue projections per year for an asset
  async getProyeksiAset(asetId: string): Promise<ProyeksiPendapatanAset[]> {
    try {
      const res = await fetch(`/api/asets/${encodeURIComponent(asetId)}/proyeksi`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    } catch (err) {
      console.warn('Failed to fetch proyeksi aset:', err);
      return [];
    }
  },

  // --- Modul Data Order (Tahap 2) ---
  async getOrders(query?: string): Promise<Order[]> {
    try {
      const url = query ? `/api/orders?q=${encodeURIComponent(query)}` : '/api/orders';
      const res = await fetch(url, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    } catch (err) {
      console.warn('Failed to fetch orders:', err);
      return [];
    }
  },

  async getOrder(nomorOrder: string): Promise<Order> {
    const res = await fetch(`/api/orders/${encodeURIComponent(nomorOrder)}`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Nomor order tidak ditemukan');
    return json.data;
  },

  async createOrder(orderData: { nomor_order: string; nama_order?: string; nilai_order: number }): Promise<Order> {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(orderData)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal menyimpan data order');
    return json.data;
  },

  async getOrderAlokasi(nomorOrder: string): Promise<{ order: Order; alokasi: any }> {
    const res = await fetch(`/api/orders/${encodeURIComponent(nomorOrder)}/alokasi`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal menghitung alokasi order');
    return { order: json.order, alokasi: json.alokasi };
  },

  async getAsetPendapatanRiil(asetId: string, start?: string, end?: string): Promise<any> {
    const params = new URLSearchParams();
    if (start) params.set('start', start);
    if (end) params.set('end', end);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const res = await fetch(`/api/asets/${encodeURIComponent(asetId)}/pendapatan-riil${qs}`, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal mengambil data pendapatan riil aset');
    return json.data;
  },

  async getUtilisasiSummary(params?: {
    periode?: 'bulan_ini' | 'ytd' | 'tahunan';
    tahun?: number;
    cabang?: string;
    bidang?: string;
    kategori?: string;
  }): Promise<{
    periode: string;
    tahun: number;
    count: number;
    data: any[];
    agregat_bidang: any[];
    agregat_kategori: any[];
  }> {
    const qs = new URLSearchParams();
    if (params?.periode) qs.set('periode', params.periode);
    if (params?.tahun) qs.set('tahun', String(params.tahun));
    if (params?.cabang) qs.set('cabang', params.cabang);
    if (params?.bidang) qs.set('bidang', params.bidang);
    if (params?.kategori) qs.set('kategori', params.kategori);

    const url = `/api/utilisasi/summary${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal memuat ringkasan utilisasi');
    return json;
  },

  async getAsetMetrikUtilisasi(
    asetId: string,
    params?: { periode?: 'bulan_ini' | 'ytd' | 'tahunan'; tahun?: number }
  ): Promise<{ metrik: any; monthly_breakdown: any[] }> {
    const qs = new URLSearchParams();
    if (params?.periode) qs.set('periode', params.periode);
    if (params?.tahun) qs.set('tahun', String(params.tahun));

    const url = `/api/asets/${encodeURIComponent(asetId)}/metrik-utilisasi${qs.toString() ? `?${qs.toString()}` : ''}`;
    const res = await fetch(url, { headers: getAuthHeaders() });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal memuat metrik utilisasi aset');
    return { metrik: json.metrik, monthly_breakdown: json.monthly_breakdown };
  },

  // Get Single Asset detail by ID or QR
  async getAsetDetail(idOrQr: string): Promise<Aset & { assignments: any[]; kalibrasi: RiwayatKalibrasi[]; pengajuan: Pengajuan[]; proyeksi?: ProyeksiPendapatanAset[] }> {
    const res = await fetch(`/api/asets/${encodeURIComponent(idOrQr)}`, { headers: getAuthHeaders() });
    if (!res.ok) throw new Error('Aset tidak ditemukan');
    const json = await res.json();
    return json.data;
  },

  // Create Asset
  async createAset(assetData: Partial<Aset> & { actorName?: string; actorRole?: string }): Promise<Aset> {
    const res = await fetch('/api/asets', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(assetData)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal menyimpan aset');
    return json.data;
  },

  // Edit Asset Master Data
  async updateAset(id: string, updates: Partial<Aset> & { actorName?: string; actorRole?: string }): Promise<Aset> {
    const res = await fetch(`/api/asets/${encodeURIComponent(id)}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(updates)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal mengubah aset');
    return json.data;
  },

  // Delete Asset - Disabled per policy
  async deleteAset(_id: string, _actorName?: string, _actorRole?: string): Promise<boolean> {
    throw new Error('Penghapusan aset tidak diperkenankan dalam sistem ini.');
  },

  // Mobile QR Code Scan Update Status
  async updateAsetMobile(idOrQr: string, data: { 
    kondisi?: string; 
    lokasi_sekarang?: string; 
    status?: string; 
    catatan?: string; 
    actorName?: string; 
    actorRole?: string;
    foto_pengembalian?: string;
    lokasi_pengembalian?: string;
    koordinat_gps?: { lat: number; lng: number; accuracy?: number } | null;
    [key: string]: any;
  }): Promise<Aset> {
    const res = await fetch(`/api/asets/${encodeURIComponent(idOrQr)}/update-status`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal update status via QR');
    return json.data;
  },

  // Assign Asset
  async assignAset(id: string, data: { id_bidang: string; id_pic: string; keterangan: string; diserah_oleh?: string }): Promise<Aset> {
    const res = await fetch(`/api/asets/${encodeURIComponent(id)}/assign`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal assign aset');
    return json.data;
  },

  // Record Calibration
  async addKalibrasi(id: string, data: Partial<RiwayatKalibrasi>): Promise<Aset> {
    const res = await fetch(`/api/asets/${encodeURIComponent(id)}/kalibrasi`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal input kalibrasi');
    return json.data;
  },

  // Pengajuan Transfer/Disposal
  async submitPengajuan(data: Partial<Pengajuan>): Promise<Pengajuan> {
    const res = await fetch('/api/pengajuan', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data)
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal mengirim pengajuan');
    return json.data;
  },

  async getPengajuan(page?: number, limit?: number): Promise<Pengajuan[]> {
    try {
      const query = page && limit ? `?page=${page}&limit=${limit}` : '';
      const res = await fetchWithTimeout(`/api/pengajuan${query}`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    } catch (err) {
      console.warn('getPengajuan fetch error:', err);
      return [];
    }
  },

  async approvePengajuan(id: string, approver: string | User, catatan: string): Promise<{ pengajuan: Pengajuan; aset?: Aset }> {
    const isUserObj = typeof approver === 'object' && approver !== null;
    const approver_nama = isUserObj ? approver.nama : approver;
    const approver_id = isUserObj ? approver.id : undefined;
    const approver_role = isUserObj ? approver.role : undefined;
    const approver_id_bidang = isUserObj ? approver.id_bidang : undefined;

    const res = await fetch(`/api/pengajuan/${encodeURIComponent(id)}/approve`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ approver_id, approver_nama, approver_role, approver_id_bidang, catatan })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal approve pengajuan');
    return { pengajuan: json.data, aset: json.aset };
  },

  async rejectPengajuan(id: string, approver: string | User, catatan: string): Promise<{ pengajuan: Pengajuan; aset?: Aset }> {
    const isUserObj = typeof approver === 'object' && approver !== null;
    const approver_nama = isUserObj ? approver.nama : approver;
    const approver_id = isUserObj ? approver.id : undefined;
    const approver_role = isUserObj ? approver.role : undefined;
    const approver_id_bidang = isUserObj ? approver.id_bidang : undefined;

    const res = await fetch(`/api/pengajuan/${encodeURIComponent(id)}/reject`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify({ approver_id, approver_nama, approver_role, approver_id_bidang, catatan })
    });
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal reject pengajuan');
    return { pengajuan: json.data, aset: json.aset };
  },

  // Audit logs
  async getAuditLogs(page?: number, limit?: number): Promise<AuditLog[]> {
    try {
      const query = page && limit ? `?page=${page}&limit=${limit}` : '';
      const res = await fetchWithTimeout(`/api/audit-logs${query}`, { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    } catch (err) {
      console.warn('getAuditLogs fetch error:', err);
      return [];
    }
  },

  // Export CSV download URL
  getExportCsvUrl(): string {
    return '/api/export/csv';
  },

  // Email Notification Features
  async getEmailSettings(): Promise<SmtpConfig> {
    try {
      const res = await fetchWithTimeout('/api/email/settings', { headers: getAuthHeaders() });
      const contentType = res.headers.get('content-type');
      if (!res.ok || !contentType || !contentType.includes('application/json')) {
        return {
          host: 'smtp.gmail.com',
          port: 587,
          secure: false,
          user: '',
          pass: '',
          fromName: 'Notifikasi Aset SUCOFINDO',
          fromEmail: 'noreply@sucofindo.co.id',
          defaultRecipient: 'aset@sucofindo.co.id',
          enabled: false
        };
      }
      const json = await res.json();
      return json.data || {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        user: '',
        pass: '',
        fromName: 'Notifikasi Aset SUCOFINDO',
        fromEmail: 'noreply@sucofindo.co.id',
        defaultRecipient: 'aset@sucofindo.co.id',
        enabled: false
      };
    } catch (err) {
      console.warn('getEmailSettings fetch error:', err);
      return {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        user: '',
        pass: '',
        fromName: 'Notifikasi Aset SUCOFINDO',
        fromEmail: 'noreply@sucofindo.co.id',
        defaultRecipient: 'aset@sucofindo.co.id',
        enabled: false
      };
    }
  },

  async saveEmailSettings(config: Partial<SmtpConfig>): Promise<SmtpConfig> {
    const res = await fetchWithTimeout('/api/email/settings', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(config)
    }, 15000);
    const contentType = res.headers.get('content-type');
    if (!res.ok || !contentType || !contentType.includes('application/json')) {
      throw new Error('Gagal menyimpan pengaturan email: Server merespons format tidak valid');
    }
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal menyimpan pengaturan email');
    return json.data;
  },

  async sendTestEmail(recipient?: string): Promise<{ success: boolean; message: string; log?: EmailLog }> {
    try {
      const res = await fetchWithTimeout('/api/email/test', {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ recipient })
      }, 20000);
      const contentType = res.headers.get('content-type');
      if (!res.ok || !contentType || !contentType.includes('application/json')) {
        return { success: false, message: 'Server merespons format tidak valid' };
      }
      const json = await res.json();
      return json;
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
        return { success: false, message: 'Waktu koneksi email habis (timeout), namun permintaan sedang diproses oleh server.' };
      }
      return { success: false, message: err?.message || 'Gagal terhubung ke server' };
    }
  },

  async triggerCalibrationEmailCheck(): Promise<{ success: boolean; message: string; data: any[] }> {
    try {
      const res = await fetchWithTimeout('/api/email/check-calibration', {
        method: 'POST',
        headers: getAuthHeaders()
      }, 25000);
      const contentType = res.headers.get('content-type');
      if (!res.ok || !contentType || !contentType.includes('application/json')) {
        return { success: false, message: 'Server merespons format tidak valid', data: [] };
      }
      const json = await res.json();
      return json;
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
        return { success: false, message: 'Pengecekan email berjalan di background server (timeout koneksi browser).', data: [] };
      }
      return { success: false, message: err?.message || 'Gagal terhubung ke server', data: [] };
    }
  },

  async triggerOverdueEmailCheck(): Promise<{ success: boolean; message: string; data: any[] }> {
    try {
      const res = await fetchWithTimeout('/api/email/check-overdue', {
        method: 'POST',
        headers: getAuthHeaders()
      }, 25000);
      const contentType = res.headers.get('content-type');
      if (!res.ok || !contentType || !contentType.includes('application/json')) {
        return { success: false, message: 'Server merespons format tidak valid', data: [] };
      }
      const json = await res.json();
      return json;
    } catch (err: any) {
      if (err?.name === 'AbortError' || err?.message?.includes('aborted')) {
        return { success: false, message: 'Pengecekan email keterlambatan berjalan di background server.', data: [] };
      }
      return { success: false, message: err?.message || 'Gagal terhubung ke server', data: [] };
    }
  },

  async getEmailLogs(): Promise<EmailLog[]> {
    try {
      const res = await fetchWithTimeout('/api/email/logs', { headers: getAuthHeaders() });
      if (!res.ok) return [];
      const contentType = res.headers.get('content-type');
      if (!contentType || !contentType.includes('application/json')) return [];
      const json = await res.json();
      return json.data || [];
    } catch (err) {
      console.warn('getEmailLogs fetch error:', err);
      return [];
    }
  },

  // User / PIC Management (Fungsi Umum)
  async createUser(userData: Partial<User>): Promise<User> {
    const res = await fetchWithTimeout('/api/users', {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(userData)
    });
    const contentType = res.headers.get('content-type');
    if (!res.ok || !contentType || !contentType.includes('application/json')) {
      throw new Error('Gagal membuat pengguna PIC baru: Server merespons format tidak valid');
    }
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal membuat pengguna PIC baru');
    return json.data;
  },

  async updateUser(id: string, userData: Partial<User>): Promise<User> {
    const res = await fetchWithTimeout(`/api/users/${id}`, {
      method: 'PUT',
      headers: getAuthHeaders(),
      body: JSON.stringify(userData)
    });
    const contentType = res.headers.get('content-type');
    if (!res.ok || !contentType || !contentType.includes('application/json')) {
      throw new Error('Gagal memperbarui data PIC: Server merespons format tidak valid');
    }
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal memperbarui data PIC');
    return json.data;
  },

  async deleteUser(id: string): Promise<boolean> {
    const res = await fetchWithTimeout(`/api/users/${id}`, {
      method: 'DELETE',
      headers: getAuthHeaders()
    });
    const contentType = res.headers.get('content-type');
    if (!res.ok || !contentType || !contentType.includes('application/json')) {
      throw new Error('Gagal menghapus PIC: Server merespons format tidak valid');
    }
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal menghapus PIC');
    return true;
  },

  async resetUserPassword(userId: string): Promise<{ success: boolean; message: string; user: User }> {
    const res = await fetchWithTimeout(`/api/users/${userId}/reset-password`, {
      method: 'POST',
      headers: getAuthHeaders()
    });
    const contentType = res.headers.get('content-type');
    if (!res.ok || !contentType || !contentType.includes('application/json')) {
      throw new Error('Gagal mereset password pengguna: Server merespons format tidak valid');
    }
    const json = await res.json();
    if (!json.success) throw new Error(json.message || 'Gagal mereset password pengguna');
    return json;
  }
};


