# Agenda de decisões sobre o banco

Tudo que a leitura do banco levantou e que **precisa de decisão** — manter, lapidar, trocar
ou remover. Nada aqui está decidido. Cada item traz o **achado** (fato verificado em
2026-07-30, reconferível com `npm run db`) e a **pergunta** (o que resolver com o usuário).

Ordenado por peso na arquitetura, não por urgência. **Os códigos são estáveis** — item
resolvido sai da lista e o número não é reaproveitado, então buraco na sequência é
intencional. As armadilhas que não pedem decisão, só cuidado, estão no
[`README.md`](README.md).

---

## A. Estrutura e propriedade do banco

### A1. Um banco só ou dois?
**Achado:** o banco atual mistura três blocos com donos diferentes — agenda (app de
calendário), estado do bot (`dados_cliente`), e CRM de mensagens (`whatsapp_*`). O bot novo
vai ser um serviço separado, em outro repositório.
**Pergunta:** o motor do bot escreve neste mesmo banco, ou tem banco próprio e conversa com
o calendário por API? Isso muda tudo — schema, RLS, deploy, migração.

### A2. Multi-tenancy: nada aqui tem `tenant_id`
**Achado:** nenhuma das 12 tabelas tem coluna de tenant. Os dois barbeiros são linhas fixas
de `profissionais`, e a barbearia é implícita — há exatamente uma. Nossa decisão travada em
`REGRAS.md` é RLS + `tenant_id` em toda tabela.
**Pergunta:** este banco é adaptado (adicionar `tenant_id` em tudo, migrar dado existente) ou
o SaaS nasce em schema novo e este fica como legado da barbearia-piloto?

### A3. Falta o baseline das migrações
**Achado:** o histórico tem 4 entradas de 17/05/2026 e as tabelas originais nasceram no
painel — não dá para recriar o banco do zero a partir dele. **Metade resolvida em
2026-07-30:** daqui pra frente toda DDL passa por `BARBEARIA/db/migracoes/`, registrada na
mesma `supabase_migrations.schema_migrations` que o CLI do Supabase usa.
**Pergunta:** geramos um dump do estado atual como migração zero (banco recriável do zero,
útil para ambiente de teste), ou o baseline é o próprio banco e vivemos com isso?

---

## B. Agenda e disponibilidade

### B4. Duração é por profissional, não por serviço
**Achado:** `agenda_profissional.duracao_min` (60 para o Costa, 45 para o Eloi). A tabela
`servicos` **não tem duração**. Então "Corte Tradicional" (R$35) e "Cabelo e Barba
navalhado" (R$55) ocupam o mesmo slot.
**Pergunta:** duração passa a ser por serviço? Se sim, o cálculo de disponibilidade muda de
"grade fixa" para "encaixe por duração variável" — decisão de peso.

### B5. O bot nunca perguntava o serviço
**Achado:** dos 13 agendamentos, os 8 criados pelo bot (`source='whatsapp'`) têm
`servico=''`. Os 5 do app têm serviço preenchido.
**Pergunta:** serviço entra no fluxo do bot? Se entrar, em que ponto — antes do barbeiro,
depois do dia? E se não entrar, o agendamento fica sem serviço de propósito?

### B6. `agendamentos` guarda texto, não referência
**Achado:** `profissional`, `servico` e `cliente` são `text` livre, sem FK. A trava de slot
único usa `profissional` **como texto** — grafia diferente fura a trava.
**Pergunta:** viramos para `profissional_id` / `servico_id` com FK? Isso quebra a
compatibilidade com o app de calendário atual, que escreve nessa tabela.

### B7. A trava de double-booking existe e é boa — mantém?
**Achado:** índice único parcial em `(profissional, dia_marcado, hora_marcada)` quando o
status é `agendado`/`reagendado`/`confirmado`. É exatamente o que faltava no n8n.
**Pergunta:** confirmamos essa abordagem (garantia no banco, não no código) e mantemos a
lista de status "ativos"? E o código passa a tratar o erro de violação como "esse horário
acabou de sair"?

### B8. `status` de agendamento é texto livre
**Achado:** sem CHECK nem enum. Hoje todas as 13 linhas são `concluido`, mas o índice
reconhece `agendado`, `reagendado`, `confirmado` — e provavelmente existe `cancelado`.
**Pergunta:** qual é a lista fechada de status, e quem faz a transição entre eles (o bot? o
app? um cron que marca como concluído depois do horário)?

