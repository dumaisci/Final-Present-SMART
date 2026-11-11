import mongoose from 'mongoose';
import { User, Aset, Assignment, RiwayatKalibrasi, Pengajuan, AuditLog, SmtpConfig, EmailLog, Bidang, Cabang } from '../types';

export interface DbSchema {
  cabangs: Cabang[];
  bidang: Bidang[];
  users: User[];
  asets: Aset[];
  assignments: Assignment[];
  kalibrasi: RiwayatKalibrasi[];
  pengajuan: Pengajuan[];
  auditLogs: AuditLog[];
  smtpConfig: SmtpConfig;
  emailLogs: EmailLog[];
}

export const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://fatwasembiring8_db_user:r1Kywd6sXIwPCoim@smart.xnh2obj.mongodb.net/smart?retryWrites=true&w=majority';

// Schemas for MongoDB Atlas
const GenericSchema = new mongoose.Schema({}, { strict: false });
const SystemStateSchema = new mongoose.Schema({
  key: String,
  data: mongoose.Schema.Types.Mixed
}, { timestamps: true, strict: false });

// Counter Schema for atomic sequential ID generation
const CounterSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true },
  seq: { type: Number, default: 0 }
});
export const CounterModel: mongoose.Model<any> = mongoose.models.Counter || mongoose.model('Counter', CounterSchema);

// Strict Schema for Cabang (Branch)
const CabangSchema = new mongoose.Schema({
  id_cabang: { type: String, required: true, unique: true, index: true },
  kode_cabang: { type: String, required: true, uppercase: true, trim: true },
  nama_cabang: { type: String, required: true, trim: true },
  alamat: { type: String, default: '' },
  kontak: { type: String, default: '' },
  status: { type: String, enum: ['Active', 'Inactive'], default: 'Active' },
  created_at: { type: String, default: () => new Date().toISOString() },
  updated_at: { type: String, default: () => new Date().toISOString() }
}, { timestamps: false, strict: true });
export const CabangModel: mongoose.Model<any> = mongoose.models.Cabang || mongoose.model('Cabang', CabangSchema);

// Strict Schema for Aset
const AsetSchema = new mongoose.Schema({
  id_aset: { type: String, required: true, unique: true, index: true },
  asset_number: { type: String, default: '' },
  tag_number: { type: String, default: '' },
  nama: { type: String, required: true },
  kategori: {
    type: String,
    enum: [
      'Tanah',
      'Bangunan',
      'Perlengkapan/Mesin Gedung',
      'Peralatan Operasi',
      'Kendaraan',
      'Peralatan/Prabot Kantor',
      'Peralatan Sistem Informasi'
    ],
    required: true
  },
  id_cabang: { type: String, default: '', index: true },
  nama_cabang: { type: String, default: '' },
  tgl_perolehan: { type: String, default: '' },
  tahun_perolehan: { type: Number, required: true },
  spesifikasi: { type: String, default: '-' },
  merk_model: { type: String, default: '-' },
  nomor_seri: { type: String, default: '-' },
  lokasi_awal: { type: String, default: '' },
  lokasi_sekarang: { type: String, default: '' },
  kondisi: {
    type: String,
    enum: ['Baik', 'Rusak Ringan', 'Rusak Berat', 'Hilang'],
    default: 'Baik'
  },
  status: {
    type: String,
    enum: ['Digunakan', 'Tersedia', 'Dalam Pemeliharaan', 'Dipinjamkan', 'Proses Disposal', 'Disposal', 'Tidak Tersedia'],
    default: 'Tersedia'
  },
  id_bidang_sekarang: { type: String, default: '' },
  nama_bidang_sekarang: { type: String, default: '' },
  id_pic_sekarang: { type: String, default: '' },
  nama_pic_sekarang: { type: String, default: '' },
  nama_pemegang_terakhir: { type: String, default: '' },
  tgl_pemutakhiran_pemegang: { type: String, default: '' },
  lokasi_pemakaian_lapangan: { type: String, default: '' },
  qr_code: { type: String, default: '' },
  tgl_kalibrasi_terakhir: { type: String, default: '' },
  tgl_kalibrasi_berikutnya: { type: String, default: '' },
  sertifikat_kalibrasi_no: { type: String, default: '' },
  tgl_rencana_pengembalian: { type: String, default: '' },
  tgl_notifikasi_terlambat_terakhir: { type: String, default: '' },
  // PUMA vs Cabang Procurement & Acceptance
  sumber_aset: { type: String, enum: ['PUMA', 'Cabang'], default: 'Cabang' },
  jenis_pengadaan: { type: String, enum: ['Investasi', 'Project Cabang'], default: 'Project Cabang' },
  status_penerimaan: { type: String, enum: ['Menunggu Penerimaan', 'Diterima'], default: 'Diterima' },
  diterima_oleh: { type: String, default: '' },
  tgl_diterima: { type: String, default: '' },
  catatan_penerimaan: { type: String, default: '' },
  // Operational utilization
  basis_operasi: { type: String, enum: ['Working Day Based', 'Continuous Operation'], default: 'Working Day Based' },
  waktu_mulai_operasi: { type: String, default: '' },
  waktu_mulai_pemeliharaan: { type: String, default: '' },
  riwayat_operasi: { type: Array, default: [] },
  riwayat_pemeliharaan_jam: { type: Array, default: [] },
  // Bukti Fisik Selesai Digunakan (Digunakan -> Tersedia)
  foto_pengembalian_terakhir: { type: String, default: '' },
  lokasi_pengembalian_terakhir: { type: String, default: '' },
  koordinat_gps_terakhir: { type: Object, default: null },
  // Nilai Perolehan (Integer Rupiah)
  nilai_perolehan: { type: Number, default: null },
  nomor_order_aktif: { type: String, default: null },
  created_at: { type: String, default: () => new Date().toISOString() },
  updated_at: { type: String, default: () => new Date().toISOString() }
}, { timestamps: false, strict: false });

