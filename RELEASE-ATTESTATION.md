# Release attestation — GPL source package

- Package: `restricted-safe-module-crypto-only-gpl-source.zip`
- SHA-256: published externally alongside the exact ZIP release; verify it before use.
- License: GPL-2.0-or-later
- Scope: source-only BTCB/ETH candidate; not deployed, enabled, funded, approved or authorized for live trading.
- Validation: isolated package executed `npm audit --omit=dev --audit-level=moderate && npx hardhat test` with `found 0 vulnerabilities` and `19 passing`.
- Exclusions: credentials, private RPC values, deployment payloads, historical V1/V2/V3 sources, generated artifacts and caches.

To verify the archive after download:

```bash
sha256sum restricted-safe-module-crypto-only-gpl-source.zip
```
