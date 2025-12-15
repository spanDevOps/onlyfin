import { z } from 'zod';

// UAE Mortgage Constants
export const UAE_CONSTANTS = {
  MAX_LTV_EXPAT: 0.80, // 80% max loan for expats
  UPFRONT_FEES_PERCENT: 0.07, // 7% total (4% transfer + 2% agency + 1% misc)
  STANDARD_INTEREST_RATE: 4.5, // 4.5% annual
  MAX_TENURE_YEARS: 25,
};

/**
 * Calculate EMI (Equated Monthly Installment) using the standard formula
 * EMI = [P × r × (1 + r)^n] / [(1 + r)^n - 1]
 */
export function calculateEMI(
  loanAmount: number,
  annualRatePercent: number,
  tenureYears: number
): {
  monthly_emi: number;
  total_payment: number;
  total_interest: number;
  valid: boolean;
  error?: string;
} {
  // Validation
  if (loanAmount <= 0) {
    return { monthly_emi: 0, total_payment: 0, total_interest: 0, valid: false, error: 'Loan amount must be positive' };
  }
  if (annualRatePercent <= 0 || annualRatePercent > 20) {
    return { monthly_emi: 0, total_payment: 0, total_interest: 0, valid: false, error: 'Interest rate must be between 0 and 20%' };
  }
  if (tenureYears <= 0 || tenureYears > UAE_CONSTANTS.MAX_TENURE_YEARS) {
    return { monthly_emi: 0, total_payment: 0, total_interest: 0, valid: false, error: `Tenure must be between 1 and ${UAE_CONSTANTS.MAX_TENURE_YEARS} years` };
  }

  const monthlyRate = annualRatePercent / 100 / 12;
  const numPayments = tenureYears * 12;

  // EMI formula
  const emi = (loanAmount * monthlyRate * Math.pow(1 + monthlyRate, numPayments)) / 
              (Math.pow(1 + monthlyRate, numPayments) - 1);

  const totalPayment = emi * numPayments;
  const totalInterest = totalPayment - loanAmount;

  return {
    monthly_emi: Math.round(emi * 100) / 100,
    total_payment: Math.round(totalPayment * 100) / 100,
    total_interest: Math.round(totalInterest * 100) / 100,
    valid: true,
  };
}

/**
 * Calculate upfront costs (7% of property price)
 */
export function calculateUpfrontCosts(propertyPrice: number): {
  transfer_fee: number;
  agency_fee: number;
  misc_fees: number;
  total_upfront_fees: number;
  valid: boolean;
  error?: string;
} {
  if (propertyPrice <= 0) {
    return {
      transfer_fee: 0,
      agency_fee: 0,
      misc_fees: 0,
      total_upfront_fees: 0,
      valid: false,
      error: 'Property price must be positive',
    };
  }

  const transferFee = propertyPrice * 0.04;
  const agencyFee = propertyPrice * 0.02;
  const miscFees = propertyPrice * 0.01;
  const total = transferFee + agencyFee + miscFees;

  return {
    transfer_fee: Math.round(transferFee),
    agency_fee: Math.round(agencyFee),
    misc_fees: Math.round(miscFees),
    total_upfront_fees: Math.round(total),
    valid: true,
  };
}

/**
 * Calculate maximum loan and minimum down payment (80% LTV for expats)
 */
export function calculateMaxLoan(propertyPrice: number): {
  max_loan_amount: number;
  required_down_payment: number;
  ltv_percent: number;
  valid: boolean;
  error?: string;
} {
  if (propertyPrice <= 0) {
    return {
      max_loan_amount: 0,
      required_down_payment: 0,
      ltv_percent: 0,
      valid: false,
      error: 'Property price must be positive',
    };
  }

  const maxLoan = propertyPrice * UAE_CONSTANTS.MAX_LTV_EXPAT;
  const downPayment = propertyPrice - maxLoan;

  return {
    max_loan_amount: Math.round(maxLoan),
    required_down_payment: Math.round(downPayment),
    ltv_percent: UAE_CONSTANTS.MAX_LTV_EXPAT * 100,
    valid: true,
  };
}

/**
 * Compare rent vs buy decision
 */