// Strict Schema for User
const UserSchema = new mongoose.Schema({
  id: { type: String, required: true, unique: true, index: true },
  npp: { type: String, default: '' },
  username: { type: String, default: '' },
  password: { type: String, default: '' },
  nama: { type: String, required: true },
  email: { type: String, required: true },
  role: {
    type: String,
    enum: ['puma', 'admin', 'pic_bidang', 'management', 'pimpinan'],
    default: 'pic_bidang'
  },
  id_cabang: { type: String, default: '', index: true },
  nama_cabang: { type: String, default: '' },
  id_bidang: { type: String, default: '' },
  nama_bidang: { type: String, default: '' },
  jabatan: { type: String, default: '' },
  avatarUrl: { type: String, default: '' },
  isOnline: { type: Boolean, default: false },
  mustChangePassword: { type: Boolean, default: false },
  lastActive: { type: String, default: '' },
  updated_at: { type: String, default: () => new Date().toISOString() }
}, { timestamps: false, strict: false });

// Strict Schema for Pengajuan
const PengajuanSchema = new mongoose.Schema({
  id_pengajuan: { type: String, required: true, unique: true, index: true },
  id_aset: { type: String, required: true, index: true },
  nama_aset: { type: String, default: '' },
  id_cabang: { type: String, default: '', index: true },
  nama_cabang: { type: String, default: '' },
  jenis: {
    type: String,
    enum: ['Transfer', 'Disposal', 'Pemutakhiran Lapangan', 'Pengajuan Pemakaian', 'Peminjaman Aset', 'Pengembalian Aset (Selesai Pakai)'],
    required: true
  },
  id_bidang_asal: { type: String, default: '' },
  nama_bidang_asal: { type: String, default: '' },
  id_bidang_tujuan: { type: String, default: '' },
  nama_bidang_tujuan: { type: String, default: '' },
  id_pic_tujuan: { type: String, default: '' },
  nama_pic_tujuan: { type: String, default: '' },
  kondisi_baru: {
    type: String,
    enum: ['Baik', 'Rusak Ringan', 'Rusak Berat', 'Hilang', '']
  },
  lokasi_baru: { type: String, default: '' },
  status_baru: {
    type: String,
    enum: ['Digunakan', 'Tersedia', 'Dalam Pemeliharaan', 'Dipinjamkan', 'Proses Disposal', 'Disposal', 'Tidak Tersedia', '']
  },
  pemegang_baru: { type: String, default: '' },
  tgl_rencana_pengembalian: { type: String, default: '' },
  nomor_order: { type: String, default: null },
  alasan: { type: String, required: true },
  // Bukti Fisik Selesai Digunakan
  foto_pengembalian: { type: String, default: '' },
  lokasi_pengembalian: { type: String, default: '' },
  koordinat_gps: { type: Object, default: null },
  status_approval: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected'],
    default: 'Pending',
    required: true
  },
  pemohon_id: { type: String, required: true },
  pemohon_nama: { type: String, required: true },
  approver_id: { type: String, default: '' },
  approver_nama: { type: String, default: '' },
  catatan_approver: { type: String, default: '' },
  created_at: { type: String, default: () => new Date().toISOString() },
  updated_at: { type: String, default: () => new Date().toISOString() }
}, { timestamps: false, strict: true });

