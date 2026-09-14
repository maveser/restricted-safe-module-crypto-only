import { expect } from "chai";
import { network } from "hardhat";

const USDT = "0x55d398326f99059ff775485246999027b3197955";
const ROUTER = "0x1b81D678ffb9C0263b24A97847620C99d213eB14";
const SKHYB = "0xCA750eF65f295BBECd685Abf54e82CAf297BDB61";
const SKHYB_USDT_POOL = "0xD7d30F434b12F7Ed9b0Ae11fF1C754745a10aD52";
const BTCB = "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c";
const BTCB_USDT_POOL = "0x46cf1cf8c69595804ba91dfdd8d6b960c9b0a7c4";
const CHAINLINK_BTC_USD = "0x264990fbd0A4796A3E3d8E37C4d5F87a3aCa5Ebf";
const CHAINLINK_USDT_USD = "0xB97Ad0E74fa7d920791E90258A6E2085088b4320";
const FACTORY = "0x0BFbCF9fa4f9C56B0F40a671Ad40E0805A091865";
const routerAbi = ["function exactInputSingle((address tokenIn,address tokenOut,uint24 fee,address recipient,uint256 deadline,uint256 amountIn,uint256 amountOutMinimum,uint160 sqrtPriceLimitX96))"];

async function installAt({ ethers }, factoryName, address) {
  const Factory = await ethers.getContractFactory(factoryName);
  const implementation = await Factory.deploy();
  await implementation.waitForDeployment();
  await ethers.provider.send("hardhat_setCode", [address, await ethers.provider.getCode(await implementation.getAddress())]);
  return Factory.attach(address);
}

async function deployedBtcFixture() {
  const { ethers } = await network.create("bscLocal");
  const [safe, delegate] = await ethers.getSigners();
  const factory = await installAt({ ethers }, "MockPancakeV3Factory", FACTORY);
  await factory.setPool(USDT, BTCB, 500, BTCB_USDT_POOL);
  const pool = await installAt({ ethers }, "MockV3Pool", BTCB_USDT_POOL);
  const btcFeed = await installAt({ ethers }, "MockAggregatorV3", CHAINLINK_BTC_USD);
  const usdtFeed = await installAt({ ethers }, "MockAggregatorV3", CHAINLINK_USDT_USD);
  const now = (await ethers.provider.getBlock("latest")).timestamp;
  await pool.setObservation(0, 0, 1n);
  await btcFeed.setRoundData(100_000_000n, now);
  await usdtFeed.setRoundData(100_000_000n, now);
  const Module = await ethers.getContractFactory("RestrictedSafeModuleCryptoOnly");
  const module = await Module.deploy(safe.address, delegate.address, USDT, ROUTER);
  return { ethers, safe, delegate, module, now };
}

