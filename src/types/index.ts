export type AssetClass =
  | "equity"
  | "mutual_fund"
  | "real_estate"
  | "gold"
  | "epf"
  | "ppf"
  | "nps"
  | "fd"
  | "crypto"
  | "sgb"
  | "ulip"
  | "bonds"
  | "savings"
  | "other";

export type LiabilityType =
  | "home_loan"
  | "car_loan"
  | "personal_loan"
  | "credit_card"
  | "education_loan"
  | "other";

export interface Asset {
  id: string;
  user_id: string;
  name: string;
  class: AssetClass;
  value: number;
  currency: string;
  quantity?: number;
  notes?: string;
  updated_at: string;
}

export interface Liability {
  id: string;
  user_id: string;
  name: string;
  type: LiabilityType;
  outstanding: number;
  emi?: number;
  interest?: number;
  notes?: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  type: "income" | "expense";
  category: string;
  amount: number;
  note?: string;
  date: string;
}

export interface Goal {
  id: string;
  user_id: string;
  name: string;
  target: number;
  current: number;
  currency: string;
  deadline?: string;
  notes?: string;
  created_at: string;
}

export interface Snapshot {
  id: string;
  user_id: string;
  net_worth: number;
  total_assets: number;
  total_liabilities: number;
  breakdown: Record<string, number>;
  taken_at: string;
}