// Strict Schema for Kalibrasi
const KalibrasiSchema = new mongoose.Schema({
  id_kalibrasi: { type: String, required: true, unique: true, index: true },
  id_aset: { type: String, required: true, index: true },
  nama_aset: { type: String, default: '' },
  id_cabang: { type: String, default: '', index: true },
  nama_cabang: { type: String, default: '' },
  tanggal: { type: String, required: true },
  lembaga_kalibrasi: { type: String, required: true },
  nomor_sertifikat: { type: String, required: true },
  jatuh_tempo_berikutnya: { type: String, required: true },
  kondisi_setelah: {
    type: String,
    enum: ['Baik', 'Rusak Ringan', 'Rusak Berat', 'Hilang'],
    required: true
  },
  sertifikat_filename: { type: String, default: '' },
  pic_input: { type: String, required: true },
  catatan: { type: String, default: '' }
}, { timestamps: false, strict: true });

// Strict Schema for Assignment
const AssignmentSchema = new mongoose.Schema({
  id_assignment: { type: String, required: true, unique: true, index: true },
  id_aset: { type: String, required: true, index: true },
  nama_aset: { type: String, default: '' },
  id_cabang: { type: String, default: '', index: true },
  nama_cabang: { type: String, default: '' },
  id_bidang: { type: String, required: true },
  nama_bidang: { type: String, default: '' },
  id_pic: { type: String, required: true },
  nama_pic: { type: String, default: '' },
  pemegang_lapangan: { type: String, default: '' },
  tanggal_serah: { type: String, default: () => new Date().toISOString().split('T')[0] },
  keterangan: { type: String, default: '' },
  status: {
    type: String,
    enum: ['Aktif', 'Selesai', 'Dibatalkan'],
    default: 'Aktif',
    required: true
  },
  diserah_oleh: { type: String, default: '' }
}, { timestamps: false, strict: true });

// Strict Schema for AuditLog
const AuditLogSchema = new mongoose.Schema({
  id_log: { type: String, required: true, unique: true, index: true },
  id_aset: { type: String, default: '' },
  nama_aset: { type: String, default: '' },
  id_cabang: { type: String, default: '', index: true },
  nama_cabang: { type: String, default: '' },
  aktor: { type: String, required: true },
  role_aktor: { type: String, required: true },
  waktu: { type: String, default: () => new Date().toISOString() },
  jenis_perubahan: {
    type: String,
    enum: [
      'Create Aset',
      'Update Status',
      'Assignment',
      'Update Kalibrasi',
      'Ajukan Transfer',
      'Ajukan Disposal',
      'Approve Request',
      'Reject Request',
      'Delete Aset',
      'User Login'
    ],
    required: true
  },
  detail: { type: String, required: true }
}, { timestamps: false, strict: true });

// Strict Schema for Bidang
const BidangSchema = new mongoose.Schema({
  id_bidang: { type: String, required: true, unique: true, index: true },
  id_cabang: { type: String, default: '', index: true },
  nama_cabang: { type: String, default: '' },
  nama_bidang: { type: String, required: true },
  jenis: {
    type: String,
    enum: ['Bidang', 'Unit Pelayanan'],
    required: true
  },
  pic_utama: { type: String, default: '' },
  kontak: { type: String, default: '' },
  lokasi_kantor: { type: String, default: '' }
}, { timestamps: false, strict: true });

// Strict Schema for EmailLog
const EmailLogSchema = new mongoose.Schema({
  id_email: { type: String, required: true, unique: true, index: true },
  id_aset: { type: String, default: '' },
  nama_aset: { type: String, default: '' },
  milestone: { type: String, required: true },
  recipient: { type: String, required: true },
  subject: { type: String, required: true },
  status: { type: String, enum: ['SENT', 'FAILED'], required: true },
  sent_at: { type: String, required: true },
  error_message: { type: String, default: '' }
}, { timestamps: true, strict: true });

