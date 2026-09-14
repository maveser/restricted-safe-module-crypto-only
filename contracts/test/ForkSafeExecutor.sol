// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

contract ForkSafeExecutor {
    error UnauthorizedModule();
    error CallFailed();

    address public module;

    function setModule(address module_) external {
        module = module_;
    }

    function execTransactionFromModule(
        address to,
        uint256 value,
        bytes calldata data,
        uint8 operation
    ) external returns (bool success) {
        if (msg.sender != module) revert UnauthorizedModule();
        if (operation != 0) revert CallFailed();
        (success,) = to.call{value: value}(data);
        return success;
    }
}
