require('dotenv').config();

const USD_TO_INR_RATE = parseFloat(process.env.USD_TO_INR_RATE) || 83.5;

/**
 * Converts a given amount to INR based on currency code.
 * @param {number|string} amount - The transaction amount
 * @param {string} currency - The currency code (e.g. 'USD', 'INR')
 * @returns {Object} { amountInINR: number, rateUsed: number }
 */
function convertToINR(amount, currency = 'INR') {
  const numAmount = parseFloat(amount) || 0;
  const normalizedCurrency = (currency || 'INR').trim().toUpperCase();

  if (normalizedCurrency === 'USD') {
    return {
      amountInINR: Math.round(numAmount * USD_TO_INR_RATE * 100) / 100,
      rateUsed: USD_TO_INR_RATE,
    };
  }

  // Default is INR or other unrecognized currencies treated as INR
  return {
    amountInINR: Math.round(numAmount * 100) / 100,
    rateUsed: 1.0,
  };
}

module.exports = {
  convertToINR,
  USD_TO_INR_RATE,
};
