/**
 * Engine Metrik Utilisasi Terpadu (Tahap 4)
 * Menghitung Metrik Waktu (UT), Pendapatan (RA), Modal (YR), Skor Terpadu,
 * Tarif Efektif, Proyeksi Akhir Tahun, Jam Minimum, dan Matriks 2x2.
 * 
 * Cut-off H-1 berlaku untuk seluruh metrik.
 */

import { BasisOperasiAset } from '../../types';

// ==========================================
// KONSTANTA KONFIGURASI AMBANG & BOBOT
// ==========================================
export const RA_THRESHOLDS = {
  OPTIMAL: 100, // >= 100% Optimal
  MODERAT: 70   // 70% - 99% Moderat, < 70% Rendah
};

export const UT_THRESHOLDS = {
  OPTIMAL: 70,  // >= 70% Optimal
  MODERAT: 50   // 50% - 69% Moderat, < 50% Rendah
};

export const SKOR_CONFIG = {
  BOBOT_UT: 0.50, // 50% bobot utilisasi waktu
  BOBOT_RA: 0.50, // 50% bobot pencapaian pendapatan
  MAX_RA_CAP: 120 // Batas maksimal RA yang diperhitungkan (120%)
};

export type KlasifikasiStatus = 'Optimal' | 'Moderat' | 'Rendah' | 'N/A';
export type KuadranMatriks = 
  | 'Bintang' 
  | 'Niche Bernilai Tinggi' 
  | 'Sibuk Tapi Kurang Menghasilkan' 
  | 'Idle dan Tidak Produktif'
  | 'Belum Terklasifikasi';

export interface SesiOperasiDetail {
  mulai: string;
  selesai: string;
  durasi_jam: number;
  nomor_order?: string | null;
  pendapatan_teralokasi?: number;
  pic?: string;
  lokasi?: string;
}

export interface MetrikAsetPeriode {
  id_aset: string;
  nama_aset: string;
  kategori: string;
  nama_bidang: string;
  nama_cabang?: string;
  nilai_perolehan?: number | null;
  proyeksi_tahunan?: number | null;
  
  // Waktu
  jam_pakai_total: number;
  jam_pakai_dengan_order: number;
  jam_pakai_tanpa_order: number; // pemakaian internal / non-revenue
  downtime_pemeliharaan: number;
  jam_tersedia_netto: number;
  ut_persen: number; // Utilisasi Waktu (UT)
  ut_klasifikasi: KlasifikasiStatus;

  // Pendapatan & Modal
  pendapatan_riil: number; // R
  proyeksi_prorata?: number | null; // P prorata
  ra_persen?: number | null; // Pencapaian Pendapatan (RA)
  ra_klasifikasi: KlasifikasiStatus;
  yr_persen?: number | null; // Yield Modal (YR)
  yr_label?: string; // Tampilkan "Data belum cukup" jika hari berjalan < 30
  
  // Terpadu & Proyeksi
  skor_terpadu?: number | null;
  skor_klasifikasi: KlasifikasiStatus;
  tarif_efektif_per_jam?: number | null;
  proyeksi_akhir_tahun?: number | null;
  jam_minimum_target?: number | null;
  peringatan_kapasitas?: string | null;

  // Matriks Kuadran
  kuadran: KuadranMatriks;

  // Rincian Sesi
  sesi_ber_order: SesiOperasiDetail[];
  sesi_tanpa_order: SesiOperasiDetail[];
}

export interface AgregatMetrikGroup {
  nama_grup: string;
  total_aset: number;
  total_nilai_perolehan: number;
  total_proyeksi: number;
  total_proyeksi_prorata: number;
  total_pendapatan: number;
  total_jam_pakai: number;
  total_jam_tersedia_netto: number;
  ut_rata_rata: number;
  ra_agregat: number | null; // RA agregat = ΣR / ΣP prorata
  skor_rata_rata: number | null;
}

/**
 * Helper untuk menghitung jam kapasitas bruto standar
 */
