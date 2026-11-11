import { Pengajuan, User } from '../types';

export interface ApprovalPermission {
  allowed: boolean;
  reason?: string;
}

/**
 * Validates whether the current logged-in user has permission to approve/reject a pengajuan.
 * Rules:
 * 1. Transfer Antar Bidang: MUST be approved by Bidang Tujuan (PIC/Anggota Bidang Tujuan) or Fungsi Umum (Admin). Cannot be approved by origin department or requester.
 * 2. Pemakaian Lapangan / Perubahan Status / Disposal: MUST be approved by Bidang Terkait (Bidang Asal Aset) or Fungsi Umum (Admin).
 */
export function canUserApprovePengajuan(p: Pengajuan, currentUser: User | null): ApprovalPermission {
  if (!currentUser) {
    return { allowed: false, reason: 'Pengguna tidak terautentikasi' };
  }

  // 1. Admin / Fungsi Umum has full approval authority for all requests
  if (currentUser.role === 'admin') {
    return { allowed: true };
  }

  // Check if current user is the requester account
  const isRequesterAccount = Boolean(
    (p.pemohon_id && p.pemohon_id === currentUser.id) ||
    (p.pemohon_nama && currentUser.nama && p.pemohon_nama.trim().toLowerCase() === currentUser.nama.trim().toLowerCase())
  );

  // Check if current user belongs to the origin department (Bidang Asal / Bidang Aset)
  const isOriginBidang = Boolean(
    (p.id_bidang_asal && currentUser.id_bidang && p.id_bidang_asal === currentUser.id_bidang) ||
    (p.nama_bidang_asal && currentUser.nama_bidang && p.nama_bidang_asal.trim().toLowerCase() === currentUser.nama_bidang.trim().toLowerCase())
  );

  // -------------------------------------------------------------
  // PERBEDAAN 1: TRANSFER ANTAR BIDANG
  // Approve oleh: Bidang Tujuan atau Fungsi Umum (Admin)
  // -------------------------------------------------------------
  if (p.jenis === 'Transfer') {
    // Cannot be approved by requester or origin department
    if (isRequesterAccount || isOriginBidang) {
      return {
        allowed: false,
        reason: `Pengajuan transfer bidang tidak dapat disetujui oleh akun/bidang pengaju (${p.nama_bidang_asal || 'Bidang Asal'}). Harus disetujui oleh PIC Bidang Tujuan (${p.nama_bidang_tujuan || 'Tujuan'}) atau Fungsi Umum.`
      };
    }

    // Must belong to Target Department or be Target PIC
    const isTargetBidang = Boolean(
      (p.id_bidang_tujuan && currentUser.id_bidang && p.id_bidang_tujuan === currentUser.id_bidang) ||
      (p.id_pic_tujuan && p.id_pic_tujuan === currentUser.id) ||
      (p.nama_bidang_tujuan && currentUser.nama_bidang && p.nama_bidang_tujuan.trim().toLowerCase() === currentUser.nama_bidang.trim().toLowerCase())
    );

    if (isTargetBidang) {
      return { allowed: true };
    }

    return {
      allowed: false,
      reason: `Pengajuan transfer bidang harus disetujui oleh PIC Bidang Tujuan (${p.nama_bidang_tujuan || 'Tujuan'}) atau Fungsi Umum.`
    };
  }

  // -------------------------------------------------------------
  // PERBEDAAN 3: DISPOSAL (PENGHAPUSAN ASET)
  // Approve oleh: HANYA Fungsi Umum (Admin)
  // -------------------------------------------------------------
  if (p.jenis === 'Disposal') {
    return {
      allowed: false,
      reason: 'Pengajuan disposal (penghapusan) aset hanya dapat disetujui/ditolak oleh Fungsi Umum (Admin).'
    };
  }

  // -------------------------------------------------------------
  // PERBEDAAN 2: PEMAKAIAN LAPANGAN / PERUBAHAN STATUS / PEMUTAKHIRAN
  // Approve oleh: Bidang Terkait (Bidang Asal) atau Fungsi Umum (Admin)
  // -------------------------------------------------------------
  if (!isOriginBidang) {
    return {
      allowed: false,
      reason: `Pengajuan ini memerlukan persetujuan dari PIC Bidang Terkait (${p.nama_bidang_asal || 'Bidang Asal'}) atau Fungsi Umum.`
    };
  }

  // Must be PIC Bidang, Management, Pimpinan, or Admin of the origin department
  if (currentUser.role === 'pic_bidang' || currentUser.role === 'management' || currentUser.role === 'pimpinan') {
    return { allowed: true };
  }

  return {
    allowed: false,
    reason: `Pengajuan harus disetujui oleh PIC Bidang Terkait (${p.nama_bidang_asal || 'Bidang Asal'}) atau Fungsi Umum.`
  };
}

