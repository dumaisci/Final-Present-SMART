import React, { useState, useEffect } from 'react';
import { Aset, Bidang, User } from '../types';
import { ArrowRightLeft, X, UserCheck, Building2, User as UserIcon, HardHat, Info, ShieldCheck, UserCog } from 'lucide-react';

interface AssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  aset: Aset | null;
  bidangList: Bidang[];
  userList: User[];
  currentUser: User;
  onAssignSubmit: (
    id: string, 
    data: { 
      id_bidang: string; 
      id_pic: string; 
      nama_pemegang_terakhir?: string;
      keterangan: string; 
      diserah_oleh: string 
    }
  ) => Promise<void>;
}

export const AssignmentModal: React.FC<AssignmentModalProps> = ({
  isOpen,
  onClose,
  aset,
  bidangList,
  userList,
  currentUser,
  onAssignSubmit
}) => {
  if (!isOpen || !aset) return null;

  const [selectedBidang, setSelectedBidang] = useState(aset.id_bidang_sekarang || bidangList[0]?.id_bidang || '');
  const [selectedPic, setSelectedPic] = useState(aset.id_pic_sekarang || userList[0]?.id || '');
  
  // Pemegang Terakhir / Personel Lapangan State
  const [pemegangType, setPemegangType] = useState<'pic' | 'staff' | 'custom'>('pic');
  const [selectedStaffId, setSelectedStaffId] = useState<string>('');
  const [customPemegangName, setCustomPemegangName] = useState<string>('');

  const [keterangan, setKeterangan] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Users in selected bidang
  const usersInBidang = userList.filter(u => u.id_bidang === selectedBidang);

  // Sync PIC when selectedBidang changes
  useEffect(() => {
    const picForBidang = userList.find(u => u.id_bidang === selectedBidang && u.role === 'pic_bidang') || usersInBidang[0];
    if (picForBidang) {
      setSelectedPic(picForBidang.id);
    }
    if (usersInBidang.length > 0) {
      setSelectedStaffId(usersInBidang[0].id);
    }
  }, [selectedBidang]);

  const handlePicChange = (newPicId: string) => {
    setSelectedPic(newPicId);
    const picObj = userList.find(u => u.id === newPicId);
    if (picObj && picObj.id_bidang && picObj.id_bidang !== selectedBidang) {
      setSelectedBidang(picObj.id_bidang);
    }
  };

  const getFinalHolderName = (): string => {
    const activePic = userList.find(u => u.id === selectedPic);
    if (pemegangType === 'custom' && customPemegangName.trim()) {
      return customPemegangName.trim();
    }
    if (pemegangType === 'staff' && selectedStaffId) {
      const staffObj = userList.find(u => u.id === selectedStaffId);
      if (staffObj) return staffObj.nama;
    }
    return activePic?.nama || aset.nama_pic_sekarang;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const holderName = getFinalHolderName();
      await onAssignSubmit(aset.id_aset, {
        id_bidang: selectedBidang,
        id_pic: selectedPic,
        nama_pemegang_terakhir: holderName,
        keterangan,
        diserah_oleh: currentUser.nama
      });
      setIsSubmitting(false);
      onClose();
    } catch (err) {
      console.error(err);
      setIsSubmitting(false);
    }
  };

  const currentPicObj = userList.find(u => u.id === selectedPic);
  const currentBidangObj = bidangList.find(b => b.id_bidang === selectedBidang);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-xs z-50 overflow-y-auto p-3 sm:p-4 md:p-6 flex items-start sm:items-center justify-center">
      <div className="bg-white rounded-2xl max-w-lg w-full p-4 sm:p-6 shadow-2xl border border-gray-100 my-auto max-h-[90vh] flex flex-col animate-in fade-in zoom-in-95">
        
        <div className="shrink-0 flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
          <div className="flex items-center space-x-2">
            <ArrowRightLeft className="w-5 h-5 text-[#005DAA]" />
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">Assignment / Serah Terima Aset</h3>
              <p className="text-[11px] text-slate-500">Penetapan Bidang, PIC, dan Pemegang Terakhir di Lapangan</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
            <UserCog className="w-5 h-5" />
          </button>
        </div>

        {/* Asset summary badge */}
        <div className="shrink-0 bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs space-y-1 mb-3">
          <div className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Aset Yang Diserahkan</div>
          <div className="font-bold text-[#002B66] text-sm">{aset.nama}</div>
          <div className="text-gray-600">ID: {aset.id_aset} | SN: {aset.nomor_seri}</div>
          <div className="text-slate-600 flex items-center space-x-2 pt-1 border-t border-slate-200/60 mt-1">
            <span><strong>Bidang Saat Ini:</strong> {aset.nama_bidang_sekarang}</span>
            <span>•</span>
            <span><strong>PIC:</strong> {aset.nama_pic_sekarang}</span>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="overflow-y-auto flex-1 min-h-0 space-y-4 text-xs pr-1">
          
          {/* Target Bidang */}
          <div>
            <label className="block font-semibold text-gray-700 mb-1 flex items-center space-x-1">
              <Building2 className="w-3.5 h-3.5 text-[#005DAA]" />
              <span>Bidang / Unit Pelayanan Penerima *</span>
            </label>
            <select
              value={selectedBidang}
              onChange={(e) => setSelectedBidang(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
            >
              {bidangList.map((b) => (
                <option key={b.id_bidang} value={b.id_bidang}>{b.nama_bidang} ({b.jenis})</option>
              ))}
            </select>
          </div>

          {/* Target PIC Bidang (Penanggung Jawab Utama) */}
          <div>
            <label className="block font-semibold text-gray-700 mb-1 flex items-center space-x-1">
              <UserCheck className="w-3.5 h-3.5 text-[#005DAA]" />
              <span>Person in Charge (PIC) Penanggung Jawab Bidang *</span>
            </label>
            <select
              value={selectedPic}
              onChange={(e) => handlePicChange(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
            >
              {userList.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nama} — {u.jabatan} ({u.nama_bidang})
                </option>
              ))}
            </select>
            <p className="text-[10px] text-slate-500 mt-1">
              * PIC Utama bertanggung jawab mengelola dan memutakhirkan aset bidang ini.
            </p>
          </div>

          {/* Traceability: Pemegang Lapangan / Karyawan Pemakai */}
          <div className="bg-sky-50/70 p-3.5 rounded-xl border border-sky-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-[#002B66] text-xs flex items-center space-x-1.5">
                <ShieldCheck className="w-4 h-4 text-[#008C45]" />
                <span>Personel / Pemegang Terakhir di Lapangan *</span>
              </label>
              <span className="text-[10px] bg-white text-sky-800 font-semibold px-2 py-0.5 rounded border border-sky-300">
                Lacak Pemakai Lapangan
              </span>
            </div>

            <p className="text-[10px] text-slate-600 leading-relaxed">
              Jika aset akan dipakai oleh personel/inspektor di lapangan, pilih atau masukan nama pengguna barang tersebut. Jika tidak diisi khusus, pertanggungjawaban kembali ke PIC Bidang ({currentPicObj?.nama || 'PIC'}).
            </p>

            <div className="space-y-2 pt-1">
              {/* Option 1: Standard PIC */}
              <label className="flex items-center space-x-2 text-xs bg-white p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="pemegangType"
                  value="pic"
                  checked={pemegangType === 'pic'}
                  onChange={() => setPemegangType('pic')}
                  className="text-[#002B66] focus:ring-[#002B66]"
                />
                <span className="font-medium text-slate-800">
                  Sesuai PIC Bidang ({currentPicObj?.nama || 'PIC Utama'})
                </span>
              </label>

              {/* Option 2: Select Staff in Scope Bidang */}
              <label className="flex items-center space-x-2 text-xs bg-white p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="pemegangType"
                  value="staff"
                  checked={pemegangType === 'staff'}
                  onChange={() => setPemegangType('staff')}
                  className="text-[#002B66] focus:ring-[#002B66]"
                />
                <span className="font-medium text-slate-800">
                  Pilih Karyawan / Staff dalam Scope ({currentBidangObj?.nama_bidang || 'Bidang'})
                </span>
              </label>

              {pemegangType === 'staff' && (
                <div className="pl-6 pt-1">
                  {usersInBidang.length > 0 ? (
                    <select
                      value={selectedStaffId}
                      onChange={(e) => setSelectedStaffId(e.target.value)}
                      className="w-full p-2 border border-sky-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-[#002B66]"
                    >
                      {usersInBidang.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nama} — {u.jabatan}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                      Tidak ada karyawan terdaftar lain di bidang ini. Silakan gunakan opsi nama manual di bawah.
                    </p>
                  )}
                </div>
              )}

              {/* Option 3: Manual Name Entry */}
              <label className="flex items-center space-x-2 text-xs bg-white p-2 rounded-lg border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="radio"
                  name="pemegangType"
                  value="custom"
                  checked={pemegangType === 'custom'}
                  onChange={() => setPemegangType('custom')}
                  className="text-[#002B66] focus:ring-[#002B66]"
                />
                <span className="font-medium text-slate-800">
                  Ketik Nama Personel / Inspector Lapangan Manual
                </span>
              </label>

              {pemegangType === 'custom' && (
                <div className="pl-6 pt-1">
                  <input
                    type="text"
                    required
                    placeholder="Contoh: Ahmad Zaki - Senior NDT Inspector Lapangan"
                    value={customPemegangName}
                    onChange={(e) => setCustomPemegangName(e.target.value)}
                    className="w-full p-2 border border-sky-300 rounded-lg text-xs bg-white focus:ring-2 focus:ring-[#002B66]"
                  />
                </div>
              )}
            </div>

            <div className="bg-white/80 p-2 rounded border border-sky-200 text-[11px] text-[#002B66] font-semibold flex items-center justify-between">
              <span>Hasil Tracing Pemegang Terakhir:</span>
              <span className="bg-[#002B66] text-white px-2 py-0.5 rounded font-bold">
                {getFinalHolderName()}
              </span>
            </div>
          </div>

          <div>
            <label className="block font-semibold text-gray-700 mb-1">Keterangan / Tujuan Serah Terima *</label>
            <textarea
              rows={2}
              required
              placeholder="Contoh: Penyerahan alat uji NDT untuk pemanduan lapangan proyek Kilang Pertamina RU II..."
              value={keterangan}
              onChange={(e) => setKeterangan(e.target.value)}
              className="w-full p-2.5 border border-gray-300 rounded-lg outline-hidden focus:ring-2 focus:ring-[#002B66]"
            />
          </div>

          <div className="shrink-0 flex items-center justify-end space-x-2 pt-3 border-t border-gray-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 bg-[#002B66] hover:bg-[#001D47] text-white rounded-lg font-bold shadow-md flex items-center space-x-2"
            >
              <span>{isSubmitting ? 'Memproses...' : 'Proses Serah Terima'}</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
