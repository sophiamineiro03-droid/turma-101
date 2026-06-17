# Documentação — Bolão da Turma 101 (MED-UFPI · Copa do Mundo 2026)

## Visão geral

Site de bolão para a turma 101 de Medicina da UFPI. Participantes se inscrevem, enviam R$ 5,00 via Pix, registram palpites para os jogos do Brasil e concorrem a prêmios por rodada.

- **URL de produção:** Vercel (deploy automático a cada push no `main`)
- **Repositório:** https://github.com/sophiamineiro03-droid/turma-101
- **Stack:** Next.js 15 (App Router) + TypeScript + Supabase (PostgreSQL) + Vercel

---

## Tecnologias

| Tecnologia | Uso |
|---|---|
| Next.js 15 | Frontend e API Routes (App Router) |
| TypeScript | Tipagem |
| Supabase | Banco de dados PostgreSQL + RLS |
| Vercel | Hospedagem e deploy |
| Lucide React | Ícones |

---

## Variáveis de ambiente

Configuradas na Vercel e no arquivo `.env.local` local:

| Variável | Descrição |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL do projeto Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Chave service_role do Supabase (acesso total, servidor apenas) |
| `ADMIN_PASSWORD` | Senha do painel administrativo (`T101@Copa2026!`) |

---

## Banco de dados (Supabase)

### Tabela `participants`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | Gerado automaticamente |
| `name` | text | Nome completo do participante |
| `email` | text (único) | E-mail (chave de identificação) |
| `access_token` | text | Token de sessão (32 bytes hex) |
| `pix_status` | text | `pending` / `confirmed` / `rejected` |
| `created_at` | timestamptz | Data de inscrição |
| `confirmed_at` | timestamptz | Data de confirmação do Pix |

### Tabela `matches`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | integer (PK) | 1 = Brasil x Marrocos, 2 = Brasil x Haiti, 3 = Brasil x Escócia |
| `home_team` / `away_team` | text | Nomes dos times |
| `home_flag` / `away_flag` | text | Código da bandeira (ex: `BR`, `MA`, `HT`, `SCT`) |
| `round_label` / `group_label` | text | Ex: "1ª rodada", "Grupo A" |
| `display_date` | text | Data exibida para o usuário |
| `status` | text | `open` / `locked` / `finished` |
| `actual_home_score` / `actual_away_score` | integer | Placar real (preenchido pelo admin ao finalizar) |

### Tabela `predictions`

| Campo | Tipo | Descrição |
|---|---|---|
| `id` | uuid (PK) | Gerado automaticamente |
| `participant_id` | uuid (FK) | Referência ao participante |
| `match_id` | integer (FK) | Referência ao jogo |
| `home_score` / `away_score` | integer | Palpite do participante |
| `updated_at` | timestamptz | Atualizado automaticamente via trigger |

**Constraint:** `unique(participant_id, match_id)` — um palpite por participante por jogo (upsert).

### RLS (Row Level Security)

Todas as tabelas têm RLS habilitado. O acesso é feito exclusivamente via `service_role` key no servidor — o cliente nunca acessa o Supabase diretamente.

---

## Jogos cadastrados

| ID | Jogo | Data |
|---|---|---|
| 1 | Brasil x Marrocos | 13/06/2026 |
| 2 | Brasil x Haiti | Em breve |
| 3 | Brasil x Escócia | Em breve |

---

## API Routes

### Públicas

| Rota | Método | Descrição |
|---|---|---|
| `/api/bootstrap` | GET | Retorna todos os jogos, participantes e placar geral para montar a página pública |
| `/api/signup` | POST | Inscreve novo participante (nome + email) |
| `/api/login` | POST | Retorna dados do participante pelo email (para quem já está inscrito) |
| `/api/me` | GET | Retorna dados e palpites do participante autenticado (`participantId` + `token` via query) |
| `/api/predictions` | POST | Salva ou atualiza um palpite (requer `participantId` + `token`) |

### Admin (requerem cookie `bolao_admin`)

