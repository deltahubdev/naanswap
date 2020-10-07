const { expectRevert, time } = require('@openzeppelin/test-helpers');
const NaanToken = artifacts.require('NaanToken');
const MockERC20 = artifacts.require('MockERC20');
const NaanSwapPair = artifacts.require('NaanSwapPair');
const NaanSwapFactory = artifacts.require('NaanSwapFactory');
const NaanDrinker = artifacts.require('NaanDrinker');

contract('NaanDrinker', ([alice, bob, carol]) => {
    beforeEach(async () => {
        this.factory = await NaanSwapFactory.new(alice, { from: alice });
        this.naan = await NaanToken.new({ from: alice });
        await this.naan.mint(alice, '100000000', { from: alice });
        this.uni = await MockERC20.new('UNI', 'UNI', '100000000', { from: alice });
        this.naanuni = await NaanSwapPair.at((await this.factory.createPair(this.naan.address, this.uni.address)).logs[0].args.pair);
        this.blackHoldAddress = '0000000000000000000000000000000000000001';
        this.drinker = await NaanDrinker.new(this.factory.address, this.naan.address, this.uni.address);
    });

    it('only owner can set factory', async () => {
        assert.equal(await this.drinker.owner(), alice);
        assert.equal(await this.drinker.factory(), this.factory.address);
        await expectRevert(this.drinker.setFactory(bob, { from: bob }), 'only owner');
        await this.drinker.setFactory(bob, { from: alice });
        assert.equal(await this.drinker.factory(), bob);
    });

    it('should convert uni to naan successfully', async () => {
        // add liquidity
        await this.naan.transfer(this.naanuni.address, '100000', { from: alice });
        await this.uni.transfer(this.naanuni.address, '100000', { from: alice });
        await this.naanuni.sync();
        await this.naan.transfer(this.naanuni.address, '10000000', { from: alice });
        await this.uni.transfer(this.naanuni.address, '10000000', { from: alice });
        await this.naanuni.mint(alice);

        await this.uni.transfer(this.drinker.address, '1000');
        await this.drinker.convert();
        assert.equal(await this.uni.balanceOf(this.drinker.address), '0');
        assert.equal(await this.naan.balanceOf(this.blackHoldAddress), '996');
    });
})