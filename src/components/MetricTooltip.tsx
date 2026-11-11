import React, { useState, useRef, useEffect } from 'react';
import { HelpCircle, X, Info } from 'lucide-react';

export type MetricType = 
  | 'UT' 
  | 'RA' 
  | 'YR' 
  | 'SKOR' 
  | 'KUADRAN' 
  | 'TARIF' 
  | 'PROYEKSI' 
  | 'JAM_MINIMUM' 
  | 'KAPASITAS_NETTO'
  | 'CUTOFF';

interface MetricInfoData {
  title: string;
  formula: string;
  description: string;
  details?: string[];
  thresholds?: Array<{ label: string; value: string; color: string }>;
}

export const METRIC_DEFINITIONS: Record<MetricType, MetricInfoData> = {
  UT: {
    title: 'UT (Utilisasi Waktu)',
    formula: 'UT (%) = (Total Jam Operasi / Jam Bersih A) × 100%',
    description: 'Mengukur seberapa optimal alat bekerja terhadap kapasitas jam bersih yang tersedia setelah dikurangi downtime pemeliharaan.',
    details: [
      'Total Jam Operasi = Jam Sesi Ber-Order + Jam Sesi Internal (Non-Revenue)',
      'Jam Bersih A = Kapasitas Standar - Downtime Pemeliharaan',
      'Basis Working Day (WD) = 8 jam/hari kerja (Senin-Jumat)',
      'Basis Continuous 24/7 = 24 jam/hari kalender'
    ],
    thresholds: [
      { label: 'Optimal', value: '≥ 70%', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
      { label: 'Moderat', value: '50% - 69.9%', color: 'bg-amber-100 text-amber-800 border-amber-300' },
      { label: 'Rendah', value: '< 50%', color: 'bg-rose-100 text-rose-800 border-rose-300' }
    ]
  },
  RA: {
    title: 'RA (Pencapaian Pendapatan)',
    formula: 'RA (%) = (Pendapatan Riil R / Target Prorata P) × 100%',
    description: 'Mengukur rasio pencapaian pendapatan riil yang dihasilkan alat terhadap target proyeksi pendapatan prorata per tanggal berjalan.',
    details: [
      'Pendapatan Riil R = Total alokasi pendapatan dari sesi ber-order',
      'P prorata (Bulan Ini) = Proyeksi Tahunan / 12',
      'P prorata (YTD/Tahun) = Proyeksi Tahunan × (Hari Berjalan H-1 / Total Hari Periode Efektif)',
      'Cut-Off H-1: Menghitung sesi selesai sampai kemarin 23:59:59'
    ],
    thresholds: [
      { label: 'Optimal', value: '≥ 100%', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
      { label: 'Moderat', value: '70% - 99.9%', color: 'bg-amber-100 text-amber-800 border-amber-300' },
      { label: 'Rendah', value: '< 70%', color: 'bg-rose-100 text-rose-800 border-rose-300' }
    ]
  },
  YR: {
    title: 'YR (Yield Modal / ROI Tahunan)',
    formula: 'YR (%/tahun) = (R Teranualisasi / Nilai Perolehan) × 100%',
    description: 'Mengukur imbal hasil finansial tahunan yang dihasilkan alat terhadap harga modal/nilai perolehan saat pembelian.',
    details: [
      'R Teranualisasi (Bulan Ini) = Pendapatan Riil R × 12',
      'R Teranualisasi (YTD/Tahun) = Pendapatan Riil R × (365 / Hari Berjalan)',
      'Tampil "Data belum cukup" jika hari berjalan < 30 hari pada YTD'
    ]
  },
  SKOR: {
    title: 'Skor Kinerja Terpadu',
    formula: 'Skor (%) = (50% × UT) + (50% × min(RA, 120%))',
    description: 'Nilai evaluasi komprehensif yang menyeimbangkan efisiensi jam operasional fisik (50%) dan produktivitas pendapatan (50%).',
    details: [
      'Bobot berimbang 50:50 antara Waktu dan Pendapatan',
      'Pencapaian RA dicap maksimal 120% agar order bernilai ekstrim tidak mendistorsi skor',
      'Hanya dihitung jika aset memiliki target proyeksi pendapatan (RA)'
    ],
    thresholds: [
      { label: 'Optimal', value: '≥ 80%', color: 'bg-emerald-100 text-emerald-800 border-emerald-300' },
      { label: 'Moderat', value: '60% - 79.9%', color: 'bg-amber-100 text-amber-800 border-amber-300' },
      { label: 'Rendah', value: '< 60%', color: 'bg-rose-100 text-rose-800 border-rose-300' }
    ]
  },
  KUADRAN: {
    title: 'Matriks Portofolio 2×2',
    formula: 'Sumbu X = UT (Ambang 70%) | Sumbu Y = RA (Ambang 70%)',
    description: 'Pemetaan posisi strategis alat untuk menentukan kebijakan operasional dan investasi manajemen.',
    details: [
      '1. Bintang (Star): UT ≥ 70% dan RA ≥ 70% (Performa puncak)',
      '2. Niche Bernilai: UT < 70% dan RA ≥ 70% (Tarif tinggi per jam)',
      '3. Sibuk Kurang Hasil: UT ≥ 70% dan RA < 70% (Banyak order tarif rendah/internal)',
      '4. Idle & Non-Produktif: UT < 70% dan RA < 70% (Perlu evaluasi/transfer)'
    ]
  },
  TARIF: {
    title: 'Tarif Efektif per Jam',
    formula: 'Tarif (Rp/jam) = Σ Pendapatan Sesi / Σ Jam Sesi Ber-Order',
    description: 'Rata-rata pendapatan riil per jam operasi pada sesi yang menggunakan nomor order dalam 3 bulan terakhir (rolling 90 hari).'
  },
  PROYEKSI: {
    title: 'Proyeksi Pendapatan Akhir Tahun',
    formula: 'R Akhir = R YTD + (Jam Sisa Tahun × UT 3M × Tarif Efektif)',
    description: 'Estimasi total pendapatan alat hingga 31 Desember berdasarkan tren utilisasi dan tarif efektif 3 bulan terakhir.',
    details: [
      'Hanya dihitung jika data berjalan minimal 2 bulan (≥ 60 hari)',
      'Menggunakan tren UT rolling 3 bulan dan tarif per jam historis'
    ]
  },
  JAM_MINIMUM: {
    title: 'Jam Minimum Target',
    formula: 'Jam Minimum = Proyeksi Pendapatan Tahunan / Tarif Efektif',
    description: 'Berapa jam operasi ber-order yang harus dicapai alat agar target proyeksi tahunan dapat terpenuhi.',
    details: [
      'Jika Jam Minimum > Kapasitas Bruto Setahun, sistem memberi peringatan bahwa target tidak realistis terhadap fisik alat.'
    ]
  },
  KAPASITAS_NETTO: {
    title: 'Kapasitas Jam Netto (A)',
    formula: 'A = Kapasitas Standar Bruto - Downtime Pemeliharaan',
    description: 'Jumlah jam maksimal yang benar-benar siap beroperasi setelah dikurangi masa perbaikan teknis.'
  },
  CUTOFF: {
    title: 'Aturan Cut-Off H-1',
    formula: 'Selesai Check-In ≤ Kemarin Pukul 23:59:59',
    description: 'Semua metrik dievaluasi berdasarkan data kemarin (H-1). Sesi yang diselesaikan hari ini baru akan masuk ke kalkulasi besok hari.'
  }
};

interface MetricTooltipProps {
  type?: MetricType;
  customTitle?: string;
  customFormula?: string;
  customDescription?: string;
  customDetails?: string[];
  customThresholds?: Array<{ label: string; value: string; color: string }>;
  position?: 'top' | 'bottom' | 'left' | 'right';
  className?: string;
}

export const MetricTooltip: React.FC<MetricTooltipProps> = ({
  type = 'UT',
  customTitle,
  customFormula,
  customDescription,
  customDetails,
  customThresholds,
  position = 'bottom',
  className = ''
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const data = METRIC_DEFINITIONS[type] || METRIC_DEFINITIONS.UT;
  const title = customTitle || data.title;
  const formula = customFormula || data.formula;
  const description = customDescription || data.description;
  const details = customDetails || data.details;
  const thresholds = customThresholds || data.thresholds;

  // Handle click outside to close popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Position classes
  const positionClasses = {
    top: 'bottom-full mb-2 left-1/2 -translate-x-1/2',
    bottom: 'top-full mt-2 left-1/2 -translate-x-1/2 sm:left-auto sm:right-0 sm:translate-x-0',
    left: 'right-full mr-2 top-1/2 -translate-y-1/2',
    right: 'left-full ml-2 top-1/2 -translate-y-1/2'
  }[position];

  return (
    <div 
      ref={containerRef} 
      className={`relative inline-flex items-center align-middle ${className}`}
    >
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        onMouseEnter={() => setIsOpen(true)}
        className="p-0.5 text-slate-400 hover:text-[#005DAA] focus:text-[#005DAA] rounded transition-colors cursor-pointer"
        aria-label={`Informasi rumus ${title}`}
        title={`Klik untuk melihat rumus & keterangan ${title}`}
      >
        <HelpCircle className="w-3.5 h-3.5" />
      </button>

      {/* Floating Popover Card */}
      {isOpen && (
        <div 
          className={`absolute z-60 w-72 sm:w-80 bg-white rounded-xl shadow-xl border border-slate-200 p-3.5 text-slate-800 text-left animate-in fade-in zoom-in-95 font-sans ${positionClasses}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-start justify-between pb-2 border-b border-slate-100 gap-2">
            <div className="flex items-center space-x-1.5 min-w-0">
              <Info className="w-4 h-4 text-[#005DAA] shrink-0" />
              <h4 className="font-extrabold text-slate-900 text-xs truncate">
                {title}
              </h4>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 text-slate-400 hover:text-slate-600 rounded hover:bg-slate-100 cursor-pointer shrink-0"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Formula Badge */}
          <div className="mt-2 p-2 bg-blue-50/80 border border-blue-200 rounded-lg text-center">
            <span className="text-[10px] text-[#005DAA] font-bold block uppercase tracking-wider mb-0.5">
              Rumus Perhitungan:
            </span>
            <div className="font-mono font-bold text-xs text-[#005DAA] break-words">
              {formula}
            </div>
          </div>

          {/* Explanation Description */}
          <p className="mt-2 text-[11px] text-slate-600 leading-relaxed font-normal">
            {description}
          </p>

          {/* Bullet Details */}
          {details && details.length > 0 && (
            <div className="mt-2 pt-2 border-t border-slate-100 space-y-1">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block">
                Ketentuan &amp; Komponen:
              </span>
              <ul className="text-[10px] text-slate-600 space-y-0.5">
                {details.map((d, idx) => (
                  <li key={idx} className="flex items-start space-x-1.5 leading-snug">
                    <span className="text-[#005DAA] font-bold">•</span>
                    <span>{d}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Threshold Badges if applicable */}
          {thresholds && thresholds.length > 0 && (
            <div className="mt-2.5 pt-2 border-t border-slate-100">
              <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Klasifikasi Kategori:
              </span>
              <div className="grid grid-cols-3 gap-1.5 text-center text-[10px] font-bold font-mono">
                {thresholds.map((t, idx) => (
                  <div key={idx} className={`p-1 rounded border ${t.color}`}>
                    <div className="text-[9px] font-sans">{t.label}</div>
                    <div className="text-[10px]">{t.value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
