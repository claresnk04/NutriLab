import {
  addDoc,
  collection,
  deleteField,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { FoodEntry } from './types';

function entriesPath(uid: string) {
  return collection(db, 'users', uid, 'entries');
}

function toDate(value: unknown) {
  if (
    value &&
    typeof value === 'object' &&
    'toDate' in value &&
    typeof value.toDate === 'function'
  ) {
    return value.toDate() as Date;
  }
  return value instanceof Date ? value : undefined;
}

function fromFirestore(id: string, data: Record<string, unknown>): FoodEntry {
  return {
    ...(data as Omit<FoodEntry, 'id' | 'dibuatPada' | 'diubahPada' | 'dihapusPada'>),
    id,
    dibuatPada: toDate(data.dibuatPada),
    diubahPada: toDate(data.diubahPada),
    dihapusPada: toDate(data.dihapusPada) ?? null,
  };
}

export async function saveEntry(entry: FoodEntry) {
  const payload = { ...entry };
  const id = payload.id;
  delete payload.id;
  delete payload.dibuatPada;
  delete payload.diubahPada;
  if (id) {
    await setDoc(
      doc(entriesPath(entry.uid), id),
      {
        ...payload,
        diubahPada: serverTimestamp(),
      },
      { merge: true },
    );
    return id;
  }
  const ref = await addDoc(entriesPath(entry.uid), {
    ...payload,
    dibuatPada: serverTimestamp(),
    diubahPada: serverTimestamp(),
    dihapusPada: null,
  });
  return ref.id;
}

export async function listEntries(uid: string) {
  const result = await getDocs(query(entriesPath(uid), orderBy('dibuatPada', 'desc')));
  return result.docs
    .map((item) => fromFirestore(item.id, item.data() as Record<string, unknown>))
    .filter((entry) => !entry.dihapusPada);
}

export async function listEntriesByDay(uid: string, day: string) {
  const result = await getDocs(query(entriesPath(uid), where('status', '==', 'dimakan')));
  return result.docs
    .map((item) => fromFirestore(item.id, item.data() as Record<string, unknown>))
    .filter((entry) => !entry.dihapusPada && entry.waktuMakan?.startsWith(day));
}

export async function softDeleteEntry(uid: string, id: string) {
  await setDoc(
    doc(entriesPath(uid), id),
    {
      dihapusPada: serverTimestamp(),
      diubahPada: serverTimestamp(),
    },
    { merge: true },
  );
}

export { deleteField };
