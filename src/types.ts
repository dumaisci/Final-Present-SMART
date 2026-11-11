export type Role = 'puma' | 'admin' | 'pic_bidang' | 'management' | 'pimpinan';

export type KondisiAset = 'Baik' | 'Rusak Ringan' | 'Rusak Berat' | 'Hilang';
export type StatusAset = 
  | 'Digunakan' 
  | 'Tersedia' 
  | 'Dalam Pemeliharaan' 
  | 'Dipinjamkan' 
  | 'Proses Disposal' 
  | 'Disposal' 
  | 'Tidak Tersedia';

export const STATUS_KONDISI_MAP: Record<StatusAset, KondisiAset[]> = {
  'Digunakan': ['Baik', 'Rusak Ringan'],
  'Tersedia': ['Baik', 'Rusak Ringan'],
  'Dalam Pemeliharaan': ['Baik', 'Rusak Ringan'],
  'Dipinjamkan': ['Baik', 'Rusak Ringan'],
  'Proses Disposal': ['Rusak Berat'],
  'Disposal': ['Rusak Berat'],
  'Tidak Tersedia': ['Hilang']
};

export const ALL_STATUSES: StatusAset[] = [
  'Digunakan',
  'Tersedia',
  'Dalam Pemeliharaan',
  'Dipinjamkan',
  'Proses Disposal',
  'Disposal',
  'Tidak Tersedia'
];

export const ALL_KONDISI: KondisiAset[] = [
  'Baik',
  'Rusak Ringan',
  'Rusak Berat',
  'Hilang'
];

export function getAllowedKondisiForStatus(status: StatusAset | string): KondisiAset[] {
  if (status in STATUS_KONDISI_MAP) {
    return STATUS_KONDISI_MAP[status as StatusAset];
  }
  return ['Baik', 'Rusak Ringan'];
}

export function isKondisiAllowedForStatus(status: StatusAset | string, kondisi: KondisiAset | string): boolean {
  const allowed = getAllowedKondisiForStatus(status);
  return allowed.includes(kondisi as KondisiAset);
}

export type JenisBidang = 'Bidang' | 'Unit Pelayanan';
export type KategoriAset = 
  | 'Tanah'
  | 'Bangunan'
  | 'Perlengkapan/Mesin Gedung'
  | 'Peralatan Operasi'
  | 'Kendaraan'
  | 'Peralatan/Prabot Kantor'
  | 'Peralatan Sistem Informasi';

export interface Cabang {
  id_cabang: string; // e.g. "CBG-001"
  kode_cabang: string; // e.g. "PST", "MDN", "PKU"
  nama_cabang: string; // e.g. "Kantor Pusat", "Cabang Medan"
  alamat?: string;
  kontak?: string;
  status: 'Active' | 'Inactive';
  created_at?: string;
  updated_at?: string;
}

export interface User {
  id: string;
  npp: string;
  username?: string;
  password?: string;
  nama: string;
  email: string;
  role: Role;
  tipe_management?: 'kepala_cabang' | 'kepala_bidang';
  id_cabang?: string;
  nama_cabang?: string;
  id_bidang: string;
  nama_bidang: string;
  jabatan: string;
  avatarUrl?: string;
  isOnline?: boolean;
  mustChangePassword?: boolean;
  lastActive?: string;
  updated_at?: string;
}

export interface Bidang {
  id_bidang: string;
  id_cabang?: string;
  nama_cabang?: string;
  nama_bidang: string;
  jenis: JenisBidang;
  pic_utama: string;
  kontak: string;
  lokasi_kantor: string;
}

export type SumberAset = 'PUMA' | 'Cabang';
export type JenisPengadaan = 'Investasi' | 'Project Cabang';
export type StatusPenerimaanCabang = 'Menunggu Penerimaan' | 'Diterima';
export type BasisOperasiAset = 'Working Day Based' | 'Continuous Operation';

export interface SesiOperasi {
  mulai: string;
  selesai: string;
  durasi_jam: number;
  pic?: string;
  foto_pengembalian?: string; // Foto bukti fisik barang saat selesai digunakan
  lokasi_pengembalian?: string; // Alamat / keterangan lokasi pengembalian
  koordinat_gps?: { lat: number; lng: number }; // Titik koordinat GPS pengembalian
  nomor_order?: string | null; // Nomor order (opsional, nullable untuk pemakaian internal)
}

export interface SesiPemeliharaan {
  mulai: string;
  selesai: string;
  durasi_jam: number;
  jenis?: string;
}

