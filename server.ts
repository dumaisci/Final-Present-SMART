import express from 'express';
import path from 'path';
import nodemailer from 'nodemailer';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import mongoose from 'mongoose';

async function hashPassword(plain?: string): Promise<string> {
  const pwd = plain || 'password123';
  return bcrypt.hash(pwd, 10);
}

async function comparePassword(plain: string, stored?: string): Promise<boolean> {
  if (!stored) return plain === 'password123';
  if (stored.startsWith('$2a$') || stored.startsWith('$2b$')) {
    return bcrypt.compare(plain, stored);
  }
  return plain === stored;
}
import { createServer as createViteServer } from 'vite';
import { Aset, Pengajuan, RiwayatKalibrasi, Assignment, AuditLog, User, SmtpConfig, EmailLog, Bidang, Cabang, BasisOperasiAset, AssetUtilizationStats } from './src/types';
import { 
  hitungAlokasiOrder, 
  hitungPendapatanRiilAset, 
  SesiOperasiInput 
} from './src/lib/utilisasi/alokasiPendapatan';
import {
  hitungMetrikUtilisasiAset,
  agregasikanMetrik,
  getKapasitasBrutoStandar,
  MetrikAsetPeriode
} from './src/lib/utilisasi/metrikUtilisasi';
import { 
  MONGODB_URI,
  connectMongoDB, 
  fetchDbFromMongo, 
  persistDbToMongo, 
  isMongoConnected, 
  mongoConnectionError,
  getEmptyDbData,
  deduplicateUsers,
  deduplicateAsets,
  deduplicateAssignments,
  deduplicateKalibrasi,
  deduplicatePengajuan,
  deduplicateAuditLogs,
  deduplicateBidang,
  deduplicateCabang,
  DbSchema,
  AsetModel,
  AssignmentModel,
  KalibrasiModel,
  PengajuanModel,
  AuditLogModel,
  UserModel,
  BidangModel,
  CabangModel,
  SystemStateModel,
  EmailLogModel,
  ProyeksiPendapatanModel,
  OrderModel,
  seedSampleOrders,
  generateNextAsetId,
  generateNextUserId,
  generateNextCabangId,
  generateNextBidangId,
  createAuditLogDirect
} from './src/db/mongoService';

let db: DbSchema = getEmptyDbData();

// JWT Authentication Secret
const JWT_SECRET = process.env.JWT_SECRET || 'sucofindo-jwt-secret-key-2026';

// Helper to extract authenticated user from Authorization header
function getUserFromReq(req: express.Request): { id?: string; username?: string; role?: string; nama?: string; id_cabang?: string; id_bidang?: string; jabatan?: string; [key: string]: any } | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  try {
    const decoded: any = jwt.verify(token, JWT_SECRET);
    return decoded;
  } catch (e) {
    return null;
  }
}

// Zod Input Validation Schemas
const loginSchema = z.object({
  username: z.string().optional(),
  userId: z.string().optional(),
  password: z.string().optional()
});

const changePasswordSchema = z.object({
  userId: z.string().min(1, 'userId wajib diisi'),
  oldPassword: z.string().min(1, 'Password lama wajib diisi'),
  newPassword: z.string().min(4, 'Password baru minimal 4 karakter')
});

const createUserSchema = z.object({
  nama: z.string().min(1, 'Nama PIC/Pengguna wajib diisi'),
  email: z.string().email('Format email tidak valid').min(1, 'Email wajib diisi'),
  npp: z.string().optional(),
  username: z.string().optional(),
  password: z.string().optional(),
  role: z.enum(['puma', 'admin', 'management', 'pimpinan', 'pic_bidang', 'admin_bidang']).optional(),
  tipe_management: z.enum(['kepala_cabang', 'kepala_bidang']).optional(),
  id_cabang: z.string().optional(),
  nama_cabang: z.string().optional(),
  id_bidang: z.string().optional(),
  nama_bidang: z.string().optional(),
  jabatan: z.string().optional()
});

const createAsetSchema = z.object({
  nama: z.string().min(1, 'Nama aset wajib diisi'),
  kategori: z.string().min(1, 'Kategori aset wajib diisi'),
  asset_number: z.string().optional(),
  tag_number: z.string().optional(),
  tgl_perolehan: z.string().optional(),
  tahun_perolehan: z.union([z.number(), z.string()]).optional(),
  spesifikasi: z.string().optional(),
  merk_model: z.string().optional(),
  nomor_seri: z.string().optional(),
  lokasi_awal: z.string().optional(),
  id_bidang: z.string().optional(),
  id_pic: z.string().optional(),
  status: z.string().optional(),
  tgl_kalibrasi_terakhir: z.string().optional(),
  tgl_kalibrasi_berikutnya: z.string().optional(),
  sertifikat_kalibrasi_no: z.string().optional(),
  nilai_perolehan: z.union([z.number(), z.string()]).optional(),
  actorName: z.string().optional(),
  actorRole: z.string().optional()
}).passthrough();

const createPengajuanSchema = z.object({
  id_aset: z.string().min(1, 'ID Aset wajib diisi'),
  jenis: z.string().min(1, 'Jenis pengajuan wajib diisi'),
  alasan: z.string().min(1, 'Alasan pengajuan wajib diisi'),
  id_bidang_tujuan: z.string().optional(),
  id_pic_tujuan: z.string().optional(),
  pemohon_id: z.string().optional(),
  pemohon_nama: z.string().optional(),
  pemegang_baru: z.string().optional(),
  kondisi_baru: z.string().optional(),
  lokasi_baru: z.string().optional(),
  status_baru: z.string().optional()
}).passthrough();

// Zod Validation Middleware Helper
const validateBody = (schema: z.ZodSchema) => (req: express.Request, res: express.Response, next: express.NextFunction) => {
  const parseResult = schema.safeParse(req.body);
  if (!parseResult.success) {
    const errorDetails = parseResult.error.issues.map(err => `${err.path.join('.') || 'body'}: ${err.message}`).join(', ');
    return res.status(400).json({
      success: false,
      message: `Validasi Input (Zod) Gagal: ${errorDetails}`,
      errors: parseResult.error.format()
    });
  }
  req.body = parseResult.data;
  next();
};

// Server-side Pagination Helper Function
function paginateData<T>(req: express.Request, items: T[]) {
  const pageParam = req.query.page as string;
  const limitParam = req.query.limit as string;

  if (pageParam && limitParam) {
    const page = Math.max(1, parseInt(pageParam, 10) || 1);
    const limit = Math.max(1, parseInt(limitParam, 10) || 20);
    const total = items.length;
    const totalPages = Math.ceil(total / limit);
    const startIndex = (page - 1) * limit;
    const data = items.slice(startIndex, startIndex + limit);

    return {
      success: true,
      data,
      pagination: {
        total,
        page,
        limit,
        totalPages
      }
    };
  }

  return { success: true, count: items.length, data: items };
}

let hasInitialSyncCompleted = false;
let isSyncing = false;

// Save state to MongoDB Atlas (DISABLED to prevent bulk collection overwrites)
async function saveDb() {
  // Deprecated & disabled: persistDbToMongo/saveDb bulk overwrites are disabled.
}

// Reload state from MongoDB Atlas
async function syncDbFromMongo() {
  if (isSyncing) return;
  isSyncing = true;
  try {
    const latestData = await fetchDbFromMongo();
    if (latestData) {
      db = latestData;
      console.log(`✅ Synced with MongoDB Atlas: ${db.asets.length} assets, ${db.assignments.length} assignments, ${db.pengajuan.length} pengajuan.`);
    }
    // Seed sample orders if not already present
    await seedSampleOrders();
  } catch (err) {
    console.error('Error in syncDbFromMongo:', err);
  } finally {
    hasInitialSyncCompleted = true;
    isSyncing = false;
  }
}

export const app = express();

app.use(express.json());

// CORS Middleware to allow requests from client app and preview environments
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Lazy DB connection middleware for serverless / Vercel environments
app.use(async (req, res, next) => {
  if (!hasInitialSyncCompleted) {
    try {
      const connected = await connectMongoDB();
      if (connected) {
        await syncDbFromMongo();
      } else {
        hasInitialSyncCompleted = true;
      }
    } catch (err) {
      console.error('Lazy DB connect error:', err);
      hasInitialSyncCompleted = true;
    }
  }
  next();
});

