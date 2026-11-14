/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { executeFirstOfficerBootstrap } from './officerBootstrapCore.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

interface ParsedArgs {
  email?: string;
  uid?: string;
  password?: string;
  name?: string;
  department: string;
  sector: string;
  create: boolean;
  revoke: boolean;
  bootstrapFirst: boolean;
  bootstrapSecret?: string;
}

function parseCliArgs(argv: string[]): ParsedArgs {
  const args: ParsedArgs = {
    department: 'Colombo Municipal Flood Operations',
    sector: 'Sector 04 — Colombo Municipal Basin',
    create: false,
    revoke: false,
    bootstrapFirst: false,
  };

  for (let i = 0; i < argv.length; i++) {
    const token = argv[i];
    const next = argv[i + 1];
    switch (token) {
      case '--email':
        args.email = next;
        i++;
        break;
      case '--uid':
        args.uid = next;
        i++;
        break;
      case '--password':
        args.password = next;
        i++;
        break;
      case '--name':
        args.name = next;
        i++;
        break;
      case '--department':
        if (next) args.department = next;
        i++;
        break;
      case '--sector':
        if (next) args.sector = next;
        i++;
        break;
      case '--bootstrap-secret':
        args.bootstrapSecret = next;
        i++;
        break;
      case '--bootstrap-first':
        args.bootstrapFirst = true;
        break;
      case '--create':
        args.create = true;
        break;
      case '--revoke':
        args.revoke = true;
        break;
      case '--help':
      case '-h':
        printUsage();
        process.exit(0);
    }
  }
  return args;
}

function printUsage() {
  console.log(`
FloodSense Emergency Officer Authorization CLI
==============================================
Securely assigns trusted Firebase custom claims ({ role: 'officer', officer: true })
and registers the responder UID in Firestore /officers/{uid}.
No System Administrator role is created and public officer registration remains disabled.

Usage:
  1. Bootstrap the VERY FIRST Emergency Officer using OFFICER_BOOTSTRAP_SECRET:
     OFFICER_BOOTSTRAP_SECRET="<>=16-char-secret>" npm run officer:bootstrap -- --email officer@example.com --password "StrongPassword!23" --name "Kasun Pereira" --create

  2. Bootstrap an existing Firebase user as the first Emergency Officer:
     OFFICER_BOOTSTRAP_SECRET="<>=16-char-secret>" npm run officer:bootstrap -- --email officer@example.com

  3. Authorize an existing Firebase user directly via Admin SDK:
     npm run officer:authorize -- --email officer@example.com

  4. Revoke officer authorization:
     npm run officer:authorize -- --email officer@example.com --revoke

Prerequisites:
  - Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS in your environment.
  - For --bootstrap-first / officer:bootstrap, OFFICER_BOOTSTRAP_SECRET (>= 16 chars) is required.
`);
}

function loadAppletConfig(): { projectId?: string; firestoreDatabaseId?: string } {
  const configPath = path.resolve(__dirname, '..', 'firebase-applet-config.json');
  if (!fs.existsSync(configPath)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    return {
      projectId:
        typeof parsed.projectId === 'string' && parsed.projectId.trim() && parsed.projectId !== 'remixed-project-id'
          ? parsed.projectId.trim()
          : undefined,
      firestoreDatabaseId:
        typeof parsed.firestoreDatabaseId === 'string' && parsed.firestoreDatabaseId.trim()
          ? parsed.firestoreDatabaseId.trim()
          : undefined,
    };
  } catch {
    return {};
  }
}

