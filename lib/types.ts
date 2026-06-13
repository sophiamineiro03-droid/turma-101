export type PixStatus = "pending" | "confirmed" | "rejected";
export type MatchStatus = "open" | "locked" | "finished";

export type MatchRecord = {
  id: number;
  home_team: string;
  away_team: string;
  home_flag: string;
  away_flag: string;
  round_label: string;
  group_label: string;
  display_date: string;
  starts_at: string | null;
  status: MatchStatus;
  actual_home_score: number | null;
  actual_away_score: number | null;
  created_at?: string;
};

export type ParticipantRecord = {
  id: string;
  name: string;
  email?: string;
  pix_status: PixStatus;
  created_at: string;
  confirmed_at: string | null;
};

export type PrivateParticipantRecord = ParticipantRecord & {
  email: string;
  access_token: string;
};

export type PredictionRecord = {
  id?: string;
  participant_id: string;
  match_id: number;
  home_score: number;
  away_score: number;
  created_at?: string;
  updated_at?: string;
};

export type PredictionScore = PredictionRecord & {
  points: number | null;
  exact: boolean;
  outcomeHit: boolean;
};

export type LeaderboardEntry = {
  participantId: string;
  name: string;
  pixStatus: PixStatus;
  eligible: boolean;
  totalPoints: number;
  exactHits: number;
  outcomeHits: number;
  predictions: Record<number, PredictionScore>;
};

export type PrizeWinner = {
  matchId: number;
  matchLabel: string;
  names: string[];
};

export type BootstrapPayload = {
  matches: MatchRecord[];
  participants: ParticipantRecord[];
  leaderboard: LeaderboardEntry[];
  prizeWinners: PrizeWinner[];
};
