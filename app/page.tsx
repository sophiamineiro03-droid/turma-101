"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Clock3,
  Coins,
  Lock,
  LogOut,
  Medal,
  Save,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserPlus,
  Users
} from "lucide-react";
import type { BootstrapPayload, MatchRecord, PixStatus, PredictionRecord } from "@/lib/types";

const PIX_KEY = "(86) 99910-3642";
const STORAGE_KEY = "bolao_turma_101_participante";

type ParticipantSession = {
  id: string;
  name: string;
  email: string;
  pixStatus: PixStatus;
  accessToken: string;
  createdAt: string;
  confirmedAt: string | null;
};

type DraftMap = Record<number, { homeScore: string; awayScore: string }>;

async function readJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Não foi possível concluir a ação.");
  }

  return payload as T;
}

function pixLabel(status: PixStatus) {
  if (status === "confirmed") return "Pix confirmado";
  if (status === "rejected") return "Pix recusado";
  return "Aguardando Pix";
}

function pixClass(status: PixStatus) {
  if (status === "confirmed") return "status-confirmed";
  if (status === "rejected") return "status-rejected";
  return "status-pending";
}

function matchStatusLabel(status: MatchRecord["status"]) {
  if (status === "finished") return "Finalizado";
  if (status === "locked") return "Palpites encerrados";
  return "Aberto para palpites";
}

function matchStatusIcon(status: MatchRecord["status"]) {
  if (status === "finished") return <CheckCircle2 size={14} />;
  if (status === "locked") return <Lock size={14} />;
  return <Clock3 size={14} />;
}

function predictionText(prediction?: PredictionRecord | { home_score: number; away_score: number }) {
  if (!prediction) return "-";
  return `${prediction.home_score} x ${prediction.away_score}`;
}

function countryCode(value: string) {
  const normalized = value.toLowerCase();
  if (normalized === "br" || normalized.includes("🇧🇷") || normalized.includes("brasil")) return "br";
  if (normalized === "ma" || normalized.includes("🇲🇦") || normalized.includes("marrocos")) return "ma";
  if (normalized === "ht" || normalized.includes("🇭🇹") || normalized.includes("haiti")) return "ht";
  if (normalized === "sct" || normalized.includes("🏴") || normalized.includes("escócia")) return "sct";
  return "br";
}

function flagSrc(value: string, label: string) {
  return `/flags/${countryCode(`${value} ${label}`)}.svg`;
}

function Flag({ value, label }: { value: string; label: string }) {
  return (
    <img className="flag-img" src={flagSrc(value, label)} alt={`Bandeira: ${label}`} />
  );
}

