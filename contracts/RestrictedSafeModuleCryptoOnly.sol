// SPDX-License-Identifier: GPL-2.0-or-later
pragma solidity 0.8.24;

import {FullMath} from "./libraries/FullMath.sol";
import {TickMath} from "./libraries/TickMath.sol";

interface ICryptoOnlyPool {
    function liquidity() external view returns (uint128);
    function observe(uint32[] calldata secondsAgos) external view returns (int56[] memory, uint160[] memory);
}

interface ICryptoOnlyAggregator {
    function decimals() external view returns (uint8);
    function latestRoundData() external view returns (uint80, int256, uint256, uint256, uint80);
}

interface ICryptoOnlyRouter {
    struct ExactInputSingleParams {
        address tokenIn;
        address tokenOut;
        uint24 fee;
        address recipient;
        uint256 deadline;
        uint256 amountIn;
        uint256 amountOutMinimum;
        uint160 sqrtPriceLimitX96;
    }
    function exactInputSingle(ExactInputSingleParams calldata params) external returns (uint256 amountOut);
}

interface ICryptoOnlySafe {
    function execTransactionFromModule(address to, uint256 value, bytes calldata data, uint8 operation) external returns (bool);
}

interface ICryptoOnlyErc20 {
    function approve(address spender, uint256 amount) external returns (bool);
}

interface ICryptoOnlyFactory {
    function getPool(address tokenA, address tokenB, uint24 fee) external view returns (address pool);
}

