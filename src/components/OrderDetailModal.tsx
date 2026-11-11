import React, { useState, useEffect } from 'react';
import { Order } from '../types';
import { apiClient } from '../lib/apiClient';
import { 
  Receipt, 
  X, 
  Loader2, 
  AlertTriangle, 
  Info, 
  CheckCircle2, 
  Clock, 
  Coins, 
  Percent, 
  Calendar,
  AlertCircle
} from 'lucide-react';

interface OrderDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
  nomorOrder: string;
}

export const OrderDetailModal: React.FC<OrderDetailModalProps> = ({
  isOpen,
  onClose,
  nomorOrder
}) => {
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [orderData, setOrderData] = useState<Order | null>(null);
  const [alokasiData, setAlokasiData] = useState<any | null>(null);

  useEffect(() => {
    if (isOpen && nomorOrder) {
      loadAllocationData(nomorOrder);
    }
  }, [isOpen, nomorOrder]);

  const loadAllocationData = async (noOrder: string) => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await apiClient.getOrderAlokasi(noOrder);
      setOrderData(res.order);
      setAlokasiData(res.alokasi);
    } catch (err: any) {
      setErrorMsg(err.message || 'Gagal memuat rincian alokasi order');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  const hasUnallocatedWithoutValue = alokasiData?.sesi_tidak_dialokasikan?.some(
    (s: any) => s.alasan?.includes('Nilai Perolehan')
  );

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-xs z-50 overflow-y-auto p-3 sm:p-4 md:p-6 flex items-center justify-center animate-in fade-in">
      <div className="bg-white rounded-2xl max-w-4xl w-full p-5 sm:p-6 shadow-2xl border border-slate-200 my-auto max-h-[92vh] flex flex-col animate-in zoom-in-95">
        
        {/* Modal Header */}
        <div className="shrink-0 flex items-start justify-between pb-3 border-b border-slate-200 mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-[#002B66] flex items-center justify-center border border-blue-200">
              <Receipt className="w-5 h-5 text-[#005DAA]" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="font-extrabold text-slate-900 text-base">Detail Alokasi Pendapatan Order</h3>
                <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded text-xs">
                  {nomorOrder}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Rincian proporsional pendapatan per aset berdasarkan jam operasional dan nilai perolehan
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center space-y-3 text-slate-500">
            <Loader2 className="w-6 h-6 animate-spin text-[#005DAA]" />
            <span className="text-xs font-semibold">Menghitung alokasi pendapatan riil aset...</span>
          </div>
        ) : errorMsg ? (
          <div className="p-4 bg-rose-50 border border-rose-200 text-rose-900 rounded-xl text-xs space-y-3">
            <div className="flex items-center space-x-2 font-bold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
              <span>{errorMsg}</span>
            </div>
            <button
              onClick={() => loadAllocationData(nomorOrder)}
              className="px-3 py-1.5 bg-rose-600 text-white rounded-lg text-xs font-bold"
            >
              Coba Lagi
            </button>
          </div>
        ) : (
          <div className="overflow-y-auto flex-1 min-h-0 space-y-4 pr-1 text-xs text-slate-800">
            
            {/* Dynamic Allocation Note (Catatan Wajib Tahap 3) */}
            <div className="p-3 bg-blue-50/80 border border-blue-200 rounded-xl text-blue-950 flex items-start space-x-2.5">
              <Info className="w-4 h-4 text-[#005DAA] shrink-0 mt-0.5" />
              <div className="space-y-0.5 leading-relaxed">
                <span className="font-extrabold text-[11px] block uppercase tracking-wider text-blue-900">
                  Catatan Alokasi Dinamis (Cut-off H-1):
                </span>
                <p className="text-[11px] text-blue-800">
                  Sistem tidak menerapkan penutupan order statis. Nilai pendapatan teralokasi dihitung secara dinamis dari seluruh sesi yang telah selesai (check-in) hingga kemarin 23:59:59 (cut-off H-1). 
                  <strong> Angka teralokasi dapat bergeser secara proporsional jika terdapat sesi operasional baru yang masuk</strong> menggunakan nomor order ini.
                </p>
              </div>
            </div>

            {/* Peringatan jika terdapat sesi tanpa nilai perolehan (Peringatan Wajib Tahap 3) */}
            {hasUnallocatedWithoutValue && (
              <div className="p-3 bg-amber-50 border border-amber-300 rounded-xl text-amber-950 flex items-start space-x-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5 leading-relaxed">
                  <span className="font-extrabold text-[11px] block uppercase tracking-wider text-amber-900">
                    Peringatan: Terdapat Sesi Belum Memiliki Nilai Perolehan
                  </span>
                  <p className="text-[11px] text-amber-800">
                    Sebagian sesi operasional aset belum dialokasikan pendapatannya karena aset terkait belum memiliki Nilai Perolehan di database. Jam pakai sesi tersebut tetap tercatat pada utilisasi waktu, namun dikecualikan dari pembagian bobot revenue.
                  </p>
                </div>
              </div>
            )}

            {/* Order Overview Summary Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Nilai Order</span>
                <div className="text-base font-extrabold text-emerald-700 font-mono mt-0.5">
                  Rp {Math.round(orderData?.nilai_order || 0).toLocaleString('id-ID')}
                </div>
                <span className="text-[10px] text-slate-500 truncate block">{orderData?.nama_order || 'Operasional Lapangan'}</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Bobot Order</span>
                <div className="text-base font-extrabold text-indigo-700 font-mono mt-0.5">
                  {Number(alokasiData?.total_bobot || 0).toLocaleString('id-ID')}
                </div>
                <span className="text-[10px] text-slate-500">Nilai Perolehan × Jam</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Total Jam Teralokasi</span>
                <div className="text-base font-extrabold text-blue-700 font-mono mt-0.5">
                  {Number(alokasiData?.total_jam_teralokasi || 0).toFixed(1)} Jam
                </div>
                <span className="text-[10px] text-slate-500">{alokasiData?.rincian?.length || 0} sesi selesai</span>
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Status Alokasi</span>
                <div className="text-sm font-extrabold text-slate-800 mt-1 flex items-center space-x-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  <span>{alokasiData?.rincian?.length > 0 ? '100% Teralokasi' : 'Belum Ada Sesi'}</span>
                </div>
                <span className="text-[10px] text-slate-400">Total alokasi = Nilai order</span>
              </div>
            </div>

            {/* Table of Allocated Sessions */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h4 className="font-extrabold text-slate-900 text-xs uppercase tracking-wider">
                  Rincian Alokasi per Sesi Operasi Aset ({alokasiData?.rincian?.length || 0})
                </h4>
                <span className="text-[10px] text-slate-500">
                  Pembulatan ke Rupiah bulat (selisih disesuaikan ke bobot tertinggi)
                </span>
              </div>

              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 text-slate-600 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-2.5 px-3">No</th>
                        <th className="py-2.5 px-3">Aset</th>
                        <th className="py-2.5 px-3 text-right">Nilai Perolehan</th>
                        <th className="py-2.5 px-3 text-right">Jam Pakai</th>
                        <th className="py-2.5 px-3 text-right">Bobot Sesi</th>
                        <th className="py-2.5 px-3 text-right">Porsi (%)</th>
                        <th className="py-2.5 px-3 text-right">Pendapatan Teralokasi</th>
                        <th className="py-2.5 px-3">Tgl Check-In</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {alokasiData?.rincian?.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center text-slate-400">
                            Belum ada sesi operasional yang selesai (check-in) dengan nomor order ini hingga batas cut-off H-1.
                          </td>
                        </tr>
                      ) : (
                        alokasiData?.rincian?.map((r: any, idx: number) => (
                          <tr key={`${r.id_aset}_${idx}`} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                            <td className="py-2.5 px-3">
                              <div className="font-bold text-slate-900">{r.nama_aset}</div>
                              <div className="text-[10px] text-slate-400 font-mono">{r.id_aset}</div>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-700">
                              Rp {Math.round(r.nilai_perolehan || 0).toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-blue-700">
                              {Number(r.durasi_jam || 0).toFixed(1)} h
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                              {Number(r.bobot || 0).toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">
                              {Number(r.persentase || 0).toFixed(2)}%
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-extrabold text-emerald-700">
                              Rp {Math.round(r.pendapatan || 0).toLocaleString('id-ID')}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500 text-[11px] whitespace-nowrap">
                              {r.selesai ? new Date(r.selesai).toLocaleDateString('id-ID', {
                                day: '2-digit', month: 'short', year: 'numeric'
                              }) : '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {alokasiData?.rincian?.length > 0 && (
                      <tfoot className="bg-slate-50/90 font-bold text-slate-900 border-t border-slate-200">
                        <tr>
                          <td colSpan={3} className="py-2.5 px-3 text-right uppercase text-[10px] tracking-wider text-slate-500">
                            Total Teralokasi:
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-blue-800">
                            {Number(alokasiData?.total_jam_teralokasi || 0).toFixed(1)} h
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-700">
                            {Number(alokasiData?.total_bobot || 0).toLocaleString('id-ID')}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-900">
                            100%
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-emerald-800 font-extrabold">
                            Rp {Math.round(orderData?.nilai_order || 0).toLocaleString('id-ID')}
                          </td>
                          <td></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>

            {/* Sesi Tidak Dialokasikan (Jika Ada) */}
            {alokasiData?.sesi_tidak_dialokasikan?.length > 0 && (
              <div className="space-y-2 pt-2 border-t border-slate-100">
                <div className="flex items-center space-x-1.5 text-amber-800 font-bold text-xs">
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                  <span>Sesi Tidak Dialokasikan ({alokasiData.sesi_tidak_dialokasikan.length})</span>
                </div>

                <div className="border border-amber-200 rounded-xl overflow-hidden bg-amber-50/30">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-amber-100/60 border-b border-amber-200 text-amber-900 font-bold uppercase tracking-wider text-[10px]">
                        <th className="py-2 px-3">Aset</th>
                        <th className="py-2 px-3 text-right">Jam Pakai</th>
                        <th className="py-2 px-3">Tanggal Check-In</th>
                        <th className="py-2 px-3">Alasan Pengecualian</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-amber-100 font-medium text-amber-950">
                      {alokasiData.sesi_tidak_dialokasikan.map((u: any, idx: number) => (
                        <tr key={idx} className="hover:bg-amber-50">
                          <td className="py-2 px-3">
                            <span className="font-bold">{u.nama_aset}</span>{' '}
                            <span className="font-mono text-[10px] text-amber-700">({u.id_aset})</span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono font-semibold">
                            {Number(u.durasi_jam || 0).toFixed(1)} h
                          </td>
                          <td className="py-2 px-3 text-[11px] text-amber-800">
                            {u.selesai ? new Date(u.selesai).toLocaleDateString('id-ID') : 'Belum Check-In'}
                          </td>
                          <td className="py-2 px-3 text-rose-700 font-medium text-[11px]">
                            {u.alasan}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Footer Metadata */}
            <div className="pt-2 text-[10px] text-slate-400 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-1 border-t border-slate-100">
              <div>
                Order diinput oleh: <strong className="text-slate-600">{orderData?.dibuat_oleh || '-'}</strong> pada{' '}
                {orderData?.dibuat_pada ? new Date(orderData.dibuat_pada).toLocaleString('id-ID') : '-'}
              </div>
              <div>
                Batas Cut-off H-1:{' '}
                <span className="font-mono text-slate-600">
                  {alokasiData?.cut_off_digunakan ? new Date(alokasiData.cut_off_digunakan).toLocaleString('id-ID') : '-'}
                </span>
              </div>
            </div>

          </div>
        )}

        {/* Modal Footer */}
        <div className="shrink-0 flex items-center justify-end pt-3 border-t border-slate-200 mt-3">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
          >
            Tutup
          </button>
        </div>

      </div>
    </div>
  );
};
