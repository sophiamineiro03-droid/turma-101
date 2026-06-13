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
  const matchById = new Map(matches.map((match) => [match.id, match]));
  const predictionsByParticipant = new Map<string, PredictionScore[]>();

  for (const prediction of predictions) {
    const match = matchById.get(prediction.match_id);
    if (!match) continue;

    const scored = scorePrediction(prediction, match);
    const list = predictionsByParticipant.get(prediction.participant_id) || [];
    list.push(scored);
    predictionsByParticipant.set(prediction.participant_id, list);
  }

  return participants
    .map((participant) => {
      const scoredPredictions = predictionsByParticipant.get(participant.id) || [];
      const eligible = participant.pix_status === "confirmed";
      const predictionsMap = scoredPredictions.reduce<Record<number, PredictionScore>>(
        (acc, prediction) => {
          acc[prediction.match_id] = prediction;
          return acc;
        },
        {}
      );

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
  const participantById = new Map(participants.map((participant) => [participant.id, participant]));

  return matches
    .filter(
      (match) =>
        match.status === "finished" &&
        match.actual_home_score !== null &&
        match.actual_away_score !== null
    )
    .map((match) => {
      const names = predictions
        .filter((prediction) => prediction.match_id === match.id)
        .filter((prediction) => {
          const participant = participantById.get(prediction.participant_id);
          if (!participant || participant.pix_status !== "confirmed") return false;
          return scorePrediction(prediction, match).exact;
        })
        .map((prediction) => participantById.get(prediction.participant_id)?.name)
        .filter((name): name is string => Boolean(name));

      return {
        matchId: match.id,
        matchLabel: `${match.home_team} x ${match.away_team}`,
        names
      };
    });
}