// Log Audit Helper
function addAuditLog(
  aktor: string, 
  role_aktor: string, 
  jenis_perubahan: AuditLog['jenis_perubahan'], 
  detail: string,
  id_aset?: string,
  nama_aset?: string
) {
  const newLog: AuditLog = {
    id_log: `LOG-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    id_aset,
    nama_aset,
    aktor,
    role_aktor,
    waktu: new Date().toISOString(),
    jenis_perubahan,
    detail
  };
  db.auditLogs.unshift(newLog);
  createAuditLogDirect({
    aktor,
    role_aktor,
    jenis_perubahan,
    detail,
    id_aset,
    nama_aset
  });
  return newLog;
}

// Helper to calculate asset utilization rate based on Actual Operating Time / Available Time
// Cut-off: H-1 (yesterday 23:59:59 / start of today 00:00:00)
// Available Time:
//  - Working Day Based: 8h/day on workdays (40h/week, 176h/month) minus maintenance hours
//  - Continuous Operation: 24h/day (168h/week, 720h/month) minus maintenance hours
function computeAssetUtilization(aset: any): AssetUtilizationStats {
  const now = new Date();
  const yesterdayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const yesterdayEndTime = yesterdayEnd.getTime();

  const basis = (aset.basis_operasi as BasisOperasiAset) || 'Working Day Based';
  const isContinuous = basis === 'Continuous Operation';

  const opSessions: Array<{ mulai: string; selesai: string; durasi_jam: number }> = Array.isArray(aset.riwayat_operasi) ? aset.riwayat_operasi : [];
  const maintSessions: Array<{ mulai: string; selesai: string; durasi_jam: number }> = Array.isArray(aset.riwayat_pemeliharaan_jam) ? aset.riwayat_pemeliharaan_jam : [];

  const sumDuration = (sessions: any[], startMs: number, endMs: number) => {
    return sessions.reduce((sum, s) => {
      const sTime = new Date(s.selesai || s.mulai).getTime();
      if (!isNaN(sTime) && sTime < endMs && sTime >= startMs) {
        return sum + (Number(s.durasi_jam) || 0);
      }
      return sum;
    }, 0);
  };

  // 1. Weekly: 7 days prior to today
  const sevenDaysAgoMs = yesterdayEndTime - (7 * 24 * 60 * 60 * 1000);
  const actualHoursWeek = Number(sumDuration(opSessions, sevenDaysAgoMs, yesterdayEndTime).toFixed(1));
  const maintHoursWeek = Number(sumDuration(maintSessions, sevenDaysAgoMs, yesterdayEndTime).toFixed(1));
  const baseAvailWeek = isContinuous ? (7 * 24) : (5 * 8); // 168h vs 40h
  const availWeek = Math.max(1, baseAvailWeek - maintHoursWeek);
  const rateWeek = Math.min(100, Number(((actualHoursWeek / availWeek) * 100).toFixed(1)));

  // 2. Monthly: 30 days prior to today
  const thirtyDaysAgoMs = yesterdayEndTime - (30 * 24 * 60 * 60 * 1000);
  const actualHoursMonth = Number(sumDuration(opSessions, thirtyDaysAgoMs, yesterdayEndTime).toFixed(1));
  const maintHoursMonth = Number(sumDuration(maintSessions, thirtyDaysAgoMs, yesterdayEndTime).toFixed(1));
  const baseAvailMonth = isContinuous ? (30 * 24) : (22 * 8); // 720h vs 176h
  const availMonth = Math.max(1, baseAvailMonth - maintHoursMonth);
  const rateMonth = Math.min(100, Number(((actualHoursMonth / availMonth) * 100).toFixed(1)));

  // 3. All-time: From commissioning up to H-1
  const commissionDate = new Date(aset.tgl_perolehan || aset.created_at || now);
  const startAllTimeMs = isNaN(commissionDate.getTime()) ? (yesterdayEndTime - (30 * 86400000)) : commissionDate.getTime();
  const totalDays = Math.max(1, Math.ceil((yesterdayEndTime - startAllTimeMs) / (24 * 60 * 60 * 1000)));
  const actualHoursAll = Number(sumDuration(opSessions, startAllTimeMs, yesterdayEndTime).toFixed(1));
  const maintHoursAll = Number(sumDuration(maintSessions, startAllTimeMs, yesterdayEndTime).toFixed(1));
  const workDaysAll = Math.max(1, Math.round(totalDays * (5 / 7)));
  const baseAvailAll = isContinuous ? (totalDays * 24) : (workDaysAll * 8);
  const availAll = Math.max(1, baseAvailAll - maintHoursAll);
  const rateAll = Math.min(100, Number(((actualHoursAll / availAll) * 100).toFixed(1)));

  return {
    mingguan: { actualHours: actualHoursWeek, availableHours: availWeek, maintenanceHours: maintHoursWeek, rate: rateWeek },
    bulanan: { actualHours: actualHoursMonth, availableHours: availMonth, maintenanceHours: maintHoursMonth, rate: rateMonth },
    allTime: { actualHours: actualHoursAll, availableHours: availAll, maintenanceHours: maintHoursAll, rate: rateAll },
    basis,
    asOfDate: yesterdayEnd.toISOString().split('T')[0]
  };
}

  // --- API ROUTES ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', app: 'SUCOFINDO Asset Monitoring API', timestamp: new Date().toISOString() });
  });

  // Database Status check (MongoDB Atlas status)
  app.get('/api/db/status', (req, res) => {
    let host = 'smart.xnh2obj.mongodb.net';
    let dbName = 'smart';
    try {
      const parsed = new URL(MONGODB_URI.replace('mongodb+srv://', 'https://'));
      if (parsed.host) host = parsed.host;
      const pathDb = parsed.pathname.replace(/^\//, '');
      if (pathDb) dbName = pathDb;
    } catch {}

    res.json({
      success: true,
      mongoConnected: isMongoConnected,
      databaseName: dbName,
      host: host,
      connectionError: mongoConnectionError,
      records: {
        users: db.users.length,
        asets: db.asets.length,
        kalibrasi: db.kalibrasi.length,
        pengajuan: db.pengajuan.length,
        auditLogs: db.auditLogs.length
      }
    });
  });

  // Reconnect MongoDB Endpoint
  app.post('/api/db/reconnect', async (req, res) => {
    const connected = await connectMongoDB();
    if (connected) {
      const mongoData = await fetchDbFromMongo();
      if (mongoData && mongoData.users && mongoData.users.length) {
        db = mongoData;
      }
      return res.json({
        success: true,
        message: 'Berhasil terhubung ke MongoDB Atlas!',
        mongoConnected: true
      });
    } else {
      return res.status(400).json({
        success: false,
        message: mongoConnectionError || 'Gagal terhubung ke MongoDB Atlas.',
        mongoConnected: false,
        error: mongoConnectionError
      });
    }
  });

  // --- Cabang (Branch) Endpoints for Staff PUMA & Multi-Cabang ---
  app.get('/api/cabangs', async (req, res) => {
    try {
      const cabangDocs = await CabangModel.find().sort({ created_at: -1 }).lean();
      const cleanCabangs = deduplicateCabang((cabangDocs || []).map(({ _id, __v, ...rest }: any) => rest));
      db.cabangs = cleanCabangs;
      res.json({ success: true, count: cleanCabangs.length, data: cleanCabangs });
    } catch (err: any) {
      console.error('Error fetching cabangs:', err);
      res.json({ success: true, count: (db.cabangs || []).length, data: db.cabangs || [] });
    }
  });

  app.post('/api/cabangs', async (req, res) => {
    try {
      const { kode_cabang, nama_cabang, alamat, kontak, status } = req.body;
      if (!kode_cabang || !nama_cabang) {
        return res.status(400).json({ success: false, message: 'Kode cabang dan nama cabang wajib diisi' });
      }

      const cleanKode = String(kode_cabang).trim().toUpperCase();
      const cleanNama = String(nama_cabang).trim();

      const existing = await CabangModel.findOne({ kode_cabang: cleanKode }).lean();
      if (existing) {
        return res.status(400).json({ success: false, message: `Kode cabang '${cleanKode}' sudah digunakan` });
      }

      const id_cabang = await generateNextCabangId();
      const now = new Date().toISOString();
      const newCabang: Cabang = {
        id_cabang,
        kode_cabang: cleanKode,
        nama_cabang: cleanNama,
        alamat: alamat || '',
        kontak: kontak || '',
        status: status || 'Active',
        created_at: now,
        updated_at: now
      };

      await CabangModel.create(newCabang);
      db.cabangs = deduplicateCabang([newCabang, ...(db.cabangs || [])]);

      // Automatically initialize default 'Bidang Dukungan Bisnis' for this new branch so Fungsi UMUM can operate immediately
      const defaultBidangId = await generateNextBidangId(id_cabang);
      const defaultBidang: Bidang = {
        id_bidang: defaultBidangId,
        id_cabang,
        nama_cabang: cleanNama,
        nama_bidang: 'Bidang Dukungan Bisnis',
        jenis: 'Bidang',
        pic_utama: '-',
        kontak: kontak || '-',
        lokasi_kantor: `Kantor ${cleanNama}`
      };
      await BidangModel.create(defaultBidang);
      db.bidang = deduplicateBidang([...(db.bidang || []), defaultBidang]);

      addAuditLog('Staff PUMA', 'puma', 'Create Aset', `Membuat Cabang baru: ${cleanNama} (${cleanKode})`);

      res.json({ success: true, message: `Cabang ${cleanNama} berhasil dibuat`, data: newCabang });
    } catch (err: any) {
      console.error('Error creating cabang:', err);
      res.status(500).json({ success: false, message: err?.message || 'Gagal membuat cabang' });
    }
  });

  app.put('/api/cabangs/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { kode_cabang, nama_cabang, alamat, kontak, status } = req.body;
      const updateFields: any = { updated_at: new Date().toISOString() };
      if (kode_cabang) updateFields.kode_cabang = String(kode_cabang).trim().toUpperCase();
      if (nama_cabang) updateFields.nama_cabang = String(nama_cabang).trim();
      if (alamat !== undefined) updateFields.alamat = alamat;
      if (kontak !== undefined) updateFields.kontak = kontak;
      if (status) updateFields.status = status;

      const updatedDoc = await CabangModel.findOneAndUpdate({ id_cabang: id }, { $set: updateFields }, { new: true }).lean();
      if (!updatedDoc) {
        return res.status(404).json({ success: false, message: 'Cabang tidak ditemukan' });
      }

      const { _id, __v, ...clean } = updatedDoc as any;
      const idx = (db.cabangs || []).findIndex(c => c.id_cabang === id);
      if (idx !== -1) db.cabangs[idx] = clean;
      else (db.cabangs = db.cabangs || []).push(clean);

      if (nama_cabang) {
        BidangModel.updateMany({ id_cabang: id }, { $set: { nama_cabang: String(nama_cabang).trim() } }).catch(() => {});
        UserModel.updateMany({ id_cabang: id }, { $set: { nama_cabang: String(nama_cabang).trim() } }).catch(() => {});
        AsetModel.updateMany({ id_cabang: id }, { $set: { nama_cabang: String(nama_cabang).trim() } }).catch(() => {});
      }

      addAuditLog('Staff PUMA', 'puma', 'Update Status', `Memperbarui data Cabang: ${clean.nama_cabang}`);

      res.json({ success: true, message: 'Cabang berhasil diperbarui', data: clean });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Gagal memperbarui cabang' });
    }
  });

  app.delete('/api/cabangs/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const assetCount = await AsetModel.countDocuments({ id_cabang: id });
      if (assetCount > 0) {
        return res.status(400).json({ success: false, message: `Tidak dapat menghapus cabang: masih ada ${assetCount} aset yang terdaftar di cabang ini.` });
      }
      const userCount = await UserModel.countDocuments({ id_cabang: id, role: { $ne: 'puma' } });
      if (userCount > 0) {
        return res.status(400).json({ success: false, message: `Tidak dapat menghapus cabang: masih ada ${userCount} pengguna yang terdaftar di cabang ini.` });
      }

      const targetCabang = await CabangModel.findOne({ id_cabang: id }).lean();
      await CabangModel.deleteOne({ id_cabang: id });
      await BidangModel.deleteMany({ id_cabang: id });
      db.cabangs = (db.cabangs || []).filter(c => c.id_cabang !== id);
      db.bidang = (db.bidang || []).filter(b => b.id_cabang !== id);

      addAuditLog('Staff PUMA', 'puma', 'Delete Aset', `Menghapus Cabang: ${targetCabang?.nama_cabang || id}`);

      res.json({ success: true, message: 'Cabang berhasil dihapus' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Gagal menghapus cabang' });
    }
  });

  // --- Bidang (Department) Endpoints - Customizable per Cabang by Fungsi UMUM ---
  app.get('/api/bidang', async (req, res) => {
    try {
      const requester = getUserFromReq(req);
      const { cabang } = req.query;
      const filter: any = {};

      // Level check: Non-Puma users (Fungsi UMUM / PIC) are strictly restricted to their own branch
      let targetCabang = cabang;
      if (requester && requester.role !== 'puma' && requester.id_cabang && requester.id_cabang !== 'ALL') {
        targetCabang = requester.id_cabang;
      }

      if (targetCabang && typeof targetCabang === 'string' && targetCabang !== 'ALL') {
        filter.$or = [
          { id_cabang: targetCabang },
          { id_cabang: '' },
          { id_cabang: { $exists: false } }
        ];
      }
      const bidangDocs = await BidangModel.find(filter).lean();
      const cleanBidang = (bidangDocs || []).map(({ _id, __v, ...rest }: any) => rest);
      res.json({ success: true, data: cleanBidang });
    } catch (err: any) {
      console.error('Error fetching bidang from Mongoose:', err);
      res.json({ success: true, data: db.bidang || [] });
    }
  });

  app.post('/api/bidang', async (req, res) => {
    try {
      const requester = getUserFromReq(req);
      const { nama_bidang, jenis, pic_utama, kontak, lokasi_kantor, id_cabang, nama_cabang } = req.body;
      if (!nama_bidang) {
        return res.status(400).json({ success: false, message: 'Nama bidang wajib diisi' });
      }

      // Level restriction: Fungsi UMUM can only create bidangs in their own branch
      let targetCabangId = id_cabang || '';
      let resolvedNamaCabang = nama_cabang || '';

      if (requester && requester.role !== 'puma' && requester.id_cabang && requester.id_cabang !== 'ALL') {
        targetCabangId = requester.id_cabang;
      }

      if (targetCabangId && !resolvedNamaCabang) {
        const cDoc = await CabangModel.findOne({ id_cabang: targetCabangId }).lean();
        if (cDoc) resolvedNamaCabang = cDoc.nama_cabang;
      }

      const id_bidang = await generateNextBidangId(targetCabangId);
      const newBidang: Bidang = {
        id_bidang,
        id_cabang: targetCabangId,
        nama_cabang: resolvedNamaCabang,
        nama_bidang: String(nama_bidang).trim(),
        jenis: jenis || 'Bidang',
        pic_utama: pic_utama || '-',
        kontak: kontak || '-',
        lokasi_kantor: lokasi_kantor || '-'
      };

      await BidangModel.create(newBidang);
      db.bidang = deduplicateBidang([...(db.bidang || []), newBidang]);

      addAuditLog(requester?.nama || 'Fungsi UMUM', requester?.role || 'admin', 'Create Aset', `Menambahkan Bidang baru di ${resolvedNamaCabang || 'Cabang'}: ${newBidang.nama_bidang}`);

      res.json({ success: true, message: `Bidang ${newBidang.nama_bidang} berhasil ditambahkan`, data: newBidang });
    } catch (err: any) {
      console.error('Error creating bidang:', err);
      res.status(500).json({ success: false, message: err?.message || 'Gagal menambahkan bidang' });
    }
  });

  app.put('/api/bidang/:id', async (req, res) => {
    try {
      const requester = getUserFromReq(req);
      const { id } = req.params;
      const { nama_bidang, jenis, pic_utama, kontak, lokasi_kantor } = req.body;

      const existingDoc = await BidangModel.findOne({ id_bidang: id }).lean();
      if (!existingDoc) {
        return res.status(404).json({ success: false, message: 'Bidang tidak ditemukan' });
      }

      // Level restriction: Fungsi UMUM can only update bidangs in their own branch
      if (requester && requester.role !== 'puma' && requester.id_cabang && existingDoc.id_cabang && existingDoc.id_cabang !== requester.id_cabang) {
        return res.status(403).json({ success: false, message: 'Fungsi UMUM hanya berhak mengatur bidang di cabangnya sendiri.' });
      }

      const updateFields: any = {};
      if (nama_bidang) updateFields.nama_bidang = String(nama_bidang).trim();
      if (jenis) updateFields.jenis = jenis;
      if (pic_utama !== undefined) updateFields.pic_utama = pic_utama;
      if (kontak !== undefined) updateFields.kontak = kontak;
      if (lokasi_kantor !== undefined) updateFields.lokasi_kantor = lokasi_kantor;

      const updatedDoc = await BidangModel.findOneAndUpdate({ id_bidang: id }, { $set: updateFields }, { new: true }).lean();
      if (!updatedDoc) {
        return res.status(404).json({ success: false, message: 'Bidang tidak ditemukan' });
      }

      const { _id, __v, ...clean } = updatedDoc as any;
      const idx = (db.bidang || []).findIndex(b => b.id_bidang === id);
      if (idx !== -1) db.bidang[idx] = clean;
      else (db.bidang = db.bidang || []).push(clean);

      if (nama_bidang) {
        UserModel.updateMany({ id_bidang: id }, { $set: { nama_bidang: String(nama_bidang).trim() } }).catch(() => {});
        AsetModel.updateMany({ id_bidang_sekarang: id }, { $set: { nama_bidang_sekarang: String(nama_bidang).trim() } }).catch(() => {});
      }

      addAuditLog(requester?.nama || 'Fungsi UMUM', requester?.role || 'admin', 'Update Status', `Memperbarui Bidang: ${clean.nama_bidang}`);

      res.json({ success: true, message: 'Bidang berhasil diperbarui', data: clean });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Gagal memperbarui bidang' });
    }
  });

  app.delete('/api/bidang/:id', async (req, res) => {
    try {
      const requester = getUserFromReq(req);
      const { id } = req.params;

      const targetBidang = await BidangModel.findOne({ id_bidang: id }).lean();
      if (!targetBidang) {
        return res.status(404).json({ success: false, message: 'Bidang tidak ditemukan' });
      }

      // Level restriction: Fungsi UMUM can only delete bidangs in their own branch
      if (requester && requester.role !== 'puma' && requester.id_cabang && targetBidang.id_cabang && targetBidang.id_cabang !== requester.id_cabang) {
        return res.status(403).json({ success: false, message: 'Fungsi UMUM hanya berhak menghapus bidang di cabangnya sendiri.' });
      }

      const assetCount = await AsetModel.countDocuments({ id_bidang_sekarang: id });
      if (assetCount > 0) {
        return res.status(400).json({ success: false, message: `Tidak dapat menghapus bidang: terdapat ${assetCount} aset yang terdaftar di bidang ini.` });
      }
      const userCount = await UserModel.countDocuments({ id_bidang: id });
      if (userCount > 0) {
        return res.status(400).json({ success: false, message: `Tidak dapat menghapus bidang: terdapat ${userCount} pengguna yang terdaftar di bidang ini.` });
      }

      await BidangModel.deleteOne({ id_bidang: id });
      db.bidang = (db.bidang || []).filter(b => b.id_bidang !== id);

      addAuditLog(requester?.nama || 'Fungsi UMUM', requester?.role || 'admin', 'Delete Aset', `Menghapus Bidang: ${targetBidang?.nama_bidang || id}`);

      res.json({ success: true, message: 'Bidang berhasil dihapus' });
    } catch (err: any) {
      res.status(500).json({ success: false, message: err?.message || 'Gagal menghapus bidang' });
    }
  });

  // Helper function to dynamically calculate user online/offline status based on active timestamp (Inactivity > 5 mins = Offline)
  const ONLINE_THRESHOLD_MS = 5 * 60 * 1000;
  const updateOnlineStatuses = () => {
    const now = Date.now();
    db.users.forEach(u => {
      if (u.lastActive) {
        const lastActiveTime = new Date(u.lastActive).getTime();
        const shouldBeOnline = (now - lastActiveTime) < ONLINE_THRESHOLD_MS;
        if (u.isOnline !== shouldBeOnline) {
          u.isOnline = shouldBeOnline;
          UserModel.updateOne({ id: u.id }, { $set: { isOnline: shouldBeOnline } }).catch(() => {});
        }
      } else if (u.isOnline) {
        u.isOnline = false;
        UserModel.updateOne({ id: u.id }, { $set: { isOnline: false } }).catch(() => {});
      }
    });
  };

  // Users & Active Users (Admin real-time dashboard)
  app.get('/api/users', async (req, res) => {
    try {
      updateOnlineStatuses();
      const { cabang, role } = req.query;
      const filter: any = {};
      if (cabang && typeof cabang === 'string' && cabang !== 'ALL') {
        filter.$or = [
          { id_cabang: cabang },
          { id_cabang: 'ALL' },
          { id_cabang: '' },
          { id_cabang: { $exists: false } }
        ];
      }
      if (role && typeof role === 'string' && role !== 'ALL') {
        filter.role = role;
      }
      const usersFromDb = await UserModel.find(filter).sort({ updated_at: -1 }).lean();
      const cleanUsers = deduplicateUsers((usersFromDb || []).map(({ _id, __v, ...rest }: any) => rest));
      db.users = cleanUsers as any;
      const result = paginateData(req, cleanUsers);
      res.json(result);
    } catch (err: any) {
      console.error('Error fetching users from Mongoose:', err);
      const result = paginateData(req, db.users || []);
      res.json(result);
    }
  });

  // Auth Login Endpoint (Issues JWT Token, session expires in 2 hours = 7,200,000 ms)
  app.post('/api/auth/login', validateBody(loginSchema), async (req, res) => {
    const { username, password, userId } = req.body;
    
    const searchKey = String(username || userId || '').trim().toLowerCase();
    if (!searchKey) {
      return res.status(400).json({ success: false, message: 'Username / NPP wajib diisi' });
    }

    // Ensure MongoDB connection is active
    if (mongoose.connection.readyState !== 1) {
      await connectMongoDB();
    }

    // Strict Database Requirement: If MongoDB is not connected, reject login and show clear database error
    if (!isMongoConnected || mongoose.connection.readyState !== 1) {
      const errMsg = mongoConnectionError || 'Koneksi ke database MongoDB Atlas gagal / timeout.';
      return res.status(503).json({ 
        success: false, 
        message: `Database MongoDB belum terhubung (${errMsg}). Silakan pastikan MONGODB_URI di Environment Variables Vercel sudah diisi dan IP Whitelist pada MongoDB Atlas diatur ke 0.0.0.0/0.` 
      });
    }

    try {
      let user: any = await UserModel.findOne({
        $or: [
          { username: new RegExp(`^${searchKey}$`, 'i') },
          { npp: new RegExp(`^${searchKey}$`, 'i') },
          { email: new RegExp(`^${searchKey}$`, 'i') },
          { id: new RegExp(`^${searchKey}$`, 'i') }
        ]
      }).lean();

      if (!user) {
        if (searchKey === 'puma' || searchKey === 'staff_puma') {
          const hashedPass = await hashPassword(password || 'password123');
          const newPuma = await UserModel.create({
            id: 'USR-PUMA-01',
            npp: 'PUMA-01',
            username: 'puma',
            nama: 'Staff PUMA (Pusat)',
            email: 'puma@sucofindo.co.id',
            role: 'puma',
            id_cabang: 'ALL',
            nama_cabang: 'Kantor Pusat PUMA',
            id_bidang: 'BDG-PUMA',
            nama_bidang: 'Pengadaan Umum & Manajemen Aset',
            jabatan: 'Staff PUMA',
            password: hashedPass,
            mustChangePassword: false,
            isOnline: true
          });
          user = newPuma.toObject ? newPuma.toObject() : newPuma;
        } else {
          const countUsers = await UserModel.countDocuments();
          if (countUsers === 0 && searchKey === 'admin') {
            const hashedPass = await hashPassword(password || 'password123');
            const newAdmin = await UserModel.create({
              id: 'USR-001',
              npp: 'ADMIN',
              username: 'admin',
              nama: 'Administrator Fungsi UMUM',
              email: 'admin@sucofindo.co.id',
              role: 'admin',
              id_bidang: 'BDG-001',
              nama_bidang: 'Fungsi Dukungan Bisnis',
              jabatan: 'Administrator Cabang',
              password: hashedPass,
              mustChangePassword: false,
              isOnline: true
            });
            user = newAdmin.toObject ? newAdmin.toObject() : newAdmin;
          } else {
            return res.status(401).json({ success: false, message: 'Username atau NPP tidak terdaftar di database.' });
          }
        }
      }

      // Verify password
      if (password) {
        if (!(await comparePassword(password, user.password))) {
          return res.status(401).json({ success: false, message: 'Password salah. Silakan periksa password Anda.' });
        }
      }

      let mustChangePassword = user.mustChangePassword ?? false;
      let hashedPass = user.password;
      if (hashedPass && !hashedPass.startsWith('$2a$') && !hashedPass.startsWith('$2b$')) {
        hashedPass = await hashPassword(hashedPass);
      }

      const lastActive = new Date().toISOString();
      const updatedDbUser = await UserModel.findOneAndUpdate(
        { id: user.id },
        { $set: { isOnline: true, lastActive, password: hashedPass, mustChangePassword } },
        { new: true, upsert: true }
      ).lean();

      const { _id, __v, ...cleanUser } = (updatedDbUser || { ...user, isOnline: true, lastActive, password: hashedPass, mustChangePassword }) as any;

      // Sync memory cache
      const memoryIdx = db.users.findIndex(u => u.id === cleanUser.id);
      if (memoryIdx !== -1) {
        db.users[memoryIdx] = cleanUser;
      } else {
        db.users.push(cleanUser);
      }

      addAuditLog(cleanUser.nama, cleanUser.role, 'User Login', `Pengguna berhasil login ke sistem (Username: ${cleanUser.username || cleanUser.npp})`);

      const expiresInMs = 2 * 60 * 60 * 1000; // 2 Hours
      const expiresAt = Date.now() + expiresInMs;

      const token = jwt.sign(
        { 
          id: cleanUser.id, 
          username: cleanUser.username, 
          role: cleanUser.role,
          nama: cleanUser.nama,
          id_cabang: cleanUser.id_cabang 
        },
        JWT_SECRET,
        { expiresIn: '2h' }
      );

      return res.json({
        success: true,
        data: {
          token,
          user: cleanUser,
          expiresAt
        }
      });
    } catch (err: any) {
      console.error('Error in login:', err);
      return res.status(500).json({ 
        success: false, 
        message: 'Terjadi kesalahan database saat login: ' + (err?.message || String(err)) 
      });
    }
  });

  // User Session Heartbeat Endpoint
  app.post('/api/auth/heartbeat', async (req, res) => {
    const { userId } = req.body;
    if (userId) {
      const lastActive = new Date().toISOString();
      await UserModel.updateOne({ id: userId }, { $set: { isOnline: true, lastActive } }).catch(() => {});
      const user = db.users.find(u => u.id === userId);
      if (user) {
        user.isOnline = true;
        user.lastActive = lastActive;
      }
    }
    updateOnlineStatuses();
    res.json({ success: true });
  });

  // User Logout Endpoint
  app.post('/api/auth/logout', async (req, res) => {
    const { userId } = req.body;
    if (userId) {
      let user = await UserModel.findOne({ id: userId }).lean();
      if (!user) {
        user = db.users.find(u => u.id === userId) || null;
      }
      if (user) {
        await UserModel.updateOne(
          { id: user.id },
          { $set: { isOnline: false }, $unset: { lastActive: 1 } }
        ).catch(err => console.error('UserModel logout update error:', err));
        
        const memoryUser = db.users.find(u => u.id === user.id);
        if (memoryUser) {
          memoryUser.isOnline = false;
          memoryUser.lastActive = undefined;
        }
        addAuditLog(user.nama, user.role, 'User Login', `Pengguna logout dari sistem (Username: ${user.username || user.npp})`);
      }
    }
    res.json({ success: true, message: 'Berhasil logout' });
  });

  // Switch Active User / Role
  app.post('/api/auth/switch-role', async (req, res) => {
    const { userId } = req.body;
    let user = await UserModel.findOne({ id: userId }).lean();
    if (!user) {
      user = db.users.find(u => u.id === userId) || null;
    }
    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    const lastActive = new Date().toISOString();
    const updatedUser = await UserModel.findOneAndUpdate(
      { id: user.id },
      { $set: { isOnline: true, lastActive } },
      { new: true, upsert: true }
    ).lean() || { ...user, isOnline: true, lastActive };

    const memoryIdx = db.users.findIndex(u => u.id === user.id);
    if (memoryIdx !== -1) db.users[memoryIdx] = updatedUser;
    else db.users.push(updatedUser);

    const token = jwt.sign(
      { id: updatedUser.id, username: updatedUser.username, role: updatedUser.role, nama: updatedUser.nama, email: updatedUser.email },
      JWT_SECRET,
      { expiresIn: '2h' }
    );

    res.json({ success: true, user: updatedUser, token });
  });

  // Change Password Endpoint (Accessible by every user for their own account)
  app.post('/api/users/change-password', validateBody(changePasswordSchema), async (req, res) => {
    const { userId, oldPassword, newPassword } = req.body;

    let user = await UserModel.findOne({ id: userId }).lean();
    if (!user) {
      user = db.users.find(u => u.id === userId) || null;
    }
    if (!user) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
    }

    if (!(await comparePassword(oldPassword, user.password))) {
      return res.status(400).json({ success: false, message: 'Password lama yang dimasukkan salah' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password baru minimal 6 karakter' });
    }

    const hashedNewPass = await hashPassword(newPassword);
    const updated_at = new Date().toISOString();

    const updatedUser = await UserModel.findOneAndUpdate(
      { id: user.id },
      { $set: { password: hashedNewPass, mustChangePassword: false, updated_at } },
      { new: true, upsert: true }
    ).lean() || { ...user, password: hashedNewPass, mustChangePassword: false, updated_at };

    const memoryIdx = db.users.findIndex(u => u.id === user.id);
    if (memoryIdx !== -1) db.users[memoryIdx] = updatedUser;
    else db.users.push(updatedUser);

    addAuditLog(
      updatedUser.nama,
      updatedUser.role,
      'User Login',
      `Ganti Password Akun: User ${updatedUser.nama} [${updatedUser.username || updatedUser.npp}] berhasil memperbarui password.`
    );

    res.json({ success: true, message: 'Password berhasil diperbarui', user: updatedUser });
  });

  // Change Password PUT Endpoint
  app.put('/api/users/:id/password', async (req, res) => {
    const { id } = req.params;
    const { oldPassword, newPassword } = req.body;

    let user = await UserModel.findOne({ id }).lean();
    if (!user) {
      user = db.users.find(u => u.id === id) || null;
    }
    if (!user) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
    }

    if (!(await comparePassword(oldPassword, user.password))) {
      return res.status(400).json({ success: false, message: 'Password lama yang dimasukkan salah' });
    }

    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ success: false, message: 'Password baru minimal 6 karakter' });
    }

    const hashedNewPass = await hashPassword(newPassword);
    const updated_at = new Date().toISOString();

    const updatedUser = await UserModel.findOneAndUpdate(
      { id: user.id },
      { $set: { password: hashedNewPass, mustChangePassword: false, updated_at } },
      { new: true, upsert: true }
    ).lean() || { ...user, password: hashedNewPass, mustChangePassword: false, updated_at };

    const memoryIdx = db.users.findIndex(u => u.id === user.id);
    if (memoryIdx !== -1) db.users[memoryIdx] = updatedUser;
    else db.users.push(updatedUser);

    addAuditLog(
      updatedUser.nama,
      updatedUser.role,
      'User Login',
      `Ganti Password Akun: User ${updatedUser.nama} [${updatedUser.username || updatedUser.npp}] berhasil memperbarui password.`
    );

    res.json({ success: true, message: 'Password berhasil diperbarui', user: updatedUser });
  });

  // Admin Reset Password Endpoint (Resets user password to default: password123)
  app.post('/api/users/:id/reset-password', async (req, res) => {
    const { id } = req.params;
    let user = await UserModel.findOne({ id }).lean();
    if (!user) {
      user = db.users.find(u => u.id === id) || null;
    }
    if (!user) {
      return res.status(404).json({ success: false, message: 'Pengguna tidak ditemukan' });
    }

    const defaultHashedPass = await hashPassword('password123');
    const updated_at = new Date().toISOString();

    const updatedUser = await UserModel.findOneAndUpdate(
      { id: user.id },
      { $set: { password: defaultHashedPass, mustChangePassword: true, updated_at } },
      { new: true, upsert: true }
    ).lean() || { ...user, password: defaultHashedPass, mustChangePassword: true, updated_at };

    const memoryIdx = db.users.findIndex(u => u.id === user.id);
    if (memoryIdx !== -1) db.users[memoryIdx] = updatedUser;
    else db.users.push(updatedUser);

    addAuditLog(
      'Fungsi UMUM',
      'admin',
      'Update Status',
      `Reset Password Pengguna: Admin mereset password akun ${updatedUser.nama} (${updatedUser.username || updatedUser.npp}) ke default (password123).`
    );

    res.json({ 
      success: true, 
      message: `Password pengguna ${updatedUser.nama} berhasil direset ke default (password123). Pengguna wajib mengganti password saat login berikutnya.`,
      user: updatedUser 
    });
  });

  // Create New User / PIC (Fungsi Umum)
  app.post('/api/users', validateBody(createUserSchema), async (req, res) => {
    const { nama, email, npp, jabatan, role, tipe_management, id_bidang, nama_bidang, username, id_cabang, nama_cabang } = req.body;

    if (!nama || !email) {
      return res.status(400).json({ success: false, message: 'Nama dan Email PIC wajib diisi' });
    }

    const cleanEmail = email.trim().toLowerCase();
    const cleanUsername = (username || email.split('@')[0]).trim().toLowerCase();

    const existingUserDoc = await UserModel.findOne({
      $or: [
        { email: cleanEmail },
        { username: cleanUsername },
        ...(npp ? [{ npp }] : [])
      ]
    }).lean();

    if (existingUserDoc) {
      return res.status(400).json({
        success: false,
        message: `Pengguna dengan Email / Username (${cleanUsername}) tersebut sudah terdaftar (${existingUserDoc.nama}).`
      });
    }

    const newId = await generateNextUserId();

    let resolvedIdCabang = id_cabang || 'CBG-01';
    let resolvedNamaCabang = nama_cabang || '';

    if (role === 'puma') {
      resolvedIdCabang = 'ALL';
      resolvedNamaCabang = 'Kantor Pusat PUMA';
    } else if (resolvedIdCabang && !resolvedNamaCabang && resolvedIdCabang !== 'ALL') {
      const cDoc = await CabangModel.findOne({ id_cabang: resolvedIdCabang }).lean();
      if (cDoc) resolvedNamaCabang = cDoc.nama_cabang;
    }

    const newUserDoc = {
      id: newId,
      npp: npp || `${Math.floor(10000 + Math.random() * 90000)}`,
      username: cleanUsername,
      password: await hashPassword('password123'),
      mustChangePassword: true,
      nama,
      email,
      role: role || 'pic_bidang',
      tipe_management: (role === 'management' || role === 'pimpinan') ? (tipe_management || (jabatan?.toLowerCase().includes('kepala cabang') ? 'kepala_cabang' : 'kepala_bidang')) : undefined,
      id_cabang: resolvedIdCabang,
      nama_cabang: resolvedNamaCabang,
      id_bidang: id_bidang || 'BDG-01',
      nama_bidang: nama_bidang || 'Bidang Dukungan Bisnis',
      jabatan: jabatan || 'PIC Bidang',
      isOnline: false,
      lastActive: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    const createdUser = await UserModel.create(newUserDoc);
    const createdObj = createdUser.toObject ? createdUser.toObject() : newUserDoc;

    db.users.push(createdObj);

    addAuditLog(
      'Fungsi UMUM',
      'admin',
      'Create Aset',
      `Tambah Account PIC Baru: ${createdObj.nama} [${createdObj.email}] - Cabang: ${resolvedNamaCabang || resolvedIdCabang} - Username: ${createdObj.username} (Password default: password123)`
    );

    res.json({ success: true, data: createdObj, message: 'PIC / Pengguna baru berhasil ditambahkan with default password (password123)' });
  });

  // Update User / PIC Profile (Fungsi Umum)
  app.put('/api/users/:id', async (req, res) => {
    const { id } = req.params;
    const { nama, email, npp, jabatan, role, tipe_management, id_bidang, nama_bidang, username, id_cabang, nama_cabang } = req.body;

    let oldUser = await UserModel.findOne({ id }).lean();
    if (!oldUser) {
      oldUser = db.users.find(u => u.id === id) || null;
    }
    if (!oldUser) {
      return res.status(404).json({ success: false, message: 'User PIC tidak ditemukan' });
    }

    const oldNama = oldUser.nama;
    const updatePayload: any = {
      updated_at: new Date().toISOString()
    };
    if (nama !== undefined) updatePayload.nama = nama;
    if (email !== undefined) updatePayload.email = email;
    if (npp !== undefined) updatePayload.npp = npp;
    if (jabatan !== undefined) updatePayload.jabatan = jabatan;
    if (role !== undefined) updatePayload.role = role;
    if (tipe_management !== undefined) updatePayload.tipe_management = tipe_management;
    if (id_bidang !== undefined) updatePayload.id_bidang = id_bidang;
    if (nama_bidang !== undefined) updatePayload.nama_bidang = nama_bidang;
    if (username !== undefined) updatePayload.username = username;
    if (id_cabang !== undefined) {
      updatePayload.id_cabang = id_cabang;
      if (id_cabang === 'ALL') {
        updatePayload.nama_cabang = 'Kantor Pusat PUMA';
      } else if (!nama_cabang) {
        const cDoc = await CabangModel.findOne({ id_cabang }).lean();
        if (cDoc) updatePayload.nama_cabang = cDoc.nama_cabang;
      } else {
        updatePayload.nama_cabang = nama_cabang;
      }
    } else if (nama_cabang !== undefined) {
      updatePayload.nama_cabang = nama_cabang;
    }

    const updatedUser = await UserModel.findOneAndUpdate(
      { id },
      { $set: updatePayload },
      { new: true }
    ).lean() || { ...oldUser, ...updatePayload };

    const memoryIdx = db.users.findIndex(u => u.id === id);
    if (memoryIdx !== -1) {
      db.users[memoryIdx] = updatedUser;
    }

    // If name changed, update asset PIC names where id_pic_sekarang matches
    if (nama && nama !== oldNama) {
      db.asets.forEach(a => {
        if (a.id_pic_sekarang === id || a.nama_pic_sekarang === oldNama) {
          a.nama_pic_sekarang = nama;
        }
      });
      await AsetModel.updateMany(
        { $or: [{ id_pic_sekarang: id }, { nama_pic_sekarang: oldNama }] },
        { $set: { nama_pic_sekarang: nama } }
      ).catch(err => console.error('AsetModel pic name update error:', err));
    }

    addAuditLog(
      'Fungsi UMUM',
      'admin',
      'Update Status',
      `Memperbarui Data PIC: ${updatedUser.nama} (${updatedUser.email}) - Jabatan: ${updatedUser.jabatan}`
    );

    res.json({ success: true, data: updatedUser, message: 'Data PIC berhasil diperbarui' });
  });

  // Delete User / PIC (Fungsi Umum)
  app.delete('/api/users/:id', async (req, res) => {
    const { id } = req.params;

    let userToDelete = await UserModel.findOne({ id }).lean();
    if (!userToDelete) {
      userToDelete = db.users.find(u => u.id === id) || null;
    }
    if (!userToDelete) {
      return res.status(404).json({ success: false, message: 'User PIC tidak ditemukan' });
    }

    const totalCount = await UserModel.countDocuments();
    if (totalCount <= 1 && db.users.length <= 1) {
      return res.status(400).json({ success: false, message: 'Tidak dapat menghapus satu-satunya akun pengguna tersisa.' });
    }

    await UserModel.findOneAndDelete({ id });
    const memoryIdx = db.users.findIndex(u => u.id === id);
    if (memoryIdx !== -1) db.users.splice(memoryIdx, 1);

    addAuditLog(
      'Fungsi Umum',
      'admin',
      'Update Status',
      `Menghapus Akun PIC: ${userToDelete.nama} (${userToDelete.email}) - NPP: ${userToDelete.npp}`
    );

    res.json({ success: true, message: `Akun PIC ${userToDelete.nama} berhasil dihapus` });
  });

  // Statistics Endpoint for Dashboard
  app.get('/api/stats', async (req, res) => {
    try {
      let safeAsets: any[] = [];
      let safePengajuan: any[] = [];
      let safeBidang: any[] = [];

      if (isMongoConnected && mongoose.connection.readyState === 1) {
        try {
          const [asetsDocs, pengajuanDocs, bidangDocs] = await Promise.all([
            AsetModel.find().lean(),
            PengajuanModel.find().lean(),
            BidangModel.find().lean()
          ]);
          safeAsets = (asetsDocs || []).map(a => { const { _id, __v, ...clean } = a as any; return clean; });
          safePengajuan = (pengajuanDocs || []).map(p => { const { _id, __v, ...clean } = p as any; return clean; });
          safeBidang = (bidangDocs || []).map(b => { const { _id, __v, ...clean } = b as any; return clean; });

          // Keep in-memory cache in sync
          db.asets = safeAsets;
          db.pengajuan = safePengajuan;
          db.bidang = safeBidang;
        } catch (dbErr) {
          console.error('Error fetching stats from MongoDB, falling back to memory:', dbErr);
          safeAsets = (db.asets || []).filter(Boolean);
          safePengajuan = (db.pengajuan || []).filter(Boolean);
          safeBidang = (db.bidang || []).filter(Boolean);
        }
      } else {
        safeAsets = (db.asets || []).filter(Boolean);
        safePengajuan = (db.pengajuan || []).filter(Boolean);
        safeBidang = (db.bidang || []).filter(Boolean);
      }

      const totalAset = safeAsets.length;
      const digunakan = safeAsets.filter(a => a?.status === 'Digunakan').length;
      const tersedia = safeAsets.filter(a => a?.status === 'Tersedia' || a?.status === 'Idle' || a?.status === 'Selesai Pakai').length;
      const dalamPemeliharaan = safeAsets.filter(a => a?.status === 'Dalam Pemeliharaan' || a?.status === 'Maintenance').length;
      const dipinjamkan = safeAsets.filter(a => a?.status === 'Dipinjamkan').length;
      const prosesDisposal = safeAsets.filter(a => a?.status === 'Proses Disposal').length;
      const disposal = safeAsets.filter(a => a?.status === 'Disposal').length;
      const tidakTersedia = safeAsets.filter(a => a?.status === 'Tidak Tersedia').length;

      // Calibration alert calculation (within 30 days or overdue)
      const today = new Date();
      const alertWindow = new Date();
      alertWindow.setDate(today.getDate() + 30);

      const kalibrasiAlerts = safeAsets.filter(a => {
        if (!a || !a.tgl_kalibrasi_berikutnya) return false;
        const dueDate = new Date(a.tgl_kalibrasi_berikutnya);
        return !isNaN(dueDate.getTime()) && dueDate <= alertWindow && a.status !== 'Disposal' && a.status !== 'Proses Disposal';
      });

      const pengajuanPending = safePengajuan.filter(p => p?.status_approval === 'Pending').length;

      // Aset per bidang (Fungsi Umum is aggregated under Bidang Dukungan Bisnis)
      const normalizeBidang = (name?: string, id?: string) => {
        if (!name && !id) return 'Bidang Dukungan Bisnis';
        const lower = (name || '').toLowerCase();
        if (lower.includes('fungsi umum') || lower.includes('dukungan bisnis') || id === 'BDG-01') {
          return 'Bidang Dukungan Bisnis';
        }
        return name || 'Bidang Dukungan Bisnis';
      };

      const asetPerBidangMap: Record<string, number> = {};
      safeBidang.forEach(b => { 
        if (b?.nama_bidang) {
          const norm = normalizeBidang(b.nama_bidang, b.id_bidang);
          if (asetPerBidangMap[norm] === undefined) {
            asetPerBidangMap[norm] = 0;
          }
        }
      });
      if (asetPerBidangMap['Bidang Dukungan Bisnis'] === undefined) {
        asetPerBidangMap['Bidang Dukungan Bisnis'] = 0;
      }

      safeAsets.forEach(a => {
        if (a) {
          const norm = normalizeBidang(a.nama_bidang_sekarang, a.id_bidang_sekarang);
          asetPerBidangMap[norm] = (asetPerBidangMap[norm] || 0) + 1;
        }
      });

      const asetPerBidang = Object.entries(asetPerBidangMap).map(([nama_bidang, jumlah]) => ({
        nama_bidang,
        jumlah,
        persen: totalAset > 0 ? Math.round((jumlah / totalAset) * 100) : 0
      }));

      // Aset per kategori
      const katMap: Record<string, number> = {};
      safeAsets.forEach(a => {
        if (a?.kategori) {
          katMap[a.kategori] = (katMap[a.kategori] || 0) + 1;
        }
      });

      const asetPerKategori = Object.entries(katMap).map(([kategori, jumlah]) => ({
        kategori,
        jumlah
      }));

      const todayMid = new Date();
      todayMid.setHours(0, 0, 0, 0);

      const terlambatPengembalian = safeAsets.filter(a => {
        if (!a || a.status !== 'Digunakan' || !a.tgl_rencana_pengembalian) return false;
        const returnDate = new Date(a.tgl_rencana_pengembalian);
        if (isNaN(returnDate.getTime())) return false;
        returnDate.setHours(0, 0, 0, 0);
        const diffDays = Math.floor((todayMid.getTime() - returnDate.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays >= 1; // More than 1 day past return date
      }).length;

      return res.json({
        success: true,
        stats: {
          totalAset,
          digunakan,
          tersedia,
          dalamPemeliharaan,
          dipinjamkan,
          prosesDisposal,
          disposal,
          tidakTersedia,
          selesaiPakai: tersedia,
          idle: tersedia,
          maintenance: dalamPemeliharaan,
          terlambatPengembalian,
          butuhKalibrasiSegera: kalibrasiAlerts.length,
          pengajuanPending,
          asetPerBidang,
          asetPerKategori,
          kalibrasiAlerts
        }
      });
    } catch (err: any) {
      console.error('Error calculating /api/stats:', err);
      return res.json({
        success: true,
        stats: {
          totalAset: 0,
          digunakan: 0,
          idle: 0,
          maintenance: 0,
          disposal: 0,
          butuhKalibrasiSegera: 0,
          pengajuanPending: 0,
          asetPerBidang: [],
          asetPerKategori: [],
          kalibrasiAlerts: []
        }
      });
    }
  });

  // Utilization Rate Statistics Endpoint for Dashboard
  app.get('/api/stats/utilization', async (req, res) => {
    try {
      let safeAsets: any[] = [];
      let safeBidang: any[] = [];

      if (isMongoConnected && mongoose.connection.readyState === 1) {
        try {
          const [asetsDocs, bidangDocs] = await Promise.all([
            AsetModel.find().lean(),
            BidangModel.find().lean()
          ]);
          safeAsets = (asetsDocs || []).map(a => { const { _id, __v, ...clean } = a as any; return clean; });
          safeBidang = (bidangDocs || []).map(b => { const { _id, __v, ...clean } = b as any; return clean; });

          // Keep in-memory cache in sync
          db.asets = safeAsets;
          db.bidang = safeBidang;
        } catch (dbErr) {
          console.error('Error fetching utilization data from MongoDB, falling back to memory:', dbErr);
          safeAsets = (db.asets || []).filter(Boolean);
          safeBidang = (db.bidang || []).filter(Boolean);
        }
      } else {
        safeAsets = (db.asets || []).filter(Boolean);
        safeBidang = (db.bidang || []).filter(Boolean);
      }

      // Filter active assets (Exclude 'Disposal')
      const activeAsets = safeAsets.filter(a => a && a.status !== 'Disposal');
      const totalAktif = activeAsets.length;
      const totalDigunakan = activeAsets.filter(a => a.status === 'Digunakan').length;
      const overallRate = totalAktif > 0 ? Number(((totalDigunakan / totalAktif) * 100).toFixed(1)) : 0;

      // Normalization helper: Group Fungsi Umum under Bidang Dukungan Bisnis
      const normalizeBidang = (name?: string, id?: string) => {
        if (!name && !id) return 'Bidang Dukungan Bisnis';
        const lower = (name || '').toLowerCase();
        if (lower.includes('fungsi umum') || lower.includes('dukungan bisnis') || id === 'BDG-01') {
          return 'Bidang Dukungan Bisnis';
        }
        return name || 'Bidang Dukungan Bisnis';
      };

      // Breakdown per Bidang
      const bidangMap: Record<string, { digunakan: number; aktif: number }> = {};
      safeBidang.forEach(b => {
        if (b?.nama_bidang) {
          const norm = normalizeBidang(b.nama_bidang, b.id_bidang);
          if (!bidangMap[norm]) {
            bidangMap[norm] = { digunakan: 0, aktif: 0 };
          }
        }
      });
      if (!bidangMap['Bidang Dukungan Bisnis']) {
        bidangMap['Bidang Dukungan Bisnis'] = { digunakan: 0, aktif: 0 };
      }

      activeAsets.forEach(a => {
        const norm = normalizeBidang(a.nama_bidang_sekarang, a.id_bidang_sekarang);
        if (!bidangMap[norm]) {
          bidangMap[norm] = { digunakan: 0, aktif: 0 };
        }
        bidangMap[norm].aktif += 1;
        if (a.status === 'Digunakan') {
          bidangMap[norm].digunakan += 1;
        }
      });

      const perBidang = Object.entries(bidangMap).map(([bidang, counts]) => ({
        bidang,
        rate: counts.aktif > 0 ? Number(((counts.digunakan / counts.aktif) * 100).toFixed(1)) : 0,
        digunakan: counts.digunakan,
        aktif: counts.aktif
      }));

      // Breakdown per Kategori
      const kategoriMap: Record<string, { digunakan: number; aktif: number }> = {};
      activeAsets.forEach(a => {
        const kat = a.kategori || 'Peralatan/Prabot Kantor';
        if (!kategoriMap[kat]) {
          kategoriMap[kat] = { digunakan: 0, aktif: 0 };
        }
        kategoriMap[kat].aktif += 1;
        if (a.status === 'Digunakan') {
          kategoriMap[kat].digunakan += 1;
        }
      });

      const perKategori = Object.entries(kategoriMap).map(([kategori, counts]) => {
        const katLower = kategori.toLowerCase();
        const isStatic = katLower.includes('tanah') || katLower.includes('bangunan');
        return {
          kategori,
          rate: counts.aktif > 0 ? Number(((counts.digunakan / counts.aktif) * 100).toFixed(1)) : 0,
          static: isStatic,
          digunakan: counts.digunakan,
          aktif: counts.aktif
        };
      });

      // Aggregate Operational Assets Utilization (Peralatan Operasi)
      const opAssets = safeAsets.filter(a => a && a.kategori === 'Peralatan Operasi' && a.status !== 'Disposal');
      let totalActualWeek = 0;
      let totalAvailWeek = 0;
      let totalActualMonth = 0;
      let totalAvailMonth = 0;
      let totalActualAll = 0;
      let totalAvailAll = 0;

      opAssets.forEach(a => {
        const u = computeAssetUtilization(a);
        totalActualWeek += u.mingguan.actualHours;
        totalAvailWeek += u.mingguan.availableHours;
        totalActualMonth += u.bulanan.actualHours;
        totalAvailMonth += u.bulanan.availableHours;
        totalActualAll += u.allTime.actualHours;
        totalAvailAll += u.allTime.availableHours;
      });

      const operasionalStats = {
        totalAsetOperasi: opAssets.length,
        mingguan: {
          actualHours: Number(totalActualWeek.toFixed(1)),
          availableHours: Math.max(1, Number(totalAvailWeek.toFixed(1))),
          rate: totalAvailWeek > 0 ? Math.min(100, Number(((totalActualWeek / totalAvailWeek) * 100).toFixed(1))) : 0
        },
        bulanan: {
          actualHours: Number(totalActualMonth.toFixed(1)),
          availableHours: Math.max(1, Number(totalAvailMonth.toFixed(1))),
          rate: totalAvailMonth > 0 ? Math.min(100, Number(((totalActualMonth / totalAvailMonth) * 100).toFixed(1))) : 0
        },
        allTime: {
          actualHours: Number(totalActualAll.toFixed(1)),
          availableHours: Math.max(1, Number(totalAvailAll.toFixed(1))),
          rate: totalAvailAll > 0 ? Math.min(100, Number(((totalActualAll / totalAvailAll) * 100).toFixed(1))) : 0
        }
      };

      return res.json({
        success: true,
        overall: {
          rate: overallRate,
          digunakan: totalDigunakan,
          aktif: totalAktif
        },
        operasional: operasionalStats,
        perBidang,
        perKategori
      });
    } catch (err: any) {
      console.error('Error calculating /api/stats/utilization:', err);
      return res.status(500).json({
        success: false,
        error: err?.message || 'Gagal menghitung utilization stats',
        overall: { rate: 0, digunakan: 0, aktif: 0 },
        perBidang: [],
        perKategori: []
      });
    }
  });

  // Get list of Aset with filters & search
  app.get('/api/asets', async (req, res) => {
    try {
      const requester = getUserFromReq(req);
      const { search, status, bidang, kategori, kondisi, asset_number, tag_number, cabang, sumber_aset, status_penerimaan } = req.query;

      const filter: any = {};

      // Multi-tier Access Control:
      // 1. Staff PUMA (Pusat): Full visibility across all branches and can filter by investment/sumber_aset
      // 2. Cabang (Fungsi UMUM / Management): Strictly locked to their own branch
      // 3. Bidang (PIC Bidang): Strictly locked to their own branch AND their own bidang
      if (requester) {
        if (requester.role === 'puma') {
          if (cabang && typeof cabang === 'string' && cabang !== 'ALL' && cabang !== 'All') {
            filter.$or = [
              { id_cabang: cabang },
              { id_cabang: '' },
              { id_cabang: { $exists: false } }
            ];
          }
        } else {
          // Locked to branch
          if (requester.id_cabang) {
            filter.id_cabang = requester.id_cabang;
          }
          // PIC Bidang locked to their own department
          if (requester.role === 'pic_bidang' && requester.id_bidang) {
            filter.id_bidang_sekarang = requester.id_bidang;
          }
        }
      } else if (cabang && typeof cabang === 'string' && cabang !== 'ALL' && cabang !== 'All') {
        filter.$or = [
          { id_cabang: cabang },
          { id_cabang: '' },
          { id_cabang: { $exists: false } }
        ];
      }

      if (sumber_aset && typeof sumber_aset === 'string' && sumber_aset !== 'ALL') {
        filter.sumber_aset = sumber_aset;
      }

      if (status_penerimaan && typeof status_penerimaan === 'string' && status_penerimaan !== 'ALL') {
        filter.status_penerimaan = status_penerimaan;
      }

      if (search && typeof search === 'string' && search.trim()) {
        const q = search.trim();
        filter.$or = [
          { id_aset: { $regex: q, $options: 'i' } },
          { asset_number: { $regex: q, $options: 'i' } },
          { tag_number: { $regex: q, $options: 'i' } },
          { nama: { $regex: q, $options: 'i' } },
          { spesifikasi: { $regex: q, $options: 'i' } },
          { merk_model: { $regex: q, $options: 'i' } },
          { nomor_seri: { $regex: q, $options: 'i' } },
          { qr_code: { $regex: q, $options: 'i' } }
        ];
      }

      if (asset_number && typeof asset_number === 'string' && asset_number.trim()) {
        filter.asset_number = { $regex: asset_number.trim(), $options: 'i' };
      }

      if (tag_number && typeof tag_number === 'string' && tag_number.trim()) {
        filter.tag_number = { $regex: tag_number.trim(), $options: 'i' };
      }

      if (status && typeof status === 'string' && status !== 'All') {
        filter.status = status;
      }

      if (bidang && typeof bidang === 'string' && bidang !== 'All') {
        filter.id_bidang_sekarang = bidang;
      }

      if (kategori && typeof kategori === 'string' && kategori !== 'All') {
        filter.kategori = kategori;
      }

      if (kondisi && typeof kondisi === 'string' && kondisi !== 'All') {
        filter.kondisi = kondisi;
      }

      const allAsets = await AsetModel.find(filter).sort({ created_at: -1 }).lean();
      const cleanAsets = allAsets.map(a => {
        const { _id, __v, ...rest } = a as any;
        // Attach computed operational utilization stats (weekly, monthly, all-time with H-1 cut-off)
        rest.utilization = computeAssetUtilization(rest);
        return rest;
      });

      const result = paginateData(req, cleanAsets);
      return res.json(result);
    } catch (err: any) {
      console.error('Error fetching /api/asets:', err);
      return res.json({ success: true, count: 0, data: [] });
    }
  });

  // Get single Aset by ID or QR Code or Asset/Tag/Serial Number
  app.get('/api/asets/:id', async (req, res) => {
    try {
      const rawId = decodeURIComponent(req.params.id || '').trim();
      if (!rawId) {
        return res.status(400).json({ success: false, message: 'ID/Kode QR tidak valid' });
      }

      // Extract clean code if rawId is a URL
      let searchKey = rawId;
      if (rawId.startsWith('http://') || rawId.startsWith('https://')) {
        try {
          const url = new URL(rawId);
          searchKey = url.searchParams.get('code') || 
                      url.searchParams.get('id') || 
                      url.searchParams.get('qr') || 
                      url.searchParams.get('asset_number') ||
                      url.searchParams.get('tag_number') ||
                      url.pathname.split('/').filter(Boolean).pop() || rawId;
        } catch (e) {}
      }

      const escapedKey = searchKey.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const caseInsensitiveRegex = new RegExp(`^${escapedKey}$`, 'i');
      const containsRegex = new RegExp(escapedKey, 'i');

      // First try exact case-insensitive match on key fields
      let asetDoc = await AsetModel.findOne({
        $or: [
          { id_aset: { $regex: caseInsensitiveRegex } },
          { qr_code: { $regex: caseInsensitiveRegex } },
          { asset_number: { $regex: caseInsensitiveRegex } },
          { tag_number: { $regex: caseInsensitiveRegex } },
          { nomor_seri: { $regex: caseInsensitiveRegex } }
        ]
      }).lean();

      // If not found, try partial contains match as fallback
      if (!asetDoc) {
        asetDoc = await AsetModel.findOne({
          $or: [
            { id_aset: { $regex: containsRegex } },
            { qr_code: { $regex: containsRegex } },
            { asset_number: { $regex: containsRegex } },
            { tag_number: { $regex: containsRegex } },
            { nomor_seri: { $regex: containsRegex } }
          ]
        }).lean();
      }

      if (!asetDoc) {
        return res.status(404).json({ success: false, message: `Aset dengan kode "${searchKey}" tidak ditemukan.` });
      }

      const { _id, __v, ...aset } = asetDoc as any;

      const assignmentsDocs = await AssignmentModel.find({ id_aset: aset.id_aset }).lean();
      const kalibrasiDocs = await KalibrasiModel.find({ id_aset: aset.id_aset }).lean();
      const pengajuanDocs = await PengajuanModel.find({ id_aset: aset.id_aset }).lean();
      const proyeksiDocs = await ProyeksiPendapatanModel.find({ aset_id: aset.id_aset }).sort({ tahun: 1 }).lean();

      const assignments = assignmentsDocs.map(({ _id, __v, ...rest }: any) => rest);
      const kalibrasi = kalibrasiDocs.map(({ _id, __v, ...rest }: any) => rest);
      const pengajuan = pengajuanDocs.map(({ _id, __v, ...rest }: any) => rest);
      const proyeksi = proyeksiDocs.map(({ _id, __v, ...rest }: any) => rest);

      res.json({
        success: true,
        data: {
          ...aset,
          assignments,
          kalibrasi,
          pengajuan,
          proyeksi
        }
      });
    } catch (err: any) {
      console.error('Error fetching single asset:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Create new Asset Master Data (Fungsi Umum / Staff PUMA)
  app.post('/api/asets', validateBody(createAsetSchema), async (req, res) => {
    try {
      const requester = getUserFromReq(req);
      const { 
        nama, 
        kategori, 
        asset_number,
        tag_number,
        tgl_perolehan,
        tahun_perolehan, 
        spesifikasi, 
        merk_model, 
        nomor_seri, 
        lokasi_awal,
        id_bidang,
        id_pic,
        tgl_kalibrasi_terakhir,
        tgl_kalibrasi_berikutnya,
        sertifikat_kalibrasi_no,
        actorName = 'Petugas Asset',
        actorRole = 'admin'
      } = req.body;

      if (!nama || !kategori) {
        return res.status(400).json({ success: false, message: 'Nama aset dan kategori wajib diisi' });
      }

      const isPumaUser = requester?.role === 'puma' || actorRole === 'puma';

      // 1. If created by PUMA:
      // - sumber_aset: 'PUMA'
      // - jenis_pengadaan: 'Investasi'
      // - status_penerimaan: 'Menunggu Penerimaan' (will appear in branch once confirmed by Fungsi UMUM / Kabid Dukbis)
      // - asset_number & tag_number from pusat are strictly recorded
      // 2. If created by Cabang:
      // - sumber_aset: 'Cabang'
      // - jenis_pengadaan: 'Project Cabang'
      // - status_penerimaan: 'Diterima' (no approval needed, directly active in branch)
      // - asset_number & tag_number are optional
      const sumber_aset = isPumaUser ? 'PUMA' : 'Cabang';
      const jenis_pengadaan = isPumaUser ? 'Investasi' : 'Project Cabang';
      const status_penerimaan = isPumaUser ? 'Menunggu Penerimaan' : 'Diterima';
      const basis_operasi = req.body.basis_operasi || 'Working Day Based';

      let year = Number(tahun_perolehan);
      if (!year && tgl_perolehan) {
        const parsedYear = new Date(tgl_perolehan).getFullYear();
        if (!isNaN(parsedYear)) year = parsedYear;
      }
      if (!year) year = new Date().getFullYear();

      const newId = await generateNextAsetId(year);
      const qrCode = `SUCOFINDO-${newId}`;

      // Resolve Cabang for new asset
      let resolvedIdCabang = isPumaUser ? (req.body.id_cabang || '') : (requester?.id_cabang || req.body.id_cabang || '');
      let resolvedNamaCabang = req.body.nama_cabang || '';

      if (!resolvedIdCabang || resolvedIdCabang === 'ALL') {
        const firstCabang = await CabangModel.findOne().lean();
        if (firstCabang) {
          resolvedIdCabang = firstCabang.id_cabang;
          resolvedNamaCabang = firstCabang.nama_cabang;
        } else {
          resolvedIdCabang = 'CBG-001';
          resolvedNamaCabang = 'Kantor Cabang';
        }
      } else if (!resolvedNamaCabang) {
        const cDoc = await CabangModel.findOne({ id_cabang: resolvedIdCabang }).lean();
        if (cDoc) resolvedNamaCabang = cDoc.nama_cabang;
      }

      // Default PIC and Bidang initially assigned to Fungsi UMUM (Bidang Dukungan Bisnis)
      let bidangObj = db.bidang.find(b => b.id_cabang === resolvedIdCabang && (b.id_bidang === 'BDG-01' || b.nama_bidang.toLowerCase().includes('dukungan bisnis'))) ||
                      db.bidang.find(b => b.id_bidang === id_bidang) || 
                      db.bidang.find(b => b.id_cabang === resolvedIdCabang) ||
                      db.bidang[0];

      let userObj = db.users.find(u => u.id === id_pic) ||
                    db.users.find(u => u.id_cabang === resolvedIdCabang && (u.role === 'admin' || u.jabatan?.toLowerCase().includes('umum'))) ||
                    db.users.find(u => u.id === 'USR-01') ||
                    db.users[0];

      if (id_pic) {
        const uDoc = await UserModel.findOne({ id: id_pic }).lean();
        if (uDoc) userObj = uDoc as any;
        else {
          const memUser = db.users.find(u => u.id === id_pic);
          if (memUser) userObj = memUser;
        }
      }

      if (userObj && userObj.id_bidang) {
        const bMatch = db.bidang.find(b => b.id_bidang === userObj.id_bidang);
        if (bMatch) bidangObj = bMatch;
      }

      // Validate nilai_perolehan (Integer Rupiah)
      let parsedNilaiPerolehan: number | null = null;
      if (req.body.nilai_perolehan !== undefined && req.body.nilai_perolehan !== null && req.body.nilai_perolehan !== '') {
        const num = Math.round(Number(req.body.nilai_perolehan));
        if (isNaN(num) || num <= 0) {
          return res.status(400).json({ success: false, message: 'Nilai perolehan harus berupa bilangan bulat Rupiah lebih dari 0.' });
        }
        parsedNilaiPerolehan = num;
      }

      if (isPumaUser) {
        if (!parsedNilaiPerolehan || parsedNilaiPerolehan <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Nilai Perolehan (Rp) wajib diisi untuk aset investasi PUMA dan harus lebih dari 0.'
          });
        }
      }

      const newAsetDoc = {
        id_aset: newId,
        id_cabang: resolvedIdCabang,
        nama_cabang: resolvedNamaCabang,
        asset_number: asset_number || '',
        tag_number: tag_number || '',
        nama,
        kategori,
        tgl_perolehan: tgl_perolehan || `${year}-01-01`,
        tahun_perolehan: year,
        spesifikasi: spesifikasi || '-',
        merk_model: merk_model || '-',
        nomor_seri: nomor_seri || '-',
        lokasi_awal: lokasi_awal || bidangObj?.lokasi_kantor || `Kantor ${resolvedNamaCabang}`,
        lokasi_sekarang: lokasi_awal || bidangObj?.lokasi_kantor || `Kantor ${resolvedNamaCabang}`,
        kondisi: req.body.kondisi || 'Baik',
        status: req.body.status || 'Tersedia',
        id_bidang_sekarang: bidangObj?.id_bidang || 'BDG-01',
        nama_bidang_sekarang: bidangObj?.nama_bidang || 'Bidang Dukungan Bisnis',
        id_pic_sekarang: userObj?.id || 'USR-001',
        nama_pic_sekarang: userObj?.nama || 'Administrator Cabang',
        nama_pemegang_terakhir: req.body.nama_pemegang_terakhir || userObj?.nama || 'Administrator Cabang',
        qr_code: qrCode,
        tgl_kalibrasi_terakhir: tgl_kalibrasi_terakhir || '',
        tgl_kalibrasi_berikutnya: tgl_kalibrasi_berikutnya || '',
        sertifikat_kalibrasi_no: sertifikat_kalibrasi_no || '',
        // PUMA vs Cabang tracking
        sumber_aset,
        jenis_pengadaan,
        status_penerimaan,
        diterima_oleh: isPumaUser ? '' : `${actorName} (Cabang)`,
        tgl_diterima: isPumaUser ? '' : new Date().toISOString(),
        nilai_perolehan: parsedNilaiPerolehan,
        basis_operasi,
        waktu_mulai_operasi: '',
        waktu_mulai_pemeliharaan: '',
        riwayat_operasi: [],
        riwayat_pemeliharaan_jam: [],
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      await AsetModel.create(newAsetDoc);

      // Keep in-memory db synchronized as fallback
      db.asets.unshift(newAsetDoc as any);

      const auditMsg = isPumaUser
        ? `Staff PUMA menginput Aset Investasi baru [${newId}] ${nama} dan mengalokasikan ke ${resolvedNamaCabang} (Menunggu Konfirmasi Penerimaan Cabang)`
        : `Cabang menginput Aset Project Cabang baru [${newId}] ${nama} di ${resolvedNamaCabang}`;

      await createAuditLogDirect({
        aktor: actorName,
        role_aktor: actorRole,
        jenis_perubahan: 'Create Aset',
        detail: auditMsg,
        id_aset: newId,
        nama_aset: nama
      });

      const responseData: any = { ...newAsetDoc };
      responseData.utilization = computeAssetUtilization(responseData);

      res.status(201).json({ success: true, data: responseData });
    } catch (err: any) {
      console.error('Error creating asset:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Confirm receipt of PUMA investment asset at Branch / SBU
  // Can be confirmed by either Fungsi UMUM or Kabid Dukbis / Management of that branch
  app.put('/api/asets/:id/terima-cabang', async (req, res) => {
    try {
      const requester = getUserFromReq(req);
      const { id } = req.params;
      const { catatan, proyeksi = [] } = req.body;

      const asetDoc = await AsetModel.findOne({
        $or: [{ id_aset: id }, { qr_code: id }]
      }).lean();

      if (!asetDoc) {
        return res.status(404).json({ success: false, message: 'Aset tidak ditemukan' });
      }

      const aset = asetDoc as any;

      // Verification: must belong to the branch of the requester
      if (requester && requester.role !== 'puma' && requester.id_cabang && aset.id_cabang && aset.id_cabang !== requester.id_cabang) {
        return res.status(403).json({ success: false, message: 'Anda hanya dapat mengonfirmasi penerimaan aset untuk cabang Anda sendiri.' });
      }

      const recipientRole = requester?.role === 'admin' 
        ? 'Fungsi UMUM' 
        : (requester?.jabatan || 'Kabid Dukbis / Management Cabang');
      const recipientName = requester?.nama || 'Petugas Cabang';
      const recipientStamp = `${recipientName} (${recipientRole})`;
      const timestamp = new Date().toISOString();

      // Validation: Peralatan Operasi requires at least 1 projection row
      if (aset.kategori === 'Peralatan Operasi') {
        if (!Array.isArray(proyeksi) || proyeksi.length === 0) {
          return res.status(400).json({
            success: false,
            message: 'Aset kategori Peralatan Operasi wajib mengisi minimal 1 (satu) baris proyeksi pendapatan per tahun.'
          });
        }
      }

      // Validate projection rows if provided
      const seenYears = new Set<number>();
      const projectionDocsToInsert: any[] = [];
      if (Array.isArray(proyeksi) && proyeksi.length > 0) {
        for (const p of proyeksi) {
          const yr = Math.round(Number(p.tahun));
          const val = Math.round(Number(p.nilai));
          if (!yr || isNaN(yr) || yr < 1900 || yr > 2100) {
            return res.status(400).json({ success: false, message: `Tahun proyeksi tidak valid: ${p.tahun}` });
          }
          if (seenYears.has(yr)) {
            return res.status(400).json({ success: false, message: `Tahun proyeksi ${yr} tidak boleh duplikat.` });
          }
          seenYears.add(yr);
          if (!val || isNaN(val) || val <= 0) {
            return res.status(400).json({ success: false, message: `Nilai proyeksi tahun ${yr} harus berupa bilangan bulat Rupiah lebih dari 0.` });
          }
          projectionDocsToInsert.push({
            aset_id: aset.id_aset,
            tahun: yr,
            nilai: val,
            diinput_oleh: recipientStamp,
            diinput_pada: timestamp
          });
        }
      }

      // Save projections into collection (immutable: unique index on aset_id + tahun)
      for (const p of projectionDocsToInsert) {
        await ProyeksiPendapatanModel.findOneAndUpdate(
          { aset_id: p.aset_id, tahun: p.tahun },
          { $setOnInsert: p },
          { upsert: true, new: true }
        );
      }

      const updatedAset = await AsetModel.findOneAndUpdate(
        { id_aset: aset.id_aset },
        {
          $set: {
            status_penerimaan: 'Diterima',
            status: 'Tersedia',
            diterima_oleh: recipientStamp,
            tgl_diterima: aset.tgl_diterima || timestamp,
            catatan_penerimaan: catatan || 'Barang telah diterima di Cabang dalam kondisi baik',
            updated_at: timestamp
          }
        },
        { new: true }
      ).lean();

      const { _id, __v, ...clean } = updatedAset as any;
      clean.utilization = computeAssetUtilization(clean);
      const memIdx = db.asets.findIndex(a => a.id_aset === aset.id_aset);
      if (memIdx !== -1) db.asets[memIdx] = clean;

      await createAuditLogDirect({
        aktor: recipientName,
        role_aktor: requester?.role || 'admin',
        jenis_perubahan: 'Update Status',
        detail: `Konfirmasi Penerimaan Aset Investasi PUMA [${aset.id_aset}] ${aset.nama} di ${aset.nama_cabang || 'Cabang'}. Diterima oleh: ${recipientStamp}.${projectionDocsToInsert.length > 0 ? ` Tercatat ${projectionDocsToInsert.length} tahun proyeksi pendapatan.` : ''}`,
        id_aset: aset.id_aset,
        nama_aset: aset.nama
      });

      res.json({
        success: true,
        message: `Aset ${aset.nama} berhasil dikonfirmasi dan telah resmi masuk ke inventaris ${aset.nama_cabang || 'Cabang'}!`,
        data: clean
      });
    } catch (err: any) {
      console.error('Error in terima-cabang:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Get Proyeksi Pendapatan Aset per Tahun (Only for PUMA, PIC, and Fungsi Umum / Management)
  app.get('/api/asets/:id/proyeksi', async (req, res) => {
    try {
      const requester = getUserFromReq(req);
      if (!requester || !['puma', 'pic_bidang', 'admin', 'management', 'pimpinan'].includes(requester.role || '')) {
        return res.status(403).json({ success: false, message: 'Akses ditolak. Hanya role PUMA, PIC, dan Fungsi Umum yang berwenang melihat proyeksi pendapatan aset.' });
      }

      const { id } = req.params;
      const docs = await ProyeksiPendapatanModel.find({ aset_id: id }).sort({ tahun: 1 }).lean();
      const clean = (docs || []).map(({ _id, __v, ...rest }: any) => rest);
      res.json({ success: true, count: clean.length, data: clean });
    } catch (err: any) {
      console.error('Error fetching proyeksi pendapatan:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // --- Modul Data Order (Tahap 2) ---

  // Get list of Orders with optional search (?q=)
  app.get('/api/orders', async (req, res) => {
    try {
      const q = String(req.query.q || '').trim();
      let query: any = {};
      if (q) {
        query = {
          $or: [
            { nomor_order: new RegExp(q, 'i') },
            { nama_order: new RegExp(q, 'i') },
            { dibuat_oleh: new RegExp(q, 'i') }
          ]
        };
      }
      const orderDocs = await OrderModel.find(query).sort({ dibuat_pada: -1 }).lean();
      const cleanOrders = (orderDocs || []).map(({ _id, __v, ...rest }: any) => rest);
      res.json({ success: true, count: cleanOrders.length, data: cleanOrders });
    } catch (err: any) {
      console.error('Error fetching orders:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Lookup single Order by nomor_order (case-insensitive / uppercase)
  app.get('/api/orders/:nomor_order', async (req, res) => {
    try {
      const nomorOrder = String(req.params.nomor_order || '').trim().toUpperCase();
      if (!nomorOrder) {
        return res.status(400).json({ success: false, message: 'Nomor order tidak valid' });
      }
      const doc = await OrderModel.findOne({ nomor_order: nomorOrder }).lean();
      if (!doc) {
        return res.status(404).json({ success: false, message: `Nomor order '${nomorOrder}' tidak ditemukan.` });
      }
      const { _id, __v, ...clean } = doc as any;
      res.json({ success: true, data: clean });
    } catch (err: any) {
      console.error('Error looking up order:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Helper to extract operating sessions from all assets
  async function collectAllOperatingSessions(): Promise<SesiOperasiInput[]> {
    const asetDocs = await AsetModel.find({}, {
      id_aset: 1,
      nama: 1,
      nilai_perolehan: 1,
      riwayat_operasi: 1
    }).lean();

    const sessions: SesiOperasiInput[] = [];
    for (const a of (asetDocs || [])) {
      if (Array.isArray(a.riwayat_operasi)) {
        for (const s of a.riwayat_operasi) {
          sessions.push({
            id_aset: a.id_aset,
            nama_aset: a.nama,
            nilai_perolehan: a.nilai_perolehan,
            mulai: s.mulai,
            selesai: s.selesai,
            durasi_jam: Number(s.durasi_jam) || 0,
            nomor_order: s.nomor_order,
            pic: s.pic
          });
        }
      }
    }
    return sessions;
  }

  // Get Rincian Alokasi Pendapatan per Order (Tahap 3)
  app.get('/api/orders/:nomor_order/alokasi', async (req, res) => {
    try {
      const nomorOrder = String(req.params.nomor_order || '').trim().toUpperCase();
      if (!nomorOrder) {
        return res.status(400).json({ success: false, message: 'Nomor order tidak valid' });
      }

      const doc = await OrderModel.findOne({ nomor_order: nomorOrder }).lean();
      if (!doc) {
        return res.status(404).json({ success: false, message: `Nomor order '${nomorOrder}' tidak ditemukan.` });
      }

      const allSessions = await collectAllOperatingSessions();
      const alokasi = hitungAlokasiOrder(doc.nomor_order, doc.nilai_order, allSessions);
      const { _id, __v, ...cleanOrder } = doc as any;

      res.json({
        success: true,
        order: cleanOrder,
        alokasi
      });
    } catch (err: any) {
      console.error('Error computing order allocation:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Get Pendapatan Riil per Aset (berdasarkan alokasi order dan sesi cut-off H-1) (Tahap 3)
  app.get('/api/asets/:id/pendapatan-riil', async (req, res) => {
    try {
      const asetId = String(req.params.id || '').trim();
      const start = String(req.query.start || '').trim();
      const end = String(req.query.end || '').trim();

      const targetAset = await AsetModel.findOne({ id_aset: asetId }).lean();
      if (!targetAset) {
        return res.status(404).json({ success: false, message: `Aset dengan ID '${asetId}' tidak ditemukan.` });
      }

      const orderDocs = await OrderModel.find({}).lean();
      const cleanOrders = (orderDocs || []).map((o: any) => ({
        nomor_order: o.nomor_order,
        nilai_order: o.nilai_order
      }));

      const allSessions = await collectAllOperatingSessions();
      const hasil = hitungPendapatanRiilAset(asetId, start, end, cleanOrders, allSessions);

      res.json({
        success: true,
        data: hasil
      });
    } catch (err: any) {
      console.error('Error computing asset real revenue:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Helper to pre-calculate allocated revenue for every operating session
  async function buildSessionRevenueMap(): Promise<Map<string, number>> {
    const orderDocs = await OrderModel.find({}).lean();
    const allSessions = await collectAllOperatingSessions();
    const revMap = new Map<string, number>();

    for (const ord of (orderDocs || [])) {
      const res = hitungAlokasiOrder(ord.nomor_order, ord.nilai_order, allSessions);
      for (const item of res.rincian) {
        const key = `${item.mulai}_${item.selesai}`;
        const cur = revMap.get(key) || 0;
        revMap.set(key, cur + item.pendapatan);
      }
    }
    return revMap;
  }

  // GET /api/utilisasi/summary (Tahap 4 Dashboard Summary)
  app.get('/api/utilisasi/summary', async (req, res) => {
    try {
      const user = getUserFromReq(req);
      const periode = (req.query.periode as any) || 'bulan_ini'; // 'bulan_ini' | 'ytd' | 'tahunan'
      const targetTahun = parseInt(String(req.query.tahun || new Date().getFullYear()));
      const filterCabang = String(req.query.cabang || '').trim();
      const filterBidang = String(req.query.bidang || '').trim();
      const filterKategori = String(req.query.kategori || '').trim();

      let query: any = {};
      if (filterCabang && filterCabang !== 'ALL') query.id_cabang = filterCabang;
      if (filterBidang && filterBidang !== 'ALL') query.id_bidang_sekarang = filterBidang;
      if (filterKategori && filterKategori !== 'ALL') query.kategori = filterKategori;

      // Role security scoping
      if (user && user.role !== 'puma') {
        if (user.id_cabang && user.id_cabang !== 'ALL') {
          query.id_cabang = user.id_cabang;
        }
        if (user.role === 'pic_bidang' && user.id_bidang) {
          query.id_bidang_sekarang = user.id_bidang;
        }
      }

      const [asetDocs, proyeksiDocs, revMap] = await Promise.all([
        AsetModel.find(query).lean(),
        ProyeksiPendapatanModel.find({ tahun: targetTahun }).lean(),
        buildSessionRevenueMap()
      ]);

      const proyeksiMap = new Map<string, number>();
      for (const p of (proyeksiDocs || [])) {
        proyeksiMap.set(p.aset_id, Number(p.nilai) || 0);
      }

      const metrikList: MetrikAsetPeriode[] = [];
      for (const a of (asetDocs || [])) {
        const proyeksiVal = proyeksiMap.get(a.id_aset) || null;
        const resMetrik = hitungMetrikUtilisasiAset({
          id_aset: a.id_aset,
          nama_aset: a.nama,
          kategori: a.kategori,
          nama_bidang: a.nama_bidang_sekarang || 'Bidang Dukungan Bisnis',
          nama_cabang: a.nama_cabang,
          basis_operasi: a.basis_operasi,
          nilai_perolehan: a.nilai_perolehan,
          proyeksi_tahunan: proyeksiVal,
          tanggal_terima: a.tgl_diterima || a.tgl_perolehan,
          tahun_evaluasi: targetTahun,
          periode_mode: periode,
          op_sessions: Array.isArray(a.riwayat_operasi) ? a.riwayat_operasi : [],
          maint_sessions: Array.isArray(a.riwayat_pemeliharaan_jam) ? a.riwayat_pemeliharaan_jam : [],
          alokasi_pendapatan_sesi_map: revMap
        });
        metrikList.push(resMetrik);
      }

      const agregatBidang = agregasikanMetrik(metrikList, 'bidang');
      const agregatKategori = agregasikanMetrik(metrikList, 'kategori');

      res.json({
        success: true,
        periode,
        tahun: targetTahun,
        count: metrikList.length,
        data: metrikList,
        agregat_bidang: agregatBidang,
        agregat_kategori: agregatKategori
      });
    } catch (err: any) {
      console.error('Error fetching utilisasi summary:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // GET /api/asets/:id/metrik-utilisasi (Tahap 4 Detail Asset Metrics & Monthly Chart Data)
  app.get('/api/asets/:id/metrik-utilisasi', async (req, res) => {
    try {
      const asetId = String(req.params.id || '').trim();
      const periode = (req.query.periode as any) || 'bulan_ini';
      const targetTahun = parseInt(String(req.query.tahun || new Date().getFullYear()));

      const targetAset = await AsetModel.findOne({ id_aset: asetId }).lean();
      if (!targetAset) {
        return res.status(404).json({ success: false, message: `Aset dengan ID '${asetId}' tidak ditemukan.` });
      }

      const [proyeksiDocs, revMap] = await Promise.all([
        ProyeksiPendapatanModel.find({ aset_id: asetId, tahun: targetTahun }).lean(),
        buildSessionRevenueMap()
      ]);

      const proyeksiVal = proyeksiDocs?.[0]?.nilai ? Number(proyeksiDocs[0].nilai) : null;

      const metrik = hitungMetrikUtilisasiAset({
        id_aset: targetAset.id_aset,
        nama_aset: targetAset.nama,
        kategori: targetAset.kategori,
        nama_bidang: targetAset.nama_bidang_sekarang || 'Bidang Dukungan Bisnis',
        nama_cabang: targetAset.nama_cabang,
        basis_operasi: targetAset.basis_operasi,
        nilai_perolehan: targetAset.nilai_perolehan,
        proyeksi_tahunan: proyeksiVal,
        tanggal_terima: targetAset.tgl_diterima || targetAset.tgl_perolehan,
        tahun_evaluasi: targetTahun,
        periode_mode: periode,
        op_sessions: Array.isArray(targetAset.riwayat_operasi) ? targetAset.riwayat_operasi : [],
        maint_sessions: Array.isArray(targetAset.riwayat_pemeliharaan_jam) ? targetAset.riwayat_pemeliharaan_jam : [],
        alokasi_pendapatan_sesi_map: revMap
      });

      // Hitung data tren bulanan (12 bulan) untuk grafik detail aset
      const monthlyBreakdown: Array<{
        bulan_nama: string;
        bulan_idx: number;
        jam_pakai: number;
        ut_persen: number;
        pendapatan: number;
        proyeksi_bulanan: number;
      }> = [];

      const namaBulan = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
      const proyeksiPerBulan = proyeksiVal ? Math.round(proyeksiVal / 12) : 0;
      const kapasitasBulananNetto = getKapasitasBrutoStandar(targetAset.basis_operasi || 'Working Day Based', 'bulan_ini', 30);

      for (let m = 0; m < 12; m++) {
        const startMonth = new Date(targetTahun, m, 1, 0, 0, 0, 0).getTime();
        const endMonth = new Date(targetTahun, m + 1, 0, 23, 59, 59, 999).getTime();

        let monthHours = 0;
        let monthRev = 0;

        for (const op of (targetAset.riwayat_operasi || [])) {
          const sTime = new Date(op.selesai || op.mulai).getTime();
          if (!isNaN(sTime) && sTime >= startMonth && sTime <= endMonth) {
            monthHours += Number(op.durasi_jam) || 0;
            const rev = revMap.get(`${op.mulai}_${op.selesai}`) || 0;
            monthRev += rev;
          }
        }

        const utMonth = Math.min(100, Number(((monthHours / Math.max(1, kapasitasBulananNetto)) * 100).toFixed(1)));

        monthlyBreakdown.push({
          bulan_nama: namaBulan[m],
          bulan_idx: m + 1,
          jam_pakai: Number(monthHours.toFixed(1)),
          ut_persen: utMonth,
          pendapatan: monthRev,
          proyeksi_bulanan: proyeksiPerBulan
        });
      }

      res.json({
        success: true,
        metrik,
        monthly_breakdown: monthlyBreakdown
      });
    } catch (err: any) {
      console.error('Error fetching asset metrik utilisasi:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Create new Order (Only role Fungsi UMUM / 'admin')
  app.post('/api/orders', async (req, res) => {
    try {
      const requester = getUserFromReq(req);
      if (!requester || requester.role !== 'admin') {
        return res.status(403).json({
          success: false,
          message: 'Akses ditolak: Hanya role Fungsi UMUM yang berwenang menambah data order baru.'
        });
      }

      const { nomor_order, nama_order, nilai_order } = req.body;
      const cleanNomor = String(nomor_order || '').trim().toUpperCase();
      if (!cleanNomor) {
        return res.status(400).json({ success: false, message: 'Nomor order wajib diisi.' });
      }

      // Check duplicate
      const existing = await OrderModel.findOne({ nomor_order: cleanNomor }).lean();
      if (existing) {
        return res.status(400).json({
          success: false,
          message: `Nomor order '${cleanNomor}' sudah terdaftar dalam sistem.`
        });
      }

      const numNilai = Math.round(Number(nilai_order));
      if (isNaN(numNilai) || numNilai <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Nilai order harus berupa bilangan bulat Rupiah lebih dari 0.'
        });
      }

      const orderDoc = {
        nomor_order: cleanNomor,
        nama_order: String(nama_order || '').trim(),
        nilai_order: numNilai,
        dibuat_oleh: `${requester.nama || 'Petugas'} (Fungsi UMUM)`,
        dibuat_pada: new Date().toISOString()
      };

      await OrderModel.create(orderDoc);

      await createAuditLogDirect({
        aktor: requester.nama || 'Fungsi UMUM',
        role_aktor: 'admin',
        jenis_perubahan: 'Create Aset',
        detail: `Menambahkan Nomor Order baru: ${cleanNomor} (Nilai: Rp ${numNilai.toLocaleString('id-ID')})`
      });

      res.status(201).json({ success: true, message: `Order ${cleanNomor} berhasil disimpan secara permanen.`, data: orderDoc });
    } catch (err: any) {
      console.error('Error creating order:', err);
      if (err.code === 11000) {
        return res.status(400).json({
          success: false,
          message: `Nomor order sudah terdaftar dalam sistem.`
        });
      }
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Update Asset Master Data
  app.put('/api/asets/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { actorName = 'Admin', actorRole = 'admin', ...updates } = req.body;

      const existing = await AsetModel.findOne({ id_aset: id }).lean();
      if (!existing) {
        return res.status(404).json({ success: false, message: 'Aset tidak ditemukan' });
      }

      delete updates._id;
      delete updates.__v;
      delete updates.nilai_perolehan; // Immutability: Nilai perolehan tidak dapat diubah setelah disimpan!
      updates.updated_at = new Date().toISOString();

      // Track operating hours session if status transitions
      if (updates.status && updates.status !== (existing as any).status) {
        const oldStatus = (existing as any).status;
        const newStatus = updates.status;

        // Transition: Tersedia -> Digunakan (Check-out)
        if (newStatus === 'Digunakan' && oldStatus !== 'Digunakan') {
          updates.waktu_mulai_operasi = new Date().toISOString();
          const cleanNomorOrder = req.body.nomor_order ? String(req.body.nomor_order).trim().toUpperCase() : null;
          updates.nomor_order_aktif = cleanNomorOrder;
        }
        // Transition: Digunakan -> Tersedia (Check-in / Selesai Pemakaian)
        else if (newStatus === 'Tersedia' && oldStatus === 'Digunakan') {
          const photoEvidence = req.body.foto_pengembalian || req.body.foto_selesai_pakai || req.body.gambar_barang || '';
          const returnLocation = req.body.lokasi_pengembalian || req.body.lokasi_sekarang || (existing as any).lokasi_sekarang || '';
          const gpsCoords = req.body.koordinat_gps || null;

          if (photoEvidence) updates.foto_pengembalian_terakhir = photoEvidence;
          if (returnLocation) {
            updates.lokasi_pengembalian_terakhir = returnLocation;
            updates.lokasi_sekarang = returnLocation;
          }
          if (gpsCoords) updates.koordinat_gps_terakhir = gpsCoords;

          const startTime = (existing as any).waktu_mulai_operasi;
          if (startTime) {
            const startMs = new Date(startTime).getTime();
            const durasiHours = Math.max(0.1, Number(((Date.now() - startMs) / (1000 * 60 * 60)).toFixed(2)));
            const activeOrder = (existing as any).nomor_order_aktif || (req.body.nomor_order ? String(req.body.nomor_order).trim().toUpperCase() : null) || null;
            const newSession = {
              mulai: startTime,
              selesai: new Date().toISOString(),
              durasi_jam: durasiHours,
              pic: actorName,
              foto_pengembalian: photoEvidence,
              lokasi_pengembalian: returnLocation,
              koordinat_gps: gpsCoords,
              nomor_order: activeOrder
            };
            const existingSessions = Array.isArray((existing as any).riwayat_operasi) ? (existing as any).riwayat_operasi : [];
            updates.riwayat_operasi = [...existingSessions, newSession];
            updates.waktu_mulai_operasi = '';
            updates.nomor_order_aktif = null;
          }
        }

        // Transition: to Dalam Pemeliharaan
        if (newStatus === 'Dalam Pemeliharaan' && oldStatus !== 'Dalam Pemeliharaan') {
          updates.waktu_mulai_pemeliharaan = new Date().toISOString();
        }
        // Transition: from Dalam Pemeliharaan to Tersedia
        else if (newStatus === 'Tersedia' && oldStatus === 'Dalam Pemeliharaan') {
          const startMaintTime = (existing as any).waktu_mulai_pemeliharaan;
          if (startMaintTime) {
            const startMs = new Date(startMaintTime).getTime();
            const durasiHours = Math.max(0.1, Number(((Date.now() - startMs) / (1000 * 60 * 60)).toFixed(2)));
            const newMaintSession = {
              mulai: startMaintTime,
              selesai: new Date().toISOString(),
              durasi_jam: durasiHours,
              jenis: 'Pemeliharaan / Perbaikan'
            };
            const existingMaint = Array.isArray((existing as any).riwayat_pemeliharaan_jam) ? (existing as any).riwayat_pemeliharaan_jam : [];
            updates.riwayat_pemeliharaan_jam = [...existingMaint, newMaintSession];
            updates.waktu_mulai_pemeliharaan = '';
          }
        }
      }

      if (updates.status && updates.status !== 'Digunakan') {
        updates.tgl_rencana_pengembalian = '';
      }

      const updatedDoc = await AsetModel.findOneAndUpdate(
        { id_aset: id },
        { $set: updates },
        { new: true }
      ).lean();

      const { _id, __v, ...cleanUpdated } = updatedDoc as any;
      cleanUpdated.utilization = computeAssetUtilization(cleanUpdated);

      const idx = db.asets.findIndex(a => a.id_aset === id);
      if (idx !== -1) {
        db.asets[idx] = cleanUpdated as any;
      }

      await createAuditLogDirect({
        aktor: actorName,
        role_aktor: actorRole,
        jenis_perubahan: 'Update Status',
        detail: `Memperbarui data master aset [${id}] ${cleanUpdated.nama}`,
        id_aset: id,
        nama_aset: cleanUpdated.nama
      });

      res.json({ success: true, data: cleanUpdated });
    } catch (err: any) {
      console.error('Error updating asset:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Delete Asset Master Data - Disabled per policy
  app.delete('/api/asets/:id', (req, res) => {
    return res.status(403).json({
      success: false,
      message: 'Penghapusan aset tidak diperkenankan dalam sistem ini.'
    });
  });

  // Mobile-first Self Update by PIC via Scan QR Code (UC-03)
  app.put('/api/asets/:id/update-status', async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        kondisi, 
        lokasi_sekarang, 
        status, 
        catatan, 
        nama_pemegang_terakhir,
        actorName, 
        actorRole 
      } = req.body;

      const currentDoc = await AsetModel.findOne({
        $or: [{ id_aset: id }, { qr_code: id }]
      }).lean();

      if (!currentDoc) {
        return res.status(404).json({ success: false, message: 'Aset tidak ditemukan' });
      }

      const { _id, __v, ...current } = currentDoc as any;
      const oldKondisi = current.kondisi;
      const oldLokasi = current.lokasi_sekarang;
      const oldStatus = current.status;
      const targetStatus = status || current.status;

      // Enforcement: Pengajuan / Pembaruan ke status 'Tersedia' WAJIB melampirkan foto fisik barang dan akses koordinat GPS!
      if (targetStatus === 'Tersedia') {
        const photo = req.body.foto_pengembalian || req.body.foto_selesai_pakai || req.body.gambar_barang;
        const gps = req.body.koordinat_gps;
        if (!photo) {
          return res.status(400).json({ 
            success: false, 
            message: 'Pengajuan ditolak: Foto fisik barang wajib dilampirkan/difoto sebagai bukti kondisi aset saat berstatus Tersedia.' 
          });
        }
        if (!gps || typeof gps.lat !== 'number' || typeof gps.lng !== 'number') {
          return res.status(400).json({ 
            success: false, 
            message: 'Pengajuan ditolak: Akses titik koordinat lokasi (GPS) wajib diambil sebelum mengajukan status Tersedia.' 
          });
        }
      }

      // If updated by regular user (user_biasa / karyawan), submit as pending request for PIC Bidang approval!
      if (actorRole === 'user_biasa') {
        const existingPendingDoc = await PengajuanModel.findOne({ id_aset: current.id_aset, status_approval: 'Pending' }).lean();
        if (existingPendingDoc) {
          const pending = existingPendingDoc as any;
          return res.status(400).json({ 
            success: false, 
            message: `Aset ini [${current.id_aset} - ${current.nama}] sedang dalam proses pengajuan "${pending.jenis}" (Status: Pending). Harap tunggu hingga pengajuan sebelumnya disetujui (Approve) atau ditolak (Reject) oleh PIC/Fungsi Umum sebelum mengajukan kembali.` 
          });
        }

        const targetHolder = nama_pemegang_terakhir !== undefined && nama_pemegang_terakhir.trim() ? nama_pemegang_terakhir.trim() : (actorName || current.nama_pic_sekarang);
        const requestJenis = req.body.jenis_pengajuan || (targetStatus === 'Digunakan' ? 'Pengajuan Pemakaian' : targetStatus === 'Tersedia' ? 'Pengembalian Aset (Selesai Pakai)' : 'Pemutakhiran Lapangan');
        const photoEvidence = req.body.foto_pengembalian || req.body.foto_selesai_pakai || req.body.gambar_barang || '';
        const returnLocation = req.body.lokasi_pengembalian || lokasi_sekarang || current.lokasi_sekarang;
        const gpsCoords = req.body.koordinat_gps || null;
        const cleanNomorOrder = req.body.nomor_order ? String(req.body.nomor_order).trim().toUpperCase() : null;
        
        const newReq: Pengajuan = {
          id_pengajuan: `REQ-${Date.now()}`,
          id_aset: current.id_aset,
          nama_aset: current.nama,
          jenis: requestJenis as any,
          id_bidang_asal: current.id_bidang_sekarang,
          nama_bidang_asal: current.nama_bidang_sekarang,
          kondisi_baru: kondisi || current.kondisi,
          lokasi_baru: returnLocation,
          status_baru: targetStatus,
          pemegang_baru: targetHolder,
          tgl_rencana_pengembalian: req.body.tgl_rencana_pengembalian || current.tgl_rencana_pengembalian || '',
          nomor_order: cleanNomorOrder,
          alasan: catatan || `Permohonan ${requestJenis} oleh staff/karyawan ${actorName || 'User'}`,
          foto_pengembalian: photoEvidence,
          lokasi_pengembalian: returnLocation,
          koordinat_gps: gpsCoords,
          status_approval: 'Pending',
          pemohon_id: current.id_pic_sekarang,
          pemohon_nama: actorName || 'User Biasa',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        };

        await PengajuanModel.create(newReq);
        db.pengajuan.unshift(newReq);

        const gpsNote = gpsCoords ? ` (GPS: ${gpsCoords.lat.toFixed(5)}, ${gpsCoords.lng.toFixed(5)})` : '';
        const photoNote = photoEvidence ? ' [✓ Bukti Foto Terlampir]' : '';
        const orderNote = cleanNomorOrder ? ` [No. Order: ${cleanNomorOrder}]` : '';

        await createAuditLogDirect({
          aktor: actorName || 'User Biasa',
          role_aktor: 'user_biasa',
          jenis_perubahan: 'Update Status',
          detail: `Pengajuan ${requestJenis}: User ${actorName} memperbarui Status (${targetStatus}), Kondisi (${kondisi || current.kondisi}), Lokasi (${returnLocation})${gpsNote}${photoNote}${orderNote}, Pemegang Terakhir (${targetHolder}) - Menunggu Approval PIC Bidang`,
          id_aset: current.id_aset,
          nama_aset: current.nama
        });

        return res.json({ 
          success: true, 
          pendingApproval: true, 
          data: current, 
          pengajuan: newReq,
          message: `${requestJenis} berhasil diajukan dengan bukti foto & koordinat GPS dan sedang menunggu persetujuan PIC Bidang.` 
        });
      }

      const cleanNomorOrderDirect = req.body.nomor_order ? String(req.body.nomor_order).trim().toUpperCase() : null;
      const updates: any = {
        updated_at: new Date().toISOString()
      };
      if (kondisi) updates.kondisi = kondisi;
      if (lokasi_sekarang) updates.lokasi_sekarang = lokasi_sekarang;
      if (status) updates.status = status;

      // Track Operating sessions when status changes
      if (status && status !== oldStatus) {
        // Transition: Tersedia -> Digunakan (Scan mulai pakai)
        if (status === 'Digunakan' && oldStatus !== 'Digunakan') {
          updates.waktu_mulai_operasi = new Date().toISOString();
          updates.nomor_order_aktif = cleanNomorOrderDirect;
        }
        // Transition: Digunakan -> Tersedia (Scan selesai pakai & pengembalian aset)
        else if (status === 'Tersedia' && oldStatus === 'Digunakan') {
          const photoEvidence = req.body.foto_pengembalian || req.body.foto_selesai_pakai || req.body.gambar_barang || '';
          const returnLocation = req.body.lokasi_pengembalian || req.body.lokasi_sekarang || current.lokasi_sekarang || '';
          const gpsCoords = req.body.koordinat_gps || null;

          if (photoEvidence) updates.foto_pengembalian_terakhir = photoEvidence;
          if (returnLocation) {
            updates.lokasi_pengembalian_terakhir = returnLocation;
            updates.lokasi_sekarang = returnLocation;
          }
          if (gpsCoords) updates.koordinat_gps_terakhir = gpsCoords;

          const startTime = current.waktu_mulai_operasi;
          if (startTime) {
            const startMs = new Date(startTime).getTime();
            const durasiHours = Math.max(0.1, Number(((Date.now() - startMs) / (1000 * 60 * 60)).toFixed(2)));
            const activeOrder = current.nomor_order_aktif || cleanNomorOrderDirect || null;
            const newSession = {
              mulai: startTime,
              selesai: new Date().toISOString(),
              durasi_jam: durasiHours,
              pic: actorName || current.nama_pic_sekarang,
              foto_pengembalian: photoEvidence,
              lokasi_pengembalian: returnLocation,
              koordinat_gps: gpsCoords,
              nomor_order: activeOrder
            };
            const existingSessions = Array.isArray(current.riwayat_operasi) ? current.riwayat_operasi : [];
            updates.riwayat_operasi = [...existingSessions, newSession];
            updates.waktu_mulai_operasi = '';
            updates.nomor_order_aktif = null;
          }
        }

        // Transition: to Dalam Pemeliharaan
        if (status === 'Dalam Pemeliharaan' && oldStatus !== 'Dalam Pemeliharaan') {
          updates.waktu_mulai_pemeliharaan = new Date().toISOString();
        }
        // Transition: from Dalam Pemeliharaan to Tersedia
        else if (status === 'Tersedia' && oldStatus === 'Dalam Pemeliharaan') {
          const startMaintTime = current.waktu_mulai_pemeliharaan;
          if (startMaintTime) {
            const startMs = new Date(startMaintTime).getTime();
            const durasiHours = Math.max(0.1, Number(((Date.now() - startMs) / (1000 * 60 * 60)).toFixed(2)));
            const newMaintSession = {
              mulai: startMaintTime,
              selesai: new Date().toISOString(),
              durasi_jam: durasiHours,
              jenis: 'Pemeliharaan / Perbaikan'
            };
            const existingMaint = Array.isArray(current.riwayat_pemeliharaan_jam) ? current.riwayat_pemeliharaan_jam : [];
            updates.riwayat_pemeliharaan_jam = [...existingMaint, newMaintSession];
            updates.waktu_mulai_pemeliharaan = '';
          }
        }
      }

      if (req.body.tgl_rencana_pengembalian) {
        updates.tgl_rencana_pengembalian = req.body.tgl_rencana_pengembalian;
      }
      if (status && status !== 'Digunakan') {
        updates.tgl_rencana_pengembalian = '';
      }
      if (nama_pemegang_terakhir !== undefined) {
        updates.nama_pemegang_terakhir = nama_pemegang_terakhir || current.nama_pic_sekarang;
        updates.tgl_pemutakhiran_pemegang = new Date().toISOString().split('T')[0];
      }

      const updatedAsetDoc = await AsetModel.findOneAndUpdate(
        { id_aset: current.id_aset },
        { $set: updates },
        { new: true }
      ).lean();

      const { _id: _uId, __v: _uV, ...cleanUpdated } = updatedAsetDoc as any;
      cleanUpdated.utilization = computeAssetUtilization(cleanUpdated);

      const idx = db.asets.findIndex(a => a.id_aset === current.id_aset);
      if (idx !== -1) {
        db.asets[idx] = cleanUpdated as any;
      }

      let evidenceNote = '';
      if (status === 'Tersedia' && oldStatus === 'Digunakan') {
        const hasPhoto = Boolean(req.body.foto_pengembalian || req.body.foto_selesai_pakai || req.body.gambar_barang);
        const coords = req.body.koordinat_gps;
        const gpsStr = coords ? ` [GPS: ${coords.lat}, ${coords.lng}]` : '';
        evidenceNote = ` [Selesai Digunakan: ${hasPhoto ? '✓ Bukti Foto Fisik Terlampir' : 'Foto -'}, Lokasi Pengembalian: ${cleanUpdated.lokasi_sekarang}${gpsStr}]`;
      }

      const details = `Pemutakhiran Mandiri PIC via QR Code: Status (${oldStatus} -> ${cleanUpdated.status}), Kondisi (${oldKondisi} -> ${cleanUpdated.kondisi}), Lokasi (${oldLokasi} -> ${cleanUpdated.lokasi_sekarang}), Pemegang Lapangan (${cleanUpdated.nama_pemegang_terakhir || '-'}).${evidenceNote} ${catatan ? `Catatan: ${catatan}` : ''}`;

      await createAuditLogDirect({
        aktor: actorName || current.nama_pic_sekarang,
        role_aktor: actorRole || 'pic_bidang',
        jenis_perubahan: 'Update Status',
        detail: details,
        id_aset: current.id_aset,
        nama_aset: current.nama
      });

      res.json({ success: true, data: cleanUpdated, message: 'Status aset berhasil diperbarui' });
    } catch (err: any) {
      console.error('Error in update-status:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Assign Asset to Bidang / PIC & Pemegang Lapangan (UC-02)
  app.post('/api/asets/:id/assign', async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        id_bidang, 
        id_pic, 
        nama_pemegang_terakhir,
        keterangan, 
        diserah_oleh = 'Ade Dwi Fatwa Sembiring (Alber)' 
      } = req.body;

      const asetDoc = await AsetModel.findOne({ id_aset: id }).lean();
      if (!asetDoc) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan' });

      const { _id: _aId, __v: _aV, ...aset } = asetDoc as any;

      let bidangObj = db.bidang.find(b => b.id_bidang === id_bidang);
      let picObj = db.users.find(u => u.id === id_pic);

      if (id_pic) {
        const uDoc = await UserModel.findOne({ id: id_pic }).lean();
        if (uDoc) picObj = uDoc as any;
      }

      if (!bidangObj || !picObj) {
        return res.status(400).json({ success: false, message: 'Bidang atau PIC tidak valid' });
      }

      const holderName = nama_pemegang_terakhir && nama_pemegang_terakhir.trim() ? nama_pemegang_terakhir.trim() : picObj.nama;

      const asetUpdates = {
        id_bidang_sekarang: bidangObj.id_bidang,
        nama_bidang_sekarang: bidangObj.nama_bidang,
        id_pic_sekarang: picObj.id,
        nama_pic_sekarang: picObj.nama,
        nama_pemegang_terakhir: holderName,
        tgl_pemutakhiran_pemegang: new Date().toISOString().split('T')[0],
        status: 'Digunakan',
        updated_at: new Date().toISOString()
      };

      const updatedAsetDoc = await AsetModel.findOneAndUpdate(
        { id_aset: id },
        { $set: asetUpdates },
        { new: true }
      ).lean();

      const { _id: _uId, __v: _uV, ...cleanAset } = updatedAsetDoc as any;

      const newAssignment: Assignment = {
        id_assignment: `ASG-${Date.now()}`,
        id_aset: cleanAset.id_aset,
        nama_aset: cleanAset.nama,
        id_bidang: bidangObj.id_bidang,
        nama_bidang: bidangObj.nama_bidang,
        id_pic: picObj.id,
        nama_pic: picObj.nama,
        pemegang_lapangan: holderName,
        tanggal_serah: new Date().toISOString().split('T')[0],
        keterangan: keterangan || 'Serah terima aset operasional',
        status: 'Aktif',
        diserah_oleh
      };

      await AssignmentModel.create(newAssignment);
      db.assignments.unshift(newAssignment);

      const idx = db.asets.findIndex(a => a.id_aset === id);
      if (idx !== -1) {
        db.asets[idx] = cleanAset as any;
      }

      await createAuditLogDirect({
        aktor: diserah_oleh,
        role_aktor: 'admin',
        jenis_perubahan: 'Assignment',
        detail: `Serah terima aset kepada ${bidangObj.nama_bidang} (PIC: ${picObj.nama}, Pemegang Lapangan: ${holderName}). Ket: ${keterangan || '-'}`,
        id_aset: cleanAset.id_aset,
        nama_aset: cleanAset.nama
      });

      res.json({ success: true, data: cleanAset, assignment: newAssignment });
    } catch (err: any) {
      console.error('Error in assign asset:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Dedicated endpoint for updating Pemegang Lapangan / Custody
  app.put('/api/asets/:id/pemegang', async (req, res) => {
    try {
      const { id } = req.params;
      const { nama_pemegang_terakhir, lokasi_pemakaian_lapangan, actorName = 'Admin', actorRole = 'admin' } = req.body;

      const asetDoc = await AsetModel.findOne({ id_aset: id }).lean();
      if (!asetDoc) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan' });

      const { _id: _aId, __v: _aV, ...aset } = asetDoc as any;

      const newHolder = nama_pemegang_terakhir || aset.nama_pic_sekarang;
      const oldHolder = aset.nama_pemegang_terakhir || aset.nama_pic_sekarang;

      const updates: any = {
        nama_pemegang_terakhir: newHolder,
        tgl_pemutakhiran_pemegang: new Date().toISOString().split('T')[0],
        updated_at: new Date().toISOString()
      };
      if (lokasi_pemakaian_lapangan) {
        updates.lokasi_pemakaian_lapangan = lokasi_pemakaian_lapangan;
        updates.lokasi_sekarang = lokasi_pemakaian_lapangan;
      }

      const updatedAsetDoc = await AsetModel.findOneAndUpdate(
        { id_aset: id },
        { $set: updates },
        { new: true }
      ).lean();

      const { _id: _uId, __v: _uV, ...cleanAset } = updatedAsetDoc as any;

      const idx = db.asets.findIndex(a => a.id_aset === id);
      if (idx !== -1) {
        db.asets[idx] = cleanAset as any;
      }

      await createAuditLogDirect({
        aktor: actorName,
        role_aktor: actorRole,
        jenis_perubahan: 'Update Status',
        detail: `Serah Terima Pemegang Lapangan [${id}] ${cleanAset.nama}: Pemegang Terakhir (${oldHolder} -> ${newHolder})`,
        id_aset: cleanAset.id_aset,
        nama_aset: cleanAset.nama
      });

      res.json({ success: true, data: cleanAset, message: 'Pemegang lapangan berhasil diperbarui' });
    } catch (err: any) {
      console.error('Error updating pemegang:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Calibration Log & Update Due Date (UC-04)
  app.post('/api/asets/:id/kalibrasi', async (req, res) => {
    try {
      const { id } = req.params;
      const { 
        tanggal, 
        lembaga_kalibrasi, 
        nomor_sertifikat, 
        jatuh_tempo_berikutnya, 
        kondisi_setelah, 
        pic_input, 
        catatan 
      } = req.body;

      const asetDoc = await AsetModel.findOne({ id_aset: id }).lean();
      if (!asetDoc) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan' });

      const { _id: _aId, __v: _aV, ...aset } = asetDoc as any;

      const asetUpdates: any = {
        tgl_kalibrasi_terakhir: tanggal,
        tgl_kalibrasi_berikutnya: jatuh_tempo_berikutnya,
        sertifikat_kalibrasi_no: nomor_sertifikat,
        updated_at: new Date().toISOString()
      };
      if (kondisi_setelah) asetUpdates.kondisi = kondisi_setelah;

      const updatedAsetDoc = await AsetModel.findOneAndUpdate(
        { id_aset: id },
        { $set: asetUpdates },
        { new: true }
      ).lean();

      const { _id: _uId, __v: _uV, ...cleanAset } = updatedAsetDoc as any;

      const newKalibrasi: RiwayatKalibrasi = {
        id_kalibrasi: `KAL-${Date.now()}`,
        id_aset: cleanAset.id_aset,
        nama_aset: cleanAset.nama,
        tanggal: tanggal || new Date().toISOString().split('T')[0],
        lembaga_kalibrasi: lembaga_kalibrasi || 'SUCOFINDO Calibration Services',
        nomor_sertifikat: nomor_sertifikat || `CERT/${Date.now()}`,
        jatuh_tempo_berikutnya,
        kondisi_setelah: kondisi_setelah || 'Baik',
        pic_input: pic_input || cleanAset.nama_pic_sekarang,
        catatan
      };

      await KalibrasiModel.create(newKalibrasi);
      db.kalibrasi.unshift(newKalibrasi);

      const idx = db.asets.findIndex(a => a.id_aset === id);
      if (idx !== -1) {
        db.asets[idx] = cleanAset as any;
      }

      await createAuditLogDirect({
        aktor: pic_input || cleanAset.nama_pic_sekarang,
        role_aktor: 'pic_bidang',
        jenis_perubahan: 'Update Kalibrasi',
        detail: `Update data sertifikat kalibrasi No. ${nomor_sertifikat}. Jatuh tempo berikutnya: ${jatuh_tempo_berikutnya}`,
        id_aset: cleanAset.id_aset,
        nama_aset: cleanAset.nama
      });

      res.json({ success: true, data: cleanAset, kalibrasi: newKalibrasi });
    } catch (err: any) {
      console.error('Error adding kalibrasi:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Submit Pengajuan Transfer / Disposal / Pemakaian (UC-06)
  app.post('/api/pengajuan', validateBody(createPengajuanSchema), async (req, res) => {
    try {
      const { 
        id_aset, 
        jenis, 
        id_bidang_tujuan, 
        id_pic_tujuan, 
        alasan, 
        pemohon_id, 
        pemohon_nama,
        pemegang_baru,
        kondisi_baru,
        lokasi_baru,
        status_baru,
        tgl_rencana_pengembalian
      } = req.body;

      let aset = await AsetModel.findOne({ id_aset }).lean();
      if (!aset) {
        aset = db.asets.find(a => a.id_aset === id_aset) || null as any;
      }
      if (!aset) return res.status(404).json({ success: false, message: 'Aset tidak ditemukan' });

      // Check if asset already has a pending pengajuan (UC-06 / Approval Workflow rule)
      let existingPending = await PengajuanModel.findOne({ id_aset: aset.id_aset, status_approval: 'Pending' }).lean();
      if (!existingPending) {
        existingPending = db.pengajuan.find(p => p.id_aset === aset.id_aset && p.status_approval === 'Pending') as any;
      }
      if (existingPending) {
        return res.status(400).json({ 
          success: false, 
          message: `Aset ini [${aset.id_aset} - ${aset.nama}] sedang dalam proses pengajuan "${existingPending.jenis}" (Status: Pending). Harap tunggu hingga pengajuan sebelumnya disetujui (Approve) atau ditolak (Reject) oleh PIC/Fungsi Umum sebelum mengajukan kembali.` 
        });
      }

      let bidangTujuanObj = undefined;
      let picTujuanObj = undefined;

      if (jenis === 'Transfer' && id_bidang_tujuan) {
        let bDoc = await BidangModel.findOne({ id_bidang: id_bidang_tujuan }).lean();
        bidangTujuanObj = bDoc || db.bidang.find(b => b.id_bidang === id_bidang_tujuan);
        if (id_pic_tujuan) {
          let uDoc = await UserModel.findOne({ id: id_pic_tujuan }).lean();
          picTujuanObj = uDoc || db.users.find(u => u.id === id_pic_tujuan);
        }
      }

      const targetHolder = pemegang_baru || req.body.nama_pemegang_terakhir || pemohon_nama || aset.nama_pic_sekarang;

      // Determine if requester is Fungsi UMUM (Admin)
      let pemohonUser = pemohon_id ? await UserModel.findOne({ id: pemohon_id }).lean() : null;
      if (!pemohonUser && pemohon_id) {
        pemohonUser = db.users.find(u => u.id === pemohon_id) as any;
      }
      const isFungsiUmum = req.body.pemohon_role === 'admin' || 
                           pemohonUser?.role === 'admin' || 
                           (pemohonUser?.nama_bidang && pemohonUser.nama_bidang.toLowerCase().includes('umum'));

      const isDisposalByFungsiUmum = jenis === 'Disposal' && isFungsiUmum;

      const newReq: Pengajuan = {
        id_pengajuan: `REQ-${Date.now()}`,
        id_aset: aset.id_aset,
        nama_aset: aset.nama,
        jenis,
        id_bidang_asal: aset.id_bidang_sekarang,
        nama_bidang_asal: aset.nama_bidang_sekarang,
        id_bidang_tujuan: bidangTujuanObj?.id_bidang,
        nama_bidang_tujuan: bidangTujuanObj?.nama_bidang,
        id_pic_tujuan: picTujuanObj?.id,
        nama_pic_tujuan: picTujuanObj?.nama,
        pemegang_baru: targetHolder,
        kondisi_baru: kondisi_baru || aset.kondisi,
        lokasi_baru: lokasi_baru || aset.lokasi_sekarang,
        status_baru: isDisposalByFungsiUmum ? 'Disposal' : (status_baru || (jenis === 'Peminjaman Aset' || jenis === 'Pengajuan Pemakaian' ? 'Digunakan' : aset.status)),
        tgl_rencana_pengembalian: tgl_rencana_pengembalian || aset.tgl_rencana_pengembalian || '',
        alasan,
        status_approval: isDisposalByFungsiUmum ? 'Approved' : 'Pending',
        approver_id: isDisposalByFungsiUmum ? (pemohon_id || pemohonUser?.id || 'USR-01') : undefined,
        approver_nama: isDisposalByFungsiUmum ? (pemohon_nama || pemohonUser?.nama || 'Fungsi UMUM') : undefined,
        catatan_approver: isDisposalByFungsiUmum ? 'Disetujui Otomatis (Diajukan langsung oleh Fungsi UMUM)' : undefined,
        pemohon_id: pemohon_id || aset.id_pic_sekarang,
        pemohon_nama: pemohon_nama || aset.nama_pic_sekarang,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      const createdDoc = await PengajuanModel.create(newReq);
      const cleanReq = createdDoc.toObject ? createdDoc.toObject() : newReq;
      delete (cleanReq as any)._id;
      delete (cleanReq as any).__v;

      db.pengajuan.unshift(cleanReq);

      if (isDisposalByFungsiUmum) {
        aset.status = 'Disposal';
        aset.updated_at = new Date().toISOString();
        await AsetModel.updateOne({ id_aset: aset.id_aset }, { $set: aset });
        const asetMemIdx = db.asets.findIndex(a => a.id_aset === aset.id_aset);
        if (asetMemIdx !== -1) db.asets[asetMemIdx] = aset;

        await createAuditLogDirect({
          aktor: pemohon_nama || pemohonUser?.nama || 'Fungsi UMUM',
          role_aktor: 'admin',
          jenis_perubahan: 'Disposal Aset',
          detail: `Disposal (Penghapusan) aset [${aset.id_aset}] diproses langsung oleh Fungsi UMUM. Alasan: ${alasan}`,
          id_aset: aset.id_aset,
          nama_aset: aset.nama
        });
      } else {
        await createAuditLogDirect({
          aktor: pemohon_nama || aset.nama_pic_sekarang,
          role_aktor: (isFungsiUmum ? 'admin' : 'pic_bidang'),
          jenis_perubahan: (jenis === 'Disposal' ? 'Ajukan Disposal' : 'Ajukan Transfer') as any,
          detail: `Mengajukan permohonan ${jenis} aset [${aset.id_aset}]. Calon Pemegang: ${targetHolder}. Alasan: ${alasan}`,
          id_aset: aset.id_aset,
          nama_aset: aset.nama
        });
      }

      res.status(201).json({ success: true, data: cleanReq, aset: isDisposalByFungsiUmum ? aset : undefined });
    } catch (err: any) {
      console.error('Error submitting pengajuan:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Get list of Pengajuan
  app.get('/api/pengajuan', async (req, res) => {
    try {
      const docs = await PengajuanModel.find().sort({ created_at: -1 }).lean();
      const cleanDocs = (docs || []).map(({ _id, __v, ...rest }: any) => rest);
      db.pengajuan = cleanDocs as any;
      const result = paginateData(req, cleanDocs);
      res.json(result);
    } catch (err: any) {
      console.error('Error fetching pengajuan from Mongoose:', err);
      const result = paginateData(req, db.pengajuan || []);
      res.json(result);
    }
  });

  // Approve Pengajuan (UC-07)
  app.put('/api/pengajuan/:id/approve', async (req, res) => {
    try {
      const { id } = req.params;
      const { approver_id, approver_nama, approver_role, approver_id_bidang, catatan } = req.body;

      let pDoc = await PengajuanModel.findOne({ id_pengajuan: id }).lean();
      if (!pDoc) {
        pDoc = db.pengajuan.find(p => p.id_pengajuan === id) as any;
      }
      if (!pDoc) return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });

      const p = { ...(pDoc as any) };
      delete p._id;
      delete p.__v;

      // Validation: Check permissions based on request type
      if (approver_role !== 'admin') {
        if (p.jenis === 'Disposal') {
          return res.status(403).json({
            success: false,
            message: 'Pengajuan disposal (penghapusan) aset hanya dapat disetujui oleh Fungsi Umum (Admin).'
          });
        } else if (p.jenis === 'Transfer') {
          const isRequesterOrOrigin = (p.pemohon_id && p.pemohon_id === approver_id) || 
                                     (p.id_bidang_asal && p.id_bidang_asal === approver_id_bidang);
          const isTargetBidang = (p.id_bidang_tujuan && p.id_bidang_tujuan === approver_id_bidang) ||
                                 (p.id_pic_tujuan && p.id_pic_tujuan === approver_id);
          if (isRequesterOrOrigin || !isTargetBidang) {
            return res.status(403).json({
              success: false,
              message: `Pengajuan transfer bidang tidak dapat disetujui oleh akun/bidang pengaju. Harus disetujui oleh PIC Bidang Tujuan (${p.nama_bidang_tujuan || 'Tujuan'}) atau Fungsi Umum.`
            });
          }
        } else {
          // Pemakaian Lapangan / Pemutakhiran Status
          const isOriginBidang = (p.id_bidang_asal && p.id_bidang_asal === approver_id_bidang);
          if (!isOriginBidang) {
            return res.status(403).json({
              success: false,
              message: `Pengajuan ini harus disetujui oleh PIC Bidang Terkait (${p.nama_bidang_asal || 'Bidang Asal'}) atau Fungsi Umum.`
            });
          }
        }
      }

      p.status_approval = 'Approved';
      p.approver_id = approver_id || 'USR-01';
      p.approver_nama = approver_nama || 'Ade Dwi Fatwa Sembiring (Alber)';
      p.catatan_approver = catatan || 'Disetujui';
      p.updated_at = new Date().toISOString();

      // Compute Asset updates first
      let asetDoc = await AsetModel.findOne({ id_aset: p.id_aset }).lean();
      let aset = asetDoc ? { ...asetDoc } : db.asets.find(a => a.id_aset === p.id_aset);

      if (aset) {
        delete (aset as any)._id;
        delete (aset as any).__v;

        const rawHolder = p.pemegang_baru || (p.jenis === 'Transfer' ? (p.nama_pic_tujuan || p.pemohon_nama) : p.pemohon_nama);
        const newHolder = rawHolder ? rawHolder.split(' (')[0].trim() : rawHolder;

        if (p.jenis === 'Transfer') {
          if (p.id_bidang_tujuan && p.nama_bidang_tujuan) {
            aset.id_bidang_sekarang = p.id_bidang_tujuan;
            aset.nama_bidang_sekarang = p.nama_bidang_tujuan;
          }
          if (p.id_pic_tujuan && p.nama_pic_tujuan) {
            aset.id_pic_sekarang = p.id_pic_tujuan;
            aset.nama_pic_sekarang = p.nama_pic_tujuan;
          } else if (p.id_bidang_tujuan) {
            const picUser = db.users.find(u => u.id_bidang === p.id_bidang_tujuan);
            if (picUser) {
              aset.id_pic_sekarang = picUser.id;
              aset.nama_pic_sekarang = picUser.nama;
            }
          }
          if (newHolder) {
            aset.nama_pemegang_terakhir = newHolder;
            aset.tgl_pemutakhiran_pemegang = new Date().toISOString().split('T')[0];
          }
          if (p.lokasi_baru) aset.lokasi_sekarang = p.lokasi_baru;
          if (p.kondisi_baru) aset.kondisi = p.kondisi_baru;
          if (p.status_baru) aset.status = p.status_baru;
          aset.updated_at = new Date().toISOString();
        } else if (p.jenis === 'Disposal') {
          aset.status = 'Disposal';
          aset.updated_at = new Date().toISOString();
        } else {
          // Pemutakhiran Lapangan / Pengajuan Pemakaian / Peminjaman Aset
          if (p.kondisi_baru) aset.kondisi = p.kondisi_baru;
          if (p.lokasi_baru) aset.lokasi_sekarang = p.lokasi_baru;
          if (p.status_baru) aset.status = p.status_baru;
          
          if (p.tgl_rencana_pengembalian) {
            aset.tgl_rencana_pengembalian = p.tgl_rencana_pengembalian;
          }
          if (aset.status !== 'Digunakan') {
            aset.tgl_rencana_pengembalian = '';
          }
          
          if (newHolder) {
            aset.nama_pemegang_terakhir = newHolder;
            aset.tgl_pemutakhiran_pemegang = new Date().toISOString().split('T')[0];
          }

          if (p.foto_pengembalian) {
            aset.foto_pengembalian_terakhir = p.foto_pengembalian;
          }
          if (p.lokasi_pengembalian) {
            aset.lokasi_pengembalian_terakhir = p.lokasi_pengembalian;
            aset.lokasi_sekarang = p.lokasi_pengembalian;
          }
          if (p.koordinat_gps) {
            aset.koordinat_gps_terakhir = p.koordinat_gps;
          }

          if (p.status_baru === 'Digunakan') {
            aset.waktu_mulai_operasi = new Date().toISOString();
            aset.nomor_order_aktif = p.nomor_order || null;
          } else if (p.status_baru === 'Tersedia') {
            const startTime = aset.waktu_mulai_operasi;
            if (startTime) {
              const startMs = new Date(startTime).getTime();
              const durasiHours = Math.max(0.1, Number(((Date.now() - startMs) / (1000 * 60 * 60)).toFixed(2)));
              const activeOrder = aset.nomor_order_aktif || p.nomor_order || null;
              const newSession = {
                mulai: startTime,
                selesai: new Date().toISOString(),
                durasi_jam: durasiHours,
                pic: newHolder || p.pemohon_nama || aset.nama_pic_sekarang,
                foto_pengembalian: p.foto_pengembalian,
                lokasi_pengembalian: p.lokasi_pengembalian || p.lokasi_baru,
                koordinat_gps: p.koordinat_gps,
                nomor_order: activeOrder
              };
              aset.riwayat_operasi = [...(Array.isArray(aset.riwayat_operasi) ? aset.riwayat_operasi : []), newSession];
              aset.waktu_mulai_operasi = '';
              aset.nomor_order_aktif = null;
            }
          }

          aset.updated_at = new Date().toISOString();
        }
      }

      // Execute Atomic Update via Session / Transaction (with fallback for standalone Mongo)
      let session: mongoose.ClientSession | null = null;
      let transactionStarted = false;
      try {
        session = await mongoose.startSession();
        session.startTransaction();
        transactionStarted = true;
      } catch (sessErr) {
        // Standalone Mongo instances do not support replica set sessions; fall back to sequential writes
        session = null;
        transactionStarted = false;
      }

      try {
        if (transactionStarted && session) {
          await PengajuanModel.updateOne({ id_pengajuan: p.id_pengajuan }, { $set: p }, { session });
          if (aset) {
            await AsetModel.updateOne({ id_aset: p.id_aset }, { $set: aset }, { session });
          }
          await session.commitTransaction();
        } else {
          await PengajuanModel.updateOne({ id_pengajuan: p.id_pengajuan }, { $set: p });
          if (aset) {
            await AsetModel.updateOne({ id_aset: p.id_aset }, { $set: aset });
          }
        }
      } catch (dbErr) {
        if (transactionStarted && session) {
          await session.abortTransaction();
        }
        throw dbErr;
      } finally {
        if (session) {
          session.endSession();
        }
      }

      // Sync in-memory db fallback cache
      const memIdx = db.pengajuan.findIndex(x => x.id_pengajuan === p.id_pengajuan);
      if (memIdx !== -1) db.pengajuan[memIdx] = p;

      if (aset) {
        const asetMemIdx = db.asets.findIndex(a => a.id_aset === p.id_aset);
        if (asetMemIdx !== -1) db.asets[asetMemIdx] = aset as any;
      }

      await createAuditLogDirect({
        aktor: p.approver_nama,
        role_aktor: 'admin',
        jenis_perubahan: 'Approve Request',
        detail: `Menyetujui pengajuan ${p.jenis} aset [${p.id_aset}] ${p.nama_aset}. Pemegang baru: ${aset?.nama_pemegang_terakhir || '-'}. Catatan: ${catatan || 'Disetujui'}`,
        id_aset: p.id_aset,
        nama_aset: p.nama_aset
      });

      res.json({ success: true, data: p, aset: aset, message: 'Pengajuan telah disetujui' });
    } catch (err: any) {
      console.error('Error approving pengajuan:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Reject Pengajuan (UC-07)
  app.put('/api/pengajuan/:id/reject', async (req, res) => {
    try {
      const { id } = req.params;
      const { approver_id, approver_nama, approver_role, approver_id_bidang, catatan } = req.body;

      let pDoc = await PengajuanModel.findOne({ id_pengajuan: id }).lean();
      if (!pDoc) {
        pDoc = db.pengajuan.find(p => p.id_pengajuan === id) as any;
      }
      if (!pDoc) return res.status(404).json({ success: false, message: 'Pengajuan tidak ditemukan' });

      const p = { ...(pDoc as any) };
      delete p._id;
      delete p.__v;

      // Validation: Check permissions based on request type
      if (approver_role !== 'admin') {
        if (p.jenis === 'Disposal') {
          return res.status(403).json({
            success: false,
            message: 'Pengajuan disposal (penghapusan) aset hanya dapat ditolak oleh Fungsi Umum (Admin).'
          });
        } else if (p.jenis === 'Transfer') {
          const isRequesterOrOrigin = (p.pemohon_id && p.pemohon_id === approver_id) || 
                                     (p.id_bidang_asal && p.id_bidang_asal === approver_id_bidang);
          const isTargetBidang = (p.id_bidang_tujuan && p.id_bidang_tujuan === approver_id_bidang) ||
                                 (p.id_pic_tujuan && p.id_pic_tujuan === approver_id);
          if (isRequesterOrOrigin || !isTargetBidang) {
            return res.status(403).json({
              success: false,
              message: `Pengajuan transfer bidang tidak dapat ditolak oleh akun/bidang pengaju. Harus ditolak oleh PIC Bidang Tujuan (${p.nama_bidang_tujuan || 'Tujuan'}) atau Fungsi Umum.`
            });
          }
        } else {
          // Pemakaian Lapangan / Pemutakhiran Status
          const isOriginBidang = (p.id_bidang_asal && p.id_bidang_asal === approver_id_bidang);
          if (!isOriginBidang) {
            return res.status(403).json({
              success: false,
              message: `Pengajuan ini harus ditinjau oleh PIC Bidang Terkait (${p.nama_bidang_asal || 'Bidang Asal'}) atau Fungsi Umum.`
            });
          }
        }
      }

      p.status_approval = 'Rejected';
      p.approver_id = approver_id || 'USR-01';
      p.approver_nama = approver_nama || 'Ade Dwi Fatwa Sembiring (Alber)';
      p.catatan_approver = catatan || 'Permohonan ditolak';
      p.updated_at = new Date().toISOString();

      await PengajuanModel.updateOne({ id_pengajuan: p.id_pengajuan }, { $set: p });

      const memIdx = db.pengajuan.findIndex(x => x.id_pengajuan === p.id_pengajuan);
      if (memIdx !== -1) db.pengajuan[memIdx] = p;

      await createAuditLogDirect({
        aktor: p.approver_nama,
        role_aktor: 'admin',
        jenis_perubahan: 'Reject Request',
        detail: `Menolak pengajuan ${p.jenis} aset [${p.id_aset}] ${p.nama_aset}. Alasan penolakan: ${catatan || 'Ditolak'}`,
        id_aset: p.id_aset,
        nama_aset: p.nama_aset
      });

      res.json({ success: true, data: p, message: 'Pengajuan ditolak' });
    } catch (err: any) {
      console.error('Error rejecting pengajuan:', err);
      res.status(500).json({ success: false, message: err.message });
    }
  });

  // Audit Logs Stream
  app.get('/api/audit-logs', async (req, res) => {
    try {
      const logsDocs = await AuditLogModel.find().sort({ waktu: -1 }).lean();
      const cleanLogs = (logsDocs || []).map(({ _id, __v, ...rest }: any) => rest);
      db.auditLogs = cleanLogs as any;
      const result = paginateData(req, cleanLogs);
      res.json(result);
    } catch (err: any) {
      console.error('Error fetching audit logs from Mongoose:', err);
      const result = paginateData(req, db.auditLogs || []);
      res.json(result);
    }
  });

  // Export to CSV
  app.get('/api/export/csv', (req, res) => {
    const headers = [
      'ID Aset', 'Nama Aset', 'Kategori', 'Tahun', 'Spesifikasi', 
      'Merk/Model', 'No Seri', 'Status', 'Kondisi', 'Bidang', 
      'PIC', 'Lokasi', 'QR Code', 'Kalibrasi Terakhir', 'Jatuh Tempo Kalibrasi'
    ].join(',');

    const rows = db.asets.map(a => [
      `"${a.id_aset}"`,
      `"${a.nama.replace(/"/g, '""')}"`,
      `"${a.kategori}"`,
      a.tahun_perolehan,
      `"${(a.spesifikasi || '').replace(/"/g, '""')}"`,
      `"${(a.merk_model || '').replace(/"/g, '""')}"`,
      `"${(a.nomor_seri || '').replace(/"/g, '""')}"`,
      `"${a.status}"`,
      `"${a.kondisi}"`,
      `"${a.nama_bidang_sekarang}"`,
      `"${a.nama_pic_sekarang}"`,
      `"${(a.lokasi_sekarang || '').replace(/"/g, '""')}"`,
      `"${a.qr_code}"`,
      `"${a.tgl_kalibrasi_terakhir || '-'}"`,
      `"${a.tgl_kalibrasi_berikutnya || '-'}"`
    ].join(','));

    const csvContent = [headers, ...rows].join('\n');

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="Laporan_Master_Aset_SUCOFINDO.csv"');
    res.status(200).send(csvContent);
  });

  // Helper for real email sending via nodemailer
  function createTransporter(config: SmtpConfig) {
    const transportOptions: any = {
      host: config.host || 'smtp.gmail.com',
      port: Number(config.port) || 587,
      secure: Boolean(config.secure),
      tls: {
        rejectUnauthorized: false
      }
    };

    if (config.user && config.pass && config.pass.trim()) {
      transportOptions.auth = {
        user: config.user,
        pass: config.pass
      };
    }

    return nodemailer.createTransport(transportOptions);
  }

  async function getSmtpConfig() {
    try {
      const stateDoc = await SystemStateModel.findOne({ key: 'system_state' }).lean();
      if (stateDoc && stateDoc.data && stateDoc.data.smtpConfig) {
        db.smtpConfig = stateDoc.data.smtpConfig;
        return stateDoc.data.smtpConfig;
      }
    } catch (err) {
      console.error('Error fetching smtpConfig from SystemStateModel:', err);
    }
    return db.smtpConfig;
  }

  async function sendRealEmail(
    to: string, 
    subject: string, 
    html: string, 
    milestone: 'H-30' | 'H-7' | 'Hari H' | 'Uji Coba', 
    asetId?: string, 
    asetName?: string,
    cc?: string
  ) {
    const config = await getSmtpConfig();
    const newLog: EmailLog = {
      id_email: `EML-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      id_aset: asetId,
      nama_aset: asetName,
      milestone,
      recipient: cc ? `${to} (CC: ${cc})` : to,
      subject,
      status: 'SENT',
      sent_at: new Date().toISOString()
    };

    const saveEmailLog = async () => {
      try {
        db.emailLogs.unshift(newLog);
        if (db.emailLogs.length > 200) {
          db.emailLogs = db.emailLogs.slice(0, 200);
        }
        // Save to dedicated EmailLog collection in MongoDB Atlas
        await EmailLogModel.create(newLog).catch(err => 
          console.error('Error inserting EmailLog into MongoDB:', err)
        );
      } catch (err) {
        console.error('saveEmailLog error:', err);
      }
    };

    if (!config.enabled) {
      newLog.status = 'FAILED';
      newLog.error_message = 'Layanan notifikasi email saat ini dinonaktifkan di pengaturan';
      await saveEmailLog();
      return { success: false, log: newLog, error: 'Email service disabled' };
    }

    if (!config.pass || !config.pass.trim() || config.pass === '••••••••••••') {
      newLog.status = 'FAILED';
      newLog.error_message = 'Password / App Password SMTP belum diisi dengan App Password valid (16 karakter Google). Silakan atur di menu Pengaturan SMTP.';
      await saveEmailLog();
      return { success: false, log: newLog, error: newLog.error_message };
    }

    try {
      const transporter = createTransporter(config);
      const fromAddress = `"${config.fromName || 'SUCOFINDO'}" <${config.fromEmail || config.user}>`;
      
      const info = await transporter.sendMail({
        from: fromAddress,
        to,
        cc,
        subject,
        html
      });

      console.log(`[REAL EMAIL SENT] To: ${to}, CC: ${cc || '-'}, Subject: ${subject}, MessageID: ${info.messageId}`);
      await saveEmailLog();
      return { success: true, log: newLog, messageId: info.messageId };
    } catch (err: any) {
      const errMsg = err?.message || String(err);
      const isAuthError = errMsg.includes('535') || errMsg.toLowerCase().includes('username and password not accepted') || errMsg.toLowerCase().includes('invalid login');
      
      const userFriendlyErr = isAuthError 
        ? 'Autentikasi Google SMTP Gagal (535): App Password Google 16 karakter tidak valid/diterima. Mohon perbarui App Password di Pengaturan SMTP.'
        : `Gagal mengirim email: ${errMsg}`;

      console.warn(`[EMAIL NOTICE] To: ${to} - ${userFriendlyErr}`);
      newLog.status = 'FAILED';
      newLog.error_message = userFriendlyErr;
      await saveEmailLog();
      return { success: false, log: newLog, error: userFriendlyErr };
    }
  }

  async function checkAndSendCalibrationEmails() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    const results = [];

    let asets: any[] = [];
    try {
      const freshLogs = await EmailLogModel.find().sort({ createdAt: -1 }).limit(200).lean();
      if (freshLogs && freshLogs.length > 0) {
        db.emailLogs = freshLogs;
      }
    } catch (e) {}

    try {
      asets = await AsetModel.find({ status: { $ne: 'Disposal' } }).lean();
    } catch (err) {
      console.error('Error fetching asets for calibration check:', err);
      asets = db.asets || [];
    }

    let users: any[] = [];
    try {
      users = await UserModel.find().lean();
    } catch (err) {
      console.error('Error fetching users for calibration check:', err);
      users = db.users || [];
    }

    const smtpConfig = await getSmtpConfig();

    // Helper functions for management categorization
    const isKacab = (u: any) => {
      if (!u) return false;
      if (u.tipe_management === 'kepala_cabang') return true;
      const jab = (u.jabatan || '').toLowerCase();
      const uname = (u.username || '').toLowerCase();
      const npp = String(u.npp || '').trim();
      const role = u.role;
      if (role === 'pimpinan' || role === 'management') {
        if (jab.includes('kepala cabang') || jab.includes('kacab') || jab.includes('pimpinan cabang') || jab.includes('head of branch')) return true;
        if (uname === 'pimpinan' || uname === 'kacab' || uname === 'kepala_cabang' || npp === '20101') return true;
        if (!u.tipe_management && (!u.id_bidang || u.id_bidang === 'ALL' || u.id_bidang === 'BDG-ALL') && !jab.includes('kepala bidang')) return true;
      }
      return false;
    };

    const isKabid = (u: any) => {
      if (!u) return false;
      if (isKacab(u)) return false;
      if (u.tipe_management === 'kepala_bidang') return true;
      const jab = (u.jabatan || '').toLowerCase();
      if (jab.includes('kepala bidang') || jab.includes('kabid') || jab.includes('head of')) return true;
      if (u.role === 'management' && u.id_bidang && u.id_bidang !== 'ALL') return true;
      return false;
    };

    // Kepala Cabang (Pimpinan) users get all CC emails
    const kacabUsers = users.filter((u: any) => isKacab(u));
    const kacabEmails = Array.from(new Set(kacabUsers.map((u: any) => u.email).filter(Boolean)));

    // Fungsi UMUM (admin / dukungan bisnis) users
    const umumUsers = users.filter((u: any) => 
      u.role === 'admin' || 
      (u.nama_bidang && (u.nama_bidang.toLowerCase().includes('dukungan bisnis') || u.nama_bidang.toLowerCase().includes('fungsi umum')))
    );
    const umumEmails = Array.from(new Set(umumUsers.map((u: any) => u.email).filter(Boolean)));

    for (const aset of asets) {
      if (!aset.tgl_kalibrasi_berikutnya) continue;

      const dateStr = String(aset.tgl_kalibrasi_berikutnya).split('T')[0];
      const parts = dateStr.split('-').map(Number);
      if (parts.length !== 3 || !parts[0] || !parts[1] || !parts[2]) continue;

      const dueDate = new Date(parts[0], parts[1] - 1, parts[2]);
      dueDate.setHours(0, 0, 0, 0);

      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      let milestone: 'H-30' | 'H-7' | 'Hari H' | null = null;
      let badgeText = '';

      if (diffDays === 30) {
        milestone = 'H-30';
        badgeText = 'PERINGATAN H-30 HARI JATUH TEMPO KALIBRASI';
      } else if (diffDays === 7) {
        milestone = 'H-7';
        badgeText = 'PERINGATAN KRITIS H-7 HARI JATUH TEMPO KALIBRASI';
      } else if (diffDays === 0) {
        milestone = 'Hari H';
        badgeText = 'JATUH TEMPO KALIBRASI HARI INI';
      }

      if (!milestone) continue;

      // Check duplicate sent today
      const alreadySent = db.emailLogs.some(log => {
        if (log.id_aset !== aset.id_aset || log.milestone !== milestone || log.status !== 'SENT') return false;
        const logDate = log.sent_at.split('T')[0];
        return logDate === todayStr;
      });

      if (alreadySent) continue;

      // Recipient calculation:
      // TO: Primary PIC / Pemegang Aset Lapangan email only (or fallback to default recipient/Fungsi Umum if no PIC email)
      let picEmail = '';
      const picUser = users.find((u: any) => u.nama === aset.nama_pic_sekarang || u.nama === aset.nama_pemegang_terakhir || u.id === aset.id_pic_sekarang);
      if (picUser && picUser.email) {
        picEmail = picUser.email;
      }

      const primaryTo = picEmail || smtpConfig.defaultRecipient || umumEmails[0];
      const toRecipients = primaryTo ? [primaryTo] : [];

      if (toRecipients.length === 0) continue;

      // CC recipients: Tim Fungsi UMUM + Kepala Cabang + Default Recipient
      const ccList: string[] = [
        ...umumEmails,
        ...kacabEmails,
        smtpConfig.defaultRecipient
      ].filter(Boolean);

      // If cc_kepala_bidang is enabled (default true), include the Kepala Bidang for this asset's specific department:
      const ccKabidEnabled = smtpConfig.cc_kepala_bidang !== undefined ? smtpConfig.cc_kepala_bidang : true;
      if (ccKabidEnabled) {
        const kabidForAset = users.filter((u: any) => {
          if (!isKabid(u)) return false;
          const matchId = u.id_bidang && aset.id_bidang_sekarang && u.id_bidang === aset.id_bidang_sekarang;
          const matchName = u.nama_bidang && aset.nama_bidang_sekarang && u.nama_bidang.trim().toLowerCase() === aset.nama_bidang_sekarang.trim().toLowerCase();
          return matchId || matchName;
        });
        kabidForAset.forEach((k: any) => {
          if (k.email) ccList.push(k.email);
        });
      }

      const allCcCandidates = Array.from(new Set(ccList));
      const ccRecipients = allCcCandidates.filter(e => !toRecipients.includes(e));

      const toAddress = toRecipients.join(', ');
      const ccAddress = ccRecipients.length > 0 ? ccRecipients.join(', ') : undefined;

      const subject = `[REMINDER KALIBRASI ${milestone}] ${aset.nama} (${aset.id_aset})`;
      
      const htmlBody = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #005DAA; color: #ffffff; padding: 24px; text-align: center;">
            <h2 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">PT SUCOFINDO</h2>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #e0f2fe;">Sistem Monitoring & Kalibrasi Aset Terintegrasi</p>
          </div>
          <div style="padding: 28px;">
            <div style="display: inline-block; padding: 6px 14px; background-color: ${milestone === 'Hari H' ? '#fee2e2' : milestone === 'H-7' ? '#ffedd5' : '#e0f2fe'}; color: ${milestone === 'Hari H' ? '#991b1b' : milestone === 'H-7' ? '#9a3412' : '#075985'}; font-size: 12px; font-weight: 700; border-radius: 9999px; margin-bottom: 20px;">
              ${badgeText}
            </div>
            <h3 style="margin: 0 0 12px 0; color: #0f172a; font-size: 18px;">Pemberitahuan Otomatis Kalibrasi Aset</h3>
            <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
              Yth. Bapak/Ibu <strong>${aset.nama_pic_sekarang || aset.nama_pemegang_terakhir || 'Pengelola Aset'}</strong> & Tim Management / Fungsi UMUM,<br>
              Aset peralatan di bawah ini tercatat belum dikalibrasi ulang dan mendekati/melewati tanggal jatuh tempo kalibrasi rutin:
            </p>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b; width: 150px;">ID Aset</td>
                <td style="padding: 10px 0; color: #0f172a; font-weight: bold;">${aset.id_aset}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b;">Nama Peralatan</td>
                <td style="padding: 10px 0; color: #0f172a; font-weight: bold;">${aset.nama}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b;">Merk / Model</td>
                <td style="padding: 10px 0; color: #0f172a;">${aset.merk_model || '-'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b;">Nomor Seri</td>
                <td style="padding: 10px 0; color: #0f172a;">${aset.nomor_seri || '-'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b;">Bidang / Pemegang</td>
                <td style="padding: 10px 0; color: #0f172a;">${aset.nama_bidang_sekarang || '-'} (${aset.nama_pic_sekarang || '-'})</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b;">Lokasi Fisik</td>
                <td style="padding: 10px 0; color: #0f172a;">${aset.lokasi_sekarang || '-'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b;">Kalibrasi Terakhir</td>
                <td style="padding: 10px 0; color: #0f172a;">${aset.tgl_kalibrasi_terakhir || '-'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b;">Jatuh Tempo Kalibrasi</td>
                <td style="padding: 10px 0; color: #dc2626; font-weight: bold; font-size: 15px;">${aset.tgl_kalibrasi_berikutnya}</td>
              </tr>
            </table>

            <div style="background-color: #f8fafc; padding: 16px; border-radius: 8px; border-left: 4px solid #005DAA; margin-bottom: 24px;">
              <p style="margin: 0; color: #334155; font-size: 13px; line-height: 1.5;">
                <strong>Langkah Perbaikan:</strong> Silakan jadwalkan proses kalibrasi ke laboratorium terakreditasi / Laboratorium SUCOFINDO. Setelah diperbarui, unggah sertifikat kalibrasi baru ke aplikasi.
              </p>
            </div>
          </div>
          <div style="background-color: #f1f5f9; color: #64748b; padding: 16px; text-align: center; font-size: 12px; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0;">Email ini dikirim secara otomatis oleh Sistem Monitoring Aset PT SUCOFINDO (<a href="https://smartsci.sucofindo.co.id/" style="color: #005DAA; font-weight: bold; text-decoration: none;">smartsci.sucofindo.co.id</a>).</p>
          </div>
        </div>
      `;

      const sendRes = await sendRealEmail(toAddress, subject, htmlBody, milestone, aset.id_aset, aset.nama, ccAddress);
      results.push({ id_aset: aset.id_aset, nama_aset: aset.nama, recipient: toAddress, cc: ccAddress, milestone, sendRes });
    }

    return results;
  }

  async function checkAndSendOverdueUsageEmails() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStr = today.toISOString().split('T')[0];
    const results = [];

    let asets: any[] = [];
    try {
      const freshLogs = await EmailLogModel.find().sort({ createdAt: -1 }).limit(200).lean();
      if (freshLogs && freshLogs.length > 0) {
        db.emailLogs = freshLogs;
      }
    } catch (e) {}

    try {
      asets = await AsetModel.find({ status: 'Digunakan' }).lean();
    } catch (err) {
      console.error('Error fetching asets for overdue check:', err);
      asets = (db.asets || []).filter(a => a?.status === 'Digunakan');
    }

    let users: any[] = [];
    try {
      users = await UserModel.find().lean();
    } catch (err) {
      console.error('Error fetching users for overdue check:', err);
      users = db.users || [];
    }

    const smtpConfig = await getSmtpConfig();

    // Helper functions for management categorization
    const isKacab = (u: any) => {
      if (!u) return false;
      if (u.tipe_management === 'kepala_cabang') return true;
      const jab = (u.jabatan || '').toLowerCase();
      const uname = (u.username || '').toLowerCase();
      const npp = String(u.npp || '').trim();
      const role = u.role;
      if (role === 'pimpinan' || role === 'management') {
        if (jab.includes('kepala cabang') || jab.includes('kacab') || jab.includes('pimpinan cabang') || jab.includes('head of branch')) return true;
        if (uname === 'pimpinan' || uname === 'kacab' || uname === 'kepala_cabang' || npp === '20101') return true;
        if (!u.tipe_management && (!u.id_bidang || u.id_bidang === 'ALL' || u.id_bidang === 'BDG-ALL') && !jab.includes('kepala bidang')) return true;
      }
      return false;
    };

    const isKabid = (u: any) => {
      if (!u) return false;
      if (isKacab(u)) return false;
      if (u.tipe_management === 'kepala_bidang') return true;
      const jab = (u.jabatan || '').toLowerCase();
      if (jab.includes('kepala bidang') || jab.includes('kabid') || jab.includes('head of')) return true;
      if (u.role === 'management' && u.id_bidang && u.id_bidang !== 'ALL') return true;
      return false;
    };

    // Kepala Cabang (Pimpinan) users get all CC
    const kacabUsers = users.filter((u: any) => isKacab(u));
    const kacabEmails = Array.from(new Set(kacabUsers.map((u: any) => u.email).filter(Boolean)));

    // Admin / Fungsi Umum users
    const umumUsers = users.filter((u: any) => u.role === 'admin' || (u.nama_bidang && (u.nama_bidang.toLowerCase().includes('dukungan bisnis') || u.nama_bidang.toLowerCase().includes('fungsi umum'))));
    const umumEmails = Array.from(new Set(umumUsers.map((u: any) => u.email).filter(Boolean)));

    for (const aset of asets) {
      if (!aset.tgl_rencana_pengembalian) continue;

      const returnDate = new Date(aset.tgl_rencana_pengembalian);
      if (isNaN(returnDate.getTime())) continue;
      returnDate.setHours(0, 0, 0, 0);

      const diffTime = today.getTime() - returnDate.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      // Overdue if current date > returnDate + 1 day (diffDays >= 1)
      if (diffDays < 1) continue;

      // Check duplicate sent today for this asset
      const alreadySentToday = db.emailLogs.some(log => {
        if (log.id_aset !== aset.id_aset || log.status !== 'SENT') return false;
        if (!log.subject || !log.subject.includes('PERINGATAN TERLAMBAT PENGEMBALIAN')) return false;
        const logDate = log.sent_at.split('T')[0];
        return logDate === todayStr;
      });

      if (alreadySentToday) continue;

      // Recipient calculation:
      // TO: Primary PIC / Pemegang Aset Lapangan email only (or fallback to default recipient/Fungsi Umum if no PIC email)
      let picEmail = '';
      const picUser = users.find((u: any) => u.nama === aset.nama_pic_sekarang || u.id === aset.id_pic_sekarang);
      if (picUser && picUser.email) picEmail = picUser.email;

      const primaryTo = picEmail || smtpConfig.defaultRecipient || umumEmails[0];
      const toRecipients = primaryTo ? [primaryTo] : [];
      if (toRecipients.length === 0) continue;

      // CC recipients: Tim Fungsi UMUM + Kepala Cabang + Default Recipient
      const ccList: string[] = [
        ...umumEmails,
        ...kacabEmails,
        smtpConfig.defaultRecipient
      ].filter(Boolean);

      // If cc_kepala_bidang is enabled (default true), include the Kepala Bidang for this asset's specific department:
      const ccKabidEnabled = smtpConfig.cc_kepala_bidang !== undefined ? smtpConfig.cc_kepala_bidang : true;
      if (ccKabidEnabled) {
        const kabidForAset = users.filter((u: any) => {
          if (!isKabid(u)) return false;
          const matchId = u.id_bidang && aset.id_bidang_sekarang && u.id_bidang === aset.id_bidang_sekarang;
          const matchName = u.nama_bidang && aset.nama_bidang_sekarang && u.nama_bidang.trim().toLowerCase() === aset.nama_bidang_sekarang.trim().toLowerCase();
          return matchId || matchName;
        });
        kabidForAset.forEach((k: any) => {
          if (k.email) ccList.push(k.email);
        });
      }

      const allCcCandidates = Array.from(new Set(ccList));
      const ccRecipients = allCcCandidates.filter(e => !toRecipients.includes(e));

      const toAddress = toRecipients.join(', ');
      const ccAddress = ccRecipients.length > 0 ? ccRecipients.join(', ') : undefined;

      const subject = `[PERINGATAN TERLAMBAT PENGEMBALIAN] Aset ${aset.nama} (${aset.id_aset}) - Terlambat ${diffDays} Hari`;

      const htmlBody = `
        <div style="font-family: 'Segoe UI', Arial, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #cbd5e1; border-radius: 12px; overflow: hidden; background-color: #ffffff;">
          <div style="background-color: #dc2626; color: #ffffff; padding: 24px; text-align: center;">
            <h2 style="margin: 0; font-size: 22px; font-weight: 700; letter-spacing: 0.5px;">PT SUCOFINDO</h2>
            <p style="margin: 6px 0 0 0; font-size: 13px; color: #fef2f2;">Sistem Monitoring Aset Terintegrasi - Peringatan Keterlambatan</p>
          </div>
          <div style="padding: 28px;">
            <div style="display: inline-block; padding: 6px 14px; background-color: #fee2e2; color: #991b1b; font-size: 12px; font-weight: 700; border-radius: 9999px; margin-bottom: 20px;">
              ⚠️ STATUS TERLAMBAT PENGEMBALIAN (${diffDays} HARI)
            </div>
            <h3 style="margin: 0 0 12px 0; color: #0f172a; font-size: 18px;">Pemberitahuan Otomatis Keterlambatan Aset Lapangan</h3>
            <p style="color: #334155; font-size: 14px; line-height: 1.6; margin-bottom: 20px;">
              Diberitahukan kepada PIC Bidang (<strong>${aset.nama_pic_sekarang || '-'}</strong>) dan Tim Fungsi Umum Custodian Aset,<br>
              Aset peralatan berikut tercatat <strong>masih berstatus Digunakan (Dipakai di Lapangan)</strong> melebihi batas tanggal rencana pengembalian dan belum ada perubahan status maupun pengajuan perpanjangan baru:
            </p>
            
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px; font-size: 14px;">
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b; width: 180px;">ID Aset</td>
                <td style="padding: 10px 0; color: #0f172a; font-weight: bold;">${aset.id_aset}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b;">Nama Peralatan</td>
                <td style="padding: 10px 0; color: #0f172a; font-weight: bold;">${aset.nama}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b;">Bidang / PIC</td>
                <td style="padding: 10px 0; color: #0f172a;">${aset.nama_bidang_sekarang || '-'} (${aset.nama_pic_sekarang || '-'})</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b;">Pemegang Lapangan</td>
                <td style="padding: 10px 0; color: #0f172a;">${aset.nama_pemegang_terakhir || '-'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b;">Lokasi Fisik Saat Ini</td>
                <td style="padding: 10px 0; color: #0f172a;">${aset.lokasi_sekarang || '-'}</td>
              </tr>
              <tr style="border-bottom: 1px solid #f1f5f9;">
                <td style="padding: 10px 0; color: #64748b;">Target Tgl Pengembalian</td>
                <td style="padding: 10px 0; color: #dc2626; font-weight: bold;">${aset.tgl_rencana_pengembalian}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b;">Status Keterlambatan</td>
                <td style="padding: 10px 0; color: #dc2626; font-weight: bold; font-size: 15px;">Terlambat ${diffDays} Hari</td>
              </tr>
            </table>

            <div style="background-color: #fef2f2; padding: 16px; border-radius: 8px; border-left: 4px solid #dc2626; margin-bottom: 24px;">
              <p style="margin: 0; color: #991b1b; font-size: 13px; line-height: 1.5;">
                <strong>Tindakan Yang Diperlukan:</strong><br>
                1. Jika pemakaian telah selesai, silakan perbarui status aset menjadi <strong>Selesai Pakai (Standby)</strong> atau <strong>Idle</strong> via Scan QR Code / Master Data Aset.<br>
                2. Jika pemakaian lapangan diperpanjang, silakan buat <strong>Pengajuan Pemakaian / Lapangan Baru</strong> untuk memperbarui target tanggal pengembalian ke tanggal terbaru.
              </p>
            </div>
          </div>
          <div style="background-color: #f1f5f9; color: #64748b; padding: 16px; text-align: center; font-size: 12px; border-top: 1px solid #e2e8f0;">
            <p style="margin: 0;">Email peringatan ini dikirimkan otomatis oleh Sistem Monitoring Aset PT SUCOFINDO (<a href="https://smartsci.sucofindo.co.id/" style="color: #005DAA; font-weight: bold; text-decoration: none;">smartsci.sucofindo.co.id</a>).</p>
          </div>
        </div>
      `;

      const sendRes = await sendRealEmail(toAddress, subject, htmlBody, 'Hari H', aset.id_aset, aset.nama, ccAddress);
      results.push({ id_aset: aset.id_aset, nama_aset: aset.nama, recipient: toAddress, cc: ccAddress, sendRes });

      try {
        await AsetModel.updateOne({ id_aset: aset.id_aset }, { $set: { tgl_notifikasi_terlambat_terakhir: todayStr } });
        aset.tgl_notifikasi_terlambat_terakhir = todayStr;
      } catch (e) {}
    }

    return results;
  }

  // Email API Endpoints
  app.get('/api/email/settings', async (req, res) => {
    const config = await getSmtpConfig();
    const safeConfig = {
      ...config,
      pass: config.pass ? '••••••••••••' : ''
    };
    res.json({ success: true, data: safeConfig });
  });

  app.post('/api/email/settings', async (req, res) => {
    const { host, port, secure, user, pass, fromName, fromEmail, defaultRecipient, cc_kepala_bidang, enabled } = req.body;
    
    const existing = await getSmtpConfig();
    
    const updatedConfig = {
      host: host !== undefined ? host : existing.host,
      port: port !== undefined ? Number(port) : existing.port,
      secure: secure !== undefined ? Boolean(secure) : existing.secure,
      user: user !== undefined ? user : existing.user,
      pass: (pass && pass !== '••••••••••••') ? pass : existing.pass,
      fromName: fromName !== undefined ? fromName : existing.fromName,
      fromEmail: fromEmail !== undefined ? fromEmail : existing.fromEmail,
      defaultRecipient: defaultRecipient !== undefined ? defaultRecipient : existing.defaultRecipient,
      cc_kepala_bidang: cc_kepala_bidang !== undefined ? Boolean(cc_kepala_bidang) : (existing.cc_kepala_bidang !== undefined ? existing.cc_kepala_bidang : true),
      enabled: enabled !== undefined ? Boolean(enabled) : existing.enabled
    };

    db.smtpConfig = updatedConfig;

    await SystemStateModel.updateOne(
      { key: 'system_state' },
      { $set: { 'data.smtpConfig': updatedConfig } },
      { upsert: true }
    ).catch(err => console.error('SystemStateModel update smtpConfig error:', err));

    addAuditLog('Admin', 'admin', 'Update Status', `Memperbarui konfigurasi SMTP Pengiriman Email Kalibrasi Otomatis`);
    res.json({ success: true, message: 'Pengaturan SMTP berhasil disimpan', data: { ...updatedConfig, pass: '••••••••••••' } });
  });

  app.post('/api/email/test', async (req, res) => {
    const { recipient } = req.body;
    const config = await getSmtpConfig();
    const targetRecipient = recipient || config.defaultRecipient || config.user;

    if (!targetRecipient) {
      return res.status(400).json({ success: false, message: 'Alamat email penerima wajib diisi' });
    }

    const testSubject = `[UJI COBA NOTIFIKASI] Pengujian Email Sistem Monitoring Aset PT SUCOFINDO`;
    const testBody = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
        <div style="background-color: #005DAA; color: white; padding: 20px; text-align: center;">
          <h2 style="margin: 0;">Uji Coba Pengiriman Email Successful</h2>
        </div>
        <div style="padding: 24px; color: #1e293b;">
          <p>Halo,</p>
          <p>Ini adalah email uji coba dari <strong>Sistem Informasi Pengelolaan & Kalibrasi Aset PT SUCOFINDO</strong>.</p>
          <p>Layanan email SMTP Anda sudah terkonfigurasi dengan baik dan siap mengirimkan notifikasi otomatis pada H-30, H-7, dan Hari H Jatuh Tempo Kalibrasi.</p>
          <hr style="border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;" />
          <p style="font-size: 12px; color: #64748b;">Waktu Pengujian: ${new Date().toLocaleString('id-ID')}</p>
        </div>
      </div>
    `;

    const sendRes = await sendRealEmail(targetRecipient, testSubject, testBody, 'Uji Coba');
    if (sendRes.success) {
      res.json({ success: true, message: `Email uji coba berhasil dikirim ke ${targetRecipient}`, log: sendRes.log });
    } else {
      res.status(500).json({ success: false, message: `Gagal mengirim email: ${sendRes.error}`, log: sendRes.log });
    }
  });

  app.post('/api/email/check-calibration', async (req, res) => {
    try {
      const results = await checkAndSendCalibrationEmails();
      const sentCount = results.filter(r => r.sendRes?.success).length;
      res.json({
        success: true,
        message: `Pemeriksaan selesai. ${results.length} email diproses, ${sentCount} terkirim langsung.`,
        data: results
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Terjadi kesalahan saat memeriksa email kalibrasi', error: err?.message });
    }
  });

  app.post('/api/email/check-overdue', async (req, res) => {
    try {
      const results = await checkAndSendOverdueUsageEmails();
      const sentCount = results.filter(r => r.sendRes?.success).length;
      res.json({
        success: true,
        message: `Pemeriksaan aset keterlambatan selesai. ${results.length} email diproses, ${sentCount} terkirim langsung.`,
        data: results
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Terjadi kesalahan saat memeriksa email keterlambatan pengembalian', error: err?.message });
    }
  });

  app.get('/api/email/logs', async (req, res) => {
    try {
      const logsFromMongo = await EmailLogModel.find().sort({ createdAt: -1 }).limit(200).lean();
      if (logsFromMongo && logsFromMongo.length > 0) {
        db.emailLogs = logsFromMongo;
      } else {
        const stateDoc = await SystemStateModel.findOne({ key: 'system_state' }).lean();
        if (stateDoc && stateDoc.data && Array.isArray(stateDoc.data.emailLogs)) {
          db.emailLogs = stateDoc.data.emailLogs;
        }
      }
    } catch (e) {}
    res.json({ success: true, count: db.emailLogs?.length || 0, data: db.emailLogs || [] });
  });

  // Secured Cron Endpoint for GitHub Actions Scheduled Workflow
  app.all('/api/cron/check-notifications', async (req, res) => {
    const authHeader = req.headers['authorization'] || req.headers['x-cron-secret'];
    const querySecret = req.query.secret;
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      const isAuthorized =
        authHeader === `Bearer ${cronSecret}` ||
        authHeader === cronSecret ||
        querySecret === cronSecret;

      if (!isAuthorized) {
        return res.status(401).json({ success: false, message: 'Unauthorized CRON trigger request' });
      }
    }

    try {
      const calResults = await checkAndSendCalibrationEmails();
      const overdueResults = await checkAndSendOverdueUsageEmails();
      const totalSent = [...calResults, ...overdueResults].filter(r => r.sendRes?.success).length;

      res.json({
        success: true,
        message: `Cron check executed successfully. Processed ${calResults.length} calibration items & ${overdueResults.length} overdue items. ${totalSent} emails sent.`,
        calibration: calResults,
        overdue: overdueResults
      });
    } catch (err: any) {
      res.status(500).json({ success: false, message: 'Cron execution error', error: err?.message });
    }
  });

  export default app;

  if (process.env.VERCEL !== '1' && !process.env.VERCEL_ENV) {
    const PORT = Number(process.env.PORT) || 3000;

    connectMongoDB().then(async (connected) => {
      if (connected) {
        await syncDbFromMongo();
      } else {
        hasInitialSyncCompleted = true;
      }
    }).catch(err => {
      console.error('MongoDB Atlas initial connect error:', err);
      hasInitialSyncCompleted = true;
    });

    if (process.env.NODE_ENV !== 'production') {
      createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      }).then(vite => {
        app.use(vite.middlewares);
        app.listen(PORT, '0.0.0.0', () => {
          console.log(`SUCOFINDO Asset Monitoring server running on http://0.0.0.0:${PORT}`);
        });
      });
    } else {
      const distPath = path.join(process.cwd(), 'dist');
      app.use(express.static(distPath));
      app.get('*', (req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
      app.listen(PORT, '0.0.0.0', () => {
        console.log(`SUCOFINDO Asset Monitoring server running on http://0.0.0.0:${PORT}`);
      });
    }
  }
