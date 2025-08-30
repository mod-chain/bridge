#!/bin/bash

PWD=$(pwd)
source $PWD/.env

read -p "Enter network (e/b/ethereum/base): " network

# normalize case for network selection
network_lc=$(echo "$network" | tr '[:upper:]' '[:lower:]')
if [[ $network_lc == b* || $network_lc == base* ]]; then
  network="BASE"
else
  network="ETHEREUM"
fi

read -p "Testnet? (Y/n): " testnet
echo "Testnet: $testnet"

# default to testnet unless explicitly 'n'/'no'
testnet_lc=$(echo "$testnet" | tr '[:upper:]' '[:lower:]')
if [[ -z $testnet_lc || $testnet_lc == y* ]]; then
  selected_network="${network}_SEPOLIA_RPC"
elif [[ $testnet_lc == n* ]]; then
  selected_network="${network}_RPC"
else
  # any other input defaults to testnet
  selected_network="${network}_SEPOLIA_RPC"
fi

echo "Selected network: $selected_network"

read -p "Address: " address
if [[ -z $address ]]; then
  echo "Using default address: $CDP_WALLET_ADDRESS"
  address=$CDP_WALLET_ADDRESS
fi

echo "Selected address: $address"

read -p "Confirm? (y/n): " confirm
confirm_lc=$(echo "$confirm" | tr '[:upper:]' '[:lower:]')
if [[ $confirm_lc != y* ]]; then
  exit 1
fi

echo "Checking balance for $address on $selected_network"


wei_balance=$(cast balance $address --rpc-url ${!selected_network})

balance=$(cast from-wei $wei_balance)
echo "Balance: $balance"

