/**
 * Engine Alokasi Pendapatan Riil Aset
 * Berdasarkan Nilai Perolehan Aset, Jam Pakai Sesi, dan Nilai Order
 * 
 * Aturan Alokasi:
 * 1. Seluruh sesi di riwayat_operasi dengan nomor_order tersebut, sudah check-in dan tanggal check-in <= cut-off H-1.
 * 2. bobot_sesi = nilai_perolehan aset * jam_pakai sesi. Abaikan sesi tanpa nilai_perolehan (tandai tidak_dialokasikan).
 * 3. pendapatan_sesi = nilai_order * bobot_sesi / jumlah bobot semua sesi pada order itu.
 * 4. Pembulatan ke Rupiah bulat. Selisih pembulatan ditambahkan ke sesi dengan bobot terbesar. Total alokasi order = nilai_order tepat.
 * 5. Pendapatan sebuah aset pada periode tertentu = jumlah pendapatan_sesi miliknya yang tanggal check-in-nya berada pada periode itu.
 * 6. Sesi tanpa nomor order tidak menghasilkan pendapatan (non-revenue) tetapi jam pakainya tetap dihitung di utilisasi waktu.
 */

export interface SesiOperasiInput {
  id_aset: string;
  nama_aset: string;
  nilai_perolehan?: number | null;
  mulai: string;
  selesai: string;
  durasi_jam: number;
  nomor_order?: string | null;
  pic?: string;
}

export interface AlokasiSesiDetail {
  id_aset: string;
  nama_aset: string;
  nilai_perolehan: number;
  durasi_jam: number;
  bobot: number; // nilai_perolehan * durasi_jam
  persentase: number; // (bobot / totalBobot) * 100
  pendapatan: number; // Nilai Rupiah bulat tepat
  mulai: string;
  selesai: string;
  pic?: string;
}

export interface SesiTidakDialokasikan {
  id_aset: string;
  nama_aset: string;
  nilai_perolehan?: number | null;
  durasi_jam: number;
  mulai: string;
  selesai: string;
  alasan: string;
  pic?: string;
}

export interface HasilAlokasiOrder {
  nomor_order: string;
  nilai_order: number;
  total_bobot: number;
  total_jam_teralokasi: number;
  rincian: AlokasiSesiDetail[];
  sesi_tidak_dialokasikan: SesiTidakDialokasikan[];
  catatan: string;
  cut_off_digunakan: string;
}

export interface HasilPendapatanAsetPeriode {
  id_aset: string;
  nama_aset: string;
  nilai_perolehan?: number | null;
  periode_awal: string;
  periode_akhir: string;
  total_pendapatan: number;
  total_jam_revenue: number;
  rincian_sesi: Array<{
    nomor_order: string;
    mulai: string;
    selesai: string;
    durasi_jam: number;
    bobot_sesi: number;
    pendapatan_sesi: number;
  }>;
}

/**
 * Menghitung waktu batas H-1 (kemarin 23:59:59.999 / sebelum jam 00:00:00 hari ini)
 */
export function getDefaultCutOffHMinus1(baseDate = new Date()): Date {
  return new Date(baseDate.getFullYear(), baseDate.getMonth(), baseDate.getDate() - 1, 23, 59, 59, 999);
}

/**
 * Engine Alokasi untuk sebuah Order berdasarkan seluruh sesi yang masuk
 */
