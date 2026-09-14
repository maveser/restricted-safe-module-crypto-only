// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/// @dev Test-only V3 oracle facade returning controlled cumulative ticks.
contract MockV3Pool {
    int56 public tickCumulativePast;
    int56 public tickCumulativeNow;
    uint128 public activeLiquidity;
    bool public shouldRevert;

    function setObservation(int56 past_, int56 now_, uint128 liquidity_) external {
        tickCumulativePast = past_;
        tickCumulativeNow = now_;
        activeLiquidity = liquidity_;
        shouldRevert = false;
    }

    function setShouldRevert(bool value) external {
        shouldRevert = value;
    }

    function liquidity() external view returns (uint128) {
        return activeLiquidity;
    }

    function observe(uint32[] calldata secondsAgos)
        external
        view
        returns (int56[] memory tickCumulatives, uint160[] memory secondsPerLiquidityCumulativeX128s)
    {
        require(!shouldRevert, "NO_HISTORY");
        require(secondsAgos.length == 2 && secondsAgos[0] == 1800 && secondsAgos[1] == 0, "WINDOW");
        tickCumulatives = new int56[](2);
        tickCumulatives[0] = tickCumulativePast;
        tickCumulatives[1] = tickCumulativeNow;
        secondsPerLiquidityCumulativeX128s = new uint160[](2);
    }
}
