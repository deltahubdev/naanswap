const { expectRevert } = require('@openzeppelin/test-helpers');
const NaanToken = artifacts.require('NaanToken');
const NaanMaster = artifacts.require('NaanMaster');
const NaanBar = artifacts.require('NaanBar');
const NaanVoterProxy = artifacts.require('NaanVoterProxy');
const MockERC20 = artifacts.require('MockERC20');
const NaanSwapPair = artifacts.require('NaanSwapPair');
const NaanSwapFactory = artifacts.require('NaanSwapFactory');

const TOTAL_SUPPLY = 10000000;
const LP_SUPPLY    = 1000000;

contract('NaanVoterProxy', ([alice, bob, carol, dev, minter]) => {
    beforeEach(async () => {
        this.naanToken = await NaanToken.new({ from: alice });
        await this.naanToken.mint(minter, TOTAL_SUPPLY, { from: alice });
        this.naanMaster = await NaanMaster.new(this.naanToken.address, dev, '1000', '0', { from: alice });
        this.NaanBar = await NaanBar.new(this.naanToken.address,{ from: alice });
        this.naanVoterProxy = await NaanVoterProxy.new(this.naanToken.address, this.naanMaster.address,this.NaanBar.address, { from: alice });
    });

    it('check totalSupply', async () => {
        await this.naanToken.mint(alice, '10000', { from: alice });
        await this.naanToken.mint(bob, '10000', { from: alice });
        await this.naanToken.mint(carol, '10000', { from: alice });
        //sqrt(10030000)
        assert.equal((await this.naanVoterProxy.totalSupply()).valueOf(), '3167');
        await this.naanToken.mint(carol, '50000', { from: alice });
        //sqrt(10080000)
        assert.equal((await this.naanVoterProxy.totalSupply()).valueOf(), '3174');
        await this.naanToken.mint(bob, '50000', { from: alice });
        //sqrt(10130000)
        assert.equal((await this.naanVoterProxy.totalSupply()).valueOf(), '3182');
        this.naanVoterProxy.setSqrtEnable(false, { from: alice });
        assert.equal((await this.naanVoterProxy.totalSupply()).valueOf(), '10130000');
        this.naanVoterProxy.setSqrtEnable(true, { from: alice });
        assert.equal((await this.naanVoterProxy.totalSupply()).valueOf(), '3182');
        //naanbar enter
        await this.naanToken.approve(this.NaanBar.address, '10000', { from: carol });
        await this.NaanBar.enter('10000',{ from: carol });
        //sqrt(10140000)
        assert.equal((await this.naanVoterProxy.totalSupply()).valueOf(), '3184');
        await this.naanVoterProxy.setPow(2,1,0, { from: alice });
        // totalSupply = //sqrt(10130000)
        assert.equal((await this.naanVoterProxy.totalSupply()).valueOf(), '3182');
        await this.naanVoterProxy.setPow(2,1,2, { from: alice });
        // totalSupply = //sqrt(10150000)
        assert.equal((await this.naanVoterProxy.totalSupply()).valueOf(), '3185');
    });

    it('check votePools api', async () => {
        // assert.equal((await this.naanVoterProxy.getVotePoolNum()).valueOf(), '5');
        // assert.equal((await this.naanVoterProxy.getVotePoolId(1)).valueOf(), '32');
        await expectRevert(this.naanVoterProxy.addVotePool(5,{ from: bob }),'Not Owner');
        // assert.equal((await this.naanVoterProxy.getVotePoolNum()).valueOf(), '5');
        this.naanVoterProxy.addVotePool('5', { from: alice });
        // assert.equal((await this.naanVoterProxy.getVotePoolNum()).valueOf(), '6');
        // assert.equal((await this.naanVoterProxy.getVotePoolId(3)).valueOf(), '34');
        // assert.equal((await this.naanVoterProxy.getVotePoolId(5)).valueOf(), '5');
        await expectRevert(this.naanVoterProxy.delVotePool('5', { from: bob }),'Not Owner');
        // assert.equal((await this.naanVoterProxy.getVotePoolNum()).valueOf(), '6');
        this.naanVoterProxy.delVotePool('5', { from: alice });
        // assert.equal((await this.naanVoterProxy.getVotePoolNum()).valueOf(), '5');
        // assert.equal((await this.naanVoterProxy.getVotePoolId(2)).valueOf(), '33');
        // this.naanVoterProxy.addVotePool('9', { from: alice });
        // assert.equal((await this.naanVoterProxy.getVotePoolNum()).valueOf(), '6');
        // assert.equal((await this.naanVoterProxy.getVotePoolId(5)).valueOf(), '9');
    });

    it('check balanceOf', async () => {
        assert.equal((await this.naanVoterProxy.balanceOf(bob)).valueOf(), '0');
        this.factory0 = await NaanSwapFactory.new(alice, { from: alice });
        this.factory32 = await NaanSwapFactory.new(alice, { from: alice });
        this.factory33 = await NaanSwapFactory.new(alice, { from: alice });
        this.factory34 = await NaanSwapFactory.new(alice, { from: alice });
        await this.naanToken.transferOwnership(this.naanMaster.address, { from: alice });
        this.token0 = await MockERC20.new('TToken', 'TOKEN0', TOTAL_SUPPLY, { from: minter });
        this.lp0 = await NaanSwapPair.at((await this.factory0.createPair(this.token0.address, this.naanToken.address)).logs[0].args.pair);
        await this.token0.transfer(this.lp0.address, LP_SUPPLY, { from: minter });
        await this.naanToken.transfer(this.lp0.address, LP_SUPPLY, { from: minter });
        await this.lp0.mint(minter);
        await this.naanMaster.add('10000', this.lp0.address, true);
        for(i=1;i<32;i++)
        {
            this.lptemp = await MockERC20.new('LPToken', 'TOKEN', TOTAL_SUPPLY, { from: minter });
            await this.naanMaster.add('10000', this.lptemp.address, true);
        }
        this.token32 = await MockERC20.new('TToken', 'Token32', TOTAL_SUPPLY, { from: minter });
        this.lp32 = await NaanSwapPair.at((await this.factory32.createPair(this.token32.address, this.naanToken.address)).logs[0].args.pair);
        await this.token32.transfer(this.lp32.address, LP_SUPPLY, { from: minter });
        await this.naanToken.transfer(this.lp32.address, LP_SUPPLY, { from: minter });
        await this.lp32.mint(minter);
        await this.naanMaster.add('10000', this.lp32.address, true);
        this.token33 = await MockERC20.new('TToken', 'TOKEN33', TOTAL_SUPPLY, { from: minter });
        this.lp33 = await NaanSwapPair.at((await this.factory33.createPair(this.token33.address, this.naanToken.address)).logs[0].args.pair);
        await this.token33.transfer(this.lp33.address, LP_SUPPLY, { from: minter });
        await this.naanToken.transfer(this.lp33.address, LP_SUPPLY, { from: minter });
        await this.lp33.mint(minter);
        await this.naanMaster.add('10000', this.lp33.address, true);
        this.token34 = await MockERC20.new('LPToken', 'TOKEN34', TOTAL_SUPPLY, { from: minter });
        this.lp34 = await NaanSwapPair.at((await this.factory34.createPair(this.token34.address, this.naanToken.address)).logs[0].args.pair);
        await this.token34.transfer(this.lp34.address, LP_SUPPLY, { from: minter });
        await this.naanToken.transfer(this.lp34.address, LP_SUPPLY, { from: minter });
        await this.lp34.mint(minter);
        await this.naanMaster.add('10000', this.lp34.address, true);
        //null pool will destroy 1000 lp_token
        // console.log("get minter lp0",(await this.lp0.balanceOf(minter)).valueOf());
        // console.log("get minter vote",(await this.naanVoterProxy.balanceOf(minter)).valueOf());
        await this.lp0.approve(this.naanMaster.address, '10000', { from: minter });
        await this.naanMaster.deposit(0, '10000', { from: minter });
        //sqrt(6020000)
        assert.equal((await this.naanVoterProxy.balanceOf(minter)).valueOf(), '2453');
        await this.lp32.approve(this.naanMaster.address, '20000', { from: minter });
        await this.naanMaster.deposit(32, '10000', { from: minter });
        //sqrt(6040000)
        assert.equal((await this.naanVoterProxy.balanceOf(minter)).valueOf(), '2457');

        await this.lp0.transfer(bob, '20000', { from: minter });
        await this.lp0.approve(this.naanMaster.address, '20000', { from: bob });
        await this.naanMaster.deposit(0, '10000', { from: bob });
        //sqrt(20000)
        assert.equal((await this.naanVoterProxy.balanceOf(bob)).valueOf(), '141');
        await this.lp32.transfer(bob, '20000', { from: minter });
        await this.lp32.approve(this.naanMaster.address, '20000', { from: bob });
        await this.naanMaster.deposit(32, '20000', { from: bob });
        //sqrt(60000)
        assert.equal((await this.naanVoterProxy.balanceOf(bob)).valueOf(), '244');
        await this.lp34.transfer(bob, '20000', { from: minter });
        await this.lp34.approve(this.naanMaster.address, '20000', { from: bob });
        await this.naanMaster.deposit(34, '20000', { from: bob });
        //sqrt(100000)
        assert.equal((await this.naanVoterProxy.balanceOf(bob)).valueOf(), '316');
        await this.naanMaster.withdraw(34, '10000', { from: bob });
        //sqrt(80000)
        assert.equal((await this.naanVoterProxy.balanceOf(bob)).valueOf(), '282');

        //no votepool deposit
        this.factory35 = await NaanSwapFactory.new(alice, { from: alice });
        this.token35 = await MockERC20.new('TToken', 'TOKE35', TOTAL_SUPPLY, { from: minter });
        this.lp35 = await NaanSwapPair.at((await this.factory35.createPair(this.token35.address, this.naanToken.address)).logs[0].args.pair);
        await this.token35.transfer(this.lp35.address, LP_SUPPLY, { from: minter });
        await this.naanToken.transfer(this.lp35.address, LP_SUPPLY, { from: minter });
        await this.lp35.mint(minter);
        await this.naanMaster.add('10000', this.lp35.address, true);
        await this.lp35.transfer(bob, '20000', { from: minter });
        await this.lp35.approve(this.naanMaster.address, '20000', { from: bob });
        await this.naanMaster.deposit(35, '20000', { from: bob });
        //sqrt(80000)
        assert.equal((await this.naanVoterProxy.balanceOf(bob)).valueOf(), '282');
        //add votepool 35
        await this.naanVoterProxy.addVotePool('35', { from: alice });
        //sqrt(120000)
        assert.equal((await this.naanVoterProxy.balanceOf(bob)).valueOf(), '346');
        await this.naanMaster.withdraw(35, '10000', { from: bob });
        //sqrt(100000)
        assert.equal((await this.naanVoterProxy.balanceOf(bob)).valueOf(), '316');
        //del votepool 35
        await this.naanVoterProxy.delVotePool('35', { from: alice });
        //sqrt(80000)
        assert.equal((await this.naanVoterProxy.balanceOf(bob)).valueOf(), '282');

        // test xnaan voter
        //bob 20000 naan , 40000 lp_naan 
        await this.naanToken.transfer(bob, 20000, { from: minter });
        //naanbar enter
        await this.naanToken.approve(this.NaanBar.address, '10000', { from: bob });
        await this.NaanBar.enter('10000',{ from: bob });
        ////bob 10000 naan , 40000 lp_naan , 10000 xnaan
        //sqrt(100000)
        assert.equal((await this.naanVoterProxy.balanceOf(bob)).valueOf(), '316');
        
        //test setPow
        await this.naanVoterProxy.setPow(2,1,0, { from: alice });
        // voter = sqrt(2*40000+1*10000)
        assert.equal((await this.naanVoterProxy.balanceOf(bob)).valueOf(), '300');
        await this.naanVoterProxy.setPow(1,1,0, { from: alice });
        //voter = sqrt(1*40000+1*10000)
        assert.equal((await this.naanVoterProxy.balanceOf(bob)).valueOf(), '223');
        await this.naanVoterProxy.setPow(1,1,2, { from: alice });
        //voter = sqrt(1*40000+1*10000+2*10000)
        assert.equal((await this.naanVoterProxy.balanceOf(bob)).valueOf(), '264');
    });
});
