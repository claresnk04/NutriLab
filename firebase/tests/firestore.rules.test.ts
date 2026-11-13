import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterAll, beforeAll, beforeEach, describe, it } from 'vitest';
import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestEnvironment,
} from '@firebase/rules-unit-testing';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';

// Dijalankan lewat: npm run test:rules (root) -> firebase emulators:exec.
let env: RulesTestEnvironment;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-nutri-lab',
    firestore: {
      rules: readFileSync(resolve(import.meta.dirname, '../firestore.rules'), 'utf8'),
      host: '127.0.0.1',
      port: 8081,
    },
  });
});

beforeEach(async () => {
  await env.clearFirestore();
});

afterAll(async () => {
  await env?.cleanup();
});

describe('firestore.rules', () => {
  it('pengguna dapat membaca dan menulis entri miliknya', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    const ref = doc(alice, 'users/alice/entries/e1');
    await assertSucceeds(
      setDoc(ref, {
        uid: 'alice',
        jenisProduk: 'makanan',
        basisTabel: 'per_sajian',
        nilaiLabel: {},
        nSajian: 1,
        status: 'dicek',
        zonaWaktu: 'Asia/Jakarta',
        dikonfirmasiPengguna: true,
        hasilSnapshot: {},
        configVersion: '0.3-default',
      }),
    );
    await assertSucceeds(getDoc(ref));
  });

  it('pengguna tidak dapat membaca data pengguna lain', async () => {
    await env.withSecurityRulesDisabled(async (ctx) => {
      await setDoc(doc(ctx.firestore(), 'users/bob/entries/e1'), { status: 'dimakan' });
    });
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(getDoc(doc(alice, 'users/bob/entries/e1')));
  });

  it('pengguna tanpa login ditolak', async () => {
    const anon = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(anon, 'users/alice/profiles/p1')));
  });

  it('pemilik dapat menghapus datanya (F13-4)', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    const ref = doc(alice, 'users/alice/consents/c1');
    await assertSucceeds(setDoc(ref, { versi: '1.0' }));
    await assertSucceeds(deleteDoc(ref));
  });

  it('config_parameters dapat dibaca pengguna login tetapi tidak dapat ditulis', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertSucceeds(getDoc(doc(alice, 'config_parameters/p1')));
    await assertFails(setDoc(doc(alice, 'config_parameters/p1'), { nilai: 1 }));
  });

  it('audit_log tidak dapat diakses klien', async () => {
    const alice = env.authenticatedContext('alice').firestore();
    await assertFails(getDoc(doc(alice, 'audit_log/a1')));
  });
});
