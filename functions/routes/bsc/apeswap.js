
// Imports:
const { ethers } = require('ethers');
const { minABI, apeswap } = require('../../static/ABIs.js');
const { query, addToken, addLPToken } = require('../../static/functions.js');

// Initializations:
const chain = 'bsc';
const project = 'apeswap';
const masterApe = '0x5c8D727b265DBAfaba67E050f2f739cAeEB4A6F9';
const vaultMaster = '0x5711a833C943AD1e8312A9c7E5403d48c717e1aa';
const banana = '0x603c7f932ED1fc6575303D8Fb018fDCBb0f39a95';

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
        response.data.push(...(await getFarmBalances(wallet)));
        response.data.push(...(await getVaultBalances(wallet)));
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

// Function to get farm balances:
const getFarmBalances = async (wallet) => {
  let balances = [];
  let bananaRewards = 0;
  let farmCount = parseInt(await query(chain, masterApe, apeswap.masterApeABI, 'poolLength', []));
  let farms = [...Array(farmCount).keys()];
  let promises = farms.map(farmID => (async () => {
    let balance = parseInt((await query(chain, masterApe, apeswap.masterApeABI, 'userInfo', [farmID, wallet])).amount);
    if(balance > 0) {

      // BANANA Farm:
      if(farmID === 0) {
        let newToken = await addToken(chain, project, banana, balance, wallet);
        balances.push(newToken);

      // LP Farms:
      } else {
        let lpToken = (await query(chain, masterApe, apeswap.masterApeABI, 'poolInfo', [farmID])).lpToken;
        let newToken = await addLPToken(chain, project, lpToken, balance, wallet);
        balances.push(newToken);
      }

      // Pending BANANA Rewards:
      let rewards = parseInt(await query(chain, masterApe, apeswap.masterApeABI, 'pendingCake', [farmID, wallet]));
      if(rewards > 0) {
        bananaRewards += rewards;
      }
    }
  })());
  await Promise.all(promises);
  if(bananaRewards > 0) {
    let newToken = await addToken(chain, project, banana, bananaRewards, wallet);
    balances.push(newToken);
  }
  return balances;
}

// Function to get vault balances:
const getVaultBalances = async (wallet) => {
  let balances = [];
  let vaultCount = parseInt(await query(chain, vaultMaster, apeswap.vaultMasterABI, 'poolLength', []));
  let vaults = [...Array(vaultCount).keys()];
  let promises = vaults.map(vaultID => (async () => {
    let balance = parseInt(await query(chain, vaultMaster, apeswap.vaultMasterABI, 'stakedWantTokens', [vaultID, wallet]));
    if(balance > 0) {
      let token = (await query(chain, vaultMaster, apeswap.vaultMasterABI, 'poolInfo', [vaultID])).want;
      let symbol = await query(chain, token, minABI, 'symbol', []);

      // LP Vaults:
      if(symbol.endsWith('LP')) {
        let newToken = await addLPToken(chain, project, token, balance, wallet);
        balances.push(newToken);

      // Other Vaults:
      } else {
        let newToken = await addToken(chain, project, token, balance, wallet);
        balances.push(newToken);
      }
    }
  })());
  await Promise.all(promises);
  return balances;
}