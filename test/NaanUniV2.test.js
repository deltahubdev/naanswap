const { expectRevert, time, BN } = require('@openzeppelin/test-helpers');
const { MAX_UINT256 } = require('@openzeppelin/test-helpers/src/constants');
const NaanToken = artifacts.require('NaanToken');
const NaanUniV2 = artifacts.require('NaanUniV2');
const NaanMaster = artifacts.require('NaanMaster');
const StakingRewards = artifacts.require('StakingRewards');
const MockERC20 = artifacts.require('MockERC20');
const Migrator = artifacts.require('Migrator');
const NaanSwapFactory = artifacts.require('NaanSwapFactory');
const { AddressZero } = require("ethers/constants");
const NaanSwapPair = artifacts.require('NaanSwapPair');
const WETH9 = artifacts.require("WETH9");
const NaanSwapRouter = artifacts.require("NaanSwapRouter");
const { keccak256 } = require("ethers/utils");

function toBig(num) {
    return new BN(num)
}

function expandTo18Decimals(num) {
    return new BN(num).mul(toBig(10).pow(toBig(18)))
}

const LP_TOKEN_AMOUNT = expandTo18Decimals(10000);
const NAAN_PRE_BLOCK = expandTo18Decimals(3);

contract('NaanUniV2', ([alice, bob, carol, fee, minter]) => {
    beforeEach(async () => {
        this.tokenA = await MockERC20.new("tokenA", "tokenA", expandTo18Decimals(100000000), { from: alice });
        this.tokenB = await MockERC20.new("tokenA", "tokenA", expandTo18Decimals(100000000), { from: alice });
        // deploy factory
        this.NaanSwapFactory = await NaanSwapFactory.new(alice, { from: alice });
        // create pair
        await this.NaanSwapFactory.createPair(this.tokenA.address, this.tokenB.address, { from: alice })
        var pairAddress = await this.NaanSwapFactory.getPair(this.tokenA.address, this.tokenB.address);
        this.pair = await NaanSwapPair.at(pairAddress);
        WETH = await WETH9.new({ from: alice });
        // deploy router
        this.router = await NaanSwapRouter.new(this.NaanSwapFactory.address, WETH.address, { from: alice });
        await this.tokenA.approve(this.router.address, expandTo18Decimals(100000000), { from: alice });
        await this.tokenB.approve(this.router.address, expandTo18Decimals(100000000), { from: alice });
        let generateHash = keccak256(NaanSwapPair.bytecode).slice(2);
        config.logger.log(`find init code hash: ${generateHash}`);

        await this.router.addLiquidity(
            this.tokenA.address,
            this.tokenB.address,
            expandTo18Decimals(100000000),
            expandTo18Decimals(100000000),
            0,
            0,
            alice,
            MAX_UINT256,
            { from: alice });
            

        this.naan = await NaanToken.new({ from: alice });
        this.uniToken = await MockERC20.new("UniSwap", "UNI", "1000000000000000000000000000", { from: alice });
        this.naanMaster = await NaanMaster.new(this.naan.address, alice, NAAN_PRE_BLOCK, 0, { from: alice });

        //this.uniLpToken = await MockERC20.new("UniSwap LP Token", "LPT", LP_TOKEN_AMOUNT.mul(web3.utils.toBN(2)), { from: alice });
        this.uniLpToken = this.pair;
        this.uniStake = await StakingRewards.new(alice, this.uniToken.address, this.uniLpToken.address, { from: alice });
        this.naanUniV2 = await NaanUniV2.new(
            this.naanMaster.address,
            this.uniLpToken.address,
            this.uniStake.address,
            this.uniToken.address,
            this.naan.address,
            fee,
            { from: alice }
        );
        await this.naan.transferOwnership(this.naanMaster.address, { from: alice });

        assert.equal((await this.naanUniV2.totalSupply()).valueOf(), 0);
        assert.equal((await this.naanUniV2.lpToken()).valueOf(), this.uniLpToken.address);
        assert.equal((await this.naanUniV2.uniStaking()).valueOf(), this.uniStake.address);
        assert.equal((await this.naanUniV2.lastRewardBlock()).valueOf(), 0);
        assert.equal((await this.naanUniV2.accNaanPerShare()).valueOf(), 0);
        assert.equal((await this.naanUniV2.accUniPerShare()).valueOf(), 0);
        assert.equal((await this.naanUniV2.uniToken()).valueOf(), this.uniToken.address);
        assert.equal((await this.naanUniV2.naan()).valueOf(), this.naan.address);
        assert.equal((await this.naanUniV2.naanMaster()).valueOf(), this.naanMaster.address);
        assert.equal((await this.naanUniV2.migrator()).valueOf(), AddressZero);
        assert.equal((await this.naanUniV2.uniTokenFeeReceiver()).valueOf(), fee);
        assert.equal((await this.naanUniV2.uniFeeRatio()).valueOf(), 10);
        assert.equal((await this.naanUniV2.isMigrateComplete()).valueOf(), 0);

        //NaanMaster add Pool
        await this.naanMaster.add(100, this.naanUniV2.address, true, { from: alice });

        await this.uniToken.transfer(this.uniStake.address, '5000000000000000000000000');
        await this.uniStake.notifyRewardAmount('5000000000000000000000000');
    });

    it('should allow emergency withdraw', async () => {
        //mint uniswap lp token to bob
        await this.uniLpToken.transfer(bob, LP_TOKEN_AMOUNT, { from: alice });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), LP_TOKEN_AMOUNT.toString());
        //deposit to naanUni2
        await this.uniLpToken.approve(this.naanUniV2.address, LP_TOKEN_AMOUNT, { from: bob });
        await this.naanUniV2.deposit(LP_TOKEN_AMOUNT, { from: bob });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), 0);
        assert.equal((await this.uniLpToken.balanceOf(this.uniStake.address)).valueOf(), LP_TOKEN_AMOUNT.toString());

        await this.naanUniV2.emergencyWithdraw({ from: bob });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), LP_TOKEN_AMOUNT.toString());
    });


    it('should deposit and withdraw correct', async () => {
        //mint uniswap lp token to bob
        await this.uniLpToken.transfer(bob, LP_TOKEN_AMOUNT, { from: alice });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), LP_TOKEN_AMOUNT.toString());
        //deposit to naanUni2
        await this.uniLpToken.approve(this.naanUniV2.address, LP_TOKEN_AMOUNT, { from: bob });
        await this.naanUniV2.deposit(LP_TOKEN_AMOUNT, { from: bob });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), 0);
        assert.equal((await this.uniLpToken.balanceOf(this.uniStake.address)).valueOf(), LP_TOKEN_AMOUNT.toString());

        await this.uniLpToken.transfer(carol, LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: alice });
        assert.equal((await this.uniLpToken.balanceOf(carol)).valueOf(), LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)).toString());
        //deposit to naanUni2
        await this.uniLpToken.approve(this.naanUniV2.address, LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        await this.naanUniV2.deposit(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        assert.equal((await this.uniLpToken.balanceOf(carol)).valueOf(), 0);
        assert.equal((await this.uniLpToken.balanceOf(this.uniStake.address)).valueOf(), LP_TOKEN_AMOUNT.add(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2))).toString());

        await this.naanUniV2.withdraw(LP_TOKEN_AMOUNT, { from: bob });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), LP_TOKEN_AMOUNT.toString());
        await this.naanUniV2.withdraw(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        assert.equal((await this.uniLpToken.balanceOf(carol)).toString(), (LP_TOKEN_AMOUNT.div(web3.utils.toBN(2))).toString());
        assert.equal((await this.uniLpToken.balanceOf(this.uniStake.address)).toString(), "0");
        assert.equal((await this.uniLpToken.balanceOf(this.naanUniV2.address)).toString(), "0");
        assert.equal((await this.naanUniV2.totalSupply()).toString(), "0");
    });

 

    it('should pending works right', async () => {
        //mint uniswap lp token to bob
        await this.uniLpToken.transfer(bob, LP_TOKEN_AMOUNT, { from: alice });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), LP_TOKEN_AMOUNT.toString());
        //deposit to naanUni2
        await this.uniLpToken.approve(this.naanUniV2.address, LP_TOKEN_AMOUNT, { from: bob });
        await this.naanUniV2.deposit(LP_TOKEN_AMOUNT, { from: bob });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), 0);
        assert.equal((await this.uniLpToken.balanceOf(this.uniStake.address)).valueOf(), LP_TOKEN_AMOUNT.toString());

        await this.uniLpToken.transfer(carol, LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: alice });
        assert.equal((await this.uniLpToken.balanceOf(carol)).valueOf(), LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)).toString());
        //deposit to naanUni2
        await this.uniLpToken.approve(this.naanUniV2.address, LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        await this.naanUniV2.deposit(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        assert.equal((await this.uniLpToken.balanceOf(carol)).valueOf(), 0);
        assert.equal((await this.uniLpToken.balanceOf(this.uniStake.address)).valueOf(), LP_TOKEN_AMOUNT.add(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2))).toString());

        const minWithdrawInterval = web3.utils.toBN(100);
        const withoutFeeBlock = (await time.latestBlock()).add(minWithdrawInterval);
        await time.advanceBlockTo(withoutFeeBlock);
        await time.increase('10');

        const bob_reward = await this.naanUniV2.pending(bob);
        assert.equal(bob_reward[0].gt(NAAN_PRE_BLOCK.mul(minWithdrawInterval).mul(LP_TOKEN_AMOUNT).div((await this.naanUniV2.totalSupply()))), true);
        const carol_reward = await this.naanUniV2.pending(carol);
        assert.equal(carol_reward[0].gt(NAAN_PRE_BLOCK.mul(minWithdrawInterval).mul(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2))).div((await this.naanUniV2.totalSupply()))), true)

        assert.equal(bob_reward[1].div(carol_reward[1]).toString(), "2");
    });

    it('should both withdraw naan and uni rewards', async () => {
        //mint uniswap lp token to bob
        await this.uniLpToken.transfer(bob, LP_TOKEN_AMOUNT, { from: alice });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), LP_TOKEN_AMOUNT.toString());
        //deposit to naanUni2
        await this.uniLpToken.approve(this.naanUniV2.address, LP_TOKEN_AMOUNT, { from: bob });
        await this.naanUniV2.deposit(LP_TOKEN_AMOUNT, { from: bob });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), 0);
        assert.equal((await this.uniLpToken.balanceOf(this.uniStake.address)).valueOf(), LP_TOKEN_AMOUNT.toString());

        const minWithdrawInterval = web3.utils.toBN(100);
        const withoutFeeBlock = (await time.latestBlock()).add(minWithdrawInterval);
        await time.advanceBlockTo(withoutFeeBlock);
        await time.increase('10');
        await this.naanUniV2.deposit(0, { from: bob });
        const uniRewardRate = await this.uniStake.rewardRate();
        console.log(uniRewardRate.toString());
        assert.equal((await this.naan.balanceOf(bob)).toString(), NAAN_PRE_BLOCK.mul(web3.utils.toBN(2)).add(
            NAAN_PRE_BLOCK.mul(minWithdrawInterval)
                .mul(LP_TOKEN_AMOUNT)
                .div((await this.naanUniV2.totalSupply()))).toString());
        assert.equal((await this.uniToken.balanceOf(bob)).gt(web3.utils.toBN(0)), true);
    });

    it('should migrate works well', async () => {
        await this.uniLpToken.transfer(bob, LP_TOKEN_AMOUNT, { from: alice });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), LP_TOKEN_AMOUNT.toString());
        //deposit to naanUni2
        await this.uniLpToken.approve(this.naanUniV2.address, LP_TOKEN_AMOUNT, { from: bob });
        await this.naanUniV2.deposit(LP_TOKEN_AMOUNT, { from: bob });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), 0);
        assert.equal((await this.uniLpToken.balanceOf(this.uniStake.address)).valueOf(), LP_TOKEN_AMOUNT.toString());

        await this.uniLpToken.transfer(carol, LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: alice });
        assert.equal((await this.uniLpToken.balanceOf(carol)).valueOf(), LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)).toString());
        //deposit to naanUni2
        await this.uniLpToken.approve(this.naanUniV2.address, LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        await this.naanUniV2.deposit(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        assert.equal((await this.uniLpToken.balanceOf(carol)).valueOf(), 0);
        assert.equal((await this.uniLpToken.balanceOf(this.uniStake.address)).valueOf(), LP_TOKEN_AMOUNT.add(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2))).toString());


        const minWithdrawInterval = web3.utils.toBN(100);
        const withoutFeeBlock = (await time.latestBlock()).add(minWithdrawInterval);
        await time.advanceBlockTo(withoutFeeBlock);
        await time.increase('10');

        //deploy new factory
        NewNaanSwapFactory = await NaanSwapFactory.new(alice, { from: alice });

        assert.equal((await this.naanUniV2.migrator()).valueOf(), AddressZero);
        migrator = await Migrator.new(this.naanUniV2.address, this.NaanSwapFactory.address, NewNaanSwapFactory.address, 0);
        await this.naanUniV2.setMigrator(migrator.address);
        await NewNaanSwapFactory.setMigrator(migrator.address, { from: alice });

        const oldBalance = (await this.pair.balanceOf(this.uniStake.address));
        console.log("oldBalance: " + oldBalance.toString());
        //create new pair in new factory
        await NewNaanSwapFactory.createPair(this.tokenA.address, this.tokenB.address, { from: alice })
        var pairAddress = await NewNaanSwapFactory.getPair(this.tokenA.address, this.tokenB.address);
        var newPair = await NaanSwapPair.at(pairAddress);

        await this.naanUniV2.migrate();
        assert.equal((await this.pair.balanceOf(this.naanUniV2.address)).toString(), "0");
        assert.equal((await newPair.balanceOf(this.naanUniV2.address)).toString(), oldBalance);

        //can not deposit after migrate
        await this.naanUniV2.withdraw(LP_TOKEN_AMOUNT, { from: bob });
        assert.equal((await this.naan.balanceOf(bob)).gt(web3.utils.toBN(0)), true);
        assert.equal((await this.uniToken.balanceOf(bob)).gt(web3.utils.toBN(0)), true);

        await this.naanUniV2.withdraw(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        assert.equal((await this.naan.balanceOf(carol)).gt(web3.utils.toBN(0)), true);
        assert.equal((await this.uniToken.balanceOf(carol)).gt(web3.utils.toBN(0)), true);

        assert.equal((await newPair.balanceOf(bob)).toString(), LP_TOKEN_AMOUNT.toString());
        assert.equal((await newPair.balanceOf(carol)).toString(), LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)).toString());
    });

    it('should two pools works well', async () => {
        // deposit pool0
        await this.uniLpToken.transfer(bob, LP_TOKEN_AMOUNT, { from: alice });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), LP_TOKEN_AMOUNT.toString());
        //deposit to naanUni2
        await this.uniLpToken.approve(this.naanUniV2.address, LP_TOKEN_AMOUNT, { from: bob });
        await this.naanUniV2.deposit(LP_TOKEN_AMOUNT, { from: bob });
        assert.equal((await this.uniLpToken.balanceOf(bob)).valueOf(), 0);
        assert.equal((await this.uniLpToken.balanceOf(this.uniStake.address)).valueOf(), LP_TOKEN_AMOUNT.toString());

        await this.uniLpToken.transfer(carol, LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: alice });
        assert.equal((await this.uniLpToken.balanceOf(carol)).valueOf(), LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)).toString());
        //deposit to naanUni2
        await this.uniLpToken.approve(this.naanUniV2.address, LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        await this.naanUniV2.deposit(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        assert.equal((await this.uniLpToken.balanceOf(carol)).valueOf(), 0);
        assert.equal((await this.uniLpToken.balanceOf(this.uniStake.address)).valueOf(), LP_TOKEN_AMOUNT.add(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2))).toString());

        //create new pair
        tokenC = await MockERC20.new("tokenC", "tokenC", expandTo18Decimals(100000000), { from: alice });
        tokenD = await MockERC20.new("tokenD", "tokenD", expandTo18Decimals(100000000), { from: alice });

        await this.NaanSwapFactory.createPair(tokenC.address, tokenD.address, { from: alice })
        var pair2Address = await this.NaanSwapFactory.getPair(tokenC.address, tokenD.address);
        var pair2 = await NaanSwapPair.at(pair2Address);

        await tokenC.approve(this.router.address, expandTo18Decimals(100000000), { from: alice });
        await tokenD.approve(this.router.address, expandTo18Decimals(100000000), { from: alice });
        await this.router.addLiquidity(tokenC.address,
            tokenD.address,
            expandTo18Decimals(100000000),
            expandTo18Decimals(100000000),
            0,
            0,
            alice,
            MAX_UINT256,
            { from: alice });

        var uniStake2 = await StakingRewards.new(alice, this.uniToken.address, pair2.address, { from: alice });

        var naanUniV2_2 = await NaanUniV2.new(
            this.naanMaster.address,
            pair2.address,
            uniStake2.address,
            this.uniToken.address,
            this.naan.address,
            fee,
            { from: alice }
        );

        await this.naanMaster.add(100, naanUniV2_2.address, true, { from: alice });

        //deposit pool1
        await pair2.transfer(bob, LP_TOKEN_AMOUNT, { from: alice });
        assert.equal((await pair2.balanceOf(bob)).valueOf(), LP_TOKEN_AMOUNT.toString());
        //deposit to naanUni2
        await pair2.approve(naanUniV2_2.address, LP_TOKEN_AMOUNT, { from: bob });
        await naanUniV2_2.deposit(LP_TOKEN_AMOUNT, { from: bob });
        assert.equal((await pair2.balanceOf(bob)).valueOf(), 0);
        assert.equal((await pair2.balanceOf(uniStake2.address)).valueOf(), LP_TOKEN_AMOUNT.toString());

        await pair2.transfer(carol, LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: alice });
        assert.equal((await pair2.balanceOf(carol)).valueOf(), LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)).toString());
        //deposit to naanUni2
        await pair2.approve(naanUniV2_2.address, LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        await naanUniV2_2.deposit(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        assert.equal((await pair2.balanceOf(carol)).valueOf(), 0);
        assert.equal((await pair2.balanceOf(uniStake2.address)).valueOf(), LP_TOKEN_AMOUNT.add(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2))).toString());

        const minWithdrawInterval = web3.utils.toBN(100);
        const withoutFeeBlock = (await time.latestBlock()).add(minWithdrawInterval);
        await time.advanceBlockTo(withoutFeeBlock);
        await time.increase('10');

        await this.naanUniV2.withdraw(LP_TOKEN_AMOUNT, { from: bob });
        assert.equal((await this.naan.balanceOf(bob)).gt(1), true);
        assert.equal((await this.uniToken.balanceOf(bob)).gt(web3.utils.toBN(0)), true);

        await this.naanUniV2.withdraw(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        assert.equal((await this.naan.balanceOf(carol)).gt(1), true);
        assert.equal((await this.uniToken.balanceOf(carol)).gt(web3.utils.toBN(0)), true);

        await naanUniV2_2.withdraw(LP_TOKEN_AMOUNT, { from: bob });
        assert.equal((await this.naan.balanceOf(bob)).gt(1), true);
        assert.equal((await this.uniToken.balanceOf(bob)).gt(web3.utils.toBN(0)), true);

        await naanUniV2_2.withdraw(LP_TOKEN_AMOUNT.div(web3.utils.toBN(2)), { from: carol });
        assert.equal((await this.naan.balanceOf(carol)).gt(1), true);
        assert.equal((await this.uniToken.balanceOf(carol)).gt(web3.utils.toBN(0)), true);
    });
})