export function hitungAlokasiOrder(
  nomorOrder: string,
  nilaiOrder: number,
  allSessions: SesiOperasiInput[],
  cutOffDate?: Date
): HasilAlokasiOrder {
  const cleanNomor = (nomorOrder || '').trim().toUpperCase();
  const targetCutOff = cutOffDate || getDefaultCutOffHMinus1();
  const targetCutOffMs = targetCutOff.getTime();

  const rincian: AlokasiSesiDetail[] = [];
  const sesiTidakDialokasikan: SesiTidakDialokasikan[] = [];

  // Filter 1: Hanya sesi dengan nomor order ini
  const orderSessions = allSessions.filter((s) => {
    return s.nomor_order && s.nomor_order.trim().toUpperCase() === cleanNomor;
  });

  // Filter 2 & Klasifikasi: Selesai check-in dan cut-off H-1
  for (const s of orderSessions) {
    if (!s.selesai) {
      sesiTidakDialokasikan.push({
        id_aset: s.id_aset,
        nama_aset: s.nama_aset,
        nilai_perolehan: s.nilai_perolehan,
        durasi_jam: s.durasi_jam || 0,
        mulai: s.mulai,
        selesai: s.selesai || '',
        alasan: 'Sesi operasional masih berjalan (belum check-in)',
        pic: s.pic
      });
      continue;
    }

    const selesaiTime = new Date(s.selesai).getTime();
    if (isNaN(selesaiTime) || selesaiTime > targetCutOffMs) {
      sesiTidakDialokasikan.push({
        id_aset: s.id_aset,
        nama_aset: s.nama_aset,
        nilai_perolehan: s.nilai_perolehan,
        durasi_jam: s.durasi_jam || 0,
        mulai: s.mulai,
        selesai: s.selesai,
        alasan: 'Tanggal check-in melebihi cut-off H-1 (belum masuk periode cut-off)',
        pic: s.pic
      });
      continue;
    }

    // Validasi Nilai Perolehan
    const nilaiPerolehan = Number(s.nilai_perolehan);
    if (!nilaiPerolehan || isNaN(nilaiPerolehan) || nilaiPerolehan <= 0) {
      sesiTidakDialokasikan.push({
        id_aset: s.id_aset,
        nama_aset: s.nama_aset,
        nilai_perolehan: s.nilai_perolehan,
        durasi_jam: s.durasi_jam || 0,
        mulai: s.mulai,
        selesai: s.selesai,
        alasan: 'Aset belum memiliki Nilai Perolehan (> 0)',
        pic: s.pic
      });
      continue;
    }

    // Validasi Durasi Jam Pakai
    const durasiJam = Number(s.durasi_jam) || 0;
    if (durasiJam <= 0) {
      sesiTidakDialokasikan.push({
        id_aset: s.id_aset,
        nama_aset: s.nama_aset,
        nilai_perolehan: nilaiPerolehan,
        durasi_jam: durasiJam,
        mulai: s.mulai,
        selesai: s.selesai,
        alasan: 'Durasi pemakaian aset 0 jam',
        pic: s.pic
      });
      continue;
    }

    const bobot = nilaiPerolehan * durasiJam;
    rincian.push({
      id_aset: s.id_aset,
      nama_aset: s.nama_aset,
      nilai_perolehan: nilaiPerolehan,
      durasi_jam: durasiJam,
      bobot,
      persentase: 0,
      pendapatan: 0,
      mulai: s.mulai,
      selesai: s.selesai,
      pic: s.pic
    });
  }

  // Jika tidak ada sesi valid atau nilai_order <= 0
  const cleanNilaiOrder = Math.max(0, Math.round(Number(nilaiOrder) || 0));
  const totalBobot = rincian.reduce((sum, item) => sum + item.bobot, 0);
  const totalJam = rincian.reduce((sum, item) => sum + item.durasi_jam, 0);

  if (totalBobot <= 0 || rincian.length === 0 || cleanNilaiOrder <= 0) {
    return {
      nomor_order: cleanNomor,
      nilai_order: cleanNilaiOrder,
      total_bobot: 0,
      total_jam_teralokasi: 0,
      rincian: [],
      sesi_tidak_dialokasikan: sesiTidakDialokasikan,
      catatan: 'Perhitungan dinamis dari seluruh sesi selesai hingga cut-off H-1. Angka alokasi dapat bergeser jika terdapat sesi operasional baru yang selesai menggunakan nomor order ini.',
      cut_off_digunakan: targetCutOff.toISOString()
    };
  }

  // Langkah 3 & 4: Hitung alokasi pendapatan dan pembulatan Rupiah bulat
  let totalAllocated = 0;
  let maxBobot = -1;
  let maxBobotIndex = 0;

  for (let i = 0; i < rincian.length; i++) {
    const item = rincian[i];
    item.persentase = Number(((item.bobot / totalBobot) * 100).toFixed(2));
    
    // Alokasi proporsional: nilai_order * bobot / totalBobot
    const rawPendapatan = (cleanNilaiOrder * item.bobot) / totalBobot;
    item.pendapatan = Math.round(rawPendapatan);
    totalAllocated += item.pendapatan;

    if (item.bobot > maxBobot) {
      maxBobot = item.bobot;
      maxBobotIndex = i;
    }
  }

  // Selisih pembulatan ditambahkan ke sesi dengan bobot terbesar sehingga total alokasi order = nilai_order tepat
  const remainder = cleanNilaiOrder - totalAllocated;
  if (remainder !== 0 && rincian.length > 0) {
    rincian[maxBobotIndex].pendapatan += remainder;
  }

  return {
    nomor_order: cleanNomor,
    nilai_order: cleanNilaiOrder,
    total_bobot: totalBobot,
    total_jam_teralokasi: totalJam,
    rincian,
    sesi_tidak_dialokasikan: sesiTidakDialokasikan,
    catatan: 'Perhitungan dinamis dari seluruh sesi selesai hingga cut-off H-1. Angka alokasi dapat bergeser jika terdapat sesi operasional baru yang selesai menggunakan nomor order ini.',
    cut_off_digunakan: targetCutOff.toISOString()
  };
}

