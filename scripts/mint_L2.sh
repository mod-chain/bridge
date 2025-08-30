#!/bin/bash

PWD=$(pwd)

source $PWD/.env

export NETWORK=sepolia
export USE_JSON=false
export L1_STANDARD_BRIDGE=$L1_STANDARD_BRIDGE
export L1_TOKEN=$L1_TOKEN
export L2_TOKEN=$L2_TOKEN
export AMOUNT=100000000000000000
export L2_GAS=200000

# Foundry wants decimal for the script key
export DEPLOYER_PK_DEC=$(cast to-dec "$DEPLOYER_PK")

cd packages/foundry
forge script script/DepositL1toBase.s.sol:DepositL1toBase \
  --rpc-url "$ETHEREUM_SEPOLIA_RPC" \
  --broadcast