### B9. `dias_semana` usa convenção JavaScript
**Achado:** `[1,2,3,4,5,6]` = segunda a sábado, implicando `0 = domingo` (padrão
`Date.getDay()`), não ISO-8601 (onde domingo é 7).
**Pergunta:** mantemos essa convenção? Vale registrar explicitamente, porque é fonte
clássica de bug de fuso/dia.

### B10. Expediente é único para todos os dias
**Achado:** `hora_inicio`/`hora_fim` são um par só. Não há como dizer "sábado até 13h".
**Pergunta:** precisa de horário por dia da semana? (Barbearia com sábado diferente é comum.)

### B11. Períodos de bloqueio sem definição no banco
**Achado:** `dias_bloqueados.periodos` aceita `morning`/`afternoon`/`night`, mas **onde cada
período começa e termina não está no banco** — a regra vive no código do app.
**Pergunta:** essa fronteira vira dado (configurável) ou continua constante em código?

---

## C. Estado da conversa (o que mais importa pro nosso motor)

### C12. `dados_cliente` está sem contrato nenhum
**Achado:** sem UNIQUE em `telefone` (há duas linhas do mesmo número criadas no mesmo
segundo), sem índice além da PK, sem FK, `created_at` sem default (há linha com NULL).
**Pergunta:** a nossa tabela de estado (`conversas`, já nomeada em `REGRAS.md`) nasce nova
com contrato próprio, e `dados_cliente` é abandonada? Ou migramos?

### C13. "Sem estado" tem duas representações
**Achado:** 9 linhas com `fluxo = NULL` e 7 com `fluxo = ''`. Nada impede uma terceira.
**Pergunta:** o estado vira enum/CHECK no banco, ou fica string validada só no código?

### C14. `data_hora` é jsonb guardando string JSON duplamente codificada
**Achado:** `jsonb_typeof` retorna `string` nas 6 linhas preenchidas — nenhuma guarda
objeto. Foi por isso que o n8n precisava de `JSON.parse` condicional.
**Pergunta:** o dia/hora escolhidos ficam em colunas tipadas (`date` + `time`, ou
`timestamptz`) em vez de blob? E se blob, com validação de formato?

### C15. Telefone tem quatro formatos no mesmo sistema
**Achado:** `dados_cliente.telefone` = `5533…` (com DDI); `agendamentos.telefone` = `3398…`
(sem DDI); `whatsapp_contacts.phone` = `5533…`; e o n8n montava
`5533…@s.whatsapp.net` com um `9` **inserido artificialmente** (formato de JID da Evolution
API, não da Cloud API).
**Pergunta:** qual é a forma canônica única? (A Cloud API entrega `wa_id` limpo — o
candidato natural.) E como identificamos o mesmo cliente entre as tabelas?

### C16. "Humano assumiu" está modelado em dois lugares
**Achado:** `dados_cliente.atendimento_temporario` (boolean, 1 linha true) **e**
`whatsapp_conversations.status` que aceita `'human'` (nunca usado). Duas representações do
mesmo fato, sem ligação.
**Pergunta:** qual das duas é a fonte de verdade? Quem escreve, e como o bot sabe que deve
ficar calado?

### C17. `atendimento_ia` existe e nunca foi usado
**Achado:** coluna `timestamptz` em `dados_cliente`, sempre NULL, sem uso no fluxo lido.
**Pergunta:** era intenção de algo (janela de atendimento por IA?) ou é resto? Pode sumir?

---

## D. Mensageria e integração

### D18. `service_window_until` = a janela de 24h da Meta já está modelada
**Achado:** `whatsapp_contacts.service_window_until` é sempre `last_message_at + 24h`.
É a regra da Cloud API: fora dessa janela só se inicia conversa por template aprovado.
**Pergunta:** o nosso motor passa a respeitar/manter esse campo? Isso impacta direto o
**lembrete** — se o lembrete cair fora da janela, precisa de template aprovado pela Meta.

### D19. Dedupe por `wamid` já existe no banco
**Achado:** `UNIQUE (whatsapp_message_id) WHERE NOT NULL` em `whatsapp_messages`. O n8n
fazia dedupe no Redis, mas a garantia estrutural está aqui.
**Pergunta:** aproveitamos esse mecanismo (gravar a mensagem primeiro e deixar o banco
rejeitar a duplicata) em vez de dedupe em memória?

