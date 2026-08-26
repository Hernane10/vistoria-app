# VistorIA — Vistoria de Imóveis (Vite + React + Supabase)

App de vistoria de imóveis (PEREIRA Gestão Imobiliária), agora **offline-first**
com IndexedDB (via Dexie) e sincronização opcional na nuvem via **Supabase**.

## Como rodar

```bash
npm install
npm run dev
```

Abra o endereço que aparecer no terminal (normalmente `http://localhost:5173`).
O arquivo `.env` já vem preenchido com as credenciais do Supabase que você
passou — se quiser trocar de projeto depois, edite esse arquivo.

```bash
npm run build      # gera a versão de produção em dist/
npm run preview    # testa a versão de produção localmente
```

---

## O que mudou nesta versão

### 1. Compressão de imagem
Toda foto tirada ou enviada é redimensionada para no máximo **1200px** no lado
maior e recomprimida em **JPEG 80%**, direto no navegador (via `<canvas>`,
sem servidor). Se a imagem já for pequena (≤1200px) e leve (≤250KB), o app
pergunta antes de comprimir de novo, já que isso só pioraria a qualidade sem
ganho de tamanho.

### 2. Lazy loading
Fotos só carregam quando entram na área visível da tela (atributo nativo
`loading="lazy"` do navegador) — reduz o carregamento inicial em vistorias
com muitas fotos.

