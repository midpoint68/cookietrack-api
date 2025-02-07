
// Imports:
const { ethers } = require('ethers');
const { minABI, mstable } = require('../../static/ABIs.js');
const { query, addToken, addStableToken, addBalancerToken } = require('../../static/functions.js');

// Initializations:
const chain = 'eth';
const project = 'mstable';
const imUSD = '0x30647a72dc82d7fbb1123ea74716ab8a317eac19';
const imBTC = '0x17d8CBB6Bce8cEE970a4027d1198F6700A7a6c24';
const imUSDVault = '0x78BefCa7de27d07DC6e71da295Cc2946681A6c7B';
const imBTCVault = '0xF38522f63f40f9Dd81aBAfD2B8EFc2EC958a3016';
const staking = '0x8f2326316ec696f6d023e37a9931c2b2c177a3d7';
const balStaking = '0xeFbe22085D9f29863Cfb77EEd16d3cC0D927b011';
const pools = [
  '0xfE842e95f8911dcc21c943a1dAA4bd641a1381c6', // mUSD-BUSD
  '0x4fB30C5A3aC8e85bC32785518633303C4590752d', // mUSD-GUSD
  '0x4eaa01974B6594C0Ee62fFd7FEE56CF11E6af936', // mUSD-alUSD
  '0x36f944b7312eac89381bd78326df9c84691d8a5b', // mUSD-RAI
  '0x2F1423D27f9B20058d9D1843E342726fDF985Eb4', // mUSD-FEI
  '0xc3280306b6218031e61752d060b091278d45c329', // mBTC-TBTC V2
  '0x48c59199Da51B7E30Ea200a74Ea07974e62C4bA7'  // mBTC-HBTC
];
const vaults = [
  '0xD124B55f70D374F58455c8AEdf308E52Cf2A6207', // mUSD-BUSD
  '0xAdeeDD3e5768F7882572Ad91065f93BA88343C99', // mUSD-GUSD
  '0x0997dDdc038c8A958a3A3d00425C16f8ECa87deb', // mUSD-alUSD
  '0xF93e0ddE0F7C48108abbD880DB7697A86169f13b', // mUSD-RAI
  '0xD24099Eb4CD604198071958655E4f2D263a5539B', // mUSD-FEI
  '0x97e2a2f97a2e9a4cfb462a49ab7c8d205abb9ed9', // mBTC-TBTC V2
  '0xF65D53AA6e2E4A5f4F026e73cb3e22C22D75E35C'  // mBTC-HBTC
];
const mta = '0xa3bed4e1c75d00fa6f4e5e6922db7261b5e9acd2';

/* ========================================================================================================================================================================= */

// GET Function:
exports.get = async (req) => {

  // Initializing Response:
  let response = {
    status: 'ok',
    data: [],
    request: req.originalUrl
  }

  // Getting Wallet Address:
  const wallet = req.query.address;

  // Checking Parameters:
  if(wallet != undefined) {
    if(ethers.utils.isAddress(wallet)) {
      try {
        response.data.push(...(await getAssetBalances(wallet)));
        response.data.push(...(await getPoolBalances(wallet)));
        response.data.push(...(await getVaultBalances(wallet)));
        response.data.push(...(await getStaked(wallet)));
      } catch(err) {
        console.error(err);
        response.status = 'error';
        response.data = [{error: 'Internal API Error'}];
      }
    } else {
      response.status = 'error';
      response.data = [{error: 'Invalid Wallet Address'}];
    }
  } else {
    response.status = 'error';
    response.data = [{error: 'No Wallet Address in Request'}];
  }

  // Returning Response:
  return JSON.stringify(response, null, ' ');
}

/* ========================================================================================================================================================================= */