describe("RestrictedSafeModuleCryptoOnly — límite de rutas", function () {
  it("rechaza una ruta bStock aunque el delegado use su pool conocido", async function () {
    const { ethers } = await network.create("bscLocal");
    const [safe, delegate] = await ethers.getSigners();
    const Module = await ethers.getContractFactory("RestrictedSafeModuleCryptoOnly");
    const module = await Module.deploy(safe.address, delegate.address, USDT, ROUTER);

    await expect(module.connect(delegate).validateMinimumOut(
      SKHYB, SKHYB_USDT_POOL, 2500, 1n, 1n,
    )).to.be.revertedWithCustomError(module, "UnsupportedOutputToken");
  });

  it("calcula el suelo combinado de TWAP y Chainlink para BTCB", async function () {
    const { module } = await deployedBtcFixture();
    expect(await module.minimumAmountOutFromGuards(BTCB, BTCB_USDT_POOL, 500, 50n * 10n ** 18n))
      .to.equal(49_250_000_000_000_000_000n);
  });

  it("rechaza minAmountOut un wei por debajo del suelo combinado", async function () {
    const { delegate, module } = await deployedBtcFixture();
    const amountIn = 50n * 10n ** 18n;
    const minimum = await module.minimumAmountOutFromGuards(BTCB, BTCB_USDT_POOL, 500, amountIn);
    await expect(module.connect(delegate).validateMinimumOut(BTCB, BTCB_USDT_POOL, 500, amountIn, minimum - 1n))
      .to.be.revertedWithCustomError(module, "MinAmountOutBelowGuardedLimit");
  });

  it("construye exactInputSingle con la Safe como destinataria", async function () {
    const { ethers, safe, delegate, module, now } = await deployedBtcFixture();
    const amountIn = 50n * 10n ** 18n;
    const minimum = await module.minimumAmountOutFromGuards(BTCB, BTCB_USDT_POOL, 500, amountIn);
    const data = await module.connect(delegate).buildExactInputSingle(BTCB, BTCB_USDT_POOL, 500, amountIn, minimum, now + 60);
    const decoded = new ethers.Interface(routerAbi).decodeFunctionData("exactInputSingle", data)[0];
    expect(decoded.tokenIn).to.equal(ethers.getAddress(USDT));
    expect(decoded.tokenOut).to.equal(ethers.getAddress(BTCB));
    expect(decoded.recipient).to.equal(ethers.getAddress(safe.address));
    expect(decoded.amountIn).to.equal(amountIn);
    expect(decoded.amountOutMinimum).to.equal(minimum);
  });

  it("solicita a la Safe una aprobación exacta antes del swap", async function () {
    const { ethers } = await network.create("bscLocal");
    const [, delegate] = await ethers.getSigners();
    const Safe = await ethers.getContractFactory("MockSafe");
    const safe = await Safe.deploy();
    const factory = await installAt({ ethers }, "MockPancakeV3Factory", FACTORY);
    await factory.setPool(USDT, BTCB, 500, BTCB_USDT_POOL);
    const pool = await installAt({ ethers }, "MockV3Pool", BTCB_USDT_POOL);
    const btcFeed = await installAt({ ethers }, "MockAggregatorV3", CHAINLINK_BTC_USD);
    const usdtFeed = await installAt({ ethers }, "MockAggregatorV3", CHAINLINK_USDT_USD);
    const token = await installAt({ ethers }, "MockErc20Allowance", USDT);
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await pool.setObservation(0, 0, 1n);
    await btcFeed.setRoundData(100_000_000n, now);
    await usdtFeed.setRoundData(100_000_000n, now);
    const Module = await ethers.getContractFactory("RestrictedSafeModuleCryptoOnly");
    const module = await Module.deploy(await safe.getAddress(), delegate.address, USDT, ROUTER);
    await safe.setModule(await module.getAddress());
    const amountIn = 50n * 10n ** 18n;
    const minimum = await module.minimumAmountOutFromGuards(BTCB, BTCB_USDT_POOL, 500, amountIn);

    await module.connect(delegate).executeExactInputSingle(BTCB, BTCB_USDT_POOL, 500, amountIn, minimum, now + 60);
    expect(await safe.executionCount()).to.equal(2n);
    expect(await safe.firstTarget()).to.equal(ethers.getAddress(USDT));
    expect(await safe.lastTarget()).to.equal(ethers.getAddress(ROUTER));
    const approval = new ethers.Interface(["function approve(address spender,uint256 amount)"])
      .decodeFunctionData("approve", await safe.firstData());
    expect(approval.spender).to.equal(ethers.getAddress(ROUTER));
    expect(approval.amount).to.equal(amountIn);
  });

  it("rechaza una ronda Chainlink incompleta", async function () {
    const { ethers } = await network.create("bscLocal");
    const [safe, delegate] = await ethers.getSigners();
    const factory = await installAt({ ethers }, "MockPancakeV3Factory", FACTORY);
    await factory.setPool(USDT, BTCB, 500, BTCB_USDT_POOL);
    const pool = await installAt({ ethers }, "MockV3Pool", BTCB_USDT_POOL);
    const btcFeed = await installAt({ ethers }, "MockAggregatorV3", CHAINLINK_BTC_USD);
    const usdtFeed = await installAt({ ethers }, "MockAggregatorV3", CHAINLINK_USDT_USD);
    const token = await installAt({ ethers }, "MockErc20Allowance", USDT);
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await pool.setObservation(0, 0, 1n);
    await btcFeed.setRoundDataWithRounds(100_000_000n, now, 2, 1);
    await usdtFeed.setRoundData(100_000_000n, now);
    const Module = await ethers.getContractFactory("RestrictedSafeModuleCryptoOnly");
    const module = await Module.deploy(safe.address, delegate.address, USDT, ROUTER);

    await expect(module.minimumAmountOutFromGuards(BTCB, BTCB_USDT_POOL, 500, 1n))
      .to.be.revertedWithCustomError(module, "IncompleteOracleRound");
  });

  it("rechaza una ronda Chainlink con identificador cero", async function () {
    const { ethers } = await network.create("bscLocal");
    const [safe, delegate] = await ethers.getSigners();
    const factory = await installAt({ ethers }, "MockPancakeV3Factory", FACTORY);
    await factory.setPool(USDT, BTCB, 500, BTCB_USDT_POOL);
    const pool = await installAt({ ethers }, "MockV3Pool", BTCB_USDT_POOL);
    const btcFeed = await installAt({ ethers }, "MockAggregatorV3", CHAINLINK_BTC_USD);
    const usdtFeed = await installAt({ ethers }, "MockAggregatorV3", CHAINLINK_USDT_USD);
    const token = await installAt({ ethers }, "MockErc20Allowance", USDT);
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await pool.setObservation(0, 0, 1n);
    await btcFeed.setRoundDataWithRounds(100_000_000n, now, 0, 0);
    await usdtFeed.setRoundData(100_000_000n, now);
    const Module = await ethers.getContractFactory("RestrictedSafeModuleCryptoOnly");
    const module = await Module.deploy(safe.address, delegate.address, USDT, ROUTER);

    await expect(module.minimumAmountOutFromGuards(BTCB, BTCB_USDT_POOL, 500, 1n))
      .to.be.revertedWithCustomError(module, "IncompleteOracleRound");
  });

  it("rechaza un pool whitelistado si la factory no lo vincula a la ruta", async function () {
    const { ethers } = await network.create("bscLocal");
    const [safe, delegate] = await ethers.getSigners();
    const factory = await installAt({ ethers }, "MockPancakeV3Factory", FACTORY);
    const pool = await installAt({ ethers }, "MockV3Pool", BTCB_USDT_POOL);
    const btcFeed = await installAt({ ethers }, "MockAggregatorV3", CHAINLINK_BTC_USD);
    const usdtFeed = await installAt({ ethers }, "MockAggregatorV3", CHAINLINK_USDT_USD);
    const token = await installAt({ ethers }, "MockErc20Allowance", USDT);
    const now = (await ethers.provider.getBlock("latest")).timestamp;
    await pool.setObservation(0, 0, 1n);
    await btcFeed.setRoundData(100_000_000n, now);
    await usdtFeed.setRoundData(100_000_000n, now);
    await factory.setPool(USDT, BTCB, 500, ethers.ZeroAddress);
    const Module = await ethers.getContractFactory("RestrictedSafeModuleCryptoOnly");
    const module = await Module.deploy(safe.address, delegate.address, USDT, ROUTER);

    await expect(module.minimumAmountOutFromGuards(BTCB, BTCB_USDT_POOL, 500, 1n))
      .to.be.revertedWithCustomError(module, "FactoryPoolMismatch");
  });
});
