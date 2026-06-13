"use client";

import { useEffect, useState } from "react";
import {
  CheckCircle2,
  Home,
  Lock,
  LogOut,
  Save,
  ShieldCheck,
  TimerReset,
  Trophy,
  UserCheck,
  Users,
  XCircle
} from "lucide-react";
import type {
  LeaderboardEntry,
  MatchRecord,
  MatchStatus,
  ParticipantRecord,
  PixStatus,
  PredictionRecord,
  PrizeWinner
} from "@/lib/types";

type AdminPayload = {
  matches: MatchRecord[];
  participants: ParticipantRecord[];
  predictions: PredictionRecord[];
  leaderboard: LeaderboardEntry[];
  prizeWinners: PrizeWinner[];
  stats: {
    participants: number;
    confirmed: number;
    pending: number;
    predictions: number;
  };
};

type MatchForm = {
  status: MatchStatus;
  actualHomeScore: string;
  actualAwayScore: string;
};

async function readJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Nao foi possivel concluir a acao.");
  }

  return payload as T;
}

function pixClass(status: PixStatus) {
  if (status === "confirmed") return "status-confirmed";
  if (status === "rejected") return "status-rejected";
  return "status-pending";
}

function pixLabel(status: PixStatus) {
  if (status === "confirmed") return "Confirmado";
  if (status === "rejected") return "Recusado";
  return "Pendente";
}

function predictionFor(
  predictions: PredictionRecord[],
  participantId: string,
  matchId: number
) {
  return predictions.find(
    (prediction) => prediction.participant_id === participantId && prediction.match_id === matchId
  );
}