// Strict Schema for Proyeksi Pendapatan Aset
const ProyeksiPendapatanSchema = new mongoose.Schema({
  aset_id: { type: String, required: true, index: true },
  tahun: { type: Number, required: true },
  nilai: { type: Number, required: true },
  diinput_oleh: { type: String, required: true },
  diinput_pada: { type: String, default: () => new Date().toISOString() }
}, { collection: 'proyeksi_pendapatan_aset', timestamps: false, strict: true });

ProyeksiPendapatanSchema.index({ aset_id: 1, tahun: 1 }, { unique: true });

// Strict Schema for Orders (Modul Data Order)
const OrderSchema = new mongoose.Schema({
  nomor_order: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
  nama_order: { type: String, default: '' },
  nilai_order: { type: Number, required: true },
  dibuat_oleh: { type: String, required: true },
  dibuat_pada: { type: String, default: () => new Date().toISOString() }
}, { collection: 'orders', timestamps: false, strict: true });

OrderSchema.index({ nomor_order: 1 }, { unique: true });

export const UserModel: mongoose.Model<any> = mongoose.models.User || mongoose.model('User', UserSchema);
export const AsetModel: mongoose.Model<any> = mongoose.models.Aset || mongoose.model('Aset', AsetSchema);
export const ProyeksiPendapatanModel: mongoose.Model<any> = mongoose.models.ProyeksiPendapatan || mongoose.model('ProyeksiPendapatan', ProyeksiPendapatanSchema, 'proyeksi_pendapatan_aset');
export const OrderModel: mongoose.Model<any> = mongoose.models.Order || mongoose.model('Order', OrderSchema, 'orders');
export const AssignmentModel: mongoose.Model<any> = mongoose.models.Assignment || mongoose.model('Assignment', AssignmentSchema);

// Initial Seed Script for Sample Orders
export async function seedSampleOrders(): Promise<void> {
  const sampleOrders = [
    {
      nomor_order: 'ORD-2026-00123',
      nama_order: 'Inspeksi Fabrikasi Boiler & Pressure Vessel PT Energi Makmur',
      nilai_order: 10000000,
      dibuat_oleh: 'System Administrator (Fungsi UMUM)',
      dibuat_pada: '2026-01-15T08:30:00.000Z'
    },
    {
      nomor_order: 'ORD-2026-00124',
      nama_order: 'Pengujian Non-Destructive Testing (NDT) Pipeline Gas Pertamina',
      nilai_order: 25000000,
      dibuat_oleh: 'System Administrator (Fungsi UMUM)',
      dibuat_pada: '2026-02-10T09:15:00.000Z'
    },
    {
      nomor_order: 'ORD-2026-00125',
      nama_order: 'Kalibrasi Thickness Gauge & Pressure Vessel Wilayah Operasi',
      nilai_order: 4000000,
      dibuat_oleh: 'System Administrator (Fungsi UMUM)',
      dibuat_pada: '2026-03-01T10:00:00.000Z'
    }
  ];

  for (const ord of sampleOrders) {
    try {
      await OrderModel.findOneAndUpdate(
        { nomor_order: ord.nomor_order },
        { $setOnInsert: ord },
        { upsert: true, new: true }
      );
    } catch (e) {
      // Ignore unique index collision on concurrent run
    }
  }
}
export const KalibrasiModel: mongoose.Model<any> = mongoose.models.Kalibrasi || mongoose.model('Kalibrasi', KalibrasiSchema);
export const PengajuanModel: mongoose.Model<any> = mongoose.models.Pengajuan || mongoose.model('Pengajuan', PengajuanSchema);
export const AuditLogModel: mongoose.Model<any> = mongoose.models.AuditLog || mongoose.model('AuditLog', AuditLogSchema);
export const BidangModel: mongoose.Model<any> = mongoose.models.Bidang || mongoose.model('Bidang', BidangSchema);
export const SystemStateModel: mongoose.Model<any> = mongoose.models.SystemState || mongoose.model('SystemState', SystemStateSchema);
export const EmailLogModel: mongoose.Model<any> = mongoose.models.EmailLog || mongoose.model('EmailLog', EmailLogSchema);