export function getKapasitasBrutoStandar(
  basis: BasisOperasiAset,
  periodeType: 'bulan_ini' | 'ytd' | 'tahunan',
  totalHariPeriode: number
): number {
  const isContinuous = basis === 'Continuous Operation';
  if (periodeType === 'bulan_ini') {
    // Sesuai standar server.ts & spesifikasi: 176 jam/bulan (Working Day) atau 720 jam/bulan (Continuous)
    return isContinuous ? (30 * 24) : (22 * 8); // 720 jam vs 176 jam
  }
  if (isContinuous) {
    return totalHariPeriode * 24;
  }
  // Working Day Based: 8 jam/hari kerja (rata-rata 5/7 dari hari kalender)
  const hariKerja = Math.max(1, Math.round(totalHariPeriode * (5 / 7)));
  return hariKerja * 8;
}

/**
 * Menghitung Metrik Terpadu untuk satu Aset
 */
export function hitungMetrikUtilisasiAset(input: {
  id_aset: string;
  nama_aset: string;
  kategori: string;
  nama_bidang: string;
  nama_cabang?: string;
  basis_operasi?: BasisOperasiAset;
  nilai_perolehan?: number | null;
  proyeksi_tahunan?: number | null;
  tanggal_terima?: string;
  tahun_evaluasi: number;
  cut_off_date?: Date;
  periode_mode: 'bulan_ini' | 'ytd' | 'tahunan';
  op_sessions: Array<{
    mulai: string;
    selesai: string;
    durasi_jam: number;
    nomor_order?: string | null;
    pic?: string;
  }>;
  maint_sessions: Array<{
    mulai: string;
    selesai: string;
    durasi_jam: number;
  }>;
  alokasi_pendapatan_sesi_map?: Map<string, number>; // key: `${mulai}_${selesai}`, val: pendapatan
}): MetrikAsetPeriode {
  const basis = input.basis_operasi || 'Working Day Based';
  const now = input.cut_off_date || new Date();
  
  // Cut-off H-1: Kemarin 23:59:59.999
  const cutOffTime = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999).getTime();

  // Tentukan batas tanggal periode
  let startPeriodeMs: number;
  let endPeriodeMs: number = Math.min(new Date(input.tahun_evaluasi, 11, 31, 23, 59, 59, 999).getTime(), cutOffTime);

  if (input.periode_mode === 'bulan_ini') {
    startPeriodeMs = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0).getTime();
  } else {
    // YTD atau Tahunan
    startPeriodeMs = new Date(input.tahun_evaluasi, 0, 1, 0, 0, 0, 0).getTime();
  }

  // Jika aset baru diterima setelah 1 Januari, periode efektif dihitung dari tanggal terima
  if (input.tanggal_terima) {
    const tglTerimaMs = new Date(input.tanggal_terima).getTime();
    if (!isNaN(tglTerimaMs) && tglTerimaMs > startPeriodeMs && tglTerimaMs <= endPeriodeMs) {
      startPeriodeMs = tglTerimaMs;
    }
  }

  // Hitung jumlah hari kalender periode
  const msInDay = 86400000;
  const totalHariPeriode = Math.max(1, Math.round((endPeriodeMs - startPeriodeMs) / msInDay) + 1);

  // Periode Efektif Setahun Penuh (untuk P prorata)
  const startTahunMs = input.tanggal_terima 
    ? Math.max(new Date(input.tahun_evaluasi, 0, 1).getTime(), new Date(input.tanggal_terima).getTime())
    : new Date(input.tahun_evaluasi, 0, 1).getTime();
  const endTahunMs = new Date(input.tahun_evaluasi, 11, 31, 23, 59, 59, 999).getTime();
  const totalHariEfektifSetahun = Math.max(1, Math.round((endTahunMs - startTahunMs) / msInDay) + 1);
  const hariBerjalanSetahun = Math.max(1, Math.min(totalHariEfektifSetahun, Math.round((cutOffTime - startTahunMs) / msInDay) + 1));

  // 1. Hitung Downtime Pemeliharaan pada periode ini
  let downtime = 0;
  for (const m of input.maint_sessions || []) {
    const sTime = new Date(m.selesai || m.mulai).getTime();
    if (!isNaN(sTime) && sTime >= startPeriodeMs && sTime <= endPeriodeMs) {
      downtime += Number(m.durasi_jam) || 0;
    }
  }

  // 2. Hitung Jam Tersedia Netto (A = Kapasitas basis - downtime)
  const kapasitasBruto = getKapasitasBrutoStandar(basis, input.periode_mode, totalHariPeriode);
  const jamTersediaNetto = Math.max(1, kapasitasBruto - downtime);

  // 3. Saring Sesi Operasional pada periode ini
  let jamPakaiTotal = 0;
  let jamPakaiDenganOrder = 0;
  let jamPakaiTanpaOrder = 0;
  let pendapatanTotal = 0;

  const sesiBerOrder: SesiOperasiDetail[] = [];
  const sesiTanpaOrder: SesiOperasiDetail[] = [];

  for (const op of input.op_sessions || []) {
    const sTime = new Date(op.selesai || op.mulai).getTime();
    if (!isNaN(sTime) && sTime >= startPeriodeMs && sTime <= endPeriodeMs) {
      const jam = Number(op.durasi_jam) || 0;
      jamPakaiTotal += jam;

      const sessionKey = `${op.mulai}_${op.selesai}`;
      const rev = input.alokasi_pendapatan_sesi_map?.get(sessionKey) || 0;

      if (op.nomor_order && op.nomor_order.trim()) {
        jamPakaiDenganOrder += jam;
        pendapatanTotal += rev;
        sesiBerOrder.push({
          mulai: op.mulai,
          selesai: op.selesai,
          durasi_jam: jam,
          nomor_order: op.nomor_order,
          pendapatan_teralokasi: rev,
          pic: op.pic
        });
      } else {
        jamPakaiTanpaOrder += jam;
        sesiTanpaOrder.push({
          mulai: op.mulai,
          selesai: op.selesai,
          durasi_jam: jam,
          nomor_order: null,
          pendapatan_teralokasi: 0,
          pic: op.pic
        });
      }
    }
  }

  // 4. Hitung UT (Utilisasi Waktu) = Jam Pakai / A
  const utPersen = Math.min(100, Number(((jamPakaiTotal / jamTersediaNetto) * 100).toFixed(1)));
  let utKlasifikasi: KlasifikasiStatus = 'Rendah';
  if (utPersen >= UT_THRESHOLDS.OPTIMAL) utKlasifikasi = 'Optimal';
  else if (utPersen >= UT_THRESHOLDS.MODERAT) utKlasifikasi = 'Moderat';

  // 5. Hitung P Prorata & RA (Pencapaian Pendapatan)
  let pProrata: number | null = null;
  let raPersen: number | null = null;
  let raKlasifikasi: KlasifikasiStatus = 'N/A';

  const proyeksiTahun = Number(input.proyeksi_tahunan);
  const hasProyeksi = !isNaN(proyeksiTahun) && proyeksiTahun > 0;

  if (hasProyeksi) {
    if (input.periode_mode === 'bulan_ini') {
      pProrata = Math.round(proyeksiTahun / 12);
    } else {
      pProrata = Math.round(proyeksiTahun * (hariBerjalanSetahun / totalHariEfektifSetahun));
    }

    if (pProrata > 0) {
      raPersen = Number(((pendapatanTotal / pProrata) * 100).toFixed(1));
      if (raPersen >= RA_THRESHOLDS.OPTIMAL) raKlasifikasi = 'Optimal';
      else if (raPersen >= RA_THRESHOLDS.MODERAT) raKlasifikasi = 'Moderat';
      else raKlasifikasi = 'Rendah';
    } else {
      raPersen = 0;
      raKlasifikasi = 'Rendah';
    }
  }

  // 6. Hitung YR (Yield Modal) = R teranualisasi / nilai_perolehan
  let yrPersen: number | null = null;
  let yrLabel: string | undefined = undefined;
  const nilaiPerolehan = Number(input.nilai_perolehan);
  const hasPerolehan = !isNaN(nilaiPerolehan) && nilaiPerolehan > 0;

  if (hasPerolehan) {
    if (input.periode_mode === 'bulan_ini') {
      const rTeranualisasi = pendapatanTotal * 12;
      yrPersen = Number(((rTeranualisasi / nilaiPerolehan) * 100).toFixed(1));
      yrLabel = `${yrPersen}% / tahun`;
    } else {
      if (hariBerjalanSetahun < 30) {
        yrLabel = 'Data belum cukup';
      } else {
        const rTeranualisasi = (pendapatanTotal * 365) / hariBerjalanSetahun;
        yrPersen = Number(((rTeranualisasi / nilaiPerolehan) * 100).toFixed(1));
        yrLabel = `${yrPersen}% / tahun`;
      }
    }
  } else {
    yrLabel = '-';
  }

  // 7. Hitung Skor Terpadu = 50% * UT + 50% * min(RA, 120%)
  let skorTerpadu: number | null = null;
  let skorKlasifikasi: KlasifikasiStatus = 'N/A';

  if (raPersen !== null) {
    const cappedRa = Math.min(raPersen, SKOR_CONFIG.MAX_RA_CAP);
    skorTerpadu = Number(((SKOR_CONFIG.BOBOT_UT * utPersen) + (SKOR_CONFIG.BOBOT_RA * cappedRa)).toFixed(1));
    if (skorTerpadu >= 80) skorKlasifikasi = 'Optimal';
    else if (skorTerpadu >= 60) skorKlasifikasi = 'Moderat';
    else skorKlasifikasi = 'Rendah';
  }

  // 8. Tarif Efektif (Rolling 3 Bulan Terakhir)
  // Saring sesi ber-order dalam 90 hari terakhir
  const ninetyDaysAgoMs = cutOffTime - (90 * msInDay);
  let revRolling3M = 0;
  let jamRolling3M = 0;

  for (const op of input.op_sessions || []) {
    const sTime = new Date(op.selesai || op.mulai).getTime();
    if (!isNaN(sTime) && sTime >= ninetyDaysAgoMs && sTime <= cutOffTime && op.nomor_order && op.nomor_order.trim()) {
      const jam = Number(op.durasi_jam) || 0;
      const rev = input.alokasi_pendapatan_sesi_map?.get(`${op.mulai}_${op.selesai}`) || 0;
      revRolling3M += rev;
      jamRolling3M += jam;
    }
  }

  let tarifEfektif: number | null = null;
  if (jamRolling3M > 0) {
    tarifEfektif = Math.round(revRolling3M / jamRolling3M);
  } else if (jamPakaiDenganOrder > 0) {
    tarifEfektif = Math.round(pendapatanTotal / jamPakaiDenganOrder);
  }

  // 9. Proyeksi Akhir Tahun & Jam Minimum Target
  let proyeksiAkhirTahun: number | null = null;
  let jamMinimumTarget: number | null = null;
  let peringatanKapasitas: string | null = null;

  // Hitung jam tersedia netto sisa tahun
  const sisaHariTahun = Math.max(0, Math.round((endTahunMs - cutOffTime) / msInDay));
  const kapasitasBrutoSisaTahun = getKapasitasBrutoStandar(basis, 'tahunan', sisaHariTahun);
  // Asumsi proporsi downtime pemeliharaan historis
  const jamTersediaSisaTahun = Math.max(0, kapasitasBrutoSisaTahun);

  // Proyeksi akhir tahun ditampilkan jika data minimal 2 bulan (hariBerjalanSetahun >= 60)
  if (hariBerjalanSetahun >= 60 && tarifEfektif && tarifEfektif > 0) {
    const utRolling = jamRolling3M > 0 
      ? Math.min(1, jamRolling3M / Math.max(1, getKapasitasBrutoStandar(basis, 'tahunan', 90)))
      : (utPersen / 100);

    const sisaPendapatanEstimasi = Math.round(jamTersediaSisaTahun * utRolling * tarifEfektif);
    proyeksiAkhirTahun = pendapatanTotal + sisaPendapatanEstimasi;
  }

  // Jam minimum untuk mencapai target = proyeksi tahun / tarif efektif
  if (hasProyeksi && tarifEfektif && tarifEfektif > 0) {
    jamMinimumTarget = Number((proyeksiTahun / tarifEfektif).toFixed(1));

    // Cek apakah melebihi jam tersedia setahun penuh
    const kapasitasSetahunPenuh = getKapasitasBrutoStandar(basis, 'tahunan', totalHariEfektifSetahun);
    if (jamMinimumTarget > kapasitasSetahunPenuh) {
      peringatanKapasitas = 'Target tidak realistis terhadap kapasitas jam alat';
    }
  }

  // 10. Matriks Kuadran 2x2 (UT vs RA)
  let kuadran: KuadranMatriks = 'Belum Terklasifikasi';
  if (raPersen !== null) {
    const isUtTinggi = utPersen >= UT_THRESHOLDS.OPTIMAL;
    const isRaTinggi = raPersen >= RA_THRESHOLDS.MODERAT;

    if (isUtTinggi && isRaTinggi) {
      kuadran = 'Bintang';
    } else if (!isUtTinggi && isRaTinggi) {
      kuadran = 'Niche Bernilai Tinggi';
    } else if (isUtTinggi && !isRaTinggi) {
      kuadran = 'Sibuk Tapi Kurang Menghasilkan';
    } else {
      kuadran = 'Idle dan Tidak Produktif';
    }
  }

  return {
    id_aset: input.id_aset,
    nama_aset: input.nama_aset,
    kategori: input.kategori,
    nama_bidang: input.nama_bidang,
    nama_cabang: input.nama_cabang,
    nilai_perolehan: input.nilai_perolehan,
    proyeksi_tahunan: input.proyeksi_tahunan,
    jam_pakai_total: Number(jamPakaiTotal.toFixed(1)),
    jam_pakai_dengan_order: Number(jamPakaiDenganOrder.toFixed(1)),
    jam_pakai_tanpa_order: Number(jamPakaiTanpaOrder.toFixed(1)),
    downtime_pemeliharaan: Number(downtime.toFixed(1)),
    jam_tersedia_netto: Number(jamTersediaNetto.toFixed(1)),
    ut_persen: utPersen,
    ut_klasifikasi: utKlasifikasi,
    pendapatan_riil: pendapatanTotal,
    proyeksi_prorata: pProrata,
    ra_persen: raPersen,
    ra_klasifikasi: raKlasifikasi,
    yr_persen: yrPersen,
    yr_label: yrLabel,
    skor_terpadu: skorTerpadu,
    skor_klasifikasi: skorKlasifikasi,
    tarif_efektif_per_jam: tarifEfektif,
    proyeksi_akhir_tahun: proyeksiAkhirTahun,
    jam_minimum_target: jamMinimumTarget,
    peringatan_kapasitas: peringatanKapasitas,
    kuadran,
    sesi_ber_order: sesiBerOrder,
    sesi_tanpa_order: sesiTanpaOrder
  };
}