### D20. O envelope original da Meta não é preservado em lugar nenhum
**Achado:** `raw_payload` guarda o corpo que o n8n **montou** para o espelhamento
(`direction`, `sender_type`, `phone`, `wa_id`, `body`) — não o JSON da Cloud API com
`entry`/`changes`/`value`.
**Pergunta:** guardamos o payload cru da Meta (útil para depurar e reprocessar)? Onde — a
tabela `webhook_eventos` que já está prevista em `REGRAS.md`?

### D21. O `id` do botão não foi persistido, só o título
**Achado:** `whatsapp_messages.body` guarda `"🔘 13:00"` (rótulo visível), não
`HORA_2026-06-17_1300`. O identificador que dirigia todo o roteamento se perdeu.
**Pergunta:** persistimos o `id` do botão? (Sem ele não é possível reconstruir o que o
cliente escolheu a partir do histórico.)

### D22. `wa_id` está corrompido em 7 de 8 contatos
**Achado:** começa com `=` — o sinal das expressões do n8n (`={{ ... }}`) vazou literalmente
para o dado.
**Pergunta:** limpamos esses registros? (Se `dados_cliente`/`whatsapp_*` forem abandonados,
o ponto morre; se forem reaproveitados, precisa de correção.)

### D23. `status` `bot`/`human` e `assigned_to` nunca foram usados
**Achado:** o CHECK permite, o índice suporta, mas 11 conversas estão só em `open`/`closed`
com `assigned_to` sempre nulo.
**Pergunta:** o nosso motor passa a manter esse status de verdade? É o que faria o app do
dono mostrar "o bot está atendendo" vs "eu assumi".

### D24. Só 3 de 12 tabelas atualizam `updated_at` sozinhas
**Achado:** trigger `set_updated_at` existe em `agendamentos`, `servicos`,
`categorias_servicos`. `whatsapp_contacts` e `whatsapp_conversations` têm a coluna mas não o
trigger.
**Pergunta:** padronizamos (trigger em tudo que tem a coluna) ou tratamos no código?

---

## E. Segurança

### E25. RLS é a única tranca, e ela é acidental
**Achado:** as 12 tabelas têm RLS ligado e **zero políticas**, enquanto `anon` e
`authenticated` têm privilégio total (inclusive TRUNCATE). Nada quebrou porque os
consumidores usam `service_role`/conexão direta, que ignoram RLS. Um
`DISABLE ROW LEVEL SECURITY` em qualquer tabela a expõe para escrita pública.
**Pergunta:** revogamos os grants de `anon`/`authenticated` (defesa em profundidade) ou
escrevemos políticas de verdade? As duas coisas?

### E27. Supabase Auth está vazio
**Achado:** `auth.users` = 0. Não existe sujeito para `auth.uid()`.
**Pergunta:** quem são os usuários autenticados no SaaS — donos de barbearia? Barbeiros
também? O cliente final nunca (ele só usa WhatsApp)? Isso define a forma de toda política de
RLS.

### E28. Dois buckets públicos
**Achado:** `tabelas` (com o PDF de preços) e `FOTO`, ambos `public = true`.
**Pergunta:** `tabelas` público faz sentido (o bot manda o link). E `FOTO` — o que é, e
precisa ser público?

---

## F. Ferramental

### F29. O MCP do Supabase ficou pendente
**Achado:** `.mcp.json` tem o servidor oficial configurado (escopo de projeto, features
`docs,database,functions`), mas nunca saiu de `⏸ Pending approval` — a aprovação exige
sessão interativa. O acesso ao banco foi resolvido por **conexão direta Postgres**
(`DATABASE_URL` em `BARBEARIA/.env`), que funciona e dá leitura e escrita.
**Pergunta:** vale insistir no MCP, ou removemos o `.mcp.json` para não deixar configuração
morta no repo? (A conexão direta é a que o código vai usar de todo jeito, com Drizzle.)

---

## Registros (sem decisão pendente)

- **Senha antiga vazou em log de sessão** em 2026-07-30 (colada na linha errada do `.env`).
  Foi **resetada em seguida** e não vale mais; o `.env` está no `.gitignore`.
- **F30 resolvido:** `pg` virou devDependency do `BARBEARIA/` e as ferramentas saíram deste
  anexo para `BARBEARIA/ferramentas/`. Se Drizzle entrar com `drizzle-kit pull`, reavaliar
  os scripts de leitura própria.
