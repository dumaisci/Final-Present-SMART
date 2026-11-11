import React, { useState, useEffect } from 'react';
import { Aset, KondisiAset, StatusAset, Bidang, Pengajuan, getAllowedKondisiForStatus, ALL_STATUSES } from '../types';
import { apiClient } from '../lib/apiClient';
import { addPengajuanFirestore, addAuditLogFirestore } from '../lib/firestoreService';
import { CameraScanner } from './CameraScanner';
import { ReturnAssetEvidenceSection } from './ReturnAssetEvidenceSection';
import { 
  QrCode, 
  Search, 
  Camera, 
  CheckCircle2, 
  AlertCircle, 
  X, 
  MapPin, 
  Wrench, 
  FileText, 
  Building2, 
  Calendar, 
  ShieldCheck, 
  Send, 
  UserCheck, 
  Tag, 
  FlaskConical, 
  Award, 
  ArrowRightLeft, 
  User, 
  Clock, 
  Briefcase,
  Sparkles,
  ReceiptText,
  RotateCw
} from 'lucide-react';

interface PublicScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialAsets?: Aset[];
}

export const PublicScannerModal: React.FC<PublicScannerModalProps> = ({
  isOpen,
  onClose,
  initialAsets
}) => {
  if (!isOpen) return null;

  const [asets, setAsets] = useState<Aset[]>(initialAsets || []);
  const [bidangs, setBidangs] = useState<Bidang[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [scannedQr, setScannedQr] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedAsset, setSelectedAsset] = useState<Aset | null>(null);

  // Action Mode Selection: 'pemakaian' | 'pemutakhiran'
  const [actionMode, setActionMode] = useState<'pemakaian' | 'pemutakhiran'>('pemakaian');

  // Identitas Staff Lapangan
  const [namaStaff, setNamaStaff] = useState('');
  const [unitStaff, setUnitStaff] = useState('');

  // Form Fields
  const [kondisi, setKondisi] = useState<KondisiAset>('Baik');
  const [lokasi, setLokasi] = useState('');
  const [status, setStatus] = useState<StatusAset>('Digunakan');
  const [tglRencanaPengembalian, setTglRencanaPengembalian] = useState('');
  const [pemegang, setPemegang] = useState('');
  const [catatan, setCatatan] = useState('');

  // TAHAP 2: State Nomor Order untuk Check-Out & Tracking Pendapatan
  const [nomorOrderInput, setNomorOrderInput] = useState('');
  const [orderLookupResult, setOrderLookupResult] = useState<any | null>(null);
  const [orderLookupError, setOrderLookupError] = useState('');
  const [isLookingUpOrder, setIsLookingUpOrder] = useState(false);

  // Bukti Selesai Pakai (Digunakan -> Tersedia)
  const [fotoPengembalian, setFotoPengembalian] = useState<string>('');
  const [lokasiGps, setLokasiGps] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Debounced Order Lookup Effect
  useEffect(() => {
    const clean = nomorOrderInput.trim().toUpperCase();
    if (!clean) {
      setOrderLookupResult(null);
      setOrderLookupError('');
      setIsLookingUpOrder(false);
      return;
    }

    setIsLookingUpOrder(true);
    setOrderLookupError('');
    const timer = setTimeout(async () => {
      try {
        const found = await apiClient.getOrder(clean);
        if (found && found.nomor_order) {
          setOrderLookupResult(found);
          setOrderLookupError('');
        } else {
          setOrderLookupResult(null);
          setOrderLookupError(`Nomor order "${clean}" tidak ditemukan dalam sistem.`);
        }
      } catch (err: any) {
        setOrderLookupResult(null);
        setOrderLookupError(err.message || `Nomor order "${clean}" tidak ditemukan.`);
      } finally {
        setIsLookingUpOrder(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [nomorOrderInput]);

  // Fetch assets and bidang list if needed
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        if (!initialAsets || initialAsets.length === 0) {
          const dataAsets = await apiClient.getAsets();
          setAsets(dataAsets);
        }
        const dataBidang = await apiClient.getBidang();
        setBidangs(dataBidang);
      } catch (err) {
        console.error('Error fetching data for public scanner:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchData();
  }, [initialAsets]);

  // Auto-detect and lookup asset if opened via URL QR link
  useEffect(() => {
    if (!isOpen) return;
    try {
      const params = new URLSearchParams(window.location.search);
      const urlCode = params.get('code') || params.get('qr') || params.get('id') || params.get('asset_number') || params.get('tag_number');
      if (urlCode && !selectedAsset) {
        handleLookup(urlCode);
      }
    } catch (e) {}
  }, [isOpen]);

  const handleResetScan = () => {
    setSelectedAsset(null);
    setScannedQr('');
    setErrorMsg('');
    setSuccessMsg('');
    setCatatan('');
    setIsSubmitting(false);
  };

  const handleCloseModal = () => {
    handleResetScan();
    onClose();
  };

  const extractCleanCode = (input: string): string => {
    if (!input) return '';
    let str = input.trim();
    if (str.startsWith('http://') || str.startsWith('https://')) {
      try {
        const url = new URL(str);
        const queryParam = url.searchParams.get('code') || 
                           url.searchParams.get('id') || 
                           url.searchParams.get('qr') ||
                           url.searchParams.get('asset_number') ||
                           url.searchParams.get('tag_number');
        if (queryParam && queryParam.trim()) return queryParam.trim();
        const lastSeg = url.pathname.split('/').filter(Boolean).pop();
        if (lastSeg) return lastSeg.trim();
      } catch (e) {}
    }
    return str;
  };

  const handleLookup = async (code: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!code || !code.trim()) return;

    const targetCode = extractCleanCode(code);
    const targetLower = targetCode.toLowerCase();

    // 1. Check local state list first
    const found = asets.find(a => 
      (a.qr_code && a.qr_code.toLowerCase() === targetLower) ||
      (a.id_aset && a.id_aset.toLowerCase() === targetLower) ||
      (a.nomor_seri && a.nomor_seri.toLowerCase() === targetLower) ||
      (a.asset_number && a.asset_number.toLowerCase() === targetLower) ||
      (a.tag_number && a.tag_number.toLowerCase() === targetLower)
    );

    if (found) {
      handleSelectAsset(found);
      return;
    }

    // 2. Query server directly for any asset (e.g. from 222+ assets in MongoDB Atlas)
    setIsLoading(true);
    try {
      const serverAsset = await apiClient.getAsetDetail(targetCode);
      if (serverAsset && serverAsset.id_aset) {
        handleSelectAsset(serverAsset);
        return;
      }
    } catch (err) {
      // Not found on server
    } finally {
      setIsLoading(false);
    }

    setSelectedAsset(null);
    setErrorMsg(`Aset dengan Kode QR / ID / No. Seri "${targetCode}" tidak ditemukan dalam database.`);
  };

  const handleSelectAsset = (asset: Aset) => {
    setSelectedAsset(asset);
    setScannedQr(asset.qr_code);
    setKondisi(asset.kondisi);
    setLokasi(asset.lokasi_sekarang);
    setStatus(asset.status || 'Digunakan');
    setTglRencanaPengembalian(asset.tgl_rencana_pengembalian || '');
    setPemegang(namaStaff || asset.nama_pemegang_terakhir || asset.nama_pic_sekarang || '');
    setNomorOrderInput(asset.nomor_order_aktif || '');
    setOrderLookupResult(null);
    setOrderLookupError('');
    setFotoPengembalian('');
    setLokasiGps(null);
    setErrorMsg('');
    setSuccessMsg('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAsset) return;

    if (!namaStaff.trim()) {
      setErrorMsg('Masukkan Nama Staff / Inspector Lapangan Anda.');
      return;
    }

    if (status === 'Digunakan' && !tglRencanaPengembalian) {
      setErrorMsg('Tanggal Rencana Pengembalian wajib diisi.');
      return;
    }

    if (status === 'Digunakan' && nomorOrderInput.trim() && !orderLookupResult) {
      setErrorMsg('Nomor order belum terverifikasi atau tidak ditemukan. Kosongkan nomor order jika merupakan pemakaian internal (non-revenue), atau masukkan nomor order resmi yang terdaftar.');
      return;
    }

    // Strict Validation: Pembaruan ke status 'Tersedia' (selesai pakai / pengembalian) WAJIB melampirkan foto fisik & titik GPS
    const isTersedia = status === 'Tersedia';
    const isFinishingUsage = isTersedia || (selectedAsset.status === 'Digunakan' && status === 'Tersedia');
    if (isTersedia) {
      if (!fotoPengembalian) {
        setErrorMsg('PENGIRIMAN DITOLAK: Foto fisik barang wajib dilampirkan/difoto sebagai bukti kondisi aset saat berstatus Tersedia.');
        return;
      }
      if (!lokasiGps || typeof lokasiGps.lat !== 'number' || typeof lokasiGps.lng !== 'number') {
        setErrorMsg('PENGIRIMAN DITOLAK: Akses titik koordinat lokasi (GPS) wajib diambil dengan menekan tombol "Ambil Titik Lokasi (GPS) Sekarang".');
        return;
      }
    }

    setIsSubmitting(true);
    setErrorMsg('');
    setSuccessMsg('');

    try {
      const actorLabel = unitStaff.trim() ? `${namaStaff.trim()} (${unitStaff.trim()})` : namaStaff.trim();
      const targetHolder = namaStaff.trim();
      const jenisPengajuan = isTersedia ? 'Pengembalian Aset (Selesai Pakai)' : 'Pemutakhiran Lapangan';
      const cleanNomorOrder = status === 'Digunakan'
        ? (orderLookupResult?.nomor_order || (nomorOrderInput.trim() ? nomorOrderInput.trim().toUpperCase() : null))
        : (selectedAsset.nomor_order_aktif || null);

      const res = await fetch(`/api/asets/${selectedAsset.id_aset}/update-status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kondisi,
          lokasi_sekarang: lokasi,
          status,
          tgl_rencana_pengembalian: status === 'Digunakan' ? tglRencanaPengembalian : '',
          nomor_order: cleanNomorOrder,
          catatan: catatan ? `[${jenisPengajuan}] ${catatan}` : `[${jenisPengajuan} oleh ${actorLabel}]`,
          nama_pemegang_terakhir: targetHolder,
          actorName: actorLabel,
          actorRole: 'user_biasa',
          jenis_pengajuan: jenisPengajuan,
          foto_pengembalian: fotoPengembalian,
          lokasi_pengembalian: lokasi,
          koordinat_gps: lokasiGps
        })
      });

      const json = await res.json();
      if (!json.success) {
        throw new Error(json.message || 'Gagal mengirimkan pengajuan.');
      }

      if (json.pengajuan) {
        try {
          await addPengajuanFirestore(json.pengajuan);
        } catch (e) {
          console.warn('Firestore sync warning:', e);
        }
      }

      setSuccessMsg(
        `Pengajuan ${jenisPengajuan} aset [${selectedAsset.id_aset}] (Status: ${status}, Kondisi: ${kondisi}) berhasil dikirim! Menunggu persetujuan PIC Bidang (${selectedAsset.nama_pic_sekarang} - ${selectedAsset.nama_bidang_sekarang}). Bukti foto & titik GPS tersimpan.`
      );

      setCatatan('');
      setTimeout(() => {
        setIsSubmitting(false);
      }, 500);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal mengirimkan laporan.');
      setIsSubmitting(false);
    }
  };

  const filteredAsets = asets.filter(a => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      (a.id_aset || '').toLowerCase().includes(q) ||
      (a.asset_number || '').toLowerCase().includes(q) ||
      (a.tag_number || '').toLowerCase().includes(q) ||
      (a.nama || '').toLowerCase().includes(q) ||
      (a.qr_code || '').toLowerCase().includes(q) ||
      (a.nama_bidang_sekarang || '').toLowerCase().includes(q) ||
      (a.kategori || '').toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 overflow-y-auto p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center">
      <div className="bg-white rounded-2xl max-w-2xl w-full p-4 sm:p-6 shadow-2xl border border-slate-100 my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
        
        {/* Top Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center space-x-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#008C45]/10 text-[#008C45] flex items-center justify-center shrink-0 font-bold">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base leading-snug">
                Inspeksi & Status Pemakaian Aset (QR Scan Lapangan)
              </h3>
              <p className="text-xs text-slate-500">
                Lapor Pemakaian, Kondisi, & Transfer Mandiri Personel Lapangan (Tanpa Akun Login)
              </p>
            </div>
          </div>
          <button 
            onClick={handleCloseModal} 
            className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto space-y-4 pr-1">

          {/* Error Banner with Scan Again or Close options */}
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-2xl shadow-xs space-y-3 animate-in fade-in">
              <div className="flex items-start space-x-2.5">
                <AlertCircle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold text-xs uppercase tracking-wide text-rose-900">Proses Scan / Pengajuan Gagal</h4>
                  <p className="text-xs text-rose-800 mt-1 leading-relaxed">{errorMsg}</p>
                </div>
              </div>

              <div className="pt-2.5 border-t border-rose-200/80 flex flex-col sm:flex-row items-center justify-between gap-2">
                <span className="text-[11px] font-medium text-rose-700">
                  Apakah Anda ingin melakukan scan lagi atau menutup jendela ini?
                </span>
                <div className="flex items-center space-x-2 w-full sm:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={handleResetScan}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-bold flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
                  >
                    <QrCode className="w-3.5 h-3.5" />
                    <span>Scan Lagi / Coba QR Lain</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 sm:flex-none px-3.5 py-2 bg-white border border-rose-300 text-rose-800 hover:bg-rose-100 rounded-xl text-xs font-bold flex items-center justify-center space-x-1 transition-colors"
                  >
                    <X className="w-3.5 h-3.5" />
                    <span>Selesai / Tutup</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Success Banner with Scan Again or Close options */}
          {successMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl shadow-xs space-y-3 animate-in fade-in">
              <div className="flex items-start space-x-2.5">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <h4 className="font-extrabold text-sm text-emerald-900">Pengajuan Berhasil Dikirim!</h4>
                  <p className="text-xs text-emerald-800 mt-1 leading-relaxed">{successMsg}</p>
                </div>
              </div>

              <div className="pt-2.5 border-t border-emerald-200/80 flex flex-col sm:flex-row items-center justify-between gap-2">
                <span className="text-[11px] font-semibold text-emerald-800">
                  Apakah Anda ingin melakukan scan aset lainnya?
                </span>
                <div className="flex items-center space-x-2 w-full sm:w-auto shrink-0">
                  <button
                    type="button"
                    onClick={handleResetScan}
                    className="flex-1 sm:flex-none px-4 py-2 bg-[#008C45] hover:bg-[#007037] text-white rounded-xl text-xs font-extrabold flex items-center justify-center space-x-1.5 shadow-xs transition-colors"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Ya, Scan Aset Lain</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleCloseModal}
                    className="flex-1 sm:flex-none px-4 py-2 bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 rounded-xl text-xs font-bold flex items-center justify-center space-x-1 transition-colors"
                  >
                    <X className="w-4 h-4" />
                    <span>Tidak, Selesai / Tutup</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Camera Scan Stream Only */}
          {!selectedAsset && !successMsg && !errorMsg && (
            <div className="space-y-4">
              
              {/* Real Camera Scanner Component */}
              <CameraScanner
                scannerId="public-scanner-camera-stream"
                onScanSuccess={(decodedText) => {
                  setScannedQr(decodedText);
                  handleLookup(decodedText);
                }}
              />

            </div>
          )}

          {/* Selected Asset Inspection & Update View */}
          {selectedAsset && !successMsg && !errorMsg && (
            /* Selected Asset Inspection & Update View */
            <div className="space-y-4">
              
              {/* Reset selection button */}
              <button
                type="button"
                onClick={() => setSelectedAsset(null)}
                className="text-xs font-bold text-[#005DAA] hover:underline flex items-center space-x-1"
              >
                <span>← Kembali ke Pencarian / Scan QR Lainnya</span>
              </button>

              {/* Asset Header Info */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <div className="flex flex-col sm:flex-row items-start justify-between gap-3 pb-3 border-b border-slate-200">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="px-2 py-0.5 bg-[#005DAA]/10 text-[#005DAA] font-mono text-[11px] font-bold rounded-md">
                        {selectedAsset.id_aset}
                      </span>
                      <span className="text-xs text-slate-500 font-mono">SN: {selectedAsset.nomor_seri}</span>
                    </div>
                    <h4 className="font-extrabold text-slate-900 text-base mt-1 leading-snug">
                      {selectedAsset.nama}
                    </h4>
                    <p className="text-xs text-slate-600 mt-0.5">
                      {selectedAsset.merk_model} | Kategori: <strong className="text-slate-800">{selectedAsset.kategori}</strong>
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
                      selectedAsset.status === 'Digunakan' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                      selectedAsset.status === 'Selesai Pakai' ? 'bg-indigo-100 text-indigo-800 border border-indigo-200' :
                      selectedAsset.status === 'Idle' ? 'bg-slate-200 text-slate-700' :
                      selectedAsset.status === 'Maintenance' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                      'bg-rose-100 text-rose-800 border border-rose-200'
                    }`}>
                      Status: {selectedAsset.status}
                    </span>
                    <span className={`px-2.5 py-1 rounded-full text-xs font-extrabold ${
                      selectedAsset.kondisi === 'Baik' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      Kondisi: {selectedAsset.kondisi}
                    </span>
                  </div>
                </div>

                {/* Spec details grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-slate-400 font-medium">Bidang Pemilik (Custodian):</span>
                    <p className="font-bold text-slate-800">{selectedAsset.nama_bidang_sekarang} (PIC: {selectedAsset.nama_pic_sekarang})</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Lokasi Fisik Terakhir:</span>
                    <p className="font-bold text-slate-800 flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                      <span>{selectedAsset.lokasi_sekarang}</span>
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Pemegang Lapangan Terakhir:</span>
                    <p className="font-bold text-[#008C45]">{selectedAsset.nama_pemegang_terakhir || selectedAsset.nama_pic_sekarang || '-'}</p>
                  </div>
                  <div>
                    <span className="text-slate-400 font-medium">Sertifikat Kalibrasi:</span>
                    <p className="font-bold text-slate-800">{selectedAsset.nomor_sertifikat_kalibrasi || 'Terkalibrasi Resmi'}</p>
                  </div>
                </div>

                {/* Calibration Status Alert */}
                {selectedAsset.tgl_kalibrasi_berikutnya && (
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-center justify-between text-xs">
                    <div className="flex items-center space-x-2">
                      <Award className="w-4 h-4 text-[#008C45]" />
                      <span className="text-slate-600 font-medium">Jatuh Tempo Kalibrasi Berikutnya:</span>
                      <strong className="text-slate-900">{selectedAsset.tgl_kalibrasi_berikutnya}</strong>
                    </div>
                    <span className="text-[10px] bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded font-bold border border-emerald-200">
                      Aktif
                    </span>
                  </div>
                )}
              </div>

              {/* Form Laporan Pemutakhiran / Pemakaian */}
              <form onSubmit={handleSubmit} className="space-y-3.5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
                
                {/* Staff Identity Block */}
                <div className="space-y-2 pb-3 border-b border-slate-200">
                  <div className="flex items-center space-x-1.5 font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                    <User className="w-4 h-4 text-[#005DAA]" />
                    <span>Identitas Staff / Inspector Lapangan Pengaju *</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Nama Lengkap Staff / Inspector *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="Contoh: Dimas Prayoga"
                        value={namaStaff}
                        onChange={(e) => setNamaStaff(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-xl outline-hidden focus:ring-2 focus:ring-[#005DAA]"
                      />
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        Unit / Jabatan Lapangan
                      </label>
                      <input
                        type="text"
                        placeholder="Contoh: Surveyor Site Duri / Analis NDT"
                        value={unitStaff}
                        onChange={(e) => setUnitStaff(e.target.value)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-xl outline-hidden focus:ring-2 focus:ring-[#005DAA]"
                      />
                    </div>
                  </div>
                </div>

                {/* Form Fields according to Mode */}
                <div className="space-y-3 text-xs">
                  {/* Quick Shortcut if asset is currently Digunakan */}
                  {selectedAsset.status === 'Digunakan' && status !== 'Tersedia' && (
                    <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl flex items-center justify-between gap-3">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-5 h-5 text-[#008C45] shrink-0" />
                        <div>
                          <span className="font-bold text-emerald-900 block text-xs">Aset Sedang Digunakan</span>
                          <span className="text-[11px] text-emerald-700">Sudah selesai pakai? Klik untuk mengembalikan ke status Tersedia.</span>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setStatus('Tersedia');
                          const allowed = getAllowedKondisiForStatus('Tersedia');
                          if (!allowed.includes(kondisi)) setKondisi(allowed[0]);
                        }}
                        className="px-3 py-1.5 bg-[#008C45] hover:bg-[#007037] text-white font-bold rounded-lg text-xs whitespace-nowrap shadow-xs cursor-pointer transition-colors"
                      >
                        Selesai Pakai
                      </button>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Status Pemakaian Aset *</label>
                      <select
                        value={status}
                        onChange={(e) => {
                          const newStatus = e.target.value as StatusAset;
                          setStatus(newStatus);
                          const allowed = getAllowedKondisiForStatus(newStatus);
                          if (!allowed.includes(kondisi)) {
                            setKondisi(allowed[0]);
                          }
                        }}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-semibold outline-hidden focus:ring-2 focus:ring-[#005DAA]"
                      >
                        <option value="Digunakan">Digunakan (Sedang Dipakai di Lapangan)</option>
                        <option value="Tersedia">Tersedia (Selesai Pakai / Standby)</option>
                        <option value="Dalam Pemeliharaan">Dalam Pemeliharaan (Masa Servis)</option>
                        <option value="Dipinjamkan">Dipinjamkan (Dipinjamkan Antar Unit)</option>
                      </select>
                    </div>

                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Kondisi Fisik Peralatan *</label>
                      <select
                        value={kondisi}
                        onChange={(e) => setKondisi(e.target.value as KondisiAset)}
                        className="w-full p-2.5 bg-white border border-slate-300 rounded-xl font-semibold outline-hidden focus:ring-2 focus:ring-[#005DAA]"
                      >
                        {getAllowedKondisiForStatus(status).map(k => (
                          <option key={k} value={k}>{k}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Read-Only Nomor Order Sesi Aktif saat Check-In / Tersedia */}
                  {status === 'Tersedia' && (
                    <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-xl text-xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-blue-900 flex items-center space-x-1.5">
                          <ReceiptText className="w-4 h-4 text-[#005DAA]" />
                          <span>Nomor Order Sesi Aktif:</span>
                        </span>
                        <span className="font-mono font-extrabold px-2.5 py-1 rounded text-xs bg-white border border-blue-300 text-[#005DAA]">
                          {selectedAsset.nomor_order_aktif || 'Pemakaian Internal (Non-Revenue)'}
                        </span>
                      </div>
                      <p className="text-[10px] text-blue-700 leading-tight">
                        {selectedAsset.nomor_order_aktif 
                          ? 'Nomor order ini terhubung dengan sesi operasional aktif dan akan dicatat secara permanen di riwayat operasi untuk alokasi pendapatan.'
                          : 'Sesi ini tidak menautkan nomor order (operasional internal cabang).'}
                      </p>
                    </div>
                  )}

                  {status === 'Digunakan' && (
                    <div>
                      <label className="block font-bold text-amber-800 mb-1">
                        Tanggal Rencana Pengembalian Aset *
                      </label>
                      <input
                        type="date"
                        required
                        min={new Date().toISOString().split('T')[0]}
                        value={tglRencanaPengembalian}
                        onChange={(e) => setTglRencanaPengembalian(e.target.value)}
                        className="w-full p-2.5 bg-amber-50 border border-amber-300 rounded-xl font-semibold outline-hidden focus:ring-2 focus:ring-amber-500 text-amber-900"
                      />
                      <p className="text-[10px] text-amber-700 mt-1">
                        * Wajib diisi. Jika terlambat lebih dari 1 hari tanpa perubahan status/pengajuan baru, email peringatan otomatis dikirimkan ke PIC &amp; Fungsi Umum.
                      </p>
                    </div>
                  )}

                  {/* TAHAP 2: Nomor Order Input on Check-out (Digunakan) */}
                  {status === 'Digunakan' && (
                    <div className="space-y-2 p-3 bg-slate-50 border border-slate-200 rounded-xl">
                      <div className="flex items-center justify-between">
                        <label className="block font-semibold text-slate-800 text-xs flex items-center space-x-1.5">
                          <ReceiptText className="w-3.5 h-3.5 text-[#005DAA]" />
                          <span>Nomor Order (Opsional)</span>
                        </label>
                        <span className="text-[10px] text-slate-500 font-medium">Revenue Tracking &amp; Alokasi</span>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Contoh: ORD-2026-00123"
                          value={nomorOrderInput}
                          onChange={(e) => setNomorOrderInput(e.target.value.toUpperCase())}
                          className={`w-full p-2.5 pr-8 border rounded-lg text-xs font-mono font-bold uppercase transition-all ${
                            orderLookupError
                              ? 'border-rose-400 bg-rose-50/50 text-rose-900 focus:ring-2 focus:ring-rose-500'
                              : orderLookupResult
                              ? 'border-emerald-500 bg-emerald-50/40 text-emerald-950 focus:ring-2 focus:ring-emerald-500'
                              : 'border-slate-300 focus:ring-2 focus:ring-[#002B66]'
                          }`}
                        />
                        {isLookingUpOrder && (
                          <div className="absolute right-2.5 top-2.5">
                            <RotateCw className="w-4 h-4 animate-spin text-slate-400" />
                          </div>
                        )}
                      </div>

                      {/* Order Confirmation Card if Found */}
                      {orderLookupResult && (
                        <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-lg text-emerald-950 text-[11px] space-y-1.5 animate-in fade-in">
                          <div className="flex items-center justify-between font-bold text-emerald-800">
                            <div className="flex items-center space-x-1.5">
                              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                              <span>Order Terverifikasi</span>
                            </div>
                            <span className="font-mono bg-white px-2 py-0.5 rounded border border-emerald-300 text-emerald-900 font-bold">
                              {orderLookupResult.nomor_order}
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-[10px] pt-1.5 border-t border-emerald-200">
                            <div>
                              <span className="text-emerald-700 block">Nama Order / Project:</span>
                              <span className="font-semibold text-emerald-900">{orderLookupResult.nama_order || '-'}</span>
                            </div>
                            <div>
                              <span className="text-emerald-700 block">Nilai Order:</span>
                              <span className="font-extrabold text-emerald-900">
                                Rp {Number(orderLookupResult.nilai_order || 0).toLocaleString('id-ID')}
                              </span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Error if not found */}
                      {orderLookupError && (
                        <div className="p-2 bg-rose-50 border border-rose-300 rounded-lg text-rose-800 text-[11px] flex items-center space-x-1.5 animate-in fade-in">
                          <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                          <span>{orderLookupError}</span>
                        </div>
                      )}

                      <p className="text-[10px] text-slate-500">
                        * Masukkan nomor order untuk menautkan pemakaian ini ke project revenue agar nilai order dialokasikan ke utilisasi pendapatan aset. Kosongkan jika merupakan pemakaian internal cabang (non-revenue).
                      </p>
                    </div>
                  )}

                  <div className={`grid gap-3 ${status === 'Tersedia' ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'}`}>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">Nama Pemegang Terakhir (Otomatis)</label>
                      <input
                        type="text"
                        readOnly
                        value={namaStaff.trim() ? `${namaStaff.trim()} (Pengaju)` : 'Otomatis Mengikuti Nama Staff'}
                        className="w-full p-2.5 bg-slate-100 border border-slate-200 text-slate-700 rounded-xl font-semibold outline-hidden cursor-not-allowed"
                      />
                    </div>

                    {status !== 'Tersedia' && (
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">Lokasi Fisik Terkini / Site *</label>
                        <input
                          type="text"
                          required
                          placeholder="Misal: Dermaga Pelabuhan / Site Lapangan"
                          value={lokasi}
                          onChange={(e) => setLokasi(e.target.value)}
                          className="w-full p-2.5 bg-white border border-slate-300 rounded-xl outline-hidden focus:ring-2 focus:ring-[#005DAA]"
                        />
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block font-bold text-slate-700 mb-1">
                      Catatan (Kondisi / Lokasi / Keperluan Pemakaian) *
                    </label>
                    <textarea
                      rows={2}
                      required
                      placeholder="Tuliskan tujuan pemakaian, nomor project, atau temuan fisik peralatan..."
                      value={catatan}
                      onChange={(e) => setCatatan(e.target.value)}
                      className="w-full p-2.5 bg-white border border-slate-300 rounded-xl outline-hidden focus:ring-2 focus:ring-[#005DAA] text-xs"
                    ></textarea>
                  </div>

                  {/* Pengisian Lokasi & Ambil Gambar jika Ubah Barang Menjadi Tersedia (Tepat di bawah sebelum tombol Kirim Pengajuan) */}
                  {status === 'Tersedia' && (
                    <div className="pt-1">
                      <ReturnAssetEvidenceSection
                        foto={fotoPengembalian}
                        onFotoChange={(val) => setFotoPengembalian(val)}
                        lokasiGps={lokasiGps}
                        onLokasiGpsChange={(gps, formattedText) => {
                          setLokasiGps(gps);
                          if (formattedText) setLokasi(formattedText);
                        }}
                        lokasiFisik={lokasi}
                        onLokasiFisikChange={(val) => setLokasi(val)}
                        namaAset={selectedAsset.nama}
                        disabled={isSubmitting}
                      />
                    </div>
                  )}
                </div>

                {/* Warning if Evidence Missing for Status Tersedia */}
                {status === 'Tersedia' && (!fotoPengembalian || !lokasiGps) && (
                  <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs text-rose-900 flex items-start space-x-2.5 shadow-2xs">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                      <span className="font-bold text-rose-950 block">Pengajuan Terkunci: Bukti Fisik Belum Lengkap</span>
                      <p className="text-[11px] text-rose-800">
                        Status aset dipilih <strong>Tersedia</strong> (selesai pemakaian). Pengajuan <strong>tidak dapat dikirim</strong> sebelum Anda melengkapi foto fisik dan titik lokasi pengembalian di atas.
                      </p>
                      <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-800 font-semibold pl-1">
                        {!fotoPengembalian && <li className="text-rose-700">Foto fisik barang belum diambil/diunggah.</li>}
                        {!lokasiGps && <li className="text-rose-700">Akses titik lokasi (GPS) belum diambil (klik tombol "Ambil Lokasi Saat Ini (GPS)").</li>}
                      </ul>
                    </div>
                  </div>
                )}

                {/* Submit Action */}
                <div className="flex flex-col sm:flex-row items-center justify-between gap-2 pt-2 border-t border-slate-200">
                  <p className="text-[10px] text-slate-500 italic">
                    * Pengajuan dikirim ke PIC Bidang ({selectedAsset.nama_bidang_sekarang} - {selectedAsset.nama_pic_sekarang}) untuk verifikasi approval.
                  </p>
                  <button
                    type="submit"
                    disabled={isSubmitting || (status === 'Tersedia' && (!fotoPengembalian || !lokasiGps))}
                    className={`w-full sm:w-auto px-6 py-2.5 font-extrabold rounded-xl text-xs flex items-center justify-center space-x-1.5 shadow-md transition-all ${
                      (status === 'Tersedia' && (!fotoPengembalian || !lokasiGps))
                        ? 'bg-slate-300 text-slate-500 border border-slate-300 cursor-not-allowed shadow-none'
                        : 'bg-[#008C45] hover:bg-[#007037] text-white cursor-pointer'
                    }`}
                  >
                    {(status === 'Tersedia' && (!fotoPengembalian || !lokasiGps)) ? (
                      <>
                        <AlertCircle className="w-3.5 h-3.5 text-slate-500" />
                        <span>Lengkapi Foto &amp; Lokasi Pengembalian</span>
                      </>
                    ) : (
                      <>
                        <Send className="w-3.5 h-3.5" />
                        <span>{isSubmitting ? 'Mengirim...' : 'Kirim Pengajuan'}</span>
                      </>
                    )}
                  </button>
                </div>

              </form>

            </div>
          )}

        </div>

      </div>
    </div>
  );
};