### 3. Offline-first com IndexedDB (Dexie)
Esta é a mudança mais importante de infraestrutura. Antes, tudo era salvo no
`localStorage`, que tem limite de **~5-10MB no total** — algumas vistorias
com fotos já estouravam isso silenciosamente. Agora tudo é salvo em
**IndexedDB** via [Dexie](https://dexie.org) (`src/lib/storage.js`), com
limite muito maior (centenas de MB a alguns GB, dependendo do
navegador/aparelho) e funcionando **100% offline** — essencial para vistoriar
imóveis sem sinal.

O resto do app (`App.jsx`) não precisou mudar nada, porque o Dexie foi
implementado com a **mesma interface** que já existia (`storage.get`,
`storage.set`, `storage.delete`, `storage.list`) — só o "motor" por trás
trocou.

### 4. Sincronização com Supabase (nuvem)
Botão **"Nuvem"** no topo da tela inicial, com duas ações:
- **Enviar tudo para a nuvem** — manda uma cópia de todas as vistorias (com
  fotos, vídeos e anexos) para o Supabase.
- **Baixar da nuvem** — traz de volta o que estiver salvo lá (útil pra
  recuperar dados ou continuar em outro aparelho).

**Não tem tela de login.** Para identificar cada aparelho com segurança sem
pedir cadastro, uso o **Supabase Anonymous Auth** — na primeira sincronização,
o app cria uma sessão anônima só para aquele navegador/aparelho, e as
políticas de segurança (RLS, veja abaixo) garantem que cada aparelho só
enxerga os próprios dados na nuvem.

Se quiser, dá pra evoluir isso depois para login de verdade (e-mail, Google
etc.) sem perder os dados — o Supabase tem um recurso pronto pra "promover"
uma conta anônima para uma conta de verdade
([veja aqui](https://supabase.com/docs/guides/auth/auth-anonymous#converting-an-anonymous-user-to-a-permanent-one)).

### 5. React Query
Adicionado, mas **só onde faz sentido de verdade**: nas chamadas para o
Supabase (`src/components/CloudSyncWidget.jsx`), que são "dados de servidor"
de verdade. As vistorias em si continuam como estado local do React —
colocar tudo dentro do React Query teria sido usar a ferramenta errada pro
problema errado (React Query é pra cache/sincronização de servidor, não pra
substituir o estado local do app inteiro).

### 6. Edge Function para PDF (código pronto, falta você publicar)
Criei `supabase/functions/generate-pdf/index.ts` — uma function que gera o
PDF no servidor a partir da vistoria salva no Supabase. **Eu não consigo
publicar isso por você** (precisa da sua sessão logada no terminal via
Supabase CLI). O arquivo tem o passo a passo completo em comentário, e no
fim deste README também.

> **Isso é realmente necessário?** Não, na maioria dos casos. O app já gera
> um PDF muito bom **direto no navegador**, sem precisar de servidor nenhum
> (aba "PDF" dentro da vistoria). Um PDF gerado no servidor só vale a pena se
> você quiser, por exemplo, mandar o PDF por e-mail automaticamente ou gerar
> laudos por script, sem abrir o app.

---

## Segurança — o que mudei e por quê

- **Cookie HTTP-only para os dados**: pedido inicial, mas tecnicamente não
  serve pra isso — cookie tem limite de ~4KB e é enviado em toda requisição
  HTTP, então não cabe uma vistoria com fotos nele. Cookie HTTP-only é pra
  **token de sessão de login**, não pra dados grandes. Quando você adicionar
  login de verdade no Supabase, o token de sessão dele já é protegido
  adequadamente por padrão — não precisa fazer nada extra.
- **Row Level Security (RLS)** ativada em `supabase/schema.sql` — cada
  vistoria só é visível/editável por quem a criou (`auth.uid() = owner_id`).
  Sem isso, qualquer pessoa com a URL do seu projeto poderia ler/escrever
  os dados de todo mundo.
- **Chave anon/publishable no `.env`**: é seguro deixar essa chave visível no
  código do navegador — é assim que o Supabase foi desenhado (a proteção real
  é o RLS, não o segredo da chave). A chave `service_role` (que ignora RLS)
  **nunca** deve aparecer em código de frontend — só usei ela como exemplo de
  segredo de servidor dentro da Edge Function.
- **Validação de arquivo na importação**: o botão "Importar" verifica se o
  arquivo é um JSON válido do próprio VistorIA antes de mexer nos dados
  salvos, evitando que um arquivo malformado quebre o app.

### Configurando o Supabase (obrigatório para a nuvem funcionar)
1. Abra seu projeto em [supabase.com/dashboard](https://supabase.com/dashboard).
2. Vá em **Authentication → Providers** e habilite **Anonymous Sign-ins**
   (vem desligado por padrão).
3. Vá em **SQL Editor → New query**, cole o conteúdo de `supabase/schema.sql`
   e clique em **Run**. Isso cria a tabela, ativa o RLS e cria o bucket de
   mídia.
4. Pronto — o botão "Nuvem" no app já deve funcionar.

---

## Performance — o que já foi feito e o que ainda vale considerar

**Já feito:** compressão de imagem, lazy loading, IndexedDB (evita travar por
limite de armazenamento), React Query com cache nas chamadas de rede.

**Vale considerar depois**, se o app crescer muito (dezenas de vistorias com
muitas fotos cada):
- Migrar fotos/vídeos do formato base64-dentro-do-JSON para o **Supabase
  Storage** de verdade (o bucket `vistoria-media` já está criado no schema
  SQL, só falta o código que sobe os arquivos pra lá em vez de embutir em
  base64). Isso deixa cada vistoria muito mais leve para sincronizar.
- Paginação/virtualização na lista de vistorias, se acumular centenas delas.
- Code-splitting (`React.lazy`) das telas menos usadas (ex: criador de
  modelo personalizado), para reduzir o tamanho do primeiro carregamento.

Se quiser que uma IA te ajude a implementar algum desses itens depois, veja
os prompts prontos na seção final deste README.

---

## Design

O visual (tema claro/escuro, cores douradas nos nomes dos itens, cards com
acordeão, laudo em PDF com cara profissional) já estava desenvolvido nas
versões anteriores e foi mantido — não precisei mexer nisso agora. Se quiser
evoluir mais pra frente (ex: identidade visual mais próxima da marca PEREIRA,
ícone do app, splash screen de PWA), me avise que ajudo numa próxima rodada.

---

## Estrutura do projeto

```
├── .env                          # credenciais do Supabase (não vai pro git)
├── .env.example
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
├── supabase/
│   ├── schema.sql                # tabelas + RLS + bucket — rode isso no Supabase
│   └── functions/
│       └── generate-pdf/
│           └── index.ts          # Edge Function opcional (veja acima)
└── src/
    ├── main.jsx                  # entrada do React + QueryClientProvider
    ├── index.css
    ├── App.jsx                   # o app inteiro (mesma base de antes)
    ├── lib/
    │   ├── storage.js            # IndexedDB (Dexie) — substitui window.storage
    │   ├── supabaseClient.js     # cliente Supabase
    │   └── sync.js                # push/pull de vistorias com a nuvem
    └── components/
        └── CloudSyncWidget.jsx   # botão "Nuvem" (usa React Query)
```

---

## Se precisar de ajuda de uma IA para continuar

Cada trecho abaixo é um prompt pronto — copie e cole numa IA de código
(Claude, ChatGPT, Cursor, etc.) junto com os arquivos relevantes do projeto.

**Publicar a Edge Function do PDF:**
> "Tenho um projeto Supabase com a function em
> `supabase/functions/generate-pdf/index.ts`. Me guia passo a passo para
> instalar a Supabase CLI, fazer login, linkar com meu projeto (ref:
> tskvzrbvtfypqjuzrdzh), configurar o secret BROWSERLESS_API_KEY, publicar a
> function com `supabase functions deploy`, e me ajuda a resolver qualquer
> erro que aparecer."

**Migrar fotos para Supabase Storage (deixar mais rápido):**
> "No arquivo `src/lib/sync.js` deste projeto Vite + React + Supabase, altere
> a função pushInspections para que cada foto/vídeo/anexo com data URL em
> base64 seja enviado para o bucket 'vistoria-media' do Supabase Storage, no
> caminho {ownerId}/{inspectionId}/{id-aleatório}.{extensão}, e a vistoria
> salve o caminho do Storage em vez do base64. Na função pullInspections, gere
> URLs assinadas (createSignedUrl) para cada caminho antes de devolver a
> vistoria pro app."

**Adicionar login de verdade (mantendo os dados já sincronizados):**
> "Este app usa Supabase Anonymous Auth (veja src/lib/sync.js). Quero
> adicionar uma tela de login com e-mail/senha que promove a sessão anônima
> existente para uma conta permanente, sem perder os dados já sincronizados
> na tabela inspections. Use supabase.auth.updateUser() para isso e me
> mostre onde encaixar a tela de login no fluxo do App.jsx."

**Adicionar paginação na lista de vistorias:**
> "Em src/App.jsx, o componente ListView renderiza todas as vistorias de uma
> vez. Adicione paginação (ou 'carregar mais') de 20 em 20, mantendo a busca
> e os filtros de data que já existem funcionando."
