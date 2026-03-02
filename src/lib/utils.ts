export function formatINR(value: number): string {
  if (value >= 10000000) return `₹${(value / 10000000).toFixed(2)}Cr`;
  if (value >= 100000) return `₹${(value / 100000).toFixed(2)}L`;
  if (value >= 1000) return `₹${(value / 1000).toFixed(1)}K`;
  return `₹${value.toFixed(0)}`;
}

export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export const ASSET_CLASS_LABELS: Record<string, string> = {
  equity: "Equity / Stocks",
  mutual_fund: "Mutual Funds",
  real_estate: "Real Estate",
  gold: "Gold / Jewellery",
  epf: "EPF",
  ppf: "PPF",
  nps: "NPS",
  fd: "Fixed Deposit",
  crypto: "Crypto",
  sgb: "Sovereign Gold Bonds",
  ulip: "ULIP",
  bonds: "Bonds / Debentures",
  savings: "Savings / Cash",
  other: "Other",
};

export const LIABILITY_LABELS: Record<string, string> = {
  home_loan: "Home Loan",
  car_loan: "Car Loan",
  personal_loan: "Personal Loan",
  credit_card: "Credit Card",
  education_loan: "Education Loan",
  other: "Other",
};

export const EXPENSE_CATEGORIES = [
  "Rent", "EMI", "Groceries", "Utilities", "Transport",
  "Healthcare", "Insurance", "Entertainment", "Dining",
  "Shopping", "Education", "Travel", "Subscriptions", "Other",
];

export const INCOME_CATEGORIES = [
  "Salary", "Freelance", "Rental Income", "Dividends",
  "Interest", "Business", "Gift", "Other",
];

export const ASSET_COLORS: Record<string, string> = {
  equity: "#22c55e",
  mutual_fund: "#3b82f6",
  real_estate: "#f59e0b",
  gold: "#eab308",
  epf: "#8b5cf6",
  ppf: "#a78bfa",
  nps: "#06b6d4",
  fd: "#f97316",
  crypto: "#ec4899",
  sgb: "#fbbf24",
  ulip: "#14b8a6",
  bonds: "#64748b",
  savings: "#84cc16",
  other: "#6b7280",
};
