import { expect } from "chai";
import { network } from "hardhat";

const USDT = "0x55d398326f99059ff775485246999027b3197955";
const ROUTER = "0x1b81D678ffb9C0263b24A97847620C99d213eB14";
const SAFE = "0x5c3541f7f8439576AB521f1C355E81acf0E232Ba";
const OWNER = "0xB23bb9258720791df1eb853F25ABa7b7980E4b01";
const DELEGATE = "0xDe6869DE918e80f5A2f83a7cA2281B9D06C97ca8";
const SENTINEL = "0x0000000000000000000000000000000000000001";
const routes = [
  ["BTCB", "0x46cf1cf8c69595804ba91dfdd8d6b960c9b0a7c4", "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c", 500],
  ["ETH", "0xbe141893e4c6ad9272e8c04bab7e6a10604501a5", "0x2170ed0880ac9a755fd29b2688956bd959f933f8", 500],
];
const forkDescribe = process.env.BSC_ARCHIVE_RPC_URL ? describe : describe.skip;

forkDescribe("BNB Chain fork — RestrictedSafeModuleCryptoOnly", function () {
  it("verifica la Safe real y los dos suelos combinados", async function () {
    const { ethers } = await network.create("bscFork");
    const chain = await ethers.provider.getNetwork();
    expect(chain.chainId).to.equal(56n);
    expect(await ethers.provider.getCode(SAFE)).to.not.equal("0x");
    expect(await ethers.provider.getCode(DELEGATE)).to.equal("0x");
    const safe = new ethers.Contract(SAFE, [
      "function getThreshold() view returns (uint256)",
      "function isOwner(address) view returns (bool)",
      "function getModulesPaginated(address,uint256) view returns (address[],address)",
    ], ethers.provider);
    expect(await safe.getThreshold()).to.equal(1n);
    expect(await safe.isOwner(OWNER)).to.equal(true);
    const [modules, next] = await safe.getModulesPaginated(SENTINEL, 10);
    expect(modules).to.deep.equal([]);
    expect(next).to.equal(SENTINEL);

    const Module = await ethers.getContractFactory("RestrictedSafeModuleCryptoOnly");
    const module = await Module.deploy(SAFE, DELEGATE, USDT, ROUTER);
    await ethers.provider.send("hardhat_impersonateAccount", [DELEGATE]);
    const configuredDelegate = await ethers.getSigner(DELEGATE);
    const amountIn = ethers.parseUnits("1", 18);
    for (const [symbol, pool, tokenOut, fee] of routes) {
      const minimum = await module.minimumAmountOutFromGuards(tokenOut, pool, fee, amountIn);
      expect(minimum, `${symbol} guarded minimum`).to.be.greaterThan(0n);
      await module.connect(configuredDelegate).validateMinimumOut(tokenOut, pool, fee, amountIn, minimum);
    }
  });

  it("ejecuta los dos swaps aislados en el router real", async function () {
    const { ethers } = await network.create("bscFork");
    const [delegate] = await ethers.getSigners();
    const Safe = await ethers.getContractFactory("ForkSafeExecutor");
    const safe = await Safe.deploy();
    const Module = await ethers.getContractFactory("RestrictedSafeModuleCryptoOnly");
    const module = await Module.deploy(await safe.getAddress(), delegate.address, USDT, ROUTER);
    await safe.setModule(await module.getAddress());
    const amountIn = ethers.parseUnits("1", 18);
    const safeAddress = await safe.getAddress();
    const usdt = new ethers.Contract(USDT, ["function balanceOf(address) view returns(uint256)", "function allowance(address,address) view returns(uint256)"], ethers.provider);
    let seeded = false;
    for (let slot = 0; slot <= 10 && !seeded; slot += 1) {
      const key = ethers.keccak256(ethers.concat([ethers.zeroPadValue(safeAddress, 32), ethers.zeroPadValue(ethers.toBeHex(slot), 32)]));
      await ethers.provider.send("hardhat_setStorageAt", [USDT, key, ethers.zeroPadValue(ethers.toBeHex(amountIn * 2n), 32)]);
      seeded = (await usdt.balanceOf(safeAddress)) >= amountIn * 2n;
    }
    expect(seeded).to.equal(true);
    for (const [symbol, pool, tokenOut, fee] of routes) {
      const output = new ethers.Contract(tokenOut, ["function balanceOf(address) view returns(uint256)"], ethers.provider);
      const before = await output.balanceOf(safeAddress);
      const rawMinimum = await module.minimumAmountOutFromGuards(tokenOut, pool, fee, amountIn);
      const minimum = (rawMinimum * 10_001n) / 10_000n;
      await module.connect(delegate).executeExactInputSingle(tokenOut, pool, fee, amountIn, minimum, (await ethers.provider.getBlock("latest")).timestamp + 300);
      expect(await output.balanceOf(safeAddress), `${symbol} output`).to.be.greaterThan(before);
      expect(await usdt.allowance(safeAddress, ROUTER), `${symbol} allowance`).to.equal(0n);
    }
    expect(await module.totalStrategySpent()).to.equal(amountIn * 2n);
  });
});