/**
 * Agregasi Metrik Per Bidang atau Per Kategori
 * RA agregat = ΣR / ΣP prorata
 */
export function agregasikanMetrik(
  metrikList: MetrikAsetPeriode[],
  groupBy: 'bidang' | 'kategori'
): AgregatMetrikGroup[] {
  const map = new Map<string, AgregatMetrikGroup>();

  for (const item of metrikList) {
    const key = groupBy === 'bidang' ? item.nama_bidang : item.kategori;
    if (!key) continue;

    let group = map.get(key);
    if (!group) {
      group = {
        nama_grup: key,
        total_aset: 0,
        total_nilai_perolehan: 0,
        total_proyeksi: 0,
        total_proyeksi_prorata: 0,
        total_pendapatan: 0,
        total_jam_pakai: 0,
        total_jam_tersedia_netto: 0,
        ut_rata_rata: 0,
        ra_agregat: null,
        skor_rata_rata: null
      };
      map.set(key, group);
    }

    group.total_aset += 1;
    group.total_nilai_perolehan += Number(item.nilai_perolehan) || 0;
    group.total_proyeksi += Number(item.proyeksi_tahunan) || 0;
    group.total_proyeksi_prorata += Number(item.proyeksi_prorata) || 0;
    group.total_pendapatan += item.pendapatan_riil;
    group.total_jam_pakai += item.jam_pakai_total;
    group.total_jam_tersedia_netto += item.jam_tersedia_netto;
  }

  const result: AgregatMetrikGroup[] = [];
  for (const group of map.values()) {
    // UT rata-rata tertimbang
    if (group.total_jam_tersedia_netto > 0) {
      group.ut_rata_rata = Number(((group.total_jam_pakai / group.total_jam_tersedia_netto) * 100).toFixed(1));
    }
    // RA Agregat = ΣR / ΣP prorata
    if (group.total_proyeksi_prorata > 0) {
      group.ra_agregat = Number(((group.total_pendapatan / group.total_proyeksi_prorata) * 100).toFixed(1));
    }
    // Skor Rata-rata
    if (group.ra_agregat !== null) {
      const capped = Math.min(group.ra_agregat, SKOR_CONFIG.MAX_RA_CAP);
      group.skor_rata_rata = Number(((SKOR_CONFIG.BOBOT_UT * group.ut_rata_rata) + (SKOR_CONFIG.BOBOT_RA * capped)).toFixed(1));
    }
    result.push(group);
  }

  // Sort descending by total pendapatan
  return result.sort((a, b) => b.total_pendapatan - a.total_pendapatan);
}
