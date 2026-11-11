/**
 * Firebase Firestore Service - DEPRECATED & DISABLED
 * The application exclusively uses MongoDB Atlas via server.ts and mongoService.ts.
 */

import { Aset, Pengajuan, Bidang, User, AuditLog, RiwayatKalibrasi } from '../types';

export async function seedFirestoreIfEmpty() {
  // Firebase disabled - no-op
}

export function subscribeAsets(callback: (asets: Aset[]) => void) {
  return () => {};
}

export function subscribePengajuan(callback: (pengajuan: Pengajuan[]) => void) {
  return () => {};
}

export function subscribeAuditLogs(callback: (logs: AuditLog[]) => void) {
  return () => {};
}

export function subscribeUsers(callback: (users: User[]) => void) {
  return () => {};
}

export function subscribeBidang(callback: (bidang: Bidang[]) => void) {
  return () => {};
}

export function subscribeKalibrasi(callback: (kalibrasi: RiwayatKalibrasi[]) => void) {
  return () => {};
}

export async function upsertAsetFirestore(aset: Aset) {}
export async function addPengajuanFirestore(pengajuan: Pengajuan) {}
export async function updatePengajuanFirestore(id_pengajuan: string, updates: Partial<Pengajuan>) {}
export async function addAuditLogFirestore(log: AuditLog) {}
export async function addKalibrasiFirestore(kalibrasi: RiwayatKalibrasi) {}
export async function updateUserFirestore(user: User) {}
export async function deleteUserFirestore(id: string) {}
export async function deleteAsetFirestore(id: string) {}
