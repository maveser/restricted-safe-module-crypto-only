# Restricted Safe Module — crypto-only candidate

A **not-deployed** candidate Safe module for a bounded BTCB/USDT and ETH/USDT strategy on BNB Smart Chain.

## Status and safety boundary

- This source release is for inspection, reproducible testing, and GPL source availability.
- It is **not** an instruction or authorization to deploy, enable a Safe module, fund a Safe, grant token approvals, or trade.
- No private keys, seed phrases, RPC endpoints, API credentials, unsigned deployment transactions, or live deployment artifacts are included.
- The historical V1 deployment and its payload are intentionally excluded because V1 lacks an adequate on-chain slippage floor.

## Candidate controls

- Canonical BNB Chain USDT input only; BTCB and ETH output only.
- PancakeSwap V3 router, factory, token routes, 500-fee pools, and Safe recipient are hardcoded.
- Pool factory binding is required on-chain.
- 30-minute V3 TWAP plus independent Chainlink USD floor; 150 bps maximum slippage.
- Chainlink rounds must be positive, complete, eight-decimal, non-future and no older than one hour.
- Maximum 50 USDT per operation, 100 USDT total, and a five-minute deadline window.
- Exact token approval, Safe-mediated calls, reentrancy lock, and accounting only after success.

## Reproduce the test suite

```bash
npm ci
npm audit --omit=dev --audit-level=moderate
npx hardhat test
```

Fork tests need an archive-capable BNB Chain RPC supplied only through the `BSC_ARCHIVE_RPC_URL` environment variable. Do not commit or publish its value.

## License

The source is released under **GPL-2.0-or-later**. See `LICENSE` and `NOTICE`. The mathematical libraries retain their GPL-2.0-or-later provenance from PancakeSwap V3 core.