export default function HomePage() {
  const [data, setData] = useState<BootstrapPayload | null>(null);
  const [participant, setParticipant] = useState<ParticipantSession | null>(null);
  const [myPredictions, setMyPredictions] = useState<Record<number, PredictionRecord>>({});
  const [drafts, setDrafts] = useState<DraftMap>({});
  const [signupForm, setSignupForm] = useState({ name: "", email: "" });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");
  const [error, setError] = useState("");

  const confirmedCount = useMemo(
    () => data?.participants.filter((item) => item.pix_status === "confirmed").length || 0,
    [data]
  );

  function showToast(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 3200);
  }

  function hydrateDrafts(predictions: PredictionRecord[]) {
    setDrafts((current) => {
      const next = { ...current };
      for (const prediction of predictions) {
        next[prediction.match_id] = {
          homeScore: String(prediction.home_score),
          awayScore: String(prediction.away_score)
        };
      }
      return next;
    });
  }

  async function loadBootstrap() {
    const payload = await readJsonResponse<BootstrapPayload>(await fetch("/api/bootstrap"));
    setData(payload);
  }

  async function loadParticipant(session: ParticipantSession) {
    const params = new URLSearchParams({
      participantId: session.id,
      token: session.accessToken
    });
    const payload = await readJsonResponse<{
      participant: ParticipantSession;
      predictions: PredictionRecord[];
    }>(await fetch(`/api/me?${params.toString()}`));

    setParticipant(payload.participant);
    setMyPredictions(
      payload.predictions.reduce<Record<number, PredictionRecord>>((acc, prediction) => {
        acc[prediction.match_id] = prediction;
        return acc;
      }, {})
    );
    hydrateDrafts(payload.predictions);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.participant));
  }

  async function refreshEverything(session?: ParticipantSession | null) {
    setError("");
    await loadBootstrap();
    if (session) {
      await loadParticipant(session);
    }
  }

  useEffect(() => {
    async function boot() {
      setLoading(true);
      try {
        const rawSession = localStorage.getItem(STORAGE_KEY);
        const storedSession = rawSession ? (JSON.parse(rawSession) as ParticipantSession) : null;
        if (storedSession) setParticipant(storedSession);
        await refreshEverything(storedSession);
      } catch (caught) {
        const message = caught instanceof Error ? caught.message : "Erro ao carregar o bolão.";
        setError(message);
        localStorage.removeItem(STORAGE_KEY);
      } finally {
        setLoading(false);
      }
    }

    void boot();
  }, []);

  async function handleSignup(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");

    try {
      const payload = await readJsonResponse<{ participant: ParticipantSession }>(
        await fetch("/api/signup", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(signupForm)
        })
      );

      setParticipant(payload.participant);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.participant));
      setSignupForm({ name: "", email: "" });
      await refreshEverything(payload.participant);
      showToast("Entrada registrada. Agora você já pode ver as regras e salvar palpites.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Não foi possível inscrever.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function savePrediction(match: MatchRecord) {
    if (!participant) {
      showToast("Faça sua inscrição ou entre antes de salvar o palpite.");
      document.getElementById("inscricao")?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const draft = drafts[match.id] || { homeScore: "", awayScore: "" };
    const homeScore = Number(draft.homeScore);
    const awayScore = Number(draft.awayScore);

    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
      showToast("Preencha os dois placares com números inteiros.");
      return;
    }

    setBusy(true);
    setError("");

    try {
      const payload = await readJsonResponse<{ prediction: PredictionRecord }>(
        await fetch("/api/predictions", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            participantId: participant.id,
            token: participant.accessToken,
            matchId: match.id,
            homeScore,
            awayScore
          })
        })
      );

      setMyPredictions((current) => ({
        ...current,
        [payload.prediction.match_id]: payload.prediction
      }));
      await refreshEverything(participant);
      showToast("Palpite salvo com sucesso.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Não foi possível salvar.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function copyText(text: string, message: string) {
    await navigator.clipboard.writeText(text);
    showToast(message);
  }

  function leaveParticipant() {
    localStorage.removeItem(STORAGE_KEY);
    setParticipant(null);
    setMyPredictions({});
    setDrafts({});
    showToast("Você saiu deste dispositivo.");
  }

  function updateDraft(matchId: number, key: "homeScore" | "awayScore", value: string) {
    setDrafts((current) => ({
      ...current,
      [matchId]: {
        homeScore: current[matchId]?.homeScore || "",
        awayScore: current[matchId]?.awayScore || "",
        [key]: value
      }
    }));
  }

  return (
    <div className="site-shell">
      <header className="hero">
        <div className="hero-inner">
          <div className="topbar">
            <div className="brand-mark">
              <span className="brand-ball">
                <Trophy size={20} />
              </span>
              <span>Bolão da Turma 101</span>
            </div>
            <a className="admin-link" href="/admin">
              <ShieldCheck size={16} />
              Admin
            </a>
          </div>

          <div className="hero-copy">
            <div className="eyebrow">
              <Sparkles size={16} />
              Copa da Turma 101
            </div>
            <h1>Bolão da Turma 101</h1>
            <p>
              Entre no bolão, confira as regras, registre seus palpites dos jogos do Brasil e
              acompanhe a classificação em uma página só.
            </p>
            <div className="hero-meta">
              <span className="meta-pill">
                <Coins size={16} />
                Pix: {PIX_KEY}
              </span>
              <span className="meta-pill">
                <Medal size={16} />3 pontos no placar exato
              </span>
              <span className="meta-pill">
                <Users size={16} />
                {confirmedCount} confirmado{confirmedCount === 1 ? "" : "s"}
              </span>
            </div>
          </div>
        </div>
      </header>

      {loading && <div className="loading-bar" />}

      <main className="main flow-stack">
        {error && (
          <div className="error-state" role="alert">
            <AlertCircle size={24} />
            <strong>{error}</strong>
          </div>
        )}

        <section className={`workspace-grid ${participant ? "" : "auth-only"}`} id="inscricao">
          <div className="panel">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Primeiro passo</p>
                <h2 className="section-title">
                  {participant ? "Sua inscrição" : "Entrada no bolão"}
                </h2>
                <p className="section-subtitle">
                  Preencha seus dados e faça o Pix para participar.
                </p>
              </div>
              {participant && (
                <span className={`status-pill ${pixClass(participant.pixStatus)}`}>
                  <ShieldCheck size={14} />
                  {pixLabel(participant.pixStatus)}
                </span>
              )}
            </div>

            {participant ? (
              <div className="form-grid">
                <div className="notice">
                  <CheckCircle2 size={20} />
                  <span>
                    Você está participando como <strong>{participant.name}</strong>. Seus palpites
                    ficam salvos, mas só concorrem quando o Pix for confirmado.
                  </span>
                </div>

                <div className="pix-card">
                  <div className="pix-topline">
                    <div>
                      <p className="section-kicker">Pagamento obrigatório</p>
                      <div className="pix-key">{PIX_KEY}</div>
                    </div>
                    <button
                      className="icon-button"
                      onClick={() => copyText(PIX_KEY, "Chave Pix copiada.")}
                      title="Copiar Pix"
                      type="button"
                    >
                      <Clipboard size={18} />
                    </button>
                  </div>
                </div>

                <button className="danger-button" onClick={leaveParticipant} type="button">
                  <LogOut size={17} />
                  Sair
                </button>
              </div>
            ) : (
              <form className="form-grid" onSubmit={handleSignup}>
                <div className="field">
                  <label htmlFor="name">Nome completo</label>
                  <input
                    autoComplete="name"
                    id="name"
                    onChange={(event) =>
                      setSignupForm((current) => ({ ...current, name: event.target.value }))
                    }
                    placeholder="Ex: João da Silva"
                    required
                    value={signupForm.name}
                  />
                </div>
                <div className="field">
                  <label htmlFor="email">E-mail</label>
                  <input
                    autoComplete="email"
                    id="email"
                    onChange={(event) =>
                      setSignupForm((current) => ({ ...current, email: event.target.value }))
                    }
                    placeholder="voce@email.com"
                    required
                    type="email"
                    value={signupForm.email}
                  />
                </div>

                <div className="pix-card">
                  <div className="pix-topline">
                    <div>
                      <p className="section-kicker">Pagamento obrigatório</p>
                      <div className="pix-key">{PIX_KEY}</div>
                    </div>
                    <button
                      className="icon-button"
                      onClick={() => copyText(PIX_KEY, "Chave Pix copiada.")}
                      title="Copiar Pix"
                      type="button"
                    >
                      <Clipboard size={18} />
                    </button>
                  </div>
                  <div className="notice">
                    <AlertCircle size={18} />
                    <span>
                      Somente concorre quem fez o Pix e teve a inscrição confirmada pela
                      organização.
                    </span>
                  </div>
                </div>

                <button className="primary-button" disabled={busy} type="submit">
                  <UserPlus size={18} />
                  Entrar no bolão
                </button>
              </form>
            )}
          </div>

          {participant && (
            <aside className="side-stack">
              <div className="card">
                <h3>Jogos da primeira rodada</h3>
                <ul className="quick-list">
                  {(data?.matches || []).map((match) => (
                    <li key={match.id}>
                      <Flag value={match.home_flag} label={match.home_team} />
                      <span>
                        <strong>{match.home_team}</strong> x <strong>{match.away_team}</strong>
                        <br />
                        {match.display_date}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="card">
                <h3>Resumo</h3>
                <p>
                  Inscreva-se, envie o Pix e salve seus palpites antes de cada jogo começar.
                </p>
              </div>
            </aside>
          )}
        </section>

        {participant && (
          <>
            <section className="panel" id="regras">
              <div className="panel-header">
                <div>
                  <p className="section-kicker">Regulamento</p>
                  <h2 className="section-title">Regras do Bolão da Turma 101</h2>
                  <p className="section-subtitle">
                    Como a pontuação funciona no bolão.
                  </p>
                </div>
              </div>

              <div className="rules-grid">
                <div className="rule-card">
                  <div className="rule-number">3</div>
                  <strong>Placar exato</strong>
                  <span>
                    Acertou o placar certinho do jogo do Brasil e concorre ao prêmio da rodada.
                  </span>
                </div>
                <div className="rule-card">
                  <div className="rule-number">1</div>
                  <strong>Resultado certo</strong>
                  <span>Acertou vencedor ou empate, mas não acertou o placar exato.</span>
                </div>
                <div className="rule-card">
                  <div className="rule-number">0</div>
                  <strong>Resultado errado</strong>
                  <span>Errou quem ganhou ou se terminou empatado.</span>
                </div>
              </div>

              <div className="notice block-notice">
                <Coins size={18} />
                <span>
                  O Pix é obrigatório. A inscrição só entra na disputa quando a organização
                  confirmar o pagamento da chave <strong>{PIX_KEY}</strong>.
                </span>
              </div>
            </section>

            <section className="panel" id="palpites">
              <div className="panel-header">
                <div>
                  <p className="section-kicker">Palpites</p>
                  <h2 className="section-title">Jogos do Brasil</h2>
                  <p className="section-subtitle">
                    Digite o placar que você acredita. Quando o jogo for travado pela organização,
                    não será mais possível alterar.
                  </p>
                </div>
                <span className={`status-pill ${pixClass(participant.pixStatus)}`}>
                  {pixLabel(participant.pixStatus)}
                </span>
              </div>

              {!data?.matches.length ? (
                <div className="empty-state">
                  <Clock3 size={24} />
                  <strong>Nenhum jogo cadastrado ainda.</strong>
                </div>
              ) : (
                <>
                <div className="notice block-notice" style={{ marginBottom: 16 }}>
                  <AlertCircle size={18} />
                  <span>
                    ⚠️ Clique em <strong>Salvar palpite</strong> em cada jogo. Salvar um não salva os outros!
                  </span>
                </div>
                <div className="matches-grid">
                  {data.matches.map((match) => {
                    const draft = drafts[match.id] || { homeScore: "", awayScore: "" };
                    const savedPrediction = myPredictions[match.id];
                    const isClosed = match.status !== "open";

                    return (
                      <article className="match-card" key={match.id}>
                        <div className="match-head">
                          <div className="match-round">
                            <Trophy size={14} />
                            {match.round_label} · {match.group_label}
                          </div>
                          <span className={`status-pill status-${match.status}`}>
                            {matchStatusIcon(match.status)}
                            {matchStatusLabel(match.status)}
                          </span>
                        </div>
                        <div className="match-body">
                          <div className="scoreboard">
                            <div className="team">
                              <Flag value={match.home_flag} label={match.home_team} />
                              <div className="team-name">{match.home_team}</div>
                            </div>
                            <div className="score-entry">
                              <div className="score-label">Seu palpite</div>
                              <div className="score-fields">
                                <input
                                  className="score-input"
                                  disabled={isClosed}
                                  inputMode="numeric"
                                  min={0}
                                  max={20}
                                  onChange={(event) =>
                                    updateDraft(match.id, "homeScore", event.target.value)
                                  }
                                  placeholder="-"
                                  type="number"
                                  value={draft.homeScore}
                                />
                                <span className="score-separator">x</span>
                                <input
                                  className="score-input"
                                  disabled={isClosed}
                                  inputMode="numeric"
                                  min={0}
                                  max={20}
                                  onChange={(event) =>
                                    updateDraft(match.id, "awayScore", event.target.value)
                                  }
                                  placeholder="-"
                                  type="number"
                                  value={draft.awayScore}
                                />
                              </div>
                            </div>
                            <div className="team">
                              <Flag value={match.away_flag} label={match.away_team} />
                              <div className="team-name">{match.away_team}</div>
                            </div>
                          </div>

                          <div className="match-actions">
                            <span className="match-note">
                              {match.display_date}
                              {savedPrediction
                                ? ` · Salvo: ${predictionText(savedPrediction)}`
                                : ""}
                              {match.status === "finished" &&
                              match.actual_home_score !== null &&
                              match.actual_away_score !== null
                                ? ` · Final: ${match.actual_home_score} x ${match.actual_away_score}`
                                : ""}
                            </span>
                            <button
                              className="secondary-button"
                              disabled={busy || isClosed}
                              onClick={() => savePrediction(match)}
                              type="button"
                            >
                              <Save size={17} />
                              Salvar palpite
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
                </>
              )}
            </section>

            <section className="panel" id="classificacao">
              <div className="panel-header">
                <div>
                  <p className="section-kicker">Classificação</p>
                  <h2 className="section-title">Classificação geral</h2>
                  <p className="section-subtitle">
                    Participantes com Pix pendente aparecem, mas só pontuam e concorrem depois da
                    confirmação.
                  </p>
                </div>
              </div>

              {!data?.leaderboard.length ? (
                <div className="empty-state">
                  <Users size={24} />
                  <strong>Ninguém inscrito ainda.</strong>
                </div>
              ) : (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Participante</th>
                        {(data?.matches || []).map((match) => (
                          <th key={match.id}>{match.away_team}</th>
                        ))}
                        <th>Exatos</th>
                        <th>Pontos</th>
                        <th>Pix</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.leaderboard.map((entry, index) => (
                        <tr key={entry.participantId}>
                          <td className="rank">{index + 1}º</td>
                          <td>
                            <strong>{entry.name}</strong>
                          </td>
                          {(data?.matches || []).map((match) => (
                            <td key={match.id}>{predictionText(entry.predictions[match.id])}</td>
                          ))}
                          <td>{entry.exactHits}</td>
                          <td>
                            <span className="points-badge">{entry.totalPoints}</span>
                          </td>
                          <td>
                            <span className={`status-pill ${pixClass(entry.pixStatus)}`}>
                              {entry.pixStatus === "confirmed" ? "Confirmado" : "Pendente"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {Boolean(data?.prizeWinners.length) && (
                <div className="card inline-card">
                  <h3>Prêmios da rodada</h3>
                  <ul className="quick-list">
                    {data?.prizeWinners.map((winner) => (
                      <li key={winner.matchId}>
                        <Medal size={18} />
                        <span>
                          <strong>{winner.matchLabel}:</strong>{" "}
                          {winner.names.length ? winner.names.join(", ") : "sem acertadores exatos"}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
