import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Aset, 
  Bidang, 
  Cabang,
  User, 
  KategoriAset, 
  KondisiAset, 
  StatusAset, 
  AuditLog, 
  Assignment, 
  RiwayatKalibrasi, 
  Pengajuan, 
  BasisOperasiAset,
  SumberAset,
  ALL_STATUSES, 
  ALL_KONDISI, 
  getAllowedKondisiForStatus,
  isFungsiUmum,
  isStaffPuma,
  isKepalaBidangDukunganBisnis
} from '../types';
import { apiClient } from '../lib/apiClient';
import { 
  Package, 
  Plus, 
  Search, 
  Filter, 
  QrCode, 
  Eye, 
  Edit3, 
  ArrowRightLeft, 
  Calendar, 
  Download, 
  Printer, 
  Check, 
  X,
  FileSpreadsheet,
  FileText,
  FileDown,
  Loader2,
  Clock,
  History,
  AlertCircle,
  Trash2,
  Sliders,
  Maximize2,
  CheckSquare,
  Square,
  Layers,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Activity,
  Gauge,
  Building,
  Sparkles,
  Inbox
} from 'lucide-react';
import QRCode from 'qrcode';
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import { PaginationControls } from './PaginationControls';
import { AssetHistoryModal } from './AssetHistoryModal';
import { ReturnAssetEvidenceSection } from './ReturnAssetEvidenceSection';

interface MasterDataAsetProps {
  asets: Aset[];
  bidangList: Bidang[];
  userList: User[];
  currentUser: User;
  onCreateAsset: (data: any) => void;
  onUpdateAsset: (id: string, data: any) => void;
  onAssignAsset: (id: string) => void;
  onExportCsv: () => void;
  onOpenScanner: (asset?: Aset) => void;
  onSubmitRequest?: (data: any) => Promise<void>;
  auditLogs?: AuditLog[];
  assignments?: Assignment[];
  kalibrasiList?: RiwayatKalibrasi[];
  pengajuanList?: Pengajuan[];
  cabangList?: Cabang[];
  onRefreshData?: () => void;
}