/**
 * Menghitung akumulasi pendapatan riil untuk sebuah aset pada rentang periode tertentu
 */
export function hitungPendapatanRiilAset(
  asetId: string,
  periodeAwalStr: string,
  periodeAkhirStr: string,
  ordersList: Array<{ nomor_order: string; nilai_order: number }>,
  allSessions: SesiOperasiInput[],
  cutOffDate?: Date
): HasilPendapatanAsetPeriode {
  const targetCutOff = cutOffDate || getDefaultCutOffHMinus1();
  const startMs = periodeAwalStr ? new Date(`${periodeAwalStr}T00:00:00.000Z`).getTime() : 0;
  const endMs = periodeAkhirStr ? new Date(`${periodeAkhirStr}T23:59:59.999Z`).getTime() : Infinity;

  // Jalankan alokasi untuk setiap order
  const orderAllocationMap = new Map<string, HasilAlokasiOrder>();
  for (const ord of ordersList) {
    const res = hitungAlokasiOrder(ord.nomor_order, ord.nilai_order, allSessions, targetCutOff);
    orderAllocationMap.set(ord.nomor_order.toUpperCase(), res);
  }

  let totalPendapatan = 0;
  let totalJamRevenue = 0;
  let namaAset = '';
  let nilaiPerolehan: number | undefined = undefined;
  const rincianSesi: Array<{
    nomor_order: string;
    mulai: string;
    selesai: string;
    durasi_jam: number;
    bobot_sesi: number;
    pendapatan_sesi: number;
  }> = [];

  for (const [nomorOrder, alokasi] of orderAllocationMap.entries()) {
    for (const r of alokasi.rincian) {
      if (r.id_aset === asetId) {
        namaAset = r.nama_aset;
        nilaiPerolehan = r.nilai_perolehan;
        const selesaiMs = new Date(r.selesai).getTime();

        // Cek apakah tanggal check-in berada pada periode tersebut
        if (selesaiMs >= startMs && selesaiMs <= endMs) {
          totalPendapatan += r.pendapatan;
          totalJamRevenue += r.durasi_jam;
          rincianSesi.push({
            nomor_order: nomorOrder,
            mulai: r.mulai,
            selesai: r.selesai,
            durasi_jam: r.durasi_jam,
            bobot_sesi: r.bobot,
            pendapatan_sesi: r.pendapatan
          });
        }
      }
    }
  }

  return {
    id_aset: asetId,
    nama_aset: namaAset || asetId,
    nilai_perolehan: nilaiPerolehan,
    periode_awal: periodeAwalStr || 'All-time',
    periode_akhir: periodeAkhirStr || 'H-1',
    total_pendapatan: totalPendapatan,
    total_jam_revenue: totalJamRevenue,
    rincian_sesi: rincianSesi
  };
}
