import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

export async function saveConsent(uid: string, version = '1.0') {
  await addDoc(collection(db, 'users', uid, 'consents'), {
    versi: version,
    disetujuiPada: serverTimestamp(),
  });
}