/// @notice Candidate restricted Safe module for BTCB/ETH only. Not deployed or enabled.
contract RestrictedSafeModuleCryptoOnly {
    error ZeroAddress();
    error UnsupportedRouter();
    error UnsupportedInputToken();
    error DelegateMustBeEOA();
    error DelegateNoLongerEOA();
    error UnauthorizedDelegate();
    error UnsupportedOutputToken();
    error UnsupportedPool();
    error UnsupportedFee();
    error NoPoolLiquidity();
    error InsufficientOracleHistory();
    error InvalidOraclePrice();
    error StaleOraclePrice();
    error UnexpectedOracleDecimals();
    error IncompleteOracleRound();
    error MinAmountOutBelowGuardedLimit();
    error AmountExceedsPerOperationLimit();
    error ExpiredDeadline();
    error DeadlineTooFar();
    error SafeExecutionFailed();
    error CumulativeLimitExceeded();
    error ReentrantExecution();
    error FactoryPoolMismatch();

    address public constant PANCAKESWAP_V3_ROUTER = 0x1b81D678ffb9C0263b24A97847620C99d213eB14;
    address public constant PANCAKESWAP_V3_FACTORY = 0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865;
    address public constant CANONICAL_USDT = 0x55d398326f99059fF775485246999027B3197955;
    address public constant BTCB = 0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c;
    address public constant ETH = 0x2170Ed0880ac9A755fd29B2688956BD959F933F8;
    address public constant BTCB_USDT_POOL = 0x46Cf1cF8c69595804ba91dFdd8d6b960c9B0a7C4;
    address public constant ETH_USDT_POOL = 0xBe141893E4c6AD9272e8C04BAB7E6a10604501a5;
    uint24 public constant POOL_FEE = 500;
    uint32 public constant TWAP_WINDOW = 30 minutes;
    uint256 public constant MAX_ORACLE_AGE = 1 hours;
    uint256 public constant MAX_SLIPPAGE_BPS = 150;
    uint256 public constant BPS_DENOMINATOR = 10_000;
    uint8 public constant ORACLE_DECIMALS = 8;
    uint256 public constant MAX_USDT_PER_OPERATION = 50e18;
    uint256 public constant MAX_TOTAL_STRATEGY_USDT = 100e18;
    uint256 public constant MAX_DEADLINE_WINDOW = 5 minutes;
    address public constant CHAINLINK_BTC_USD = 0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf;
    address public constant CHAINLINK_ETH_USD = 0x9ef1B8c0E4F7dc8bF5719Ea496883DC6401d5b2e;
    address public constant CHAINLINK_USDT_USD = 0xB97Ad0E74fa7d920791E90258A6E2085088b4320;

    address public immutable safe;
    address public immutable delegate;
    address public immutable usdt;
    address public immutable router;
    uint256 public totalStrategySpent;
    uint256 private executionLock;

    constructor(address safe_, address delegate_, address usdt_, address router_) {
        if (safe_ == address(0) || delegate_ == address(0) || usdt_ == address(0) || router_ == address(0)) revert ZeroAddress();
        if (router_ != PANCAKESWAP_V3_ROUTER) revert UnsupportedRouter();
        if (usdt_ != CANONICAL_USDT) revert UnsupportedInputToken();
        if (delegate_.code.length != 0) revert DelegateMustBeEOA();
        safe = safe_;
        delegate = delegate_;
        usdt = usdt_;
        router = router_;
    }

    function validateMinimumOut(address tokenOut, address pool, uint24 fee, uint256 amountIn, uint256 minAmountOut) external view {
        if (msg.sender != delegate) revert UnauthorizedDelegate();
        if (delegate.code.length != 0) revert DelegateNoLongerEOA();
        _validateRoute(tokenOut, pool, fee);
        if (minAmountOut < _minimumAmountOutFromGuards(tokenOut, pool, amountIn)) revert MinAmountOutBelowGuardedLimit();
    }

    function buildExactInputSingle(
        address tokenOut,
        address pool,
        uint24 fee,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external view returns (bytes memory) {
        _validateDelegate();
        return _buildExactInputSingle(tokenOut, pool, fee, amountIn, minAmountOut, deadline);
    }

    function executeExactInputSingle(
        address tokenOut,
        address pool,
        uint24 fee,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) external {
        if (executionLock != 0) revert ReentrantExecution();
        executionLock = 1;
        _validateDelegate();
        bytes memory swapData = _buildExactInputSingle(tokenOut, pool, fee, amountIn, minAmountOut, deadline);
        if (totalStrategySpent + amountIn > MAX_TOTAL_STRATEGY_USDT) revert CumulativeLimitExceeded();
        bytes memory approvalData = abi.encodeWithSelector(ICryptoOnlyErc20.approve.selector, router, amountIn);
        if (!ICryptoOnlySafe(safe).execTransactionFromModule(usdt, 0, approvalData, 0)) revert SafeExecutionFailed();
        if (!ICryptoOnlySafe(safe).execTransactionFromModule(router, 0, swapData, 0)) revert SafeExecutionFailed();
        totalStrategySpent += amountIn;
        executionLock = 0;
    }

    function _validateDelegate() internal view {
        if (msg.sender != delegate) revert UnauthorizedDelegate();
        if (delegate.code.length != 0) revert DelegateNoLongerEOA();
    }

    function _buildExactInputSingle(
        address tokenOut,
        address pool,
        uint24 fee,
        uint256 amountIn,
        uint256 minAmountOut,
        uint256 deadline
    ) internal view returns (bytes memory) {
        if (amountIn > MAX_USDT_PER_OPERATION) revert AmountExceedsPerOperationLimit();
        if (deadline <= block.timestamp) revert ExpiredDeadline();
        if (deadline > block.timestamp + MAX_DEADLINE_WINDOW) revert DeadlineTooFar();
        _validateRoute(tokenOut, pool, fee);
        if (minAmountOut < _minimumAmountOutFromGuards(tokenOut, pool, amountIn)) revert MinAmountOutBelowGuardedLimit();
        ICryptoOnlyRouter.ExactInputSingleParams memory params = ICryptoOnlyRouter.ExactInputSingleParams({
            tokenIn: usdt,
            tokenOut: tokenOut,
            fee: fee,
            recipient: safe,
            deadline: deadline,
            amountIn: amountIn,
            amountOutMinimum: minAmountOut,
            sqrtPriceLimitX96: 0
        });
        return abi.encodeWithSelector(ICryptoOnlyRouter.exactInputSingle.selector, params);
    }

    function minimumAmountOutFromGuards(address tokenOut, address pool, uint24 fee, uint256 amountIn) external view returns (uint256) {
        _validateRoute(tokenOut, pool, fee);
        return _minimumAmountOutFromGuards(tokenOut, pool, amountIn);
    }

    function _minimumAmountOutFromGuards(address tokenOut, address pool, uint256 amountIn) internal view returns (uint256) {
        uint256 twapMinimum = _minimumAmountOutFromTwap(tokenOut, pool, amountIn);
        uint256 oracleMinimum = _minimumAmountOutFromOracle(tokenOut, amountIn);
        return twapMinimum > oracleMinimum ? twapMinimum : oracleMinimum;
    }

    function _validateRoute(address tokenOut, address pool, uint24 fee) internal view {
        if (tokenOut != BTCB && tokenOut != ETH) revert UnsupportedOutputToken();
        if (fee != POOL_FEE) revert UnsupportedFee();
        if ((tokenOut == BTCB && pool != BTCB_USDT_POOL) || (tokenOut == ETH && pool != ETH_USDT_POOL)) revert UnsupportedPool();
        if (ICryptoOnlyFactory(PANCAKESWAP_V3_FACTORY).getPool(usdt, tokenOut, fee) != pool) revert FactoryPoolMismatch();
    }

    function _minimumAmountOutFromOracle(address tokenOut, uint256 amountIn) internal view returns (uint256) {
        uint256 usdtUsd = _readOraclePrice(CHAINLINK_USDT_USD);
        uint256 tokenUsd = _readOraclePrice(tokenOut == BTCB ? CHAINLINK_BTC_USD : CHAINLINK_ETH_USD);
        uint256 quote = FullMath.mulDiv(amountIn, usdtUsd, tokenUsd);
        return FullMath.mulDiv(quote, BPS_DENOMINATOR - MAX_SLIPPAGE_BPS, BPS_DENOMINATOR);
    }

    function _readOraclePrice(address feed) internal view returns (uint256) {
        if (ICryptoOnlyAggregator(feed).decimals() != ORACLE_DECIMALS) revert UnexpectedOracleDecimals();
        (uint80 roundId, int256 answer,, uint256 updatedAt, uint80 answeredInRound) = ICryptoOnlyAggregator(feed).latestRoundData();
        if (answeredInRound < roundId) revert IncompleteOracleRound();
        if (answer <= 0 || updatedAt == 0 || updatedAt > block.timestamp) revert InvalidOraclePrice();
        if (block.timestamp - updatedAt > MAX_ORACLE_AGE) revert StaleOraclePrice();
        return uint256(answer);
    }

    function _minimumAmountOutFromTwap(address tokenOut, address pool, uint256 amountIn) internal view returns (uint256) {
        if (ICryptoOnlyPool(pool).liquidity() == 0) revert NoPoolLiquidity();
        uint32[] memory secondsAgos = new uint32[](2);
        secondsAgos[0] = TWAP_WINDOW;
        int56[] memory ticks;
        try ICryptoOnlyPool(pool).observe(secondsAgos) returns (int56[] memory observedTicks, uint160[] memory) {
            ticks = observedTicks;
        } catch {
            revert InsufficientOracleHistory();
        }
        if (ticks.length != 2) revert InsufficientOracleHistory();
        int56 delta = ticks[1] - ticks[0];
        int24 arithmeticMeanTick = int24(delta / int56(uint56(TWAP_WINDOW)));
        if (delta < 0 && delta % int56(uint56(TWAP_WINDOW)) != 0) arithmeticMeanTick--;
        uint256 quote = _quoteAtTick(arithmeticMeanTick, uint128(amountIn), usdt, tokenOut);
        return FullMath.mulDiv(quote, BPS_DENOMINATOR - MAX_SLIPPAGE_BPS, BPS_DENOMINATOR);
    }

    function _quoteAtTick(int24 tick, uint128 baseAmount, address baseToken, address quoteToken) internal pure returns (uint256 quoteAmount) {
        uint160 sqrtRatioX96 = TickMath.getSqrtRatioAtTick(tick);
        if (sqrtRatioX96 <= type(uint128).max) {
            uint256 ratioX192 = uint256(sqrtRatioX96) * sqrtRatioX96;
            return baseToken < quoteToken
                ? FullMath.mulDiv(ratioX192, baseAmount, 1 << 192)
                : FullMath.mulDiv(1 << 192, baseAmount, ratioX192);
        }
        uint256 ratioX128 = FullMath.mulDiv(sqrtRatioX96, sqrtRatioX96, 1 << 64);
        return baseToken < quoteToken
            ? FullMath.mulDiv(ratioX128, baseAmount, 1 << 128)
            : FullMath.mulDiv(1 << 128, baseAmount, ratioX128);
    }
}
