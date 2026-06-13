import {
  LeaderboardEntry,
  MatchRecord,
  ParticipantRecord,
  PredictionRecord,
  PredictionScore,
  PrizeWinner
} from "./types";

function outcome(homeScore: number, awayScore: number) {
  if (homeScore > awayScore) return "home";
  if (homeScore < awayScore) return "away";
  return "draw";
}

function participantKey(participant: ParticipantRecord) {
  return participant.email?.trim().toLowerCase() || participant.id;
}

function statusRank(status: ParticipantRecord["pix_status"]) {
  if (status === "confirmed") return 3;
  if (status === "pending") return 2;
  return 1;
}

function isNewer(left?: string, right?: string) {
  if (!left) return false;
  if (!right) return true;
  return new Date(left).getTime() > new Date(right).getTime();
}

function canonicalizeParticipants(participants: ParticipantRecord[]) {
  const byKey = new Map<string, ParticipantRecord>();
  const idToCanonicalId = new Map<string, string>();

  for (const participant of participants) {
    const key = participantKey(participant);
    const current = byKey.get(key);

    if (!current) {
      byKey.set(key, { ...participant });
      idToCanonicalId.set(participant.id, participant.id);
      continue;
    }

    idToCanonicalId.set(participant.id, current.id);

    if (statusRank(participant.pix_status) > statusRank(current.pix_status)) {
      current.pix_status = participant.pix_status;
    }

    if (!current.confirmed_at && participant.confirmed_at) {
      current.confirmed_at = participant.confirmed_at;
    }
  }

  return {
    participants: Array.from(byKey.values()),
    idToCanonicalId
  };
}

export function mergeParticipantsByEmail(participants: ParticipantRecord[]) {
  return canonicalizeParticipants(participants).participants;
}

export function scorePrediction(
  prediction: PredictionRecord,
  match: MatchRecord
): PredictionScore {
  if (
    match.status !== "finished" ||
    match.actual_home_score === null ||
    match.actual_away_score === null
  ) {
    return {
      ...prediction,
      points: null,
      exact: false,
      outcomeHit: false
    };
  }

  const exact =
    prediction.home_score === match.actual_home_score &&
    prediction.away_score === match.actual_away_score;
  const outcomeHit =
    outcome(prediction.home_score, prediction.away_score) ===
    outcome(match.actual_home_score, match.actual_away_score);

  return {
    ...prediction,
    points: exact ? 3 : outcomeHit ? 1 : 0,
    exact,
    outcomeHit
  };
}

export function buildLeaderboard(
  participants: ParticipantRecord[],
  predictions: PredictionRecord[],
  matches: MatchRecord[]
): LeaderboardEntry[] {
  const canonical = canonicalizeParticipants(participants);
  const participantById = new Map(
    canonical.participants.map((participant) => [participant.id, participant])
  );
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const predictionsByParticipant = new Map<string, Record<number, PredictionScore>>();

  for (const prediction of predictions) {
    const match = matchById.get(prediction.match_id);
    if (!match) continue;

    const participantId =
      canonical.idToCanonicalId.get(prediction.participant_id) || prediction.participant_id;
    if (!participantById.has(participantId)) continue;

    const scored = scorePrediction(prediction, match);
    const map = predictionsByParticipant.get(participantId) || {};
    const current = map[prediction.match_id];

    if (!current || isNewer(scored.updated_at, current.updated_at)) {
      map[prediction.match_id] = {
        ...scored,
        participant_id: participantId
      };
    }

    predictionsByParticipant.set(participantId, map);
  }

  return canonical.participants
    .map((participant) => {
      const predictionsMap = predictionsByParticipant.get(participant.id) || {};
      const scoredPredictions = Object.values(predictionsMap);
      const eligible = participant.pix_status === "confirmed";

      return {
        participantId: participant.id,
        name: participant.name,
        pixStatus: participant.pix_status,
        eligible,
        totalPoints: eligible
          ? scoredPredictions.reduce((sum, prediction) => sum + (prediction.points || 0), 0)
          : 0,
        exactHits: eligible
          ? scoredPredictions.filter((prediction) => prediction.exact).length
          : 0,
        outcomeHits: eligible
          ? scoredPredictions.filter((prediction) => prediction.outcomeHit && !prediction.exact)
              .length
          : 0,
        predictions: predictionsMap
      };
    })
    .sort((left, right) => {
      if (left.eligible !== right.eligible) return left.eligible ? -1 : 1;
      if (right.totalPoints !== left.totalPoints) return right.totalPoints - left.totalPoints;
      if (right.exactHits !== left.exactHits) return right.exactHits - left.exactHits;
      return left.name.localeCompare(right.name, "pt-BR");
    });
}

export function buildPrizeWinners(
  participants: ParticipantRecord[],
  predictions: PredictionRecord[],
  matches: MatchRecord[]
): PrizeWinner[] {
  const canonical = canonicalizeParticipants(participants);
  const participantById = new Map(
    canonical.participants.map((participant) => [participant.id, participant])
  );

  return matches
    .filter(
      (match) =>
        match.status === "finished" &&
        match.actual_home_score !== null &&
        match.actual_away_score !== null
    )
    .map((match) => {
      const names = new Set<string>();
      const latestPredictions = new Map<string, PredictionRecord>();

      for (const prediction of predictions.filter((item) => item.match_id === match.id)) {
        const participantId =
          canonical.idToCanonicalId.get(prediction.participant_id) || prediction.participant_id;
        const participant = participantById.get(participantId);
        if (!participant || participant.pix_status !== "confirmed") continue;

        const current = latestPredictions.get(participantId);
        if (!current || isNewer(prediction.updated_at, current.updated_at)) {
          latestPredictions.set(participantId, {
            ...prediction,
            participant_id: participantId
          });
        }
      }

      for (const prediction of latestPredictions.values()) {
        const participant = participantById.get(prediction.participant_id);
        if (!participant) continue;

        if (scorePrediction(prediction, match).exact) {
          names.add(participant.name);
        }
      }

      return {
        matchId: match.id,
        matchLabel: `${match.home_team} x ${match.away_team}`,
        names: Array.from(names)
      };
    });
}