export const MasterDataAset: React.FC<MasterDataAsetProps> = ({
  asets,
  bidangList,
  userList,
  currentUser,
  onCreateAsset,
  onUpdateAsset,
  onAssignAsset,
  onExportCsv,
  onOpenScanner,
  onSubmitRequest,
  auditLogs = [],
  assignments = [],
  kalibrasiList = [],
  pengajuanList = [],
  cabangList = [],
  onRefreshData
}) => {
  const [search, setSearch] = useState('');
  const [selectedBidang, setSelectedBidang] = useState('All');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [selectedKondisi, setSelectedKondisi] = useState('All');
  const [selectedSumberAset, setSelectedSumberAset] = useState<'All' | 'PUMA' | 'Cabang'>('All');
  const [selectedUtilisasiFilter, setSelectedUtilisasiFilter] = useState<'All' | 'Optimal' | 'Moderat' | 'Rendah'>('All');

  // Konfirmasi Penerimaan Aset PUMA di Cabang
  const [confirmingAssetId, setConfirmingAssetId] = useState<string | null>(null);
  const [confirmSuccessMsg, setConfirmSuccessMsg] = useState<string>('');
  const [confirmErrorMsg, setConfirmErrorMsg] = useState<string>('');

  // Modal Detail Utilisasi Aset Operasional
  const [selectedUtilizationAsset, setSelectedUtilizationAsset] = useState<Aset | null>(null);
  const [utilizationModalTab, setUtilizationModalTab] = useState<'mingguan' | 'bulanan' | 'allTime'>('bulanan');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showQrModal, setShowQrModal] = useState<Aset | null>(null);
  const [selectedHistoryAsset, setSelectedHistoryAsset] = useState<Aset | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false);

  // Mode Seleksi Cetak Massal (Opsi A)
  const [isSelectionMode, setIsSelectionMode] = useState<boolean>(false);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [showBatchModal, setShowBatchModal] = useState<boolean>(false);
  const [isGeneratingBatchPdf, setIsGeneratingBatchPdf] = useState<boolean>(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number; stage: string }>({ current: 0, total: 0, stage: '' });
  const [batchLabelPreset, setBatchLabelPreset] = useState<'roll-4x6-landscape' | 'roll-4x6-portrait' | 'small' | 'custom'>('roll-4x6-landscape');
  const [batchSortOrder, setBatchSortOrder] = useState<'table' | 'tag_asc' | 'asset_asc' | 'name_asc' | 'id_asc'>('table');
  const [batchCustomWidthCm, setBatchCustomWidthCm] = useState<number>(6.0);
  const [batchCustomHeightCm, setBatchCustomHeightCm] = useState<number>(4.0);
  const [batchIncludeLogo, setBatchIncludeLogo] = useState<boolean>(true);
  const [batchIncludeName, setBatchIncludeName] = useState<boolean>(true);
  const [batchIncludeNumbers, setBatchIncludeNumbers] = useState<boolean>(true);
  const [batchIncludePic, setBatchIncludePic] = useState<boolean>(true);
  const [batchPreviewIndex, setBatchPreviewIndex] = useState<number>(0);
  const [batchPreviewQrUrl, setBatchPreviewQrUrl] = useState<string>('');

  // QR Label Print Customization State (Physical Box CM as strict primary benchmark)
  const [labelSizePreset, setLabelSizePreset] = useState<'small' | 'medium' | 'large' | 'custom'>('medium');
  const [customWidthCm, setCustomWidthCm] = useState<number>(6.0);
  const [customHeightCm, setCustomHeightCm] = useState<number>(4.0);
  const [includeLogo, setIncludeLogo] = useState<boolean>(true);
  const [includeName, setIncludeName] = useState<boolean>(true);
  const [includeNumbers, setIncludeNumbers] = useState<boolean>(true);
  const [includePic, setIncludePic] = useState<boolean>(true);

  // Helper to calculate locked physical (CM) and preview dimensions
  const getLabelDimensions = (preset: string, wCm: number, hCm: number) => {
    let widthCm = 6.0;
    let heightCm = 4.0;

    if (preset === 'roll-4x6-landscape' || preset === 'medium') {
      widthCm = 6.0;
      heightCm = 4.0;
    } else if (preset === 'roll-4x6-portrait') {
      widthCm = 4.0;
      heightCm = 6.0;
    } else if (preset === 'small') {
      widthCm = 4.0;
      heightCm = 2.5;
    } else if (preset === 'large') {
      widthCm = 8.0;
      heightCm = 5.0;
    } else if (preset === 'custom') {
      widthCm = Math.max(2.5, Number(wCm.toFixed(1)));
      heightCm = Math.max(1.8, Number(hCm.toFixed(1)));
    }

    // Fixed scale for visual on-screen preview (40px per 1 cm)
    const previewScale = 40;
    const previewWidth = Math.round(widthCm * previewScale);
    const previewHeight = Math.round(heightCm * previewScale);

    // Dimension indicators
    const isSmall = widthCm <= 4.5 || heightCm <= 3.0;
    const isLarge = widthCm >= 7.5 && heightCm >= 4.8;
    const minDim = Math.min(widthCm, heightCm * 1.35);

    // Scaling content items to fit strictly within the fixed box
    const qrSizePrintMm = Math.max(10, Math.round(Math.min(heightCm * 0.35, widthCm * 0.35) * 10));
    const qrSizePreviewPx = Math.max(38, Math.round(Math.min(previewHeight * 0.38, previewWidth * 0.38)));

    const logoHeightMm = Math.max(2.5, Math.round(minDim * 0.75));
    const fontSizeHeaderPt = Math.max(5.5, Number((minDim * 1.95).toFixed(1)));
    const fontSizeQrCodePt = Math.max(6.0, Number((minDim * 2.15).toFixed(1)));
    const fontSizeNamePt = Math.max(6.5, Number((minDim * 2.25).toFixed(1)));
    const fontSizeNumbersPt = Math.max(5.0, Number((minDim * 1.75).toFixed(1)));
    const fontSizePicPt = Math.max(5.0, Number((minDim * 1.75).toFixed(1)));
    const paddingMm = Math.max(1.5, Math.round(minDim * 0.5));
    const gapMm = Math.max(0.6, Number((minDim * 0.25).toFixed(1)));

    const logoHeightPx = isSmall ? 10 : isLarge ? 16 : 13;
    const fontSizeHeaderPx = isSmall ? 8.5 : isLarge ? 12 : 10;
    const fontSizeQrCodePx = isSmall ? 8.5 : isLarge ? 13 : 11;
    const fontSizeNamePx = isSmall ? 8.5 : isLarge ? 13 : 11;
    const fontSizeNumbersPx = isSmall ? 7.5 : isLarge ? 10.5 : 8.5;
    const fontSizePicPx = isSmall ? 7.5 : isLarge ? 10.5 : 8.5;
    const paddingPx = isSmall ? 6 : isLarge ? 10 : 8;
    const gapPx = isSmall ? 2 : isLarge ? 4 : 3;

    return {
      widthCm,
      heightCm,
      previewWidth,
      previewHeight,
      qrSizePrintMm,
      qrSizePreviewPx,
      logoHeightMm,
      fontSizeHeaderPt,
      fontSizeQrCodePt,
      fontSizeNamePt,
      fontSizeNumbersPt,
      fontSizePicPt,
      paddingMm,
      gapMm,
      logoHeightPx,
      fontSizeHeaderPx,
      fontSizeQrCodePx,
      fontSizeNamePx,
      fontSizeNumbersPx,
      fontSizePicPx,
      paddingPx,
      gapPx,
      isSmall,
      isLarge
    };
  };

  // Transfer & Disposal Request Modal State
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferAsset, setTransferAsset] = useState<Aset | null>(null);
  const [transferJenis, setTransferJenis] = useState<'Transfer' | 'Disposal' | 'Pengajuan Pemakaian' | 'Pengembalian Aset (Selesai Pakai)'>('Transfer');
  const [idBidangTujuan, setIdBidangTujuan] = useState(bidangList[1]?.id_bidang || '');
  const [idPicTujuan, setIdPicTujuan] = useState(userList[1]?.id || '');
  const [pemegangBaruInput, setPemegangBaruInput] = useState('');
  const [alasanTransfer, setAlasanTransfer] = useState('');
  const [tglRencanaPengembalianInput, setTglRencanaPengembalianInput] = useState('');
  const [transferFotoPengembalian, setTransferFotoPengembalian] = useState('');
  const [transferLokasiPengembalian, setTransferLokasiPengembalian] = useState('');
  const [transferLokasiGps, setTransferLokasiGps] = useState<{ lat: number; lng: number; accuracy?: number } | null>(null);
  const [isSubmittingTransfer, setIsSubmittingTransfer] = useState(false);
  const [transferSuccessMsg, setTransferSuccessMsg] = useState('');
  const [transferErrorMsg, setTransferErrorMsg] = useState('');

  // New Asset Form State
  const [filterAssetNumber, setFilterAssetNumber] = useState('');
  const [filterTagNumber, setFilterTagNumber] = useState('');

  // Proyeksi Pendapatan & Konfirmasi Penerimaan Modal State
  const [receiptModalAsset, setReceiptModalAsset] = useState<Aset | null>(null);
  const [receiptCatatan, setReceiptCatatan] = useState('');
  const [proyeksiRows, setProyeksiRows] = useState<Array<{ tahun: number; nilai: number }>>([]);
  const [receiptFormError, setReceiptFormError] = useState('');
  const [showReceiptConfirmModal, setShowReceiptConfirmModal] = useState(false);
  const [showAddConfirmModal, setShowAddConfirmModal] = useState(false);

  const [newAsset, setNewAsset] = useState({
    nama: '',
    kategori: 'Peralatan Operasi' as KategoriAset,
    asset_number: '',
    tag_number: '',
    id_cabang: currentUser.role === 'puma' ? (cabangList[0]?.id_cabang || '') : (currentUser.id_cabang || cabangList[0]?.id_cabang || ''),
    basis_operasi: 'Working Day Based' as BasisOperasiAset,
    sumber_aset: (currentUser.role === 'puma' ? 'PUMA' : 'Cabang') as SumberAset,
    tgl_perolehan: new Date().toISOString().split('T')[0],
    spesifikasi: '',
    merk_model: '',
    nomor_seri: '',
    lokasi_awal: '',
    id_pic: '',
    tgl_kalibrasi_terakhir: '',
    tgl_kalibrasi_berikutnya: '',
    sertifikat_kalibrasi_no: '',
    status: 'Tersedia' as StatusAset,
    kondisi: 'Baik' as KondisiAset,
    nilai_perolehan: '' as string | number
  });

  // Active target branch ID for the new asset form
  const activeNewAssetCabangId = useMemo(() => {
    if (currentUser.role === 'puma') {
      return newAsset.id_cabang || '';
    }
    return currentUser.id_cabang || newAsset.id_cabang || cabangList[0]?.id_cabang || '';
  }, [currentUser, newAsset.id_cabang, cabangList]);

  const activeTargetCabang = useMemo(() => {
    if (!activeNewAssetCabangId) return null;
    return cabangList.find(c => c.id_cabang === activeNewAssetCabangId) || null;
  }, [activeNewAssetCabangId, cabangList]);

  // Helper to check if a user belongs to a target branch
  const isUserInBranch = useCallback((u: User, branchId: string, branchObj: Cabang | null) => {
    if (!branchId) return false;
    if (u.role === 'puma' || isStaffPuma(u)) return false;

    // 1. Direct id_cabang match
    if (u.id_cabang) {
      if (u.id_cabang === branchId) return true;
      if (branchObj && (u.id_cabang === branchObj.kode_cabang || u.id_cabang === branchObj.id_cabang)) return true;
      return false;
    }

    // 2. Direct nama_cabang match
    if (u.nama_cabang && branchObj?.nama_cabang) {
      if (u.nama_cabang.toLowerCase().trim() === branchObj.nama_cabang.toLowerCase().trim()) {
        return true;
      }
      return false;
    }

    // 3. Fallback for legacy user without id_cabang: only in default first branch
    const defaultBranchId = cabangList[0]?.id_cabang || 'CBG-001';
    if (!u.id_cabang && !u.nama_cabang && (branchId === defaultBranchId || branchId === 'CBG-01' || branchId === 'CBG-001')) {
      return true;
    }

    return false;
  }, [cabangList]);

  // Helper to check if a user has Fungsi UMUM capability
  const isUserFungsiUmum = useCallback((u: User) => {
    if (u.role === 'puma' || isStaffPuma(u)) return false;
    return (
      isFungsiUmum(u) ||
      u.role === 'admin' ||
      u.id_bidang === 'BDG-01' ||
      u.id_bidang === 'BDG-001' ||
      Boolean(u.nama_bidang && u.nama_bidang.toLowerCase().includes('dukungan bisnis')) ||
      Boolean(u.nama_bidang && u.nama_bidang.toLowerCase().includes('fungsi umum')) ||
      Boolean(u.jabatan && u.jabatan.toLowerCase().includes('umum')) ||
      Boolean(u.jabatan && u.jabatan.toLowerCase().includes('custodian')) ||
      Boolean(u.jabatan && u.jabatan.toLowerCase().includes('flp')) ||
      isKepalaBidangDukunganBisnis(u)
    );
  }, []);

  // Filtered Fungsi UMUM users ONLY for the specifically selected branch
  const fungsiUmumUsers = useMemo(() => {
    if (!activeNewAssetCabangId) {
      return [];
    }

    const branchUsers = userList.filter(u => isUserInBranch(u, activeNewAssetCabangId, activeTargetCabang));
    const branchFungsiUmum = branchUsers.filter(isUserFungsiUmum);

    if (branchFungsiUmum.length > 0) {
      return branchFungsiUmum;
    }

    // Fallback to any user within the SAME branch if no dedicated Fungsi Umum user exists yet
    if (branchUsers.length > 0) {
      return branchUsers;
    }

    // Strictly empty if no user belongs to that branch — never leak users from other branches
    return [];
  }, [activeNewAssetCabangId, activeTargetCabang, userList, isUserInBranch, isUserFungsiUmum]);

  // Keep newAsset.id_pic synchronized with the filtered users of the selected branch
  useEffect(() => {
    if (showAddModal) {
      if (fungsiUmumUsers.length > 0) {
        const isCurrentPicValid = fungsiUmumUsers.some(u => u.id === newAsset.id_pic);
        if (!isCurrentPicValid) {
          setNewAsset(prev => ({
            ...prev,
            id_pic: fungsiUmumUsers[0].id
          }));
        }
      } else {
        if (newAsset.id_pic) {
          setNewAsset(prev => ({
            ...prev,
            id_pic: ''
          }));
        }
      }
    }
  }, [showAddModal, activeNewAssetCabangId, fungsiUmumUsers, newAsset.id_pic]);

  const handleNewAssetStatusChange = (newStatus: StatusAset) => {
    const allowed = getAllowedKondisiForStatus(newStatus);
    const newKondisi = allowed.includes(newAsset.kondisi) ? newAsset.kondisi : allowed[0];
    setNewAsset(prev => ({
      ...prev,
      status: newStatus,
      kondisi: newKondisi
    }));
  };

  // Aset PUMA yang menunggu konfirmasi penerimaan di cabang ini
  const incomingPumaAsets = useMemo(() => {
    if (currentUser.role === 'puma') return [];
    return asets.filter(a => 
      a.sumber_aset === 'PUMA' && 
      a.status_penerimaan === 'Menunggu Penerimaan' && 
      (!currentUser.id_cabang || a.id_cabang === currentUser.id_cabang)
    );
  }, [asets, currentUser]);

  const handleOpenReceiptModal = (asset: Aset) => {
    const currentYear = new Date().getFullYear();
    setReceiptModalAsset(asset);
    setReceiptCatatan('Barang telah diterima di Cabang dalam kondisi baik');
    setProyeksiRows([
      { tahun: currentYear, nilai: 0 }
    ]);
    setReceiptFormError('');
    setShowReceiptConfirmModal(false);
  };

  const handleAddProyeksiRow = () => {
    const lastYear = proyeksiRows.length > 0 ? proyeksiRows[proyeksiRows.length - 1].tahun : new Date().getFullYear();
    setProyeksiRows([...proyeksiRows, { tahun: lastYear + 1, nilai: 0 }]);
  };

  const handleUpdateProyeksiRow = (index: number, field: 'tahun' | 'nilai', val: number) => {
    const updated = [...proyeksiRows];
    updated[index] = { ...updated[index], [field]: val };
    setProyeksiRows(updated);
  };

  const handleRemoveProyeksiRow = (index: number) => {
    setProyeksiRows(proyeksiRows.filter((_, i) => i !== index));
  };

  // Warning check: yearly projection > nilai perolehan * 2
  const hasExcessiveProjection = useMemo(() => {
    if (!receiptModalAsset?.nilai_perolehan || receiptModalAsset.nilai_perolehan <= 0) return false;
    const threshold = receiptModalAsset.nilai_perolehan * 2;
    return proyeksiRows.some(p => p.nilai > threshold);
  }, [receiptModalAsset, proyeksiRows]);

  const handleValidateReceiptForm = (e: React.FormEvent) => {
    e.preventDefault();
    setReceiptFormError('');

    if (!receiptModalAsset) return;

    if (receiptModalAsset.kategori === 'Peralatan Operasi') {
      if (proyeksiRows.length === 0) {
        setReceiptFormError('Aset kategori Peralatan Operasi wajib menyertakan minimal 1 (satu) baris proyeksi pendapatan per tahun.');
        return;
      }
    }

    const seenYears = new Set<number>();
    for (const p of proyeksiRows) {
      if (!p.tahun || isNaN(p.tahun)) {
        setReceiptFormError('Tahun proyeksi harus berupa angka valid.');
        return;
      }
      if (seenYears.has(p.tahun)) {
        setReceiptFormError(`Tahun ${p.tahun} tidak boleh dimasukkan lebih dari sekali (duplikat).`);
        return;
      }
      seenYears.add(p.tahun);

      if (isNaN(p.nilai) || p.nilai <= 0) {
        setReceiptFormError(`Nilai proyeksi tahun ${p.tahun} harus berupa bilangan bulat Rupiah lebih dari 0.`);
        return;
      }
    }

    setShowReceiptConfirmModal(true);
  };

  const handleExecuteReceipt = async () => {
    if (!receiptModalAsset) return;
    try {
      setConfirmingAssetId(receiptModalAsset.id_aset);
      setConfirmSuccessMsg('');
      setConfirmErrorMsg('');
      await apiClient.terimaAsetDiCabang(receiptModalAsset.id_aset, {
        catatan: receiptCatatan,
        proyeksi: proyeksiRows
      });
      setConfirmSuccessMsg(`✓ Barang [${receiptModalAsset.id_aset}] ${receiptModalAsset.nama} berhasil dikonfirmasi diterima di cabang beserta proyeksi pendapatan!`);
      setShowReceiptConfirmModal(false);
      setReceiptModalAsset(null);
      onRefreshData?.();
      setTimeout(() => setConfirmSuccessMsg(''), 5000);
    } catch (err: any) {
      setShowReceiptConfirmModal(false);
      setReceiptFormError(err.message || 'Gagal mengonfirmasi penerimaan barang.');
    } finally {
      setConfirmingAssetId(null);
    }
  };

  const categories: KategoriAset[] = [
    'Tanah',
    'Bangunan',
    'Perlengkapan/Mesin Gedung',
    'Peralatan Operasi',
    'Kendaraan',
    'Peralatan/Prabot Kantor',
    'Peralatan Sistem Informasi'
  ];

  // Sort assets by newest acquisition date / year / created_at / ID descending
  const sortedAsets = useMemo(() => {
    return [...asets].sort((a, b) => {
      const getTimestamp = (asset: Aset) => {
        if (asset.tgl_perolehan) {
          const t = new Date(asset.tgl_perolehan).getTime();
          if (!isNaN(t) && t > 0) return t;
        }
        if (asset.tahun_perolehan) {
          const yr = Number(asset.tahun_perolehan);
          if (!isNaN(yr) && yr > 0) return new Date(`${yr}-01-01`).getTime();
        }
        if (asset.created_at) {
          const t = new Date(asset.created_at).getTime();
          if (!isNaN(t) && t > 0) return t;
        }
        return 0;
      };

      const timeA = getTimestamp(a);
      const timeB = getTimestamp(b);

      if (timeB !== timeA) {
        return timeB - timeA; // Newest first
      }

      return (b.id_aset || '').localeCompare(a.id_aset || '');
    });
  }, [asets]);

  // Filtered Assets
  const filteredAsets = sortedAsets.filter((a) => {
    const q = (search || '').toLowerCase().trim();
    const matchesSearch = 
      !q || 
      (a.id_aset || '').toLowerCase().includes(q) ||
      (a.asset_number || '').toLowerCase().includes(q) ||
      (a.tag_number || '').toLowerCase().includes(q) ||
      (a.nama || '').toLowerCase().includes(q) ||
      (a.spesifikasi || '').toLowerCase().includes(q) ||
      (a.merk_model || '').toLowerCase().includes(q) ||
      (a.nomor_seri || '').toLowerCase().includes(q) ||
      (a.qr_code || '').toLowerCase().includes(q) ||
      (a.kategori || '').toLowerCase().includes(q) ||
      (a.nama_bidang_sekarang || '').toLowerCase().includes(q) ||
      (a.nama_pic_sekarang || '').toLowerCase().includes(q) ||
      (a.lokasi_sekarang || '').toLowerCase().includes(q);

    const filterAssetNumQ = (filterAssetNumber || '').toLowerCase().trim();
    const matchesAssetNum = !filterAssetNumQ || (a.asset_number || '').toLowerCase().includes(filterAssetNumQ);

    const filterTagNumQ = (filterTagNumber || '').toLowerCase().trim();
    const matchesTagNum = !filterTagNumQ || (a.tag_number || '').toLowerCase().includes(filterTagNumQ);

    const matchesBidang = selectedBidang === 'All' || a.id_bidang_sekarang === selectedBidang;
    const matchesCategory = selectedCategory === 'All' || a.kategori === selectedCategory;
    const matchesStatus = selectedStatus === 'All'
      ? true
      : selectedStatus === 'Terlambat'
        ? (() => {
            if (a.status !== 'Digunakan' || !a.tgl_rencana_pengembalian) return false;
            const returnDate = new Date(a.tgl_rencana_pengembalian);
            if (isNaN(returnDate.getTime())) return false;
            const todayMid = new Date();
            todayMid.setHours(0, 0, 0, 0);
            returnDate.setHours(0, 0, 0, 0);
            return Math.floor((todayMid.getTime() - returnDate.getTime()) / (1000 * 60 * 60 * 24)) >= 1;
          })()
        : a.status === selectedStatus;
    const matchesKondisi = selectedKondisi === 'All' || a.kondisi === selectedKondisi;
    const matchesSumber = selectedSumberAset === 'All' || 
      (selectedSumberAset === 'PUMA' ? a.sumber_aset === 'PUMA' : a.sumber_aset === 'Cabang');

    const matchesUtilisasi = selectedUtilisasiFilter === 'All'
      ? true
      : (() => {
          if (a.kategori !== 'Peralatan Operasi' && !a.basis_operasi) return false;
          const rate = a.utilization?.bulanan?.rate ?? 0;
          if (selectedUtilisasiFilter === 'Optimal') return rate >= 80;
          if (selectedUtilisasiFilter === 'Moderat') return rate >= 50 && rate < 80;
          if (selectedUtilisasiFilter === 'Rendah') return rate < 50;
          return true;
        })();

    return matchesSearch && matchesAssetNum && matchesTagNum && matchesBidang && matchesCategory && matchesStatus && matchesKondisi && matchesSumber && matchesUtilisasi;
  });

  // Reset pagination when search or filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterAssetNumber, filterTagNumber, selectedBidang, selectedCategory, selectedStatus, selectedKondisi, selectedSumberAset, selectedUtilisasiFilter]);

  const totalItems = filteredAsets.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedAsets = filteredAsets.slice(startIndex, startIndex + pageSize);

  // Download Excel (.xlsx) Handler
  const handleExportExcel = () => {
    const dataToExport = filteredAsets.map((a, index) => ({
      'No': index + 1,
      'ID Aset': a.id_aset,
      'Asset Number': a.asset_number || '-',
      'Tag Number': a.tag_number || '-',
      'Nama Barang / Aset': a.nama,
      'Bidang Pemilik / Pengelola': a.nama_bidang_sekarang,
      'Kategori': a.kategori,
      'Status Operasional': a.status,
      'Kondisi Fisik': a.kondisi,
      'Lokasi Saat Ini': a.lokasi_sekarang,
      'Pemegang Terakhir': a.nama_pemegang_terakhir || a.nama_pic_sekarang || '-',
      'Nomor Seri': a.nomor_seri || '-',
      'Merk / Model': a.merk_model || '-',
      'Spesifikasi': a.spesifikasi || '-',
      'Tanggal Perolehan': a.tgl_perolehan || a.tahun_perolehan || '-',
      'Tgl Kalibrasi Terakhir': a.tgl_kalibrasi_terakhir ? new Date(a.tgl_kalibrasi_terakhir).toLocaleDateString('id-ID') : '-',
      'Jadwal Kalibrasi Berikutnya': a.tgl_kalibrasi_berikutnya ? new Date(a.tgl_kalibrasi_berikutnya).toLocaleDateString('id-ID') : '-',
      'Sertifikat Kalibrasi': a.sertifikat_kalibrasi_no || '-',
      'Kode QR Barcode': a.qr_code,
      'Tgl Terakhir Update Status': a.updated_at
        ? new Date(a.updated_at).toLocaleString('id-ID')
        : (a.created_at ? new Date(a.created_at).toLocaleDateString('id-ID') : '-')
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);

    // Set column width for nicely formatted Excel
    worksheet['!cols'] = [
      { wch: 6 },  // No
      { wch: 16 }, // ID Aset
      { wch: 32 }, // Nama Barang
      { wch: 28 }, // Bidang
      { wch: 20 }, // Kategori
      { wch: 16 }, // Status
      { wch: 16 }, // Kondisi
      { wch: 22 }, // Lokasi
      { wch: 22 }, // Pemegang
      { wch: 18 }, // Nomor Seri
      { wch: 20 }, // Merk/Model
      { wch: 28 }, // Spesifikasi
      { wch: 14 }, // Tahun
      { wch: 20 }, // Kalibrasi Terakhir
      { wch: 22 }, // Kalibrasi Berikutnya
      { wch: 22 }, // Sertifikat
      { wch: 32 }, // QR Code
      { wch: 26 }  // Tgl Update
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Master Data Aset');

    const dateStr = new Date().toISOString().split('T')[0];
    XLSX.writeFile(workbook, `Master_Data_Aset_SUCOFINDO_${dateStr}.xlsx`);
  };

  // Generate QR Code Image URL
  const handleOpenQrModal = async (asset: Aset) => {
    setShowQrModal(asset);
    try {
      const url = await QRCode.toDataURL(asset.qr_code, {
        width: 400,
        margin: 2,
        color: {
          dark: '#002B66',
          light: '#FFFFFF'
        }
      });
      setQrDataUrl(url);
    } catch (err) {
      console.error('Failed to generate QR code:', err);
    }
  };

  // Dedicated Isolated Printing Function for QR Label Tag (Borderless High-DPI Output)
  const handlePrintQrLabel = async () => {
    if (!showQrModal || !qrDataUrl) return;

    try {
      const dims = getLabelDimensions(labelSizePreset, customWidthCm, customHeightCm);
      const widthMm = dims.widthCm * 10;
      const heightMm = dims.heightCm * 10;

      let logoImg: HTMLImageElement | null = null;
      if (includeLogo) {
        logoImg = await loadImageAsync('https://i.ibb.co.com/xKsyxsWX/logo-sucofindo.png');
      }

      const canvas = await renderAssetLabelCanvas({
        asset: showQrModal,
        qrDataUrl,
        dims,
        includeLogo,
        includeName,
        includeNumbers,
        includePic,
        logoImg
      });

      const imgSrc = canvas.toDataURL('image/png', 1.0);

      let printFrame = document.getElementById('qr-print-iframe') as HTMLIFrameElement;
      if (!printFrame) {
        printFrame = document.createElement('iframe');
        printFrame.id = 'qr-print-iframe';
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);
      }

      const frameDoc = printFrame.contentWindow?.document;
      if (!frameDoc) return;

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <title>Label_QR_${showQrModal.tag_number || showQrModal.id_aset}</title>
            <meta charset="utf-8" />
            <meta name="viewport" content="width=device-width, initial-scale=1.0" />
            <style>
              * {
                box-sizing: border-box;
                margin: 0;
                padding: 0;
                -webkit-print-color-adjust: exact !important;
                print-color-adjust: exact !important;
                color-adjust: exact !important;
              }

              @page {
                size: ${widthMm}mm ${heightMm}mm;
                margin: 0;
              }

              html, body {
                width: 100%;
                height: 100%;
                margin: 0 !important;
                padding: 0 !important;
                background-color: #ffffff;
                display: flex;
                align-items: center;
                justify-content: center;
              }

              .label-print-wrap {
                width: ${widthMm}mm;
                height: ${heightMm}mm;
                display: flex;
                align-items: center;
                justify-content: center;
                overflow: hidden;
                margin: 0;
                padding: 0;
                border: none !important;
                box-shadow: none !important;
              }

              .label-print-wrap img {
                width: 100%;
                height: 100%;
                object-fit: contain;
                display: block;
                border: none !important;
                outline: none !important;
              }

              @media print {
                @page {
                  size: ${widthMm}mm ${heightMm}mm;
                  margin: 0;
                }
                body {
                  margin: 0 !important;
                  padding: 0 !important;
                }
                .label-print-wrap {
                  border: none !important;
                  box-shadow: none !important;
                  outline: none !important;
                }
              }
            </style>
          </head>
          <body>
            <div class="label-print-wrap">
              <img src="${imgSrc}" alt="Label QR Stiker" />
            </div>
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.focus();
                  window.print();
                }, 250);
              };
            </script>
          </body>
        </html>
      `;

      frameDoc.open();
      frameDoc.write(htmlContent);
      frameDoc.close();
    } catch (err) {
      console.error('Failed to print QR label:', err);
    }
  };

  // Helper to load image safely
  const loadImageAsync = (src: string): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  };

  // Reusable High-DPI Canvas Rendering Engine for Roll Label Printing
  const renderAssetLabelCanvas = async (params: {
    asset: Aset;
    qrDataUrl: string;
    dims: ReturnType<typeof getLabelDimensions>;
    includeLogo: boolean;
    includeName: boolean;
    includeNumbers: boolean;
    includePic: boolean;
    logoImg?: HTMLImageElement | null;
  }): Promise<HTMLCanvasElement> => {
    const { asset, qrDataUrl, dims, includeLogo, includeName, includeNumbers, includePic, logoImg } = params;
    const scale = 4; // 4x supersampling for crisp barcode & text (300+ DPI equivalent)
    const canvas = document.createElement('canvas');
    canvas.width = dims.previewWidth * scale;
    canvas.height = dims.previewHeight * scale;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Could not get canvas context');

    const w = canvas.width;
    const h = canvas.height;
    const padding = dims.paddingPx * scale;
    const gap = dims.gapPx * scale;

    // Background (Clean borderless sticker layout)
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    // Note: Outer card border is omitted so thermal roll stickers and sheet cutouts have 100% precision without misaligned borders.
    const qrImg = await loadImageAsync(qrDataUrl);
    let currentY = padding;
    const centerX = w / 2;

    // 1. Logo Header
    if (includeLogo) {
      const logoH = dims.logoHeightPx * scale;
      const fontHeaderSize = dims.fontSizeHeaderPx * scale;
      ctx.font = `900 ${fontHeaderSize}px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#002B66';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';

      const textStr = 'SUCOFINDO';
      const textWidth = ctx.measureText(textStr).width;
      const logoSpacing = 4 * scale;
      let logoW = 0;
      if (logoImg && logoImg.naturalWidth && logoImg.naturalHeight) {
        logoW = (logoImg.naturalWidth / logoImg.naturalHeight) * logoH;
      }

      const totalHeaderW = logoW + (logoW > 0 ? logoSpacing : 0) + textWidth;
      const startX = Math.max(padding, centerX - totalHeaderW / 2);

      if (logoImg && logoW > 0) {
        ctx.drawImage(logoImg, startX, currentY, logoW, logoH);
      }
      ctx.fillText(textStr, startX + logoW + (logoW > 0 ? logoSpacing : 0), currentY + logoH / 2);
      currentY += logoH + gap;
    }

    // 2. QR Code Image (Borderless - content only)
    const qrSize = dims.qrSizePreviewPx * scale;
    if (qrImg) {
      const qrX = centerX - qrSize / 2;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(qrX, currentY, qrSize, qrSize);
      ctx.drawImage(qrImg, qrX, currentY, qrSize, qrSize);
      currentY += qrSize + gap;
    }

    // 3. QR Code String
    const qrFontSize = dims.fontSizeQrCodePx * scale;
    ctx.font = `900 ${qrFontSize}px monospace`;
    ctx.fillStyle = '#002B66';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(asset.qr_code || asset.tag_number || asset.id_aset || '', centerX, currentY);
    currentY += qrFontSize * 1.1 + gap;

    // 4. Asset Name
    if (includeName && asset.nama) {
      const nameFontSize = dims.fontSizeNamePx * scale;
      ctx.font = `800 ${nameFontSize}px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#0f172a';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const maxTextW = w - padding * 2;
      const words = asset.nama.split(' ');
      let line = '';
      const lines: string[] = [];

      for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);
        if (metrics.width > maxTextW && n > 0) {
          lines.push(line.trim());
          line = words[n] + ' ';
          if (lines.length === 2) break;
        } else {
          line = testLine;
        }
      }
      if (lines.length < 2 && line.trim()) {
        lines.push(line.trim());
      }

      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], centerX, currentY);
        currentY += nameFontSize * 1.15;
      }
      currentY += gap;
    }

    // 5. Numbers Info (Tag / Asset)
    if (includeNumbers && (asset.tag_number || asset.asset_number || asset.id_aset)) {
      const numFontSize = dims.fontSizeNumbersPx * scale;
      ctx.font = `700 ${numFontSize}px monospace`;
      
      const numLines: string[] = [];
      if (asset.tag_number) numLines.push(`Tag: ${asset.tag_number}`);
      if (asset.asset_number) numLines.push(`Asset: ${asset.asset_number}`);
      else if (asset.id_aset) numLines.push(`Asset: ${asset.id_aset}`);

      if (numLines.length > 0) {
        const pillPadX = 6 * scale;
        const pillPadY = 2 * scale;
        const lineHeight = numFontSize * 1.15;
        const totalTextH = numLines.length * lineHeight;
        
        let maxW = 0;
        numLines.forEach(l => {
          const mw = ctx.measureText(l).width;
          if (mw > maxW) maxW = mw;
        });

        const pillW = Math.min(w - padding * 2, maxW + pillPadX * 2);
        const pillH = totalTextH + pillPadY * 2;
        const pillX = centerX - pillW / 2;
        const pillY = currentY;

        ctx.fillStyle = '#f1f5f9';
        ctx.fillRect(pillX, pillY, pillW, pillH);

        ctx.fillStyle = '#002B66';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        numLines.forEach((l, idx) => {
          ctx.fillText(l, centerX, pillY + pillPadY + idx * lineHeight);
        });

        currentY += pillH + gap;
      }
    }

    // 6. PIC Info
    if (includePic && (asset.nama_bidang_sekarang || asset.nama_pic_sekarang)) {
      const picFontSize = dims.fontSizePicPx * scale;
      ctx.font = `600 ${picFontSize}px "Plus Jakarta Sans", system-ui, -apple-system, sans-serif`;
      ctx.fillStyle = '#475569';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'top';

      const picText = `${asset.nama_bidang_sekarang ? `Bidang: ${asset.nama_bidang_sekarang}` : ''}${asset.nama_pic_sekarang ? ` | PIC: ${asset.nama_pic_sekarang}` : ''}`;
      
      let truncated = picText;
      while (ctx.measureText(truncated).width > (w - padding * 2) && truncated.length > 5) {
        truncated = truncated.slice(0, -4) + '...';
      }

      ctx.fillText(truncated, centerX, currentY);
    }

    return canvas;
  };

  // Dedicated PDF Download Function for Single Asset
  const handleDownloadPdf = async () => {
    if (!showQrModal || !qrDataUrl || isDownloadingPdf) return;

    try {
      setIsDownloadingPdf(true);
      const dims = getLabelDimensions(labelSizePreset, customWidthCm, customHeightCm);
      const widthMm = dims.widthCm * 10;
      const heightMm = dims.heightCm * 10;
      const orientation = widthMm >= heightMm ? 'landscape' : 'portrait';

      let logoImg: HTMLImageElement | null = null;
      if (includeLogo) {
        logoImg = await loadImageAsync('https://i.ibb.co.com/xKsyxsWX/logo-sucofindo.png');
      }

      const canvas = await renderAssetLabelCanvas({
        asset: showQrModal,
        qrDataUrl,
        dims,
        includeLogo,
        includeName,
        includeNumbers,
        includePic,
        logoImg
      });

      const imgData = canvas.toDataURL('image/png', 1.0);
      const pdf = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: [widthMm, heightMm]
      });

      pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');
      
      const fileId = showQrModal.tag_number || showQrModal.id_aset;
      const fileName = `Label_QR_${fileId}_${dims.widthCm}x${dims.heightCm}cm.pdf`;
      pdf.save(fileName);
    } catch (error) {
      console.error('Error generating PDF label:', error);
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  // Selection Mode Handlers (Concept A)
  const selectedAssets = useMemo(() => {
    const set = new Set(selectedAssetIds);
    // Base list preserves the exact order shown in the sorted/filtered table
    const list = sortedAsets.filter(a => set.has(a.id_aset));

    if (batchSortOrder === 'tag_asc') {
      return [...list].sort((a, b) => (a.tag_number || '').localeCompare(b.tag_number || '', undefined, { numeric: true, sensitivity: 'base' }));
    } else if (batchSortOrder === 'asset_asc') {
      return [...list].sort((a, b) => (a.asset_number || a.id_aset || '').localeCompare(b.asset_number || b.id_aset || '', undefined, { numeric: true, sensitivity: 'base' }));
    } else if (batchSortOrder === 'name_asc') {
      return [...list].sort((a, b) => (a.nama || '').localeCompare(b.nama || '', undefined, { numeric: true, sensitivity: 'base' }));
    } else if (batchSortOrder === 'id_asc') {
      return [...list].sort((a, b) => (a.id_aset || '').localeCompare(b.id_aset || '', undefined, { numeric: true, sensitivity: 'base' }));
    }

    return list;
  }, [sortedAsets, selectedAssetIds, batchSortOrder]);

  const isAllCurrentPageSelected = useMemo(() => {
    if (paginatedAsets.length === 0) return false;
    const set = new Set(selectedAssetIds);
    return paginatedAsets.every(a => set.has(a.id_aset));
  }, [paginatedAsets, selectedAssetIds]);

  const toggleSelectAsset = (id: string) => {
    setSelectedAssetIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllVisible = () => {
    const visibleIds = paginatedAsets.map(a => a.id_aset);
    if (isAllCurrentPageSelected) {
      setSelectedAssetIds(prev => prev.filter(id => !visibleIds.includes(id)));
    } else {
      setSelectedAssetIds(prev => Array.from(new Set([...prev, ...visibleIds])));
    }
  };

  const selectAllFiltered = () => {
    const filteredIds = filteredAsets.map(a => a.id_aset);
    setSelectedAssetIds(Array.from(new Set([...selectedAssetIds, ...filteredIds])));
  };

  const clearSelection = () => {
    setSelectedAssetIds([]);
  };

  const toggleSelectionMode = () => {
    if (isSelectionMode) {
      setIsSelectionMode(false);
      setSelectedAssetIds([]);
    } else {
      setIsSelectionMode(true);
    }
  };

  // Preview QR generator for Batch Modal
  useEffect(() => {
    if (showBatchModal && selectedAssets.length > 0) {
      const activeAsset = selectedAssets[batchPreviewIndex] || selectedAssets[0];
      if (activeAsset) {
        QRCode.toDataURL(activeAsset.qr_code || activeAsset.tag_number || activeAsset.id_aset, {
          width: 320,
          margin: 1,
          errorCorrectionLevel: 'H',
          color: { dark: '#002B66', light: '#ffffff' }
        }).then(url => setBatchPreviewQrUrl(url)).catch(() => {});
      }
    }
  }, [showBatchModal, batchPreviewIndex, selectedAssets]);

  // Batch Multi-Page PDF Download for Thermal Roll Stickers (Each page = 1 sticker)
  const handleBatchDownloadPdf = async () => {
    if (selectedAssets.length === 0 || isGeneratingBatchPdf) return;

    try {
      setIsGeneratingBatchPdf(true);
      const dims = getLabelDimensions(batchLabelPreset, batchCustomWidthCm, batchCustomHeightCm);
      const widthMm = dims.widthCm * 10;
      const heightMm = dims.heightCm * 10;
      const orientation = widthMm >= heightMm ? 'landscape' : 'portrait';

      setBatchProgress({ current: 0, total: selectedAssets.length, stage: 'Memuat aset dan logo...' });

      let logoImg: HTMLImageElement | null = null;
      if (batchIncludeLogo) {
        logoImg = await loadImageAsync('https://i.ibb.co.com/xKsyxsWX/logo-sucofindo.png');
      }

      const pdf = new jsPDF({
        orientation: orientation,
        unit: 'mm',
        format: [widthMm, heightMm]
      });

      for (let i = 0; i < selectedAssets.length; i++) {
        const asset = selectedAssets[i];
        setBatchProgress({
          current: i + 1,
          total: selectedAssets.length,
          stage: `Memproses label ${i + 1} dari ${selectedAssets.length} (${asset.tag_number || asset.id_aset})...`
        });

        const qrData = await QRCode.toDataURL(asset.qr_code || asset.tag_number || asset.id_aset, {
          width: 360,
          margin: 1,
          errorCorrectionLevel: 'H',
          color: { dark: '#002B66', light: '#ffffff' }
        });

        const canvas = await renderAssetLabelCanvas({
          asset,
          qrDataUrl: qrData,
          dims,
          includeLogo: batchIncludeLogo,
          includeName: batchIncludeName,
          includeNumbers: batchIncludeNumbers,
          includePic: batchIncludePic,
          logoImg
        });

        const imgData = canvas.toDataURL('image/png', 1.0);

        if (i > 0) {
          pdf.addPage([widthMm, heightMm], orientation);
        }

        pdf.addImage(imgData, 'PNG', 0, 0, widthMm, heightMm, undefined, 'FAST');
      }

      const fileName = `Batch_Stiker_Roll_${selectedAssets.length}_Aset_${dims.widthCm}x${dims.heightCm}cm.pdf`;
      pdf.save(fileName);
      setBatchProgress({ current: selectedAssets.length, total: selectedAssets.length, stage: 'Selesai!' });
      setTimeout(() => {
        setIsGeneratingBatchPdf(false);
      }, 500);
    } catch (error) {
      console.error('Error generating batch PDF:', error);
      setIsGeneratingBatchPdf(false);
    }
  };

  // Batch Direct Print to Thermal Roll Spooler via Invisible Iframe
  const handleBatchPrintDirect = async () => {
    if (selectedAssets.length === 0 || isGeneratingBatchPdf) return;

    try {
      setIsGeneratingBatchPdf(true);
      const dims = getLabelDimensions(batchLabelPreset, batchCustomWidthCm, batchCustomHeightCm);
      const widthMm = dims.widthCm * 10;
      const heightMm = dims.heightCm * 10;

      let logoImg: HTMLImageElement | null = null;
      if (batchIncludeLogo) {
        logoImg = await loadImageAsync('https://i.ibb.co.com/xKsyxsWX/logo-sucofindo.png');
      }

      const imgDataList: string[] = [];

      for (let i = 0; i < selectedAssets.length; i++) {
        const asset = selectedAssets[i];
        setBatchProgress({
          current: i + 1,
          total: selectedAssets.length,
          stage: `Menyiapkan cetak roll ${i + 1}/${selectedAssets.length}...`
        });

        const qrData = await QRCode.toDataURL(asset.qr_code || asset.tag_number || asset.id_aset, {
          width: 360,
          margin: 1,
          errorCorrectionLevel: 'H',
          color: { dark: '#002B66', light: '#ffffff' }
        });

        const canvas = await renderAssetLabelCanvas({
          asset,
          qrDataUrl: qrData,
          dims,
          includeLogo: batchIncludeLogo,
          includeName: batchIncludeName,
          includeNumbers: batchIncludeNumbers,
          includePic: batchIncludePic,
          logoImg
        });

        imgDataList.push(canvas.toDataURL('image/png', 1.0));
      }

      // Create hidden iframe for direct multi-page continuous roll printing
      let printFrame = document.getElementById('batch-print-iframe') as HTMLIFrameElement;
      if (!printFrame) {
        printFrame = document.createElement('iframe');
        printFrame.id = 'batch-print-iframe';
        printFrame.style.position = 'fixed';
        printFrame.style.right = '0';
        printFrame.style.bottom = '0';
        printFrame.style.width = '0';
        printFrame.style.height = '0';
        printFrame.style.border = '0';
        document.body.appendChild(printFrame);
      }

      const frameDoc = printFrame.contentWindow?.document || printFrame.contentDocument;
      if (!frameDoc) throw new Error('Cannot access print iframe');

      const pagesHtml = imgDataList.map((imgSrc, idx) => `
        <div class="roll-label-page" style="page-break-after: always; width: ${widthMm}mm; height: ${heightMm}mm; display: flex; align-items: center; justify-content: center; overflow: hidden; margin: 0; padding: 0;">
          <img src="${imgSrc}" style="width: 100%; height: 100%; object-fit: contain; display: block;" alt="Label ${idx + 1}" />
        </div>
      `).join('');

      const htmlContent = `
        <!DOCTYPE html>
        <html>
          <head>
            <meta charset="utf-8" />
            <title>Cetak Batch Roll Stiker (${selectedAssets.length} Label)</title>
            <style>
              @page {
                size: ${widthMm}mm ${heightMm}mm;
                margin: 0;
              }
              html, body {
                margin: 0 !important;
                padding: 0 !important;
                background-color: #ffffff;
                width: 100%;
                height: 100%;
              }
              .roll-label-page {
                page-break-after: always;
                break-after: page;
                margin: 0;
                padding: 0;
                box-sizing: border-box;
              }
              .roll-label-page:last-child {
                page-break-after: auto;
                break-after: auto;
              }
            </style>
          </head>
          <body>
            ${pagesHtml}
            <script>
              window.onload = function() {
                setTimeout(function() {
                  window.focus();
                  window.print();
                }, 300);
              };
            </script>
          </body>
        </html>
      `;

      frameDoc.open();
      frameDoc.write(htmlContent);
      frameDoc.close();

      setIsGeneratingBatchPdf(false);
    } catch (error) {
      console.error('Error direct batch printing:', error);
      setIsGeneratingBatchPdf(false);
    }
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isPuma = currentUser.role === 'puma';

    if (isPuma && !newAsset.id_cabang) {
      alert('Silakan pilih Cabang / SBU Tujuan terlebih dahulu.');
      return;
    }

    if (isPuma) {
      const np = Number(newAsset.nilai_perolehan);
      if (!np || isNaN(np) || np <= 0) {
        alert('Nilai Perolehan (Rp) wajib diisi untuk aset investasi PUMA dan harus berupa angka lebih dari 0.');
        return;
      }
    }

    setShowAddConfirmModal(true);
  };

  const handleConfirmCreateAsset = () => {
    const isPuma = currentUser.role === 'puma';
    const targetCabangId = isPuma ? (newAsset.id_cabang || cabangList[0]?.id_cabang || '') : (currentUser.id_cabang || cabangList[0]?.id_cabang || '');
    const targetCabang = cabangList.find(c => c.id_cabang === targetCabangId);

    const fungsiUmumBidang = bidangList.find(b => 
      b.id_cabang === targetCabangId && 
      (b.id_bidang === 'BDG-01' || b.nama_bidang.toLowerCase().includes('dukungan bisnis'))
    ) || bidangList.find(b => b.id_cabang === targetCabangId) || bidangList[0];

    const selectedPicId = newAsset.id_pic || fungsiUmumUsers[0]?.id || '';
    const selectedPicUser = userList.find(u => u.id === selectedPicId) || fungsiUmumUsers[0];
    const parsedNilai = newAsset.nilai_perolehan ? Math.round(Number(newAsset.nilai_perolehan)) : undefined;

    onCreateAsset({
      ...newAsset,
      id_cabang: targetCabangId,
      nama_cabang: targetCabang?.nama_cabang || '',
      sumber_aset: isPuma ? 'PUMA' : 'Cabang',
      jenis_pengadaan: isPuma ? 'Investasi' : 'Project Cabang',
      status_penerimaan: isPuma ? 'Menunggu Penerimaan' : 'Diterima',
      basis_operasi: newAsset.basis_operasi || 'Working Day Based',
      id_bidang: selectedPicUser?.id_bidang || fungsiUmumBidang?.id_bidang || 'BDG-01',
      id_pic: selectedPicId,
      nama_pic_sekarang: selectedPicUser?.nama || '',
      nama_pemegang_terakhir: selectedPicUser?.nama || '',
      nilai_perolehan: parsedNilai,
      actorName: currentUser.nama,
      actorRole: currentUser.role
    });

    setShowAddConfirmModal(false);
    setShowAddModal(false);
    setNewAsset({
      nama: '',
      kategori: 'Peralatan Operasi',
      asset_number: '',
      tag_number: '',
      id_cabang: currentUser.role === 'puma' ? (cabangList[0]?.id_cabang || '') : (currentUser.id_cabang || cabangList[0]?.id_cabang || ''),
      basis_operasi: 'Working Day Based',
      sumber_aset: (currentUser.role === 'puma' ? 'PUMA' : 'Cabang'),
      tgl_perolehan: new Date().toISOString().split('T')[0],
      spesifikasi: '',
      merk_model: '',
      nomor_seri: '',
      lokasi_awal: '',
      id_pic: '',
      tgl_kalibrasi_terakhir: '',
      tgl_kalibrasi_berikutnya: '',
      sertifikat_kalibrasi_no: '',
      status: 'Tersedia',
      kondisi: 'Baik',
      nilai_perolehan: ''
    });
  };

  const handleBidangTujuanChange = (newBidangId: string) => {
    setIdBidangTujuan(newBidangId);
    const matchingPic = userList.find(u => u.id_bidang === newBidangId && u.role === 'pic_bidang') ||
                        userList.find(u => u.id_bidang === newBidangId) ||
                        userList[0];
    if (matchingPic) {
      setIdPicTujuan(matchingPic.id);
    }
  };

  const handlePicTujuanChange = (newPicId: string) => {
    setIdPicTujuan(newPicId);
    const selectedUser = userList.find(u => u.id === newPicId);
    if (selectedUser && selectedUser.id_bidang) {
      const matchingBidang = bidangList.find(b => b.id_bidang === selectedUser.id_bidang);
      if (matchingBidang) {
        setIdBidangTujuan(matchingBidang.id_bidang);
      }
    }
  };

  const handleOpenTransferModal = (asset?: Aset) => {
    const target = asset || filteredAsets[0] || asets[0];
    setTransferAsset(target || null);
    setTransferJenis('Transfer');
    setPemegangBaruInput('');
    setAlasanTransfer('');
    setTransferSuccessMsg('');

    // Synchronize initial target bidang and PIC
    const currentBidangId = target?.id_bidang_sekarang;
    const initialTargetBidang = bidangList.find(b => b.id_bidang !== currentBidangId) || bidangList[0];
    if (initialTargetBidang) {
      setIdBidangTujuan(initialTargetBidang.id_bidang);
      const picInTarget = userList.find(u => u.id_bidang === initialTargetBidang.id_bidang && u.role === 'pic_bidang') ||
                          userList.find(u => u.id_bidang === initialTargetBidang.id_bidang) ||
                          userList[0];
      if (picInTarget) {
        setIdPicTujuan(picInTarget.id);
      }
    }

    setTransferSuccessMsg('');
    setTransferErrorMsg('');
    setTglRencanaPengembalianInput('');
    setTransferFotoPengembalian('');
    setTransferLokasiPengembalian(target?.lokasi_sekarang || '');
    setTransferLokasiGps(null);
    setShowTransferModal(true);
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferAsset || !onSubmitRequest) return;
    if (transferJenis === 'Pengajuan Pemakaian' && !tglRencanaPengembalianInput) {
      setTransferErrorMsg('Tanggal Rencana Pengembalian wajib diisi.');
      return;
    }
    if (transferJenis === 'Pengembalian Aset (Selesai Pakai)') {
      if (!transferFotoPengembalian) {
        setTransferErrorMsg('Foto fisik barang wajib diambil/dilampirkan sebagai bukti aset kembali ke status Tersedia.');
        return;
      }
      if (!transferLokasiGps) {
        setTransferErrorMsg('Akses titik lokasi (GPS) pengembalian wajib diambil.');
        return;
      }
    }
    setIsSubmittingTransfer(true);
    setTransferErrorMsg('');
    try {
      await onSubmitRequest({
        id_aset: transferAsset.id_aset,
        jenis: transferJenis,
        id_bidang_tujuan: transferJenis === 'Transfer' ? idBidangTujuan : undefined,
        id_pic_tujuan: transferJenis === 'Transfer' ? idPicTujuan : undefined,
        pemegang_baru: pemegangBaruInput.trim() || currentUser.nama,
        tgl_rencana_pengembalian: tglRencanaPengembalianInput,
        alasan: alasanTransfer || (transferJenis === 'Pengembalian Aset (Selesai Pakai)' ? 'Pengembalian aset selesai digunakan ke status Tersedia.' : ''),
        pemohon_id: currentUser.id,
        pemohon_nama: currentUser.nama,
        pemohon_role: currentUser.role,
        foto_pengembalian: transferJenis === 'Pengembalian Aset (Selesai Pakai)' ? transferFotoPengembalian : undefined,
        lokasi_pengembalian: transferJenis === 'Pengembalian Aset (Selesai Pakai)' ? (transferLokasiPengembalian || 'Gudang / Workshop') : undefined,
        koordinat_gps: transferJenis === 'Pengembalian Aset (Selesai Pakai)' ? (transferLokasiGps || undefined) : undefined,
        status_baru: transferJenis === 'Pengembalian Aset (Selesai Pakai)' ? 'Tersedia' : undefined,
        kondisi_baru: transferJenis === 'Pengembalian Aset (Selesai Pakai)' ? 'Baik' : undefined
      });
      setIsSubmittingTransfer(false);
      setTransferSuccessMsg('Pengajuan berhasil dikirim! Status persetujuan dapat dipantau di menu Approval Workflow.');
      setTimeout(() => {
        setShowTransferModal(false);
        setTransferSuccessMsg('');
      }, 1800);
    } catch (err: any) {
      console.error(err);
      setIsSubmittingTransfer(false);
      setTransferErrorMsg(err?.message || 'Gagal mengirim pengajuan.');
    }
  };

  return (
    <div className="space-y-5">
      
      {/* Header Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <Package className="w-5 h-5 text-[#005DAA]" />
            <span>Master Data & Assignment Aset Operasional</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Kelola data aset, penetapan PIC & penyerahan (assignment), serta pengajuan transfer antar bidang atau disposal.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Toggle Mode Seleksi Stiker Roll (Opsi A) */}
          <button
            onClick={toggleSelectionMode}
            className={`px-3 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-all cursor-pointer ${
              isSelectionMode
                ? 'bg-indigo-700 hover:bg-indigo-800 text-white ring-2 ring-indigo-300 ring-offset-1'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
            title="Aktifkan mode seleksi checkbox untuk mencetak label stiker roll 4x6"
          >
            <CheckSquare className="w-4 h-4 text-indigo-200" />
            <span>{isSelectionMode ? 'Tutup Mode Cetak Roll' : 'Mode Cetak Stiker Roll'}</span>
          </button>

          <button
            onClick={onOpenScanner}
            className="bg-sky-600 hover:bg-sky-700 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors"
            title="Scan QR Code / Pemutakhiran Status Mandiri Lapangan"
          >
            <QrCode className="w-4 h-4 text-sky-200" />
            <span>Scan QR / Update Cepat</span>
          </button>

          {onSubmitRequest && (
            <button
              onClick={() => handleOpenTransferModal()}
              className="bg-amber-600 hover:bg-amber-700 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors"
              title="Ajukan Transfer Aset Antar Bidang / Disposal"
            >
              <ArrowRightLeft className="w-4 h-4" />
              <span>Ajukan Transfer / Disposal</span>
            </button>
          )}

          <button
            onClick={handleExportExcel}
            className="bg-[#008C45] hover:bg-[#007037] text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors"
            title="Download Data Aset dalam Format Excel (.xlsx)"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Download Excel (.xlsx)</span>
          </button>

          <button
            onClick={onExportCsv}
            className="bg-slate-700 hover:bg-slate-800 text-white px-3 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors"
            title="Download Laporan CSV"
          >
            <Download className="w-4 h-4" />
            <span>CSV</span>
          </button>

          {(currentUser.role === 'admin' || currentUser.role === 'puma') && (
            <button
              onClick={() => setShowAddModal(true)}
              className="bg-[#005DAA] hover:bg-blue-800 text-white px-3.5 py-2 rounded-lg text-xs font-bold flex items-center space-x-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4 text-emerald-300" />
              <span>{currentUser.role === 'puma' ? 'Input Aset Investasi PUMA' : 'Input Aset Project Cabang'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Banner Konfirmasi Penerimaan Aset Investasi PUMA Pusat di Cabang */}
      {incomingPumaAsets.length > 0 && (
        <div className="bg-gradient-to-r from-amber-500/10 via-amber-50 to-orange-50 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 shadow-sm space-y-3.5">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-amber-200/80 pb-3">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shadow-sm shrink-0">
                <Inbox className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-extrabold text-amber-950 text-sm sm:text-base flex items-center gap-2">
                  <span>Penerimaan Aset Investasi dari PUMA Pusat</span>
                  <span className="bg-amber-500 text-white text-[11px] font-black px-2.5 py-0.5 rounded-full shadow-xs">
                    {incomingPumaAsets.length} Aset Menunggu Diterima
                  </span>
                </h3>
                <p className="text-xs text-amber-900/80 mt-0.5">
                  Aset di bawah telah dialokasikan oleh Staff PUMA Pusat ke cabang ini. Personel cabang (Fungsi UMUM atau Kabid Dukbis) dapat langsung mengonfirmasi penerimaan fisik agar aset otomatis tercatat aktif di inventaris cabang.
                </p>
              </div>
            </div>
          </div>

          {confirmSuccessMsg && (
            <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-xl text-xs font-bold text-emerald-900 flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
              <span>{confirmSuccessMsg}</span>
            </div>
          )}

          {confirmErrorMsg && (
            <div className="p-3 bg-rose-100 border border-rose-300 rounded-xl text-xs font-bold text-rose-900 flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 text-rose-700 shrink-0" />
              <span>{confirmErrorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {incomingPumaAsets.map((aset) => (
              <div key={aset.id_aset} className="bg-white p-3.5 rounded-xl border border-amber-200 shadow-xs flex flex-col justify-between space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="font-mono font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded">
                      {aset.id_aset}
                    </span>
                    <span className="text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
                      👑 Investasi PUMA
                    </span>
                  </div>
                  <h4 className="font-bold text-slate-900 text-xs line-clamp-1">{aset.nama}</h4>
                  <div className="text-[11px] text-slate-500">
                    Kategori: <strong className="text-slate-700">{aset.kategori}</strong>
                  </div>
                  {(aset.asset_number || aset.tag_number) && (
                    <div className="text-[10px] font-mono text-slate-600 bg-slate-50 p-1.5 rounded space-y-0.5">
                      {aset.asset_number && <div>No. Aset: <strong>{aset.asset_number}</strong></div>}
                      {aset.tag_number && <div>Tag No: <strong>{aset.tag_number}</strong></div>}
                    </div>
                  )}
                  <div className="text-[10px] text-slate-500">
                    Basis Operasi: <strong className="text-slate-700">{aset.basis_operasi || 'Working Day Based'}</strong>
                  </div>
                  <div className="text-[11px] text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200 font-semibold">
                    Nilai Perolehan: <span className="font-mono font-bold">{aset.nilai_perolehan ? `Rp ${Math.round(aset.nilai_perolehan).toLocaleString('id-ID')}` : '-'}</span>
                  </div>
                </div>

                <button
                  type="button"
                  disabled={confirmingAssetId === aset.id_aset}
                  onClick={() => handleOpenReceiptModal(aset)}
                  className="w-full bg-[#008C45] hover:bg-[#007037] disabled:opacity-50 text-white font-bold text-xs py-2 px-3 rounded-lg flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4 text-emerald-200" />
                  <span>Konfirmasi Barang Diterima di Cabang</span>
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Role Access Notice for PIC */}
      {currentUser.role !== 'admin' && currentUser.role !== 'pimpinan' && currentUser.role !== 'puma' && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-center justify-between text-amber-900 text-xs">
          <div className="flex items-center space-x-2">
            <span className="font-bold bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md text-[10px] uppercase">Akses PIC Terbatas</span>
            <span>
              Menampilkan <strong>{filteredAsets.length}</strong> aset yang menjadi kewenangan Anda di <strong>{currentUser.nama_bidang || currentUser.bidang}</strong>.
            </span>
          </div>
          <span className="text-[10px] text-amber-700 italic hidden sm:inline">
            Akses penuh seluruh cabang dimiliki oleh Pimpinan & Fungsi Umum.
          </span>
        </div>
      )}

      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 lg:grid-cols-9 gap-2.5 text-xs">
          
          {/* Search */}
          <div className="relative sm:col-span-2">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari ID, Asset No, Tag No, Nama, Seri, QR..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#002B66] focus:border-transparent outline-hidden"
            />
          </div>

          {/* Sumber Aset Filter */}
          <div>
            <select
              value={selectedSumberAset}
              onChange={(e) => setSelectedSumberAset(e.target.value as any)}
              className="w-full py-2 px-2.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-700 outline-hidden focus:ring-2 focus:ring-[#002B66] font-semibold"
            >
              <option value="All">Semua Sumber</option>
              <option value="PUMA">👑 Investasi PUMA</option>
              <option value="Cabang">🏢 Project Cabang</option>
            </select>
          </div>

          {/* Filter Asset Number */}
          <div>
            <input
              type="text"
              placeholder="Filter Asset No..."
              value={filterAssetNumber}
              onChange={(e) => setFilterAssetNumber(e.target.value)}
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#002B66] focus:border-transparent outline-hidden"
            />
          </div>

          {/* Filter Tag Number */}
          <div>
            <input
              type="text"
              placeholder="Filter Tag No..."
              value={filterTagNumber}
              onChange={(e) => setFilterTagNumber(e.target.value)}
              className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-[#002B66] focus:border-transparent outline-hidden"
            />
          </div>

          {/* Bidang Filter */}
          <div>
            <select
              value={selectedBidang}
              onChange={(e) => setSelectedBidang(e.target.value)}
              className="w-full py-2 px-2.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-700 outline-hidden focus:ring-2 focus:ring-[#002B66]"
            >
              <option value="All">Semua Bidang & Unit</option>
              {bidangList.map((b) => (
                <option key={b.id_bidang} value={b.id_bidang}>
                  {b.nama_bidang}
                </option>
              ))}
            </select>
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="w-full py-2 px-2.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-700 outline-hidden focus:ring-2 focus:ring-[#002B66]"
            >
              <option value="All">Semua Kategori</option>
              {categories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="w-full py-2 px-2.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-700 outline-hidden focus:ring-2 focus:ring-[#002B66]"
            >
              <option value="All">Semua Status</option>
              {ALL_STATUSES.map((st) => (
                <option key={st} value={st}>{st}</option>
              ))}
              <option value="Terlambat">Terlambat Pengembalian</option>
            </select>
          </div>

          {/* Kondisi Filter */}
          <div>
            <select
              value={selectedKondisi}
              onChange={(e) => setSelectedKondisi(e.target.value)}
              className="w-full py-2 px-2.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-700 outline-hidden focus:ring-2 focus:ring-[#002B66]"
            >
              <option value="All">Semua Kondisi</option>
              {ALL_KONDISI.map((kd) => (
                <option key={kd} value={kd}>{kd}</option>
              ))}
            </select>
          </div>

          {/* Utilisasi Filter */}
          <div>
            <select
              value={selectedUtilisasiFilter}
              onChange={(e) => setSelectedUtilisasiFilter(e.target.value as any)}
              className="w-full py-2 px-2.5 border border-gray-200 rounded-lg text-xs bg-white text-gray-700 outline-hidden focus:ring-2 focus:ring-[#002B66] font-semibold"
            >
              <option value="All">Semua Utilisasi</option>
              <option value="Optimal">Optimal (≥80%)</option>
              <option value="Moderat">Moderat (50-79%)</option>
              <option value="Rendah">Rendah (&lt;50%)</option>
            </select>
          </div>

        </div>
      </div>

      {/* Asset Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
                {isSelectionMode && (
                  <th className="py-3 px-3 w-10 text-center bg-indigo-50/80 border-r border-indigo-100">
                    <button
                      type="button"
                      onClick={toggleSelectAllVisible}
                      className="inline-flex items-center justify-center p-1 rounded-md hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer"
                      title={isAllCurrentPageSelected ? "Batalkan pilih halaman ini" : "Pilih semua aset di halaman ini"}
                    >
                      {isAllCurrentPageSelected ? (
                        <CheckSquare className="w-4 h-4 text-indigo-600" />
                      ) : selectedAssetIds.length > 0 ? (
                        <Square className="w-4 h-4 text-indigo-400 opacity-60" />
                      ) : (
                        <Square className="w-4 h-4 text-gray-400" />
                      )}
                    </button>
                  </th>
                )}
                <th className="py-3 px-4 min-w-[175px] whitespace-nowrap">ID Aset & QR</th>
                <th className="py-3 px-4 min-w-[220px]">Nama Aset & Spesifikasi</th>
                <th className="py-3 px-4 min-w-[160px]">Kategori & Seri</th>
                <th className="py-3 px-4 min-w-[200px]">Bidang & PIC</th>
                <th className="py-3 px-4 min-w-[150px]">Status &amp; Kondisi</th>
                <th className="py-3 px-4 min-w-[145px]">Target Kembali</th>
                <th className="py-3 px-4 min-w-[130px]">Kalibrasi</th>
                <th className="py-3 px-4 min-w-[180px] whitespace-nowrap">Utilisasi Per-Aset</th>
                <th className="py-3 px-4 text-center min-w-[120px]">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {totalItems === 0 ? (
                <tr>
                  <td colSpan={isSelectionMode ? 10 : 9} className="text-center py-12 text-gray-400">
                    Data aset tidak ditemukan sesuai kriteria filter.
                  </td>
                </tr>
              ) : (
                paginatedAsets.map((a, idx) => {
                  const isSelected = selectedAssetIds.includes(a.id_aset);
                  return (
                    <tr
                      key={`${a.id_aset}-${idx}`}
                      className={`transition-colors ${
                        isSelected
                          ? 'bg-indigo-50/70 hover:bg-indigo-50'
                          : 'hover:bg-slate-50/80'
                      }`}
                    >
                      {isSelectionMode && (
                        <td className="py-3 px-3 text-center bg-indigo-50/30 border-r border-indigo-100/60">
                          <button
                            type="button"
                            onClick={() => toggleSelectAsset(a.id_aset)}
                            className="inline-flex items-center justify-center p-1 rounded-md hover:bg-indigo-100 text-indigo-700 transition-colors cursor-pointer"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-indigo-600" />
                            ) : (
                              <Square className="w-4 h-4 text-gray-300 hover:text-indigo-400" />
                            )}
                          </button>
                        </td>
                      )}
                    
                    {/* ID Aset & QR Button */}
                    <td className="py-3 px-4 min-w-[175px]">
                      <button
                        onClick={() => setSelectedHistoryAsset(a)}
                        className="font-bold text-[#002B66] text-left hover:underline flex items-center space-x-1 cursor-pointer hover:text-[#005DAA]"
                        title={currentUser.role === 'admin' ? "Klik untuk lacak history perubahan aset (Fungsi UMUM)" : "Lihat History (Khusus Fungsi UMUM)"}
                      >
                        <span>{a.id_aset}</span>
                        {currentUser.role === 'admin' && (
                          <History className="w-3.5 h-3.5 text-[#005DAA] shrink-0 inline" />
                        )}
                      </button>

                      {/* Sumber Aset & Status Penerimaan Badge */}
                      <div className="flex flex-wrap items-center gap-1 my-1">
                        <span className={`inline-block text-[9px] font-bold px-1.5 py-0.2 rounded border ${
                          a.sumber_aset === 'PUMA'
                            ? 'text-indigo-800 bg-indigo-50 border-indigo-200'
                            : 'text-teal-800 bg-teal-50 border-teal-200'
                        }`}>
                          {a.sumber_aset === 'PUMA' ? '👑 Investasi PUMA' : '🏢 Project Cabang'}
                        </span>
                        {a.status_penerimaan === 'Menunggu Penerimaan' && (
                          <span className="text-[9px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-1 py-0.2 rounded animate-pulse">
                            ⏳ Menunggu Diterima
                          </span>
                        )}
                      </div>

                      {a.asset_number && (
                        <div className="text-[10px] text-slate-600 font-medium">Asset No: {a.asset_number}</div>
                      )}
                      {a.tag_number && (
                        <div className="text-[10px] text-[#005DAA] font-semibold">Tag No: {a.tag_number}</div>
                      )}
                      <button
                        onClick={() => handleOpenQrModal(a)}
                        className="inline-flex items-center space-x-1 text-[10px] text-sky-600 hover:text-sky-800 mt-0.5 font-bold cursor-pointer"
                      >
                        <QrCode className="w-3.5 h-3.5" />
                        <span>Lihat Tag QR</span>
                      </button>
                    </td>

                    {/* Nama Aset & Spesifikasi */}
                    <td className="py-3 px-4 max-w-xs">
                      <button
                        onClick={() => setSelectedHistoryAsset(a)}
                        className="font-bold text-gray-900 truncate text-left hover:underline block max-w-full hover:text-[#005DAA] cursor-pointer"
                        title={currentUser.role === 'admin' ? "Klik untuk lacak history perubahan aset (Fungsi UMUM)" : "Lihat History (Khusus Fungsi UMUM)"}
                      >
                        {a.nama}
                      </button>
                      <div className="text-[11px] text-gray-500 truncate">{a.spesifikasi}</div>
                      <div className="text-[10px] text-gray-400">Lokasi: {a.lokasi_sekarang}</div>
                    </td>

                    {/* Kategori & Model */}
                    <td className="py-3 px-4">
                      <div className="text-gray-800 font-semibold">{a.kategori}</div>
                      <div className="text-[10px] text-gray-500">{a.merk_model}</div>
                      <div className="text-[10px] text-gray-400">SN: {a.nomor_seri}</div>
                      <div className="text-[10px] text-slate-500 font-medium">Perolehan: {a.tgl_perolehan || a.tahun_perolehan || '-'}</div>
                      <div className="text-[10px] text-emerald-700 font-semibold mt-0.5">
                        Nilai: {a.nilai_perolehan ? `Rp ${Math.round(a.nilai_perolehan).toLocaleString('id-ID')}` : '-'}
                      </div>
                      {a.basis_operasi && (
                        <div className="text-[9px] text-indigo-700 bg-indigo-50 border border-indigo-100 rounded px-1 py-0.2 mt-0.5 inline-block font-mono">
                          {a.basis_operasi === 'Continuous Operation' ? '24/7 Ops' : '8h/5d Ops'}
                        </div>
                      )}
                    </td>

                    {/* Bidang & PIC & Pemegang Terakhir */}
                    <td className="py-3 px-4 max-w-[220px]">
                      {a.nama_cabang && (
                        <div className="mb-0.5">
                          <span className="text-[9px] font-bold text-purple-800 bg-purple-50 px-1.5 py-0.2 rounded border border-purple-200 inline-block">
                            {a.nama_cabang}
                          </span>
                        </div>
                      )}
                      <div className="font-semibold text-gray-900 truncate">{a.nama_bidang_sekarang}</div>
                      <div className="text-[10px] text-sky-700 font-medium">PIC Utama: {a.nama_pic_sekarang}</div>
                      <div className="text-[10px] text-emerald-700 font-semibold flex items-center space-x-1 mt-0.5 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200/80 w-fit">
                        <span>Pemegang: {a.nama_pemegang_terakhir || a.nama_pic_sekarang}</span>
                      </div>
                    </td>

                    {/* Status & Kondisi */}
                    <td className="py-3 px-4">
                      <div className="space-y-1">
                        <span className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] ${
                          a.status === 'Digunakan' ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' :
                          a.status === 'Tersedia' ? 'bg-blue-100 text-blue-800 border border-blue-200' :
                          a.status === 'Dalam Pemeliharaan' ? 'bg-amber-100 text-amber-800 border border-amber-200' :
                          a.status === 'Dipinjamkan' ? 'bg-purple-100 text-purple-800 border border-purple-200' :
                          a.status === 'Proses Disposal' ? 'bg-orange-100 text-orange-800 border border-orange-200' :
                          a.status === 'Disposal' ? 'bg-rose-100 text-rose-800 border border-rose-200' :
                          a.status === 'Tidak Tersedia' ? 'bg-slate-200 text-slate-800 border border-slate-300' :
                          'bg-gray-100 text-gray-800 border border-gray-200'
                        }`}>
                          {a.status}
                        </span>

                        <div>
                          <span className={`inline-block text-[10px] font-semibold ${
                            a.kondisi === 'Baik' ? 'text-emerald-700' :
                            a.kondisi === 'Rusak Ringan' ? 'text-amber-700' :
                            a.kondisi === 'Rusak Berat' ? 'text-rose-700' :
                            'text-slate-600'
                          }`}>
                            ● Kondisi: {a.kondisi}
                          </span>
                        </div>

                        <div className="text-[10px] text-slate-500 font-medium pt-1 border-t border-slate-100 mt-1 flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>Update: {
                            a.updated_at
                              ? new Date(a.updated_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                              : (a.created_at ? new Date(a.created_at).toLocaleDateString('id-ID') : '-')
                          }</span>
                        </div>
                      </div>
                    </td>

                    {/* Target Kembali (Kolom Terpisah) */}
                    <td className="py-3 px-4 min-w-[145px]">
                      {a.status === 'Digunakan' && a.tgl_rencana_pengembalian ? (() => {
                        const returnDate = new Date(a.tgl_rencana_pengembalian);
                        const todayMid = new Date();
                        todayMid.setHours(0, 0, 0, 0);
                        returnDate.setHours(0, 0, 0, 0);
                        const diffDays = Math.floor((todayMid.getTime() - returnDate.getTime()) / (1000 * 60 * 60 * 24));
                        const isOverdue = diffDays >= 1;

                        return (
                          <div className="space-y-1">
                            <div className="text-[11px] font-semibold text-gray-800 flex items-center space-x-1">
                              <Calendar className="w-3.5 h-3.5 text-[#005DAA] shrink-0" />
                              <span>{a.tgl_rencana_pengembalian}</span>
                            </div>
                            <div className={`text-[10px] font-bold px-1.5 py-0.5 rounded border inline-block ${
                              isOverdue ? 'bg-red-50 text-red-700 border-red-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            }`}>
                              {isOverdue ? `Terlambat ${diffDays} Hari` : 'Tepat Waktu'}
                            </div>
                          </div>
                        );
                      })() : (
                        <span className="text-gray-400 text-[11px]">-</span>
                      )}
                    </td>

                    {/* Kalibrasi */}
                    <td className="py-3 px-4">
                      {a.tgl_kalibrasi_berikutnya ? (
                        <div>
                          <div className="text-[11px] font-semibold text-gray-800">
                            {a.tgl_kalibrasi_berikutnya}
                          </div>
                          <div className="text-[10px] text-gray-400">
                            Terakhir: {a.tgl_kalibrasi_terakhir || '-'}
                          </div>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-[10px]">N/A</span>
                      )}
                    </td>

                    {/* Utilisasi Per-Aset (Setiap Peralatan Operasi Dihitung Terpisah) */}
                    <td className="py-3 px-4 min-w-[180px]">
                      {(a.kategori === 'Peralatan Operasi' || a.basis_operasi) ? (() => {
                        const rateBulanan = a.utilization?.bulanan?.rate ?? 0;
                        const rateMingguan = a.utilization?.mingguan?.rate ?? 0;
                        const rateAll = a.utilization?.allTime?.rate ?? 0;
                        const actualHours = a.utilization?.bulanan?.actualHours ?? 0;
                        const availHours = a.utilization?.bulanan?.availableHours ?? 0;
                        
                        const colorClass = rateBulanan >= 80 
                          ? 'text-[#008C45] bg-emerald-50 border-emerald-200' 
                          : rateBulanan >= 50 
                            ? 'text-amber-700 bg-amber-50 border-amber-200' 
                            : 'text-rose-700 bg-rose-50 border-rose-200';
                            
                        const barColor = rateBulanan >= 80 ? 'bg-[#008C45]' : rateBulanan >= 50 ? 'bg-amber-500' : 'bg-rose-500';

                        return (
                          <div className="space-y-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedUtilizationAsset(a);
                                setUtilizationModalTab('bulanan');
                              }}
                              className={`w-full text-left p-1.5 rounded-lg border transition-all cursor-pointer hover:shadow-xs ${colorClass}`}
                              title="Klik untuk rincian formula & utilisasi mandiri per-aset ini"
                            >
                              <div className="flex items-center justify-between">
                                <span className="font-extrabold text-[12px] font-mono">
                                  {rateBulanan}%
                                </span>
                                <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-white/80 border border-current">
                                  {rateBulanan >= 80 ? 'Optimal' : rateBulanan >= 50 ? 'Moderat' : 'Rendah'}
                                </span>
                              </div>

                              {/* Progress bar */}
                              <div className="w-full bg-black/10 h-1.5 rounded-full mt-1.5 overflow-hidden">
                                <div 
                                  className={`h-full ${barColor} rounded-full`} 
                                  style={{ width: `${Math.min(100, Math.max(rateBulanan, 3))}%` }}
                                />
                              </div>

                              <div className="text-[10px] text-slate-600 mt-1 flex items-center justify-between font-mono">
                                <span>{actualHours}j / {availHours}j</span>
                                <span className="text-[9px] text-[#005DAA] font-bold hover:underline">Detail ↗</span>
                              </div>
                            </button>

                            <div className="flex items-center justify-between text-[9px] text-slate-500 font-mono px-0.5">
                              <span>Mggu: <strong>{rateMingguan}%</strong></span>
                              <span>•</span>
                              <span>All: <strong>{rateAll}%</strong></span>
                              <span>•</span>
                              <span className="text-slate-700 font-semibold">{a.basis_operasi === 'Continuous Operation' ? '24/7' : '8/5'}</span>
                            </div>
                          </div>
                        );
                      })() : (
                        <div className="text-slate-400 text-[11px] italic">
                          Non-Operasional
                        </div>
                      )}
                    </td>

                    {/* Aksi */}
                    <td className="py-3 px-4 text-center">
                      <div className="flex items-center justify-center space-x-1">
                        {a.status_penerimaan === 'Menunggu Penerimaan' && currentUser.role !== 'puma' && (!currentUser.id_cabang || a.id_cabang === currentUser.id_cabang) && (
                          <button
                            type="button"
                            disabled={confirmingAssetId === a.id_aset}
                            onClick={() => handleOpenReceiptModal(a)}
                            className="px-2 py-1.5 rounded bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white flex items-center space-x-1 text-xs font-bold shadow-xs transition-colors cursor-pointer"
                            title="Konfirmasi bahwa barang pengadaan investasi PUMA ini sudah diterima di cabang"
                          >
                            <Check className="w-3.5 h-3.5" />
                            <span>Terima</span>
                          </button>
                        )}

                        <button
                          onClick={() => onOpenScanner(a)}
                          className="px-2 py-1.5 rounded bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 flex items-center space-x-1 text-xs font-bold transition-colors"
                          title="Buka QR Scanner & Pemutakhiran Status Lapangan"
                        >
                          <QrCode className="w-3.5 h-3.5 text-sky-600" />
                          <span>Scan Barcode</span>
                        </button>

                        {currentUser.role === 'admin' && (
                          <button
                            onClick={() => onAssignAsset(a.id_aset)}
                            className="p-1.5 rounded hover:bg-emerald-100 text-emerald-700"
                            title="Serah Terima / Assign ke Bidang"
                          >
                            <ArrowRightLeft className="w-4 h-4" />
                          </button>
                        )}

                        {onSubmitRequest && (
                          <button
                            onClick={() => handleOpenTransferModal(a)}
                            className="p-1.5 rounded hover:bg-amber-100 text-amber-700"
                            title="Ajukan Transfer Antar Bidang / Disposal"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>

                  </tr>
                );
              })
            )}
            </tbody>
          </table>
        </div>

        <PaginationControls
          currentPage={currentPage}
          totalPages={totalPages}
          pageSize={pageSize}
          totalItems={totalItems}
          onPageChange={setCurrentPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {/* MODAL: Input Aset Baru (PUMA vs Cabang Project) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 overflow-y-auto p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center">
          <div className="bg-white rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl border border-gray-100 my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="shrink-0 flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-base flex items-center space-x-2">
                <Package className="w-5 h-5 text-[#002B66]" />
                <span>
                  {currentUser.role === 'puma' 
                    ? 'Input Aset Investasi PUMA (Pengadaan Pusat)' 
                    : 'Input Aset Project Cabang (Pengadaan Lokal)'}
                </span>
              </h3>
              <button 
                onClick={() => setShowAddModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} className="overflow-y-auto flex-1 min-h-0 space-y-3.5 text-xs py-2 pr-1">

              {/* Cabang / SBU Allocation */}
              {currentUser.role === 'puma' ? (
                <div>
                  <label className="block font-semibold text-gray-800 mb-1">
                    Alokasikan ke Cabang / SBU Tujuan *
                  </label>
                  <select
                    required
                    value={newAsset.id_cabang}
                    onChange={(e) => {
                      const chosenCabangId = e.target.value;
                      const targetCab = cabangList.find(c => c.id_cabang === chosenCabangId) || null;
                      const branchUsers = userList.filter(u => isUserInBranch(u, chosenCabangId, targetCab));
                      const branchFungsiUmum = branchUsers.filter(isUserFungsiUmum);
                      const nextPic = branchFungsiUmum[0]?.id || branchUsers[0]?.id || '';
                      setNewAsset(prev => ({
                        ...prev,
                        id_cabang: chosenCabangId,
                        id_pic: nextPic
                      }));
                    }}
                    className="w-full p-2.5 border border-indigo-300 bg-indigo-50/40 rounded-lg outline-hidden focus:ring-2 focus:ring-indigo-600 font-bold text-gray-900"
                  >
                    <option value="">-- Pilih Cabang / SBU Tujuan --</option>
                    {cabangList.map((c) => (
                      <option key={c.id_cabang} value={c.id_cabang}>
                        {c.nama_cabang} ({c.kode_cabang})
                      </option>
                    ))}
                  </select>
                </div>
              ) : (
                <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between">
                  <span className="font-semibold text-gray-700">Cabang Penempatan:</span>
                  <span className="font-bold text-[#005DAA] bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                    {currentUser.nama_cabang || 'Cabang Saya'}
                  </span>
                </div>
              )}

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Nama Aset *</label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: Ultrasonic Thickness Gauge Krautkramer USM 35"
                  value={newAsset.nama}
                  onChange={(e) => setNewAsset({ ...newAsset, nama: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Kategori Aset *</label>
                  <select
                    value={newAsset.kategori}
                    onChange={(e) => setNewAsset({ ...newAsset, kategori: e.target.value as KategoriAset })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Tanggal Perolehan Aset *</label>
                  <input
                    type="date"
                    required
                    value={newAsset.tgl_perolehan}
                    onChange={(e) => setNewAsset({ ...newAsset, tgl_perolehan: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                  />
                </div>
              </div>

              {/* Tag Number & Asset Number */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Asset Number {currentUser.role === 'puma' ? '(Wajib PUMA) *' : '(Opsional Project)'}
                  </label>
                  <input
                    type="text"
                    required={currentUser.role === 'puma'}
                    placeholder={currentUser.role === 'puma' ? "Contoh: AST-2026-0012" : "Boleh dikosongkan"}
                    value={newAsset.asset_number}
                    onChange={(e) => setNewAsset({ ...newAsset, asset_number: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Tag Number {currentUser.role === 'puma' ? '(Wajib PUMA) *' : '(Opsional Project)'}
                  </label>
                  <input
                    type="text"
                    required={currentUser.role === 'puma'}
                    placeholder={currentUser.role === 'puma' ? "Contoh: TAG-SUCO-8801" : "Boleh dikosongkan"}
                    value={newAsset.tag_number}
                    onChange={(e) => setNewAsset({ ...newAsset, tag_number: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                  />
                </div>
              </div>

              {/* Nilai Perolehan (Rp) */}
              {currentUser.role === 'puma' ? (
                <div className="p-3 bg-emerald-50/70 border border-emerald-300 rounded-xl space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label className="block font-bold text-emerald-950 text-xs">
                      Nilai Perolehan (Rp) *
                    </label>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded">
                      Wajib PUMA • Integer Rupiah
                    </span>
                  </div>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-bold text-emerald-700 text-xs">Rp</span>
                    <input
                      type="text"
                      required
                      placeholder="Contoh: 50.000.000"
                      value={newAsset.nilai_perolehan ? Number(newAsset.nilai_perolehan).toLocaleString('id-ID') : ''}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        setNewAsset({ ...newAsset, nilai_perolehan: raw ? Number(raw) : '' });
                      }}
                      className="w-full pl-10 pr-3 py-2 border border-emerald-300 rounded-lg outline-hidden focus:ring-2 focus:ring-emerald-600 bg-white font-mono font-bold text-gray-900 text-sm"
                    />
                  </div>
                  <p className="text-[10px] text-emerald-800">
                    * Wajib diisi &gt; 0. Data tidak dapat diubah setelah disimpan.
                  </p>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Nilai Perolehan (Rp) <span className="text-gray-400 font-normal">(Opsional)</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 font-bold text-gray-500 text-xs">Rp</span>
                    <input
                      type="text"
                      placeholder="Contoh: 25.000.000"
                      value={newAsset.nilai_perolehan ? Number(newAsset.nilai_perolehan).toLocaleString('id-ID') : ''}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/\D/g, '');
                        setNewAsset({ ...newAsset, nilai_perolehan: raw ? Number(raw) : '' });
                      }}
                      className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66] bg-white font-mono font-medium text-gray-900"
                    />
                  </div>
                </div>
              )}

              {/* Basis Operasi untuk Utilisasi Aset Operasional */}
              <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="font-bold text-gray-900 flex items-center space-x-1.5">
                    <Activity className="w-4 h-4 text-[#005DAA]" />
                    <span>Basis Jam Operasi (Perhitungan Utilisasi) *</span>
                  </label>
                  <span className="text-[10px] text-blue-800 bg-blue-100 font-bold px-2 py-0.5 rounded-full">
                    Kategori: {newAsset.kategori}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setNewAsset({ ...newAsset, basis_operasi: 'Working Day Based' })}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                      newAsset.basis_operasi === 'Working Day Based'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-gray-800 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="font-bold text-xs">Working Day Based</div>
                    <div className={`text-[10px] mt-0.5 ${newAsset.basis_operasi === 'Working Day Based' ? 'text-blue-100' : 'text-gray-500'}`}>
                      8 jam / hari • 5 hari kerja (40 jam/minggu)
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setNewAsset({ ...newAsset, basis_operasi: 'Continuous Operation' })}
                    className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
                      newAsset.basis_operasi === 'Continuous Operation'
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : 'bg-white text-gray-800 border-gray-200 hover:border-blue-300'
                    }`}
                  >
                    <div className="font-bold text-xs">Continuous Operation</div>
                    <div className={`text-[10px] mt-0.5 ${newAsset.basis_operasi === 'Continuous Operation' ? 'text-blue-100' : 'text-gray-500'}`}>
                      24 jam / hari • 7 hari kerja (168 jam/minggu)
                    </div>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Merk / Model</label>
                  <input
                    type="text"
                    placeholder="GE Krautkramer USM 35X"
                    value={newAsset.merk_model}
                    onChange={(e) => setNewAsset({ ...newAsset, merk_model: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Nomor Seri Fisik</label>
                  <input
                    type="text"
                    placeholder="SN-90218902"
                    value={newAsset.nomor_seri}
                    onChange={(e) => setNewAsset({ ...newAsset, nomor_seri: e.target.value })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-gray-700 mb-1">Spesifikasi Teknis</label>
                <textarea
                  rows={2}
                  placeholder="Detail spesifikasi alat, range pengukuran, kelengkapan..."
                  value={newAsset.spesifikasi}
                  onChange={(e) => setNewAsset({ ...newAsset, spesifikasi: e.target.value })}
                  className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                />
              </div>

              {/* Status & Kondisi Input with Dynamic Constraint */}
              <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Status Aset *</label>
                  <select
                    value={newAsset.status}
                    onChange={(e) => handleNewAssetStatusChange(e.target.value as StatusAset)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66] bg-white font-medium"
                  >
                    {ALL_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Kondisi Aset *</label>
                  <select
                    value={newAsset.kondisi}
                    onChange={(e) => setNewAsset({ ...newAsset, kondisi: e.target.value as KondisiAset })}
                    className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66] bg-white font-medium"
                  >
                    {getAllowedKondisiForStatus(newAsset.status).map((k) => (
                      <option key={k} value={k}>{k}</option>
                    ))}
                  </select>
                  {getAllowedKondisiForStatus(newAsset.status).length === 1 && (
                    <span className="text-[10px] text-amber-700 mt-1 block">
                      🔒 Terkunci: Status "{newAsset.status}" hanya valid untuk kondisi "{getAllowedKondisiForStatus(newAsset.status)[0]}".
                    </span>
                  )}
                </div>
              </div>

              <div className="p-3 bg-sky-50 border border-sky-200 rounded-lg text-xs text-sky-900 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2 font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500 shrink-0"></span>
                    <span>Pengelola &amp; Pemegang Aset Awal (Fungsi UMUM)</span>
                  </div>
                  {activeTargetCabang && (
                    <span className="text-[10px] font-bold text-[#005DAA] bg-blue-100/70 border border-blue-200 px-2 py-0.5 rounded-md">
                      Cabang: {activeTargetCabang.nama_cabang}
                    </span>
                  )}
                </div>

                <div>
                  <label className="block font-semibold text-gray-700 mb-1 text-xs">
                    Pilih Pemegang / PIC Penerima Awal (Fungsi UMUM Cabang Terpilih) *
                  </label>
                  {!activeNewAssetCabangId ? (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-amber-800 text-xs font-semibold">
                      ⚠️ Silakan pilih Cabang / SBU Tujuan terlebih dahulu di atas.
                    </div>
                  ) : fungsiUmumUsers.length === 0 ? (
                    <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg text-rose-800 text-xs font-medium space-y-1">
                      <div className="font-bold flex items-center space-x-1">
                        <AlertCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                        <span>Belum Ada Pengguna Fungsi UMUM di {activeTargetCabang?.nama_cabang || 'Cabang Terpilih'}</span>
                      </div>
                      <p className="text-[11px] text-rose-700">
                        Tidak ditemukan pengguna Fungsi UMUM yang terdaftar di cabang ini. Silakan tambahkan pengguna untuk cabang ini melalui menu <strong>Manajemen User</strong>.
                      </p>
                    </div>
                  ) : (
                    <select
                      required
                      value={newAsset.id_pic || (fungsiUmumUsers[0]?.id || '')}
                      onChange={(e) => setNewAsset({ ...newAsset, id_pic: e.target.value })}
                      className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66] text-xs bg-white font-medium"
                    >
                      {fungsiUmumUsers.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nama} — {u.jabatan || u.nama_bidang} {u.nama_cabang ? `(${u.nama_cabang})` : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
                <p className="text-[11px] text-sky-800">
                  Aset investasi yang dialokasikan ke cabang ini otomatis dikelola dan dipegang oleh personel <strong>Fungsi UMUM</strong> dari cabang yang dipilih.
                </p>
              </div>

              <div className="pt-2 border-t border-gray-100 space-y-2">
                <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-900">
                  💡 <strong>Keterangan Kalibrasi:</strong> Pengisian tanggal dan nomor sertifikat kalibrasi bersifat <strong>opsional</strong>, hanya diperuntukkan bagi peralatan yang wajib dikalibrasi secara berkala.
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">Jatuh Tempo Kalibrasi (Opsional)</label>
                    <input
                      type="date"
                      value={newAsset.tgl_kalibrasi_berikutnya}
                      onChange={(e) => setNewAsset({ ...newAsset, tgl_kalibrasi_berikutnya: e.target.value })}
                      className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                    />
                  </div>

                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">No. Sertifikat Kalibrasi (Opsional)</label>
                    <input
                      type="text"
                      placeholder="CERT/NDT/2026/001 (opsional)"
                      value={newAsset.sertifikat_kalibrasi_no}
                      onChange={(e) => setNewAsset({ ...newAsset, sertifikat_kalibrasi_no: e.target.value })}
                      className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                    />
                  </div>
                </div>
              </div>

              <div className="shrink-0 flex items-center justify-end space-x-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#002B66] hover:bg-[#001D47] text-white rounded-lg font-bold shadow-sm cursor-pointer"
                >
                  {currentUser.role === 'puma' ? 'Simpan & Alokasikan ke Cabang' : 'Simpan Master Data Aset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Peringatan Konfirmasi Simpan Aset Baru (Aturan Kerja 5) */}
      {showAddConfirmModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-amber-300 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center space-x-3 text-amber-600">
              <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center shrink-0 border border-amber-300">
                <AlertCircle className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">Peringatan Penyimpanan</h4>
                <p className="text-[11px] text-amber-700 font-semibold">Konfirmasi Data Permanen</p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-950 font-medium leading-relaxed">
              Data tidak dapat diubah setelah disimpan. Periksa kembali sebelum melanjutkan.
            </div>

            {newAsset.nilai_perolehan ? (
              <div className="text-xs bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
                <div className="text-slate-500 font-medium">Nilai Perolehan yang akan dikunci:</div>
                <div className="text-sm font-extrabold font-mono text-emerald-700">
                  Rp {Math.round(Number(newAsset.nilai_perolehan)).toLocaleString('id-ID')}
                </div>
              </div>
            ) : null}

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowAddConfirmModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleConfirmCreateAsset}
                className="px-5 py-2 bg-[#002B66] hover:bg-[#001D47] text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Konfirmasi Penerimaan Aset di Cabang & Input Proyeksi Pendapatan per Tahun */}
      {receiptModalAsset && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 overflow-y-auto p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center">
          <div className="bg-white rounded-2xl max-w-xl w-full p-4 sm:p-6 shadow-2xl border border-gray-100 my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95">
            
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-2">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm sm:text-base leading-tight">
                    Konfirmasi Penerimaan Aset di Cabang
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Alur "Telah Terima Barang" &amp; Proyeksi Pendapatan Tahunan
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setReceiptModalAsset(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleValidateReceiptForm} className="overflow-y-auto flex-1 min-h-0 space-y-4 py-3 text-xs pr-1">
              
              {/* Asset Summary Card */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                    {receiptModalAsset.id_aset}
                  </span>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full border border-amber-300">
                    👑 Investasi PUMA
                  </span>
                </div>
                <h4 className="font-bold text-slate-900 text-xs">{receiptModalAsset.nama}</h4>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1">
                  <div>
                    <span className="text-slate-500 block">Kategori:</span>
                    <strong className="text-slate-800">{receiptModalAsset.kategori}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500 block">Nilai Perolehan:</span>
                    <strong className="text-emerald-700 font-mono">
                      {receiptModalAsset.nilai_perolehan ? `Rp ${Math.round(receiptModalAsset.nilai_perolehan).toLocaleString('id-ID')}` : '-'}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Catatan Penerimaan */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1 text-xs">
                  Catatan Penerimaan Fisik di Cabang
                </label>
                <input
                  type="text"
                  value={receiptCatatan}
                  onChange={(e) => setReceiptCatatan(e.target.value)}
                  placeholder="Contoh: Barang telah tiba di gudang cabang dalam kondisi baik dan lengkap"
                  className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66] text-xs"
                />
              </div>

              {/* Section Proyeksi Pendapatan per Tahun */}
              <div className="space-y-3 p-3.5 bg-blue-50/50 border border-blue-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="font-extrabold text-slate-900 text-xs flex items-center space-x-1.5">
                      <span>Proyeksi Pendapatan per Tahun</span>
                      {receiptModalAsset.kategori === 'Peralatan Operasi' && (
                        <span className="text-[10px] text-rose-700 bg-rose-100 font-bold px-1.5 py-0.2 rounded border border-rose-200">
                          Wajib Diisi
                        </span>
                      )}
                    </h5>
                    <p className="text-[10px] text-slate-500 mt-0.5">
                      {receiptModalAsset.kategori === 'Peralatan Operasi'
                        ? 'Wajib minimal 1 tahun proyeksi untuk kategori Peralatan Operasi.'
                        : 'Opsional untuk kategori aset non-operasional.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={handleAddProyeksiRow}
                    className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px] flex items-center space-x-1 shadow-xs transition-colors cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Tambah Tahun</span>
                  </button>
                </div>

                {/* Rows Table */}
                <div className="space-y-2">
                  {proyeksiRows.length === 0 ? (
                    <div className="text-center py-4 text-slate-400 bg-white rounded-lg border border-dashed border-slate-300">
                      Belum ada baris proyeksi pendapatan. Klik "+ Tambah Tahun" di atas.
                    </div>
                  ) : (
                    proyeksiRows.map((row, idx) => (
                      <div key={idx} className="flex items-center space-x-2 bg-white p-2 rounded-lg border border-blue-100 shadow-2xs">
                        <div className="w-24 shrink-0">
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Tahun</label>
                          <input
                            type="number"
                            required
                            min={2000}
                            max={2100}
                            value={row.tahun}
                            onChange={(e) => handleUpdateProyeksiRow(idx, 'tahun', Number(e.target.value))}
                            className="w-full p-1.5 border border-slate-300 rounded font-mono font-bold text-center text-xs outline-hidden focus:ring-1 focus:ring-blue-600"
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <label className="block text-[10px] font-semibold text-slate-500 mb-0.5">Nilai Proyeksi (Rp)</label>
                          <div className="relative">
                            <span className="absolute left-2 top-1.5 font-bold text-slate-400 text-xs">Rp</span>
                            <input
                              type="text"
                              required
                              placeholder="0"
                              value={row.nilai ? Number(row.nilai).toLocaleString('id-ID') : ''}
                              onChange={(e) => {
                                const raw = e.target.value.replace(/\D/g, '');
                                handleUpdateProyeksiRow(idx, 'nilai', raw ? Number(raw) : 0);
                              }}
                              className="w-full pl-8 pr-2.5 py-1.5 border border-slate-300 rounded font-mono font-bold text-emerald-700 text-xs outline-hidden focus:ring-1 focus:ring-blue-600"
                            />
                          </div>
                        </div>

                        <div className="pt-4 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleRemoveProyeksiRow(idx)}
                            disabled={receiptModalAsset.kategori === 'Peralatan Operasi' && proyeksiRows.length === 1}
                            className="p-1.5 text-slate-400 hover:text-rose-600 disabled:opacity-30 disabled:hover:text-slate-400 rounded transition-colors cursor-pointer"
                            title="Hapus baris tahun ini"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* Tahap 1 C: Validasi Kewajaran (Peringatan Kuning) */}
                {hasExcessiveProjection && (
                  <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 text-xs flex items-start space-x-2 animate-in fade-in">
                    <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <div className="font-bold">Proyeksi tampak sangat tinggi dibanding nilai perolehan</div>
                      <div className="text-[11px] text-amber-800 mt-0.5">
                        Salah satu nilai proyeksi tahunan melebihi 2× nilai perolehan aset ({receiptModalAsset.nilai_perolehan ? `Rp ${Math.round(receiptModalAsset.nilai_perolehan).toLocaleString('id-ID')}` : '-'}). Peringatan ini tidak memblokir simpan, namun pastikan nilai proyeksi sudah wajar.
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {receiptFormError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-xs font-bold text-rose-800 flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{receiptFormError}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div className="shrink-0 flex items-center justify-end space-x-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setReceiptModalAsset(null)}
                  className="px-4 py-2 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={confirmingAssetId === receiptModalAsset.id_aset}
                  className="px-5 py-2 bg-[#008C45] hover:bg-[#007037] text-white rounded-lg font-bold shadow-sm flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                >
                  {confirmingAssetId === receiptModalAsset.id_aset ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Menyimpan...</span>
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      <span>Konfirmasi &amp; Simpan Penerimaan</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Peringatan Konfirmasi Simpan Penerimaan Cabang (Aturan Kerja 5) */}
      {showReceiptConfirmModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-amber-300 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center space-x-3 text-amber-600">
              <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center shrink-0 border border-amber-300">
                <AlertCircle className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">Peringatan Penyimpanan</h4>
                <p className="text-[11px] text-amber-700 font-semibold">Konfirmasi Data Permanen</p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-950 font-medium leading-relaxed">
              Data tidak dapat diubah setelah disimpan. Periksa kembali sebelum melanjutkan.
            </div>

            <div className="text-xs bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1.5">
              <div className="text-slate-600 font-semibold">Ringkasan yang akan disimpan secara permanen:</div>
              <div className="text-slate-500">
                Aset: <strong className="text-slate-900">{receiptModalAsset?.nama}</strong>
              </div>
              <div className="text-slate-500">
                Jumlah Tahun Proyeksi: <strong className="text-blue-700 font-bold">{proyeksiRows.length} tahun</strong>
              </div>
              {proyeksiRows.length > 0 && (
                <div className="text-slate-500 font-mono text-[11px] pt-1 border-t border-slate-200">
                  Total Nilai: <strong className="text-emerald-700 font-bold">Rp {proyeksiRows.reduce((acc, curr) => acc + (curr.nilai || 0), 0).toLocaleString('id-ID')}</strong>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setShowReceiptConfirmModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleExecuteReceipt}
                className="px-5 py-2 bg-[#008C45] hover:bg-[#007037] text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Detail Utilisasi Aset Operasional (Mingguan, Bulanan, All-Time) */}
      {selectedUtilizationAsset && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 overflow-y-auto p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center">
          <div className="bg-white rounded-2xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl border border-gray-100 my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95">
            
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between pb-3.5 border-b border-gray-100">
              <div>
                <h3 className="font-extrabold text-slate-900 text-base leading-tight">
                  Rincian Utilisasi Aset Operasional
                </h3>
                <p className="text-xs text-slate-500">
                  {selectedUtilizationAsset.nama} • <span className="font-mono font-bold text-[#005DAA]">{selectedUtilizationAsset.id_aset}</span>
                </p>
              </div>
              <button 
                onClick={() => setSelectedUtilizationAsset(null)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="overflow-y-auto flex-1 min-h-0 py-4 space-y-4 text-xs">
              
              {/* Asset Identity Card */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 rounded-xl border border-slate-200">
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block">Basis Operasi:</span>
                  <span className="font-bold text-slate-900">
                    {selectedUtilizationAsset.basis_operasi || 'Working Day Based'}
                  </span>
                  <span className="text-[10px] text-slate-500 block">
                    {selectedUtilizationAsset.basis_operasi === 'Continuous Operation' ? '24 Jam / 7 Hari' : '8 Jam / 5 Hari'}
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block">Status Saat Ini:</span>
                  <span className="font-bold text-slate-900">{selectedUtilizationAsset.status}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block">Kondisi:</span>
                  <span className="font-bold text-slate-900">{selectedUtilizationAsset.kondisi}</span>
                </div>
                <div>
                  <span className="text-[10px] text-slate-500 font-semibold block">Sumber Pengadaan:</span>
                  <span className="font-bold text-indigo-700">
                    {selectedUtilizationAsset.sumber_aset === 'PUMA' ? '👑 Investasi PUMA' : '🏢 Project Cabang'}
                  </span>
                </div>
              </div>

              {/* Time Window Tabs */}
              <div className="flex items-center space-x-1.5 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => setUtilizationModalTab('mingguan')}
                  className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    utilizationModalTab === 'mingguan'
                      ? 'bg-white text-[#005DAA] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Mingguan (7 Hari)
                </button>
                <button
                  type="button"
                  onClick={() => setUtilizationModalTab('bulanan')}
                  className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    utilizationModalTab === 'bulanan'
                      ? 'bg-white text-[#005DAA] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Bulanan (30 Hari)
                </button>
                <button
                  type="button"
                  onClick={() => setUtilizationModalTab('allTime')}
                  className={`flex-1 py-2 px-3 rounded-lg font-bold text-xs transition-all cursor-pointer ${
                    utilizationModalTab === 'allTime'
                      ? 'bg-white text-[#005DAA] shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Sejak Dioperasikan
                </button>
              </div>

              {/* Active Tab Metrics Display */}
              {(() => {
                const breakdown = selectedUtilizationAsset.utilization?.[utilizationModalTab] || {
                  actualHours: 0,
                  availableHours: 0,
                  maintenanceHours: 0,
                  rate: 0
                };

                const rate = breakdown.rate;
                const badgeColor = rate >= 80 
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-300' 
                  : rate >= 50 
                    ? 'bg-amber-50 text-amber-800 border-amber-300' 
                    : 'bg-rose-50 text-rose-800 border-rose-300';

                return (
                  <div className="space-y-4">
                    
                    {/* Big Score Card */}
                    <div className="p-5 bg-gradient-to-br from-slate-50 to-blue-50/50 rounded-2xl border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-4">
                      <div>
                        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">
                          Tingkat Utilisasi ({utilizationModalTab === 'mingguan' ? 'Mingguan' : utilizationModalTab === 'bulanan' ? 'Bulanan' : 'All-Time'})
                        </span>
                        <div className="text-4xl sm:text-5xl font-black text-slate-900 my-1">
                          {rate}%
                        </div>
                        <span className={`inline-block px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border ${badgeColor}`}>
                          {rate >= 80 ? 'Sangat Optimal' : rate >= 50 ? 'Moderat' : 'Rendah (Perlu Optimalisasi)'}
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center w-full sm:w-auto">
                        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                          <span className="text-[10px] text-slate-500 font-semibold block">Jam Operasi (Actual)</span>
                          <span className="text-lg font-black text-emerald-700">{breakdown.actualHours} jam</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                          <span className="text-[10px] text-slate-500 font-semibold block">Maintenance (Downtime)</span>
                          <span className="text-lg font-black text-amber-700">{breakdown.maintenanceHours} jam</span>
                        </div>
                        <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                          <span className="text-[10px] text-slate-500 font-semibold block">Available Time Netto</span>
                          <span className="text-lg font-black text-blue-700">{breakdown.availableHours} jam</span>
                        </div>
                      </div>
                    </div>

                  </div>
                );
              })()}

            </div>

            {/* Footer */}
            <div className="shrink-0 flex items-center justify-end pt-3 border-t border-gray-100">
              <button
                type="button"
                onClick={() => setSelectedUtilizationAsset(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white font-bold text-xs rounded-xl shadow-xs cursor-pointer"
              >
                Tutup Rincian
              </button>
            </div>

          </div>
        </div>
      )}

      {/* MODAL: Form Pengajuan Transfer / Disposal Aset */}
      {showTransferModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 overflow-y-auto p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center">
          <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-gray-100 my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
            <div className="shrink-0 flex items-center justify-between pb-3 border-b border-gray-100">
              <h3 className="font-bold text-gray-900 text-sm flex items-center space-x-2">
                <ArrowRightLeft className="w-4 h-4 text-[#005DAA]" />
                <span>Form Pengajuan Transfer & Disposal Aset</span>
              </h3>
              <button onClick={() => setShowTransferModal(false)} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            {transferErrorMsg && (
              <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs font-medium flex items-start space-x-2">
                <AlertCircle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                <span>{transferErrorMsg}</span>
              </div>
            )}

            {transferSuccessMsg ? (
              <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-semibold space-y-2">
                <div className="flex items-center space-x-2 text-emerald-700 font-bold text-sm">
                  <Check className="w-5 h-5 text-emerald-600" />
                  <span>Pengajuan Berhasil Dikirim!</span>
                </div>
                <p>{transferSuccessMsg}</p>
              </div>
            ) : (
              <form onSubmit={handleTransferSubmit} className="overflow-y-auto flex-1 min-h-0 space-y-4 text-xs py-2 pr-1">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Pilih Aset Yang Diajukan *</label>
                  <select
                    value={transferAsset?.id_aset || ''}
                    onChange={(e) => {
                      const found = asets.find(a => a.id_aset === e.target.value);
                      if (found) setTransferAsset(found);
                    }}
                    className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#005DAA]"
                  >
                    {asets.map((a) => (
                      <option key={a.id_aset} value={a.id_aset}>
                        [{a.id_aset}] {a.nama} ({a.nama_bidang_sekarang})
                      </option>
                    ))}
                  </select>
                </div>

                {transferAsset && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 space-y-1">
                    <div className="font-bold text-[#005DAA]">{transferAsset.nama}</div>
                    <div className="text-[11px] text-slate-500">ID: {transferAsset.id_aset} | SN: {transferAsset.nomor_seri || '-'}</div>
                    <div className="text-[11px] text-slate-600">
                      Bidang/Lokasi Saat Ini: <strong>{transferAsset.nama_bidang_sekarang}</strong> ({transferAsset.lokasi_sekarang})
                    </div>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Jenis Pengajuan *</label>
                  <select
                    value={transferJenis}
                    onChange={(e) => setTransferJenis(e.target.value as any)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#005DAA]"
                  >
                    <option value="Transfer">Transfer Aset Antar Bidang</option>
                    <option value="Pengajuan Pemakaian">Pengajuan Pemakaian / Peminjaman Lapangan</option>
                    <option value="Pengembalian Aset (Selesai Pakai)">Pengembalian Aset (Ubah Menjadi Tersedia)</option>
                    <option value="Disposal">Penghapusan Aset (Disposal)</option>
                  </select>
                </div>

                {transferJenis === 'Transfer' && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">Bidang Tujuan *</label>
                      <select
                        value={idBidangTujuan}
                        onChange={(e) => handleBidangTujuanChange(e.target.value)}
                        className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#005DAA]"
                      >
                        {bidangList.map((b) => (
                          <option key={b.id_bidang} value={b.id_bidang}>{b.nama_bidang}</option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block font-semibold text-gray-700 mb-1">PIC Tujuan *</label>
                      <select
                        value={idPicTujuan}
                        onChange={(e) => handlePicTujuanChange(e.target.value)}
                        className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#005DAA]"
                      >
                        {userList.map((u) => (
                          <option key={u.id} value={u.id}>
                            {u.nama} ({u.nama_bidang || 'Bidang N/A'})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {transferJenis !== 'Disposal' && (
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">
                      Nama Pemegang Baru / Personel Pemakai Lapangan
                    </label>
                    <input
                      type="text"
                      placeholder={`Default: ${currentUser.nama} (Pemohon)`}
                      value={pemegangBaruInput}
                      onChange={(e) => setPemegangBaruInput(e.target.value)}
                      className="w-full p-2.5 border border-sky-300 bg-sky-50/50 rounded-lg outline-hidden focus:ring-2 focus:ring-[#005DAA]"
                    />
                    <p className="text-[10px] text-slate-500 mt-1">
                      * Setelah disetujui, nama ini akan otomatis memperbarui "Pemegang Terakhir" pada Master Data.
                    </p>
                  </div>
                )}

                {transferJenis === 'Pengajuan Pemakaian' && (
                  <div>
                    <label className="block font-semibold text-amber-800 mb-1">
                      Tanggal Rencana Pengembalian Aset *
                    </label>
                    <input
                      type="date"
                      required
                      min={new Date().toISOString().split('T')[0]}
                      value={tglRencanaPengembalianInput}
                      onChange={(e) => setTglRencanaPengembalianInput(e.target.value)}
                      className="w-full p-2.5 border border-amber-300 bg-amber-50/50 rounded-lg outline-hidden focus:ring-2 focus:ring-amber-500 font-medium text-amber-900"
                    />
                    <p className="text-[10px] text-amber-700 mt-1">
                      * Wajib diisi. Jika terlambat lebih dari 1 hari tanpa perubahan status/pengajuan baru, email peringatan otomatis dikirimkan ke PIC &amp; Fungsi Umum.
                    </p>
                  </div>
                )}

                <div>
                  <label className="block font-semibold text-gray-700 mb-1">Alasan Pengajuan *</label>
                  <textarea
                    rows={2}
                    required
                    placeholder={transferJenis === 'Pengembalian Aset (Selesai Pakai)' ? 'Contoh: Pekerjaan site selesai, barang dikembalikan ke workshop...' : 'Jelaskan pertimbangan transfer atau kondisi alat yang melandasi pengajuan...'}
                    value={alasanTransfer}
                    onChange={(e) => setAlasanTransfer(e.target.value)}
                    className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#005DAA]"
                  />
                </div>

                {/* Pengisian Lokasi & Ambil Gambar jika Ubah Barang Menjadi Tersedia (Tepat di bawah sebelum tombol Kirim Pengajuan) */}
                {transferJenis === 'Pengembalian Aset (Selesai Pakai)' && (
                  <div className="pt-1">
                    <ReturnAssetEvidenceSection
                      foto={transferFotoPengembalian}
                      onFotoChange={setTransferFotoPengembalian}
                      lokasiGps={transferLokasiGps}
                      onLokasiGpsChange={(gps, formattedText) => {
                        setTransferLokasiGps(gps);
                        if (formattedText) setTransferLokasiPengembalian(formattedText);
                      }}
                      lokasiFisik={transferLokasiPengembalian}
                      onLokasiFisikChange={setTransferLokasiPengembalian}
                      namaAset={transferAsset.nama}
                      disabled={isSubmittingTransfer}
                    />
                  </div>
                )}

                <div className="shrink-0 flex items-center justify-end space-x-2 pt-3 border-t border-gray-100">
                  <button
                    type="button"
                    onClick={() => setShowTransferModal(false)}
                    className="px-4 py-2 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingTransfer || (transferJenis === 'Pengembalian Aset (Selesai Pakai)' && (!transferFotoPengembalian || !transferLokasiGps))}
                    className={`px-5 py-2 text-white rounded-lg font-bold shadow-xs transition-all cursor-pointer ${
                      (transferJenis === 'Pengembalian Aset (Selesai Pakai)' && (!transferFotoPengembalian || !transferLokasiGps))
                        ? 'bg-slate-300 text-slate-500 cursor-not-allowed shadow-none'
                        : 'bg-[#005DAA] hover:bg-blue-800'
                    }`}
                  >
                    {isSubmittingTransfer ? 'Mengirim...' : 'Kirim Pengajuan'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* MODAL: Printable Physical QR Code Tag */}
      {showQrModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 overflow-y-auto p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center">
          <div className="bg-white rounded-2xl max-w-md w-full p-4 sm:p-6 shadow-2xl space-y-4 border border-gray-100 my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-gray-100 pb-3 shrink-0">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-blue-50 text-[#002B66] rounded-lg">
                  <QrCode className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Cetak Label QR Fisik Aset</h3>
                  <p className="text-[11px] text-gray-500">Atur ukuran & informasi sebelum dicetak</p>
                </div>
              </div>
              <button onClick={() => setShowQrModal(null)} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto space-y-4 pr-1 text-left">
              {/* Size Preset Selector */}
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1.5">
                  Pilih Ukuran Kotak Label (Dimensi CM Terkunci):
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  <button
                    type="button"
                    onClick={() => setLabelSizePreset('small')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                      labelSizePreset === 'small'
                        ? 'bg-[#002B66] text-white border-[#002B66] shadow-xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    Kecil
                    <span className="block text-[9px] font-normal opacity-80">4 × 2.5 cm</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLabelSizePreset('medium')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                      labelSizePreset === 'medium'
                        ? 'bg-[#002B66] text-white border-[#002B66] shadow-xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    Sedang
                    <span className="block text-[9px] font-normal opacity-80">6 × 4 cm</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLabelSizePreset('large')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                      labelSizePreset === 'large'
                        ? 'bg-[#002B66] text-white border-[#002B66] shadow-xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    Besar
                    <span className="block text-[9px] font-normal opacity-80">8 × 5 cm</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setLabelSizePreset('custom')}
                    className={`py-1.5 px-2 rounded-lg text-xs font-bold border transition-all ${
                      labelSizePreset === 'custom'
                        ? 'bg-[#002B66] text-white border-[#002B66] shadow-xs'
                        : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
                    }`}
                  >
                    Kustom CM
                    <span className="block text-[9px] font-normal opacity-80">Atur CM</span>
                  </button>
                </div>
              </div>

              {/* Custom CM Sliders */}
              {labelSizePreset === 'custom' && (
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center space-x-1.5 text-xs font-bold text-[#002B66] border-b border-slate-200 pb-1.5">
                    <Sliders className="w-3.5 h-3.5" />
                    <span>Atur Dimensi Fisik Kotak Label (Centimeter):</span>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-700">
                      <span>Lebar Kotak:</span>
                      <span className="text-[#002B66] font-mono bg-blue-50 px-2 py-0.5 rounded text-[11px]">{customWidthCm} cm</span>
                    </div>
                    <input
                      type="range"
                      min="3.0"
                      max="12.0"
                      step="0.5"
                      value={customWidthCm}
                      onChange={(e) => setCustomWidthCm(Number(e.target.value))}
                      className="w-full accent-[#002B66] cursor-pointer h-1.5 bg-gray-200 rounded-lg"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>3.0 cm (Mini)</span>
                      <span>6.0 cm (Standar)</span>
                      <span>12.0 cm (Maksimal)</span>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between items-center text-xs font-bold text-gray-700">
                      <span>Tinggi Kotak:</span>
                      <span className="text-[#002B66] font-mono bg-blue-50 px-2 py-0.5 rounded text-[11px]">{customHeightCm} cm</span>
                    </div>
                    <input
                      type="range"
                      min="2.0"
                      max="8.0"
                      step="0.5"
                      value={customHeightCm}
                      onChange={(e) => setCustomHeightCm(Number(e.target.value))}
                      className="w-full accent-[#002B66] cursor-pointer h-1.5 bg-gray-200 rounded-lg"
                    />
                    <div className="flex justify-between text-[10px] text-gray-400">
                      <span>2.0 cm (Ramping)</span>
                      <span>4.0 cm (Standar)</span>
                      <span>8.0 cm (Tinggi)</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Toggles for Content */}
              <div className="bg-gray-50 p-2.5 rounded-xl border border-gray-100 space-y-1.5">
                <span className="block text-xs font-bold text-gray-700">Elemen yang Ditampilkan di Dalam Kotak:</span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                  <label className="flex items-center space-x-1.5 cursor-pointer text-gray-700">
                    <input
                      type="checkbox"
                      checked={includeLogo}
                      onChange={(e) => setIncludeLogo(e.target.checked)}
                      className="rounded accent-[#002B66]"
                    />
                    <span>Header Logo</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer text-gray-700">
                    <input
                      type="checkbox"
                      checked={includeName}
                      onChange={(e) => setIncludeName(e.target.checked)}
                      className="rounded accent-[#002B66]"
                    />
                    <span>Nama Aset</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer text-gray-700">
                    <input
                      type="checkbox"
                      checked={includeNumbers}
                      onChange={(e) => setIncludeNumbers(e.target.checked)}
                      className="rounded accent-[#002B66]"
                    />
                    <span>Tag &amp; Asset No</span>
                  </label>
                  <label className="flex items-center space-x-1.5 cursor-pointer text-gray-700">
                    <input
                      type="checkbox"
                      checked={includePic}
                      onChange={(e) => setIncludePic(e.target.checked)}
                      className="rounded accent-[#002B66]"
                    />
                    <span>Bidang &amp; PIC</span>
                  </label>
                </div>
              </div>

              {/* Live Preview Section with Fixed Box Dimension */}
              <div className="text-center">
                {(() => {
                  const dims = getLabelDimensions(labelSizePreset, customWidthCm, customHeightCm);
                  return (
                    <>
                      <div className="flex justify-between items-center mb-1.5 flex-wrap gap-1">
                        <span className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                          Pratinjau Hasil Cetak Fisik:
                        </span>
                        <div className="flex items-center space-x-1.5">
                          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            Borderless (Tanpa Garis Tepi)
                          </span>
                          <span className="text-[10px] font-bold text-[#002B66] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                            Ukuran: {dims.widthCm} × {dims.heightCm} cm
                          </span>
                        </div>
                      </div>

                      <div className="flex justify-center items-center min-h-[170px] bg-slate-100 p-3 rounded-xl border border-slate-200 overflow-x-auto">
                        <div
                          id="printable-qr-label-card"
                          style={{
                            width: `${dims.previewWidth}px`,
                            height: `${dims.previewHeight}px`,
                            minWidth: `${dims.previewWidth}px`,
                            maxWidth: `${dims.previewWidth}px`,
                            minHeight: `${dims.previewHeight}px`,
                            maxHeight: `${dims.previewHeight}px`,
                            boxSizing: 'border-box',
                            overflow: 'hidden',
                            border: 'none',
                            borderRadius: '4px',
                            backgroundColor: '#ffffff',
                            padding: `${dims.paddingPx}px`,
                            boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.12), 0 1px 3px 0 rgba(0, 0, 0, 0.08)',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: `${dims.gapPx}px`,
                            textAlign: 'center',
                            userSelect: 'none',
                            margin: '0 auto',
                            color: '#1e293b'
                          }}
                          className="shrink-0 transition-all"
                        >
                          {includeLogo && (
                            <div
                              style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '4px',
                                color: '#002B66',
                                fontWeight: 900,
                                fontSize: `${dims.fontSizeHeaderPx}px`,
                                lineHeight: 1.1,
                                whiteSpace: 'nowrap',
                                flexShrink: 0
                              }}
                            >
                              <img
                                src="https://i.ibb.co.com/xKsyxsWX/logo-sucofindo.png"
                                alt="Logo SUCOFINDO"
                                style={{
                                  height: `${dims.logoHeightPx}px`,
                                  width: 'auto',
                                  objectFit: 'contain'
                                }}
                              />
                              <span>SUCOFINDO</span>
                            </div>
                          )}
                          
                          {qrDataUrl && (
                            <img 
                              src={qrDataUrl} 
                              alt="QR Code Tag" 
                              style={{
                                width: `${dims.qrSizePreviewPx}px`,
                                height: `${dims.qrSizePreviewPx}px`,
                                margin: '0 auto',
                                border: 'none',
                                backgroundColor: '#ffffff',
                                padding: '0px',
                                borderRadius: '0px',
                                objectFit: 'contain',
                                display: 'block',
                                flexShrink: 0
                              }}
                            />
                          )}

                          <div
                            style={{
                              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                              fontWeight: 900,
                              color: '#002B66',
                              letterSpacing: '0.5px',
                              wordBreak: 'break-all',
                              fontSize: `${dims.fontSizeQrCodePx}px`,
                              lineHeight: 1.1,
                              flexShrink: 0
                            }}
                          >
                            {showQrModal.qr_code}
                          </div>
                          
                          {includeName && (
                            <div
                              style={{
                                fontWeight: 800,
                                color: '#0f172a',
                                lineHeight: 1.15,
                                maxWidth: '98%',
                                textAlign: 'center',
                                wordBreak: 'break-word',
                                display: '-webkit-box',
                                WebkitLineClamp: 2,
                                WebkitBoxOrient: 'vertical',
                                overflow: 'hidden',
                                fontSize: `${dims.fontSizeNamePx}px`,
                                flexShrink: 0
                              }}
                            >
                              {showQrModal.nama}
                            </div>
                          )}

                          {includeNumbers && (showQrModal.tag_number || showQrModal.asset_number || showQrModal.id_aset) && (
                            <div
                              style={{
                                color: '#002B66',
                                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                                fontWeight: 700,
                                backgroundColor: '#f1f5f9',
                                borderRadius: '4px',
                                padding: '1.5px 6px',
                                border: 'none',
                                lineHeight: 1.15,
                                textAlign: 'center',
                                wordBreak: 'break-all',
                                maxWidth: '96%',
                                fontSize: `${dims.fontSizeNumbersPx}px`,
                                flexShrink: 0
                              }}
                            >
                              {showQrModal.tag_number && <div>Tag: {showQrModal.tag_number}</div>}
                              {showQrModal.asset_number ? <div>Asset: {showQrModal.asset_number}</div> : (showQrModal.id_aset && <div>Asset: {showQrModal.id_aset}</div>)}
                            </div>
                          )}
                          
                          {includePic && (
                            <div
                              style={{
                                color: '#475569',
                                fontWeight: 600,
                                wordBreak: 'break-word',
                                maxWidth: '98%',
                                textAlign: 'center',
                                whiteSpace: 'nowrap',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                fontSize: `${dims.fontSizePicPx}px`,
                                flexShrink: 0
                              }}
                            >
                              {showQrModal.nama_bidang_sekarang ? `Bidang: ${showQrModal.nama_bidang_sekarang}` : ''}
                              {showQrModal.nama_pic_sekarang ? ` | PIC: ${showQrModal.nama_pic_sekarang}` : ''}
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-gray-100 shrink-0">
              <a
                href={qrDataUrl}
                download={`QR_TAG_${showQrModal.id_aset}.png`}
                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-3 py-2 rounded-xl text-xs font-bold flex items-center space-x-1 transition-colors"
                title="Unduh file gambar barcode QR saja (PNG)"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Unduh PNG</span>
              </a>
              <button
                type="button"
                onClick={handleDownloadPdf}
                disabled={isDownloadingPdf}
                className="bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white px-3.5 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm hover:shadow transition-all cursor-pointer"
                title="Unduh dokumen PDF label sesuai ukuran dimensi yang dipilih"
              >
                {isDownloadingPdf ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Membuat PDF...</span>
                  </>
                ) : (
                  <>
                    <FileDown className="w-3.5 h-3.5" />
                    <span>Unduh PDF</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={handlePrintQrLabel}
                className="bg-[#002B66] hover:bg-[#001D47] text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md hover:shadow-lg transition-all cursor-pointer"
                title="Cetak langsung ke printer stiker/kertas"
              >
                <Printer className="w-4 h-4" />
                <span>Cetak Label</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Asset History Tracking Modal (Khusus Fungsi UMUM) */}
      <AssetHistoryModal
        isOpen={!!selectedHistoryAsset}
        onClose={() => setSelectedHistoryAsset(null)}
        aset={selectedHistoryAsset}
        auditLogs={auditLogs}
        assignments={assignments}
        kalibrasiList={kalibrasiList}
        pengajuanList={pengajuanList}
        currentUser={currentUser}
      />

      {/* Floating Action Bar: Mode Seleksi Cetak Massal Roll (Opsi A) */}
      {isSelectionMode && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-11/12 max-w-4xl bg-slate-900/95 backdrop-blur-md text-white px-4 py-3 rounded-2xl shadow-2xl border border-slate-700/80 flex flex-col sm:flex-row items-center justify-between gap-3 animate-in fade-in slide-in-from-bottom-4">
          <div className="flex items-center space-x-3 w-full sm:w-auto justify-between sm:justify-start">
            <div className="flex items-center space-x-2">
              <span className="flex h-3 w-3 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500"></span>
              </span>
              <span className="font-bold text-sm text-white">
                {selectedAssetIds.length} <span className="font-normal text-slate-300 text-xs">aset dipilih</span>
              </span>
            </div>

            <div className="flex items-center space-x-1 text-xs">
              <button
                type="button"
                onClick={selectAllFiltered}
                className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-md font-medium text-[11px] transition-colors cursor-pointer"
                title={`Pilih semua ${filteredAsets.length} aset yang tampil pada filter saat ini`}
              >
                Pilih Semua ({filteredAsets.length})
              </button>
              {selectedAssetIds.length > 0 && (
                <button
                  type="button"
                  onClick={clearSelection}
                  className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-rose-300 rounded-md font-medium text-[11px] transition-colors cursor-pointer"
                >
                  Kosongkan
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={toggleSelectionMode}
              className="px-3 py-1.5 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors cursor-pointer"
            >
              Keluar Mode
            </button>
            <button
              type="button"
              onClick={() => {
                setBatchPreviewIndex(0);
                setShowBatchModal(true);
              }}
              disabled={selectedAssetIds.length === 0}
              className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-2 shadow-lg shadow-indigo-600/30 transition-all cursor-pointer"
            >
              <Layers className="w-4 h-4 text-indigo-200" />
              <span>Cetak Label Roll ({selectedAssetIds.length})</span>
            </button>
          </div>
        </div>
      )}

      {/* MODAL: Cetak Massal Label Stiker Roll 4x6 CM */}
      {showBatchModal && selectedAssets.length > 0 && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 overflow-y-auto p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center">
          <div className="bg-white rounded-2xl max-w-4xl w-full p-4 sm:p-6 shadow-2xl border border-gray-100 my-auto max-h-[92vh] flex flex-col animate-in fade-in zoom-in-95">
            
            {/* Header */}
            <div className="shrink-0 flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-2 bg-indigo-50 rounded-xl text-indigo-700">
                  <Layers className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 text-base leading-tight">
                    Cetak Massal Label Stiker Roll Thermal (4x6 cm)
                  </h3>
                  <p className="text-xs text-gray-500">
                    Menyiapkan cetak continuous roll untuk <strong>{selectedAssets.length} aset terpilih</strong>
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowBatchModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content Body: Left Controls & Right Preview */}
            <div className="overflow-y-auto flex-1 min-h-0 py-4 grid grid-cols-1 md:grid-cols-12 gap-5 text-xs">
              
              {/* Left Column: Settings */}
              <div className="md:col-span-5 space-y-4 pr-1">
                
                {/* Roll Size Selection */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2.5">
                  <label className="font-bold text-gray-800 flex items-center justify-between">
                    <span>Format & Ukuran Stiker Roll</span>
                    <span className="text-[11px] text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-md font-mono">
                      {batchLabelPreset === 'roll-4x6-landscape' ? '6 x 4 cm' :
                       batchLabelPreset === 'roll-4x6-portrait' ? '4 x 6 cm' :
                       batchLabelPreset === 'small' ? '4 x 2.5 cm' :
                       `${batchCustomWidthCm} x ${batchCustomHeightCm} cm`}
                    </span>
                  </label>

                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => setBatchLabelPreset('roll-4x6-landscape')}
                      className={`p-2 rounded-lg text-left border transition-all cursor-pointer ${
                        batchLabelPreset === 'roll-4x6-landscape'
                          ? 'bg-indigo-50/80 border-indigo-600 text-indigo-900 font-bold ring-1 ring-indigo-500'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-bold text-xs">Roll 4x6 Landscape</div>
                      <div className="text-[10px] text-gray-500">6 cm (P) × 4 cm (T) • Standar</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBatchLabelPreset('roll-4x6-portrait')}
                      className={`p-2 rounded-lg text-left border transition-all cursor-pointer ${
                        batchLabelPreset === 'roll-4x6-portrait'
                          ? 'bg-indigo-50/80 border-indigo-600 text-indigo-900 font-bold ring-1 ring-indigo-500'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-bold text-xs">Roll 4x6 Portrait</div>
                      <div className="text-[10px] text-gray-500">4 cm (P) × 6 cm (T) • Vertikal</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBatchLabelPreset('small')}
                      className={`p-2 rounded-lg text-left border transition-all cursor-pointer ${
                        batchLabelPreset === 'small'
                          ? 'bg-indigo-50/80 border-indigo-600 text-indigo-900 font-bold ring-1 ring-indigo-500'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-bold text-xs">Roll 4x2.5 cm</div>
                      <div className="text-[10px] text-gray-500">Mini Label Barcode</div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setBatchLabelPreset('custom')}
                      className={`p-2 rounded-lg text-left border transition-all cursor-pointer ${
                        batchLabelPreset === 'custom'
                          ? 'bg-indigo-50/80 border-indigo-600 text-indigo-900 font-bold ring-1 ring-indigo-500'
                          : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                      }`}
                    >
                      <div className="font-bold text-xs">Custom Dimensi</div>
                      <div className="text-[10px] text-gray-500">Sesuaikan lebar & tinggi</div>
                    </button>
                  </div>

                  {batchLabelPreset === 'custom' && (
                    <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200">
                      <div>
                        <label className="text-[11px] text-gray-600 font-semibold mb-1 block">Lebar (cm)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="2.5"
                          max="15.0"
                          value={batchCustomWidthCm}
                          onChange={(e) => setBatchCustomWidthCm(parseFloat(e.target.value) || 6.0)}
                          className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"
                        />
                      </div>
                      <div>
                        <label className="text-[11px] text-gray-600 font-semibold mb-1 block">Tinggi (cm)</label>
                        <input
                          type="number"
                          step="0.1"
                          min="1.8"
                          max="15.0"
                          value={batchCustomHeightCm}
                          onChange={(e) => setBatchCustomHeightCm(parseFloat(e.target.value) || 4.0)}
                          className="w-full px-2 py-1.5 bg-white border border-gray-300 rounded-lg text-xs"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* Urutan Cetak / Download */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <label className="font-bold text-gray-800 flex items-center justify-between">
                    <span>Urutan Label Stiker (Download & Cetak)</span>
                    <span className="text-[10px] text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded font-semibold">
                      {batchSortOrder === 'table' ? 'Sesuai Tabel' :
                       batchSortOrder === 'tag_asc' ? 'Tag Number (A-Z)' :
                       batchSortOrder === 'asset_asc' ? 'No. Aset (A-Z)' :
                       batchSortOrder === 'name_asc' ? 'Nama Aset (A-Z)' : 'ID Aset (A-Z)'}
                    </span>
                  </label>
                  <select
                    value={batchSortOrder}
                    onChange={(e) => {
                      setBatchSortOrder(e.target.value as any);
                      setBatchPreviewIndex(0);
                    }}
                    className="w-full px-2.5 py-1.5 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                  >
                    <option value="table">Sesuai Tampilan Tabel (Terbaru / Default)</option>
                    <option value="tag_asc">Berdasarkan Tag Number (Urut Naik / A-Z / 1-9)</option>
                    <option value="asset_asc">Berdasarkan Nomor Aset / Asset Number (Urut Naik)</option>
                    <option value="name_asc">Berdasarkan Nama Barang / Aset (A-Z)</option>
                    <option value="id_asc">Berdasarkan ID Aset (AST-001, AST-002, dst)</option>
                  </select>
                  <p className="text-[10px] text-slate-500 italic">
                    *Menentukan nomor urut halaman stiker saat dicetak atau diunduh ke PDF.
                  </p>
                </div>

                {/* Elements Included */}
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
                  <label className="font-bold text-gray-800 block">Komponen yang Ditampilkan</label>
                  
                  <div className="space-y-1.5">
                    <label className="flex items-center space-x-2 text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={batchIncludeLogo}
                        onChange={(e) => setBatchIncludeLogo(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Logo PT SUCOFINDO</span>
                    </label>

                    <label className="flex items-center space-x-2 text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={batchIncludeName}
                        onChange={(e) => setBatchIncludeName(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Nama Aset</span>
                    </label>

                    <label className="flex items-center space-x-2 text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={batchIncludeNumbers}
                        onChange={(e) => setBatchIncludeNumbers(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Nomor Tag & Asset Number</span>
                    </label>

                    <label className="flex items-center space-x-2 text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={batchIncludePic}
                        onChange={(e) => setBatchIncludePic(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span>Bidang & PIC Utama</span>
                    </label>
                  </div>
                </div>

                {/* Batch Printing Tips */}
                <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 leading-relaxed space-y-1">
                  <div className="font-bold flex items-center space-x-1 text-blue-950">
                    <CheckCircle2 className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                    <span>Format Khusus Printer Stiker Roll:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-blue-800">
                    <li>Format stiker tanpa garis tepi (borderless) agar presisi saat dicetak/ditempel pada label fisik.</li>
                    <li>Setiap label berada pada halaman terpisah (1 feed per stiker).</li>
                    <li>Otomatis pas dengan sensor jeda (gap) printer thermal Xprinter / Zebra / Argox.</li>
                    <li>Kualitas resolusi 4x supersampling (300+ DPI jernih tajam).</li>
                  </ul>
                </div>

              </div>

              {/* Right Column: Live Visual Preview & Item Carousel */}
              <div className="md:col-span-7 flex flex-col items-center justify-center bg-slate-100/80 p-4 rounded-xl border border-slate-200/80 min-h-[300px]">
                
                {/* Navigation Bar for Selected Assets Preview */}
                <div className="w-full flex items-center justify-between pb-3 mb-2 border-b border-slate-200 text-xs">
                  <span className="font-semibold text-slate-700">
                    Pratinjau Label: <span className="font-bold text-indigo-700">{batchPreviewIndex + 1} dari {selectedAssets.length}</span>
                  </span>
                  
                  <div className="flex items-center space-x-1.5">
                    <button
                      type="button"
                      disabled={batchPreviewIndex === 0}
                      onClick={() => setBatchPreviewIndex(prev => Math.max(0, prev - 1))}
                      className="p-1 rounded-md bg-white hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-white text-slate-700 border border-slate-300 transition-colors cursor-pointer"
                      title="Lihat aset sebelumnya"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <span className="text-[11px] font-mono font-bold text-slate-600 px-1">
                      {selectedAssets[batchPreviewIndex]?.tag_number || selectedAssets[batchPreviewIndex]?.id_aset}
                    </span>
                    <button
                      type="button"
                      disabled={batchPreviewIndex >= selectedAssets.length - 1}
                      onClick={() => setBatchPreviewIndex(prev => Math.min(selectedAssets.length - 1, prev + 1))}
                      className="p-1 rounded-md bg-white hover:bg-slate-200 disabled:opacity-40 disabled:hover:bg-white text-slate-700 border border-slate-300 transition-colors cursor-pointer"
                      title="Lihat aset selanjutnya"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Live Card Render */}
                {(() => {
                  const dims = getLabelDimensions(batchLabelPreset, batchCustomWidthCm, batchCustomHeightCm);
                  const activeAsset = selectedAssets[batchPreviewIndex] || selectedAssets[0];
                  if (!activeAsset) return null;

                  return (
                    <div className="w-full flex items-center justify-center py-2 overflow-auto">
                      <div
                        id="batch-qr-label-card"
                        className="bg-white rounded-md flex flex-col items-center justify-between text-center overflow-hidden transition-all select-none"
                        style={{
                          width: `${dims.previewWidth}px`,
                          height: `${dims.previewHeight}px`,
                          padding: `${dims.paddingPx}px`,
                          gap: `${dims.gapPx}px`,
                          boxSizing: 'border-box',
                          border: 'none',
                          boxShadow: '0 2px 8px -2px rgba(0, 0, 0, 0.12), 0 1px 3px 0 rgba(0, 0, 0, 0.08)'
                        }}
                      >
                        {/* 1. Header Logo & Company Name */}
                        {batchIncludeLogo && (
                          <div 
                            className="w-full flex items-center justify-center space-x-1 font-black text-[#002B66] pb-0.5 leading-none shrink-0"
                            style={{ fontSize: `${dims.fontSizeHeaderPx}px` }}
                          >
                            <img
                              src="https://i.ibb.co.com/xKsyxsWX/logo-sucofindo.png"
                              alt="Sucofindo"
                              style={{ height: `${dims.logoHeightPx}px` }}
                              className="object-contain"
                            />
                            <span className="tracking-wide font-black">SUCOFINDO</span>
                          </div>
                        )}

                        {/* 2. QR Code Image (Borderless) */}
                        <div 
                          className="bg-white flex items-center justify-center shrink-0"
                          style={{
                            width: `${dims.qrSizePreviewPx}px`,
                            height: `${dims.qrSizePreviewPx}px`
                          }}
                        >
                          {batchPreviewQrUrl ? (
                            <img 
                              src={batchPreviewQrUrl} 
                              alt="QR Code" 
                              className="w-full h-full object-contain"
                            />
                          ) : (
                            <QrCode className="w-full h-full text-[#002B66]" />
                          )}
                        </div>

                        {/* 3. QR Code Identifier Text */}
                        <div
                          className="font-mono font-black text-[#002B66] leading-none shrink-0"
                          style={{ fontSize: `${dims.fontSizeQrCodePx}px` }}
                        >
                          {activeAsset.qr_code || activeAsset.tag_number || activeAsset.id_aset}
                        </div>

                        {/* 4. Asset Name */}
                        {batchIncludeName && (
                          <div
                            className="font-extrabold text-gray-900 leading-tight shrink-0 line-clamp-2"
                            style={{
                              fontSize: `${dims.fontSizeNamePx}px`,
                              maxHeight: `${dims.fontSizeNamePx * 2.4}px`,
                              overflow: 'hidden'
                            }}
                          >
                            {activeAsset.nama}
                          </div>
                        )}

                        {/* 5. Tag Number & Asset Number (Borderless) */}
                        {batchIncludeNumbers && (activeAsset.tag_number || activeAsset.asset_number || activeAsset.id_aset) && (
                          <div
                            className="bg-slate-100 text-[#002B66] rounded px-1.5 py-0.5 font-mono font-bold leading-tight w-full shrink-0 flex flex-col items-center justify-center"
                            style={{ fontSize: `${dims.fontSizeNumbersPx}px`, border: 'none' }}
                          >
                            {activeAsset.tag_number && (
                              <div className="truncate w-full text-center">Tag: {activeAsset.tag_number}</div>
                            )}
                            {activeAsset.asset_number ? (
                              <div className="truncate w-full text-center">Asset: {activeAsset.asset_number}</div>
                            ) : (
                              <div className="truncate w-full text-center">Asset: {activeAsset.id_aset}</div>
                            )}
                          </div>
                        )}

                        {/* 6. Current PIC & Bidang */}
                        {batchIncludePic && (activeAsset.nama_bidang_sekarang || activeAsset.nama_pic_sekarang) && (
                          <div
                            className="text-slate-600 font-semibold leading-none shrink-0 truncate w-full text-center"
                            style={{ fontSize: `${dims.fontSizePicPx}px` }}
                          >
                            {activeAsset.nama_bidang_sekarang ? `Bidang: ${activeAsset.nama_bidang_sekarang}` : ''}
                            {activeAsset.nama_pic_sekarang ? ` | PIC: ${activeAsset.nama_pic_sekarang}` : ''}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })()}

                {/* Progress bar during batch generation */}
                {isGeneratingBatchPdf && (
                  <div className="w-full mt-3 bg-white p-3 rounded-xl border border-indigo-100 shadow-xs space-y-1.5">
                    <div className="flex items-center justify-between text-xs font-semibold text-indigo-900">
                      <span>{batchProgress.stage}</span>
                      <span>{batchProgress.current} / {batchProgress.total}</span>
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div
                        className="bg-indigo-600 h-2 rounded-full transition-all duration-200"
                        style={{
                          width: `${Math.round((batchProgress.current / Math.max(1, batchProgress.total)) * 100)}%`
                        }}
                      />
                    </div>
                  </div>
                )}

              </div>
            </div>

            {/* Footer Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-100 shrink-0">
              <div className="text-xs text-gray-500">
                Total: <strong>{selectedAssets.length} stiker label roll</strong> siap diproses.
              </div>

              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  onClick={() => setShowBatchModal(false)}
                  className="px-3.5 py-2 rounded-xl text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-700 transition-colors cursor-pointer"
                >
                  Tutup
                </button>

                <button
                  type="button"
                  onClick={handleBatchDownloadPdf}
                  disabled={isGeneratingBatchPdf}
                  className="bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-sm hover:shadow transition-all cursor-pointer"
                  title="Unduh 1 file PDF multi-halaman untuk stiker roll continuous"
                >
                  {isGeneratingBatchPdf ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Memproses ({batchProgress.current}/{batchProgress.total})...</span>
                    </>
                  ) : (
                    <>
                      <FileDown className="w-3.5 h-3.5" />
                      <span>Unduh PDF Roll</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleBatchPrintDirect}
                  disabled={isGeneratingBatchPdf}
                  className="bg-[#002B66] hover:bg-[#001D47] disabled:opacity-50 text-white px-4 py-2 rounded-xl text-xs font-bold flex items-center space-x-1.5 shadow-md hover:shadow-lg transition-all cursor-pointer"
                  title="Cetak langsung seluruh stiker roll ke printer thermal"
                >
                  <Printer className="w-4 h-4" />
                  <span>Cetak Langsung ({selectedAssets.length} Label)</span>
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
