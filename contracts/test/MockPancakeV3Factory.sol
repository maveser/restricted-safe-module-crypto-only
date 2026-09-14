// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @dev Test-only facade for PancakeSwap V3 factory route binding.
contract MockPancakeV3Factory {
    mapping(bytes32 => address) private pools;

    function setPool(address tokenA, address tokenB, uint24 fee, address pool) external {
        pools[_key(tokenA, tokenB, fee)] = pool;
        pools[_key(tokenB, tokenA, fee)] = pool;
    }

    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address) {
        return pools[_key(tokenA, tokenB, fee)];
    }

    function _key(address tokenA, address tokenB, uint24 fee) private pure returns (bytes32) {
        return keccak256(abi.encode(tokenA, tokenB, fee));
    }
}
