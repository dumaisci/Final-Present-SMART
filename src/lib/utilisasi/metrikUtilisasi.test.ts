import { hitungMetrikUtilisasiAset, agregasikanMetrik, MetrikAsetPeriode } from './metrikUtilisasi';

/**
 * Runner Unit Test Mandiri untuk Engine Metrik Utilisasi Terpadu (Tahap 4)
 * Dijalankan dengan command: npx tsx src/lib/utilisasi/metrikUtilisasi.test.ts
 */

function runMetrikUnitTests() {
  console.log('=== MEMULAI UNIT TEST METRIK UTILISASI TERPADU (TAHAP 4) ===\n');
  let passedCount = 0;
  let failedCount = 0;

  function assert(condition: boolean, testName: string, detail?: string) {
    if (condition) {
      console.log(`✓ [PASS] ${testName}`);
      passedCount++;
    } else {
      console.error(`✗ [FAIL] ${testName}${detail ? ` -> ${detail}` : ''}`);
      failedCount++;
    }
  }

  // -------------------------------------------------------------
  // TEST 1: Kasus Wajib Contoh Pengguna
  // Alat: nilai perolehan 60 jt, proyeksi 2026 = 50 jt, kapasitas 176 jam/bulan,
  // downtime 16, jam pakai 120, pendapatan bulan itu 3 jt.
  // Target Hasil:
  // - UT = 120 / (176 - 16) = 75%
  // - YR = (3 jt * 12) / 60 jt = 36 jt / 60 jt = 60%
  // - RA ≈ 72% (P prorata bulanan = 50 jt / 12 = 4.166.667 -> 3 jt / 4.166.667 = 72%)
  // -------------------------------------------------------------
  console.log('--- TEST 1: Kasus Wajib Spesifikasi (60 jt, 50 jt, 176 jam, 16 downtime, 120 jam pakai, 3 jt) ---');
  
  // Tanggal evaluasi: pertengahan November 2026
  const cutOffNovember = new Date(2026, 10, 15, 23, 59, 59, 999);
  
  // Sesi operasional 120 jam dengan order bernilai alokasi 3.000.000
  const sessionKey = '2026-11-02T08:00:00Z_2026-11-12T16:00:00Z';
  const alokasiMap = new Map<string, number>();
  alokasiMap.set(sessionKey, 3_000_000);

  const hasil1 = hitungMetrikUtilisasiAset({
    id_aset: 'AST-TEST-1',
    nama_aset: 'Alat Uji Spektrometer',
    kategori: 'Peralatan Operasi',
    nama_bidang: 'Bidang Inspeksi Teknik',
    basis_operasi: 'Working Day Based',
    nilai_perolehan: 60_000_000,
    proyeksi_tahunan: 50_000_000,
    tahun_evaluasi: 2026,
    cut_off_date: cutOffNovember,
    periode_mode: 'bulan_ini',
    op_sessions: [
      {
        mulai: '2026-11-02T08:00:00Z',
        selesai: '2026-11-12T16:00:00Z',
        durasi_jam: 120,
        nomor_order: 'ORD-2026-001'
      }
    ],
    maint_sessions: [
      {
        mulai: '2026-11-01T08:00:00Z',
        selesai: '2026-11-01T16:00:00Z',
        durasi_jam: 16
      }
    ],
    alokasi_pendapatan_sesi_map: alokasiMap
  });

  // Karena periode mode bulan_ini dan kapasitas bruto standar 22 hari kerja * 8 jam = 176 jam
  // Jam netto = 176 - 16 = 160 jam. UT = 120 / 160 = 75%.
  assert(Math.round(hasil1.ut_persen) === 75, 'Test 1.1: Utilisasi Waktu (UT) harus 75%', `Got ${hasil1.ut_persen}%`);
  assert(hasil1.ut_klasifikasi === 'Optimal', 'Test 1.2: Klasifikasi UT adalah Optimal (>= 70%)');
  
  // YR = (3 jt * 12) / 60 jt = 60%
  assert(Math.round(hasil1.yr_persen || 0) === 60, 'Test 1.3: Yield Modal (YR) harus 60%', `Got ${hasil1.yr_persen}%`);

  // RA: P prorata bulanan = 50 jt / 12 = 4.166.667. RA = 3 jt / 4.166.667 = 72%
  assert(Math.round(hasil1.ra_persen || 0) === 72, 'Test 1.4: Pencapaian Pendapatan (RA) harus ≈ 72%', `Got ${hasil1.ra_persen}%`);
  assert(hasil1.ra_klasifikasi === 'Moderat', 'Test 1.5: Klasifikasi RA 72% adalah Moderat (70-99%)');

  // Skor Terpadu = 50% * 75% + 50% * 72% = 73.5%
  assert(Math.round(hasil1.skor_terpadu || 0) === 74, 'Test 1.6: Skor Terpadu adalah 73.5% (dibulatkan 74%)', `Got ${hasil1.skor_terpadu}`);

  // Kuadran: UT 75% (tinggi) & RA 72% (tinggi >= 70%) -> Bintang
  assert(hasil1.kuadran === 'Bintang', 'Test 1.7: Masuk Kuadran Bintang', `Got ${hasil1.kuadran}`);

  // -------------------------------------------------------------
  // TEST 2: Kasus Khusus - Aset Tanpa Nilai Perolehan / Proyeksi
  // - RA, YR, Skor tampil null / "-", UT tetap tampil
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Aset Tanpa Nilai Perolehan / Proyeksi ---');
  const hasil2 = hitungMetrikUtilisasiAset({
    id_aset: 'AST-LAMA',
    nama_aset: 'Aset Lama Tanpa Nilai',
    kategori: 'Peralatan Operasi',
    nama_bidang: 'Bidang Laboratorium',
    basis_operasi: 'Working Day Based',
    nilai_perolehan: undefined, // null
    proyeksi_tahunan: undefined, // null
    tahun_evaluasi: 2026,
    cut_off_date: cutOffNovember,
    periode_mode: 'bulan_ini',
    op_sessions: [
      {
        mulai: '2026-11-02T08:00:00Z',
        selesai: '2026-11-05T16:00:00Z',
        durasi_jam: 32,
        nomor_order: 'ORD-2026-002'
      }
    ],
    maint_sessions: []
  });

  assert(hasil2.ut_persen > 0, 'Test 2.1: UT tetap tampil dan terhitung (> 0)', `Got ${hasil2.ut_persen}%`);
  assert(hasil2.ra_persen === null, 'Test 2.2: RA bernilai null jika tanpa proyeksi');
  assert(hasil2.yr_persen === null, 'Test 2.3: YR bernilai null jika tanpa nilai perolehan');
  assert(hasil2.skor_terpadu === null, 'Test 2.4: Skor Terpadu bernilai null jika RA tidak tersedia');

  // -------------------------------------------------------------
  // TEST 3: Kasus Khusus - Aset Punya Proyeksi tapi Belum Ada Pendapatan
  // - RA = 0%
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Aset Punya Proyeksi tapi Belum Ada Pendapatan ---');
  const hasil3 = hitungMetrikUtilisasiAset({
    id_aset: 'AST-ZERO-REV',
    nama_aset: 'Aset Belum Menghasilkan',
    kategori: 'Peralatan Operasi',
    nama_bidang: 'Bidang Inspeksi Teknik',
    basis_operasi: 'Working Day Based',
    nilai_perolehan: 100_000_000,
    proyeksi_tahunan: 24_000_000,
    tahun_evaluasi: 2026,
    cut_off_date: cutOffNovember,
    periode_mode: 'bulan_ini',
    op_sessions: [], // tidak ada sesi
    maint_sessions: []
  });

  assert(hasil3.pendapatan_riil === 0, 'Test 3.1: Pendapatan riil = Rp 0');
  assert(hasil3.ra_persen === 0, 'Test 3.2: RA tepat 0%');
  assert(hasil3.ra_klasifikasi === 'Rendah', 'Test 3.3: Klasifikasi RA = Rendah (< 70%)');
  assert(hasil3.kuadran === 'Idle dan Tidak Produktif', 'Test 3.4: Masuk Kuadran Idle dan Tidak Produktif');

  // -------------------------------------------------------------
  // TEST 4: Kasus Khusus - Sesi Tanpa Order (Non-Revenue Internal)
  // - Jam masuk ke UT, tampil rincian jam_pakai_tanpa_order
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Sesi Tanpa Order (Pemakaian Internal) ---');
  const hasil4 = hitungMetrikUtilisasiAset({
    id_aset: 'AST-INTERNAL',
    nama_aset: 'Aset Internal',
    kategori: 'Peralatan Operasi',
    nama_bidang: 'Bidang Fasilitas',
    basis_operasi: 'Working Day Based',
    nilai_perolehan: 50_000_000,
    proyeksi_tahunan: 20_000_000,
    tahun_evaluasi: 2026,
    cut_off_date: cutOffNovember,
    periode_mode: 'bulan_ini',
    op_sessions: [
      {
        mulai: '2026-11-03T08:00:00Z',
        selesai: '2026-11-04T16:00:00Z',
        durasi_jam: 16,
        nomor_order: null // Tanpa order!
      }
    ],
    maint_sessions: []
  });

  assert(hasil4.jam_pakai_tanpa_order === 16, 'Test 4.1: jam_pakai_tanpa_order = 16 jam');
  assert(hasil4.jam_pakai_total === 16, 'Test 4.2: Jam masuk ke jam_pakai_total');
  assert(hasil4.ut_persen > 0, 'Test 4.3: UT tetap bertambah meski tanpa nomor order');
  assert(hasil4.pendapatan_riil === 0, 'Test 4.4: Pendapatan dari sesi tanpa order tetap 0 (non-revenue)');

  // -------------------------------------------------------------
  // TEST 5: Agregasi Metrik Per Bidang & RA Agregat
  // RA agregat = ΣR / ΣP prorata
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Agregasi Metrik Per Bidang ---');
  const sampleList: MetrikAsetPeriode[] = [hasil1, hasil3];
  const agregatBidang = agregasikanMetrik(sampleList, 'bidang');
  
  const grupInspeksi = agregatBidang.find(g => g.nama_grup === 'Bidang Inspeksi Teknik');
  assert(grupInspeksi !== undefined, 'Test 5.1: Grup Bidang Inspeksi Teknik ditemukan');
  assert(grupInspeksi?.total_aset === 2, 'Test 5.2: Total 2 aset teragregasi');
  
  // Total Pendapatan = 3.000.000 + 0 = 3.000.000
  // Total P prorata = (50 jt / 12) + (24 jt / 12) = 4.166.667 + 2.000.000 = 6.166.667
  // RA Agregat = 3.000.000 / 6.166.667 ≈ 48.6%
  const expectedRaAgregat = Math.round((3_000_000 / (Math.round(50_000_000 / 12) + Math.round(24_000_000 / 12))) * 100);
  assert(Math.round(grupInspeksi?.ra_agregat || 0) === expectedRaAgregat, 'Test 5.3: RA Agregat tepat ΣR / ΣP prorata', `Got ${grupInspeksi?.ra_agregat}%`);

  // Summary
  console.log('\n======================================================');
  console.log(`HASIL UNIT TEST: ${passedCount} LULUS, ${failedCount} GAGAL`);
  console.log('======================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runMetrikUnitTests();