export interface UtilizationBreakdown {
  actualHours: number;
  availableHours: number;
  maintenanceHours: number;
  rate: number;
}

export interface AssetUtilizationStats {
  mingguan: UtilizationBreakdown;
  bulanan: UtilizationBreakdown;
  allTime: UtilizationBreakdown;
  basis: BasisOperasiAset;
  asOfDate?: string;
}

export interface Aset {
  id_aset: string;
  asset_number?: string;
  tag_number?: string;
  nama: string;
  kategori: KategoriAset;
  id_cabang?: string;
  nama_cabang?: string;
  tgl_perolehan?: string;
  tahun_perolehan: number;
  spesifikasi: string;
  merk_model: string;
  nomor_seri: string;
  lokasi_awal: string;
  lokasi_sekarang: string;
  kondisi: KondisiAset;
  status: StatusAset;
  id_bidang_sekarang: string;
  nama_bidang_sekarang: string;
  id_pic_sekarang: string;
  nama_pic_sekarang: string;
  nama_pemegang_terakhir?: string; // Karyawan / Personel pemegang di lapangan
  tgl_pemutakhiran_pemegang?: string;
  lokasi_pemakaian_lapangan?: string;
  qr_code: string;
  tgl_kalibrasi_terakhir?: string;
  tgl_kalibrasi_berikutnya?: string;
  sertifikat_kalibrasi_no?: string;
  tgl_rencana_pengembalian?: string; // Tanggal rencana pengembalian aset pemakaian lapangan
  tgl_notifikasi_terlambat_terakhir?: string;
  // PUMA vs Cabang Procurement & Acceptance Tracking
  sumber_aset?: SumberAset; // 'PUMA' | 'Cabang'
  jenis_pengadaan?: JenisPengadaan; // 'Investasi' | 'Project Cabang'
  status_penerimaan?: StatusPenerimaanCabang; // 'Menunggu Penerimaan' | 'Diterima'
  diterima_oleh?: string;
  tgl_diterima?: string;
  catatan_penerimaan?: string;
  dibuat_oleh_puma?: boolean;
  // Asset Operational Utilization tracking
  basis_operasi?: BasisOperasiAset; // 'Working Day Based' (8h/5d) | 'Continuous Operation' (24h/7d)
  waktu_mulai_operasi?: string; // Timestamp when status turned 'Digunakan'
  waktu_mulai_pemeliharaan?: string; // Timestamp when status turned 'Dalam Pemeliharaan'
  nomor_order_aktif?: string | null; // Nomor order yang sedang berjalan pada sesi pemakaian aktif
  riwayat_operasi?: SesiOperasi[];
  riwayat_pemeliharaan_jam?: SesiPemeliharaan[];
  utilization?: AssetUtilizationStats;
  // Bukti Fisik Selesai Pakai (Digunakan -> Tersedia)
  foto_pengembalian_terakhir?: string;
  lokasi_pengembalian_terakhir?: string;
  koordinat_gps_terakhir?: { lat: number; lng: number };
  // Nilai Perolehan & Proyeksi Pendapatan
  nilai_perolehan?: number; // Integer Rupiah (tanpa desimal)
  created_at: string;
  updated_at: string;
}

export interface ProyeksiPendapatanAset {
  id?: string;
  aset_id: string;
  tahun: number; // Integer year (e.g. 2026)
  nilai: number; // Integer Rupiah (tanpa desimal)
  diinput_oleh: string;
  diinput_pada: string;
}

export interface Order {
  id?: string;
  nomor_order: string; // unique, uppercase, trim
  nama_order?: string;
  nilai_order: number; // Integer Rupiah > 0
  dibuat_oleh: string;
  dibuat_pada: string;
}

export interface Assignment {
  id_assignment: string;
  id_aset: string;
  nama_aset: string;
  id_cabang?: string;
  nama_cabang?: string;
  id_bidang: string;
  nama_bidang: string;
  id_pic: string;
  nama_pic: string;
  pemegang_lapangan?: string; // Personel / karyawan pemegang lapangan
  tanggal_serah: string;
  keterangan: string;
  status: 'Aktif' | 'Selesai' | 'Dibatalkan';
  diserah_oleh: string;
}

export interface RiwayatKalibrasi {
  id_kalibrasi: string;
  id_aset: string;
  nama_aset: string;
  id_cabang?: string;
  nama_cabang?: string;
  tanggal: string;
  lembaga_kalibrasi: string;
  nomor_sertifikat: string;
  jatuh_tempo_berikutnya: string;
  kondisi_setelah: KondisiAset;
  sertifikat_filename?: string;
  pic_input: string;
  catatan?: string;
}

