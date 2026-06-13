"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Clipboard,
  Clock3,
  Coins,
  Lock,
  LogIn,
  Medal,
  Save,
  ShieldCheck,
  Sparkles,
  Trophy,
  UserPlus,
  Users
} from "lucide-react";
import type { BootstrapPayload, MatchRecord, PredictionRecord } from "@/lib/types";

const PIX_KEY = "(86) 99910-3642";
const STORAGE_KEY = "bolao_turma_101_participante";

type TabId = "inscricao" | "palpites" | "classificacao" | "regras";

type ParticipantSession = {
  id: string;
  name: string;
  email: string;
  pixStatus: "pending" | "confirmed" | "rejected";
  accessToken: string;
  createdAt: string;
  confirmedAt: string | null;
};

type DraftMap = Record<number, { homeScore: string; awayScore: string }>;

async function readJsonResponse<T>(response: Response): Promise<T> {
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error || "Nao foi possivel concluir a acao.");
  }

  return payload as T;
}

function pixLabel(status: ParticipantSession["pixStatus"]) {
  if (status === "confirmed") return "Pix confirmado";
  if (status === "rejected") return "Pix recusado";
  return "Aguardando Pix";
}

function pixClass(status: ParticipantSession["pixStatus"]) {
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

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<TabId>("inscricao");
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
        const message = caught instanceof Error ? caught.message : "Erro ao carregar o bolao.";
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
      setActiveTab("palpites");
      await refreshEverything(payload.participant);
      showToast("Inscricao feita. Agora falta a organizacao confirmar o Pix.");
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : "Nao foi possivel inscrever.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function savePrediction(match: MatchRecord) {
    if (!participant) {
      setActiveTab("inscricao");
      showToast("Faca sua inscricao antes de salvar o palpite.");
      return;
    }

    const draft = drafts[match.id] || { homeScore: "", awayScore: "" };
    const homeScore = Number(draft.homeScore);
    const awayScore = Number(draft.awayScore);

    if (!Number.isInteger(homeScore) || !Number.isInteger(awayScore)) {
      showToast("Preencha os dois placares com numeros inteiros.");
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
      const message = caught instanceof Error ? caught.message : "Nao foi possivel salvar.";
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  async function copyPix() {
    await navigator.clipboard.writeText(PIX_KEY);
    showToast("Chave Pix copiada.");
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

  const tabs: Array<{ id: TabId; label: string; icon: React.ReactNode }> = [
    { id: "inscricao", label: "Inscricao", icon: <UserPlus size={17} /> },
    { id: "palpites", label: "Palpites", icon: <Save size={17} /> },
    { id: "classificacao", label: "Classificacao", icon: <Trophy size={17} /> },
    { id: "regras", label: "Regras", icon: <ShieldCheck size={17} /> }
  ];

  return (
    <div className="site-shell">
      <header className="hero">
        <div className="hero-inner">
          <div className="topbar">
            <div className="brand-mark">
              <span className="brand-ball">
                <Trophy size={20} />
              </span>
              <span>Bolao da Turma 101</span>
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
            <h1>Bolao da Turma 101</h1>
            <p>
              Inscreva-se, envie o Pix, registre seus placares dos jogos do Brasil e acompanhe a
              classificacao geral em tempo real.
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

      <div className="main-nav-wrap">
        <nav className="main-nav" aria-label="Areas do bolao">
          {tabs.map((tab) => (
            <button
              className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              type="button"
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {loading && <div className="loading-bar" />}

      <main className="main">
        {error && (
          <div className="error-state" role="alert">
            <AlertCircle size={24} />
            <strong>{error}</strong>
          </div>
        )}

        {activeTab === "inscricao" && (
          <section className="workspace-grid">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <p className="section-kicker">Primeiro passo</p>
                  <h2 className="section-title">Inscricao no bolao</h2>
                  <p className="section-subtitle">
                    Coloque nome e e-mail para participar. A pontuacao so entra na classificacao
                    quando o Pix for confirmado pela organizacao.
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
                      Voce esta inscrito como <strong>{participant.name}</strong>. Enquanto o Pix
                      estiver pendente, seus palpites ficam salvos, mas nao concorrem ao premio.
                    </span>
                  </div>
                  <div className="pix-card">
                    <div className="pix-topline">
                      <div>
                        <p className="section-kicker">Chave Pix</p>
                        <div className="pix-key">{PIX_KEY}</div>
                      </div>
                      <button className="icon-button" onClick={copyPix} type="button" title="Copiar Pix">
                        <Clipboard size={18} />
                      </button>
                    </div>
                    <p>
                      Depois do pagamento, aguarde a organizacao marcar sua inscricao como
                      confirmada no painel administrativo.
                    </p>
                  </div>
                  <button className="primary-button" onClick={() => setActiveTab("palpites")}>
                    <LogIn size={18} />
                    Ir para os palpites
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
                      placeholder="Ex: Joao da Silva"
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
                        <p className="section-kicker">Pagamento obrigatorio</p>
                        <div className="pix-key">{PIX_KEY}</div>
                      </div>
                      <button className="icon-button" onClick={copyPix} type="button" title="Copiar Pix">
                        <Clipboard size={18} />
                      </button>
                    </div>
                    <div className="notice">
                      <AlertCircle size={18} />
                      <span>
                        Somente concorre quem fez o Pix e teve a inscricao confirmada pela
                        organizacao.
                      </span>
                    </div>
                  </div>

                  <button className="primary-button" disabled={busy} type="submit">
                    <UserPlus size={18} />
                    Confirmar inscricao
                  </button>
                </form>
              )}
            </div>

            <aside className="side-stack">
              <div className="card">
                <h3>Jogos da primeira rodada</h3>
                <ul className="quick-list">
                  {(data?.matches || []).map((match) => (
                    <li key={match.id}>
                      <span>{match.home_flag}</span>
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
                <h3>Como pontua</h3>
                <p>
                  Placar exato vale 3 pontos e concorre ao premio da rodada. Acertar vencedor ou
                  empate vale 1 ponto. Errou o resultado, 0 ponto.
                </p>
              </div>
            </aside>
          </section>
        )}

        {activeTab === "palpites" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Primeira rodada</p>
                <h2 className="section-title">Palpites dos jogos do Brasil</h2>
                <p className="section-subtitle">
                  Salve o placar antes do fechamento do jogo. A organizacao pode travar os palpites
                  no painel admin.
                </p>
              </div>
              {participant ? (
                <span className={`status-pill ${pixClass(participant.pixStatus)}`}>
                  {pixLabel(participant.pixStatus)}
                </span>
              ) : (
                <button className="secondary-button" onClick={() => setActiveTab("inscricao")}>
                  <UserPlus size={16} />
                  Inscrever
                </button>
              )}
            </div>

            {!data?.matches.length ? (
              <div className="empty-state">
                <Clock3 size={24} />
                <strong>Nenhum jogo cadastrado ainda.</strong>
              </div>
            ) : (
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
                            <div className="flag">{match.home_flag}</div>
                            <div className="team-name">{match.home_team}</div>
                          </div>
                          <div className="score-entry">
                            <div className="score-label">Seu palpite</div>
                            <div className="score-fields">
                              <input
                                className="score-input"
                                disabled={isClosed || !participant}
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
                                disabled={isClosed || !participant}
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
                            <div className="flag">{match.away_flag}</div>
                            <div className="team-name">{match.away_team}</div>
                          </div>
                        </div>

                        <div className="match-actions">
                          <span className="match-note">
                            {match.display_date}
                            {savedPrediction ? ` · Salvo: ${predictionText(savedPrediction)}` : ""}
                            {match.status === "finished" &&
                            match.actual_home_score !== null &&
                            match.actual_away_score !== null
                              ? ` · Final: ${match.actual_home_score} x ${match.actual_away_score}`
                              : ""}
                          </span>
                          <button
                            className="secondary-button"
                            disabled={busy || isClosed || !participant}
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
            )}
          </section>
        )}

        {activeTab === "classificacao" && (
          <section className="panel">
            <div className="panel-header">
              <div>
                <p className="section-kicker">Ao vivo</p>
                <h2 className="section-title">Classificacao geral</h2>
                <p className="section-subtitle">
                  Participantes com Pix pendente aparecem, mas so pontuam e concorrem depois da
                  confirmacao.
                </p>
              </div>
            </div>

            {!data?.leaderboard.length ? (
              <div className="empty-state">
                <Users size={24} />
                <strong>Ninguem inscrito ainda.</strong>
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
              <div className="card" style={{ marginTop: 18 }}>
                <h3>Premios da rodada</h3>
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
        )}

        {activeTab === "regras" && (
          <section className="workspace-grid">
            <div className="panel">
              <div className="panel-header">
                <div>
                  <p className="section-kicker">Regulamento</p>
                  <h2 className="section-title">Regras do Bolao da Turma 101</h2>
                  <p className="section-subtitle">
                    Regras simples para todo mundo acompanhar sem discussao na hora da pontuacao.
                  </p>
                </div>
              </div>

              <div className="rules-grid">
                <div className="rule-card">
                  <div className="rule-number">3</div>
                  <strong>Placar exato</strong>
                  <span>Acertou o placar certinho do jogo do Brasil.</span>
                </div>
                <div className="rule-card">
                  <div className="rule-number">1</div>
                  <strong>Resultado certo</strong>
                  <span>Acertou vencedor ou empate, mas nao o placar.</span>
                </div>
                <div className="rule-card">
                  <div className="rule-number">0</div>
                  <strong>Resultado errado</strong>
                  <span>Errou quem ganhou ou se terminou empatado.</span>
                </div>
              </div>
            </div>

            <aside className="side-stack">
              <div className="card">
                <h3>Pix obrigatorio</h3>
                <p>
                  A inscricao so concorre quando a organizacao confirmar o pagamento da chave{" "}
                  <strong>{PIX_KEY}</strong>.
                </p>
              </div>
              <div className="card">
                <h3>Premio da rodada</h3>
                <p>
                  Quem acertar o placar exato concorre ao premio da rodada. Se houver empate entre
                  acertadores, a organizacao decide a divisao do premio.
                </p>
              </div>
            </aside>
          </section>
        )}
      </main>

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
