import React, { useState } from 'react';
import { MetrikAsetPeriode } from '../lib/utilisasi/metrikUtilisasi';
import { 
  Sparkles, 
  HelpCircle, 
  AlertCircle, 
  TrendingUp, 
  Activity, 
  ExternalLink,
  Info
} from 'lucide-react';
import { MetricTooltip } from './MetricTooltip';

interface MatriksUtilisasi2x2Props {
  metrikList: MetrikAsetPeriode[];
  onSelectAsset?: (asetId: string) => void;
  canViewFinancials: boolean;
}

export const MatriksUtilisasi2x2: React.FC<MatriksUtilisasi2x2Props> = ({
  metrikList,
  onSelectAsset,
  canViewFinancials
}) => {
  const [hoveredAsset, setHoveredAsset] = useState<MetrikAsetPeriode | null>(null);
  const [selectedKategori, setSelectedKategori] = useState<string>('ALL');

  // Filter aset yang memiliki metrik RA (punya proyeksi)
  const validAssets = metrikList.filter(a => a.ra_persen !== null && typeof a.ra_persen === 'number');

  const filteredAssets = selectedKategori === 'ALL'
    ? validAssets
    : validAssets.filter(a => a.kategori === selectedKategori);

  const categories = Array.from(new Set(validAssets.map(a => a.kategori).filter(Boolean)));

  // Hitung jumlah aset per kuadran
  const kuadranStats = {
    bintang: filteredAssets.filter(a => a.kuadran === 'Bintang').length,
    niche: filteredAssets.filter(a => a.kuadran === 'Niche Bernilai Tinggi').length,
    sibuk: filteredAssets.filter(a => a.kuadran === 'Sibuk Tapi Kurang Menghasilkan').length,
    idle: filteredAssets.filter(a => a.kuadran === 'Idle dan Tidak Produktif').length
  };

  if (!canViewFinancials) {
    return (
      <div className="bg-white p-6 rounded-2xl border border-slate-200 text-center space-y-2 text-xs text-slate-500">
        <Info className="w-6 h-6 text-slate-400 mx-auto" />
        <p className="font-semibold text-slate-700">Matriks 2x2 Portofolio Aset Terpadu</p>
        <p>Matriks evaluasi finansial dan produktivitas pendapatan khusus untuk role PUMA, PIC, dan Fungsi UMUM.</p>
      </div>
    );
  }

  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
              <Activity className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <div className="flex items-center space-x-1.5">
                <h3 className="text-sm font-extrabold text-slate-900 leading-tight">
                  Matriks Portofolio Produktivitas 2×2 (UT vs RA)
                </h3>
                <MetricTooltip type="KUADRAN" position="bottom" />
              </div>
              <p className="text-[11px] text-slate-500">
                Pemetaan kuadran strategis aset berdasarkan Utilisasi Waktu (X) dan Pencapaian Pendapatan (Y)
              </p>
            </div>
          </div>
        </div>

        {/* Filter Kategori */}
        <div className="flex items-center space-x-2 shrink-0">
          <label className="text-[11px] text-slate-500 font-semibold">Filter Kategori:</label>
          <select
            value={selectedKategori}
            onChange={(e) => setSelectedKategori(e.target.value)}
            className="p-1.5 border border-slate-200 rounded-lg text-xs font-semibold bg-slate-50 text-slate-700 outline-hidden"
          >
            <option value="ALL">Semua Kategori ({validAssets.length})</option>
            {categories.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Kuadran Summary Badges */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
        <div className="bg-emerald-50/70 border border-emerald-200 p-2.5 rounded-xl">
          <div className="flex items-center justify-between text-emerald-900 font-bold text-[11px]">
            <span>1. Bintang</span>
            <span className="font-mono bg-emerald-200/80 px-1.5 py-0.2 rounded text-[10px]">{kuadranStats.bintang}</span>
          </div>
          <p className="text-[10px] text-emerald-800 mt-0.5">UT ≥70% &amp; RA ≥70%</p>
        </div>

        <div className="bg-sky-50/70 border border-sky-200 p-2.5 rounded-xl">
          <div className="flex items-center justify-between text-sky-900 font-bold text-[11px]">
            <span>2. Niche Bernilai</span>
            <span className="font-mono bg-sky-200/80 px-1.5 py-0.2 rounded text-[10px]">{kuadranStats.niche}</span>
          </div>
          <p className="text-[10px] text-sky-800 mt-0.5">UT &lt;70% &amp; RA ≥70%</p>
        </div>

        <div className="bg-amber-50/70 border border-amber-200 p-2.5 rounded-xl">
          <div className="flex items-center justify-between text-amber-900 font-bold text-[11px]">
            <span>3. Sibuk Kurang Hasil</span>
            <span className="font-mono bg-amber-200/80 px-1.5 py-0.2 rounded text-[10px]">{kuadranStats.sibuk}</span>
          </div>
          <p className="text-[10px] text-amber-800 mt-0.5">UT ≥70% &amp; RA &lt;70%</p>
        </div>

        <div className="bg-rose-50/70 border border-rose-200 p-2.5 rounded-xl">
          <div className="flex items-center justify-between text-rose-900 font-bold text-[11px]">
            <span>4. Idle &amp; Non-Produktif</span>
            <span className="font-mono bg-rose-200/80 px-1.5 py-0.2 rounded text-[10px]">{kuadranStats.idle}</span>
          </div>
          <p className="text-[10px] text-rose-800 mt-0.5">UT &lt;70% &amp; RA &lt;70%</p>
        </div>
      </div>

      {/* Interactive 2x2 Canvas Container */}
      <div className="relative bg-slate-50 border border-slate-300 rounded-2xl p-4 sm:p-6 overflow-hidden min-h-[360px] flex flex-col justify-between">
        
        {/* Sumbu Y (Pencapaian Pendapatan RA) label */}
        <div className="absolute left-2 top-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center space-x-1 z-20">
          <span>▲ RA (Pencapaian Pendapatan %)</span>
          <MetricTooltip type="RA" position="right" />
        </div>

        {/* Sumbu X (Utilisasi Waktu UT) label */}
        <div className="absolute right-3 bottom-1.5 text-[10px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center space-x-1 z-20">
          <span>UT (Utilisasi Waktu %) ►</span>
          <MetricTooltip type="UT" position="top" />
        </div>

        {/* Garis Pembagi Kuadran Horizontal (RA = 70%) */}
        <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 border-t border-dashed border-slate-300 pointer-events-none z-0">
          <span className="absolute right-2 -top-4 text-[9px] font-mono text-slate-400 bg-slate-50 px-1">
            Ambang RA: 70%
          </span>
        </div>

        {/* Garis Pembagi Kuadran Vertikal (UT = 70%) */}
        <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 border-r border-dashed border-slate-300 pointer-events-none z-0">
          <span className="absolute top-2 left-2 text-[9px] font-mono text-slate-400 bg-slate-50 px-1">
            Ambang UT: 70%
          </span>
        </div>

        {/* Kuadran Background Labels */}
        <div className="grid grid-cols-2 grid-rows-2 h-72 w-full absolute inset-4 pointer-events-none z-0">
          {/* Top-Left: Niche Bernilai Tinggi */}
          <div className="p-2 border-r border-b border-transparent">
            <span className="text-[10px] font-extrabold text-sky-800/40 uppercase tracking-widest block">
              Niche Bernilai Tinggi
            </span>
            <span className="text-[9px] text-sky-700/30 font-medium">Jam rendah, tarif tinggi</span>
          </div>

          {/* Top-Right: Bintang */}
          <div className="p-2 pl-4 border-b border-transparent text-right">
            <span className="text-[10px] font-extrabold text-emerald-800/40 uppercase tracking-widest block">
              ⭐ Bintang (Star)
            </span>
            <span className="text-[9px] text-emerald-700/30 font-medium">Produktif &amp; Revenue Optimal</span>
          </div>

          {/* Bottom-Left: Idle dan Tidak Produktif */}
          <div className="p-2 pt-6 border-r border-transparent">
            <span className="text-[10px] font-extrabold text-rose-800/40 uppercase tracking-widest block">
              Idle &amp; Tidak Produktif
            </span>
            <span className="text-[9px] text-rose-700/30 font-medium">Kandidat relokasi / disposal</span>
          </div>

          {/* Bottom-Right: Sibuk tapi Kurang Menghasilkan */}
          <div className="p-2 pt-6 pl-4 text-right">
            <span className="text-[10px] font-extrabold text-amber-800/40 uppercase tracking-widest block">
              Sibuk Kurang Menghasilkan
            </span>
            <span className="text-[9px] text-amber-700/30 font-medium">Jam tinggi, tarif rendah</span>
          </div>
        </div>

        {/* Asset Plot Points */}
        <div className="relative h-72 w-full z-10">
          {filteredAssets.length === 0 ? (
            <div className="h-full flex items-center justify-center text-slate-400 text-xs italic">
              Belum ada aset dengan data proyeksi pendapatan pada kategori ini.
            </div>
          ) : (
            filteredAssets.map((ast) => {
              // Koordinat X: UT% (0 - 100%) mapped to 4% - 94%
              const xPos = Math.max(5, Math.min(95, ast.ut_persen));
              // Koordinat Y: RA% (0 - 150%) mapped to 95% (bottom, RA=0) to 5% (top, RA>=120%)
              const maxDisplayRa = 120;
              const yVal = Math.min(maxDisplayRa, ast.ra_persen || 0);
              const yPos = 95 - ((yVal / maxDisplayRa) * 90);

              let dotColor = 'bg-slate-400 border-slate-600';
              if (ast.kuadran === 'Bintang') dotColor = 'bg-emerald-500 border-emerald-700 shadow-emerald-200';
              else if (ast.kuadran === 'Niche Bernilai Tinggi') dotColor = 'bg-sky-500 border-sky-700 shadow-sky-200';
              else if (ast.kuadran === 'Sibuk Tapi Kurang Menghasilkan') dotColor = 'bg-amber-500 border-amber-700 shadow-amber-200';
              else if (ast.kuadran === 'Idle dan Tidak Produktif') dotColor = 'bg-rose-500 border-rose-700 shadow-rose-200';

              const isHovered = hoveredAsset?.id_aset === ast.id_aset;

              return (
                <button
                  key={ast.id_aset}
                  type="button"
                  onClick={() => onSelectAsset && onSelectAsset(ast.id_aset)}
                  onMouseEnter={() => setHoveredAsset(ast)}
                  onMouseLeave={() => setHoveredAsset(null)}
                  style={{ left: `${xPos}%`, top: `${yPos}%` }}
                  className={`absolute -translate-x-1/2 -translate-y-1/2 rounded-full border-2 transition-all cursor-pointer shadow-md focus:outline-hidden ${dotColor} ${
                    isHovered ? 'w-6 h-6 z-30 scale-125 ring-4 ring-indigo-400/40' : 'w-3.5 h-3.5 hover:scale-125'
                  }`}
                  title={`${ast.nama_aset} (Klik untuk buka detail aset)`}
                />
              );
            })
          )}
        </div>
      </div>

      {/* Floating / Active Hover Asset Detail Card */}
      {hoveredAsset ? (
        <div className="p-3 bg-indigo-50/80 border border-indigo-200 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 animate-in fade-in">
          <div className="space-y-0.5">
            <div className="flex items-center space-x-2">
              <span className="font-extrabold text-slate-900">{hoveredAsset.nama_aset}</span>
              <span className="font-mono text-[10px] text-slate-500">({hoveredAsset.id_aset})</span>
              <span className={`px-2 py-0.2 rounded-full text-[10px] font-bold ${
                hoveredAsset.kuadran === 'Bintang' ? 'bg-emerald-100 text-emerald-800' :
                hoveredAsset.kuadran === 'Niche Bernilai Tinggi' ? 'bg-sky-100 text-sky-800' :
                hoveredAsset.kuadran === 'Sibuk Tapi Kurang Menghasilkan' ? 'bg-amber-100 text-amber-800' :
                'bg-rose-100 text-rose-800'
              }`}>
                Kuadran: {hoveredAsset.kuadran}
              </span>
            </div>
            <div className="text-[11px] text-slate-600 flex flex-wrap gap-x-4 gap-y-1">
              <span>Bidang: <strong>{hoveredAsset.nama_bidang}</strong></span>
              <span>Kategori: <strong>{hoveredAsset.kategori}</strong></span>
              <span>UT: <strong className="font-mono text-blue-700">{hoveredAsset.ut_persen}%</strong></span>
              <span>RA: <strong className="font-mono text-emerald-700">{hoveredAsset.ra_persen}%</strong></span>
              <span>Pendapatan: <strong className="font-mono text-emerald-800">Rp {Math.round(hoveredAsset.pendapatan_riil).toLocaleString('id-ID')}</strong></span>
            </div>
          </div>
          <button
            onClick={() => onSelectAsset && onSelectAsset(hoveredAsset.id_aset)}
            className="px-3 py-1.5 bg-[#005DAA] hover:bg-blue-800 text-white rounded-lg font-bold text-xs shrink-0 flex items-center space-x-1 cursor-pointer"
          >
            <span>Buka Detail Aset</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </button>
        </div>
      ) : (
        <div className="p-2.5 bg-slate-50 rounded-xl text-center text-slate-500 text-[11px]">
          💡 <em>Arahkan kursor ke titik aset untuk melihat ringkasan metrik, atau klik untuk membuka detail aset.</em>
        </div>
      )}
    </div>
  );
};
