import React, { useState, useEffect, useMemo } from 'react';
import { 
  Aset, 
  AuditLog, 
  Assignment, 
  RiwayatKalibrasi, 
  Pengajuan, 
  User,
  ProyeksiPendapatanAset
} from '../types';
import { 
  History, 
  X, 
  Clock, 
  User as UserIcon, 
  ArrowRightLeft, 
  Calendar, 
  FileText, 
  CheckCircle2, 
  Search, 
  Camera, 
  MapPin, 
  Loader2, 
  HelpCircle, 
  TrendingUp, 
  BarChart3, 
  AlertTriangle, 
  Gauge, 
  Coins, 
  Receipt,
  Sparkles,
  ShieldCheck,
  Package,
  Layers,
  Lock,
  ExternalLink
} from 'lucide-react';
import { apiClient } from '../lib/apiClient';
import { MetricTooltip } from './MetricTooltip';

interface AssetHistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  aset: Aset | null;
  auditLogs?: AuditLog[];
  assignments?: Assignment[];
  kalibrasiList?: RiwayatKalibrasi[];
  pengajuanList?: Pengajuan[];
  currentUser: User;
}

type HistoryTab = 'operasi' | 'metrik' | 'assignment' | 'kalibrasi' | 'pengajuan' | 'audit';

