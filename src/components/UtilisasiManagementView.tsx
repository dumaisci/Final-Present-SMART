import React, { useState, useEffect, useMemo } from 'react';
import { 
  Aset, 
  Bidang, 
  Cabang, 
  User 
} from '../types';
import { 
  MetrikAsetPeriode, 
  AgregatMetrikGroup 
} from '../lib/utilisasi/metrikUtilisasi';
import { apiClient } from '../lib/apiClient';
import { MatriksUtilisasi2x2 } from './MatriksUtilisasi2x2';
import { AssetHistoryModal } from './AssetHistoryModal';
import { MetricTooltip } from './MetricTooltip';
import { 
  Gauge, 
  Search, 
  Download, 
  RefreshCw, 
  Clock, 
  TrendingUp, 
  Coins, 
  Sparkles, 
  BarChart3, 
  Layers, 
  Building, 
  ArrowUpDown,
  History,
  Grid,
  BookOpen,
  X
} from 'lucide-react';

interface UtilisasiManagementViewProps {
  currentUser: User;
  asets: Aset[];
  bidangList: Bidang[];
  cabangList: Cabang[];
  onOpenAssetHistory?: (aset: Aset) => void;
}

type SortField = 'nama' | 'ut' | 'ra' | 'yr' | 'skor' | 'nilai_perolehan';
type SortDirection = 'asc' | 'desc';

