#!/bin/bash

PWD=$(pwd)

source $PWD/.env
export L1_ADMIN=$L1_ADMIN
export L1_TOKEN_NAME=$L1_TOKEN_NAME
export L1_TOKEN_SYMBOL=$L1_TOKEN_SYMBOL
export DEPLOYER_PK_DEC=$DEPLOYER_PK_DEC
export PRIVATE_KEY=$PRIVATE_KEY

cd $PWD/packages/foundry
forge script script/DeployL1Token.s.sol:DeployL1Token --rpc-url $ETHEREUM_SEPOLIA_RPC --broadcast
