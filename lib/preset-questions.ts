/**
 * Preset Questions for OnlyFin
 * Distribution: 60% Beginner, 30% Intermediate, 10% Advanced
 * Total: 100 questions
 */

export type QuestionLevel = 'beginner' | 'intermediate' | 'advanced';

export interface PresetQuestion {
  id: string;
  text: string;
  shortText: string; // Shortened version for button display
  level: QuestionLevel;
}

export const PRESET_QUESTIONS: PresetQuestion[] = [
  // BEGINNER QUESTIONS (60 questions - 60%)
  // Basic Banking & Savings
  { id: 'b1', text: 'What is a savings account?', shortText: 'What is a savings account?', level: 'beginner' },
  { id: 'b2', text: 'How do I open a bank account?', shortText: 'How do I open a bank account?', level: 'beginner' },
  { id: 'b3', text: 'What is the difference between savings and checking accounts?', shortText: 'Savings vs checking accounts?', level: 'beginner' },
  { id: 'b4', text: 'How much should I save each month?', shortText: 'How much should I save monthly?', level: 'beginner' },
  { id: 'b5', text: 'What is compound interest?', shortText: 'What is compound interest?', level: 'beginner' },
  { id: 'b6', text: 'What is an emergency fund?', shortText: 'What is an emergency fund?', level: 'beginner' },
  { id: 'b7', text: 'How much money should I keep in emergency fund?', shortText: 'How much for emergency fund?', level: 'beginner' },
  { id: 'b8', text: 'What is a fixed deposit?', shortText: 'What is a fixed deposit?', level: 'beginner' },
  { id: 'b9', text: 'What is the current repo rate?', shortText: 'What is the current repo rate?', level: 'beginner' },
  { id: 'b10', text: 'What is inflation?', shortText: 'What is inflation?', level: 'beginner' },
  
  // Credit & Loans
  { id: 'b11', text: 'What is a credit card?', shortText: 'What is a credit card?', level: 'beginner' },
  { id: 'b12', text: 'How does credit card interest work?', shortText: 'How does credit card interest work?', level: 'beginner' },
  { id: 'b13', text: 'What is a credit score?', shortText: 'What is a credit score?', level: 'beginner' },
  { id: 'b14', text: 'How can I improve my credit score?', shortText: 'How to improve my credit score?', level: 'beginner' },
  { id: 'b15', text: 'What is EMI?', shortText: 'What is EMI?', level: 'beginner' },
  { id: 'b16', text: 'What is a personal loan?', shortText: 'What is a personal loan?', level: 'beginner' },
  { id: 'b17', text: 'What is a home loan?', shortText: 'What is a home loan?', level: 'beginner' },
  { id: 'b18', text: 'What is the difference between secured and unsecured loans?', shortText: 'Secured vs unsecured loans?', level: 'beginner' },
  { id: 'b19', text: 'What is loan tenure?', shortText: 'What is loan tenure?', level: 'beginner' },
  { id: 'b20', text: 'What is down payment?', shortText: 'What is down payment?', level: 'beginner' },
  
  // Basic Investing
  { id: 'b21', text: 'What is investing?', shortText: 'What is investing?', level: 'beginner' },
  { id: 'b22', text: 'What are stocks?', shortText: 'What are stocks?', level: 'beginner' },
  { id: 'b23', text: 'What are mutual funds?', shortText: 'What are mutual funds?', level: 'beginner' },
  { id: 'b24', text: 'What is SIP?', shortText: 'What is SIP?', level: 'beginner' },
  { id: 'b25', text: 'How do I start investing?', shortText: 'How do I start investing?', level: 'beginner' },
  { id: 'b26', text: 'What is the stock market?', shortText: 'What is the stock market?', level: 'beginner' },
  { id: 'b27', text: 'What is a demat account?', shortText: 'What is a demat account?', level: 'beginner' },
  { id: 'b28', text: 'What is NAV in mutual funds?', shortText: 'What is NAV in mutual funds?', level: 'beginner' },
  { id: 'b29', text: 'What is risk in investing?', shortText: 'What is investment risk?', level: 'beginner' },
  { id: 'b30', text: 'What is diversification?', shortText: 'What is diversification?', level: 'beginner' },
  
  // Insurance & Protection
  { id: 'b31', text: 'What is life insurance?', shortText: 'What is life insurance?', level: 'beginner' },
  { id: 'b32', text: 'What is health insurance?', shortText: 'What is health insurance?', level: 'beginner' },
  { id: 'b33', text: 'Do I need insurance?', shortText: 'Do I need insurance?', level: 'beginner' },
  { id: 'b34', text: 'What is term insurance?', shortText: 'What is term insurance?', level: 'beginner' },
  { id: 'b35', text: 'What is premium in insurance?', shortText: 'What is insurance premium?', level: 'beginner' },
  { id: 'b36', text: 'What is sum assured?', shortText: 'What is sum assured?', level: 'beginner' },
  { id: 'b37', text: 'What is a nominee?', shortText: 'What is a nominee?', level: 'beginner' },
  { id: 'b38', text: 'What is claim in insurance?', shortText: 'What is an insurance claim?', level: 'beginner' },
  
  // Budgeting & Planning
  { id: 'b39', text: 'How do I create a budget?', shortText: 'How do I create a budget?', level: 'beginner' },
  { id: 'b40', text: 'What is the 50-30-20 rule?', shortText: 'What is the 50-30-20 rule?', level: 'beginner' },
  { id: 'b41', text: 'How can I save money?', shortText: 'How can I save money?', level: 'beginner' },
  { id: 'b42', text: 'What are fixed and variable expenses?', shortText: 'Fixed vs variable expenses?', level: 'beginner' },
  { id: 'b43', text: 'How do I track my expenses?', shortText: 'How do I track my expenses?', level: 'beginner' },
  { id: 'b44', text: 'What is financial planning?', shortText: 'What is financial planning?', level: 'beginner' },
  { id: 'b45', text: 'What are financial goals?', shortText: 'What are financial goals?', level: 'beginner' },
  
  // Taxes & Income
  { id: 'b46', text: 'What is income tax?', shortText: 'What is income tax?', level: 'beginner' },
  { id: 'b47', text: 'Do I need to file tax returns?', shortText: 'Do I need to file tax returns?', level: 'beginner' },
  { id: 'b48', text: 'What is PAN card?', shortText: 'What is PAN card?', level: 'beginner' },
  { id: 'b49', text: 'What is TDS?', shortText: 'What is TDS?', level: 'beginner' },
  { id: 'b50', text: 'What is Form 16?', shortText: 'What is Form 16?', level: 'beginner' },
  { id: 'b51', text: 'What is tax deduction?', shortText: 'What is tax deduction?', level: 'beginner' },
  { id: 'b52', text: 'What is Section 80C?', shortText: 'What is Section 80C?', level: 'beginner' },
  
  // Retirement & Long-term
  { id: 'b53', text: 'What is retirement planning?', shortText: 'What is retirement planning?', level: 'beginner' },
  { id: 'b54', text: 'What is PPF?', shortText: 'What is PPF?', level: 'beginner' },
  { id: 'b55', text: 'What is EPF?', shortText: 'What is EPF?', level: 'beginner' },
  { id: 'b56', text: 'What is NPS?', shortText: 'What is NPS?', level: 'beginner' },
  { id: 'b57', text: 'When should I start retirement planning?', shortText: 'When to start retirement planning?', level: 'beginner' },
  
  // Miscellaneous Beginner
  { id: 'b58', text: 'What is UPI?', shortText: 'What is UPI?', level: 'beginner' },
  { id: 'b59', text: 'What is net worth?', shortText: 'What is net worth?', level: 'beginner' },
  { id: 'b60', text: 'What is financial literacy?', shortText: 'What is financial literacy?', level: 'beginner' },
  
  // INTERMEDIATE QUESTIONS (30 questions - 30%)
  // Advanced Banking & Investments
  { id: 'i1', text: 'What is the difference between equity and debt mutual funds?', shortText: 'Equity vs debt mutual funds?', level: 'intermediate' },
  { id: 'i2', text: 'How do I calculate returns on my investments?', shortText: 'How to calculate investment returns?', level: 'intermediate' },
  { id: 'i3', text: 'What is XIRR and CAGR?', shortText: 'What is XIRR and CAGR?', level: 'intermediate' },
  { id: 'i4', text: 'What is asset allocation?', shortText: 'What is asset allocation?', level: 'intermediate' },
  { id: 'i5', text: 'How do I rebalance my portfolio?', shortText: 'How to rebalance my portfolio?', level: 'intermediate' },
  { id: 'i6', text: 'What are index funds vs actively managed funds?', shortText: 'Index vs actively managed funds?', level: 'intermediate' },
  { id: 'i7', text: 'What is expense ratio in mutual funds?', shortText: 'What is expense ratio?', level: 'intermediate' },
  { id: 'i8', text: 'What is the difference between growth and dividend options?', shortText: 'Growth vs dividend options?', level: 'intermediate' },
  { id: 'i9', text: 'What are large cap, mid cap, and small cap stocks?', shortText: 'Large, mid, and small cap stocks?', level: 'intermediate' },
  { id: 'i10', text: 'What is P/E ratio and how to use it?', shortText: 'What is P/E ratio?', level: 'intermediate' },
  
  // Tax Planning
  { id: 'i11', text: 'How can I save tax legally?', shortText: 'How to save tax legally?', level: 'intermediate' },
  { id: 'i12', text: 'What is the new tax regime vs old tax regime?', shortText: 'New vs old tax regime?', level: 'intermediate' },
  { id: 'i13', text: 'What is capital gains tax?', shortText: 'What is capital gains tax?', level: 'intermediate' },
  { id: 'i14', text: 'What is LTCG and STCG?', shortText: 'What is LTCG and STCG?', level: 'intermediate' },
  { id: 'i15', text: 'How does tax loss harvesting work?', shortText: 'How does tax loss harvesting work?', level: 'intermediate' },
  { id: 'i16', text: 'What is HRA exemption?', shortText: 'What is HRA exemption?', level: 'intermediate' },
  { id: 'i17', text: 'What is Section 80D for health insurance?', shortText: 'What is Section 80D?', level: 'intermediate' },
  
  // Loans & Credit
  { id: 'i18', text: 'Should I prepay my home loan or invest?', shortText: 'Prepay home loan or invest?', level: 'intermediate' },
  { id: 'i19', text: 'What is loan-to-value ratio?', shortText: 'What is loan-to-value ratio?', level: 'intermediate' },
  { id: 'i20', text: 'How does credit utilization affect my score?', shortText: 'How does credit utilization work?', level: 'intermediate' },
  { id: 'i21', text: 'What is balance transfer for loans?', shortText: 'What is loan balance transfer?', level: 'intermediate' },
  { id: 'i22', text: 'What is the difference between fixed and floating interest rates?', shortText: 'Fixed vs floating interest rates?', level: 'intermediate' },
  
  // Insurance & Risk
  { id: 'i23', text: 'How much life insurance coverage do I need?', shortText: 'How much life insurance do I need?', level: 'intermediate' },
  { id: 'i24', text: 'What is the difference between term and endowment plans?', shortText: 'Term vs endowment insurance?', level: 'intermediate' },
  { id: 'i25', text: 'What is critical illness insurance?', shortText: 'What is critical illness insurance?', level: 'intermediate' },
  { id: 'i26', text: 'Should I buy insurance or invest separately?', shortText: 'Buy insurance or invest separately?', level: 'intermediate' },
  
  // Retirement & Estate
  { id: 'i27', text: 'How much corpus do I need for retirement?', shortText: 'How much corpus for retirement?', level: 'intermediate' },
  { id: 'i28', text: 'What is annuity and how does it work?', shortText: 'What is annuity?', level: 'intermediate' },
  { id: 'i29', text: 'What is estate planning?', shortText: 'What is estate planning?', level: 'intermediate' },
  { id: 'i30', text: 'What is a will and why do I need one?', shortText: 'Why do I need a will?', level: 'intermediate' },
  
  // ADVANCED QUESTIONS (10 questions - 10%)
  // Advanced Investing & Markets
  { id: 'a1', text: 'What are derivatives and how do they work?', shortText: 'What are derivatives?', level: 'advanced' },
  { id: 'a2', text: 'How do I analyze company fundamentals for stock picking?', shortText: 'How to analyze company fundamentals?', level: 'advanced' },
  { id: 'a3', text: 'What is options trading and what are the risks?', shortText: 'What is options trading?', level: 'advanced' },
  { id: 'a4', text: 'How does portfolio optimization using Modern Portfolio Theory work?', shortText: 'How does portfolio optimization work?', level: 'advanced' },
  { id: 'a5', text: 'What are alternative investments like REITs and InvITs?', shortText: 'What are REITs and InvITs?', level: 'advanced' },
  
  // Advanced Tax & Wealth
  { id: 'a6', text: 'How can I structure my investments for tax efficiency?', shortText: 'How to invest tax-efficiently?', level: 'advanced' },
  { id: 'a7', text: 'What is wealth tax and inheritance tax planning?', shortText: 'Wealth and inheritance tax planning?', level: 'advanced' },
  { id: 'a8', text: 'How do trusts work for wealth transfer?', shortText: 'How do trusts work?', level: 'advanced' },
  
  // Advanced Planning
  { id: 'a9', text: 'What is sequence of returns risk in retirement?', shortText: 'What is sequence of returns risk?', level: 'advanced' },
  { id: 'a10', text: 'How do I create a comprehensive financial plan with multiple goals?', shortText: 'How to create a financial plan?', level: 'advanced' },
];

