const { expectRevert, time } = require('@openzeppelin/test-helpers');
const NaanToken = artifacts.require('NaanToken');
const DevFunds = artifacts.require('DevFunds');

contract('DevFunds', ([alice, bob, carol]) => {
    beforeEach(async () => {
        this.naan = await NaanToken.new({ from: alice });
        this.devFunds = await DevFunds.new(this.naan.address, bob, { from: alice });
        this.withdrawInternal = await this.devFunds.WITHDRAW_INTERVAL();
        this.withdrawHalfThreshold = await this.devFunds.WITHDRAW_HALF_THRESHOLD();
    });

    it('should revert before lockTime', async () => {
        await expectRevert(this.devFunds.withdraw({ from: alice }), 'naan locked');
        let lastWithdrawBlock = await this.devFunds.lastWithdrawBlock();
        const unlockBlock = parseInt(lastWithdrawBlock) + parseInt(this.withdrawInternal);
        await time.advanceBlockTo(unlockBlock);
        await expectRevert(this.devFunds.withdraw({ from: alice }), 'zero naan amount');
        await this.naan.mint(this.devFunds.address, '99600000000000000000000');
        await this.devFunds.withdraw({ from: alice });
        const bal1 = await this.naan.balanceOf(bob);
        assert.equal(bal1.valueOf(), '49800000000000000000000');
        lastWithdrawBlock = await this.devFunds.lastWithdrawBlock();
        assert.equal(lastWithdrawBlock.valueOf(), unlockBlock + 3);
        const lastWithdrawBlock2 = parseInt(lastWithdrawBlock) + parseInt(this.withdrawInternal);
        await time.advanceBlockTo(lastWithdrawBlock2);
        await this.devFunds.withdraw({ from: alice });
        const bal2 = await this.naan.balanceOf(bob);
        assert.equal(bal2.valueOf(), '99600000000000000000000');
        lastWithdrawBlock = await this.devFunds.lastWithdrawBlock();
        assert.equal(lastWithdrawBlock.valueOf(), parseInt(lastWithdrawBlock2) + 1);
    });
})