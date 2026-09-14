// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.24;

import "../RestrictedSafeModuleCryptoOnly.sol";

/// @dev Attempts to use a constructor-time code.length bypass as the immutable delegate.
contract ConstructorDelegateCryptoOnly {
    constructor(address safe) {
        RestrictedSafeModuleCryptoOnly module = new RestrictedSafeModuleCryptoOnly(
            safe,
            address(this),
            0x55d398326f99059fF775485246999027B3197955,
            0x1b81D678ffb9C0263b24A97847620C99d213eB14
        );
        module.buildExactInputSingle(address(0), address(0), 0, 1, 1, block.timestamp + 1);
    }
}
