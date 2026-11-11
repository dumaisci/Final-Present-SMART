import React, { useState, useEffect, useMemo } from 'react';
import { DashboardStats, UtilizationStats, AuditLog, Pengajuan, User, Aset } from '../types';
import { apiClient } from '../lib/apiClient';
import { 
  Package, 
  CheckCircle2, 
  Clock, 
  Wrench, 
  Trash2, 
  AlertTriangle, 
  FileCheck, 
  ArrowRight,
  TrendingUp,
  Building2,
  Calendar,
  Activity,
  QrCode,
  Check,
  X,
  ShieldAlert,
  AlertCircle,
  BarChart3,
  Layers,
  Gauge,
  Sparkles,
  Inbox,
  Search,
  Camera,
  MapPin,
  Filter,
  Coins,
  HelpCircle,
  Receipt
} from 'lucide-react';
import { canUserApprovePengajuan } from '../lib/approvalUtils';
import { MatriksUtilisasi2x2 } from './MatriksUtilisasi2x2';
import { AssetHistoryModal } from './AssetHistoryModal';
import { MetrikAsetPeriode } from '../lib/utilisasi/metrikUtilisasi';
import { MetricTooltip } from './MetricTooltip';

interface DashboardOverviewProps {
  stats: DashboardStats;
  asets?: Aset[];
  auditLogs: AuditLog[];
  pendingRequests: Pengajuan[];
  currentUser: User;
  onNavigateToTab: (tab: string) => void;
  onApproveRequest: (id: string, note: string) => void;
  onRejectRequest: (id: string, note: string) => void;
  onOpenScanner: () => void;
}