export default function AdminPage() {
  const [password, setPassword] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [payload, setPayload] = useState<AdminPayload | null>(null);
  const [matchForms, setMatchForms] = useState<Record<number, MatchForm>>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [toast, setToast] = useState("");

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }

  function hydrateMatchForms(matches: MatchRecord[]) {
    setMatchForms(
      matches.reduce<Record<number, MatchForm>>((acc, match) => {
        acc[match.id] = {
          status: match.status,
          actualHomeScore: match.actual_home_score === null ? "" : String(match.actual_home_score),
          actualAwayScore: match.actual_away_score === null ? "" : String(match.actual_away_score)
        };
        return acc;
      }, {})
    );
  }

  async function loadSummary() {
    setError("");
    const response = await fetch("/api/admin/summary");
    if (response.status === 401) {
      setAuthenticated(false);
      setPayload(null);
      return;
    }

    const data = await readJsonResponse<AdminPayload>(response);
    setAuthenticated(true);
    setPayload(data);
    hydrateMatchForms(data.matches);
  }

  useEffect(() => {
    async function boot() {
      setLoading(true);
      try {
        await loadSummary();
      } catch (caught) {
        setError(caught instanceof Error ? caught.message : "Erro ao carregar o painel.");
      } finally {
        setLoading(false);
      }
    }

    void boot();
  }, []);

  async function login(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      await readJsonResponse<{ ok: boolean }>(
        await fetch("/api/admin/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ password })
        })
      );
      setPassword("");
      await loadSummary();
      showToast("Acesso administrativo liberado.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel entrar.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    setAuthenticated(false);
    setPayload(null);
  }

  async function updateParticipant(id: string, pixStatus: PixStatus) {
    setBusy(true);
    setError("");

    try {
      await readJsonResponse(
        await fetch(`/api/admin/participants/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pixStatus })
        })
      );
      await loadSummary();
      showToast("Status do Pix atualizado.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel atualizar.");
    } finally {
      setBusy(false);
    }
  }

  async function updateMatch(match: MatchRecord) {
    const form = matchForms[match.id];
    if (!form) return;

    setBusy(true);
    setError("");

    try {
      await readJsonResponse(
        await fetch(`/api/admin/matches/${match.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: form.status,
            actualHomeScore: form.actualHomeScore,
            actualAwayScore: form.actualAwayScore
          })
        })
      );
      await loadSummary();
      showToast("Jogo atualizado.");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Nao foi possivel atualizar o jogo.");
    } finally {
      setBusy(false);
    }
  }

  function updateMatchForm<Key extends keyof MatchForm>(
    matchId: number,
    key: Key,
    value: MatchForm[Key]
  ) {
    setMatchForms((current) => ({
      ...current,
      [matchId]: {
        status: current[matchId]?.status || "open",
        actualHomeScore: current[matchId]?.actualHomeScore || "",
        actualAwayScore: current[matchId]?.actualAwayScore || "",
        [key]: value
      }
    }));
  }

  return (
    <div className="admin-page">
      <header className="admin-header">
        <div className="admin-header-inner">
          <div className="brand-mark">
            <span className="brand-ball">
              <ShieldCheck size={20} />
            </span>
            <span>Painel do Bolao da Turma 101</span>
          </div>
          <div className="admin-actions">
            <a className="ghost-link" href="/">
              <Home size={16} />
              Site
            </a>
            {authenticated && (
              <button className="ghost-link" onClick={logout} type="button">
                <LogOut size={16} />
                Sair
              </button>
            )}
          </div>
        </div>
      </header>

      {loading && <div className="loading-bar" />}

      <main className="admin-main">
        {error && (
          <div className="error-state" role="alert">
            <XCircle size={24} />
            <strong>{error}</strong>
          </div>
        )}

        {!authenticated ? (
          <section className="workspace-grid">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <p className="section-kicker">Acesso restrito</p>
                  <h1 className="section-title">Entrar no painel administrativo</h1>
                  <p className="section-subtitle">
                    Use a senha definida em <strong>ADMIN_PASSWORD</strong> na Vercel para confirmar
                    pagamentos e cadastrar resultados.
                  </p>
                </div>
              </div>

              <form className="form-grid" onSubmit={login}>
                <div className="field">
                  <label htmlFor="admin-password">Senha do admin</label>
                  <input
                    id="admin-password"
                    minLength={8}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="Senha administrativa"
                    required
                    type="password"
                    value={password}
                  />
                </div>
                <button className="primary-button" disabled={busy} type="submit">
                  <Lock size={17} />
                  Entrar
                </button>
              </form>
            </div>

            <aside className="side-stack">
              <div className="card">
                <h3>O que este painel faz</h3>
                <p>
                  Confirma Pix, trava palpites antes do jogo, informa o placar final e atualiza a
                  classificacao automaticamente.
                </p>
              </div>
            </aside>
          </section>
        ) : (
          <section className="admin-grid">
            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-value">{payload?.stats.participants || 0}</div>
                <strong className="stat-label">Inscritos</strong>
                <span>Total de pessoas cadastradas.</span>
              </div>
              <div className="stat-card">
                <div className="stat-value">{payload?.stats.confirmed || 0}</div>
                <strong className="stat-label">Pix confirmados</strong>
                <span>Pessoas concorrendo oficialmente.</span>
              </div>
              <div className="stat-card">
                <div className="stat-value">{payload?.stats.predictions || 0}</div>
                <strong className="stat-label">Palpites</strong>
                <span>Placares enviados pelos participantes.</span>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <p className="section-kicker">Pagamento</p>
                  <h2 className="section-title">Confirmacao de Pix</h2>
                  <p className="section-subtitle">
                    Marque como confirmado somente quem realmente pagou. Pendentes ficam fora da
                    pontuacao ate a confirmacao.
                  </p>
                </div>
              </div>

              {!payload?.participants.length ? (
                <div className="empty-state">
                  <Users size={24} />
                  <strong>Nenhum inscrito ainda.</strong>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Nome</th>
                        <th>E-mail</th>
                        <th>Status</th>
                        <th>Acoes</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payload.participants.map((participant) => (
                        <tr key={participant.id}>
                          <td>
                            <strong>{participant.name}</strong>
                          </td>
                          <td>{participant.email}</td>
                          <td>
                            <span className={`status-pill ${pixClass(participant.pix_status)}`}>
                              {pixLabel(participant.pix_status)}
                            </span>
                          </td>
                          <td>
                            <div className="admin-actions">
                              <button
                                className="primary-button"
                                disabled={busy}
                                onClick={() => updateParticipant(participant.id, "confirmed")}
                                type="button"
                              >
                                <UserCheck size={16} />
                                Confirmar
                              </button>
                              <button
                                className="secondary-button"
                                disabled={busy}
                                onClick={() => updateParticipant(participant.id, "pending")}
                                type="button"
                              >
                                <TimerReset size={16} />
                                Pendente
                              </button>
                              <button
                                className="danger-button"
                                disabled={busy}
                                onClick={() => updateParticipant(participant.id, "rejected")}
                                type="button"
                              >
                                <XCircle size={16} />
                                Recusar
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <p className="section-kicker">Jogos</p>
                  <h2 className="section-title">Fechamento e resultados</h2>
                  <p className="section-subtitle">
                    Use aberto para receber palpites, travado quando o jogo comecar e finalizado
                    quando tiver o placar oficial.
                  </p>
                </div>
              </div>

              <div className="matches-grid">
                {payload?.matches.map((match) => {
                  const form = matchForms[match.id] || {
                    status: match.status,
                    actualHomeScore: "",
                    actualAwayScore: ""
                  };

                  return (
                    <article className="match-card" key={match.id}>
                      <div className="match-head">
                        <div className="match-round">
                          <Trophy size={14} />
                          {match.home_team} x {match.away_team}
                        </div>
                        <span className={`status-pill status-${match.status}`}>
                          {match.status === "open" ? "Aberto" : match.status === "locked" ? "Travado" : "Finalizado"}
                        </span>
                      </div>
                      <div className="match-body">
                        <div className="inline-form">
                          <div className="field">
                            <label htmlFor={`status-${match.id}`}>Status</label>
                            <select
                              id={`status-${match.id}`}
                              onChange={(event) =>
                                updateMatchForm(match.id, "status", event.target.value as MatchStatus)
                              }
                              value={form.status}
                            >
                              <option value="open">Aberto</option>
                              <option value="locked">Travado</option>
                              <option value="finished">Finalizado</option>
                            </select>
                          </div>
                          <div className="field inline-score">
                            <label htmlFor={`home-${match.id}`}>{match.home_team}</label>
                            <input
                              id={`home-${match.id}`}
                              min={0}
                              max={20}
                              onChange={(event) =>
                                updateMatchForm(match.id, "actualHomeScore", event.target.value)
                              }
                              type="number"
                              value={form.actualHomeScore}
                            />
                          </div>
                          <div className="field inline-score">
                            <label htmlFor={`away-${match.id}`}>{match.away_team}</label>
                            <input
                              id={`away-${match.id}`}
                              min={0}
                              max={20}
                              onChange={(event) =>
                                updateMatchForm(match.id, "actualAwayScore", event.target.value)
                              }
                              type="number"
                              value={form.actualAwayScore}
                            />
                          </div>
                          <button
                            className="primary-button"
                            disabled={busy}
                            onClick={() => updateMatch(match)}
                            type="button"
                          >
                            <Save size={16} />
                            Salvar jogo
                          </button>
                        </div>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <div>
                  <p className="section-kicker">Auditoria</p>
                  <h2 className="section-title">Palpites recebidos</h2>
                  <p className="section-subtitle">
                    Visao rapida dos palpites por participante para conferir antes e depois dos
                    jogos.
                  </p>
                </div>
              </div>

              {!payload?.participants.length ? (
                <div className="empty-state">
                  <Users size={24} />
                  <strong>Sem dados para conferir.</strong>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Participante</th>
                        {payload.matches.map((match) => (
                          <th key={match.id}>{match.away_team}</th>
                        ))}
                        <th>Pontos</th>
                        <th>Pix</th>
                      </tr>
                    </thead>
                    <tbody>
                      {payload.leaderboard.map((entry) => {
                        const participant = payload.participants.find(
                          (item) => item.id === entry.participantId
                        );

                        return (
                          <tr key={entry.participantId}>
                            <td>
                              <strong>{entry.name}</strong>
                              <br />
                              <span style={{ color: "var(--muted)", fontSize: 13 }}>
                                {participant?.email}
                              </span>
                            </td>
                            {payload.matches.map((match) => {
                              const prediction = predictionFor(
                                payload.predictions,
                                entry.participantId,
                                match.id
                              );
                              return (
                                <td key={match.id}>
                                  {prediction
                                    ? `${prediction.home_score} x ${prediction.away_score}`
                                    : "-"}
                                </td>
                              );
                            })}
                            <td>
                              <span className="points-badge">{entry.totalPoints}</span>
                            </td>
                            <td>
                              <span className={`status-pill ${pixClass(entry.pixStatus)}`}>
                                {pixLabel(entry.pixStatus)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {Boolean(payload?.prizeWinners.length) && (
              <div className="panel">
                <div className="panel-header">
                  <div>
                    <p className="section-kicker">Premiacao</p>
                    <h2 className="section-title">Vencedores por rodada</h2>
                  </div>
                </div>
                <ul className="quick-list">
                  {payload?.prizeWinners.map((winner) => (
                    <li key={winner.matchId}>
                      <CheckCircle2 size={18} />
                      <span>
                        <strong>{winner.matchLabel}:</strong>{" "}
                        {winner.names.length ? winner.names.join(", ") : "sem placar exato"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
