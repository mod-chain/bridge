#!/bin/bash

PWD=$(pwd)
echo $PWD

run_check() {
    cd $PWD/packages/$1
    pnpm run typecheck
    pnpm run format:check
}

packages=("hardhat" "snowbridge" "foundry" "wallet")
for package in "${packages[@]}"; do
    run_check $package
done