export interface Pengajuan {
  id_pengajuan: string;
  id_aset: string;
  nama_aset: string;
  id_cabang?: string;
  nama_cabang?: string;
  jenis: 'Transfer' | 'Disposal' | 'Pemutakhiran Lapangan' | 'Pengajuan Pemakaian' | 'Peminjaman Aset' | 'Pengembalian Aset (Selesai Pakai)';
  id_bidang_asal: string;
  nama_bidang_asal: string;
  id_bidang_tujuan?: string;
  nama_bidang_tujuan?: string;
  id_pic_tujuan?: string;
  nama_pic_tujuan?: string;
  // Detail untuk Pemutakhiran Lapangan oleh User Biasa
  kondisi_baru?: KondisiAset;
  lokasi_baru?: string;
  status_baru?: StatusAset;
  pemegang_baru?: string;
  tgl_rencana_pengembalian?: string;
  nomor_order?: string | null;
  alasan: string;
  // Bukti Fisik Selesai Digunakan (Pengembalian / Selesai Pakai)
  foto_pengembalian?: string;
  lokasi_pengembalian?: string;
  koordinat_gps?: { lat: number; lng: number };
  status_approval: 'Pending' | 'Approved' | 'Rejected';
  pemohon_id: string;
  pemohon_nama: string;
  approver_id?: string;
  approver_nama?: string;
  catatan_approver?: string;
  created_at: string;
  updated_at: string;
}

export interface AuditLog {
  id_log: string;
  id_aset?: string;
  nama_aset?: string;
  id_cabang?: string;
  nama_cabang?: string;
  aktor: string;
  role_aktor: string;
  waktu: string;
  jenis_perubahan: 
    | 'Create Aset'
    | 'Update Status'
    | 'Assignment'
    | 'Update Kalibrasi'
    | 'Ajukan Transfer'
    | 'Ajukan Disposal'
    | 'Approve Request'
    | 'Reject Request'
    | 'Delete Aset'
    | 'User Login';
  detail: string;
}

export interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  fromName: string;
  fromEmail: string;
  defaultRecipient: string;
  cc_kepala_bidang?: boolean;
  enabled: boolean;
}

export interface EmailLog {
  id_email: string;
  id_aset?: string;
  nama_aset?: string;
  milestone: 'H-30' | 'H-7' | 'Hari H' | 'Uji Coba';
  recipient: string;
  subject: string;
  status: 'SENT' | 'FAILED';
  error_message?: string;
  sent_at: string;
}

export interface DashboardStats {
  totalAset: number;
  digunakan: number;
  tersedia: number;
  dalamPemeliharaan: number;
  dipinjamkan: number;
  prosesDisposal: number;
  disposal: number;
  tidakTersedia: number;
  // Legacy aliases
  selesaiPakai?: number;
  idle?: number;
  maintenance?: number;
  terlambatPengembalian?: number;
  butuhKalibrasiSegera: number; // H-30 / Overdue
  pengajuanPending: number;
  asetPerBidang: { nama_bidang: string; jumlah: number; persen: number }[];
  asetPerKategori: { kategori: string; jumlah: number }[];
  kalibrasiAlerts: Aset[];
}

export interface UtilizationOverall {
  rate: number;
  digunakan: number;
  aktif: number;
}

export interface UtilizationBidang {
  bidang: string;
  rate: number;
  digunakan: number;
  aktif: number;
}

export interface UtilizationKategori {
  kategori: string;
  rate: number;
  static: boolean;
  digunakan?: number;
  aktif?: number;
}

export interface AggregatedOperasionalBreakdown {
  actualHours: number;
  availableHours: number;
  rate: number;
}

export interface AggregatedOperasionalStats {
  totalAsetOperasi: number;
  mingguan: AggregatedOperasionalBreakdown;
  bulanan: AggregatedOperasionalBreakdown;
  allTime: AggregatedOperasionalBreakdown;
}

export interface UtilizationStats {
  overall: UtilizationOverall;
  operasional?: AggregatedOperasionalStats;
  perBidang: UtilizationBidang[];
  perKategori: UtilizationKategori[];
}

export function isFungsiUmum(user: User | null | undefined): boolean {
  if (!user) return false;
  // If user is explicitly in management or pimpinan role (e.g. Kabid in management mode),
  // they operate with management/pimpinan privileges
  if (user.role === 'management' || user.role === 'pimpinan') {
    return false;
  }
  return (
    user.role === 'admin' ||
    user.id_bidang === 'BDG-01' ||
    (!!user.nama_bidang && user.nama_bidang.toLowerCase().includes('dukungan bisnis')) ||
    (!!user.nama_bidang && user.nama_bidang.toLowerCase().includes('umum')) ||
    (!!user.jabatan && user.jabatan.toLowerCase().includes('flp')) ||
    (!!user.jabatan && user.jabatan.toLowerCase().includes('custodian'))
  );
}

