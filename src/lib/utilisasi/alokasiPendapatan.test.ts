import { hitungAlokasiOrder, hitungPendapatanRiilAset, SesiOperasiInput } from './alokasiPendapatan';

/**
 * Runner Unit Test Mandiri untuk Engine Alokasi Pendapatan Riil
 * Dijalankan dengan command: npx tsx src/lib/utilisasi/alokasiPendapatan.test.ts
 */

function runUnitTests() {
  console.log('=== MEMULAI UNIT TEST ENGINE ALOKASI PENDAPATAN RIIL ===\n');
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

  // Set cut-off H-1 test date: 2026-11-04 23:59:59 (agar sesi tahun 2026 dan sebelum lolos cut-off)
  const testCutOff = new Date(2026, 10, 4, 23, 59, 59, 999);

  // -------------------------------------------------------------
  // TEST 1: Kasus Wajib Contoh Pengguna
  // Order Rp10.000.000; aset A (20 jt, 10 jam), B (40 jt, 5 jam), C (60 jt, 2 jam).
  // Bobot 200 jt, 200 jt, 120 jt (total 520 jt).
  // Hasil: A 3.846.154, B 3.846.154, C 2.307.692 (total tepat 10.000.000)
  // -------------------------------------------------------------
  console.log('--- TEST 1: Contoh Kasus Wajib Spesifikasi ---');
  const sesiWajib: SesiOperasiInput[] = [
    {
      id_aset: 'AST-A',
      nama_aset: 'Aset A',
      nilai_perolehan: 20_000_000,
      durasi_jam: 10,
      nomor_order: 'ORD-10JT',
      mulai: '2026-10-01T08:00:00Z',
      selesai: '2026-10-01T18:00:00Z'
    },
    {
      id_aset: 'AST-B',
      nama_aset: 'Aset B',
      nilai_perolehan: 40_000_000,
      durasi_jam: 5,
      nomor_order: 'ORD-10JT',
      mulai: '2026-10-02T08:00:00Z',
      selesai: '2026-10-02T13:00:00Z'
    },
    {
      id_aset: 'AST-C',
      nama_aset: 'Aset C',
      nilai_perolehan: 60_000_000,
      durasi_jam: 2,
      nomor_order: 'ORD-10JT',
      mulai: '2026-10-03T08:00:00Z',
      selesai: '2026-10-03T10:00:00Z'
    }
  ];

  const hasil1 = hitungAlokasiOrder('ORD-10JT', 10_000_000, sesiWajib, testCutOff);

  assert(hasil1.total_bobot === 520_000_000, 'Test 1.1: Total bobot harus 520.000.000', `Got ${hasil1.total_bobot}`);
  assert(hasil1.rincian.length === 3, 'Test 1.2: Rincian memiliki 3 sesi teralokasi');

  const alokasiA = hasil1.rincian.find(r => r.id_aset === 'AST-A');
  const alokasiB = hasil1.rincian.find(r => r.id_aset === 'AST-B');
  const alokasiC = hasil1.rincian.find(r => r.id_aset === 'AST-C');

  assert(alokasiA?.pendapatan === 3_846_154, 'Test 1.3: Pendapatan Aset A harus Rp 3.846.154', `Got ${alokasiA?.pendapatan}`);
  assert(alokasiB?.pendapatan === 3_846_154, 'Test 1.4: Pendapatan Aset B harus Rp 3.846.154', `Got ${alokasiB?.pendapatan}`);
  assert(alokasiC?.pendapatan === 2_307_692, 'Test 1.5: Pendapatan Aset C harus Rp 2.307.692', `Got ${alokasiC?.pendapatan}`);

  const totalHasil1 = (alokasiA?.pendapatan || 0) + (alokasiB?.pendapatan || 0) + (alokasiC?.pendapatan || 0);
  assert(totalHasil1 === 10_000_000, 'Test 1.6: Total pendapatan ketiga aset harus TEPAT Rp 10.000.000', `Got ${totalHasil1}`);

  // -------------------------------------------------------------
  // TEST 2: Order Tanpa Sesi
  // -------------------------------------------------------------
  console.log('\n--- TEST 2: Order Tanpa Sesi ---');
  const hasil2 = hitungAlokasiOrder('ORD-KOSONG', 5_000_000, [], testCutOff);
  assert(hasil2.rincian.length === 0, 'Test 2.1: Rincian kosong jika belum ada sesi');
  assert(hasil2.total_bobot === 0, 'Test 2.2: Total bobot 0');
  assert(hasil2.total_jam_teralokasi === 0, 'Test 2.3: Total jam teralokasi 0');

  // -------------------------------------------------------------
  // TEST 3: Aset Tanpa Nilai Perolehan
  // Sesi harus masuk ke 'sesi_tidak_dialokasikan' dan tidak merusak alokasi aset lain
  // -------------------------------------------------------------
  console.log('\n--- TEST 3: Aset Tanpa Nilai Perolehan ---');
  const sesiDenganTanpaPerolehan: SesiOperasiInput[] = [
    {
      id_aset: 'AST-LAMA',
      nama_aset: 'Aset Lama Tanpa Perolehan',
      nilai_perolehan: undefined, // belum diisi / null
      durasi_jam: 8,
      nomor_order: 'ORD-CAMPUR',
      mulai: '2026-10-01T08:00:00Z',
      selesai: '2026-10-01T16:00:00Z'
    },
    {
      id_aset: 'AST-BARU',
      nama_aset: 'Aset Baru Terdaftar',
      nilai_perolehan: 50_000_000,
      durasi_jam: 5,
      nomor_order: 'ORD-CAMPUR',
      mulai: '2026-10-02T08:00:00Z',
      selesai: '2026-10-02T13:00:00Z'
    }
  ];

  const hasil3 = hitungAlokasiOrder('ORD-CAMPUR', 5_000_000, sesiDenganTanpaPerolehan, testCutOff);
  assert(hasil3.rincian.length === 1, 'Test 3.1: Hanya 1 sesi yang teralokasi');
  assert(hasil3.rincian[0].id_aset === 'AST-BARU', 'Test 3.2: Sesi AST-BARU teralokasi 100%');
  assert(hasil3.rincian[0].pendapatan === 5_000_000, 'Test 3.3: Seluruh 5 jt dialokasikan ke AST-BARU');
  assert(hasil3.sesi_tidak_dialokasikan.length === 1, 'Test 3.4: Sesi AST-LAMA ditandai tidak dialokasikan');
  assert(hasil3.sesi_tidak_dialokasikan[0].alasan.includes('Nilai Perolehan'), 'Test 3.5: Alasan tidak dialokasikan memuat Nilai Perolehan');

  // -------------------------------------------------------------
  // TEST 4: Sesi Lintas Tahun & Cut-off Periode
  // Order digunakan di tahun 2025 dan 2026.
  // Uji bahwa hitungPendapatanRiilAset hanya mengambil sesi yang selesai di periode yang diminta.
  // -------------------------------------------------------------
  console.log('\n--- TEST 4: Sesi Lintas Tahun ---');
  const sesiLintasTahun: SesiOperasiInput[] = [
    {
      id_aset: 'AST-A',
      nama_aset: 'Aset A',
      nilai_perolehan: 10_000_000,
      durasi_jam: 10,
      nomor_order: 'ORD-MULTI-YEAR',
      mulai: '2025-11-01T08:00:00Z',
      selesai: '2025-11-01T18:00:00Z' // Tahun 2025
    },
    {
      id_aset: 'AST-A',
      nama_aset: 'Aset A',
      nilai_perolehan: 10_000_000,
      durasi_jam: 10,
      nomor_order: 'ORD-MULTI-YEAR',
      mulai: '2026-03-01T08:00:00Z',
      selesai: '2026-03-01T18:00:00Z' // Tahun 2026
    }
  ];

  // Nilai order 20 jt. Masing-masing sesi berbobot sama 100 jt, sehingga masing-masing dapat 10 jt.
  const ordersList = [{ nomor_order: 'ORD-MULTI-YEAR', nilai_order: 20_000_000 }];

  // Query periode 2026 saja: 2026-01-01 s/d 2026-12-31
  const pendapatan2026 = hitungPendapatanRiilAset(
    'AST-A',
    '2026-01-01',
    '2026-12-31',
    ordersList,
    sesiLintasTahun,
    testCutOff
  );

  assert(pendapatan2026.total_pendapatan === 10_000_000, 'Test 4.1: Pendapatan Aset A tahun 2026 harus 10.000.000', `Got ${pendapatan2026.total_pendapatan}`);
  assert(pendapatan2026.rincian_sesi.length === 1, 'Test 4.2: Hanya 1 sesi di tahun 2026 yang terhitung');

  // Query seluruh periode (All-Time)
  const pendapatanAllTime = hitungPendapatanRiilAset(
    'AST-A',
    '',
    '',
    ordersList,
    sesiLintasTahun,
    testCutOff
  );
  assert(pendapatanAllTime.total_pendapatan === 20_000_000, 'Test 4.3: Pendapatan Aset A all-time harus 20.000.000', `Got ${pendapatanAllTime.total_pendapatan}`);
  assert(pendapatanAllTime.rincian_sesi.length === 2, 'Test 4.4: Dua sesi lintas tahun terhitung di all-time');

  // -------------------------------------------------------------
  // TEST 5: Uji Penyesuaian Sisa Pembulatan (Rounding Remainder)
  // Contoh: Order Rp 10.000.000 dibagi 3 sesi dengan bobot persis sama
  // Masing-masing Math.round(10.000.000 / 3) = 3.333.333.
  // 3 * 3.333.333 = 9.999.999 (ada sisa 1 Rupiah).
  // Sisa 1 Rupiah wajib masuk ke sesi dengan bobot terbesar (atau sesi pertama jika bobot sama).
  // Total wajib TEPAT 10.000.000.
  // -------------------------------------------------------------
  console.log('\n--- TEST 5: Penyesuaian Selisih Pembulatan (Exact 100%) ---');
  const sesiTigaSama: SesiOperasiInput[] = [
    {
      id_aset: 'AST-1',
      nama_aset: 'Aset 1',
      nilai_perolehan: 10_000_000,
      durasi_jam: 1,
      nomor_order: 'ORD-SPLIT3',
      mulai: '2026-10-01T08:00:00Z',
      selesai: '2026-10-01T09:00:00Z'
    },
    {
      id_aset: 'AST-2',
      nama_aset: 'Aset 2',
      nilai_perolehan: 10_000_000,
      durasi_jam: 1,
      nomor_order: 'ORD-SPLIT3',
      mulai: '2026-10-01T08:00:00Z',
      selesai: '2026-10-01T09:00:00Z'
    },
    {
      id_aset: 'AST-3',
      nama_aset: 'Aset 3',
      nilai_perolehan: 10_000_000,
      durasi_jam: 1,
      nomor_order: 'ORD-SPLIT3',
      mulai: '2026-10-01T08:00:00Z',
      selesai: '2026-10-01T09:00:00Z'
    }
  ];

  const hasil5 = hitungAlokasiOrder('ORD-SPLIT3', 10_000_000, sesiTigaSama, testCutOff);
  const totalAlloc5 = hasil5.rincian.reduce((sum, s) => sum + s.pendapatan, 0);
  assert(totalAlloc5 === 10_000_000, 'Test 5.1: Total pembagian 3 sesi harus TEPAT 10.000.000 tanpa selisih 1 rupiah pun', `Got ${totalAlloc5}`);
  assert(hasil5.rincian[0].pendapatan === 3_333_334, 'Test 5.2: Sesi pertama mendapat sisa pembulatan (+1 Rp)');
  assert(hasil5.rincian[1].pendapatan === 3_333_333, 'Test 5.3: Sesi kedua 3.333.333');
  assert(hasil5.rincian[2].pendapatan === 3_333_333, 'Test 5.4: Sesi ketiga 3.333.333');

  // Summary
  console.log('\n======================================================');
  console.log(`HASIL UNIT TEST: ${passedCount} LULUS, ${failedCount} GAGAL`);
  console.log('======================================================\n');

  if (failedCount > 0) {
    process.exit(1);
  }
}

runUnitTests();
