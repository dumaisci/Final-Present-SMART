import React, { useState, useEffect, useMemo } from 'react';
import { User, Order } from '../types';
import { apiClient } from '../lib/apiClient';
import { 
  FileSpreadsheet, 
  Plus, 
  Search, 
  AlertCircle, 
  CheckCircle2, 
  Loader2, 
  X, 
  Receipt,
  Building,
  ShieldCheck,
  Calendar,
  Lock,
  Eye
} from 'lucide-react';
import { OrderDetailModal } from './OrderDetailModal';

interface OrderManagementViewProps {
  currentUser: User;
}

export const OrderManagementView: React.FC<OrderManagementViewProps> = ({ currentUser }) => {
  const isFungsiUmum = currentUser.role === 'admin';
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  
  // Add Order Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [nomorOrderInput, setNomorOrderInput] = useState('');
  const [namaOrderInput, setNamaOrderInput] = useState('');
  const [nilaiOrderInput, setNilaiOrderInput] = useState<string | number>('');
  const [formError, setFormError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [toastMsg, setToastMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Detail Modal State (Tahap 3)
  const [selectedOrderForDetail, setSelectedOrderForDetail] = useState<string | null>(null);

  const fetchOrders = async (query = '') => {
    setIsLoading(true);
    try {
      const data = await apiClient.getOrders(query);
      setOrders(data);
    } catch (err: any) {
      console.error('Failed to load orders:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrders(searchQuery);
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchOrders(searchQuery);
  };

  const handleOpenAddModal = () => {
    setNomorOrderInput('');
    setNamaOrderInput('');
    setNilaiOrderInput('');
    setFormError('');
    setShowAddModal(true);
  };

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const cleanNomor = nomorOrderInput.trim().toUpperCase();
    if (!cleanNomor) {
      setFormError('Nomor Order wajib diisi.');
      return;
    }

    const numVal = Math.round(Number(nilaiOrderInput));
    if (isNaN(numVal) || numVal <= 0) {
      setFormError('Nilai Order harus berupa bilangan bulat Rupiah lebih dari 0.');
      return;
    }

    // Check duplicate locally first
    const isDup = orders.some(o => o.nomor_order.toUpperCase() === cleanNomor);
    if (isDup) {
      setFormError(`Nomor order '${cleanNomor}' sudah terdaftar dalam sistem.`);
      return;
    }

    setShowConfirmModal(true);
  };

  const handleConfirmSave = async () => {
    setIsSubmitting(true);
    setFormError('');
    const cleanNomor = nomorOrderInput.trim().toUpperCase();
    const numVal = Math.round(Number(nilaiOrderInput));

    try {
      await apiClient.createOrder({
        nomor_order: cleanNomor,
        nama_order: namaOrderInput.trim() || undefined,
        nilai_order: numVal
      });

      setShowConfirmModal(false);
      setShowAddModal(false);
      setToastMsg({ type: 'success', text: `✓ Order ${cleanNomor} berhasil disimpan secara permanen!` });
      setTimeout(() => setToastMsg(null), 5000);
      fetchOrders(searchQuery);
    } catch (err: any) {
      setShowConfirmModal(false);
      setFormError(err.message || 'Gagal menyimpan data order.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalNilaiAllOrders = useMemo(() => {
    return orders.reduce((acc, curr) => acc + (curr.nilai_order || 0), 0);
  }, [orders]);

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center space-x-2">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-[#002B66] flex items-center justify-center">
              <FileSpreadsheet className="w-5 h-5 text-[#005DAA]" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold text-slate-900 leading-tight">
                Data Order Pekerjaan
              </h1>
              <p className="text-xs text-slate-500">
                Pencatatan Nomor Order resmi untuk integrasi check-out scan aset operasional
              </p>
            </div>
          </div>
        </div>

        {/* Action Button: Only for Fungsi UMUM */}
        {isFungsiUmum ? (
          <button
            onClick={handleOpenAddModal}
            className="bg-[#002B66] hover:bg-[#001D47] text-white px-4 py-2.5 rounded-xl text-xs font-bold shadow-sm flex items-center space-x-1.5 transition-all cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Tambah Order Baru</span>
          </button>
        ) : (
          <div className="inline-flex items-center space-x-1.5 bg-slate-100 text-slate-600 px-3 py-1.5 rounded-xl text-xs font-semibold border border-slate-200">
            <Lock className="w-3.5 h-3.5 text-slate-500" />
            <span>Mode View-Only ({currentUser.role.toUpperCase()})</span>
          </div>
        )}
      </div>

      {/* Toast Notification */}
      {toastMsg && (
        <div className={`p-3.5 rounded-xl text-xs font-bold flex items-center space-x-2 border shadow-xs ${
          toastMsg.type === 'success' ? 'bg-emerald-50 text-emerald-900 border-emerald-300' : 'bg-rose-50 text-rose-900 border-rose-300'
        }`}>
          {toastMsg.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          ) : (
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          )}
          <span>{toastMsg.text}</span>
        </div>
      )}

      {/* Stats Summary Card */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Order Terdaftar</span>
          <div className="text-xl font-extrabold text-slate-900 mt-1 font-mono">{orders.length}</div>
          <span className="text-[11px] text-slate-500">Nomor order unik</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Total Nilai Order (Revenue)</span>
          <div className="text-xl font-extrabold text-emerald-700 mt-1 font-mono">
            Rp {totalNilaiAllOrders.toLocaleString('id-ID')}
          </div>
          <span className="text-[11px] text-slate-500">Akumulasi seluruh order</span>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">Hak Akses Modul</span>
          <div className="text-xs font-bold text-slate-800 mt-2 flex items-center space-x-1.5">
            <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>Fungsi UMUM: Tambah Order</span>
          </div>
          <span className="text-[10px] text-slate-500 mt-0.5 block">PUMA &amp; PIC: Akses Lihat Daftar</span>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <form onSubmit={handleSearchSubmit} className="relative flex-1 w-full">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Cari berdasarkan Nomor Order, Nama Order, atau Pembuat..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-24 py-2 border border-slate-200 rounded-lg text-xs outline-hidden focus:ring-2 focus:ring-[#002B66]"
          />
          <button
            type="submit"
            className="absolute right-1.5 top-1.5 px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-xs font-bold transition-colors cursor-pointer"
          >
            Cari
          </button>
        </form>

        {searchQuery && (
          <button
            onClick={() => {
              setSearchQuery('');
              fetchOrders('');
            }}
            className="text-xs font-bold text-slate-500 hover:text-slate-700 underline cursor-pointer shrink-0"
          >
            Reset Pencarian
          </button>
        )}
      </div>

      {/* Orders Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                <th className="py-3 px-4">No</th>
                <th className="py-3 px-4">Nomor Order</th>
                <th className="py-3 px-4">Nama Order / Pekerjaan</th>
                <th className="py-3 px-4">Nilai Order (Rp)</th>
                <th className="py-3 px-4">Dibuat Oleh</th>
                <th className="py-3 px-4">Tanggal Input</th>
                <th className="py-3 px-4 text-center">Aksi / Alokasi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="flex items-center justify-center space-x-2">
                      <Loader2 className="w-4 h-4 animate-spin text-[#005DAA]" />
                      <span>Memuat data order...</span>
                    </div>
                  </td>
                </tr>
              ) : orders.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Tidak ada data order yang ditemukan.
                  </td>
                </tr>
              ) : (
                orders.map((ord, idx) => (
                  <tr key={ord.nomor_order || idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                    <td className="py-3 px-4">
                      <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-[11px]">
                        {ord.nomor_order}
                      </span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{ord.nama_order || '-'}</div>
                      <div className="text-[10px] text-slate-400">Pekerjaan Operasional Lapangan</div>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-mono font-bold text-emerald-700 text-xs">
                        Rp {Math.round(ord.nilai_order).toLocaleString('id-ID')}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">
                      <div>{ord.dibuat_oleh}</div>
                    </td>
                    <td className="py-3 px-4 text-slate-500 text-[11px]">
                      {ord.dibuat_pada ? new Date(ord.dibuat_pada).toLocaleString('id-ID', {
                        day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
                      }) : '-'}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <button
                        type="button"
                        onClick={() => setSelectedOrderForDetail(ord.nomor_order)}
                        className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-[#002B66] border border-blue-200 rounded-lg text-[11px] font-bold inline-flex items-center space-x-1.5 transition-colors cursor-pointer shadow-2xs"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#005DAA]" />
                        <span>Detail Alokasi</span>
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* MODAL: Tambah Order Baru (Khusus Fungsi UMUM) */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 overflow-y-auto p-4 flex items-center justify-center">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 sm:p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-[#002B66] flex items-center justify-center">
                  <Receipt className="w-4 h-4 text-[#005DAA]" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-sm">Tambah Nomor Order Baru</h3>
                  <p className="text-[10px] text-slate-500">Input Data Order Pekerjaan (Fungsi UMUM)</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handlePreSubmit} className="space-y-4 py-3 text-xs">
              {/* Nomor Order */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nomor Order * <span className="text-[10px] text-slate-400">(Otomatis HURUF BESAR)</span>
                </label>
                <input
                  type="text"
                  required
                  placeholder="Contoh: ORD-2026-00126"
                  value={nomorOrderInput}
                  onChange={(e) => setNomorOrderInput(e.target.value.toUpperCase())}
                  className="w-full p-2.5 border border-slate-300 rounded-lg font-mono font-bold text-slate-900 outline-hidden focus:ring-2 focus:ring-[#002B66]"
                />
              </div>

              {/* Nama Order (Opsional) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nama Order / Pekerjaan <span className="text-slate-400 font-normal">(Opsional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Contoh: Inspeksi Boiler PT Pupuk Sriwidjaja"
                  value={namaOrderInput}
                  onChange={(e) => setNamaOrderInput(e.target.value)}
                  className="w-full p-2.5 border border-slate-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
                />
              </div>

              {/* Nilai Order (Rp) */}
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Nilai Order (Rp) * <span className="text-[10px] text-slate-400">(Bilangan bulat Rupiah)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 font-bold text-slate-400 text-xs">Rp</span>
                  <input
                    type="text"
                    required
                    placeholder="Contoh: 15.000.000"
                    value={nilaiOrderInput ? Number(nilaiOrderInput).toLocaleString('id-ID') : ''}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, '');
                      setNilaiOrderInput(raw ? Number(raw) : '');
                    }}
                    className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg font-mono font-bold text-emerald-700 text-sm outline-hidden focus:ring-2 focus:ring-[#002B66]"
                  />
                </div>
              </div>

              {formError && (
                <div className="p-3 bg-rose-50 border border-rose-300 rounded-xl text-rose-800 text-xs font-bold flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 border border-slate-300 rounded-lg font-bold text-slate-700 hover:bg-slate-50 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-[#002B66] hover:bg-[#001D47] text-white rounded-lg font-bold shadow-sm cursor-pointer"
                >
                  Lanjut Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Peringatan Konfirmasi Simpan Order (Aturan Kerja 5) */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black/75 backdrop-blur-xs z-60 flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-amber-300 space-y-4 animate-in zoom-in-95">
            <div className="flex items-center space-x-3 text-amber-600">
              <div className="w-11 h-11 rounded-full bg-amber-100 flex items-center justify-center shrink-0 border border-amber-300">
                <AlertCircle className="w-6 h-6 text-amber-700" />
              </div>
              <div>
                <h4 className="font-extrabold text-slate-900 text-sm">Peringatan Penyimpanan</h4>
                <p className="text-[11px] text-amber-700 font-semibold">Data Bersifat Permanen</p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs text-amber-950 font-medium leading-relaxed">
              Data tidak dapat diubah setelah disimpan. Periksa kembali sebelum melanjutkan.
            </div>

            <div className="text-xs bg-slate-50 p-3 rounded-xl border border-slate-200 space-y-1">
              <div>
                <span className="text-slate-500">Nomor Order:</span>{' '}
                <strong className="font-mono text-indigo-700 font-bold">{nomorOrderInput.trim().toUpperCase()}</strong>
              </div>
              <div>
                <span className="text-slate-500">Nama Order:</span>{' '}
                <strong className="text-slate-800">{namaOrderInput.trim() || '-'}</strong>
              </div>
              <div>
                <span className="text-slate-500">Nilai Order:</span>{' '}
                <strong className="font-mono text-emerald-700 font-bold">
                  Rp {Math.round(Number(nilaiOrderInput)).toLocaleString('id-ID')}
                </strong>
              </div>
            </div>

            <div className="flex items-center justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => setShowConfirmModal(false)}
                className="px-4 py-2 border border-slate-300 rounded-lg text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleConfirmSave}
                className="px-5 py-2 bg-[#002B66] hover:bg-[#001D47] text-white rounded-lg text-xs font-bold shadow-sm flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    <span>Menyimpan...</span>
                  </>
                ) : (
                  <span>Simpan</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Detail Alokasi Pendapatan Order (Tahap 3) */}
      {selectedOrderForDetail && (
        <OrderDetailModal
          isOpen={!!selectedOrderForDetail}
          onClose={() => setSelectedOrderForDetail(null)}
          nomorOrder={selectedOrderForDetail}
        />
      )}
    </div>
  );
};
