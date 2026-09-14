# Modelo de ejecución del delegado — candidato crypto-only

## Restricción deliberada

`RestrictedSafeModuleCryptoOnly` solo acepta una ejecución iniciada **directamente** por la EOA configurada como `delegate`.

La validación ejecutable exige simultáneamente:

```solidity
msg.sender == delegate
msg.sender == tx.origin
delegate.code.length == 0
```

## Consecuencias

No son compatibles como iniciador de una orden:

- una Safe o multisig;
- una smart account;
- un relayer;
- una cuenta ERC-4337 / Account Abstraction;
- un contrato proxy, bot-contract o wallet-contract;
- un contrato durante su constructor.

La incompatibilidad es intencionada. Evita que un contrato pueda presentarse temporalmente como EOA durante su constructor (`code.length == 0`) y limita el iniciador a la EOA de gas configurada.

## Operación prevista

1. El servicio autónomo calcula una orden permitida fuera de cadena.
2. El servicio entrega la petición a la EOA delegada mediante un método de firma/ejecución controlado por el owner.
3. La EOA delegada envía la transacción directamente al módulo en BNB Smart Chain (`chainId 56`).
4. El módulo valida límites, ruta, oráculos, TWAP, allowance residual y llama a la Safe para approval exacta y swap.

El delegado nunca debe mantener USDT de estrategia. Solo requiere BNB para gas.

## Cambio futuro de arquitectura

Si se desea ERC-4337, relayer, smart account o automatización contractual, no se debe eliminar este control de forma aislada. Requerirá un nuevo diseño de autorización, revisión de reentrada, pruebas de firma/validación y una auditoría independiente específica.
