# Bolao da Turma 101

Site funcional para o Bolao da Turma 101 com inscricao, chave Pix, palpites, classificacao e painel administrativo para confirmar pagamentos.

## O que foi incluido

- Inscricao com nome e e-mail.
- Aviso e copia da chave Pix: `(86) 99910-3642`.
- Palpites dos 3 jogos: Brasil x Marrocos, Brasil x Haiti e Brasil x Escocia.
- Regra de pontuacao: placar exato = 3 pontos, vencedor/empate = 1 ponto, erro = 0 ponto.
- Participante so pontua e concorre se o Pix estiver confirmado.
- Painel `/admin` para confirmar Pix, travar jogos e lancar placar final.
- SQL pronto para Supabase.

## Configurar o Supabase

1. Crie um projeto no Supabase.
2. Abra o SQL Editor.
3. Cole e execute o arquivo `supabase/schema.sql`.
4. Copie a Project URL.
5. Copie a `service_role key` em Project Settings > API.

As tabelas usam RLS ativado e o app acessa o banco apenas pelas rotas server-side do Next.js usando a service role.

## Variaveis de ambiente

Crie um `.env.local` para desenvolvimento e configure as mesmas variaveis na Vercel:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://seu-projeto.supabase.co
SUPABASE_SERVICE_ROLE_KEY=sua-service-role-key
ADMIN_PASSWORD=uma-senha-com-pelo-menos-8-caracteres
```

## Rodar localmente

```bash
npm install
npm run dev
```

Abra `http://localhost:3000`.

## Deploy na Vercel

1. Suba este projeto para um repositorio Git.
2. Importe o repositorio na Vercel.
3. Adicione as variaveis de ambiente acima em Project Settings > Environment Variables.
4. Faca o deploy.

## Operacao do bolao

1. O participante se inscreve e salva os palpites.
2. A organizacao confere o Pix recebido.
3. Em `/admin`, marque o participante como `Confirmado`.
4. Antes do jogo, mude o status do jogo para `Travado`.
5. Depois do jogo, mude para `Finalizado` e informe o placar oficial.
6. A classificacao e os vencedores por rodada sao recalculados automaticamente.