// Function to get asset balances:
const getAssetBalances = async (wallet) => {
  let balances = [];

  // imUSD:
  let usdAssetBalance = parseInt(await query(chain, imUSD, minABI, 'balanceOf', [wallet]));
  if(usdAssetBalance > 0) {
    let decimals = parseInt(await query(chain, imUSD, minABI, 'decimals', []));
    let exchangeRate = parseInt(await query(chain, imUSD, mstable.assetABI, 'exchangeRate', [])) / (10 ** decimals);
    let token = await query(chain, imUSD, mstable.assetABI, 'underlying', []);
    let newToken = await addToken(chain, project, token, usdAssetBalance * exchangeRate, wallet);
    balances.push(newToken);
  }

  // imBTC:
  let btcAssetBalance = parseInt(await query(chain, imBTC, minABI, 'balanceOf', [wallet]));
  if(btcAssetBalance > 0) {
    let decimals = parseInt(await query(chain, imBTC, minABI, 'decimals', []));
    let exchangeRate = parseInt(await query(chain, imBTC, mstable.assetABI, 'exchangeRate', [])) / (10 ** decimals);
    let token = await query(chain, imBTC, mstable.assetABI, 'underlying', []);
    let newToken = await addToken(chain, project, token, btcAssetBalance * exchangeRate, wallet);
    balances.push(newToken);
  }

  // imUSD Vault:
  let usdVaultBalance = parseInt(await query(chain, imUSDVault, mstable.vaultABI, 'rawBalanceOf', [wallet]));
  if(usdVaultBalance > 0) {
    let decimals = parseInt(await query(chain, imUSD, minABI, 'decimals', []));
    let exchangeRate = parseInt(await query(chain, imUSD, mstable.assetABI, 'exchangeRate', [])) / (10 ** decimals);
    let token = await query(chain, imUSD, mstable.assetABI, 'underlying', []);
    let newToken = await addToken(chain, project, token, usdVaultBalance * exchangeRate, wallet);
    balances.push(newToken);
    let rewards = parseInt(await query(chain, imUSDVault, mstable.vaultABI, 'earned', [wallet]));
    if(rewards > 0) {
      let newToken = await addToken(chain, project, mta, rewards, wallet);
      balances.push(newToken);
    }
  }

  // imBTC Vault:
  let btcVaultBalance = parseInt(await query(chain, imBTCVault, mstable.vaultABI, 'rawBalanceOf', [wallet]));
  if(btcVaultBalance > 0) {
    let decimals = parseInt(await query(chain, imBTC, minABI, 'decimals', []));
    let exchangeRate = parseInt(await query(chain, imBTC, mstable.assetABI, 'exchangeRate', [])) / (10 ** decimals);
    let token = await query(chain, imBTC, mstable.assetABI, 'underlying', []);
    let newToken = await addToken(chain, project, token, btcVaultBalance * exchangeRate, wallet);
    balances.push(newToken);
    let rewards = parseInt(await query(chain, imBTCVault, mstable.vaultABI, 'earned', [wallet]));
    if(rewards > 0) {
      let newToken = await addToken(chain, project, mta, rewards, wallet);
      balances.push(newToken);
    }
  }

  return balances;
}

// Function to get pool balances:
const getPoolBalances = async (wallet) => {
  let balances = [];
  let promises = pools.map(lpToken => (async () => {
    let balance = parseInt(await query(chain, lpToken, minABI, 'balanceOf', [wallet]));
    if(balance > 0) {
      let newToken = await addStableToken(chain, project, lpToken, balance, wallet);
      balances.push(newToken);
    }
  })());
  await Promise.all(promises);
  return balances;
}

// Function to get vault balances:
const getVaultBalances = async (wallet) => {
  let balances = [];
  let mtaRewards = 0;
  let promises = vaults.map(vault => (async () => {
    let balance = parseInt(await query(chain, vault, mstable.vaultABI, 'rawBalanceOf', [wallet]));
    if(balance > 0) {
      let lpToken = await query(chain, vault, mstable.vaultABI, 'stakingToken', []);
      let newToken = await addStableToken(chain, project, lpToken, balance, wallet);
      balances.push(newToken);
      let rewards = parseInt(await query(chain, vault, mstable.vaultABI, 'earned', [wallet]));
      if(rewards > 0) {
        mtaRewards += rewards;
      }
    }
  })());
  await Promise.all(promises);
  if(mtaRewards > 0) {
    let newToken = await addToken(chain, project, mta, mtaRewards, wallet);
    balances.push(newToken);
  }
  return balances;
}

// Function to get staked balances:
const getStaked = async (wallet) => {
  let balances = [];
  let mtaSum = 0;

  // MTA Staking:
  let mtaBalance = parseInt((await query(chain, staking, mstable.stakingABI, 'rawBalanceOf', [wallet]))[0]);
  if(mtaBalance > 0) {
    mtaSum += mtaBalance;
    let mtaRewards = parseInt(await query(chain, staking, mstable.stakingABI, 'earned', [wallet]));
    if(mtaRewards > 0) {
      mtaSum += mtaRewards;
    }
  }

  // Balancer LP Staking:
  let balBalance = parseInt((await query(chain, balStaking, mstable.stakingABI, 'rawBalanceOf', [wallet]))[0]);
  if(balBalance > 0) {
    let token = await query(chain, balStaking, mstable.stakingABI, 'STAKED_TOKEN', []);
    let id = await query(chain, token, mstable.mbptABI, 'getPoolId', []);
    let newToken = await addBalancerToken(chain, project, mta, mtaSum, wallet, id);
    balances.push(newToken);
    let mtaRewards = parseInt(await query(chain, balStaking, mstable.stakingABI, 'earned', [wallet]));
    if(mtaRewards > 0) {
      mtaSum += mtaRewards;
    }
  }
  if(mtaSum > 0) {
    let newToken = await addToken(chain, project, mta, mtaSum, wallet);
    balances.push(newToken);
  }
  return balances;
}