import { Bidang, User, Aset, Assignment, RiwayatKalibrasi, Pengajuan, AuditLog } from '../types';

export const INITIAL_BIDANG: Bidang[] = [
  {
    id_bidang: 'BDG-01',
    nama_bidang: 'Bidang Dukungan Bisnis',
    jenis: 'Bidang',
    pic_utama: 'Ade Dwi Fatwa Sembiring (Alber)',
    kontak: '0765-31021',
    lokasi_kantor: 'Gedung Utama SUCOFINDO Lt. 1'
  },
  {
    id_bidang: 'BDG-02',
    nama_bidang: 'Bidang Inspeksi Teknik',
    jenis: 'Bidang',
    pic_utama: 'Rahmat Hidayat',
    kontak: '0765-31022',
    lokasi_kantor: 'Gedung Operasional Inspeksi Lt. 2'
  },
  {
    id_bidang: 'BDG-03',
    nama_bidang: 'Bidang Inspeksi dan Pengujian',
    jenis: 'Bidang',
    pic_utama: 'Siti Nurhaliza',
    kontak: '0765-31023',
    lokasi_kantor: 'Gedung Laboratorium Terpadu'
  },
  {
    id_bidang: 'BDG-04',
    nama_bidang: 'Bidang Penjualan dan Dukungan Operasi',
    jenis: 'Bidang',
    pic_utama: 'Hendra Wijaya',
    kontak: '0765-31024',
    lokasi_kantor: 'Gedung Operasional & Penjualan'
  },
  {
    id_bidang: 'UP-01',
    nama_bidang: 'Unit Pelayanan Duri',
    jenis: 'Unit Pelayanan',
    pic_utama: 'Budi Santoso',
    kontak: '0765-31025',
    lokasi_kantor: 'Pos Pelayanan Duri Field'
  }
];

export const INITIAL_USERS: User[] = [
  {
    id: 'USR-01',
    npp: '22275',
    username: 'admin',
    password: 'password123',
    nama: 'Ade Dwi Fatwa Sembiring (Alber)',
    email: 'ade.sembiring@sucofindo.co.id',
    role: 'admin',
    id_bidang: 'BDG-01',
    nama_bidang: 'Bidang Dukungan Bisnis',
    jabatan: 'FLP Generalist / Pengelola Aset (Fungsi UMUM)',
    isOnline: true,
    lastActive: new Date().toISOString()
  },
  {
    id: 'USR-02',
    npp: '21890',
    username: 'pic_inspeksi',
    password: 'password123',
    nama: 'Rahmat Hidayat',
    email: 'rahmat.hidayat@sucofindo.co.id',
    role: 'pic_bidang',
    id_bidang: 'BDG-02',
    nama_bidang: 'Bidang Inspeksi Teknik',
    jabatan: 'Inspector Senior / PIC Aset Inspeksi Teknik',
    isOnline: true,
    lastActive: new Date().toISOString()
  },
  {
    id: 'USR-03',
    npp: '23102',
    username: 'pic_pengujian',
    password: 'password123',
    nama: 'Siti Nurhaliza',
    email: 'siti.nurhaliza@sucofindo.co.id',
    role: 'pic_bidang',
    id_bidang: 'BDG-03',
    nama_bidang: 'Bidang Inspeksi dan Pengujian',
    jabatan: 'Analis Kimia Senior / PIC Inspeksi & Pengujian',
    isOnline: false,
    lastActive: new Date(Date.now() - 15 * 60 * 1000).toISOString()
  },
  {
    id: 'USR-04',
    npp: '20988',
    username: 'pic_penjualan',
    password: 'password123',
    nama: 'Hendra Wijaya',
    email: 'hendra.wijaya@sucofindo.co.id',
    role: 'pic_bidang',
    id_bidang: 'BDG-04',
    nama_bidang: 'Bidang Penjualan dan Dukungan Operasi',
    jabatan: 'Marine Surveyor / PIC Penjualan & Dukungan Operasi',
    isOnline: false,
    lastActive: new Date(Date.now() - 45 * 60 * 1000).toISOString()
  },
  {
    id: 'USR-05',
    npp: '24011',
    username: 'pic_unit',
    password: 'password123',
    nama: 'Budi Santoso',
    email: 'budi.santoso@sucofindo.co.id',
    role: 'pic_bidang',
    id_bidang: 'UP-01',
    nama_bidang: 'Unit Pelayanan Duri',
    jabatan: 'Supervisor / PIC Unit Pelayanan Duri',
    isOnline: false,
    lastActive: new Date(Date.now() - 120 * 60 * 1000).toISOString()
  },
  {
    id: 'USR-06',
    npp: '19801',
    username: 'management',
    password: 'password123',
    nama: 'Ir. Bambang Suherman',
    email: 'bambang.suherman@sucofindo.co.id',
    role: 'management',
    tipe_management: 'kepala_cabang',
    id_bidang: 'BDG-01',
    nama_bidang: 'Management Cabang',
    jabatan: 'Management / Kepala Cabang PT SUCOFINDO',
    isOnline: true,
    lastActive: new Date().toISOString()
  },
  {
    id: 'USR-07',
    npp: '21500',
    username: 'kabid_dukbis',
    password: 'password123',
    nama: 'Ahmad Fauzi, S.T.',
    email: 'ahmad.fauzi@sucofindo.co.id',
    role: 'management',
    tipe_management: 'kepala_bidang',
    id_bidang: 'BDG-01',
    nama_bidang: 'Bidang Dukungan Bisnis',
    jabatan: 'Kepala Bidang Dukungan Bisnis',
    isOnline: true,
    lastActive: new Date().toISOString()
  }
];

// As requested by user: No dummy asset seed data. Empty databases should display empty state.
export const INITIAL_ASETS: Aset[] = [];
export const INITIAL_ASSIGNMENTS: Assignment[] = [];
export const INITIAL_KALIBRASI: RiwayatKalibrasi[] = [];
export const INITIAL_PENGAJUAN: Pengajuan[] = [];
export const INITIAL_AUDIT_LOGS: AuditLog[] = [];

export const INITIAL_SMTP_CONFIG = {
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  user: process.env.SMTP_USER || 'fatwasembiring8@gmail.com',
  pass: process.env.SMTP_PASS || '',
  fromName: 'SMART SCI - Sistem Monitoring Aset Real - Time',
  fromEmail: process.env.SMTP_FROM || 'fatwasembiring8@gmail.com',
  defaultRecipient: 'fatwasembiring8@gmail.com',
  cc_kepala_bidang: true,
  enabled: true
};

export const INITIAL_EMAIL_LOGS = [];
