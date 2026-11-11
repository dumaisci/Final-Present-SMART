import React, { useState, useEffect } from 'react';
import { AuditLog } from '../types';
import { History, Search, Filter, Calendar, Package, User, RotateCcw } from 'lucide-react';
import { PaginationControls } from './PaginationControls';

interface AuditTrailViewProps {
  logs: AuditLog[];
}

export const AuditTrailView: React.FC<AuditTrailViewProps> = ({ logs }) => {
  const [searchAset, setSearchAset] = useState('');
  const [searchAktor, setSearchAktor] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [selectedType, setSelectedType] = useState('All');

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const types = [
    'Create Aset',
    'Update Status',
    'Assignment',
    'Update Kalibrasi',
    'Ajukan Transfer',
    'Ajukan Disposal',
    'Approve Request',
    'Reject Request',
    'User Login'
  ];

  const handleResetFilters = () => {
    setSearchAset('');
    setSearchAktor('');
    setFilterDate('');
    setSelectedType('All');
  };

  const filteredLogs = logs.filter((l) => {
    const qAset = searchAset.toLowerCase();
    const qAktor = searchAktor.toLowerCase();

    const matchesAset = 
      !searchAset ||
      (l.nama_aset || '').toLowerCase().includes(qAset) ||
      (l.id_aset || '').toLowerCase().includes(qAset) ||
      (l.detail || '').toLowerCase().includes(qAset);

    const matchesAktor = 
      !searchAktor ||
      (l.aktor || '').toLowerCase().includes(qAktor);

    const matchesType = selectedType === 'All' || l.jenis_perubahan === selectedType;

    let matchesDate = true;
    if (filterDate) {
      try {
        const logDateObj = new Date(l.waktu);
        const yyyy = logDateObj.getFullYear();
        const mm = String(logDateObj.getMonth() + 1).padStart(2, '0');
        const dd = String(logDateObj.getDate()).padStart(2, '0');
        const formattedLogDate = `${yyyy}-${mm}-${dd}`;
        matchesDate = formattedLogDate === filterDate;
      } catch {
        matchesDate = l.waktu.includes(filterDate);
      }
    }

    return matchesAset && matchesAktor && matchesType && matchesDate;
  });

  useEffect(() => {
    setCurrentPage(1);
  }, [searchAset, searchAktor, filterDate, selectedType]);

  const totalItems = filteredLogs.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startIndex = (currentPage - 1) * pageSize;
  const paginatedLogs = filteredLogs.slice(startIndex, startIndex + pageSize);

  return (
    <div className="space-y-5">
      
      {/* Header */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-bold text-slate-900 flex items-center space-x-2">
            <History className="w-5 h-5 text-[#005DAA]" />
            <span>Audit Trail & Log Activity Sistem (Fungsi Umum)</span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Pencatatan riwayat lengkap seluruh perubahan data aset (siapa, kapan, perubahan apa) untuk akuntabilitas.
          </p>
        </div>
        <div className="text-right text-xs text-slate-500">
          Total Log Ditemukan: <strong className="text-[#005DAA] font-extrabold">{filteredLogs.length}</strong>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-xs space-y-3 text-xs">
        <div className="font-bold text-slate-700 flex items-center justify-between">
          <span className="flex items-center space-x-1.5">
            <Filter className="w-4 h-4 text-[#005DAA]" />
            <span>Filter & Pencatatan Audit:</span>
          </span>
          {(searchAset || searchAktor || filterDate || selectedType !== 'All') && (
            <button
              onClick={handleResetFilters}
              className="text-rose-600 hover:text-rose-800 font-bold text-[11px] flex items-center space-x-1"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Filter</span>
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          
          {/* Search Nama Barang / Aset */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Cari Nama Barang / Aset:</label>
            <div className="relative">
              <Package className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Contoh: Digital Multimeter..."
                value={searchAset}
                onChange={(e) => setSearchAset(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
              />
            </div>
          </div>

          {/* Search Tanggal Perubahan */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Cari Tanggal Perubahan:</label>
            <div className="relative">
              <Calendar className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="date"
                value={filterDate}
                onChange={(e) => setFilterDate(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66] bg-white"
              />
            </div>
          </div>

          {/* Search Aktor / Pengguna */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Cari Aktor / Pengguna:</label>
            <div className="relative">
              <User className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Contoh: Budi Santoso..."
                value={searchAktor}
                onChange={(e) => setSearchAktor(e.target.value)}
                className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
              />
            </div>
          </div>

          {/* Filter Jenis Perubahan */}
          <div>
            <label className="block text-[11px] font-bold text-slate-600 mb-1">Jenis Perubahan:</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="w-full py-2 px-3 border border-gray-200 rounded-lg text-xs bg-white text-gray-700 outline-hidden focus:ring-2 focus:ring-[#002B66]"
            >
              <option value="All">Semua Jenis Perubahan</option>
              {types.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

        </div>
      </div>

      {/* Logs Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 border-b border-gray-200 text-gray-600 font-bold uppercase tracking-wider">
                <th className="py-3 px-4">Waktu Perubahan</th>
                <th className="py-3 px-4">Aktor / Pengguna</th>
                <th className="py-3 px-4">Jenis Perubahan</th>
                <th className="py-3 px-4">Aset Terkait (Nama Barang)</th>
                <th className="py-3 px-4">Detail Perubahan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 font-medium">
              {totalItems === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-10 text-gray-400">
                    Tidak ada catatan audit trail yang sesuai kriteria pencarian.
                  </td>
                </tr>
              ) : (
                paginatedLogs.map((log) => (
                  <tr key={log.id_log} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 text-gray-700 font-semibold whitespace-nowrap text-[11px]">
                      {new Date(log.waktu).toLocaleString('id-ID', {
                        day: '2-digit',
                        month: 'short',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </td>

                    <td className="py-3 px-4">
                      <div className="font-bold text-gray-900">{log.aktor}</div>
                      <span className="text-[10px] text-sky-700 bg-sky-50 px-1.5 py-0.5 rounded border border-sky-200 inline-block mt-0.5 font-bold">
                        {log.role_aktor}
                      </span>
                    </td>

                    <td className="py-3 px-4">
                      <span className={`inline-block px-2 py-0.5 rounded font-bold text-[10px] ${
                        log.jenis_perubahan.includes('Approve') ? 'bg-emerald-100 text-emerald-800' :
                        log.jenis_perubahan.includes('Reject') ? 'bg-rose-100 text-rose-800' :
                        log.jenis_perubahan.includes('Create') ? 'bg-sky-100 text-sky-800' :
                        'bg-slate-100 text-slate-800'
                      }`}>
                        {log.jenis_perubahan}
                      </span>
                    </td>

                    <td className="py-3 px-4 text-[#005DAA] font-bold max-w-xs truncate">
                      {log.nama_aset || log.id_aset || '-'}
                    </td>

                    <td className="py-3 px-4 text-gray-600 max-w-md text-[11px] leading-relaxed">
                      {log.detail}
                    </td>
                  </tr>
                ))
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

    </div>
  );
};