async function hasAnyOfficerCustomClaim(adminAuth: ReturnType<typeof getAuth>): Promise<boolean> {
  let pageToken: string | undefined;
  do {
    const page = await adminAuth.listUsers(1000, pageToken);
    for (const user of page.users) {
      if (user.customClaims?.role === 'officer' || user.customClaims?.officer === true) {
        return true;
      }
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return false;
}

async function main() {
  const args = parseCliArgs(process.argv.slice(2));
  if (!args.email && !args.uid) {
    printUsage();
    console.error('Error: Provide --email <email> or --uid <uid>.');
    process.exit(1);
  }

  const appletCfg = loadAppletConfig();
  const rawSaJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  const gacPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;

  if ((!rawSaJson || !rawSaJson.trim().startsWith('{')) && (!gacPath || !fs.existsSync(gacPath))) {
    console.error(
      'Error: Missing Firebase Admin SDK credentials.\n' +
        'Set FIREBASE_SERVICE_ACCOUNT_JSON or GOOGLE_APPLICATION_CREDENTIALS (path to service-account JSON) before running this script.'
    );
    process.exit(1);
  }

  const app =
    getApps().length > 0
      ? getApps()[0]
      : rawSaJson && rawSaJson.trim().startsWith('{')
      ? initializeApp({
          credential: cert(JSON.parse(rawSaJson)),
          ...(appletCfg.projectId ? { projectId: appletCfg.projectId } : {}),
        })
      : initializeApp({
          ...(appletCfg.projectId ? { projectId: appletCfg.projectId } : {}),
        });

  const adminAuth = getAuth(app);
  const dbId = process.env.FIREBASE_DATABASE_ID || appletCfg.firestoreDatabaseId;
  const adminDb = dbId && dbId !== '(default)' ? getFirestore(app, dbId) : getFirestore(app);

  // Mode 1: Strict first-officer bootstrap gated by OFFICER_BOOTSTRAP_SECRET
  if (args.bootstrapFirst) {
    const envSecret = process.env.OFFICER_BOOTSTRAP_SECRET;
    const providedSecret = args.bootstrapSecret || envSecret;

    const result = await executeFirstOfficerBootstrap({
      configuredSecret: envSecret,
      providedSecret,
      targetEmail: args.email,
      targetUid: args.uid,
      targetPassword: args.password,
      targetName: args.name,
      department: args.department,
      sector: args.sector,
      createIfMissing: args.create,
      getUserByUid: (uid) => adminAuth.getUser(uid),
      getUserByEmail: (email) => adminAuth.getUserByEmail(email),
      createUser: (params) => adminAuth.createUser(params),
      hasAnyExistingOfficerClaim: () => hasAnyOfficerCustomClaim(adminAuth),
      hasAnyExistingOfficerDoc: async () => {
        const snap = await adminDb.collection('officers').limit(1).get();
        return !snap.empty;
      },
      setCustomUserClaims: (uid, claims) => adminAuth.setCustomUserClaims(uid, claims),
      writeOfficerRecord: (uid, data) => adminDb.collection('officers').doc(uid).set(data, { merge: true }),
      writeUserProfileRecord: (uid, data) => adminDb.collection('users').doc(uid).set(data, { merge: true }),
    });

    if (!result.ok) {
      console.error(`First-officer bootstrap failed (${result.status}): ${result.error}`);
      process.exit(1);
    }

    console.log(`
First Emergency Officer bootstrapped securely!
  UID:       ${result.uid}
  Email:     ${result.email || '(none)'}
  Claims:    { role: "officer", officer: true }
  Firestore: /officers/${result.uid} (active: true)
  Database:  ${dbId || '(default)'}

Note: First-officer bootstrap is now permanently locked. Additional officers require explicit Admin CLI authorization.
`);
    return;
  }

  // Mode 2: Standard Admin SDK authorize / revoke
  let userRecord;
  try {
    if (args.uid) {
      userRecord = await adminAuth.getUser(args.uid);
    } else if (args.email) {
      userRecord = await adminAuth.getUserByEmail(args.email.trim());
    }
  } catch (err: any) {
    if (err?.code === 'auth/user-not-found' && args.create && args.email) {
      if (!args.password || args.password.length < 8) {
        console.error('Error: --create requires --password with at least 8 characters.');
        process.exit(1);
      }
      userRecord = await adminAuth.createUser({
        email: args.email.trim(),
        password: args.password,
        displayName: args.name?.trim() || 'Emergency Officer',
        emailVerified: true,
      });
      console.log(`Created Firebase Auth account for ${userRecord.email} (UID: ${userRecord.uid}).`);
    } else {
      console.error(`Failed to locate Firebase Auth user: ${err?.message || err}`);
      process.exit(1);
    }
  }

  if (!userRecord) {
    console.error('Unable to resolve Firebase Auth user.');
    process.exit(1);
  }

  const existingClaims = userRecord.customClaims || {};

  if (args.revoke) {
    const nextClaims = { ...existingClaims };
    delete nextClaims.officer;
    nextClaims.role = 'citizen';
    await adminAuth.setCustomUserClaims(userRecord.uid, nextClaims);
    await adminAuth.revokeRefreshTokens(userRecord.uid);

    await adminDb.collection('officers').doc(userRecord.uid).set(
      {
        uid: userRecord.uid,
        email: userRecord.email || args.email || '',
        role: 'citizen',
        active: false,
        revokedAt: new Date().toISOString(),
      },
      { merge: true }
    );
    await adminDb.collection('users').doc(userRecord.uid).set(
      {
        uid: userRecord.uid,
        email: userRecord.email || args.email || '',
        role: 'citizen',
        isOfficer: false,
      },
      { merge: true }
    );

    console.log(`Revoked Emergency Officer access for ${userRecord.email || userRecord.uid} (UID: ${userRecord.uid}).`);
    return;
  }

  const updatedClaims = {
    ...existingClaims,
    role: 'officer',
    officer: true,
  };
  await adminAuth.setCustomUserClaims(userRecord.uid, updatedClaims);

  const displayName = args.name?.trim() || userRecord.displayName || 'Emergency Management Officer';
  const nowIso = new Date().toISOString();

  await adminDb.collection('officers').doc(userRecord.uid).set(
    {
      uid: userRecord.uid,
      email: userRecord.email || args.email || '',
      displayName,
      role: 'officer',
      active: true,
      department: args.department,
      emergencySector: args.sector,
      authorizedAt: nowIso,
      authorizedMethod: 'admin_cli',
    },
    { merge: true }
  );

  await adminDb.collection('users').doc(userRecord.uid).set(
    {
      uid: userRecord.uid,
      email: userRecord.email || args.email || '',
      displayName,
      name: displayName,
      role: 'officer',
      isOfficer: true,
      department: args.department,
      emergencySector: args.sector,
    },
    { merge: true }
  );

  console.log(`
Emergency Officer successfully authorized!
  UID:       ${userRecord.uid}
  Email:     ${userRecord.email || '(none)'}
  Claims:    { role: "officer", officer: true }
  Firestore: /officers/${userRecord.uid} (active: true)
  Database:  ${dbId || '(default)'}

Note: If the user is already signed in, they should sign out and sign back in via Emergency Officer Login so a fresh ID token is issued.
`);
}

main().catch((err) => {
  console.error('Officer authorization failed:', err?.message || err);
  process.exit(1);
});
