# Source manifest

This GPL source release intentionally contains only the crypto-only candidate and material needed to inspect and reproduce its tests.

## Included material

| Included path | Purpose |
|---|---|
| `contracts/RestrictedSafeModuleCryptoOnly.sol` | BTCB/ETH-only candidate module |
| `contracts/libraries/FullMath.sol` | V3 arithmetic, adapted under GPL-2.0-or-later |
| `contracts/libraries/TickMath.sol` | V3 tick arithmetic, adapted under GPL-2.0-or-later |
| `contracts/test/` | Test-only Safe, ERC-20 allowance, constructor delegate, fork executor, pool, factory, oracle and reentrancy façades |
| `test/RestrictedSafeModuleCryptoOnly*.js` | Candidate local tests, including chain, direct-EOA, allowance and oracle failures |
| `test/ForkValidationCryptoOnly.js` | Fixed-fork integration validation |
| `docs/crypto_only_execution_model.md` | Deliberate direct-EOA execution boundary |
| `hardhat.config.js`, `package.json`, `package-lock.json` | Reproducible build/test configuration |
| `LICENSE`, `NOTICE`, `README.md`, `RELEASE-ATTESTATION.md` | GPL terms, provenance, scope and verification record |

## Public fixtures

The fork tests include public BNB Chain addresses for the Safe, expected owner and gas-only delegate. They are **public test fixtures**, not credentials, private account material or signing authority. Their presence does not expose seeds, private keys, passwords, API tokens or RPC endpoints.

## Explicit exclusions

- Any key, seed, credential, API token, RPC URL, environment file or signing material.
- Historical V1/V2/V3 contracts and deployment transactions.
- `unsigned_deployment_tx.json` and deployment manifests, which do not describe this candidate.
- `node_modules`, generated Hardhat artifacts, caches, generated types and test coverage output.
- Live funding, approval, module-enable or trade instructions.

## Verification

Run:

```bash
npm audit --omit=dev --audit-level=moderate
npx hardhat test
```

Fork tests require `BSC_ARCHIVE_RPC_URL` supplied locally in the environment. Its value is not present in this release.
