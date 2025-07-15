// types/BotTypes.ts

export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  statusCode?: number;
}

// Referral Types
export interface ReferralData {
  referrerEmail: string;
  refereeEmail: string;
  referrerBonus: number;
  refereeBonus: number;
}

export interface ReferralVerifyResponse {
  referral: ReferralData;
  message: string;
}

export interface ReferralCodeResponse {
  referralCode: string;
  shortCode: string;
  generatedFor: string;
  expiresIn: string;
  instructions: string;
}

export interface ReferralStatsResponse {
  totalReferrals: number;
  totalEarned: number;
  currentStreak: number;
  recentReferrals: Array<{
    email: string;
    date: string;
    bonus: number;
  }>;
}

// Match Types
export interface MatchInfo {
  status: string;
  description?: string;
}

export interface Match {
  id: number;
  serial: string;
  name: string;
  matchName: string;
  gameName: string;
  time: string;
  date: string;
  entryFees: number;
  firstPrize: number;
  secondPrize: number;
  thirdPrize: number;
  prizePool: number;
  perKillPoint: number;
  availableSeats: number;
  totalSeats: number;
  occupiedSeats: number;
  imageFileId?: string;
  matchInfo: MatchInfo;
}

export interface MatchListResponse {
  matches: Match[];
  totalCount: number;
}

// User Types
export interface User {
  id: bigint;
  email: string;
  chatId: string;
  balance: number;
  referredBy?: bigint;
}

// Bot Command Types
export type ReferralCommand =
  | "generate_referral"
  | "get_referral_code"
  | "verify_referral"
  | "referral_stats";
export type MatchCommand =
  | "show_game_matches"
  | "show_all_matches"
  | "delete_all_matches"
  | "show_upcoming_matches";

// Default values for type safety
export const DEFAULT_REFERRAL_VERIFY_RESPONSE: ReferralVerifyResponse = {
  referral: {
    referrerEmail: "",
    refereeEmail: "",
    referrerBonus: 0,
    refereeBonus: 0,
  },
  message: "",
};

export const DEFAULT_REFERRAL_CODE_RESPONSE: ReferralCodeResponse = {
  referralCode: "",
  shortCode: "",
  generatedFor: "",
  expiresIn: "",
  instructions: "",
};

export const DEFAULT_MATCH_LIST_RESPONSE: MatchListResponse = {
  matches: [],
  totalCount: 0,
};