/**
 * Checks if a user is the Kepala Cabang (Head of Branch)
 */
export function isKepalaCabang(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.tipe_management === 'kepala_cabang') return true;
  
  const jab = (user.jabatan || '').toLowerCase();
  const username = (user.username || '').toLowerCase().trim();
  const npp = (user.npp || '').trim();
  const role = user.role;

  if (role === 'pimpinan' || role === 'management') {
    if (
      jab.includes('kepala cabang') || 
      jab.includes('kacab') || 
      jab.includes('pimpinan cabang') ||
      jab.includes('head of branch')
    ) {
      return true;
    }
    if (username === 'pimpinan' || username === 'kacab' || username === 'kepala_cabang' || npp === '20101') {
      return true;
    }
    // If management role with general/no specific sub-bidang and no Kabid title
    if (!user.tipe_management && (!user.id_bidang || user.id_bidang === 'ALL' || user.id_bidang === 'BDG-ALL') && !jab.includes('kepala bidang')) {
      return true;
    }
  }

  return false;
}

/**
 * Checks if a user is a Kepala Bidang (Head of Department) for one of the 4 Bidang
 */
export function isKepalaBidang(user: User | null | undefined): boolean {
  if (!user) return false;
  if (isKepalaCabang(user)) return false;
  if (user.tipe_management === 'kepala_bidang') return true;

  const jab = (user.jabatan || '').toLowerCase();
  if (jab.includes('kepala bidang') || jab.includes('kabid') || jab.includes('head of')) {
    return true;
  }
  if (user.role === 'management' && user.id_bidang && user.id_bidang !== 'ALL') {
    return true;
  }
  return false;
}

/**
 * Checks if a user is the Head of Business Support (Kepala Bidang Dukungan Bisnis)
 * or has dual-role capability (can switch between Full Fungsi UMUM and Kepala Dukungan Bisnis).
 */
export function isKepalaBidangDukunganBisnis(user: User | null | undefined): boolean {
  if (!user) return false;
  if (isKepalaCabang(user)) return false;
  
  const username = (user.username || '').toLowerCase().trim();
  const npp = (user.npp || '').trim();
  const jab = (user.jabatan || '').toLowerCase();
  const bid = (user.nama_bidang || '').toLowerCase();
  const idBid = (user.id_bidang || '').toUpperCase();

  // 1. Direct username / npp match
  if (username === 'kabid_dukbis' || username === 'kabid_dukungan_bisnis' || npp === '21500') {
    return true;
  }

  // 2. Explicit tipe_management == 'kepala_bidang' and BDG-01
  if (user.tipe_management === 'kepala_bidang' && (idBid === 'BDG-01' || bid.includes('dukungan bisnis'))) {
    return true;
  }

  // 3. Specific Jabatan containing "Kepala" / "Kabid" / "Head" AND "Dukungan Bisnis"
  const isDukbisJab = jab.includes('dukungan bisnis') || jab.includes('dukbis') || jab.includes('fungsi umum');
  const isKepalaJab = jab.includes('kepala bidang') || jab.includes('kabid') || jab.includes('kepala') || jab.includes('head');

  if (isDukbisJab && isKepalaJab) {
    return true;
  }

  // 4. User is in Bidang Dukungan Bisnis (BDG-01) and has a leadership title or is management in BDG-01
  const isDukbisBidang = idBid === 'BDG-01' || bid.includes('dukungan bisnis');
  if (isDukbisBidang && (isKepalaJab || user.role === 'management')) {
    return true;
  }

  return false;
}

/**
 * Checks if a user is Staff PUMA (Pengadaan Umum dan Manajemen Aset - Tingkat Pusat)
 */
export function isStaffPuma(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.role === 'puma') return true;
  const username = (user.username || '').toLowerCase().trim();
  const jab = (user.jabatan || '').toLowerCase();
  const bid = (user.nama_bidang || '').toLowerCase();
  return (
    username === 'puma' || 
    username.includes('staff_puma') || 
    jab.includes('puma') || 
    jab.includes('pengadaan umum dan manajemen aset') || 
    bid.includes('puma') ||
    bid.includes('pengadaan umum dan manajemen aset')
  );
}