// Helper for atomic sequential User ID generation
export async function generateNextUserId(): Promise<string> {
  const counter = await CounterModel.findOneAndUpdate(
    { id: 'user_counter' },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  let seq = counter.seq;
  const existingUsers = await UserModel.find({}, { id: 1 }).lean();
  const existingIds = new Set(existingUsers.map((u: any) => u.id));

  let generatedId = `USR-${String(seq).padStart(2, '0')}`;
  while (existingIds.has(generatedId)) {
    seq++;
    generatedId = `USR-${String(seq).padStart(2, '0')}`;
  }

  if (seq !== counter.seq) {
    await CounterModel.updateOne({ id: 'user_counter' }, { $set: { seq } });
  }

  return generatedId;
}

// Helper for atomic sequential Asset ID generation
export async function generateNextAsetId(tahun?: number): Promise<string> {
  const currentYear = tahun || new Date().getFullYear();
  const counterKey = `aset_${currentYear}`;

  let counterDoc = await CounterModel.findOne({ id: counterKey });
  if (!counterDoc) {
    const yearPrefix = `AST-DUM-${currentYear}-`;
    const existingAsets = await AsetModel.find({ id_aset: { $regex: `^${yearPrefix}` } }).lean();
    let maxNum = 0;
    for (const a of existingAsets) {
      if (a.id_aset && typeof a.id_aset === 'string') {
        const parts = a.id_aset.split('-');
        const lastPart = parts[parts.length - 1];
        const num = parseInt(lastPart, 10);
        if (!isNaN(num) && num > maxNum) {
          maxNum = num;
        }
      }
    }
    await CounterModel.updateOne(
      { id: counterKey },
      { $setOnInsert: { seq: maxNum } },
      { upsert: true }
    );
  }

  const updatedCounter = await CounterModel.findOneAndUpdate(
    { id: counterKey },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );

  const seqStr = String((updatedCounter as any)?.seq || 1).padStart(3, '0');
  return `AST-DUM-${currentYear}-${seqStr}`;
}

// Helper for direct AuditLog creation in MongoDB Atlas
export async function createAuditLogDirect(log: {
  aktor: string;
  role_aktor: string;
  jenis_perubahan: string;
  detail: string;
  id_aset?: string;
  nama_aset?: string;
}) {
  if (!isMongoConnected || mongoose.connection.readyState !== 1) return;
  try {
    const id_log = `LOG-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    await AuditLogModel.create({
      id_log,
      waktu: new Date().toISOString(),
      ...log
    });
  } catch (err) {
    console.error('Error creating audit log in MongoDB:', err);
  }
}

export let isMongoConnected = false;
export let mongoConnectionError: string | null = null;

let activeConnectPromise: Promise<boolean> | null = null;

// Listen to Mongoose connection lifecycle events
if (mongoose.connection) {
  mongoose.connection.on('connected', () => {
    isMongoConnected = true;
    mongoConnectionError = null;
  });
  mongoose.connection.on('error', (err) => {
    isMongoConnected = false;
    mongoConnectionError = err?.message || String(err);
  });
  mongoose.connection.on('disconnected', () => {
    isMongoConnected = false;
  });
}

export function deduplicateUsers(users: any[]): User[] {
  if (!users || !Array.isArray(users)) return [];
  const result: any[] = [];

  for (const rawUser of users) {
    if (!rawUser) continue;
    const u = { ...rawUser };
    delete u._id;
    delete u.__v;

    const uId = u.id ? String(u.id).trim().toLowerCase() : '';
    const uUsername = u.username ? String(u.username).trim().toLowerCase() : '';
    const uNpp = u.npp ? String(u.npp).trim().toLowerCase() : '';
    const uEmail = u.email ? String(u.email).trim().toLowerCase() : '';

    if (!uId && !uUsername && !uNpp && !uEmail && !u.nama) continue;

    const existingIndex = result.findIndex(ex => {
      const exId = ex.id ? String(ex.id).trim().toLowerCase() : '';
      const exUsername = ex.username ? String(ex.username).trim().toLowerCase() : '';
      const exNpp = ex.npp ? String(ex.npp).trim().toLowerCase() : '';
      const exEmail = ex.email ? String(ex.email).trim().toLowerCase() : '';

      return (
        (uUsername && exUsername && uUsername === exUsername) ||
        (uId && exId && uId === exId) ||
        (uNpp && exNpp && uNpp === exNpp) ||
        (uEmail && exEmail && uEmail === exEmail)
      );
    });

    if (existingIndex === -1) {
      result.push(u);
    } else {
      const ex = result[existingIndex];
      result[existingIndex] = {
        ...ex,
        ...u,
        id: ex.id || u.id,
        username: ex.username || u.username,
        role: u.role || ex.role,
        npp: ex.npp || u.npp,
        email: ex.email || u.email,
        password: ex.password || u.password,
        id_bidang: ex.id_bidang || u.id_bidang,
        nama_bidang: ex.nama_bidang || u.nama_bidang
      };
    }
  }

  return result;
}

export function deduplicateAsets(asets: any[]): Aset[] {
  if (!asets || !Array.isArray(asets)) return [];
  const map = new Map<string, any>();
  for (const a of asets) {
    if (!a) continue;
    const clean = { ...a };
    delete clean._id;
    delete clean.__v;

    const key = String(a.id_aset || a.qr_code || a.nama_aset || a.nama || '').trim().toLowerCase();
    if (!key) continue;
    map.set(key, clean);
  }
  return Array.from(map.values());
}

export function deduplicateAssignments(list: any[]): Assignment[] {
  if (!list || !Array.isArray(list)) return [];
  const map = new Map<string, any>();
  for (const item of list) {
    if (!item) continue;
    const clean = { ...item };
    delete clean._id;
    delete clean.__v;

    let key = String(item.id_assignment || '').trim();
    if (!key) {
      const part1 = item.id_aset || '';
      const part2 = item.id_pic || item.nama_pic || item.id_pic_sekarang || item.nama_pic_sekarang || '';
      const part3 = item.tanggal_serah || item.created_at || item.tanggal || '';
      if (part1 || part2 || part3) {
        key = `${part1}_${part2}_${part3}`.trim().toLowerCase();
      } else {
        key = JSON.stringify(clean);
      }
    } else {
      key = key.toLowerCase();
    }
    if (!key) continue;
    map.set(key, clean);
  }
  return Array.from(map.values());
}

export function deduplicateKalibrasi(list: any[]): RiwayatKalibrasi[] {
  if (!list || !Array.isArray(list)) return [];
  const map = new Map<string, any>();
  for (const item of list) {
    if (!item) continue;
    const clean = { ...item };
    delete clean._id;
    delete clean.__v;

    let key = String(item.id_kalibrasi || '').trim();
    if (!key) {
      const part1 = item.id_aset || '';
      const part2 = item.tanggal || item.tgl_kalibrasi || '';
      const part3 = item.nomor_sertifikat || item.sertifikat_no || item.lembaga_kalibrasi || '';
      if (part1 || part2 || part3) {
        key = `${part1}_${part2}_${part3}`.trim().toLowerCase();
      } else {
        key = JSON.stringify(clean);
      }
    } else {
      key = key.toLowerCase();
    }
    if (!key) continue;
    map.set(key, clean);
  }
  return Array.from(map.values());
}

export function deduplicatePengajuan(list: any[]): Pengajuan[] {
  if (!list || !Array.isArray(list)) return [];
  const map = new Map<string, any>();
  for (const item of list) {
    if (!item) continue;
    const clean = { ...item };
    delete clean._id;
    delete clean.__v;

    let key = String(item.id_pengajuan || '').trim();
    if (!key) {
      const part1 = item.id_aset || '';
      const part2 = item.pemohon_id || item.pemohon_nama || '';
      const part3 = item.created_at || item.alasan || '';
      if (part1 || part2 || part3) {
        key = `${part1}_${part2}_${part3}`.trim().toLowerCase();
      } else {
        key = JSON.stringify(clean);
      }
    } else {
      key = key.toLowerCase();
    }
    if (!key) continue;
    map.set(key, clean);
  }
  return Array.from(map.values());
}

export function deduplicateAuditLogs(list: any[]): AuditLog[] {
  if (!list || !Array.isArray(list)) return [];
  const map = new Map<string, any>();
  for (const item of list) {
    if (!item) continue;
    const clean = { ...item };
    delete clean._id;
    delete clean.__v;

    let key = String(item.id_log || '').trim();
    if (!key) {
      const part1 = item.waktu || '';
      const part2 = item.aktor || '';
      const part3 = item.jenis_perubahan || item.detail || '';
      if (part1 || part2 || part3) {
        key = `${part1}_${part2}_${part3}`.trim().toLowerCase();
      } else {
        key = JSON.stringify(clean);
      }
    } else {
      key = key.toLowerCase();
    }
    if (!key) continue;
    map.set(key, clean);
  }
  return Array.from(map.values());
}

export function deduplicateCabang(list: any[]): Cabang[] {
  if (!list || !Array.isArray(list)) return [];
  const map = new Map<string, any>();
  for (const item of list) {
    if (!item) continue;
    const clean = { ...item };
    delete clean._id;
    delete clean.__v;
    const key = String(item.id_cabang || item.kode_cabang || '').trim().toLowerCase();
    if (!key) continue;
    map.set(key, clean);
  }
  return Array.from(map.values());
}

export function deduplicateBidang(list: any[]): Bidang[] {
  if (!list || !Array.isArray(list)) return [];
  const map = new Map<string, any>();
  for (const item of list) {
    if (!item) continue;
    const clean = { ...item };
    delete clean._id;
    delete clean.__v;
    const key = String(item.id_bidang || item.nama_bidang || '').trim().toLowerCase();
    if (!key) continue;
    map.set(key, clean);
  }
  return Array.from(map.values());
}

export function getEmptyDbData(): DbSchema {
  return {
    cabangs: [],
    bidang: [],
    users: [],
    asets: [],
    assignments: [],
    kalibrasi: [],
    pengajuan: [],
    auditLogs: [],
    smtpConfig: {
      host: 'smtp.gmail.com',
      port: 587,
      secure: false,
      user: '',
      pass: '',
      fromName: 'SMART SCI - Sistem Monitoring Aset Real - Time',
      fromEmail: '',
      defaultRecipient: '',
      enabled: false
    },
    emailLogs: []
  };
}
export const getInitialSeedData = getEmptyDbData;

export async function connectMongoDB(): Promise<boolean> {
  // If already connected, return true immediately
  if (mongoose.connection.readyState === 1) {
    isMongoConnected = true;
    mongoConnectionError = null;
    return true;
  }

  // If a connection attempt is already in progress, await the existing promise
  if (activeConnectPromise) {
    return activeConnectPromise;
  }

  activeConnectPromise = (async () => {
    try {
      mongoose.set('strictQuery', false);
      
      // If mongoose was in a broken state (readyState === 3 disconnecting), wait briefly
      if (mongoose.connection.readyState === 3) {
        await new Promise(resolve => setTimeout(resolve, 300));
      }

      await mongoose.connect(MONGODB_URI, {
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
        dbName: 'smart',
      });

      isMongoConnected = true;
      mongoConnectionError = null;
      console.log('✅ Successfully connected to MongoDB Atlas database!');
      return true;
    } catch (err: any) {
      mongoConnectionError = err?.message || String(err);
      console.error('❌ MongoDB Atlas Connection Error:', mongoConnectionError);
      isMongoConnected = false;
      return false;
    } finally {
      activeConnectPromise = null;
    }
  })();

  return activeConnectPromise;
}

export async function generateNextCabangId(): Promise<string> {
  try {
    const counter = await CounterModel.findOneAndUpdate(
      { id: 'cabang_seq' },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const seq = counter.seq;
    return `CBG-${String(seq).padStart(3, '0')}`;
  } catch (err) {
    const count = await CabangModel.countDocuments();
    return `CBG-${String(count + 1).padStart(3, '0')}`;
  }
}

export async function generateNextBidangId(id_cabang?: string): Promise<string> {
  try {
    const cleanCabang = id_cabang ? id_cabang.replace(/[^a-zA-Z0-9]/g, '') : '';
    const key = cleanCabang ? `bidang_seq_${cleanCabang}` : 'bidang_seq_global';
    const counter = await CounterModel.findOneAndUpdate(
      { id: key },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const seq = counter.seq;
    let candidate = cleanCabang ? `BDG-${cleanCabang}-${String(seq).padStart(2, '0')}` : `BDG-${String(seq).padStart(2, '0')}`;
    
    // Safety verification against any rare collision
    let exists = await BidangModel.findOne({ id_bidang: candidate }).lean();
    let attempt = 0;
    while (exists && attempt < 10) {
      attempt++;
      candidate = cleanCabang ? `BDG-${cleanCabang}-${String(seq + attempt).padStart(2, '0')}` : `BDG-${String(seq + attempt).padStart(2, '0')}`;
      exists = await BidangModel.findOne({ id_bidang: candidate }).lean();
    }
    return candidate;
  } catch (err) {
    const count = await BidangModel.countDocuments();
    return `BDG-${count + 1}-${Date.now().toString().slice(-3)}`;
  }
}

export async function fetchDbFromMongo(): Promise<DbSchema | null> {
  const connected = await connectMongoDB();
  if (!connected || mongoose.connection.readyState !== 1) {
    console.warn('⚠️ MongoDB Atlas is not connected. Preserving memory state.');
    return null;
  }

  try {
    const sysDoc: any = await SystemStateModel.findOne({ key: 'system_state' } as any).lean();
    const sysData = (sysDoc && sysDoc.data) ? (sysDoc.data as DbSchema) : null;

    // Fetch actual data from native MongoDB collections. If collection is empty, it stays empty.
    const existingCabangs = (await CabangModel.find().lean()) as any[];
    const existingUsers = (await UserModel.find().lean()) as any[];
    const existingAsets = (await AsetModel.find().lean()) as any[];
    const existingAssignments = (await AssignmentModel.find().lean()) as any[];
    const existingKalibrasi = (await KalibrasiModel.find().lean()) as any[];
    const existingPengajuan = (await PengajuanModel.find().lean()) as any[];
    const existingLogs = (await AuditLogModel.find().lean()) as any[];
    const existingBidang = (await BidangModel.find().lean()) as any[];

    const mergedCabangs = deduplicateCabang(existingCabangs || []);
    const mergedUsers = deduplicateUsers(existingUsers || []);
    const mergedAsets = deduplicateAsets(existingAsets || []);
    const mergedAssignments = deduplicateAssignments(existingAssignments || []);
    const mergedKalibrasi = deduplicateKalibrasi(existingKalibrasi || []);
    const mergedPengajuan = deduplicatePengajuan(existingPengajuan || []);
    const mergedLogs = deduplicateAuditLogs(existingLogs || []);
    const mergedBidang = deduplicateBidang(existingBidang || []);

    let existingEmailLogs: any[] = [];
    try {
      existingEmailLogs = await EmailLogModel.find().sort({ createdAt: -1 }).limit(200).lean();
    } catch (e) {}

    const restoredData: DbSchema = {
      cabangs: mergedCabangs,
      bidang: mergedBidang,
      users: mergedUsers,
      asets: mergedAsets,
      assignments: mergedAssignments,
      kalibrasi: mergedKalibrasi,
      pengajuan: mergedPengajuan,
      auditLogs: mergedLogs,
      smtpConfig: sysData?.smtpConfig || {
        host: 'smtp.gmail.com',
        port: 587,
        secure: false,
        user: '',
        pass: '',
        fromName: 'SMART SCI - Sistem Monitoring Aset Real - Time',
        fromEmail: '',
        defaultRecipient: '',
        enabled: false
      },
      emailLogs: existingEmailLogs || []
    };

    return restoredData;
  } catch (err: any) {
    console.error('Error reading from MongoDB Atlas:', err);
    return null;
  }
}

export async function persistDbToMongo(dbData: DbSchema): Promise<boolean> {
  const connected = await connectMongoDB();
  if (!connected) {
    console.error('❌ Cannot persist data: MongoDB Atlas is disconnected.');
    return false;
  }

  try {
    // Deprecated: SystemState document no longer stores transactional snapshots (asets, kalibrasi, pengajuan, etc.).
    // All transactional data operations write directly to native MongoDB collections.
    if (dbData.smtpConfig || dbData.emailLogs) {
      const updatePayload: any = {};
      if (dbData.smtpConfig) updatePayload['data.smtpConfig'] = dbData.smtpConfig;
      if (dbData.emailLogs) updatePayload['data.emailLogs'] = dbData.emailLogs;

      await SystemStateModel.updateOne(
        { key: 'system_state' },
        { $set: updatePayload },
        { upsert: true }
      );
    }
    return true;
  } catch (err: any) {
    console.error('Failed to sync system_state in MongoDB Atlas:', err);
    return false;
  }
}
