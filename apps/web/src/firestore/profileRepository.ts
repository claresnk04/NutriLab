import { doc, getDoc, serverTimestamp, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import type { UserProfile } from './types';

export async function saveProfile(uid: string, profile: UserProfile) {
  await setDoc(
    doc(db, 'users', uid),
    {
      profile,
      diubahPada: serverTimestamp(),
    },
    { merge: true },
  );
}

export async function getProfile(uid: string) {
  const snapshot = await getDoc(doc(db, 'users', uid));
  return (snapshot.data()?.profile as UserProfile | undefined) ?? {};
}