export const UtilisasiManagementView: React.FC<UtilisasiManagementViewProps> = ({
  currentUser,
  asets,
  bidangList,
  cabangList,
  onOpenAssetHistory
}) => {
  // Period & Filter State
  const [periode, setPeriode] = useState<'bulan_ini' | 'ytd' | 'tahunan'>('bulan_ini');
  const [selectedTahun, setSelectedTahun] = useState<number>(new Date().getFullYear());
  const [selectedCabang, setSelectedCabang] = useState<string>('ALL');
  const [selectedBidang, setSelectedBidang] = useState<string>('ALL');
  const [selectedKategori, setSelectedKategori] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [kuadranFilter, setKuadranFilter] = useState<string>('ALL');
  const [utFilter, setUtFilter] = useState<string>('ALL');

  // Matrix display toggle
  const [showMatrix, setShowMatrix] = useState<boolean>(true);
  const [showFormulaModal, setShowFormulaModal] = useState<boolean>(false);

  // Sorting
  const [sortField, setSortField] = useState<SortField>('skor');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  // API Data
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [metrikList, setMetrikList] = useState<MetrikAsetPeriode[]>([]);
  const [agregatBidang, setAgregatBidang] = useState<AgregatMetrikGroup[]>([]);
  const [agregatKategori, setAgregatKategori] = useState<AgregatMetrikGroup[]>([]);
  const [, setErrorMsg] = useState<string>('');

  // Selected asset for modal
  const [selectedAssetForHistory, setSelectedAssetForHistory] = useState<Aset | null>(null);

  // Role permissions
  const canViewFinancials = ['puma', 'pic_bidang', 'admin'].includes(currentUser.role);
  const isPuma = currentUser.role === 'puma';

  const fetchSummary = async () => {
    setIsLoading(true);
    setErrorMsg('');
    try {
      const res = await apiClient.getUtilisasiSummary({
        periode,
        tahun: selectedTahun,
        cabang: selectedCabang,
        bidang: selectedBidang,
        kategori: selectedKategori
      });
      if (res && res.data) {
        setMetrikList(res.data);
        setAgregatBidang(res.agregat_bidang || []);
        setAgregatKategori(res.agregat_kategori || []);
      }
    } catch (err: any) {
      console.error('Error fetching utilisasi summary:', err);
      setErrorMsg(err.message || 'Gagal memuat data ringkasan utilisasi');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSummary();
  }, [periode, selectedTahun, selectedCabang, selectedBidang, selectedKategori]);

  // Handle Sort Change
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  // Filtered & Sorted Metric List
  const filteredAndSortedList = useMemo(() => {
    let result = [...metrikList];

    // Search query filter
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      result = result.filter(item => 
        (item.nama_aset || '').toLowerCase().includes(q) ||
        (item.id_aset || '').toLowerCase().includes(q) ||
        (item.kategori || '').toLowerCase().includes(q) ||
        (item.nama_bidang || '').toLowerCase().includes(q)
      );
    }

    // Kuadran filter
    if (kuadranFilter !== 'ALL') {
      result = result.filter(item => item.kuadran === kuadranFilter);
    }

    // UT Klasifikasi filter
    if (utFilter !== 'ALL') {
      result = result.filter(item => item.ut_klasifikasi === utFilter);
    }

    // Sorting
    result.sort((a, b) => {
      let valA: number = 0;
      let valB: number = 0;

      switch (sortField) {
        case 'nama':
          return sortDirection === 'asc' 
            ? (a.nama_aset || '').localeCompare(b.nama_aset || '')
            : (b.nama_aset || '').localeCompare(a.nama_aset || '');
        case 'ut':
          valA = a.ut_persen || 0;
          valB = b.ut_persen || 0;
          break;
        case 'ra':
          valA = a.ra_persen ?? -1;
          valB = b.ra_persen ?? -1;
          break;
        case 'yr':
          valA = a.yr_persen ?? -1;
          valB = b.yr_persen ?? -1;
          break;
        case 'skor':
          valA = a.skor_terpadu ?? -1;
          valB = b.skor_terpadu ?? -1;
          break;
        case 'nilai_perolehan':
          valA = a.nilai_perolehan || 0;
          valB = b.nilai_perolehan || 0;
          break;
      }

      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });

    return result;
  }, [metrikList, searchQuery, kuadranFilter, utFilter, sortField, sortDirection]);

  // Overall KPI Rollup
  const overallKpi = useMemo(() => {
    if (metrikList.length === 0) {
      return {
        totalAset: 0,
        avgUt: 0,
        avgRa: 0,
        totalPendapatan: 0,
        totalJamPakai: 0,
        totalJamPakaiOrder: 0,
        totalJamPakaiInternal: 0,
        totalKapasitasNetto: 0,
        totalDowntime: 0,
        optimalCount: 0,
        moderatCount: 0,
        rendahCount: 0
      };
    }

    const totalAset = metrikList.length;
    const sumUt = metrikList.reduce((acc, m) => acc + (m.ut_persen || 0), 0);
    const validRaList = metrikList.filter(m => m.ra_persen !== null && typeof m.ra_persen === 'number');
    const sumRa = validRaList.reduce((acc, m) => acc + (m.ra_persen || 0), 0);
    const totalPendapatan = metrikList.reduce((acc, m) => acc + (m.pendapatan_riil || 0), 0);
    const totalJamPakai = metrikList.reduce((acc, m) => acc + (m.jam_pakai_total || 0), 0);
    const totalJamPakaiOrder = metrikList.reduce((acc, m) => acc + (m.jam_pakai_dengan_order || 0), 0);
    const totalJamPakaiInternal = metrikList.reduce((acc, m) => acc + (m.jam_pakai_tanpa_order || 0), 0);
    const totalKapasitasNetto = metrikList.reduce((acc, m) => acc + (m.jam_tersedia_netto || 0), 0);
    const totalDowntime = metrikList.reduce((acc, m) => acc + (m.downtime_pemeliharaan || 0), 0);

    const optimalCount = metrikList.filter(m => m.ut_klasifikasi === 'Optimal').length;
    const moderatCount = metrikList.filter(m => m.ut_klasifikasi === 'Moderat').length;
    const rendahCount = metrikList.filter(m => m.ut_klasifikasi === 'Rendah').length;

    return {
      totalAset,
      avgUt: Number((sumUt / totalAset).toFixed(1)),
      avgRa: validRaList.length > 0 ? Number((sumRa / validRaList.length).toFixed(1)) : 0,
      totalPendapatan,
      totalJamPakai: Number(totalJamPakai.toFixed(1)),
      totalJamPakaiOrder: Number(totalJamPakaiOrder.toFixed(1)),
      totalJamPakaiInternal: Number(totalJamPakaiInternal.toFixed(1)),
      totalKapasitasNetto: Number(totalKapasitasNetto.toFixed(1)),
      totalDowntime: Number(totalDowntime.toFixed(1)),
      optimalCount,
      moderatCount,
      rendahCount
    };
  }, [metrikList]);

  // Open asset history helper
  const handleOpenHistory = (item: MetrikAsetPeriode) => {
    const matched = asets.find(a => a.id_aset === item.id_aset);
    if (matched) {
      if (onOpenAssetHistory) {
        onOpenAssetHistory(matched);
      } else {
        setSelectedAssetForHistory(matched);
      }
    } else {
      setSelectedAssetForHistory({
        id_aset: item.id_aset,
        nama: item.nama_aset,
        kategori: item.kategori,
        status: 'Tersedia',
        kondisi: 'Baik',
        id_bidang_sekarang: '',
        nama_bidang_sekarang: item.nama_bidang,
        id_pic_sekarang: '',
        nama_pic_sekarang: '-',
        tahun_perolehan: selectedTahun,
        lokasi_sekarang: '-',
        basis_operasi: 'WORKING_DAY',
        nilai_perolehan: item.nilai_perolehan || undefined
      } as unknown as Aset);
    }
  };

  // Export Table to CSV
  const handleExportCsv = () => {
    if (filteredAndSortedList.length === 0) return;

    const headers = [
      'ID Aset',
      'Nama Aset',
      'Kategori',
      'Bidang',
      'Cabang',
      'Nilai Perolehan (Rp)',
      'Jam Pakai Total',
      'Jam Pakai Ber-Order',
      'Jam Pakai Internal',
      'Kapasitas Netto A (Jam)',
      'Downtime Pemeliharaan (Jam)',
      'UT (%)',
      'UT Klasifikasi',
      'Pendapatan Riil R (Rp)',
      'Target Prorata P (Rp)',
      'RA (%)',
      'RA Klasifikasi',
      'YR (%)',
      'YR Label',
      'Skor Terpadu (%)',
      'Kuadran 2x2',
      'Tarif Efektif (Rp/jam)',
      'Proyeksi Akhir Tahun (Rp)'
    ];

    const rows = filteredAndSortedList.map(item => [
      `"${item.id_aset}"`,
      `"${item.nama_aset.replace(/"/g, '""')}"`,
      `"${item.kategori || ''}"`,
      `"${item.nama_bidang || ''}"`,
      `"${item.nama_cabang || ''}"`,
      item.nilai_perolehan || 0,
      item.jam_pakai_total || 0,
      item.jam_pakai_dengan_order || 0,
      item.jam_pakai_tanpa_order || 0,
      item.jam_tersedia_netto || 0,
      item.downtime_pemeliharaan || 0,
      item.ut_persen || 0,
      `"${item.ut_klasifikasi}"`,
      item.pendapatan_riil || 0,
      item.proyeksi_prorata || 0,
      item.ra_persen !== null ? item.ra_persen : '',
      `"${item.ra_klasifikasi || ''}"`,
      item.yr_persen !== null ? item.yr_persen : '',
      `"${item.yr_label || ''}"`,
      item.skor_terpadu !== null ? item.skor_terpadu : '',
      `"${item.kuadran || ''}"`,
      item.tarif_efektif_per_jam || 0,
      item.proyeksi_akhir_tahun || ''
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Detail_Utilisasi_Aset_${periode}_${selectedTahun}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Distinct categories
  const categories = useMemo(() => {
    return Array.from(new Set(asets.map(a => a.kategori).filter(Boolean)));
  }, [asets]);

  return (
    <div className="space-y-5 animate-in fade-in pb-12">
      {/* Page Title & Context Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/90 shadow-2xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="w-11 h-11 bg-blue-50 text-[#005DAA] rounded-xl flex items-center justify-center font-bold border border-blue-100 shadow-2xs">
            <Gauge className="w-6 h-6 text-[#005DAA]" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-[10px] font-bold bg-[#005DAA] text-white px-2 py-0.5 rounded uppercase tracking-wider">
                Monitoring Terpadu
              </span>
              <span className="text-xs text-slate-500 font-semibold">
                Sistem Evaluasi Utilisasi Aset
              </span>
              <span className="text-[10px] bg-emerald-100 text-[#008C45] font-bold px-2 py-0.5 rounded uppercase">
                Cut-Off H-1
              </span>
            </div>
            <h1 className="text-xl font-extrabold text-slate-900 mt-0.5">
              Detail Utilisasi &amp; Kinerja Finansial Per Aset
            </h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Pemantauan terpadu Utilisasi Waktu (UT), Pencapaian Pendapatan (RA), Yield Modal (YR), Skor Terpadu, dan Kuadran Produktivitas per unit alat.
            </p>
          </div>
        </div>

        {/* Global Action Buttons */}
        <div className="flex items-center space-x-2 shrink-0">
          <button
            type="button"
            onClick={fetchSummary}
            disabled={isLoading}
            className="p-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
            title="Segarkan data utilisasi"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin text-[#005DAA]' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            type="button"
            onClick={() => setShowFormulaModal(true)}
            className="px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer border bg-blue-50 border-blue-200 text-[#005DAA] hover:bg-blue-100 shadow-2xs"
            title="Lihat rumus dan metodologi perhitungan lengkap"
          >
            <BookOpen className="w-4 h-4 text-[#005DAA]" />
            <span>Rumus &amp; Metodologi</span>
          </button>

          <button
            type="button"
            onClick={() => setShowMatrix(prev => !prev)}
            className={`px-3.5 py-2.5 rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 cursor-pointer border ${
              showMatrix 
                ? 'bg-indigo-50 border-indigo-200 text-indigo-700 shadow-2xs' 
                : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Grid className="w-4 h-4" />
            <span>{showMatrix ? 'Sembunyikan Matriks' : 'Tampilkan Matriks 2×2'}</span>
          </button>

          <button
            type="button"
            onClick={handleExportCsv}
            disabled={filteredAndSortedList.length === 0}
            className="px-3.5 py-2.5 bg-[#008C45] hover:bg-[#007037] text-white rounded-xl text-xs font-bold transition-colors flex items-center space-x-1.5 shadow-2xs disabled:opacity-50 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Ekspor CSV</span>
          </button>
        </div>
      </div>

      {/* Filter Toolbar Strip */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-2xs space-y-3">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Left: Periode Evaluasi Toggle & Tahun */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center space-x-1">
              <BarChart3 className="w-3.5 h-3.5 text-[#005DAA]" />
              <span>Periode:</span>
            </span>

            <div className="inline-flex p-1 bg-slate-100 rounded-xl space-x-1">
              <button
                type="button"
                onClick={() => setPeriode('bulan_ini')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  periode === 'bulan_ini'
                    ? 'bg-[#005DAA] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => setPeriode('ytd')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  periode === 'ytd'
                    ? 'bg-[#005DAA] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                YTD
              </button>
              <button
                type="button"
                onClick={() => setPeriode('tahunan')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                  periode === 'tahunan'
                    ? 'bg-[#005DAA] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tahunan
              </button>
            </div>

            {/* Dropdown Tahun */}
            <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-200 rounded-xl px-2.5 py-1.5">
              <span className="text-[11px] font-bold text-slate-500">Tahun:</span>
              <select
                value={selectedTahun}
                onChange={(e) => setSelectedTahun(Number(e.target.value))}
                className="text-xs font-bold text-[#005DAA] bg-transparent outline-hidden cursor-pointer"
              >
                {[2026, 2025, 2024, 2023].map(y => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Right: Quick Search */}
          <div className="relative min-w-[240px]">
            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Cari ID, nama aset, bidang..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs focus:ring-2 focus:ring-[#005DAA] outline-hidden"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Secondary Dimension Filters: Cabang, Bidang, Kategori, Kuadran */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100 text-xs">
          {/* Filter Cabang (PUMA only) */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Cabang
            </label>
            <select
              value={selectedCabang}
              onChange={(e) => setSelectedCabang(e.target.value)}
              disabled={!isPuma && Boolean(currentUser.id_cabang)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-hidden"
            >
              <option value="ALL">Semua Cabang</option>
              {cabangList.map(c => (
                <option key={c.id_cabang} value={c.id_cabang}>{c.nama_cabang}</option>
              ))}
            </select>
          </div>

          {/* Filter Bidang */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Bidang / Unit
            </label>
            <select
              value={selectedBidang}
              onChange={(e) => setSelectedBidang(e.target.value)}
              disabled={currentUser.role === 'pic_bidang' && Boolean(currentUser.id_bidang)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-hidden"
            >
              <option value="ALL">Semua Bidang</option>
              {bidangList.map(b => (
                <option key={b.id_bidang} value={b.id_bidang}>{b.nama_bidang}</option>
              ))}
            </select>
          </div>

          {/* Filter Kategori */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Kategori Alat
            </label>
            <select
              value={selectedKategori}
              onChange={(e) => setSelectedKategori(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-hidden"
            >
              <option value="ALL">Semua Kategori ({categories.length})</option>
              {categories.map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>

          {/* Filter Posisi Kuadran 2x2 */}
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">
              Kuadran 2×2
            </label>
            <select
              value={kuadranFilter}
              onChange={(e) => setKuadranFilter(e.target.value)}
              className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800 outline-hidden"
            >
              <option value="ALL">Semua Kuadran</option>
              <option value="Bintang">1. Bintang (Star)</option>
              <option value="Niche Bernilai Tinggi">2. Niche Bernilai Tinggi</option>
              <option value="Sibuk Tapi Kurang Menghasilkan">3. Sibuk Tapi Kurang Hasil</option>
              <option value="Idle dan Tidak Produktif">4. Idle &amp; Non-Produktif</option>
            </select>
          </div>
        </div>
      </div>

      {/* Executive KPI Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {/* KPI 1: Rata-rata UT (%) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
              <Clock className="w-3.5 h-3.5 text-blue-600" />
              <span>Rata-Rata UT</span>
              <MetricTooltip type="UT" position="bottom" />
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
              overallKpi.avgUt >= 70 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
              overallKpi.avgUt >= 50 ? 'bg-amber-100 text-amber-800 border-amber-300' :
              'bg-rose-100 text-rose-800 border-rose-300'
            }`}>
              {overallKpi.avgUt >= 70 ? 'Optimal' : overallKpi.avgUt >= 50 ? 'Moderat' : 'Rendah'}
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            {overallKpi.avgUt}%
          </div>
          <div className="text-[10px] text-slate-500 flex items-center justify-between">
            <span>Optimal: <strong>{overallKpi.optimalCount}</strong></span>
            <span>Rendah: <strong>{overallKpi.rendahCount}</strong></span>
          </div>
        </div>

        {/* KPI 2: Rata-rata RA (%) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
              <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
              <span>Rata-Rata RA</span>
              <MetricTooltip type="RA" position="bottom" />
            </span>
            {canViewFinancials && (
              <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                overallKpi.avgRa >= 100 ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                overallKpi.avgRa >= 70 ? 'bg-amber-100 text-amber-800 border-amber-300' :
                'bg-rose-100 text-rose-800 border-rose-300'
              }`}>
                {overallKpi.avgRa >= 100 ? 'Optimal' : overallKpi.avgRa >= 70 ? 'Moderat' : 'Rendah'}
              </span>
            )}
          </div>
          <div className="text-2xl font-black font-mono text-emerald-800">
            {canViewFinancials ? `${overallKpi.avgRa}%` : '••••'}
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            {canViewFinancials ? 'Target Prorata Berjalan' : 'Akses Keuangan Terbatas'}
          </div>
        </div>

        {/* KPI 3: Total Pendapatan Riil (Rp) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
              <Coins className="w-3.5 h-3.5 text-amber-600" />
              <span>Pendapatan Order</span>
              <MetricTooltip 
                customTitle="Pendapatan Riil Order (R)"
                customFormula="R = Σ Pendapatan Sesi Ber-Order"
                customDescription="Total akumulasi alokasi pendapatan riil yang diperoleh dari sesi operasional yang telah selesai (check-in) dan memenuhi Cut-Off H-1."
                customDetails={[
                  'Bobot Sesi = Nilai Perolehan × Jam Pakai',
                  'Sesi tanpa nilai perolehan tidak dialokasikan',
                  'Sesi internal non-revenue bernilai Rp 0'
                ]}
                position="bottom"
              />
            </span>
            <span className="text-[9px] font-bold text-slate-400 font-mono">H-1</span>
          </div>
          <div className="text-xl font-black font-mono text-emerald-700 truncate">
            {canViewFinancials ? `Rp ${Math.round(overallKpi.totalPendapatan).toLocaleString('id-ID')}` : '••••••••'}
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            {canViewFinancials ? 'Dari seluruh sesi ber-order' : 'Khusus PUMA & PIC'}
          </div>
        </div>

        {/* KPI 4: Total Jam Operasi */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
              <Sparkles className="w-3.5 h-3.5 text-purple-600" />
              <span>Total Jam Pakai</span>
              <MetricTooltip 
                customTitle="Total Jam Operasi"
                customFormula="Total Jam = Jam Order + Jam Internal"
                customDescription="Akumulasi seluruh jam pemakaian alat yang sudah selesai check-in sebelum cut-off H-1."
                position="bottom"
              />
            </span>
            <span className="text-[10px] font-bold text-purple-700 font-mono">
              {overallKpi.totalJamPakai}j
            </span>
          </div>
          <div className="text-2xl font-black font-mono text-slate-900">
            {overallKpi.totalJamPakai} <span className="text-xs font-semibold text-slate-500">jam</span>
          </div>
          <div className="text-[10px] text-slate-500 flex items-center justify-between">
            <span>Order: <strong>{overallKpi.totalJamPakaiOrder}j</strong></span>
            <span>Internal: <strong>{overallKpi.totalJamPakaiInternal}j</strong></span>
          </div>
        </div>

        {/* KPI 5: Kapasitas Netto & Downtime */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs space-y-1 col-span-2 lg:col-span-1">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider flex items-center space-x-1">
              <Layers className="w-3.5 h-3.5 text-sky-600" />
              <span>Aset Terpantau</span>
              <MetricTooltip type="KAPASITAS_NETTO" position="bottom" />
            </span>
            <span className="text-[10px] font-bold bg-sky-100 text-sky-800 px-1.5 py-0.2 rounded font-mono">
              {overallKpi.totalAset} Unit
            </span>
          </div>
          <div className="text-xl font-black font-mono text-slate-900">
            {overallKpi.totalKapasitasNetto} <span className="text-xs font-semibold text-slate-500">j netto</span>
          </div>
          <div className="text-[10px] text-slate-500 truncate">
            Downtime Pemeliharaan: <strong>{overallKpi.totalDowntime} jam</strong>
          </div>
        </div>
      </div>

      {/* 2x2 Quadrant Visual Matrix (Collapsible) */}
      {showMatrix && canViewFinancials && (
        <div className="animate-in fade-in">
          <MatriksUtilisasi2x2
            metrikList={filteredAndSortedList}
            onSelectAsset={(id) => {
              const item = metrikList.find(m => m.id_aset === id);
              if (item) handleOpenHistory(item);
            }}
            canViewFinancials={canViewFinancials}
          />
        </div>
      )}

      {/* Aggregated Summary by Bidang & Kategori (Collapsible Mini Cards) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Agregat per Bidang */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2">
              <Building className="w-4 h-4 text-[#005DAA]" />
              <h3 className="text-xs font-bold text-slate-900">
                Ringkasan Agregat per Bidang / Unit
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {agregatBidang.length} Bidang
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-2 px-2.5">Bidang</th>
                  <th className="py-2 px-2 text-center">Unit</th>
                  <th className="py-2 px-2 text-right">Rata-Rata UT</th>
                  {canViewFinancials && (
                    <>
                      <th className="py-2 px-2 text-right">RA Agregat</th>
                      <th className="py-2 px-2.5 text-right">Total Revenue</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {agregatBidang.map((bg, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="py-2 px-2.5 font-semibold text-slate-800">
                      {bg.nama_grup}
                    </td>
                    <td className="py-2 px-2 text-center font-mono text-slate-600">
                      {bg.total_aset}
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                      {bg.ut_rata_rata}%
                    </td>
                    {canViewFinancials && (
                      <>
                        <td className="py-2 px-2 text-right font-mono font-bold text-emerald-700">
                          {bg.ra_agregat !== null ? `${bg.ra_agregat}%` : '-'}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-slate-700">
                          Rp {Math.round(bg.total_pendapatan).toLocaleString('id-ID')}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Agregat per Kategori */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-2xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2">
            <div className="flex items-center space-x-2">
              <Layers className="w-4 h-4 text-[#008C45]" />
              <h3 className="text-xs font-bold text-slate-900">
                Ringkasan Agregat per Kategori Alat
              </h3>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {agregatKategori.length} Kategori
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 text-[10px] font-bold uppercase tracking-wider">
                <tr>
                  <th className="py-2 px-2.5">Kategori</th>
                  <th className="py-2 px-2 text-center">Unit</th>
                  <th className="py-2 px-2 text-right">Rata-Rata UT</th>
                  {canViewFinancials && (
                    <>
                      <th className="py-2 px-2 text-right">RA Agregat</th>
                      <th className="py-2 px-2.5 text-right">Total Revenue</th>
                    </>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium">
                {agregatKategori.map((kg, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70">
                    <td className="py-2 px-2.5 font-semibold text-slate-800">
                      {kg.nama_grup}
                    </td>
                    <td className="py-2 px-2 text-center font-mono text-slate-600">
                      {kg.total_aset}
                    </td>
                    <td className="py-2 px-2 text-right font-mono font-bold text-slate-900">
                      {kg.ut_rata_rata}%
                    </td>
                    {canViewFinancials && (
                      <>
                        <td className="py-2 px-2 text-right font-mono font-bold text-emerald-700">
                          {kg.ra_agregat !== null ? `${kg.ra_agregat}%` : '-'}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-slate-700">
                          Rp {Math.round(kg.total_pendapatan).toLocaleString('id-ID')}
                        </td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Master Data Per-Asset Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xs overflow-hidden">
        
        {/* Table Header Controls */}
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-2">
            <h2 className="font-extrabold text-slate-900 text-sm">
              Tabel Rincian Utilisasi Lengkap per Unit Aset
            </h2>
            <span className="text-[11px] font-mono bg-blue-100 text-[#005DAA] font-bold px-2 py-0.5 rounded-full">
              {filteredAndSortedList.length} Aset
            </span>
          </div>

          <div className="flex items-center space-x-2 text-xs">
            <span className="text-slate-500 font-medium text-[11px]">Urutkan:</span>
            <button
              onClick={() => handleSort('skor')}
              className={`px-2.5 py-1 rounded-lg font-bold border transition-colors cursor-pointer flex items-center space-x-1 ${
                sortField === 'skor' 
                  ? 'bg-[#005DAA] text-white border-[#005DAA]' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>Skor Terpadu</span>
              {sortField === 'skor' && <ArrowUpDown className="w-3 h-3" />}
            </button>
            <button
              onClick={() => handleSort('ut')}
              className={`px-2.5 py-1 rounded-lg font-bold border transition-colors cursor-pointer flex items-center space-x-1 ${
                sortField === 'ut' 
                  ? 'bg-[#005DAA] text-white border-[#005DAA]' 
                  : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span>UT (%)</span>
              {sortField === 'ut' && <ArrowUpDown className="w-3 h-3" />}
            </button>
            {canViewFinancials && (
              <button
                onClick={() => handleSort('ra')}
                className={`px-2.5 py-1 rounded-lg font-bold border transition-colors cursor-pointer flex items-center space-x-1 ${
                  sortField === 'ra' 
                    ? 'bg-[#005DAA] text-white border-[#005DAA]' 
                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                }`}
              >
                <span>RA (%)</span>
                {sortField === 'ra' && <ArrowUpDown className="w-3 h-3" />}
              </button>
            )}
          </div>
        </div>

        {/* Responsive Table Container */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-100/90 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
              <tr>
                <th className="py-3 px-3.5">Identitas Aset</th>
                <th className="py-3 px-3">Penempatan</th>
                <th className="py-3 px-3">Nilai Perolehan</th>
                <th className="py-3 px-3 text-right">
                  <div className="flex items-center justify-end space-x-1">
                    <span>UT (Waktu)</span>
                    <MetricTooltip type="UT" position="bottom" />
                  </div>
                </th>
                {canViewFinancials && (
                  <>
                    <th className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <span>RA (Pendapatan)</span>
                        <MetricTooltip type="RA" position="bottom" />
                      </div>
                    </th>
                    <th className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <span>YR (Yield Modal)</span>
                        <MetricTooltip type="YR" position="bottom" />
                      </div>
                    </th>
                    <th className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <span>Skor Terpadu</span>
                        <MetricTooltip type="SKOR" position="bottom" />
                      </div>
                    </th>
                    <th className="py-3 px-3">
                      <div className="flex items-center space-x-1">
                        <span>Kuadran 2×2</span>
                        <MetricTooltip type="KUADRAN" position="bottom" />
                      </div>
                    </th>
                    <th className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <span>Proyeksi Akhir</span>
                        <MetricTooltip type="PROYEKSI" position="bottom" />
                      </div>
                    </th>
                  </>
                )}
                <th className="py-3 px-3 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={canViewFinancials ? 10 : 5} className="py-12 text-center text-slate-400">
                    <RefreshCw className="w-6 h-6 animate-spin mx-auto text-[#005DAA] mb-2" />
                    <span>Sedang memuat data metrik utilisasi aset...</span>
                  </td>
                </tr>
              ) : filteredAndSortedList.length === 0 ? (
                <tr>
                  <td colSpan={canViewFinancials ? 10 : 5} className="py-12 text-center text-slate-400 italic">
                    Tidak ada aset yang cocok dengan filter yang dipilih.
                  </td>
                </tr>
              ) : (
                filteredAndSortedList.map((item) => (
                  <tr key={item.id_aset} className="hover:bg-blue-50/40 transition-colors">
                    
                    {/* 1. Identitas Aset */}
                    <td className="py-3 px-3.5">
                      <div className="font-extrabold text-slate-900 leading-tight">
                        {item.nama_aset}
                      </div>
                      <div className="flex items-center space-x-1.5 text-[10px] text-slate-500 mt-0.5">
                        <span className="font-mono font-bold text-[#005DAA]">{item.id_aset}</span>
                        <span>•</span>
                        <span>{item.kategori}</span>
                      </div>
                    </td>

                    {/* 2. Penempatan */}
                    <td className="py-3 px-3">
                      <div className="font-semibold text-slate-800 truncate max-w-[140px]">
                        {item.nama_bidang}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                        {item.nama_cabang || 'Kantor Pusat'}
                      </div>
                    </td>

                    {/* 3. Nilai Perolehan & Basis Operasi */}
                    <td className="py-3 px-3">
                      <div className="font-mono font-bold text-slate-900">
                        {canViewFinancials ? (
                          item.nilai_perolehan ? `Rp ${Math.round(item.nilai_perolehan).toLocaleString('id-ID')}` : '-'
                        ) : '••••'}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Cut-Off H-1
                      </div>
                    </td>

                    {/* 4. UT (Utilisasi Waktu) */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end space-x-1.5">
                        <span className="text-sm font-black font-mono text-slate-900">
                          {item.ut_persen}%
                        </span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                          item.ut_klasifikasi === 'Optimal' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                          item.ut_klasifikasi === 'Moderat' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                          'bg-rose-100 text-rose-800 border-rose-300'
                        }`}>
                          {item.ut_klasifikasi}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                        {item.jam_pakai_total}j / {item.jam_tersedia_netto}j A
                      </div>
                      {item.downtime_pemeliharaan > 0 && (
                        <div className="text-[9px] text-amber-700 font-medium">
                          DT: {item.downtime_pemeliharaan}j
                        </div>
                      )}
                    </td>

                    {/* Financial Columns */}
                    {canViewFinancials && (
                      <>
                        {/* 5. RA (Pencapaian Pendapatan) */}
                        <td className="py-3 px-3 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <span className="text-sm font-black font-mono text-emerald-800">
                              {item.ra_persen !== null && item.ra_persen !== undefined ? `${item.ra_persen}%` : '-'}
                            </span>
                            {item.ra_klasifikasi && (
                              <span className={`text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                                item.ra_klasifikasi === 'Optimal' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                                item.ra_klasifikasi === 'Moderat' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                                'bg-rose-100 text-rose-800 border-rose-300'
                              }`}>
                                {item.ra_klasifikasi}
                              </span>
                            )}
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono mt-0.5">
                            Rp {Math.round(item.pendapatan_riil).toLocaleString('id-ID')}
                          </div>
                          {item.proyeksi_prorata !== null && item.proyeksi_prorata !== undefined && (
                            <div className="text-[9px] text-slate-400 font-mono">
                              Target: Rp {Math.round(item.proyeksi_prorata).toLocaleString('id-ID')}
                            </div>
                          )}
                        </td>

                        {/* 6. YR (Yield Modal) */}
                        <td className="py-3 px-3 text-right">
                          <span className="text-xs font-mono font-bold text-amber-900 block">
                            {item.yr_label || (item.yr_persen !== null && item.yr_persen !== undefined ? `${item.yr_persen}%/thn` : '-')}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            Teranualisasi
                          </span>
                        </td>

                        {/* 7. Skor Terpadu */}
                        <td className="py-3 px-3 text-right">
                          <span className="text-sm font-black font-mono text-purple-900 block">
                            {item.skor_terpadu !== null && item.skor_terpadu !== undefined ? `${item.skor_terpadu}%` : '-'}
                          </span>
                          <span className="text-[9px] text-slate-400">
                            50% UT + 50% RA
                          </span>
                        </td>

                        {/* 8. Kuadran 2x2 */}
                        <td className="py-3 px-3">
                          {item.kuadran ? (
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full inline-block border ${
                              item.kuadran === 'Bintang' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                              item.kuadran === 'Niche Bernilai Tinggi' ? 'bg-sky-100 text-sky-800 border-sky-300' :
                              item.kuadran === 'Sibuk Tapi Kurang Menghasilkan' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                              'bg-rose-100 text-rose-800 border-rose-300'
                            }`}>
                              {item.kuadran}
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px] italic">-</span>
                          )}
                        </td>

                        {/* 9. Proyeksi Akhir Tahun */}
                        <td className="py-3 px-3 text-right">
                          {item.proyeksi_akhir_tahun !== null && item.proyeksi_akhir_tahun !== undefined ? (
                            <div>
                              <div className="font-mono font-bold text-emerald-800 text-xs">
                                Rp {Math.round(item.proyeksi_akhir_tahun).toLocaleString('id-ID')}
                              </div>
                              <div className="text-[9px] text-slate-400 font-mono">
                                Min Target: {item.jam_minimum_target || '-'}j
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">
                              -
                            </span>
                          )}
                        </td>
                      </>
                    )}

                    {/* 10. Aksi: Buka Detail & Riwayat */}
                    <td className="py-3 px-3 text-center">
                      <button
                        type="button"
                        onClick={() => handleOpenHistory(item)}
                        className="px-2.5 py-1.5 bg-[#005DAA] hover:bg-blue-800 text-white rounded-lg text-xs font-bold transition-colors inline-flex items-center space-x-1 shadow-2xs cursor-pointer"
                        title="Buka seluruh riwayat & evaluasi aset"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Riwayat</span>
                      </button>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <div>
            Menampilkan <strong className="text-slate-800">{filteredAndSortedList.length}</strong> dari{' '}
            <strong className="text-slate-800">{metrikList.length}</strong> unit aset terdata.
          </div>
          <div className="flex items-center space-x-3 text-[11px]">
            <span>Ambang Optimal UT: <strong>&ge; 70%</strong></span>
            <span>•</span>
            <span>Ambang Optimal RA: <strong>&ge; 100%</strong></span>
          </div>
        </div>
      </div>

      {/* Standalone Asset History Modal if opened from here */}
      {selectedAssetForHistory && (
        <AssetHistoryModal
          isOpen={!!selectedAssetForHistory}
          onClose={() => setSelectedAssetForHistory(null)}
          aset={selectedAssetForHistory}
          currentUser={currentUser}
        />
      )}

      {/* Modal Panduan Rumus & Metodologi Perhitungan */}
      {showFormulaModal && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 overflow-y-auto p-3 sm:p-5 flex items-start sm:items-center justify-center animate-in fade-in"
          onClick={() => setShowFormulaModal(false)}
        >
          <div 
            className="bg-white rounded-2xl max-w-3xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 my-auto max-h-[90vh] flex flex-col text-slate-800 animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="shrink-0 flex items-start justify-between pb-3 border-b border-slate-200">
              <div className="flex items-center space-x-3">
                <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#005DAA] border border-blue-100 flex items-center justify-center font-bold shrink-0">
                  <BookOpen className="w-5 h-5 text-[#005DAA]" />
                </div>
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Panduan Rumus &amp; Metodologi Perhitungan Utilisasi
                  </h2>
                  <p className="text-xs text-slate-500">
                    Dokumentasi formula matematis baku untuk Waktu, Pendapatan, Modal, dan Skor Terpadu
                  </p>
                </div>
              </div>

              <button
                onClick={() => setShowFormulaModal(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="flex-1 min-h-0 overflow-y-auto py-4 space-y-4 text-xs pr-1">
              
              {/* 1. Ketentuan Cut-Off H-1 */}
              <div className="bg-slate-50 border border-slate-200 p-3.5 rounded-xl space-y-1">
                <div className="flex items-center space-x-2 text-slate-800 font-extrabold">
                  <Clock className="w-4 h-4 text-[#005DAA]" />
                  <span>1. Ketentuan Cut-Off H-1 (Harian)</span>
                </div>
                <p className="text-slate-600 leading-relaxed text-[11px]">
                  Semua perhitungan metrik hanya mengevaluasi sesi operasional dan downtime pemeliharaan yang telah <strong>selesai (check-in) sampai dengan kemarin pukul 23:59:59</strong>. Sesi yang masih aktif berjalan hari ini belum masuk perhitungan untuk menjamin kestabilan rekonsiliasi harian.
                </p>
              </div>

              {/* 2. Kapasitas Jam Bersih Netto (A) */}
              <div className="bg-white border border-slate-200 p-3.5 rounded-xl space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 text-xs">
                    2. Kapasitas Jam Bersih Netto (A)
                  </span>
                  <span className="text-[10px] bg-blue-100 text-[#005DAA] font-mono px-2 py-0.5 rounded font-bold">
                    A = Kapasitas Standar - Downtime
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg font-mono text-[11px] text-slate-800 border border-slate-200">
                  A = Kapasitas Bruto Standar - Downtime Pemeliharaan
                </div>
                <ul className="list-disc list-inside text-slate-600 text-[11px] space-y-1">
                  <li><strong>Working Day (WD)</strong>: 8 jam/hari kerja (hanya hari Senin s.d. Jumat).</li>
                  <li><strong>Continuous 24/7</strong>: 24 jam/hari kalender (seluruh hari tanpa henti).</li>
                  <li><strong>Downtime</strong>: Durasi jam perbaikan alat yang tercatat di riwayat pemeliharaan.</li>
                </ul>
              </div>

              {/* 3. Utilisasi Waktu (UT) */}
              <div className="bg-white border border-slate-200 p-3.5 rounded-xl space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 text-xs">
                    3. Utilisasi Waktu (UT %)
                  </span>
                  <span className="text-[10px] bg-blue-100 text-[#005DAA] font-mono px-2 py-0.5 rounded font-bold">
                    UT = (Total Jam Pakai / A) × 100%
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg font-mono text-[11px] text-slate-800 border border-slate-200">
                  UT (%) = (Total Jam Operasi / A) × 100%
                </div>
                <p className="text-slate-600 text-[11px]">
                  <strong>Total Jam Operasi</strong> = Jam Sesi Ber-Order + Jam Sesi Internal (Non-Revenue).
                </p>
                <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                  <div className="p-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                    Optimal: &ge; 70%
                  </div>
                  <div className="p-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded">
                    Moderat: 50% - 69.9%
                  </div>
                  <div className="p-1.5 bg-rose-50 text-rose-800 border border-rose-200 rounded">
                    Rendah: &lt; 50%
                  </div>
                </div>
              </div>

              {/* 4. Engine Alokasi Pendapatan Riil Order (R) */}
              <div className="bg-white border border-slate-200 p-3.5 rounded-xl space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 text-xs">
                    4. Alokasi Pendapatan Riil Order (R)
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono px-2 py-0.5 rounded font-bold">
                    Bobot Sesi = Nilai Perolehan × Jam Pakai
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg font-mono text-[11px] text-slate-800 border border-slate-200 space-y-1">
                  <div>1. Bobot Sesi = Nilai Perolehan Aset × Jam Pakai Sesi</div>
                  <div>2. Pendapatan Sesi = Nilai Order × (Bobot Sesi / Total Bobot Seluruh Sesi pada Order)</div>
                  <div>3. Pendapatan Aset (R) = Total Pendapatan Sesi milik Aset pada periode evaluasi</div>
                </div>
                <p className="text-slate-600 text-[11px] leading-relaxed">
                  Nilai dibulatkan ke <strong>Rupiah bulat</strong>. Selisih sisa pembulatan diberikan ke sesi dengan bobot terbesar sehingga total alokasi order tepat sama dengan nilai order.
                </p>
              </div>

              {/* 5. Target Proyeksi Prorata (P) & Pencapaian Pendapatan (RA) */}
              <div className="bg-white border border-slate-200 p-3.5 rounded-xl space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 text-xs">
                    5. Pencapaian Pendapatan (RA %)
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-mono px-2 py-0.5 rounded font-bold">
                    RA = (R / P prorata) × 100%
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg font-mono text-[11px] text-slate-800 border border-slate-200 space-y-1">
                  <div>• Periode Bulan Ini: P prorata = Proyeksi Tahunan / 12</div>
                  <div>• Periode YTD/Tahun: P prorata = Proyeksi Tahunan × (Hari Berjalan s/d H-1 / Total Hari Efektif)</div>
                  <div>• RA (%) = (Pendapatan Riil R / P prorata) × 100%</div>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                  <div className="p-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                    Optimal: &ge; 100%
                  </div>
                  <div className="p-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded">
                    Moderat: 70% - 99.9%
                  </div>
                  <div className="p-1.5 bg-rose-50 text-rose-800 border border-rose-200 rounded">
                    Rendah: &lt; 70%
                  </div>
                </div>
              </div>

              {/* 6. Yield Modal (YR) */}
              <div className="bg-white border border-slate-200 p-3.5 rounded-xl space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 text-xs">
                    6. Yield Modal (YR %/tahun)
                  </span>
                  <span className="text-[10px] bg-amber-100 text-amber-800 font-mono px-2 py-0.5 rounded font-bold">
                    YR = (R teranualisasi / Nilai Perolehan) × 100%
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg font-mono text-[11px] text-slate-800 border border-slate-200 space-y-1">
                  <div>• R teranualisasi (Bulan Ini) = R × 12</div>
                  <div>• R teranualisasi (YTD/Tahun) = R × (365 / Hari Berjalan)</div>
                  <div>• YR (%/thn) = (R teranualisasi / Nilai Perolehan) × 100%</div>
                </div>
                <p className="text-slate-500 text-[10px]">
                  *Jika hari berjalan &lt; 30 hari pada YTD, tampil catatan "Data belum cukup" untuk menghindari bias ekstrapolasi.
                </p>
              </div>

              {/* 7. Skor Kinerja Terpadu */}
              <div className="bg-white border border-slate-200 p-3.5 rounded-xl space-y-2 shadow-2xs">
                <div className="flex items-center justify-between">
                  <span className="font-extrabold text-slate-900 text-xs">
                    7. Skor Kinerja Terpadu (%)
                  </span>
                  <span className="text-[10px] bg-purple-100 text-purple-800 font-mono px-2 py-0.5 rounded font-bold">
                    Bobot 50:50 (UT + RA)
                  </span>
                </div>
                <div className="bg-slate-50 p-2.5 rounded-lg font-mono text-[11px] text-slate-800 border border-slate-200">
                  Skor Terpadu = (50% × UT) + (50% × min(RA, 120%))
                </div>
                <p className="text-slate-600 text-[11px]">
                  Nilai RA dicap maksimal 120% agar order bernilai ekstrim tidak mendistorsi pengukuran efisiensi operasional.
                </p>
                <div className="grid grid-cols-3 gap-2 text-center text-[10px] font-bold">
                  <div className="p-1.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded">
                    Optimal: &ge; 80%
                  </div>
                  <div className="p-1.5 bg-amber-50 text-amber-800 border border-amber-200 rounded">
                    Moderat: 60% - 79.9%
                  </div>
                  <div className="p-1.5 bg-rose-50 text-rose-800 border border-rose-200 rounded">
                    Rendah: &lt; 60%
                  </div>
                </div>
              </div>

              {/* 8. Matriks Portofolio 2×2 (UT vs RA) */}
              <div className="bg-white border border-slate-200 p-3.5 rounded-xl space-y-2 shadow-2xs">
                <span className="font-extrabold text-slate-900 text-xs block">
                  8. Pemetaan Matriks Portofolio 2×2
                </span>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="p-2.5 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <strong className="text-emerald-900 block font-bold">1. Bintang (Star)</strong>
                    <span className="text-emerald-800">UT &ge; 70% dan RA &ge; 70%</span>
                  </div>
                  <div className="p-2.5 bg-sky-50 border border-sky-200 rounded-lg">
                    <strong className="text-sky-900 block font-bold">2. Niche Bernilai Tinggi</strong>
                    <span className="text-sky-800">UT &lt; 70% dan RA &ge; 70%</span>
                  </div>
                  <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                    <strong className="text-amber-900 block font-bold">3. Sibuk Tapi Kurang Hasil</strong>
                    <span className="text-amber-800">UT &ge; 70% dan RA &lt; 70%</span>
                  </div>
                  <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg">
                    <strong className="text-rose-900 block font-bold">4. Idle &amp; Non-Produktif</strong>
                    <span className="text-rose-800">UT &lt; 70% dan RA &lt; 70%</span>
                  </div>
                </div>
              </div>

              {/* 9. Tarif Efektif & Proyeksi Akhir Tahun */}
              <div className="bg-white border border-slate-200 p-3.5 rounded-xl space-y-2 shadow-2xs">
                <span className="font-extrabold text-slate-900 text-xs block">
                  9. Tarif Efektif &amp; Proyeksi Akhir Tahun (Rolling 3 Bulan)
                </span>
                <div className="bg-slate-50 p-2.5 rounded-lg font-mono text-[11px] text-slate-800 border border-slate-200 space-y-1">
                  <div>• Tarif Efektif = &Sigma;Pendapatan Order 90 Hari Terakhir / &Sigma;Jam Pakai Order 90 Hari</div>
                  <div>• Proyeksi Akhir = R YTD + (Jam Sisa Tahun × UT 3M × Tarif Efektif)</div>
                  <div>• Jam Minimum Target = Proyeksi Tahunan / Tarif Efektif</div>
                </div>
                <p className="text-rose-700 text-[10px] font-semibold">
                  *Jika Jam Minimum Target &gt; Kapasitas Bruto Setahun, sistem menampilkan peringatan: "Target tidak realistis terhadap kapasitas jam alat".
                </p>
              </div>

            </div>

            {/* Modal Footer */}
            <div className="shrink-0 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
              <span className="text-[11px]">Formula aktif pada sistem SMART Asset Intelligence</span>
              <button
                type="button"
                onClick={() => setShowFormulaModal(false)}
                className="bg-[#005DAA] hover:bg-blue-800 text-white font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Mengerti &amp; Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
