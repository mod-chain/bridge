#!/bin/bash

PWD=$(pwd)

source $PWD/.env

export L2_ADMIN=$L2_ADMIN
export L2_TOKEN_NAME=$L2_TOKEN_NAME
export L2_TOKEN_SYMBOL=$L2_TOKEN_SYMBOL
export DEPLOYER_PK_DEC=$DEPLOYER_PK_DEC
export PRIVATE_KEY=$PRIVATE_KEY
export BASE_SEPOLIA_RPC=$BASE_SEPOLIA_RPC

cd $PWD/packages/hardhat
pnpm i
pnpm run deploy:l2