
function normalizeBalance(balance: number, decimals = 18) {
    return balance / 10 ** decimals;
}

function unnormalizeBalance(balance: number, decimals = 18) {
    return balance * 10 ** decimals;
}

function prettyPrintBalance(balance: number, decimals = 18) {
    const normalized = normalizeBalance(balance, decimals);
    return normalized.toFixed(6);
}

export { normalizeBalance, unnormalizeBalance, prettyPrintBalance };

    
