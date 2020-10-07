const { expectRevert, time } = require('@openzeppelin/test-helpers');
const NaanMaster = artifacts.require('NaanMaster');
const NaanToken = artifacts.require('NaanToken');
const NaanLock = artifacts.require('NaanLock');

contract('NaanLock', ([alice, bob, carol]) => {
    beforeEach(async () => {
        this.naan = await NaanToken.new({ from: alice });
        this.master = await NaanMaster.new(this.naan.address, bob, '1000', '0', { from: alice });
        this.naanLock = await NaanLock.new(this.naan.address, this.master.address, { from: alice });
    });

    it('should deposit NaanLock Token success', async () => {
        const totalSupply = await this.naanLock.totalSupply();
        assert.equal(totalSupply.valueOf(), '1');
        await this.naan.transferOwnership(this.master.address, { from: alice });
        await this.master.add('100', this.naanLock.address, false);
        await time.advanceBlockTo('8');
        await this.naanLock.deposit('0', { from: alice });
        await time.advanceBlockTo('10');
        assert.equal((await this.master.pendingNaan(0, this.naanLock.address)).valueOf(), '1000');
        await this.naanLock.withdrawFromNaanMaster('0', { from: alice });
        assert.equal(await this.naan.balanceOf(this.naanLock.address).valueOf(), '2000');

        await this.naanLock.setwithdrawContractAddr(carol);
        assert.equal(await this.naanLock.withDrawAddr().valueOf(), carol);

        await this.naanLock.withdrawToContract(50);
        assert.equal(await this.naan.balanceOf(this.naanLock.address).valueOf(), '1950');
        assert.equal(await this.naan.balanceOf(carol).valueOf(), '50');
    });
})