export const DashboardOverview: React.FC<DashboardOverviewProps> = ({
  stats,
  asets = [],
  auditLogs,
  pendingRequests,
  currentUser,
  onNavigateToTab,
  onApproveRequest,
  onRejectRequest,
  onOpenScanner
}) => {
  // State Filter Sumber Aset: 'ALL' | 'Cabang' | 'Investasi'
  const [sumberFilter, setSumberFilter] = useState<'ALL' | 'Cabang' | 'Investasi'>('ALL');
  const [utilizationTab, setUtilizationTab] = useState<'bidang' | 'kategori'>('bidang');
  const [operasionalTab, setOperasionalTab] = useState<'mingguan' | 'bulanan' | 'allTime'>('bulanan');

  // State untuk Modal & Filter Utilisasi Per-Aset
  const [selectedAssetModal, setSelectedAssetModal] = useState<Aset | null>(null);
  const [modalWindowTab, setModalWindowTab] = useState<'mingguan' | 'bulanan' | 'allTime'>('bulanan');
  const [searchOpAsset, setSearchOpAsset] = useState<string>('');
  const [sortOpOrder, setSortOpOrder] = useState<'rate_desc' | 'rate_asc' | 'nama_asc'>('rate_desc');
  const [previewPhoto, setPreviewPhoto] = useState<string | null>(null);

  // Tahap 4: State Filter Periode, Agregat, & Matriks 2x2
  const [utilisasiPeriode, setUtilisasiPeriode] = useState<'bulan_ini' | 'ytd' | 'tahunan'>('bulan_ini');
  const [utilisasiTahun, setUtilisasiTahun] = useState<number>(new Date().getFullYear());
  const [filterCabang, setFilterCabang] = useState<string>('ALL');
  const [filterBidang, setFilterBidang] = useState<string>('ALL');
  const [filterKategori, setFilterKategori] = useState<string>('ALL');
  const [searchTableAset, setSearchTableAset] = useState<string>('');
  const [sortField, setSortField] = useState<'ut' | 'ra' | 'yr' | 'skor' | 'nama'>('ut');
  const [sortDirection, setSortDirection] = useState<'desc' | 'asc'>('desc');
  const [summaryData, setSummaryData] = useState<{
    data: MetrikAsetPeriode[];
    agregat_bidang: any[];
    agregat_kategori: any[];
  } | null>(null);
  const [isLoadingSummary, setIsLoadingSummary] = useState<boolean>(false);
  const [detailHistoryAset, setDetailHistoryAset] = useState<Aset | null>(null);

  const canViewFinancials = ['puma', 'pic_bidang', 'admin'].includes(currentUser.role);

  useEffect(() => {
    setIsLoadingSummary(true);
    apiClient.getUtilisasiSummary({
      periode: utilisasiPeriode,
      tahun: utilisasiTahun,
      cabang: filterCabang !== 'ALL' ? filterCabang : undefined,
      bidang: filterBidang !== 'ALL' ? filterBidang : undefined,
      kategori: filterKategori !== 'ALL' ? filterKategori : undefined
    })
      .then(res => {
        if (res) {
          setSummaryData({
            data: res.data || [],
            agregat_bidang: res.agregat_bidang || [],
            agregat_kategori: res.agregat_kategori || []
          });
        }
      })
      .catch(err => {
        console.warn('Failed to load utilisasi summary:', err);
      })
      .finally(() => {
        setIsLoadingSummary(false);
      });
  }, [utilisasiPeriode, utilisasiTahun, filterCabang, filterBidang, filterKategori]);

  const handleOpenAssetHistory = (asetId: string) => {
    const found = asets.find(a => a.id_aset === asetId);
    if (found) {
      setDetailHistoryAset(found);
    } else {
      const m = summaryData?.data?.find(d => d.id_aset === asetId);
      if (m) {
        setDetailHistoryAset({
          id_aset: m.id_aset,
          nama: m.nama_aset,
          kategori: m.kategori,
          status: 'Tersedia',
          kondisi: 'Baik',
          nama_bidang_sekarang: m.nama_bidang,
          nama_cabang: m.nama_cabang,
          basis_operasi: m.basis_operasi as any,
          nilai_perolehan: m.nilai_perolehan || undefined
        } as Aset);
      }
    }
  };

  // Helper untuk membedakan Aset Investasi PUMA vs Aset Project Cabang
  const isAsetInvestasi = (a: Aset) => {
    return (
      a.sumber_aset === 'PUMA' ||
      a.jenis_pengadaan === 'Investasi' ||
      Boolean(a.dibuat_oleh_puma)
    );
  };

  const isAsetCabang = (a: Aset) => {
    return !isAsetInvestasi(a);
  };

  // Hitung jumlah aset Cabang dan Investasi dalam cakupan role pengguna
  const countCabang = useMemo(() => {
    return (asets || []).filter(isAsetCabang).length;
  }, [asets]);

  const countInvestasi = useMemo(() => {
    return (asets || []).filter(isAsetInvestasi).length;
  }, [asets]);

  // Aset yang tampil di dashboard berdasarkan filter Sumber Aset
  const displayAsets = useMemo(() => {
    const base = asets || [];
    if (sumberFilter === 'Cabang') {
      return base.filter(isAsetCabang);
    }
    if (sumberFilter === 'Investasi') {
      return base.filter(isAsetInvestasi);
    }
    return base;
  }, [asets, sumberFilter]);

  // Statistik angka dashboard terhitung langsung dari displayAsets (Strict Role & Filter Scoped)
  const displayStats = useMemo(() => {
    const totalAset = displayAsets.length;
    const digunakan = displayAsets.filter(a => a.status === 'Digunakan').length;
    const tersedia = displayAsets.filter(a => a.status === 'Tersedia').length;
    const dalamPemeliharaan = displayAsets.filter(a => a.status === 'Dalam Pemeliharaan').length;
    const dipinjamkan = displayAsets.filter(a => a.status === 'Dipinjamkan').length;
    const prosesDisposal = displayAsets.filter(a => a.status === 'Proses Disposal').length;
    const disposal = displayAsets.filter(a => a.status === 'Disposal').length;
    const tidakTersedia = displayAsets.filter(a => a.status === 'Tidak Tersedia').length;

    const todayMid = new Date();
    todayMid.setHours(0, 0, 0, 0);

    const terlambatPengembalian = displayAsets.filter(a => {
      if (a.status !== 'Digunakan' || !a.tgl_rencana_pengembalian) return false;
      const target = new Date(a.tgl_rencana_pengembalian);
      if (isNaN(target.getTime())) return false;
      target.setHours(0, 0, 0, 0);
      return target < todayMid;
    }).length;

    const kalibrasiAlerts = displayAsets.filter(a => {
      if (!a.tgl_kalibrasi_berikutnya) return false;
      const due = new Date(a.tgl_kalibrasi_berikutnya).getTime();
      if (isNaN(due)) return false;
      const now = Date.now();
      const daysDiff = (due - now) / (1000 * 3600 * 24);
      return daysDiff <= 30;
    });

    return {
      totalAset,
      digunakan,
      tersedia,
      dalamPemeliharaan,
      dipinjamkan,
      prosesDisposal,
      disposal,
      tidakTersedia,
      terlambatPengembalian,
      kalibrasiAlerts
    };
  }, [displayAsets]);

  // Overall metrics untuk Rate Utilisasi Aset
  const overallActive = Math.max(0, displayStats.totalAset - displayStats.disposal);
  const overallDigunakan = displayStats.digunakan;
  const overallRate = overallActive > 0 ? Number(((overallDigunakan / overallActive) * 100).toFixed(1)) : 0;

  // Helper for status badge and colors based on rate
  const getRateColor = (rate: number) => {
    if (rate >= 80) {
      return {
        text: 'text-[#008C45]',
        bg: 'bg-[#008C45]',
        bgLight: 'bg-emerald-50',
        border: 'border-emerald-200',
        badge: 'bg-emerald-100 text-[#008C45] border-emerald-300',
        label: 'Optimal (Sangat Baik)'
      };
    }
    if (rate >= 50) {
      return {
        text: 'text-amber-600',
        bg: 'bg-amber-500',
        bgLight: 'bg-amber-50',
        border: 'border-amber-200',
        badge: 'bg-amber-100 text-amber-700 border-amber-300',
        label: 'Moderat (Perlu Optimalisasi)'
      };
    }
    return {
      text: 'text-rose-600',
      bg: 'bg-rose-500',
      bgLight: 'bg-rose-50',
      border: 'border-rose-200',
      badge: 'bg-rose-100 text-rose-700 border-rose-300',
      label: 'Rendah (Aset Banyak Idle)'
    };
  };

  const currentTheme = getRateColor(overallRate);

  // Distribusi dan utilisasi per-bidang dihitung dari displayAsets
  const normalizedAsetPerBidang = useMemo(() => {
    const map: Record<string, { aktif: number; digunakan: number }> = {};
    let total = 0;

    displayAsets.forEach(a => {
      let name = a.nama_bidang_sekarang || 'Bidang Dukungan Bisnis';
      const lower = name.toLowerCase();
      if (lower.includes('fungsi umum') || lower.includes('dukungan bisnis')) {
        name = 'Bidang Dukungan Bisnis';
      }
      if (!map[name]) {
        map[name] = { aktif: 0, digunakan: 0 };
      }
      if (a.status !== 'Disposal') {
        map[name].aktif += 1;
        total += 1;
      }
      if (a.status === 'Digunakan') {
        map[name].digunakan += 1;
      }
    });

    return Object.entries(map).map(([nama_bidang, { aktif, digunakan }]) => ({
      nama_bidang,
      bidang: nama_bidang,
      jumlah: aktif,
      aktif,
      digunakan,
      persen: total > 0 ? Math.round((aktif / total) * 100) : 0,
      rate: aktif > 0 ? Math.round((digunakan / aktif) * 100) : 0
    })).sort((a, b) => b.jumlah - a.jumlah);
  }, [displayAsets]);

  // Distribusi dan utilisasi per-kategori dihitung dari displayAsets
  const kategoriBreakdown = useMemo(() => {
    const map: Record<string, { aktif: number; digunakan: number }> = {};
    displayAsets.forEach(a => {
      const kat = a.kategori || 'Lainnya';
      if (!map[kat]) {
        map[kat] = { aktif: 0, digunakan: 0 };
      }
      if (a.status !== 'Disposal') {
        map[kat].aktif += 1;
      }
      if (a.status === 'Digunakan') {
        map[kat].digunakan += 1;
      }
    });

    return Object.entries(map).map(([kategori, { aktif, digunakan }]) => ({
      kategori,
      aktif,
      digunakan,
      static: kategori.toLowerCase().includes('tanah') || kategori.toLowerCase().includes('bangunan'),
      rate: aktif > 0 ? Math.round((digunakan / aktif) * 100) : 0
    })).sort((a, b) => b.aktif - a.aktif);
  }, [displayAsets]);

  // Agregasi jam operasional dihitung dari displayAsets
  const operationalStats = useMemo(() => {
    const opList = displayAsets.filter(a => a.kategori === 'Peralatan Operasi' || a.basis_operasi);
    let actual = 0;
    let available = 0;
    let maintenance = 0;

    opList.forEach(a => {
      const u = a.utilization?.[operasionalTab];
      if (u) {
        actual += (u.actualHours || 0);
        available += (u.availableHours || 0);
        maintenance += (u.maintenanceHours || 0);
      }
    });

    const rate = available > 0 ? Number(((actual / available) * 100).toFixed(1)) : 0;
    return {
      totalAsetOperasi: opList.length,
      actualHours: Number(actual.toFixed(1)),
      availableHours: Number(available.toFixed(1)),
      maintenanceHours: Number(maintenance.toFixed(1)),
      rate
    };
  }, [displayAsets, operasionalTab]);

  // Per-asset operational list and individual utilization dihitung dari displayAsets
  const filteredOpAsets = useMemo(() => {
    const list = displayAsets.filter(a => a.kategori === 'Peralatan Operasi' || a.basis_operasi);
    const q = searchOpAsset.toLowerCase().trim();
    const filtered = list.filter(a => {
      if (!q) return true;
      return (
        (a.id_aset || '').toLowerCase().includes(q) ||
        (a.nama || '').toLowerCase().includes(q) ||
        (a.tag_number || '').toLowerCase().includes(q) ||
        (a.asset_number || '').toLowerCase().includes(q) ||
        (a.nama_bidang_sekarang || '').toLowerCase().includes(q)
      );
    });

    return filtered.sort((a, b) => {
      const rateA = a.utilization?.[operasionalTab]?.rate ?? 0;
      const rateB = b.utilization?.[operasionalTab]?.rate ?? 0;
      if (sortOpOrder === 'rate_desc') return rateB - rateA;
      if (sortOpOrder === 'rate_asc') return rateA - rateB;
      return (a.nama || '').localeCompare(b.nama || '');
    });
  }, [displayAsets, searchOpAsset, sortOpOrder, operasionalTab]);

  // Tahap 4: Filter & Sort untuk Tabel Seluruh Aset
  const sortedSummaryAsets = useMemo(() => {
    const list = summaryData?.data || [];
    const q = searchTableAset.toLowerCase().trim();
    const filtered = list.filter(item => {
      if (!q) return true;
      return (
        item.id_aset.toLowerCase().includes(q) ||
        item.nama_aset.toLowerCase().includes(q) ||
        item.nama_bidang.toLowerCase().includes(q) ||
        item.kategori.toLowerCase().includes(q)
      );
    });

    return [...filtered].sort((a, b) => {
      let valA: any = 0;
      let valB: any = 0;
      if (sortField === 'ut') {
        valA = a.ut_persen ?? -1;
        valB = b.ut_persen ?? -1;
      } else if (sortField === 'ra') {
        valA = a.ra_persen ?? -1;
        valB = b.ra_persen ?? -1;
      } else if (sortField === 'yr') {
        valA = a.yr_persen ?? -1;
        valB = b.yr_persen ?? -1;
      } else if (sortField === 'skor') {
        valA = a.skor_terpadu ?? -1;
        valB = b.skor_terpadu ?? -1;
      } else {
        return sortDirection === 'asc'
          ? a.nama_aset.localeCompare(b.nama_aset)
          : b.nama_aset.localeCompare(a.nama_aset);
      }
      return sortDirection === 'asc' ? valA - valB : valB - valA;
    });
  }, [summaryData, searchTableAset, sortField, sortDirection]);

  // Unique categories, departments, branches for filter dropdowns
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    asets.forEach(a => { if (a.kategori) set.add(a.kategori); });
    return Array.from(set).sort();
  }, [asets]);

  const availableBidangs = useMemo(() => {
    const set = new Set<string>();
    asets.forEach(a => { if (a.nama_bidang_sekarang) set.add(a.nama_bidang_sekarang); });
    return Array.from(set).sort();
  }, [asets]);

  const availableCabangs = useMemo(() => {
    const set = new Set<string>();
    asets.forEach(a => { if (a.nama_cabang) set.add(a.nama_cabang); });
    return Array.from(set).sort();
  }, [asets]);

  return (
    <div className="space-y-6">
      
      {/* Top Banner / Welcome Info */}
      <div className="bg-[#005DAA] rounded-xl p-6 text-white shadow-md border border-blue-600 relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-64 h-64 bg-white/5 rounded-full blur-2xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className="inline-flex items-center space-x-2 bg-white/95 text-slate-900 border border-emerald-300 text-xs px-3 py-1 rounded-full font-bold shadow-xs">
                <img
                  src="https://i.ibb.co.com/xKsyxsWX/logo-sucofindo.png"
                  alt="Logo SUCOFINDO"
                  className="h-4 w-auto object-contain"
                />
                <span>PT SUCOFINDO</span>
              </div>

              {currentUser.role === 'puma' ? (
                <div className="inline-flex items-center space-x-1.5 bg-indigo-900/80 text-indigo-100 border border-indigo-400/50 text-xs px-3 py-1 rounded-full font-bold shadow-xs">
                  <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                  <span>Akses Staff PUMA (Pengadaan & Manajemen Aset Nasional)</span>
                </div>
              ) : (currentUser.role === 'admin' || currentUser.role === 'management' || currentUser.role === 'pimpinan') ? (
                <div className="inline-flex items-center space-x-1.5 bg-blue-900/60 text-blue-100 border border-blue-400/30 text-xs px-3 py-1 rounded-full font-bold">
                  <ShieldAlert className="w-3.5 h-3.5 text-amber-300" />
                  <span>Akses Penuh ({currentUser.role === 'admin' ? 'Fungsi Umum' : 'Management'})</span>
                </div>
              ) : (
                <div className="inline-flex items-center space-x-1.5 bg-amber-500/20 text-amber-200 border border-amber-400/30 text-xs px-3 py-1 rounded-full font-bold">
                  <Activity className="w-3.5 h-3.5 text-amber-300" />
                  <span>Akses Terbatas PIC ({currentUser.nama_bidang || currentUser.bidang})</span>
                </div>
              )}
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
              Sistem Monitoring Aset Real - Time (SMART SCI)
            </h1>
          </div>

          <div className="flex items-center space-x-3 shrink-0">
            <button
              onClick={onOpenScanner}
              className="bg-[#008C45] hover:bg-[#007037] text-white px-4 py-2.5 rounded-lg font-bold text-xs shadow-sm flex items-center space-x-2 transition-colors active:scale-95"
            >
              <QrCode className="w-4 h-4" />
              <span>Scan QR Code Aset</span>
            </button>
          </div>
        </div>
      </div>

      {/* Filter Sumber Aset (Aset Cabang & Aset Investasi) & Indikator Cakupan Role */}
      <div className="bg-white rounded-xl p-3 border border-slate-200 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
        {/* Filter Segmented Control */}
        <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-lg border border-slate-200/80 w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setSumberFilter('ALL')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              sumberFilter === 'ALL'
                ? 'bg-white text-[#005DAA] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>Semua Aset</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
              sumberFilter === 'ALL' ? 'bg-blue-100 text-[#005DAA]' : 'bg-slate-200 text-slate-600'
            }`}>
              {asets.length}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSumberFilter('Cabang')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              sumberFilter === 'Cabang'
                ? 'bg-white text-[#008C45] shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Aset Pengadaan Project Cabang"
          >
            <span>Project Cabang</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
              sumberFilter === 'Cabang' ? 'bg-emerald-100 text-[#008C45]' : 'bg-slate-200 text-slate-600'
            }`}>
              {countCabang}
            </span>
          </button>

          <button
            type="button"
            onClick={() => setSumberFilter('Investasi')}
            className={`flex-1 sm:flex-none px-3.5 py-1.5 rounded-md text-xs font-bold transition-all flex items-center justify-center space-x-2 cursor-pointer ${
              sumberFilter === 'Investasi'
                ? 'bg-white text-indigo-700 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
            title="Aset Pengadaan Investasi PUMA"
          >
            <span>Investasi PUMA</span>
            <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
              sumberFilter === 'Investasi' ? 'bg-indigo-100 text-indigo-700' : 'bg-slate-200 text-slate-600'
            }`}>
              {countInvestasi}
            </span>
          </button>
        </div>

        {/* Indikator Cakupan Role (Clean & Minimal) */}
        <div className="flex items-center space-x-2 text-xs text-slate-500 font-semibold self-start sm:self-auto shrink-0">
          <span className="text-slate-400 text-[11px]">Cakupan:</span>
          <span className="inline-flex items-center space-x-1.5 bg-slate-100 text-slate-700 px-2.5 py-1 rounded-md border border-slate-200 font-bold">
            <Building2 className="w-3.5 h-3.5 text-[#005DAA]" />
            <span>
              {currentUser.role === 'puma'
                ? 'PUMA Pusat (Aset Investasi Nasional)'
                : currentUser.role === 'pic_bidang'
                ? `${currentUser.nama_bidang || 'Bidang'} • ${currentUser.nama_cabang || 'Cabang'}`
                : `${currentUser.nama_cabang || 'Cabang'}`}
            </span>
          </span>
        </div>
      </div>

      {/* 1. Ringkasan Aset (Summary Cards Grid: 7 Status + Total Master) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        
        {/* Total Aset */}
        <div 
          onClick={() => onNavigateToTab('master')}
          className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <p className="text-[10px] font-bold text-[#005DAA] uppercase tracking-wider truncate">Total Master</p>
          <div className="flex items-end justify-between mt-1.5">
            <p className="text-xl font-extrabold text-slate-900">{displayStats.totalAset}</p>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-[#005DAA] flex items-center justify-center group-hover:bg-[#005DAA] group-hover:text-white transition-colors">
              <Package className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-[9px] text-slate-400 font-medium mt-1 block truncate">
            {sumberFilter === 'Cabang' ? 'Project Cabang' : sumberFilter === 'Investasi' ? 'Investasi PUMA' : 'Semua Sumber Aset'}
          </span>
        </div>

        {/* 1. Digunakan */}
        <div 
          onClick={() => onNavigateToTab('master')}
          className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <p className="text-[10px] font-bold text-[#008C45] uppercase tracking-wider truncate">Digunakan</p>
          <div className="flex items-end justify-between mt-1.5">
            <p className="text-xl font-extrabold text-slate-900">{displayStats.digunakan}</p>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-[#008C45] flex items-center justify-center group-hover:bg-[#008C45] group-hover:text-white transition-colors">
              <CheckCircle2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-[9px] text-emerald-600 font-semibold mt-1 block truncate">Sedang Dipakai</span>
        </div>

        {/* 2. Tersedia */}
        <div 
          onClick={() => onNavigateToTab('master')}
          className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wider truncate">Tersedia</p>
          <div className="flex items-end justify-between mt-1.5">
            <p className="text-xl font-extrabold text-slate-900">{displayStats.tersedia}</p>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
              <Check className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-[9px] text-blue-600 font-semibold mt-1 block truncate">Siap Digunakan</span>
        </div>

        {/* 3. Dalam Pemeliharaan */}
        <div 
          onClick={() => onNavigateToTab('master')}
          className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider truncate">Pemeliharaan</p>
          <div className="flex items-end justify-between mt-1.5">
            <p className="text-xl font-extrabold text-slate-900">{displayStats.dalamPemeliharaan}</p>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center group-hover:bg-amber-600 group-hover:text-white transition-colors">
              <Wrench className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-[9px] text-amber-600 font-medium mt-1 block truncate">Service / Repair</span>
        </div>

        {/* 4. Dipinjamkan */}
        <div 
          onClick={() => onNavigateToTab('master')}
          className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <p className="text-[10px] font-bold text-purple-600 uppercase tracking-wider truncate">Dipinjamkan</p>
          <div className="flex items-end justify-between mt-1.5">
            <p className="text-xl font-extrabold text-slate-900">{displayStats.dipinjamkan}</p>
            <div className="w-7 h-7 rounded-lg bg-purple-50 text-purple-600 flex items-center justify-center group-hover:bg-purple-600 group-hover:text-white transition-colors">
              <Clock className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-[9px] text-purple-600 font-medium mt-1 block truncate">Pihak Luar/Unit</span>
        </div>

        {/* 5. Proses Disposal */}
        <div 
          onClick={() => onNavigateToTab('master')}
          className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs hover:shadow-md transition-all cursor-pointer group"
        >
          <p className="text-[10px] font-bold text-orange-600 uppercase tracking-wider truncate">Proses Disposal</p>
          <div className="flex items-end justify-between mt-1.5">
            <p className="text-xl font-extrabold text-slate-900">{displayStats.prosesDisposal}</p>
            <div className="w-7 h-7 rounded-lg bg-orange-50 text-orange-600 flex items-center justify-center group-hover:bg-orange-600 group-hover:text-white transition-colors">
              <AlertTriangle className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-[9px] text-orange-600 font-medium mt-1 block truncate">Pengajuan Hapus</span>
        </div>

        {/* 6. Disposal */}
        <div 
          onClick={() => onNavigateToTab('master')}
          className="bg-rose-50 p-3 rounded-xl border border-rose-200 shadow-xs cursor-pointer hover:bg-rose-100 transition-all"
        >
          <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider truncate">Disposal</p>
          <div className="flex items-end justify-between mt-1.5">
            <p className="text-xl font-extrabold text-rose-950">{displayStats.disposal}</p>
            <div className="w-7 h-7 rounded-lg bg-rose-200 text-rose-800 flex items-center justify-center">
              <Trash2 className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-[9px] text-rose-700 font-medium mt-1 block truncate">Dihapuskan</span>
        </div>

        {/* 7. Tidak Tersedia */}
        <div 
          onClick={() => onNavigateToTab('master')}
          className="bg-slate-100 p-3 rounded-xl border border-slate-300 shadow-xs cursor-pointer hover:bg-slate-200 transition-all"
        >
          <p className="text-[10px] font-bold text-slate-700 uppercase tracking-wider truncate">Tidak Tersedia</p>
          <div className="flex items-end justify-between mt-1.5">
            <p className="text-xl font-extrabold text-slate-900">{displayStats.tidakTersedia}</p>
            <div className="w-7 h-7 rounded-lg bg-slate-200 text-slate-700 flex items-center justify-center">
              <AlertCircle className="w-3.5 h-3.5" />
            </div>
          </div>
          <span className="text-[9px] text-slate-600 font-medium mt-1 block truncate">Hilang</span>
        </div>

      </div>

      {/* 1.5. Utilization Rate Section (Tingkat Utilisasi Aset) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header Bar */}
        <div className="p-4 sm:px-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-50/50">
          <div>
            <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
              <span>Tingkat Utilisasi Aset</span>
              <span className="text-[10px] bg-blue-100 text-[#005DAA] px-2 py-0.5 rounded-full font-bold uppercase">
                Real-time
              </span>
            </h3>
          </div>

          {/* Toggle Tab per Bidang / per Kategori */}
          <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200 self-start sm:self-auto text-xs font-semibold">
            <button
              type="button"
              onClick={() => setUtilizationTab('bidang')}
              className={`px-3 py-1 rounded-md transition-all ${
                utilizationTab === 'bidang'
                  ? 'bg-white text-[#005DAA] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Per Bidang</span>
            </button>
            <button
              type="button"
              onClick={() => setUtilizationTab('kategori')}
              className={`px-3 py-1 rounded-md transition-all ${
                utilizationTab === 'kategori'
                  ? 'bg-white text-[#005DAA] shadow-xs font-bold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Per Kategori</span>
            </button>
          </div>
        </div>

        {/* Card Body */}
        <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
          
          {/* Sisi Kiri: Overall Utilization Rate Big Metric */}
          <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 bg-slate-50/70 rounded-xl border border-slate-200/80 text-center relative overflow-hidden">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
              Utilization Rate
            </span>

            {/* Big Percentage Number with dynamic color */}
            <div className={`text-4xl sm:text-5xl font-black tracking-tight ${currentTheme.text} my-1`}>
              {overallRate}%
            </div>

            {/* Status Pill */}
            <div className={`mt-1 mb-2 inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold border ${currentTheme.badge}`}>
              <span>{currentTheme.label}</span>
            </div>

            {/* Fraction Subtitle */}
            <p className="text-xs text-slate-600 font-medium max-w-[220px]">
              <strong className="text-slate-900 font-bold">{overallDigunakan}</strong> dari <strong className="text-slate-900 font-bold">{overallActive}</strong> aset aktif sedang digunakan
            </p>

            {/* Visual Mini Linear Bar */}
            <div className="w-full max-w-[200px] bg-slate-200 h-2 rounded-full mt-3 overflow-hidden">
              <div
                className={`h-full ${currentTheme.bg} transition-all duration-700 rounded-full`}
                style={{ width: `${Math.min(100, Math.max(overallRate, 4))}%` }}
              ></div>
            </div>
          </div>

          {/* Sisi Kanan: Progress Bar Breakdown */}
          <div className="lg:col-span-8 space-y-3.5">
            {utilizationTab === 'bidang' ? (
              // Breakdown per Bidang
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider pb-1 border-b border-slate-100">
                  <span>Bidang / Unit Kerja</span>
                  <span>Utilisasi &amp; Aset Digunakan</span>
                </div>

                {normalizedAsetPerBidang.map((b, idx) => {
                  const bTheme = getRateColor(b.rate);
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <span className="font-semibold text-slate-800 truncate max-w-[240px] sm:max-w-md">
                          {b.bidang}
                        </span>
                        <div className="flex items-center space-x-2 shrink-0">
                          <span className="text-[11px] text-slate-500 font-medium">
                            {b.digunakan}/{b.aktif} Aset
                          </span>
                          <span className={`font-bold px-2 py-0.5 rounded text-xs ${bTheme.bgLight} ${bTheme.text} border ${bTheme.border}`}>
                            {b.rate}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${bTheme.bg}`}
                          style={{ width: `${Math.min(100, Math.max(b.rate, 3))}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              // Breakdown per Kategori
              <div className="space-y-3">
                <div className="flex justify-between items-center text-xs font-bold text-slate-500 uppercase tracking-wider pb-1 border-b border-slate-100">
                  <span>Kategori Aset</span>
                  <span>Utilisasi &amp; Status</span>
                </div>

                {kategoriBreakdown.map((k, idx) => {
                  const kTheme = getRateColor(k.rate);
                  return (
                    <div key={idx} className="space-y-1.5">
                      <div className="flex justify-between items-center text-xs">
                        <div className="flex items-center space-x-1.5 truncate max-w-[240px] sm:max-w-md">
                          <span className="font-semibold text-slate-800 truncate">
                            {k.kategori}
                          </span>
                          {k.static && (
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-medium border border-slate-200 shrink-0">
                              Statis
                            </span>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 shrink-0">
                          {k.digunakan !== undefined && k.aktif !== undefined && (
                            <span className="text-[11px] text-slate-500 font-medium">
                              {k.digunakan}/{k.aktif} Aset
                            </span>
                          )}
                          <span className={`font-bold px-2 py-0.5 rounded text-xs ${kTheme.bgLight} ${kTheme.text} border ${kTheme.border}`}>
                            {k.rate}%
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${kTheme.bg}`}
                          style={{ width: `${Math.min(100, Math.max(k.rate, 3))}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* 1.6. Khusus: Utilisasi Aset Operasional (Peralatan Operasi Berbasis Working Day & Continuous) */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Header Bar */}
        <div className="p-4 sm:px-5 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gradient-to-r from-blue-50/70 via-slate-50 to-emerald-50/50">
          <div>
            <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <span>Utilisasi Aset Operasional</span>
              <span className="text-[10px] bg-emerald-100 text-[#008C45] px-2 py-0.5 rounded-full font-bold uppercase">
                Cut-Off H-1
              </span>
            </h3>
          </div>

          {/* Time Window Tabs */}
          <div className="inline-flex p-1 bg-white rounded-lg border border-slate-200 self-start sm:self-auto text-xs font-semibold shadow-2xs">
            <button
              type="button"
              onClick={() => setOperasionalTab('mingguan')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                operasionalTab === 'mingguan'
                  ? 'bg-[#005DAA] text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 Hari
            </button>
            <button
              type="button"
              onClick={() => setOperasionalTab('bulanan')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                operasionalTab === 'bulanan'
                  ? 'bg-[#005DAA] text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30 Hari
            </button>
            <button
              type="button"
              onClick={() => setOperasionalTab('allTime')}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                operasionalTab === 'allTime'
                  ? 'bg-[#005DAA] text-white font-bold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              All-Time
            </button>
          </div>
        </div>

        {/* Body Content */}
        {(() => {
          const currentStats = operationalStats;
          const opTheme = getRateColor(currentStats.rate);

          return (
            <div className="p-5 sm:p-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
              
              {/* Sisi Kiri: Big Rate & Status */}
              <div className="lg:col-span-4 flex flex-col items-center justify-center p-6 bg-slate-50/70 rounded-xl border border-slate-200/80 text-center">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Rate Utilisasi Operasional
                </span>

                <div className={`text-4xl sm:text-5xl font-black tracking-tight ${opTheme.text} my-1`}>
                  {currentStats.rate}%
                </div>

                <div className={`mt-1 mb-2 inline-flex items-center px-3 py-0.5 rounded-full text-xs font-bold border ${opTheme.badge}`}>
                  <span>{opTheme.label}</span>
                </div>

                <p className="text-xs text-slate-600 font-medium max-w-[220px]">
                  Total <strong className="text-slate-900">{operationalStats.totalAsetOperasi} unit</strong> aktif terpantau
                </p>

                <div className="w-full max-w-[200px] bg-slate-200 h-2 rounded-full mt-3 overflow-hidden">
                  <div
                    className={`h-full ${opTheme.bg} transition-all duration-700 rounded-full`}
                    style={{ width: `${Math.min(100, Math.max(currentStats.rate, 3))}%` }}
                  ></div>
                </div>
              </div>

              {/* Sisi Kanan: Tiga Kotak Metrik Jam */}
              <div className="lg:col-span-8">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  
                  {/* 1. Jam Operasi Aktual */}
                  <div className="bg-emerald-50/70 border border-emerald-200 p-4 rounded-xl">
                    <span className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider block">
                      Actual Operating Time
                    </span>
                    <div className="text-2xl font-extrabold text-emerald-950 mt-1">
                      {currentStats.actualHours} <span className="text-sm font-semibold text-emerald-800">jam</span>
                    </div>
                  </div>

                  {/* 2. Jam Maintenance Downtime */}
                  <div className="bg-amber-50/70 border border-amber-200 p-4 rounded-xl">
                    <span className="text-[11px] font-bold text-amber-800 uppercase tracking-wider block">
                      Downtime Maintenance
                    </span>
                    <div className="text-2xl font-extrabold text-amber-950 mt-1">
                      {currentStats.maintenanceHours} <span className="text-sm font-semibold text-amber-800">jam</span>
                    </div>
                  </div>

                  {/* 3. Available Time Netto */}
                  <div className="bg-blue-50/70 border border-blue-200 p-4 rounded-xl">
                    <span className="text-[11px] font-bold text-blue-800 uppercase tracking-wider block">
                      Available Time (Netto)
                    </span>
                    <div className="text-2xl font-extrabold text-blue-950 mt-1">
                      {currentStats.availableHours} <span className="text-sm font-semibold text-blue-800">jam</span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Tabel Utilisasi Per-Aset (Setiap Peralatan Operasi Dihitung Terpisah) */}
              <div className="lg:col-span-12 border-t border-slate-200 pt-5 mt-2">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 mb-3">
                  <div>
                    <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                      <span>Utilisasi Per Unit Peralatan</span>
                      <span className="text-[11px] font-bold bg-blue-100 text-[#005DAA] px-2 py-0.5 rounded-full">
                        {filteredOpAsets.length} Unit
                      </span>
                    </h4>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Search Per-Aset */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="Cari ID, Tag, Nama unit..."
                        value={searchOpAsset}
                        onChange={(e) => setSearchOpAsset(e.target.value)}
                        className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs w-48 sm:w-56 focus:outline-hidden focus:ring-1 focus:ring-[#005DAA]"
                      />
                    </div>

                    {/* Sort Order */}
                    <select
                      value={sortOpOrder}
                      onChange={(e) => setSortOpOrder(e.target.value as any)}
                      className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-700 font-semibold focus:outline-hidden focus:ring-1 focus:ring-[#005DAA] cursor-pointer"
                    >
                      <option value="rate_desc">Rate Tertinggi</option>
                      <option value="rate_asc">Rate Terendah</option>
                      <option value="nama_asc">Nama Aset (A-Z)</option>
                    </select>
                  </div>
                </div>

                {/* Table list */}
                {filteredOpAsets.length === 0 ? (
                  <div className="p-8 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200 text-slate-400 text-xs">
                    Tidak ada peralatan operasi yang sesuai dengan kata kunci pencarian.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                    <div className="overflow-x-auto max-h-[380px] overflow-y-auto">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider sticky top-0 z-10 text-[10px] border-b border-slate-200">
                          <tr>
                            <th className="py-2.5 px-3">Aset &amp; Identitas</th>
                            <th className="py-2.5 px-3">Penempatan</th>
                            <th className="py-2.5 px-3">Basis Operasi</th>
                            <th className="py-2.5 px-3 text-right">Actual (Jam)</th>
                            <th className="py-2.5 px-3 text-right">Downtime (Jam)</th>
                            <th className="py-2.5 px-3 text-right">Available Netto</th>
                            <th className="py-2.5 px-3 min-w-[150px]">Rate Utilisasi ({operasionalTab === 'mingguan' ? '7 Hari' : operasionalTab === 'bulanan' ? '30 Hari' : 'All-Time'})</th>
                            <th className="py-2.5 px-3 text-center">Aksi</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {filteredOpAsets.map((item) => {
                            const uStats = item.utilization?.[operasionalTab] || {
                              rate: 0,
                              actualHours: 0,
                              availableHours: 0,
                              maintenanceHours: 0
                            };
                            const itemTheme = getRateColor(uStats.rate);

                            return (
                              <tr key={item.id_aset} className="hover:bg-slate-50/80 transition-colors">
                                <td className="py-2.5 px-3">
                                  <div className="font-bold text-slate-900">{item.nama}</div>
                                  <div className="flex items-center gap-1.5 text-[10px] font-mono text-slate-500 mt-0.5">
                                    <span className="font-bold text-[#005DAA]">{item.id_aset}</span>
                                    {item.tag_number && (
                                      <>
                                        <span>•</span>
                                        <span>Tag: {item.tag_number}</span>
                                      </>
                                    )}
                                    {item.asset_number && (
                                      <>
                                        <span>•</span>
                                        <span>No: {item.asset_number}</span>
                                      </>
                                    )}
                                  </div>
                                </td>

                                <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                                  <div className="font-semibold text-slate-800">{item.nama_cabang || '-'}</div>
                                  <div className="text-[10px] text-slate-500">{item.nama_bidang_sekarang || '-'}</div>
                                </td>

                                <td className="py-2.5 px-3">
                                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold border ${
                                    item.basis_operasi === 'Continuous Operation'
                                      ? 'bg-purple-50 text-purple-700 border-purple-200'
                                      : 'bg-blue-50 text-blue-700 border-blue-200'
                                  }`}>
                                    {item.basis_operasi === 'Continuous Operation' ? 'Continuous (24h/7d)' : 'Working Day (8h/5d)'}
                                  </span>
                                </td>

                                <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                                  {uStats.actualHours} j
                                </td>

                                <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-700">
                                  {uStats.maintenanceHours} j
                                </td>

                                <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-900">
                                  {uStats.availableHours} j
                                </td>

                                <td className="py-2.5 px-3 min-w-[150px]">
                                  <div className="flex items-center justify-between text-xs font-bold mb-1">
                                    <span className={`font-mono ${itemTheme.text}`}>
                                      {uStats.rate}%
                                    </span>
                                    <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${itemTheme.badge}`}>
                                      {itemTheme.label.split(' ')[0]}
                                    </span>
                                  </div>
                                  <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full ${itemTheme.bg} rounded-full`}
                                      style={{ width: `${Math.min(100, Math.max(uStats.rate, 2))}%` }}
                                    />
                                  </div>
                                </td>

                                <td className="py-2.5 px-3 text-center">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedAssetModal(item);
                                      setModalWindowTab(operasionalTab);
                                    }}
                                    className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-100 hover:bg-[#005DAA] text-slate-700 hover:text-white rounded-md text-[10px] font-bold transition-all cursor-pointer shadow-2xs"
                                  >
                                    <Activity className="w-3 h-3" />
                                    <span>Detail</span>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>

            </div>
          );
        })()}
      </div>

      {/* TAHAP 4: METRIK UTILISASI TERPADU (WAKTU, PENDAPATAN, MODAL), MATRIKS 2X2 & PROYEKSI */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden space-y-6 p-5 sm:p-6">
        {/* Section Header & Global Filter Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-200 pb-5">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold bg-[#005DAA] text-white px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Tahap 4
              </span>
              <span className="text-xs font-bold bg-emerald-100 text-[#008C45] px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                Cut-Off H-1 (Kemarin 23:59:59)
              </span>
            </div>
            <h3 className="text-lg font-extrabold text-slate-900 mt-1">
              Monitoring Utilisasi Terpadu: Waktu, Pendapatan &amp; Yield Modal
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Evaluasi kinerja aset komprehensif mengintegrasikan jam pakai, pendapatan riil order, target prorata, yield modal, dan klasifikasi matriks 2x2.
            </p>
          </div>

          {/* Filter Periode & Dropdown Filter */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Periode Toggle */}
            <div className="inline-flex p-1 bg-slate-100 rounded-lg border border-slate-200 text-xs font-bold">
              <button
                type="button"
                onClick={() => setUtilisasiPeriode('bulan_ini')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  utilisasiPeriode === 'bulan_ini'
                    ? 'bg-[#005DAA] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Bulan Ini
              </button>
              <button
                type="button"
                onClick={() => setUtilisasiPeriode('ytd')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  utilisasiPeriode === 'ytd'
                    ? 'bg-[#005DAA] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                YTD
              </button>
              <button
                type="button"
                onClick={() => setUtilisasiPeriode('tahunan')}
                className={`px-3 py-1.5 rounded-md transition-all cursor-pointer ${
                  utilisasiPeriode === 'tahunan'
                    ? 'bg-[#005DAA] text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Tahun {utilisasiTahun}
              </button>
            </div>

            {/* Tahun Selector */}
            <select
              value={utilisasiTahun}
              onChange={(e) => {
                setUtilisasiTahun(Number(e.target.value));
                setUtilisasiPeriode('tahunan');
              }}
              className="py-1.5 px-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-700 cursor-pointer outline-hidden"
            >
              {[2026, 2025, 2024].map(y => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>

            {/* Cabang Filter */}
            {availableCabangs.length > 1 && (
              <select
                value={filterCabang}
                onChange={(e) => setFilterCabang(e.target.value)}
                className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer outline-hidden"
              >
                <option value="ALL">Semua Cabang</option>
                {availableCabangs.map(c => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}

            {/* Bidang Filter */}
            <select
              value={filterBidang}
              onChange={(e) => setFilterBidang(e.target.value)}
              className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer outline-hidden"
            >
              <option value="ALL">Semua Bidang</option>
              {availableBidangs.map(b => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>

            {/* Kategori Filter */}
            <select
              value={filterKategori}
              onChange={(e) => setFilterKategori(e.target.value)}
              className="py-1.5 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 cursor-pointer outline-hidden"
            >
              <option value="ALL">Semua Kategori</option>
              {availableCategories.map(k => (
                <option key={k} value={k}>{k}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 1. Matriks 2x2: UT vs RA */}
        <div>
          <MatriksUtilisasi2x2
            metrikList={summaryData?.data || []}
            onSelectAsset={handleOpenAssetHistory}
            canViewFinancials={canViewFinancials}
          />
        </div>

        {/* 2. Ringkasan Agregat per Bidang dan per Kategori */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 pt-2">
          {/* Ringkasan Agregat per Bidang */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center space-x-2">
                <Building2 className="w-4 h-4 text-[#005DAA]" />
                <h4 className="font-extrabold text-slate-900 text-xs">
                  Ringkasan Agregat per Bidang (RA Agregat = ΣR / ΣP prorata)
                </h4>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {summaryData?.agregat_bidang?.length || 0} Bidang
              </span>
            </div>

            <div className="overflow-x-auto max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-2">Bidang</th>
                    <th className="py-2 px-2 text-center">Aset</th>
                    <th className="py-2 px-2 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <span>UT (%)</span>
                        <MetricTooltip type="UT" position="bottom" />
                      </div>
                    </th>
                    {canViewFinancials && (
                      <>
                        <th className="py-2 px-2 text-right">Total Pendapatan (R)</th>
                        <th className="py-2 px-2 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <span>RA Agregat</span>
                            <MetricTooltip type="RA" position="bottom" />
                          </div>
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px] font-medium">
                  {summaryData?.agregat_bidang && summaryData.agregat_bidang.length > 0 ? (
                    summaryData.agregat_bidang.map((b, idx) => (
                      <tr key={idx} className="hover:bg-white">
                        <td className="py-2 px-2 font-bold text-slate-800 truncate max-w-[150px]">{b.grup}</td>
                        <td className="py-2 px-2 text-center font-mono">{b.total_aset}</td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-[#005DAA]">{b.ut_agregat}%</td>
                        {canViewFinancials && (
                          <>
                            <td className="py-2 px-2 text-right font-mono font-bold text-emerald-800">
                              Rp {Math.round(b.total_pendapatan_r || 0).toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-bold">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                (b.ra_agregat ?? 0) >= 100 ? 'bg-emerald-100 text-emerald-800' :
                                (b.ra_agregat ?? 0) >= 70 ? 'bg-amber-100 text-amber-800' :
                                'bg-rose-100 text-rose-800'
                              }`}>
                                {b.ra_agregat !== null ? `${b.ra_agregat}%` : '-'}
                              </span>
                            </td>
                          </>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400 italic">
                        Memuat ringkasan bidang...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Ringkasan Agregat per Kategori */}
          <div className="bg-slate-50/70 border border-slate-200 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <div className="flex items-center space-x-2">
                <Layers className="w-4 h-4 text-emerald-600" />
                <h4 className="font-extrabold text-slate-900 text-xs">
                  Ringkasan Agregat per Kategori (RA Agregat = ΣR / ΣP prorata)
                </h4>
              </div>
              <span className="text-[10px] text-slate-400 font-mono">
                {summaryData?.agregat_kategori?.length || 0} Kategori
              </span>
            </div>

            <div className="overflow-x-auto max-h-60 overflow-y-auto">
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] uppercase font-bold text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2 px-2">Kategori</th>
                    <th className="py-2 px-2 text-center">Aset</th>
                    <th className="py-2 px-2 text-right">
                      <div className="flex items-center justify-end space-x-1">
                        <span>UT (%)</span>
                        <MetricTooltip type="UT" position="bottom" />
                      </div>
                    </th>
                    {canViewFinancials && (
                      <>
                        <th className="py-2 px-2 text-right">Total Pendapatan (R)</th>
                        <th className="py-2 px-2 text-right">
                          <div className="flex items-center justify-end space-x-1">
                            <span>RA Agregat</span>
                            <MetricTooltip type="RA" position="bottom" />
                          </div>
                        </th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-[11px] font-medium">
                  {summaryData?.agregat_kategori && summaryData.agregat_kategori.length > 0 ? (
                    summaryData.agregat_kategori.map((k, idx) => (
                      <tr key={idx} className="hover:bg-white">
                        <td className="py-2 px-2 font-bold text-slate-800 truncate max-w-[150px]">{k.grup}</td>
                        <td className="py-2 px-2 text-center font-mono">{k.total_aset}</td>
                        <td className="py-2 px-2 text-right font-mono font-bold text-[#005DAA]">{k.ut_agregat}%</td>
                        {canViewFinancials && (
                          <>
                            <td className="py-2 px-2 text-right font-mono font-bold text-emerald-800">
                              Rp {Math.round(k.total_pendapatan_r || 0).toLocaleString('id-ID')}
                            </td>
                            <td className="py-2 px-2 text-right font-mono font-bold">
                              <span className={`px-1.5 py-0.5 rounded text-[10px] ${
                                (k.ra_agregat ?? 0) >= 100 ? 'bg-emerald-100 text-emerald-800' :
                                (k.ra_agregat ?? 0) >= 70 ? 'bg-amber-100 text-amber-800' :
                                'bg-rose-100 text-rose-800'
                              }`}>
                                {k.ra_agregat !== null ? `${k.ra_agregat}%` : '-'}
                              </span>
                            </td>
                          </>
                        )}
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="py-4 text-center text-slate-400 italic">
                        Memuat ringkasan kategori...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* 3. Tabel Seluruh Aset dengan UT, RA, YR, Skor Terpadu & Tooltip Rumus */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs space-y-3 pt-3">
          <div className="px-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h4 className="font-extrabold text-slate-900 text-sm flex items-center gap-2">
                <span>Tabel Kinerja &amp; Utilisasi Seluruh Aset</span>
                <span className="text-[11px] font-bold bg-blue-100 text-[#005DAA] px-2 py-0.5 rounded-full">
                  {sortedSummaryAsets.length} Unit Terpantau
                </span>
              </h4>
              <p className="text-[11px] text-slate-500">
                Arahkan kursor pada ikon informasi (?) untuk melihat rumus perhitungan detail masing-masing metrik.
              </p>
            </div>

            {/* Search Input in Table */}
            <div className="relative min-w-[200px]">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari aset, bidang, kategori..."
                value={searchTableAset}
                onChange={(e) => setSearchTableAset(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-hidden focus:ring-1 focus:ring-[#005DAA]"
              />
            </div>
          </div>

          <div className="overflow-x-auto max-h-[460px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100 text-slate-600 font-bold uppercase tracking-wider text-[10px] sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3">Aset &amp; Identitas</th>
                  <th className="py-2.5 px-3">Penempatan</th>
                  <th className="py-2.5 px-3">
                    <div className="flex items-center space-x-1">
                      <span>UT (Waktu)</span>
                      <MetricTooltip type="UT" position="bottom" />
                    </div>
                  </th>
                  {canViewFinancials ? (
                    <>
                      <th className="py-2.5 px-3">
                        <div className="flex items-center space-x-1">
                          <span>RA (Pendapatan)</span>
                          <MetricTooltip type="RA" position="bottom" />
                        </div>
                      </th>
                      <th className="py-2.5 px-3">
                        <div className="flex items-center space-x-1">
                          <span>YR (Yield Modal)</span>
                          <MetricTooltip type="YR" position="bottom" />
                        </div>
                      </th>
                      <th className="py-2.5 px-3">
                        <div className="flex items-center space-x-1">
                          <span>Skor Terpadu</span>
                          <MetricTooltip type="SKOR" position="bottom" />
                        </div>
                      </th>
                    </>
                  ) : (
                    <th className="py-2.5 px-3 text-slate-400">Metrik Keuangan</th>
                  )}
                  <th className="py-2.5 px-3 text-center">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-xs">
                {sortedSummaryAsets.length > 0 ? (
                  sortedSummaryAsets.map((item) => {
                    const utClassColor =
                      item.ut_klasifikasi === 'Optimal' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                      item.ut_klasifikasi === 'Moderat' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                      'bg-rose-100 text-rose-800 border-rose-300';

                    const raClassColor =
                      item.ra_klasifikasi === 'Optimal' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                      item.ra_klasifikasi === 'Moderat' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                      'bg-rose-100 text-rose-800 border-rose-300';

                    return (
                      <tr key={item.id_aset} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3">
                          <div className="font-bold text-slate-900">{item.nama_aset}</div>
                          <div className="text-[10px] font-mono text-slate-500 mt-0.5 flex items-center space-x-1.5">
                            <span className="font-bold text-[#005DAA]">{item.id_aset}</span>
                            <span>•</span>
                            <span>{item.kategori}</span>
                          </div>
                        </td>

                        <td className="py-2.5 px-3 text-[11px] text-slate-600">
                          <div className="font-semibold text-slate-800">{item.nama_cabang || '-'}</div>
                          <div className="text-[10px] text-slate-500">{item.nama_bidang}</div>
                        </td>

                        <td className="py-2.5 px-3">
                          <div className="flex items-center space-x-2">
                            <span className="font-mono font-bold text-slate-900 text-sm">
                              {item.ut_persen}%
                            </span>
                            <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${utClassColor}`}>
                              {item.ut_klasifikasi}
                            </span>
                          </div>
                          <div className="text-[10px] text-slate-500 mt-0.5">
                            {item.jam_pakai_total}j / {item.kapasitas_netto_a}j
                          </div>
                        </td>

                        {canViewFinancials ? (
                          <>
                            <td className="py-2.5 px-3">
                              {item.ra_persen !== null ? (
                                <div>
                                  <div className="flex items-center space-x-2">
                                    <span className="font-mono font-bold text-emerald-800 text-sm">
                                      {item.ra_persen}%
                                    </span>
                                    {item.ra_klasifikasi && (
                                      <span className={`text-[9px] px-1.5 py-0.2 rounded font-bold border ${raClassColor}`}>
                                        {item.ra_klasifikasi}
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[10px] text-slate-500 mt-0.5 truncate">
                                    R: Rp {Math.round(item.pendapatan_riil_r).toLocaleString('id-ID')}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-400 font-bold">-</span>
                              )}
                            </td>

                            <td className="py-2.5 px-3">
                              <span className="font-mono font-bold text-amber-900">
                                {item.catatan_yr || (item.yr_persen !== null ? `${item.yr_persen}%/thn` : '-')}
                              </span>
                            </td>

                            <td className="py-2.5 px-3">
                              {item.skor_terpadu !== null ? (
                                <div>
                                  <span className="font-mono font-extrabold text-purple-900 text-sm">
                                    {item.skor_terpadu}%
                                  </span>
                                  {item.kuadran_2x2 && (
                                    <div className="text-[9px] font-bold text-purple-700 mt-0.5">
                                      {item.kuadran_2x2.nama}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-slate-400 font-bold">-</span>
                              )}
                            </td>
                          </>
                        ) : (
                          <td className="py-2.5 px-3 text-slate-400 text-xs italic">
                            Terbatas Role
                          </td>
                        )}

                        <td className="py-2.5 px-3 text-center">
                          <button
                            type="button"
                            onClick={() => handleOpenAssetHistory(item.id_aset)}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-[#005DAA] text-[#005DAA] hover:text-white rounded-lg text-[10px] font-bold transition-all shadow-2xs cursor-pointer inline-flex items-center space-x-1"
                          >
                            <TrendingUp className="w-3 h-3" />
                            <span>Detail &amp; Proyeksi</span>
                          </button>
                        </td>
                      </tr>
                    );
                  })
                ) : (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400 text-xs italic">
                      Tidak ada aset yang sesuai kriteria filter.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* Detail History Modal triggered from Tahap 4 Matriks & Table */}
      {detailHistoryAset && (
        <AssetHistoryModal
          isOpen={Boolean(detailHistoryAset)}
          onClose={() => setDetailHistoryAset(null)}
          aset={detailHistoryAset}
          currentUser={currentUser}
        />
      )}

      {/* Overdue Asset Warning Banner */}
      {displayStats.terlambatPengembalian !== undefined && displayStats.terlambatPengembalian > 0 && (
        <div 
          onClick={() => onNavigateToTab('master')}
          className="bg-red-600 text-white p-4 rounded-xl shadow-md border border-red-700 flex items-center justify-between cursor-pointer hover:bg-red-700 transition-all"
        >
          <div>
            <h4 className="font-extrabold text-sm sm:text-base">
              {displayStats.terlambatPengembalian} Aset Lapangan Terlambat Dikembalikan (&gt;1 Hari)
            </h4>
            <p className="text-xs text-red-100 mt-0.5">
              Peralatan masih berstatus 'Digunakan' melewati batas rencana pengembalian tanpa perubahan status atau pengajuan perpanjangan. Notifikasi email otomatis telah dikirim ke PIC &amp; Fungsi Umum.
            </p>
          </div>
          <div className="hidden sm:flex items-center font-bold text-xs bg-white text-red-700 px-3.5 py-2 rounded-lg shadow-xs shrink-0 hover:bg-red-50">
            <span>Filter Aset Terlambat</span>
          </div>
        </div>
      )}

      {/* Main Grid: Distribution + Calibration Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 2. Peta / Distribusi Aset per Bidang */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest flex items-center gap-2">
              <Building2 className="w-4 h-4 text-[#005DAA]" />
              <span>Distribusi Aset per Bidang & Unit Pelayanan</span>
            </h3>
            <span className="text-[10px] bg-emerald-100 text-[#008C45] px-2.5 py-0.5 rounded-full font-bold uppercase">Real-time</span>
          </div>

          <div className="p-5 space-y-4">
            {normalizedAsetPerBidang.map((b, idx) => (
              <div key={idx} className="space-y-1">
                <div className="flex justify-between text-xs font-medium">
                  <span className="font-semibold text-slate-800 truncate max-w-[280px] sm:max-w-md">{b.nama_bidang}</span>
                  <span className="font-bold text-[#005DAA]">{b.jumlah} Unit ({b.persen}%)</span>
                </div>
                <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
                  <div 
                    className="bg-[#008C45] h-full rounded-full transition-all duration-500"
                    style={{ width: `${Math.max(b.persen, 5)}%` }}
                  ></div>
                </div>
              </div>
            ))}
          </div>

          <div className="p-3.5 bg-slate-50 border-t border-slate-100 flex items-center justify-end text-xs">
            <button 
              onClick={() => onNavigateToTab('master')} 
              className="text-[#005DAA] font-bold hover:underline flex items-center space-x-1"
            >
              <span>Lihat Detail Master Aset</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* 3. Peringatan Kalibrasi (H-30 / Overdue) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between overflow-hidden">
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-500" />
              <span>Peringatan Kalibrasi (H-30)</span>
            </h3>
            <span className="bg-rose-100 text-rose-700 text-xs px-2.5 py-0.5 rounded-full font-bold">
              {displayStats.kalibrasiAlerts.length} Aset
            </span>
          </div>

          <div className="p-5 space-y-3 max-h-[280px] overflow-y-auto divide-y divide-slate-100">
            {displayStats.kalibrasiAlerts.length === 0 ? (
              <div className="text-center py-8 text-slate-500 text-xs">
                <CheckCircle2 className="w-8 h-8 text-[#008C45] mx-auto mb-1.5" />
                Semua aset dalam jadwal kalibrasi aman.
              </div>
            ) : (
              displayStats.kalibrasiAlerts.map((a) => {
                const today = new Date();
                const dueDate = a.tgl_kalibrasi_berikutnya ? new Date(a.tgl_kalibrasi_berikutnya) : null;
                const isOverdue = dueDate && dueDate < today;

                return (
                  <div key={a.id_aset} className="pt-2.5 text-xs flex items-center justify-between">
                    <div>
                      <div className="font-bold text-slate-900 truncate max-w-[200px]">{a.nama}</div>
                      <div className="text-[10px] text-slate-500">{a.nama_bidang_sekarang}</div>
                    </div>
                    <div className="text-right">
                      <span className={`inline-block text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                        isOverdue 
                          ? 'bg-rose-100 text-rose-800 border border-rose-200 animate-pulse' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {isOverdue ? 'Jatuh Tempo!' : `Jatuh Tempo: ${a.tgl_kalibrasi_berikutnya}`}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="p-4 bg-slate-50 border-t border-slate-100 flex justify-end">
            <button 
              onClick={() => onNavigateToTab('kalibrasi')}
              className="text-xs text-[#005DAA] font-bold hover:underline flex items-center space-x-1"
            >
              <span>Buka Modul Kalibrasi</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

      </div>

      {/* Bottom Grid: Pengajuan Menunggu Persetujuan & Real-Time Audit Log Stream */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* 4. Pengajuan Menunggu Persetujuan (Approval Workflow) */}
        <div className={`${currentUser.role === 'admin' ? 'lg:col-span-6' : 'lg:col-span-12'} bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden`}>
          <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest flex items-center gap-2">
              <FileCheck className="w-4 h-4 text-[#005DAA]" />
              <span>Pengajuan Menunggu Persetujuan</span>
            </h3>
            <span className="bg-amber-100 text-amber-800 text-xs px-2.5 py-0.5 rounded-full font-bold">
              {pendingRequests.length} Pending
            </span>
          </div>

          <div className="p-5 space-y-3 max-h-[300px] overflow-y-auto">
            {pendingRequests.length === 0 ? (
              <div className="text-center py-10 text-slate-400 text-xs">
                Tidak ada pengajuan transfer atau disposal yang memerlukan persetujuan saat ini.
              </div>
            ) : (
              pendingRequests.map((p, idx) => (
                <div key={`${p.id_pengajuan}-${idx}`} className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#005DAA] text-sm">{p.nama_aset}</span>
                    <span className={`px-2.5 py-0.5 rounded-full font-bold text-[10px] ${
                      p.jenis === 'Transfer' ? 'bg-blue-100 text-blue-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {p.jenis}
                    </span>
                  </div>

                  <div className="text-slate-600 space-y-1">
                    <p><span className="font-medium text-slate-500">Pemohon:</span> {p.pemohon_nama} ({p.nama_bidang_asal})</p>
                    {p.pemegang_baru && (
                      <p><span className="font-medium text-emerald-700 font-semibold">Calon Pemegang Terakhir:</span> <span className="bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded font-bold">{p.pemegang_baru}</span></p>
                    )}
                    {p.tgl_rencana_pengembalian && (
                      <p><span className="font-medium text-amber-800 font-semibold">📅 Target Selesai Pakai:</span> <span className="bg-amber-100 text-amber-900 px-1.5 py-0.5 rounded font-bold">{p.tgl_rencana_pengembalian}</span></p>
                    )}
                    {p.jenis === 'Transfer' && (
                      <p><span className="font-medium text-slate-500">Tujuan:</span> {p.nama_bidang_tujuan}</p>
                    )}
                    <p><span className="font-medium text-slate-500">Alasan:</span> {p.alasan}</p>
                  </div>

                  {(() => {
                    const check = canUserApprovePengajuan(p, currentUser);
                    if (check.allowed) {
                      return (
                        <div className="flex items-center space-x-2 pt-2 border-t border-slate-200">
                          <button
                            onClick={() => onApproveRequest(p.id_pengajuan, 'Disetujui via Dashboard')}
                            className="bg-[#008C45] hover:bg-[#007037] text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 shadow-xs transition-colors"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Setujui</span>
                          </button>
                          <button
                            onClick={() => onRejectRequest(p.id_pengajuan, 'Ditolak via Dashboard')}
                            className="bg-rose-600 hover:bg-rose-700 text-white px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1 shadow-xs transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                            <span>Tolak</span>
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div className="bg-amber-50/80 border border-amber-200/60 rounded-lg p-2 text-[11px] text-amber-900 font-medium flex items-start space-x-1.5 mt-2">
                        <AlertCircle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                        <span>{check.reason}</span>
                      </div>
                    );
                  })()}
                </div>
              ))
            )}
          </div>
        </div>

        {/* 5. Riwayat Aktivitas Terbaru (Audit Trail) - KHUSUS FUNGSI UMUM */}
        {currentUser.role === 'admin' && (
          <div className="lg:col-span-6 bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="font-bold text-slate-700 uppercase text-xs tracking-widest flex items-center gap-2">
                <Activity className="w-4 h-4 text-[#008C45]" />
                <span>Aktivitas Terbaru (Audit Trail)</span>
              </h3>
              <button
                onClick={() => onNavigateToTab('audit')}
                className="text-xs text-[#005DAA] font-bold hover:underline"
              >
                Lihat Semua
              </button>
            </div>

            <div className="p-5 space-y-3 max-h-[300px] overflow-y-auto divide-y divide-slate-100">
              {auditLogs.slice(0, 6).map((log) => (
                <div key={log.id_log} className="pt-2.5 text-xs flex items-start space-x-3">
                  <div className="w-2 h-2 rounded-full bg-[#008C45] mt-1.5 shrink-0"></div>
                  <div className="flex-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900">{log.aktor}</span>
                      <span className="text-[10px] text-slate-400 font-mono">
                        {new Date(log.waktu).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <p className="text-slate-600 text-[11px] mt-0.5">{log.detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>

      {/* MODAL: Detail Utilisasi Per-Aset (Popup Rincian Kalkulasi) */}
      {selectedAssetModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 overflow-y-auto p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-gray-100 my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95">
            
            {/* Header Modal */}
            <div className="shrink-0 flex items-center justify-between pb-3.5 border-b border-gray-100">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                  Rincian Utilisasi Per-Aset: {selectedAssetModal.nama}
                </h3>
                  <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 font-mono">
                    <span className="font-bold text-[#005DAA]">{selectedAssetModal.id_aset}</span>
                    {selectedAssetModal.tag_number && (
                      <>
                        <span>•</span>
                        <span>Tag: {selectedAssetModal.tag_number}</span>
                      </>
                    )}
                    {selectedAssetModal.asset_number && (
                      <>
                        <span>•</span>
                        <span>No: {selectedAssetModal.asset_number}</span>
                      </>
                    )}
                  </div>
                </div>
              <button 
                onClick={() => setSelectedAssetModal(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="overflow-y-auto flex-1 min-h-0 py-4 space-y-4 text-xs">
              
              {/* Asset Identity Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block">Basis Jam Kerja:</span>
                  <span className="font-bold text-slate-900">
                    {selectedAssetModal.basis_operasi || 'Working Day Based'}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {selectedAssetModal.basis_operasi === 'Continuous Operation' ? '24 Jam / 7 Hari' : '8 Jam / 5 Hari'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block">Status Fisik:</span>
                  <span className="font-bold text-slate-900">{selectedAssetModal.status}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block">Cabang / Lokasi:</span>
                  <span className="font-bold text-slate-900">{selectedAssetModal.nama_cabang || '-'}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block">Bidang / Unit:</span>
                  <span className="font-bold text-slate-900">{selectedAssetModal.nama_bidang_sekarang || '-'}</span>
                </div>
              </div>

              {/* Bukti Fisik Pengembalian Terakhir (Jika Tersedia) */}
              {Boolean(selectedAssetModal.foto_pengembalian_terakhir || selectedAssetModal.lokasi_pengembalian_terakhir || selectedAssetModal.koordinat_gps_terakhir) && (
                <div className="bg-emerald-50/80 border border-emerald-300 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-start space-x-3">
                    {selectedAssetModal.foto_pengembalian_terakhir ? (
                      <img
                        src={selectedAssetModal.foto_pengembalian_terakhir}
                        alt="Bukti Pengembalian Terakhir"
                        onClick={() => setPreviewPhoto(selectedAssetModal.foto_pengembalian_terakhir!)}
                        className="w-14 h-14 rounded-lg object-cover border border-emerald-300 shadow-xs cursor-pointer hover:opacity-90 shrink-0"
                        title="Klik untuk memperbesar foto bukti"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-700 shrink-0 border border-emerald-200">
                        <Camera className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center space-x-1.5 font-bold text-emerald-950">
                        <Camera className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Bukti Fisik Selesai Digunakan Terakhir</span>
                        <span className="text-[10px] bg-emerald-200 text-emerald-900 px-1.5 py-0.2 rounded font-bold">Tersedia</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        Lokasi: <strong>{selectedAssetModal.lokasi_pengembalian_terakhir || selectedAssetModal.lokasi_sekarang}</strong>
                      </p>
                      {selectedAssetModal.koordinat_gps_terakhir && (
                        <a
                          href={`https://www.google.com/maps?q=${selectedAssetModal.koordinat_gps_terakhir.lat},${selectedAssetModal.koordinat_gps_terakhir.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-[11px] font-bold text-[#005DAA] hover:underline mt-0.5"
                        >
                          <MapPin className="w-3 h-3 text-rose-500" />
                          <span>Titik GPS: {selectedAssetModal.koordinat_gps_terakhir.lat.toFixed(5)}, {selectedAssetModal.koordinat_gps_terakhir.lng.toFixed(5)} (Buka Google Maps)</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Time Window Selector Tabs */}
              <div className="flex items-center space-x-1 p-1 bg-slate-100 rounded-xl border border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalWindowTab('mingguan')}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    modalWindowTab === 'mingguan'
                      ? 'bg-white text-[#005DAA] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  7 Hari Terakhir
                </button>
                <button
                  type="button"
                  onClick={() => setModalWindowTab('bulanan')}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    modalWindowTab === 'bulanan'
                      ? 'bg-white text-[#005DAA] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  30 Hari Terakhir
                </button>
                <button
                  type="button"
                  onClick={() => setModalWindowTab('allTime')}
                  className={`flex-1 py-1.5 px-3 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    modalWindowTab === 'allTime'
                      ? 'bg-white text-[#005DAA] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sejak Dioperasikan
                </button>
              </div>

              {/* Active Window Utilization Stats */}
              {(() => {
                const modalStats = selectedAssetModal.utilization?.[modalWindowTab] || {
                  rate: 0,
                  actualHours: 0,
                  availableHours: 0,
                  maintenanceHours: 0,
                  sessions: []
                };
                const mTheme = getRateColor(modalStats.rate);

                return (
                  <div className="space-y-4">
                    {/* Big Summary Rate */}
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                          Tingkat Utilisasi Unit ({modalWindowTab === 'mingguan' ? '7 Hari' : modalWindowTab === 'bulanan' ? '30 Hari' : 'All-Time'})
                        </span>
                        <div className="flex items-baseline space-x-2 mt-1">
                          <span className={`text-3xl font-black ${mTheme.text}`}>
                            {modalStats.rate}%
                          </span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-bold border ${mTheme.badge}`}>
                            {mTheme.label}
                          </span>
                        </div>
                        <div className="w-56 bg-slate-200 h-2 rounded-full mt-2 overflow-hidden">
                          <div
                            className={`h-full ${mTheme.bg} rounded-full`}
                            style={{ width: `${Math.min(100, Math.max(modalStats.rate, 2))}%` }}
                          />
                        </div>
                      </div>

                      <div className="bg-white p-3 rounded-xl border border-slate-200 font-mono text-[11px] space-y-1 sm:text-right">
                        <div>Actual Time: <strong className="text-emerald-700">{modalStats.actualHours} jam</strong></div>
                        <div>Maintenance Downtime: <strong className="text-amber-700">-{modalStats.maintenanceHours} jam</strong></div>
                        <div>Available Time Netto: <strong className="text-blue-900">{modalStats.availableHours} jam</strong></div>
                      </div>
                    </div>

                    {/* Breakdown Formula */}
                    <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
                      <div className="flex items-center justify-between font-bold text-blue-900 text-xs">
                        <span>Rumus &amp; Perhitungan Mandiri Aset Ini:</span>
                        <span className="font-mono bg-white px-2 py-0.5 rounded border border-blue-200 text-[#005DAA]">
                          ({modalStats.actualHours} / {modalStats.availableHours}) × 100% = {modalStats.rate}%
                        </span>
                      </div>
                      <p className="text-[11px] text-blue-800 leading-relaxed">
                        • Jam aktual dihitung dari total waktu durasi saat aset ditransisikan berstatus <em>'Digunakan'</em> via scan QR sampai kembali <em>'Tersedia'</em>.<br/>
                        • Jika aset masuk status <em>'Dalam Pemeliharaan'</em>, jam downtime ({modalStats.maintenanceHours} jam) mengurangi basis jam kerja sehingga rasio utilisasi adil dan proporsional.
                      </p>
                    </div>

                    {/* Log Sesi Pemakaian */}
                    <div className="space-y-2">
                      <h4 className="font-bold text-slate-800 text-xs flex items-center justify-between">
                        <span>Riwayat Sesi Pemakaian Pada Periode Ini</span>
                        <span className="text-[10px] text-slate-500 font-normal">
                          {modalStats.sessions?.length || 0} Sesi Tercatat
                        </span>
                      </h4>

                      {modalStats.sessions && modalStats.sessions.length > 0 ? (
                        <div className="max-h-56 overflow-y-auto space-y-2 border border-slate-200 rounded-xl p-2 bg-slate-50">
                          {modalStats.sessions.map((sess, idx) => {
                            // Find corresponding session details in riwayat_operasi if exists
                            const opDetail = selectedAssetModal.riwayat_operasi?.find(
                              r => (r.id_sesi && r.id_sesi === sess.id_sesi) ||
                                   (r.waktu_mulai === sess.mulai)
                            );
                            const photo = opDetail?.foto_pengembalian || (idx === modalStats.sessions.length - 1 ? selectedAssetModal.foto_pengembalian_terakhir : undefined);
                            const gps = opDetail?.koordinat_gps || (idx === modalStats.sessions.length - 1 ? selectedAssetModal.koordinat_gps_terakhir : undefined);
                            const loc = opDetail?.lokasi_pengembalian || opDetail?.catatan;

                            return (
                              <div key={idx} className="bg-white p-2.5 rounded-lg border border-slate-100 space-y-1.5 text-[11px]">
                                <div className="flex items-center justify-between">
                                  <div>
                                    <span className="font-bold text-slate-900 block">{sess.pic || 'Personel Lapangan'}</span>
                                    <span className="text-[10px] text-slate-500 font-mono">
                                      {new Date(sess.mulai).toLocaleDateString('id-ID')} • {new Date(sess.mulai).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} s/d {sess.selesai ? new Date(sess.selesai).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Selesai'}
                                    </span>
                                  </div>
                                  <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                                    +{sess.durasiJam} jam
                                  </span>
                                </div>

                                {/* Photo & GPS proof if captured */}
                                {(photo || gps) && (
                                  <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[10px]">
                                    <div className="flex items-center space-x-2">
                                      {photo && (
                                        <img
                                          src={photo}
                                          alt="Bukti Foto"
                                          onClick={() => setPreviewPhoto(photo)}
                                          className="w-8 h-8 rounded object-cover border border-slate-200 cursor-pointer hover:opacity-90 shrink-0"
                                          title="Klik untuk melihat foto fisik barang"
                                        />
                                      )}
                                      <span className="text-slate-600 truncate max-w-[200px]">
                                        {loc ? `Lokasi: ${loc}` : 'Bukti foto fisik terlampir'}
                                      </span>
                                    </div>
                                    {gps && (
                                      <a
                                        href={`https://www.google.com/maps?q=${gps.lat},${gps.lng}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center space-x-1 font-bold text-[#005DAA] hover:underline shrink-0"
                                      >
                                        <MapPin className="w-3 h-3 text-rose-500" />
                                        <span>GPS: {gps.lat.toFixed(4)}, {gps.lng.toFixed(4)}</span>
                                      </a>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="p-4 text-center bg-slate-50 rounded-xl border border-slate-200 text-slate-400 text-[11px]">
                          Belum ada catatan durasi pemakaian pada jendela waktu ini.
                        </div>
                      )}
                    </div>
                  </div>
                );
              })()}

            </div>

            {/* Footer */}
            <div className="shrink-0 pt-3 border-t border-gray-100 flex justify-end">
              <button
                type="button"
                onClick={() => setSelectedAssetModal(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl transition-all cursor-pointer"
              >
                Tutup
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Lightbox Modal Preview Foto Selesai Pemakaian */}
      {previewPhoto && (
        <div 
          className="fixed inset-0 bg-black/80 z-60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setPreviewPhoto(null)}
        >
          <div 
            className="relative max-w-lg w-full bg-white rounded-2xl p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs font-bold text-slate-900">
              <div className="flex items-center space-x-2">
                <Camera className="w-4 h-4 text-[#005DAA]" />
                <span>Bukti Foto Fisik Pengembalian Aset</span>
              </div>
              <button 
                onClick={() => setPreviewPhoto(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[65vh] overflow-hidden rounded-xl border border-slate-200 bg-slate-900 flex items-center justify-center">
              <img 
                src={previewPhoto} 
                alt="Bukti Foto Barang" 
                className="max-h-[65vh] w-auto max-w-full object-contain" 
              />
            </div>
            <p className="text-center text-[11px] text-slate-500">
              Foto kondisi fisik aset yang diunggah saat pemakaian dihentikan dan status berubah menjadi <strong>Tersedia</strong>.
            </p>
          </div>
        </div>
      )}

    </div>
  );
};
