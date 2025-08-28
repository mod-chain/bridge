#!/bin/bash

# Usage: ./faucet.sh [--debug|--verbose]
# When not in debug/verbose mode, prints minimal output (attempt number and tx hash).
# With --debug/--verbose, prints full underlying command output.

PWD=$(pwd)
source $PWD/.env

export CDP_WALLET_ADDRESS=$CDP_WALLET_ADDRESS


# Parse optional verbosity flag
VERBOSE=0
case "$1" in
  --debug|--verbose|-v)
    VERBOSE=1
    shift || true
    ;;
esac

read -p "Enter network (e/b/ethereum/base): " network

# normalize case for network selection
network_lc=$(echo "$network" | tr '[:upper:]' '[:lower:]')
if [[ $network_lc == b* || $network_lc == base* ]]; then
  network="base"
else
  network="ethereum"
fi

read -p "Testnet? (Y/n): " testnet

# default to testnet unless explicitly 'n'/'no'
testnet_lc=$(echo "$testnet" | tr '[:upper:]' '[:lower:]')
if [[ -z $testnet_lc || $testnet_lc == y* ]]; then
  selected_network="${network}-sepolia"
elif [[ $testnet_lc == n* ]]; then
  selected_network="$network"
else
  # any other input defaults to testnet
  selected_network="${network}-sepolia"
fi

echo "Selected network: $selected_network"

read -p "Address: " address
if [[ -z $address ]]; then
  echo "Using default address: $CDP_WALLET_ADDRESS"
  address=$CDP_WALLET_ADDRESS
fi

echo "Selected address: $address"


read -p "How many times? " times
if [[ -z $times ]]; then
  times=1
fi

echo "Times: $times"

read -p "Sleep time (default: 10): " sleep_time
if [[ -z $sleep_time ]]; then
  sleep_time=10
fi

echo "Sleep time: $sleep_time"

read -p "Confirm? (y/n): " confirm
confirm_lc=$(echo "$confirm" | tr '[:upper:]' '[:lower:]')
if [[ $confirm_lc != y* ]]; then
  exit 1
fi

for i in $(seq 1 $times); do
  echo "---"
  echo "Command: pnpm -s wallet:faucet -- --network \"$selected_network\" --token eth --address \"$address\""
  echo "making call... $i/$times"
  run_result=$(pnpm -s wallet:faucet -- --network "$selected_network" --token eth --address "$address" 2>&1)

  if [[ $VERBOSE -eq 1 ]]; then
    # Full output
    printf "%s\n" "$run_result"
  else
    # Minimal output: show tx hash if present
    if echo "$run_result" | grep -q "transactionHash"; then
      tx=$(echo "$run_result" | sed -nE "s/.*transactionHash[: ]*'?([0-9a-fA-Fx]+)'.*/\1/p" | head -n1)
      if [[ -n "$tx" ]]; then
        echo "Success!"
        echo "Tx: $tx"
      fi
    fi
  fi

  if echo "$run_result" | grep -q "Error:"; then
    echo "Failed to get faucet"
    if [[ $VERBOSE -eq 0 ]]; then
      # Show the first error line for context
      echo "$run_result" | grep -m1 "Error:"
    fi
    exit 1
  fi
  echo "Sleeping for \$$sleep_time seconds..."
  sleep $sleep_time
done

pnpm run wallet:balance -- --address "$address"