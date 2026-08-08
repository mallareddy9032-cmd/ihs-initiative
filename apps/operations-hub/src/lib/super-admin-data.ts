export type FeatureFlag = {
  id: string;
  label: string;
  description: string;
  enabled: boolean;
  risk: 'low' | 'medium' | 'high';
};

export type CryptoKeyRecord = {
  kid: string;
  purpose: string;
  algorithm: string;
  status: 'active' | 'rotating' | 'retired';
  rotatedAt: string;
  fingerprint: string;
};

export type AuditLedgerEntry = {
  id: string;
  at: string;
  actor: string;
  action: string;
  resource: string;
  outcome: 'ALLOW' | 'DENY';
  hash: string;
};

export const DEFAULT_FEATURE_FLAGS: FeatureFlag[] = [
  {
    id: 'dispatch.gis_v2',
    label: 'Dispatch GIS v2',
    description: 'Enable vector tile HUD for Ananthapuramu pilot sectors.',
    enabled: true,
    risk: 'medium',
  },
  {
    id: 'vault.cold_export',
    label: 'Cold Vault Export',
    description: 'Allow Super Admin DPDP export jobs to Glacier WORM.',
    enabled: false,
    risk: 'high',
  },
  {
    id: 'sla.auto_penalty',
    label: 'SLA Auto-Penalty',
    description: 'Automatically flag TAT mobilization breaches to ERP.',
    enabled: true,
    risk: 'medium',
  },
  {
    id: 'mlc.hard_block',
    label: 'MLC Hard Block',
    description: 'Force statutory 108/112 redirect for medico-legal screens.',
    enabled: true,
    risk: 'low',
  },
];

export const CRYPTO_KEYS: CryptoKeyRecord[] = [
  {
    kid: 'ihs-jwt-hs256-2026q3',
    purpose: 'Session JWT signing (Cloud Engine)',
    algorithm: 'HS256',
    status: 'active',
    rotatedAt: '2026-07-01T00:00:00.000Z',
    fingerprint: 'sha256:7c3f…a91e',
  },
  {
    kid: 'ihs-vault-aes256-primary',
    purpose: 'Health Vault envelope encryption',
    algorithm: 'AES-256-GCM',
    status: 'active',
    rotatedAt: '2026-06-15T08:30:00.000Z',
    fingerprint: 'sha256:b2e1…44cd',
  },
  {
    kid: 'ihs-worm-hmac-audit',
    purpose: 'Audit ledger HMAC chain',
    algorithm: 'HMAC-SHA256',
    status: 'rotating',
    rotatedAt: '2026-08-01T12:00:00.000Z',
    fingerprint: 'sha256:91aa…0f27',
  },
];

export const AUDIT_LEDGER: AuditLedgerEntry[] = [
  {
    id: 'AUD-2026-88421',
    at: '2026-08-08T10:14:22.000Z',
    actor: 'SYS-ADMIN-001',
    action: 'feature_flag.update',
    resource: 'dispatch.gis_v2',
    outcome: 'ALLOW',
    hash: '0x9f2c…e1a4',
  },
  {
    id: 'AUD-2026-88418',
    at: '2026-08-08T09:51:03.000Z',
    actor: 'SYS-ADMIN-001',
    action: 'crypto.key.rotate',
    resource: 'ihs-worm-hmac-audit',
    outcome: 'ALLOW',
    hash: '0x71bd…90c2',
  },
  {
    id: 'AUD-2026-88390',
    at: '2026-08-08T08:02:41.000Z',
    actor: 'DSP-0442',
    action: 'super.admin.access',
    resource: '/admin/super',
    outcome: 'DENY',
    hash: '0x44ae…12f0',
  },
  {
    id: 'AUD-2026-88355',
    at: '2026-08-07T22:18:09.000Z',
    actor: 'SYS-ADMIN-001',
    action: 'tenant.policy.write',
    resource: 'tenant:ananthapuramu',
    outcome: 'ALLOW',
    hash: '0xc8d1…77ab',
  },
];