export function compareRentVsBuy(
  monthlyRent: number,
  propertyPrice: number,
  yearsStaying: number,
  interestRatePercent: number = UAE_CONSTANTS.STANDARD_INTEREST_RATE
): {
  recommendation: 'buy' | 'rent' | 'unclear';
  total_rent_cost: number;
  total_buy_cost: number;
  monthly_mortgage_payment: number;
  break_even_years: number;
  reasoning: string;
  valid: boolean;
  error?: string;
} {
  // Validation
  if (monthlyRent <= 0 || propertyPrice <= 0 || yearsStaying <= 0) {
    return {
      recommendation: 'unclear',
      total_rent_cost: 0,
      total_buy_cost: 0,
      monthly_mortgage_payment: 0,
      break_even_years: 0,
      reasoning: 'Invalid inputs',
      valid: false,
      error: 'All values must be positive',
    };
  }

  // Calculate mortgage details
  const loanCalc = calculateMaxLoan(propertyPrice);
  const upfrontCosts = calculateUpfrontCosts(propertyPrice);
  const emiCalc = calculateEMI(loanCalc.max_loan_amount, interestRatePercent, Math.min(yearsStaying, 25));

  // Total costs
  const totalRentCost = monthlyRent * yearsStaying * 12;
  const totalBuyCost = loanCalc.required_down_payment + upfrontCosts.total_upfront_fees + (emiCalc.monthly_emi * yearsStaying * 12);

  // Simple heuristics
  let recommendation: 'buy' | 'rent' | 'unclear' = 'unclear';
  let reasoning = '';

  if (yearsStaying < 3) {
    recommendation = 'rent';
    reasoning = `Staying less than 3 years means upfront costs (${upfrontCosts.total_upfront_fees.toLocaleString()} AED) won't be recovered. Renting is more flexible.`;
  } else if (yearsStaying >= 5) {
    if (totalBuyCost < totalRentCost * 1.2) {
      recommendation = 'buy';
      reasoning = `Over ${yearsStaying} years, buying builds equity. Total buy cost (~${Math.round(totalBuyCost).toLocaleString()} AED) is competitive with rent (~${Math.round(totalRentCost).toLocaleString()} AED).`;
    } else {
      recommendation = 'rent';
      reasoning = `Even over ${yearsStaying} years, buying costs significantly more than renting due to high property prices.`;
    }
  } else {
    // 3-5 years: depends on the numbers
    if (totalBuyCost < totalRentCost) {
      recommendation = 'buy';
      reasoning = `The math slightly favors buying over ${yearsStaying} years, but it's close.`;
    } else {
      recommendation = 'rent';
      reasoning = `Over ${yearsStaying} years, renting is more cost-effective and flexible.`;
    }
  }

  // Rough break-even calculation
  const monthlyDiff = emiCalc.monthly_emi - monthlyRent;
  const initialCosts = loanCalc.required_down_payment + upfrontCosts.total_upfront_fees;
  const breakEvenYears = monthlyDiff !== 0 ? Math.abs(initialCosts / (monthlyDiff * 12)) : 0;

  return {
    recommendation,
    total_rent_cost: Math.round(totalRentCost),
    total_buy_cost: Math.round(totalBuyCost),
    monthly_mortgage_payment: emiCalc.monthly_emi,
    break_even_years: Math.round(breakEvenYears * 10) / 10,
    reasoning,
    valid: true,
  };
}

// Zod schemas for tool validation
export const calculateEMISchema = z.object({
  loan_amount_aed: z.number().positive(),
  annual_rate_percent: z.number().positive().max(20),
  tenure_years: z.number().positive().max(UAE_CONSTANTS.MAX_TENURE_YEARS),
});

export const calculateUpfrontCostsSchema = z.object({
  property_price_aed: z.number().positive(),
});

export const calculateMaxLoanSchema = z.object({
  property_price_aed: z.number().positive(),
});

export const compareRentVsBuySchema = z.object({
  monthly_rent_aed: z.number().positive(),
  property_price_aed: z.number().positive(),
  years_staying: z.number().positive(),
  interest_rate_percent: z.number().positive(),
});
