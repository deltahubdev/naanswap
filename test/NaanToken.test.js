const { expectRevert } = require('@openzeppelin/test-helpers');
const NaanToken = artifacts.require('NaanToken');

contract('NaanToken', ([alice, bob, carol]) => {
    beforeEach(async () => {
        this.naan = await NaanToken.new({ from: alice });
    });

    it('should have correct name and symbol and decimal', async () => {
        const name = await this.naan.name();
        const symbol = await this.naan.symbol();
        const decimals = await this.naan.decimals();
        assert.equal(name.valueOf(), 'NaanToken');
        assert.equal(symbol.valueOf(), 'NAAN');
        assert.equal(decimals.valueOf(), '18');
    });

    it('should only allow owner to mint token', async () => {
        await this.naan.mint(alice, '100', { from: alice });
        await this.naan.mint(bob, '1000', { from: alice });
        await expectRevert(
            this.naan.mint(carol, '1000', { from: bob }),
            'Ownable: caller is not the owner',
        );
        const totalSupply = await this.naan.totalSupply();
        const aliceBal = await this.naan.balanceOf(alice);
        const bobBal = await this.naan.balanceOf(bob);
        const carolBal = await this.naan.balanceOf(carol);
        assert.equal(totalSupply.valueOf(), '1100');
        assert.equal(aliceBal.valueOf(), '100');
        assert.equal(bobBal.valueOf(), '1000');
        assert.equal(carolBal.valueOf(), '0');
    });

    it('should supply token transfers properly', async () => {
        await this.naan.mint(alice, '100', { from: alice });
        await this.naan.mint(bob, '1000', { from: alice });
        await this.naan.transfer(carol, '10', { from: alice });
        await this.naan.transfer(carol, '100', { from: bob });
        const totalSupply = await this.naan.totalSupply();
        const aliceBal = await this.naan.balanceOf(alice);
        const bobBal = await this.naan.balanceOf(bob);
        const carolBal = await this.naan.balanceOf(carol);
        assert.equal(totalSupply.valueOf(), '1100');
        assert.equal(aliceBal.valueOf(), '90');
        assert.equal(bobBal.valueOf(), '900');
        assert.equal(carolBal.valueOf(), '110');
    });

    it('should fail if you try to do bad transfers', async () => {
        await this.naan.mint(alice, '100', { from: alice });
        await expectRevert(
            this.naan.transfer(carol, '110', { from: alice }),
            'ERC20: transfer amount exceeds balance',
        );
        await expectRevert(
            this.naan.transfer(carol, '1', { from: bob }),
            'ERC20: transfer amount exceeds balance',
        );
    });

    it('should update vote of delegatee when delegator transfers', async () => {
        await this.naan.mint(alice, '100', { from: alice });
        await this.naan.delegate(bob, { from: alice });
        assert.equal(await this.naan.getCurrentVotes(alice), '0');
        assert.equal(await this.naan.getCurrentVotes(bob), '100');
        await this.naan.mint(alice, '100', { from: alice });
        assert.equal(await this.naan.getCurrentVotes(bob), '200');
        await this.naan.mint(carol, '100', { from: alice });
        await this.naan.transfer(alice, '50', { from: carol });
        assert.equal(await this.naan.getCurrentVotes(bob), '250');
        await this.naan.delegate(carol, { from: alice });
        assert.equal(await this.naan.getCurrentVotes(bob), '0');
        assert.equal(await this.naan.getCurrentVotes(carol), '250');
    });
  });
