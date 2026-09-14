// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @dev Test-only Safe facade. It records module requests but never transfers assets.
contract MockSafe {
    error UnauthorizedModule();

    address public module;
    uint256 public failAtExecution;
    uint256 public executionCount;
    address public firstTarget;
    bytes public firstData;
    address public lastTarget;
    bytes public lastData;

    function setModule(address module_) external {
        module = module_;
    }

    function setFailureAtExecution(uint256 executionNumber) external {
        failAtExecution = executionNumber;
    }

    function execTransactionFromModule(
        address to,
        uint256,
        bytes calldata data,
        uint8
    ) external returns (bool) {
        if (msg.sender != module) revert UnauthorizedModule();

        executionCount += 1;
        if (executionCount == failAtExecution) return false;
        if (executionCount == 1) {
            firstTarget = to;
            firstData = data;
        }
        lastTarget = to;
        lastData = data;
        return true;
    }
}
