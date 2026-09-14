# Source manifest

This release intentionally contains only the candidate and material needed to inspect and test it.

| Included path | Purpose |
|---|---|
| `contracts/RestrictedSafeModuleCryptoOnly.sol` | BTCB/ETH-only candidate module |
| `contracts/libraries/FullMath.sol` | V3 arithmetic, adapted under GPL-2.0-or-later |
| `contracts/libraries/TickMath.sol` | V3 tick arithmetic, adapted under GPL-2.0-or-later |
| `contracts/test/` | Test-only Safe, fork executor, pool, factory, oracle and reentrancy façades |
| `test/RestrictedSafeModuleCryptoOnly*.js` | Candidate local test cases |
| `test/ForkValidationCryptoOnly.js` | Fixed-fork integration validation |
| `hardhat.config.js`, `package.json`, `package-lock.json` | Reproducible build/test configuration |
| `LICENSE`, `NOTICE`, `README.md`, `RELEASE-ATTESTATION.md` | GPL terms, provenance, scope and verification record |

## Explicit exclusions

- Any key, seed, credential, API token, RPC URL, account data or environment file.
- Historical V1/V2/V3 contracts and deployment transactions.
- `unsigned_deployment_tx.json` and deployment manifests, which do not describe this candidate.
- `node_modules`, generated Hardhat artifacts, caches, generated types and test coverage output.
- Live funding, approval, module-enable or trade instructions.

## Verification state at source packaging

The package is validated with:

```bash
npm audit --omit=dev --audit-level=moderate
npx hardhat test
```

Fork tests require `BSC_ARCHIVE_RPC_URL` supplied locally in the environment. Its value is not present in this release.