| Rota | Método | Descrição |
|---|---|---|
| `/api/admin/login` | POST | Autentica o admin com a senha e define o cookie |
| `/api/admin/logout` | POST | Remove o cookie de admin |
| `/api/admin/summary` | GET | Retorna dados completos para o painel admin |
| `/api/admin/participants/[id]` | PATCH | Atualiza o status do Pix do participante |
| `/api/admin/matches/[id]` | PATCH | Atualiza status e placar de um jogo |

---

## Páginas

### `/` — Página pública

**Abas:**
1. **Inscrição** — Formulário com nome, email e palpites integrados para jogos abertos. Toggle entre "Inscrever" (novo) e "Entrar" (já inscrito, só email).
2. **Meus palpites** — Exibe os jogos com campos de placar. Campos desabilitados para jogos `locked` ou `finished`.
3. **Classificação** — Tabela com todos os participantes ordenados por pontos. Pendentes ficam no final com 0 pontos.

**Sessão:** Armazenada no `localStorage` com `access_token`.

### `/admin` — Painel administrativo

Protegido por senha (cookie `bolao_admin`).

**Seções:**
- **Resumo:** Total de inscritos, Pix confirmados, palpites recebidos
- **Gerenciar jogos:** Alterar status (`open` / `locked` / `finished`) e inserir placar final
- **Confirmação de Pix:** Cards com nome, email, status e botões Confirmar / Pendente / Recusar
- **Auditoria:** Tabela com todos os palpites recebidos por participante
- **Premiação:** Vencedores por rodada (quem acertou o placar exato)
- **Classificação geral:** Ranking completo com pontos

---

## Sistema de pontuação

| Resultado | Pontos |
|---|---|
| Placar exato (ex: chutou 1x1, terminou 1x1) | **3 pontos** |
| Acertou o resultado (vitória/empate, placar diferente) | **1 ponto** |
| Errou o resultado | **0 pontos** |

**Regras:**
- Só pontuam participantes com Pix **confirmado**
- Palpites só são aceitos enquanto o jogo está `open`
- Pontos são calculados automaticamente ao finalizar o jogo com placar real
- Em caso de empate de pontos: mais placares exatos → ordem alfabética

**Prêmio por rodada:** Quem acertar o placar **exato** do jogo ganha o prêmio da rodada.

---

## Fluxo do participante

1. Acessa o site → aba "Inscrição"
2. Preenche nome, email e palpites dos jogos abertos
3. Clica "Confirmar inscrição"
4. Envia **R$ 5,00** via Pix para **(86) 99910-3642**
5. Aguarda confirmação do admin
6. Pode voltar pelo "Entrar" (só email) para editar palpites enquanto jogos estiverem abertos
7. Acompanha classificação em tempo real

## Fluxo do admin

1. Acessa `/admin` e digita a senha
2. Antes de cada jogo: muda status para `locked`
3. Após o jogo: muda status para `finished` e insere o placar real
4. Confirma Pix dos participantes que pagaram
5. Classificação e premiação são atualizadas automaticamente

---

## Chave Pix

**(86) 99910-3642** — Valor: **R$ 5,00**

---

## Estrutura de arquivos

```
app/
  page.tsx              # Página pública principal
  globals.css           # Estilos globais
  layout.tsx            # Layout raiz (metadata)
  admin/
    page.tsx            # Painel administrativo
  api/
    bootstrap/          # GET dados públicos
    signup/             # POST inscrição
    login/              # POST entrar (email)
    me/                 # GET dados do participante
    predictions/        # POST salvar palpite
    admin/
      login/            # POST autenticação admin
      logout/           # POST sair admin
      summary/          # GET dados do painel
      matches/[id]/     # PATCH atualizar jogo
      participants/[id]/ # PATCH atualizar Pix
lib/
  supabase.ts           # Cliente Supabase (service_role)
  scoring.ts            # Lógica de pontuação e classificação
  api.ts                # Helpers de resposta HTTP
  types.ts              # Tipos TypeScript
public/
  flags/                # Bandeiras SVG (br.svg, ma.svg, ht.svg, sct.svg)
supabase/
  schema.sql            # Schema completo do banco
```
