// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @dev Test-only Safe facade that attempts a nested call while processing the first module request.
contract MockReentrantSafe {
    address public module;
    bytes public reentryData;
    bool public reentryAttempted;
    bool public reentrySucceeded;
    bytes public reentryResult;
    uint256 public executionCount;

    function setModule(address module_) external {
        module = module_;
    }

    function setReentryData(bytes calldata data) external {
        reentryData = data;
    }

    function execTransactionFromModule(address, uint256, bytes calldata, uint8) external returns (bool) {
        require(msg.sender == module, "UNAUTHORIZED_MODULE");
        executionCount += 1;
        if (executionCount == 1 && reentryData.length != 0) {
            reentryAttempted = true;
            (bool ok, bytes memory result) = module.call(reentryData);
            reentrySucceeded = ok;
            reentryResult = result;
        }
        return true;
    }
}
