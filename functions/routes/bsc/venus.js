
// Imports:
const { ethers } = require('ethers');
const { minABI, venus } = require('../../static/ABIs.js');
const { query, addToken, addDebtToken } = require('../../static/functions.js');

// Initializations:
const chain = 'bsc';
const project = 'venus';
const controller = '0xfD36E2c2a6789Db23113685031d7F16329158384';
const vault = '0x0667eed0a0aab930af74a3dfedd263a73994f216';
const xvsVault = '0x051100480289e704d20e9DB4804837068f3f9204';
const vai = '0x4BD17003473389A42DAF6a0a729f6Fdb328BbBd7';
const xvs = '0xcF6BB5389c92Bdda8a3747Ddb454cB7a64626C63';

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
        response.data.push(...(await getMarketBalances(wallet)));
        response.data.push(...(await getPendingRewards(wallet)));
        response.data.push(...(await getStakedVAI(wallet)));
        response.data.push(...(await getStakedXVS(wallet)));
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

// Function to get market balances:
const getMarketBalances = async (wallet) => {
  let balances = [];
  let markets = await query(chain, controller, venus.controllerABI, 'getAllMarkets', []);
  let promises = markets.map(market => (async () => {
    let balance = parseInt(await query(chain, market, minABI, 'balanceOf', [wallet]));
    if(balance > 0) {
      let exchangeRate = parseInt(await query(chain, market, venus.marketABI, 'exchangeRateStored', []));
      let decimals = parseInt(await query(chain, market, minABI, 'decimals', []));
      let underlyingToken = '';
      if(market.toLowerCase() === '0xA07c5b74C9B40447a954e1466938b865b6BBea36'.toLowerCase()) {
        underlyingToken = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      } else {
        underlyingToken = await query(chain, market, venus.marketABI, 'underlying', []);
      }
      let underlyingBalance = (balance / (10 ** decimals)) * (exchangeRate / (10 ** (decimals + 2)));
      let newToken = await addToken(chain, project, underlyingToken, underlyingBalance, wallet);
      balances.push(newToken);
    }
    let debt = parseInt(await query(chain, market, venus.marketABI, 'borrowBalanceStored', [wallet]));
    if(debt > 0) {
      let underlyingToken = '';
      if(market.toLowerCase() === '0xA07c5b74C9B40447a954e1466938b865b6BBea36'.toLowerCase()) {
        underlyingToken = '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      } else {
        underlyingToken = await query(chain, market, venus.marketABI, 'underlying', []);
      }
      let newToken = await addDebtToken(chain, project, underlyingToken, debt, wallet);
      balances.push(newToken);
    }
  })());
  await Promise.all(promises);
  return balances;
}

// Function to get pending XVS rewards:
const getPendingRewards = async (wallet) => {
  let rewards = parseInt(await query(chain, controller, venus.controllerABI, 'venusAccrued', [wallet]));
  if(rewards > 0) {
    let newToken = await addToken(chain, project, xvs, rewards, wallet);
    return [newToken];
  } else {
    return [];
  }
}

// Function to get staked VAI balance:
const getStakedVAI = async (wallet) => {
  let balances = [];
  let balance = parseInt((await query(chain, vault, venus.vaultABI, 'userInfo', [wallet])).amount);
  if(balance > 0) {
    let newToken = await addToken(chain, project, vai, balance, wallet);
    balances.push(newToken);
  }
  let pendingRewards = parseInt(await query(chain, vault, venus.vaultABI, 'pendingXVS', [wallet]));
  if(pendingRewards > 0) {
    let newToken = await addToken(chain, project, xvs, pendingRewards, wallet);
    balances.push(newToken);
  }
  return balances;
}

// Function to get staked XVS balance:
const getStakedXVS = async (wallet) => {
  let xvsBalance = 0;
  let balance = parseInt(await query(chain, xvsVault, venus.xvsVaultABI, 'getUserInfo', [xvs, 0, wallet]));
  if(balance > 0) {
    xvsBalance += balance;
    let pendingRewards = parseInt(await query(chain, xvsVault, venus.xvsVaultABI, 'pendingReward', [xvs, 0, wallet]));
    if(pendingRewards > 0) {
      xvsBalance += pendingRewards;
    }
    let newToken = await addToken(chain, project, xvs, xvsBalance, wallet);
    return [newToken];
  } else {
    return [];
  }
}