export const AssetHistoryModal: React.FC<AssetHistoryModalProps> = ({
  isOpen,
  onClose,
  aset,
  auditLogs = [],
  assignments = [],
  kalibrasiList = [],
  pengajuanList = [],
  currentUser
}) => {
  const [activeTab, setActiveTab] = useState<HistoryTab>('operasi');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Detail data fetched from server
  const [fetchedDetail, setFetchedDetail] = useState<{
    assignments: Assignment[];
    kalibrasi: RiwayatKalibrasi[];
    pengajuan: Pengajuan[];
    proyeksi?: ProyeksiPendapatanAset[];
  } | null>(null);
  const [isFetchingDetail, setIsFetchingDetail] = useState(false);

  // Proyeksi data
  const [proyeksiList, setProyeksiList] = useState<ProyeksiPendapatanAset[]>([]);
  const [isFetchingProyeksi, setIsFetchingProyeksi] = useState(false);

  // Real Revenue data
  const [pendapatanRiil, setPendapatanRiil] = useState<any | null>(null);
  const [isFetchingPendapatan, setIsFetchingPendapatan] = useState(false);

  // Utilisasi Metrics data
  const [selectedPeriode, setSelectedPeriode] = useState<'bulan_ini' | 'ytd' | 'tahunan'>('bulan_ini');
  const [selectedTahun, setSelectedTahun] = useState<number>(new Date().getFullYear());
  const [metrikUtilisasi, setMetrikUtilisasi] = useState<any | null>(null);
  const [monthlyBreakdown, setMonthlyBreakdown] = useState<any[]>([]);
  const [isFetchingMetrik, setIsFetchingMetrik] = useState(false);

  const isAuthorized = ['puma', 'pic_bidang', 'admin', 'management', 'pimpinan'].includes(currentUser.role);
  const canViewFinancials = ['puma', 'pic_bidang', 'admin'].includes(currentUser.role);

  useEffect(() => {
    if (isOpen && aset && isAuthorized) {
      setIsFetchingProyeksi(true);
      apiClient.getProyeksiAset(aset.id_aset)
        .then(data => setProyeksiList(data || []))
        .catch(err => console.warn('Failed to fetch proyeksi:', err))
        .finally(() => setIsFetchingProyeksi(false));

      setIsFetchingPendapatan(true);
      apiClient.getAsetPendapatanRiil(aset.id_aset)
        .then(data => setPendapatanRiil(data))
        .catch(err => console.warn('Failed to fetch real revenue:', err))
        .finally(() => setIsFetchingPendapatan(false));

      setIsFetchingMetrik(true);
      apiClient.getAsetMetrikUtilisasi(aset.id_aset, { periode: selectedPeriode, tahun: selectedTahun })
        .then(res => {
          if (res) {
            setMetrikUtilisasi(res.metrik);
            setMonthlyBreakdown(res.monthly_breakdown || []);
          }
        })
        .catch(err => console.warn('Failed to fetch metrik:', err))
        .finally(() => setIsFetchingMetrik(false));

      setIsFetchingDetail(true);
      apiClient.getAsetDetail(aset.id_aset)
        .then((res: any) => {
          if (res) {
            setFetchedDetail({
              assignments: res.assignments || [],
              kalibrasi: res.kalibrasi || [],
              pengajuan: res.pengajuan || [],
              proyeksi: res.proyeksi || []
            });
            if (res.proyeksi && Array.isArray(res.proyeksi) && res.proyeksi.length > 0) {
              setProyeksiList(res.proyeksi);
            }
          }
        })
        .catch(err => console.warn('Failed to fetch detail:', err))
        .finally(() => setIsFetchingDetail(false));
    }
  }, [isOpen, aset?.id_aset, isAuthorized, selectedPeriode, selectedTahun]);

  // Merged lists
  const activeAssignments = useMemo(() => {
    const list = fetchedDetail?.assignments?.length ? fetchedDetail.assignments : assignments;
    return list.filter(a => a.id_aset === aset?.id_aset);
  }, [fetchedDetail, assignments, aset?.id_aset]);

  const activeKalibrasi = useMemo(() => {
    const list = fetchedDetail?.kalibrasi?.length ? fetchedDetail.kalibrasi : kalibrasiList;
    return list.filter(k => k.id_aset === aset?.id_aset);
  }, [fetchedDetail, kalibrasiList, aset?.id_aset]);

  const activePengajuan = useMemo(() => {
    const list = fetchedDetail?.pengajuan?.length ? fetchedDetail.pengajuan : pengajuanList;
    return list.filter(p => p.id_aset === aset?.id_aset);
  }, [fetchedDetail, pengajuanList, aset?.id_aset]);

  const assetAuditLogs = useMemo(() => {
    if (!aset) return [];
    return auditLogs.filter(
      l => (l.id_aset && l.id_aset === aset.id_aset) || 
           (l.nama_aset && l.nama_aset === aset.nama) ||
           (l.detail && l.detail.toLowerCase().includes(aset.id_aset.toLowerCase()))
    );
  }, [auditLogs, aset]);

  // Operational Sessions: Ber-Order & Internal
  const { sessionsWithOrder, sessionsInternal } = useMemo(() => {
    if (!aset || !aset.riwayat_operasi) return { sessionsWithOrder: [], sessionsInternal: [] };

    const withOrder: any[] = [];
    const internal: any[] = [];

    // Map revenue data if available
    const revMap = new Map<string, number>();
    if (pendapatanRiil?.rincian_sesi) {
      for (const r of pendapatanRiil.rincian_sesi) {
        const key = `${r.nomor_order}_${r.waktu_selesai}`;
        revMap.set(key, r.pendapatan_sesi || 0);
      }
    }

    for (const s of aset.riwayat_operasi) {
      if (s.nomor_order) {
        const key = `${s.nomor_order}_${s.waktu_selesai}`;
        const allocated = revMap.get(key) || 0;
        withOrder.push({ ...s, pendapatan_alokasi: allocated });
      } else {
        internal.push(s);
      }
    }

    return { 
      sessionsWithOrder: withOrder.reverse(), 
      sessionsInternal: internal.reverse() 
    };
  }, [aset, pendapatanRiil]);

  if (!isOpen || !aset) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 overflow-y-auto p-2 sm:p-4 md:p-6 flex items-start sm:items-center justify-center">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl border border-slate-200 my-auto max-h-[92vh] flex flex-col text-slate-800 animate-in fade-in zoom-in-95">
        
        {/* Modal Header & Asset Identity Badge */}
        <div className="shrink-0 pb-3 border-b border-slate-200">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#005DAA] border border-blue-100 flex items-center justify-center font-bold shrink-0">
                <History className="w-5 h-5 text-[#005DAA]" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-[10px] font-bold bg-[#005DAA] text-white px-2 py-0.5 rounded uppercase tracking-wider">
                    Riwayat Lengkap Aset
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-500">
                    ID: {aset.id_aset}
                  </span>
                  <span className={`text-[10px] px-2 py-0.5 rounded font-bold ${
                    aset.status === 'Digunakan' ? 'bg-emerald-100 text-emerald-800' :
                    aset.status === 'Tersedia' ? 'bg-blue-100 text-blue-800' :
                    aset.status === 'Dalam Pemeliharaan' ? 'bg-amber-100 text-amber-800' :
                    aset.status === 'Dipinjamkan' ? 'bg-purple-100 text-purple-800' :
                    'bg-slate-100 text-slate-800'
                  }`}>
                    {aset.status} ({aset.kondisi})
                  </span>
                </div>
                <h2 className="text-lg font-extrabold text-slate-900 mt-0.5">
                  {aset.nama}
                </h2>
              </div>
            </div>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Asset Key Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 bg-slate-50 p-2.5 rounded-xl border border-slate-200/90 text-xs mt-3">
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Kategori / Model</span>
              <div className="font-bold text-slate-800 truncate">{aset.kategori}</div>
              <div className="text-[10px] text-slate-500 truncate">{aset.merk_model || '-'} (SN: {aset.nomor_seri || '-'})</div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Bidang / Lokasi</span>
              <div className="font-bold text-slate-800 truncate">{aset.nama_bidang_sekarang}</div>
              <div className="text-[10px] text-slate-500 truncate">{aset.lokasi_sekarang || '-'}</div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">PIC Penanggung Jawab</span>
              <div className="font-bold text-slate-800 truncate">{aset.nama_pic_sekarang}</div>
              <div className="text-[10px] text-slate-500 truncate">Pemegang: {aset.nama_pemegang_terakhir || aset.nama_pic_sekarang}</div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Nilai Perolehan</span>
              <div className="font-mono font-bold text-emerald-700 truncate">
                {aset.nilai_perolehan ? `Rp ${Math.round(aset.nilai_perolehan).toLocaleString('id-ID')}` : '-'}
              </div>
              <div className="text-[10px] text-slate-500 truncate">Tahun: {aset.tahun_perolehan}</div>
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold block">Basis Operasional</span>
              <div className="font-bold text-slate-800 truncate">
                {aset.basis_operasi === 'CONTINUOUS_24_7' ? '24/7 Continuous' : 'Working Day (WD)'}
              </div>
              <div className="text-[10px] text-emerald-700 font-semibold truncate">Cut-off H-1 Aktif</div>
            </div>
          </div>

          {/* Segmented Tab Navigation Bar */}
          <div className="flex items-center justify-between gap-2 overflow-x-auto pt-3">
            <div className="inline-flex p-1 bg-slate-100 rounded-xl space-x-1 shrink-0">
              <button
                type="button"
                onClick={() => setActiveTab('operasi')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'operasi'
                    ? 'bg-white text-[#005DAA] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Receipt className="w-3.5 h-3.5" />
                <span>Sesi Operasi &amp; Order</span>
                <span className="text-[10px] font-mono bg-blue-100 text-[#005DAA] px-1.5 py-0.2 rounded-full">
                  {sessionsWithOrder.length + sessionsInternal.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('metrik')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'metrik'
                    ? 'bg-white text-[#005DAA] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Gauge className="w-3.5 h-3.5" />
                <span>Metrik &amp; Proyeksi</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('assignment')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'assignment'
                    ? 'bg-white text-[#005DAA] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>Serah Terima</span>
                <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">
                  {activeAssignments.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('kalibrasi')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'kalibrasi'
                    ? 'bg-white text-[#005DAA] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" />
                <span>Kalibrasi</span>
                <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">
                  {activeKalibrasi.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('pengajuan')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'pengajuan'
                    ? 'bg-white text-[#005DAA] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Pengajuan</span>
                <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">
                  {activePengajuan.length}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('audit')}
                className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center space-x-1.5 ${
                  activeTab === 'audit'
                    ? 'bg-white text-[#005DAA] shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Audit Trail</span>
                <span className="text-[10px] font-mono bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">
                  {assetAuditLogs.length}
                </span>
              </button>
            </div>

            {/* Quick search filter in modal */}
            <div className="relative min-w-[150px] shrink-0">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Cari dalam tab..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs focus:ring-2 focus:ring-[#005DAA] outline-hidden"
              />
            </div>
          </div>
        </div>

        {/* Scrollable Tab Content Body */}
        <div className="flex-1 min-h-0 overflow-y-auto py-4 space-y-4 pr-1">
          
          {/* ============================================================== */}
          {/* TAB 1: SESI OPERASI & ORDER (Revenues, Hours, Photo Proof, GPS) */}
          {/* ============================================================== */}
          {activeTab === 'operasi' && (
            <div className="space-y-4">
              
              {/* Evidence Banner: Last Physical Return Photo */}
              {Boolean(aset.foto_pengembalian_terakhir || aset.lokasi_pengembalian_terakhir || aset.koordinat_gps_terakhir) && (
                <div className="bg-emerald-50/80 border border-emerald-300 rounded-xl p-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-start space-x-3">
                    {aset.foto_pengembalian_terakhir ? (
                      <img
                        src={aset.foto_pengembalian_terakhir}
                        alt="Bukti Pengembalian Terakhir"
                        onClick={() => setPreviewImage(aset.foto_pengembalian_terakhir!)}
                        className="w-14 h-14 rounded-lg object-cover border border-emerald-300 shadow-2xs cursor-pointer hover:opacity-90 shrink-0"
                        title="Klik untuk memperbesar foto bukti"
                      />
                    ) : (
                      <div className="w-12 h-12 bg-emerald-100 rounded-lg flex items-center justify-center text-emerald-700 shrink-0 border border-emerald-200">
                        <Camera className="w-5 h-5" />
                      </div>
                    )}
                    <div>
                      <div className="flex items-center space-x-1.5">
                        <span className="font-bold text-emerald-950">Bukti Fisik Pengembalian Terakhir</span>
                        <span className="text-[10px] bg-emerald-200 text-emerald-900 font-bold px-1.5 py-0.2 rounded">Tersedia</span>
                      </div>
                      <p className="text-[11px] text-emerald-800 mt-0.5">
                        Lokasi Fisik: <strong>{aset.lokasi_pengembalian_terakhir || aset.lokasi_sekarang || 'Tercatat di sistem'}</strong>
                      </p>
                      {aset.koordinat_gps_terakhir && (
                        <a
                          href={`https://www.google.com/maps?q=${aset.koordinat_gps_terakhir.lat},${aset.koordinat_gps_terakhir.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center space-x-1 text-[11px] font-bold text-[#005DAA] hover:underline mt-0.5"
                        >
                          <MapPin className="w-3.5 h-3.5 text-rose-500" />
                          <span>Titik GPS: {aset.koordinat_gps_terakhir.lat.toFixed(5)}, {aset.koordinat_gps_terakhir.lng.toFixed(5)} (Buka di Google Maps)</span>
                        </a>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Sesi Ber-Order Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <Receipt className="w-4 h-4 text-[#005DAA]" />
                    <h3 className="font-extrabold text-slate-800 text-xs">
                      Sesi Operasi Terkait Nomor Order (Cut-off H-1)
                    </h3>
                  </div>
                  {canViewFinancials && (
                    <span className="text-[11px] font-mono font-bold text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full">
                      Total Pendapatan: Rp {Math.round(pendapatanRiil?.total_pendapatan || 0).toLocaleString('id-ID')}
                    </span>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Nomor Order</th>
                        <th className="py-2.5 px-3">Waktu Mulai &amp; Selesai</th>
                        <th className="py-2.5 px-3 text-right">Durasi</th>
                        {canViewFinancials && (
                          <th className="py-2.5 px-3 text-right">Pendapatan Sesi</th>
                        )}
                        <th className="py-2.5 px-3">PIC Pengguna</th>
                        <th className="py-2.5 px-3">Lokasi &amp; Bukti Foto</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {sessionsWithOrder.length === 0 ? (
                        <tr>
                          <td colSpan={canViewFinancials ? 6 : 5} className="py-6 text-center text-slate-400 italic">
                            Belum ada sesi pemakaian dengan nomor order pada cut-off H-1.
                          </td>
                        </tr>
                      ) : (
                        sessionsWithOrder.map((s, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80">
                            <td className="py-2.5 px-3">
                              <span className="font-mono font-bold text-[#005DAA] bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-xs inline-block">
                                {s.nomor_order}
                              </span>
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="font-mono text-slate-700 text-[11px]">
                                {s.waktu_mulai ? new Date(s.waktu_mulai).toLocaleString('id-ID') : '-'}
                              </div>
                              <div className="font-mono text-slate-400 text-[10px]">
                                s/d {s.waktu_selesai ? new Date(s.waktu_selesai).toLocaleString('id-ID') : 'Sedang berjalan'}
                              </div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                              {Number(s.durasi_jam || 0).toFixed(1)} jam
                            </td>
                            {canViewFinancials && (
                              <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-700">
                                Rp {Math.round(s.pendapatan_alokasi || 0).toLocaleString('id-ID')}
                              </td>
                            )}
                            <td className="py-2.5 px-3 text-slate-700 font-medium">
                              {s.pic_pengguna || 'Petugas Lapangan'}
                            </td>
                            <td className="py-2.5 px-3">
                              <div className="flex items-center space-x-2">
                                {s.foto_pengembalian && (
                                  <img
                                    src={s.foto_pengembalian}
                                    alt="Foto Bukti"
                                    onClick={() => setPreviewImage(s.foto_pengembalian)}
                                    className="w-8 h-8 rounded object-cover border border-slate-300 shadow-2xs cursor-pointer hover:opacity-80 shrink-0"
                                    title="Klik untuk melihat foto"
                                  />
                                )}
                                <div className="text-[10px] text-slate-500 truncate max-w-[120px]">
                                  {s.lokasi_pengembalian || '-'}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Sesi Pemakaian Internal (Non-Revenue) Table */}
              <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
                <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-slate-400"></div>
                    <h3 className="font-extrabold text-slate-700 text-xs">
                      Sesi Non-Revenue (Pemakaian Internal &amp; Operasional)
                    </h3>
                  </div>
                  <span className="text-[10px] text-slate-500 font-medium">
                    Jam operasi tetap diperhitungkan dalam Utilisasi Waktu (UT)
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-100/60 text-slate-500 font-bold uppercase tracking-wider text-[9px] border-b border-slate-200">
                      <tr>
                        <th className="py-2 px-3">Tipe Pemakaian</th>
                        <th className="py-2 px-3">Waktu Mulai &amp; Selesai</th>
                        <th className="py-2 px-3 text-right">Durasi Jam</th>
                        <th className="py-2 px-3">PIC Pengguna</th>
                        <th className="py-2 px-3">Catatan / Keterangan</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-[11px]">
                      {sessionsInternal.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="py-4 text-center text-slate-400 italic">
                            Tidak ada sesi pemakaian internal yang terekam.
                          </td>
                        </tr>
                      ) : (
                        sessionsInternal.map((isess, iidx) => (
                          <tr key={iidx} className="hover:bg-slate-50/60">
                            <td className="py-2 px-3 text-slate-600 font-medium">
                              Internal / Uji Operasi
                            </td>
                            <td className="py-2 px-3 font-mono text-slate-600">
                              {isess.waktu_selesai ? new Date(isess.waktu_selesai).toLocaleString('id-ID') : '-'}
                            </td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-800">
                              {Number(isess.durasi_jam || 0).toFixed(1)} j
                            </td>
                            <td className="py-2 px-3 text-slate-700">
                              {isess.pic_pengguna || 'Petugas'}
                            </td>
                            <td className="py-2 px-3 text-slate-500">
                              {isess.catatan || '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 2: METRIK & PROYEKSI (UT, RA, YR, Proyeksi Akhir, Tren) */}
          {/* ============================================================== */}
          {activeTab === 'metrik' && (
            <div className="space-y-4">
              
              {/* Periode Evaluasi Filter */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center space-x-2">
                  <BarChart3 className="w-4 h-4 text-[#005DAA]" />
                  <span className="font-bold text-xs text-slate-800">
                    Periode Evaluasi Kinerja:
                  </span>
                  <span className="text-[10px] bg-emerald-100 text-[#008C45] font-bold px-2 py-0.5 rounded">
                    Cut-off H-1
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <div className="inline-flex p-1 bg-white border border-slate-200 rounded-lg space-x-1">
                    <button
                      type="button"
                      onClick={() => setSelectedPeriode('bulan_ini')}
                      className={`px-3 py-1 text-xs font-bold rounded cursor-pointer ${
                        selectedPeriode === 'bulan_ini' ? 'bg-[#005DAA] text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Bulan Ini
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedPeriode('ytd')}
                      className={`px-3 py-1 text-xs font-bold rounded cursor-pointer ${
                        selectedPeriode === 'ytd' ? 'bg-[#005DAA] text-white' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      YTD
                    </button>
                  </div>

                  <div className="flex items-center space-x-1 bg-white border border-slate-200 rounded-lg px-2 py-1">
                    <span className="text-[10px] font-bold text-slate-500">Tahun:</span>
                    <select
                      value={selectedTahun}
                      onChange={(e) => {
                        setSelectedTahun(Number(e.target.value));
                        setSelectedPeriode('tahunan');
                      }}
                      className="text-xs font-bold text-[#005DAA] bg-transparent outline-hidden cursor-pointer"
                    >
                      {[2026, 2025, 2024].map(y => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* 4 Cards Metrik Utama */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {/* 1. UT */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-blue-600" />
                      <span>UT (Waktu)</span>
                      <MetricTooltip type="UT" position="bottom" />
                    </span>
                    <span className={`text-[10px] px-2 py-0.2 rounded font-bold border ${
                      metrikUtilisasi?.ut_klasifikasi === 'Optimal' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                      metrikUtilisasi?.ut_klasifikasi === 'Moderat' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                      'bg-rose-100 text-rose-800 border-rose-300'
                    }`}>
                      {metrikUtilisasi?.ut_klasifikasi || 'Rendah'}
                    </span>
                  </div>
                  <div className="text-2xl font-black font-mono text-slate-900">
                    {metrikUtilisasi?.ut_persen !== undefined ? `${metrikUtilisasi.ut_persen}%` : '-'}
                  </div>
                  <div className="text-[10px] text-slate-500 flex items-center justify-between">
                    <span>Pakai: <strong>{metrikUtilisasi?.jam_pakai_total || 0}j</strong></span>
                    <span>Netto A: <strong>{metrikUtilisasi?.jam_tersedia_netto ?? metrikUtilisasi?.kapasitas_netto_a ?? 0}j</strong></span>
                  </div>
                </div>

                {/* 2. RA */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center space-x-1">
                      <TrendingUp className="w-3.5 h-3.5 text-emerald-600" />
                      <span>RA (Pendapatan)</span>
                      <MetricTooltip type="RA" position="bottom" />
                    </span>
                    {canViewFinancials && metrikUtilisasi?.ra_klasifikasi && (
                      <span className={`text-[10px] px-2 py-0.2 rounded font-bold border ${
                        metrikUtilisasi.ra_klasifikasi === 'Optimal' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                        metrikUtilisasi.ra_klasifikasi === 'Moderat' ? 'bg-amber-100 text-amber-800 border-amber-300' :
                        'bg-rose-100 text-rose-800 border-rose-300'
                      }`}>
                        {metrikUtilisasi.ra_klasifikasi}
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-800">
                    {canViewFinancials ? (metrikUtilisasi?.ra_persen !== null && metrikUtilisasi?.ra_persen !== undefined ? `${metrikUtilisasi.ra_persen}%` : '-') : '••••'}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {canViewFinancials ? (
                      <>R: <strong>Rp {Math.round(metrikUtilisasi?.pendapatan_riil ?? metrikUtilisasi?.pendapatan_riil_r ?? 0).toLocaleString('id-ID')}</strong></>
                    ) : 'Akses Terbatas'}
                  </div>
                </div>

                {/* 3. YR */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center space-x-1">
                      <Coins className="w-3.5 h-3.5 text-amber-600" />
                      <span>YR (Yield Modal)</span>
                      <MetricTooltip type="YR" position="bottom" />
                    </span>
                  </div>
                  <div className="text-xl font-black font-mono text-amber-900 truncate">
                    {canViewFinancials ? (
                      metrikUtilisasi?.yr_label || metrikUtilisasi?.catatan_yr || (metrikUtilisasi?.yr_persen !== null && metrikUtilisasi?.yr_persen !== undefined ? `${metrikUtilisasi.yr_persen}%/thn` : '-')
                    ) : '••••'}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    {canViewFinancials ? 'Teranualisasi terhadap nilai perolehan' : '-'}
                  </div>
                </div>

                {/* 4. Skor Terpadu */}
                <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-2xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-500 uppercase flex items-center space-x-1">
                      <Gauge className="w-3.5 h-3.5 text-purple-600" />
                      <span>Skor Terpadu</span>
                      <MetricTooltip type="SKOR" position="bottom" />
                    </span>
                    {(metrikUtilisasi?.kuadran || metrikUtilisasi?.kuadran_2x2?.nama) && canViewFinancials && (
                      <span className="text-[9px] font-bold bg-purple-100 text-purple-800 px-1.5 py-0.2 rounded">
                        {metrikUtilisasi?.kuadran || metrikUtilisasi?.kuadran_2x2?.nama}
                      </span>
                    )}
                  </div>
                  <div className="text-2xl font-black font-mono text-purple-900">
                    {canViewFinancials ? (metrikUtilisasi?.skor_terpadu !== null && metrikUtilisasi?.skor_terpadu !== undefined ? `${metrikUtilisasi.skor_terpadu}%` : '-') : '••••'}
                  </div>
                  <div className="text-[10px] text-slate-500 truncate">
                    50% UT + 50% min(RA, 120%)
                  </div>
                </div>
              </div>

              {/* Proyeksi Akhir Tahun & Kapasitas Alat Strip */}
              {canViewFinancials && (
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-3">
                  <div className="flex items-center space-x-2 border-b border-slate-200 pb-2">
                    <Sparkles className="w-4 h-4 text-[#005DAA]" />
                    <h4 className="font-extrabold text-slate-900 text-xs">
                      Proyeksi Akhir Tahun &amp; Analisis Kapasitas Alat (Rolling 3 Bulan)
                    </h4>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Tarif Efektif</span>
                        <MetricTooltip type="TARIF" position="bottom" />
                      </div>
                      <div className="text-base font-extrabold font-mono text-[#005DAA] mt-0.5">
                        Rp {Math.round(metrikUtilisasi?.tarif_efektif_per_jam ?? metrikUtilisasi?.proyeksi_akhir_tahun?.tarif_efektif ?? 0).toLocaleString('id-ID')} / jam
                      </div>
                      <span className="text-[9px] text-slate-400 block mt-0.5">&Sigma;R / &Sigma;jam pakai order</span>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Proyeksi Akhir Tahun</span>
                        <MetricTooltip type="PROYEKSI" position="bottom" />
                      </div>
                      <div className="text-base font-extrabold font-mono text-emerald-800 mt-0.5">
                        {typeof metrikUtilisasi?.proyeksi_akhir_tahun === 'number'
                          ? `Rp ${Math.round(metrikUtilisasi.proyeksi_akhir_tahun).toLocaleString('id-ID')}`
                          : (metrikUtilisasi?.proyeksi_akhir_tahun?.proyeksi_akhir_tahun_rp !== null && metrikUtilisasi?.proyeksi_akhir_tahun?.proyeksi_akhir_tahun_rp !== undefined
                            ? `Rp ${Math.round(metrikUtilisasi.proyeksi_akhir_tahun.proyeksi_akhir_tahun_rp).toLocaleString('id-ID')}`
                            : (metrikUtilisasi?.proyeksi_akhir_tahun?.catatan || '-'))}
                      </div>
                      <span className="text-[9px] text-slate-400 block mt-0.5">R YTD + (Jam Sisa &times; UT 3M &times; Tarif)</span>
                    </div>

                    <div className="bg-white p-3 rounded-lg border border-slate-200">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-slate-500 uppercase block">Jam Minimum Target</span>
                        <MetricTooltip type="JAM_MINIMUM" position="bottom" />
                      </div>
                      <div className="text-base font-extrabold font-mono text-purple-900 mt-0.5">
                        {metrikUtilisasi?.jam_minimum_target !== null && metrikUtilisasi?.jam_minimum_target !== undefined
                          ? `${metrikUtilisasi.jam_minimum_target} jam`
                          : (metrikUtilisasi?.proyeksi_akhir_tahun?.jam_minimum_target !== null && metrikUtilisasi?.proyeksi_akhir_tahun?.jam_minimum_target !== undefined
                            ? `${metrikUtilisasi.proyeksi_akhir_tahun.jam_minimum_target} jam`
                            : '-')}
                      </div>
                      <span className="text-[9px] text-slate-400 block mt-0.5">Target Proyeksi / Tarif Efektif</span>
                    </div>
                  </div>

                  {(metrikUtilisasi?.peringatan_kapasitas || metrikUtilisasi?.proyeksi_akhir_tahun?.peringatan_kapasitas) && (
                    <div className="bg-rose-50 border border-rose-300 rounded-lg p-3 flex items-start space-x-2 text-rose-900 text-xs">
                      <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong className="font-bold">Target tidak realistis terhadap kapasitas jam alat!</strong>
                        <p className="text-[11px] text-rose-800 mt-0.5">
                          {metrikUtilisasi?.peringatan_kapasitas || metrikUtilisasi?.proyeksi_akhir_tahun?.peringatan_kapasitas}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Tren Bulanan Sepanjang Tahun (12 Bulan) */}
              <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-2">
                  <h4 className="font-extrabold text-slate-900 text-xs flex items-center space-x-1.5">
                    <BarChart3 className="w-4 h-4 text-[#005DAA]" />
                    <span>Tren Bulanan Sepanjang Tahun {selectedTahun}</span>
                  </h4>
                  <div className="flex items-center space-x-3 text-[10px] text-slate-500">
                    <span className="flex items-center space-x-1">
                      <span className="w-2.5 h-2.5 rounded bg-emerald-500 inline-block"></span>
                      <span>Pendapatan Riil</span>
                    </span>
                    <span className="flex items-center space-x-1">
                      <span className="w-2.5 h-2.5 rounded bg-blue-300 inline-block"></span>
                      <span>Proyeksi Bulanan</span>
                    </span>
                  </div>
                </div>

                {monthlyBreakdown.length === 0 ? (
                  <div className="py-6 text-center text-slate-400 text-xs italic">
                    Data tren bulanan sedang dimuat...
                  </div>
                ) : (
                  <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-12 gap-2 pt-2">
                    {monthlyBreakdown.map((m, idx) => {
                      const maxVal = Math.max(1, ...monthlyBreakdown.map(b => Math.max(b.pendapatan || 0, b.proyeksi_bulanan || 0)));
                      const revHeight = maxVal > 0 ? Math.min(100, Math.round(((m.pendapatan || 0) / maxVal) * 100)) : 0;
                      const projHeight = maxVal > 0 ? Math.min(100, Math.round(((m.proyeksi_bulanan || 0) / maxVal) * 100)) : 0;

                      return (
                        <div key={idx} className="flex flex-col items-center space-y-1 p-1 rounded-lg hover:bg-slate-50">
                          <span className="text-[9px] font-mono font-bold text-slate-700">
                            {m.ut_persen}%
                          </span>
                          <div className="h-20 w-full bg-slate-100 rounded flex items-end justify-center space-x-1 p-1">
                            <div
                              className="w-2 bg-blue-300 rounded-t"
                              style={{ height: `${Math.max(4, projHeight)}%` }}
                              title={`Proyeksi: Rp ${Math.round(m.proyeksi_bulanan || 0).toLocaleString('id-ID')}`}
                            />
                            <div
                              className="w-2 bg-emerald-500 rounded-t"
                              style={{ height: `${Math.max(4, revHeight)}%` }}
                              title={`Pendapatan: Rp ${Math.round(m.pendapatan || 0).toLocaleString('id-ID')}`}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-slate-700">{m.bulan_nama}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Tabel Proyeksi Pendapatan per Tahun */}
              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-2xs">
                <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                  <h4 className="font-extrabold text-slate-800 text-xs flex items-center space-x-1.5">
                    <Coins className="w-4 h-4 text-emerald-600" />
                    <span>Daftar Proyeksi Pendapatan per Tahun (Tahap 1 B)</span>
                  </h4>
                  {proyeksiList.length > 0 && (
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full font-mono">
                      Total: Rp {proyeksiList.reduce((acc, curr) => acc + (curr.nilai || 0), 0).toLocaleString('id-ID')}
                    </span>
                  )}
                </div>

                <div className="p-3">
                  {proyeksiList.length === 0 ? (
                    <div className="py-4 text-center text-slate-400 text-xs italic bg-slate-50/50 rounded-lg border border-dashed border-slate-200">
                      Belum ada data proyeksi pendapatan yang dicatat untuk alat ini.
                    </div>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-slate-200 text-slate-500 font-bold uppercase text-[10px]">
                            <th className="py-2 px-3">Tahun</th>
                            <th className="py-2 px-3 text-right">Proyeksi Pendapatan</th>
                            <th className="py-2 px-3">Diinput Oleh</th>
                            <th className="py-2 px-3">Tanggal Input</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 font-medium">
                          {proyeksiList.map((p, idx) => (
                            <tr key={idx} className="hover:bg-slate-50">
                              <td className="py-2 px-3 font-mono font-bold text-slate-900">{p.tahun}</td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-emerald-700">
                                Rp {Math.round(p.nilai).toLocaleString('id-ID')}
                              </td>
                              <td className="py-2 px-3 text-slate-700">{p.diinput_oleh}</td>
                              <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                                {p.diinput_pada ? new Date(p.diinput_pada).toLocaleDateString('id-ID') : '-'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 3: SERAH TERIMA (ASSIGNMENT) */}
          {/* ============================================================== */}
          {activeTab === 'assignment' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-extrabold text-slate-800 text-xs flex items-center space-x-1.5">
                  <ArrowRightLeft className="w-4 h-4 text-emerald-600" />
                  <span>Riwayat Serah Terima &amp; Penugasan Unit / Bidang</span>
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">
                  {activeAssignments.length} Catatan
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Tanggal Serah</th>
                      <th className="py-2.5 px-3">Bidang Penempatan</th>
                      <th className="py-2.5 px-3">PIC Bidang &amp; Pemegang</th>
                      <th className="py-2.5 px-3">Keterangan / Alasan</th>
                      <th className="py-2.5 px-3">Diserahkan Oleh</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeAssignments.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-6 text-center text-slate-400 italic">
                          Belum ada riwayat serah terima yang tercatat untuk alat ini.
                        </td>
                      </tr>
                    ) : (
                      activeAssignments.map((a, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {a.tanggal_serah ? new Date(a.tanggal_serah).toLocaleString('id-ID') : '-'}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {a.nama_bidang}
                          </td>
                          <td className="py-2.5 px-3">
                            <div className="font-bold text-slate-800">{a.nama_pic}</div>
                            {a.pemegang_lapangan && a.pemegang_lapangan !== a.nama_pic && (
                              <div className="text-[10px] text-slate-500">Lap: {a.pemegang_lapangan}</div>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-600">
                            {a.keterangan || 'Penetapan Unit/Bidang Baru'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                            {a.diserah_oleh || 'Fungsi UMUM'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 4: RIWAYAT KALIBRASI */}
          {/* ============================================================== */}
          {activeTab === 'kalibrasi' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-extrabold text-slate-800 text-xs flex items-center space-x-1.5">
                  <Calendar className="w-4 h-4 text-purple-600" />
                  <span>Riwayat Sertifikat &amp; Kalibrasi Berkala</span>
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">
                  {activeKalibrasi.length} Catatan
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Tanggal Kalibrasi</th>
                      <th className="py-2.5 px-3">Lembaga Pelaksana</th>
                      <th className="py-2.5 px-3">No. Sertifikat</th>
                      <th className="py-2.5 px-3">Jatuh Tempo</th>
                      <th className="py-2.5 px-3">Kondisi Alat</th>
                      <th className="py-2.5 px-3">Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activeKalibrasi.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                          Belum ada riwayat kalibrasi yang terekam untuk alat ini.
                        </td>
                      </tr>
                    ) : (
                      activeKalibrasi.map((k, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono text-slate-700">
                            {new Date(k.tanggal).toLocaleDateString('id-ID')}
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-slate-800">
                            {k.lembaga_kalibrasi}
                          </td>
                          <td className="py-2.5 px-3 font-mono font-bold text-[#005DAA]">
                            {k.nomor_sertifikat}
                          </td>
                          <td className="py-2.5 px-3 font-mono text-slate-700">
                            {k.jatuh_tempo_berikutnya}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className="px-2 py-0.5 rounded font-bold text-[10px] bg-emerald-100 text-emerald-800">
                              {k.kondisi_setelah || 'Baik'}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                            {k.catatan || '-'}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 5: PENGAJUAN STATUS (Transfer, Disposal, Pemakaian) */}
          {/* ============================================================== */}
          {activeTab === 'pengajuan' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-extrabold text-slate-800 text-xs flex items-center space-x-1.5">
                  <FileText className="w-4 h-4 text-amber-600" />
                  <span>Daftar Pengajuan Transfer / Disposal / Pemakaian</span>
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">
                  {activePengajuan.length} Pengajuan
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Tgl Pengajuan</th>
                      <th className="py-2.5 px-3">Jenis</th>
                      <th className="py-2.5 px-3">Asal &rarr; Tujuan</th>
                      <th className="py-2.5 px-3">Pemohon</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">Approver &amp; Catatan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {activePengajuan.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-6 text-center text-slate-400 italic">
                          Belum ada catatan pengajuan untuk alat ini.
                        </td>
                      </tr>
                    ) : (
                      activePengajuan.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {new Date(p.created_at).toLocaleDateString('id-ID')}
                          </td>
                          <td className="py-2.5 px-3 font-bold text-slate-800">
                            {p.jenis}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            <span>{p.nama_bidang_asal}</span>
                            {p.nama_bidang_tujuan && (
                              <span className="text-slate-400 font-mono"> &rarr; {p.nama_bidang_tujuan}</span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 text-slate-700">
                            {p.pemohon_nama}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded font-bold text-[10px] border ${
                              p.status_approval === 'Approved' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                              p.status_approval === 'Rejected' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                              'bg-amber-100 text-amber-800 border-amber-300'
                            }`}>
                              {p.status_approval}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-[11px] text-slate-600">
                            {p.approver_nama ? (
                              <div>
                                <span className="font-bold text-slate-800">{p.approver_nama}</span>
                                {p.catatan_approval && (
                                  <div className="text-slate-400 italic">"{p.catatan_approval}"</div>
                                )}
                              </div>
                            ) : (
                              <span className="text-slate-400">Menunggu review</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* TAB 6: AUDIT TRAIL LOG */}
          {/* ============================================================== */}
          {activeTab === 'audit' && (
            <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
              <div className="bg-slate-50 px-3.5 py-2.5 border-b border-slate-200 flex items-center justify-between">
                <h3 className="font-extrabold text-slate-800 text-xs flex items-center space-x-1.5">
                  <ShieldCheck className="w-4 h-4 text-[#005DAA]" />
                  <span>Log Aktivitas &amp; Jejak Audit Sistem</span>
                </h3>
                <span className="text-[10px] text-slate-500 font-mono">
                  {assetAuditLogs.length} Catatan
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/80 text-slate-600 font-bold uppercase tracking-wider text-[10px] border-b border-slate-200">
                    <tr>
                      <th className="py-2.5 px-3">Waktu Log</th>
                      <th className="py-2.5 px-3">Jenis Perubahan</th>
                      <th className="py-2.5 px-3">Rincian Modifikasi</th>
                      <th className="py-2.5 px-3">Aktor / Role</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {assetAuditLogs.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400 italic">
                          Tidak ada catatan log audit khusus untuk alat ini.
                        </td>
                      </tr>
                    ) : (
                      assetAuditLogs.map((log, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px] whitespace-nowrap">
                            {new Date(log.waktu).toLocaleString('id-ID')}
                          </td>
                          <td className="py-2.5 px-3">
                            <span className={`px-2 py-0.5 rounded font-bold text-[10px] border inline-block ${
                              log.jenis_perubahan.includes('Approve') ? 'bg-emerald-100 text-emerald-800 border-emerald-200' :
                              log.jenis_perubahan.includes('Reject') ? 'bg-rose-100 text-rose-800 border-rose-200' :
                              log.jenis_perubahan.includes('Create') ? 'bg-blue-100 text-blue-800 border-blue-200' :
                              'bg-slate-100 text-slate-800 border-slate-200'
                            }`}>
                              {log.jenis_perubahan}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-slate-800 font-medium leading-relaxed">
                            {log.detail}
                          </td>
                          <td className="py-2.5 px-3 whitespace-nowrap">
                            <div className="font-bold text-slate-800">{log.aktor}</div>
                            {log.role_aktor && (
                              <span className="text-[9px] font-mono uppercase bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded">
                                {log.role_aktor}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

        </div>

        {/* Modal Footer */}
        <div className="shrink-0 pt-3 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center space-x-1">
            <Sparkles className="w-4 h-4 text-[#008C45]" />
            <span>Data riwayat tersimpan permanen tanpa opsi edit/hapus.</span>
          </div>
          <button
            onClick={onClose}
            className="bg-slate-800 hover:bg-slate-900 text-white font-bold px-4 py-2 rounded-xl transition-colors cursor-pointer shadow-xs"
          >
            Tutup
          </button>
        </div>

      </div>

      {/* Lightbox Preview Modal for Evidence Photos */}
      {previewImage && (
        <div 
          className="fixed inset-0 bg-black/80 z-60 flex items-center justify-center p-4 backdrop-blur-xs animate-in fade-in"
          onClick={() => setPreviewImage(null)}
        >
          <div 
            className="relative max-w-xl w-full bg-white rounded-2xl p-4 shadow-2xl space-y-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-2 border-b border-slate-200 text-xs font-bold text-slate-900">
              <div className="flex items-center space-x-2">
                <Camera className="w-4 h-4 text-[#005DAA]" />
                <span>Bukti Foto Fisik Pengembalian Aset</span>
              </div>
              <button 
                onClick={() => setPreviewImage(null)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="max-h-[70vh] overflow-hidden rounded-xl border border-slate-200 bg-slate-900 flex items-center justify-center">
              <img 
                src={previewImage} 
                alt="Bukti Foto Barang" 
                className="max-h-[70vh] w-auto max-w-full object-contain" 
              />
            </div>
            <p className="text-center text-[11px] text-slate-500">
              Foto bukti fisik tersimpan otomatis dari kamera mobile saat aset dikembalikan ke status Tersedia.
            </p>
          </div>
        </div>
      )}

    </div>
  );
};
