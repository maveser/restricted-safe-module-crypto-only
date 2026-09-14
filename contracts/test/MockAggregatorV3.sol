// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @dev Test-only AggregatorV3 facade with 8 decimals.
contract MockAggregatorV3 {
    int256 public answer;
    uint256 public updatedAt;

    uint80 public roundId = 1;
    uint80 public answeredInRound = 1;

    function setRoundData(int256 answer_, uint256 updatedAt_) external {
        answer = answer_;
        updatedAt = updatedAt_;
        roundId = 1;
        answeredInRound = 1;
    }

    function setRoundDataWithRounds(int256 answer_, uint256 updatedAt_, uint80 roundId_, uint80 answeredInRound_) external {
        answer = answer_;
        updatedAt = updatedAt_;
        roundId = roundId_;
        answeredInRound = answeredInRound_;
    }

    function decimals() external pure returns (uint8) {
        return 8;
    }

    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80) {
        return (roundId, answer, updatedAt, updatedAt, answeredInRound);
    }
}