/**
 * Get a random preset question
 * Respects the distribution: 60% beginner, 30% intermediate, 10% advanced
 */
export function getRandomPresetQuestion(): PresetQuestion {
  const random = Math.random();
  let level: QuestionLevel;
  
  if (random < 0.6) {
    level = 'beginner';
  } else if (random < 0.9) {
    level = 'intermediate';
  } else {
    level = 'advanced';
  }
  
  const questionsOfLevel = PRESET_QUESTIONS.filter(q => q.level === level);
  return questionsOfLevel[Math.floor(Math.random() * questionsOfLevel.length)];
}

/**
 * Get multiple random preset questions
 * Maintains the distribution ratio
 */
export function getRandomPresetQuestions(count: number): PresetQuestion[] {
  const questions: PresetQuestion[] = [];
  const usedIds = new Set<string>();
  
  while (questions.length < count) {
    const question = getRandomPresetQuestion();
    if (!usedIds.has(question.id)) {
      questions.push(question);
      usedIds.add(question.id);
    }
  }
  
  return questions;
}

/**
 * Get questions by level
 */
export function getQuestionsByLevel(level: QuestionLevel): PresetQuestion[] {
  return PRESET_QUESTIONS.filter(q => q.level === level);
}

/**
 * Get question statistics
 */
export function getQuestionStats() {
  const beginner = PRESET_QUESTIONS.filter(q => q.level === 'beginner').length;
  const intermediate = PRESET_QUESTIONS.filter(q => q.level === 'intermediate').length;
  const advanced = PRESET_QUESTIONS.filter(q => q.level === 'advanced').length;
  
  return {
    total: PRESET_QUESTIONS.length,
    beginner,
    intermediate,
    advanced,
    distribution: {
      beginner: `${((beginner / PRESET_QUESTIONS.length) * 100).toFixed(0)}%`,
      intermediate: `${((intermediate / PRESET_QUESTIONS.length) * 100).toFixed(0)}%`,
      advanced: `${((advanced / PRESET_QUESTIONS.length) * 100).toFixed(0)}%`,
    }
  };
}
