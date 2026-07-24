# Análise técnica do projeto original Ionic/PWA

Data da análise: 2026-07-24  
Escopo: somente leitura de `ionic-reference`. Nenhum arquivo dessa pasta foi alterado.

## 1. Resumo do sistema

O sistema é uma SPA/PWA de vendas e faturamento para entregas de baldes. Apesar do nome `ionic-reference`, o frontend original não possui uma estrutura Ionic/Angular separada: a aplicação está concentrada em `ionic-reference/public/index.html`, com HTML, CSS, JavaScript inline e módulos Firebase carregados por CDN. O projeto também possui um shell Capacitor para iOS, dois service workers e Cloud Functions.

As capacidades principais são:

- autenticação por e-mail/senha e Google;
- painel/dashboard com faturamento, lucro, baldes, pagamentos em aberto, gráficos, ranking e transações recentes;
- visão financeira com filtros, custos operacionais, luz mensal, fábrica e gráficos;
- registro, edição, exclusão e marcação de entregas;
- histórico agrupado por mês e dia;
- cadastro de clientes personalizados com preço e endereço;
- controle de gastos diários e mensais;
- recebimentos de baldes da fábrica com pagamentos parciais;
- importação e exportação de backup JSON;
- otimização de rotas com Google Maps Platform;
- notificações push e lembretes de cobrança;
- tema claro/escuro, ocultação de valores, cache local e comportamento responsivo para desktop/mobile.

Arquivos centrais consultados:

- `ionic-reference/public/index.html`: toda a UI, estado, regras, cálculos, persistência Firebase, navegação e integração com Maps.
- `ionic-reference/functions/index.js`: notificações de nova entrega, testes de push e lembrete agendado de cobrança.
- `ionic-reference/database.rules.json`: autorização do Realtime Database.
- `ionic-reference/public/sw.js`: cache offline da PWA.
- `ionic-reference/public/firebase-messaging-sw.js`: mensagens push em segundo plano.
- `ionic-reference/AGENTS.md`, `package.json`, `capacitor.config.json` e `firebase.json`: arquitetura e infraestrutura.

## 2. Páginas, telas e funcionalidades

Não há arquivos de páginas independentes nem roteador de páginas. As telas são seções da SPA ativadas por `mudarAba()` (`public/index.html:9840-10184`).

| Tela/rota lógica | Localização | Funcionalidades |
|---|---|---|
| Login | `public/index.html:7754-7790` | E-mail/senha, Google, mensagens de erro e transição para o app. |
| Painel/Dashboard | `public/index.html:7970-8147` | Faturamento mensal, lucro líquido, baldes vendidos, alerta de pagamentos, notas/boletos, saídas recentes, gráfico diário, margem e transações. |
| Financeiro | `public/index.html:8149-8578` | Filtros de período, faturamento, lucro bruto/líquido, custos, margens, ranking, fábrica, gráficos, importação/exportação. |
| Histórico | `public/index.html:8581-8670` e `13776-13930` | Busca por cliente, status, mês/ano/dia, agrupamento mensal/diário, expansão, edição em lote e ranking. |
| Registrar entrega | `public/index.html:8671-8730` e listeners em `14001-14050` | Cliente, endereço, quantidade, valor, status, data e entregue; valor automático por cliente/data. |
| Registrar cliente | `public/index.html:8732-8787` e `14345-14383` | Cria/atualiza cliente personalizado com preço e endereço. |
| Dados diários | `public/index.html:8789-8859` e `12705-12763` | Gasto Estar, quilometragem, combustível, tipo de combustível e persistência diária. |
| Luz mensal | `public/index.html:8860-8943` e `12624-12704` | Edita o custo de luz por mês/ano. |
| Fábrica | `public/index.html:8354-8500`, `14896-15173` | Recebimento de baldes, valor por data, pagamentos parciais, saldo, conclusão e exclusão. |
| Mapa/Otimização de rota | `public/index.html:8944-9047`, `15175-15970` | Seleção de origem/data, geocodificação, otimização por distância/tempo, mapa, etapas e gravação da quilometragem diária. |
| Subpágina Pagamentos | `public/index.html:23781-24233` | Hash `#pagamentos`, seleção múltipla de entregas pendentes e quitação. |
| Configurações rápidas | espalhadas na mesma SPA | Tema, ocultar valores, notificações, backup, logout, recolhimento de header e filtros mobile. |

Existe também o estado lógico `geral` em `funcoesAbas` e em comparativos, mas não foi encontrado como uma aba principal independente no menu atual; deve ser tratado como fluxo legado/variante interna até confirmação (`public/index.html:9670-9690` e `10090-10117`).

## 3. Componentes reutilizáveis

Não existem componentes formais em arquivos separados. Os seguintes blocos funcionam como componentes visuais reutilizáveis dentro do HTML/JavaScript:

- formulário de login;
- navegação lateral desktop e bottom navigation mobile;
- header responsivo com tema, visibilidade, notificações, backup e logout;
- cards financeiros e cards skeleton de carregamento;
- cards de alerta de pagamentos;
- filtros compartilhados de cliente, status, período, mês, dia e intervalo;
- dropdowns/combos de cliente e mês, incluindo o sistema de portalização global (`15995-16160`);
- toast/notificação (`9406-9454`);
- agrupador de entregas por mês/dia e linha de entrega (`13560-13930`);
- ranking de clientes (`13380-13434` e `11902-11963`);
- cards/gráficos financeiros e dashboard premium;
- card expansível de custos, luz, cliente, entrega e fábrica;
- tabela/ledger da fábrica com linha principal e linha de detalhes;
- mapa, marcadores, sequência de rota e totais;
- painel de backup/importação;
- subpágina de pagamentos e modal de ação rápida.

Na migração, esses blocos devem ser separados em componentes React Native e receber dados/handlers por props ou hooks. Nenhum componente visual deve reproduzir o acesso direto ao Firebase presente no arquivo original.

## 4. Services, models, interfaces e tipos

### Situação encontrada

Não há `services`, `models`, `interfaces`, `types` ou TypeScript no projeto original. O `package.json` contém apenas infraestrutura Capacitor/Firebase; não há framework frontend, bundler ou dependência de Ionic/Angular para a UI.

As responsabilidades que hoje estão misturadas no `index.html` são:

- autenticação Firebase;
- acesso ao Realtime Database;
- cache local;
- normalização de dados;
- precificação;
- cálculos financeiros;
- filtros e ordenação;
- renderização;
- navegação;
- integração com Maps;
- notificações.

### Tipos implícitos identificados

Os tipos abaixo são inferidos dos objetos criados e consumidos. Eles ainda precisam ser formalizados e validados antes da implementação:

```ts
type Entrega = {
  id: string;
  cliente: string;
  quantidade: number;
  valor: number;
  status: "Pago" | "Não Pago" | string;
  entregue: boolean;
  data: string; // YYYY-MM-DD após normalização
  invoiceStatus?: "a_emitir" | "emitido" | string;
  endereco?: string;
  observacao?: string;
  metodoPagamento?: string;
};

type GastoDiario = {
  estar?: number;
  gasolina?: number;       // formato legado
  km?: number;
  precoGasolina?: number;
  tipoCombustivel?: "etanol" | "gasolina" | string;
};

type GastoMensal = number | { luz?: number; [campo: string]: unknown };

type ClienteCustom = {
  preco: number;
  endereco: string;
};

type PagamentoFabrica = {
  id: string;
  data: string;
  valor: number;
};

type RecebimentoFabrica = {
  id: string;
  quantidade: number;
  data: string;
  valorTotal: number;
  concluido: boolean;
  pagamentos: PagamentoFabrica[];
};
```

Esses tipos são uma documentação da forma observada, não uma autorização para alterar nomes ou formatos do Firebase.

## 5. Clientes

Há três tabelas de preço embutidas no código (`public/index.html:9494-9504`):

- `precosClientes2024_2025`;
- `precosClientesAntigos`;
- `precosClientesAtuais`.

Os nomes cobertos incluem `Adri`, `Aldo`, `Andre`, `André`, `Didi`, `Elias`, `Escola`, `Familia`, `Gilson`, `Guilherme`, `Helder`, `Lu`, `Luciano`, `Márcia`, `Monique`, `Particular`, `Particular Antigo`, `Sandro`, `Vaticano` e `Viana`. As tabelas têm valores diferentes por período e devem ser preservadas integralmente na migração.

As datas de corte são:

- antes de `2025-05-05`: tabela `2024_2025`;
- de `2025-05-05` até antes de `2026-04-05`: tabela antiga;
- a partir de `2026-04-05`: tabela atual.

Clientes personalizados são armazenados em `clientesCustom`, indexados pelo nome oficial:

```json
{
  "Nome": {
    "preco": 0,
    "endereco": "..."
  }
}
```

A precedência é: cliente personalizado primeiro, depois tabela de preço selecionada pela data. A normalização remove acentos, capitaliza palavras e corrige aliases específicos (`Santos` → `Elias`, `Vianna` → `Viana` e variações de `Adri`) em `10878-10920`.

Não existe operação de exclusão de cliente personalizado na UI original.

## 6. Entregas e registros

### Persistência

As entregas são uma lista em `usuarios/{uid}/entregas`, não uma coleção de documentos. O formulário cria registros com os campos `id`, `cliente`, `quantidade`, `valor`, `status`, `entregue`, `data`, `invoiceStatus` e `endereco` (`14001-14025`).

### Operações

- Criar: `push` no array local e `set` da lista completa (`14014-14031`, `10794-10797`).
- Ler: `get` de `usuarios/{uid}/entregas` (`10652-10668`).
- Editar uma entrega: substituição do objeto e `set` da lista (`13452-13493`).
- Editar todas as entregas de um dia ou mês: substituição em lote e `set` (`13508-13558`).
- Marcar como pago: altera `status` para `Pago` e salva (`13577-13593`).
- Alternar entrega realizada: altera `entregue` para booleano e salva (`13594-13610`).
- Excluir: remove do array após confirmação e salva (`13612-13615`).
- Alterar nota fiscal: altera `invoiceStatus` para `emitido` ou `a_emitir` (`9308-9324`).

### Comportamento de entrega

`migrarDados()` normaliza datas no formato `DD/MM/YYYY` para `YYYY-MM-DD`, corrige nomes e marca automaticamente como `entregue` qualquer registro com data anterior ao dia atual que ainda esteja falso (`11078-11105`). Essa migração é persistida automaticamente.

## 7. Pagamentos

Há dois conceitos diferentes:

1. Pagamento de uma entrega: o campo `status` da entrega é `Pago` ou `Não Pago`.
2. Pagamento parcial de recebimento da fábrica: itens dentro de `recebimentoBaldes[].pagamentos[]`.

A subpágina `#pagamentos` lista somente entregas com `status === "Não Pago"` e `entregue === true`, ordenadas por data decrescente (`23991-24049`). A quitação múltipla altera `metodoPagamento` e `status` para `Pago` (`24176-24207`).

O modal gerado não cria efetivamente o campo `modalMetodoQuitar`; por isso, o código usa `Pix` como fallback. Esse comportamento precisa ser confirmado antes de ser considerado regra de negócio.

Para a fábrica, o pagamento tem `id`, `data` e `valor`. O total pago é a soma das parcelas; o saldo é `max(0, valorTotal - totalPago)`. Ao atingir diferença menor que `R$ 0,01`, o recebimento é marcado como concluído; ao remover uma parcela, pode voltar a não concluído (`14962-15005`).

## 8. Estrutura financeira

### Dados persistidos

- `gastosDiarios`: mapa por data `YYYY-MM-DD`.
- `gastosMensais`: mapa por mês `YYYY-MM`, aceitando formato legado numérico ou objeto com `luz`.

### Campos diários

- `estar`;
- `gasolina` para o cálculo legado;
- `km`;
- `precoGasolina`;
- `tipoCombustivel` (`etanol` ou `gasolina`).

### Custos

- Custo do balde: `R$ 32,00` antes de `2026-03-20`; `R$ 35,00` a partir dessa data (`10922-10927`).
- Combustível antes de `2026-05-01`: usa diretamente `gastoDia.gasolina`.
- Combustível a partir de `2026-05-01`: `(km / média km por litro) * precoGasolina`; média `5,6` para etanol e `7,4` para gasolina (`11507-11533`).
- Sem tipo de combustível, o código usa uma regra histórica: etanol até `2026-06-30`, gasolina depois.
- Custo médio por entrega somente a partir de `2026-05-01`.
- Luz mensal: valor salvo em `gastosMensais[YYYY-MM].luz`; quando ausente, `R$ 100,00` para mês atual ou passado e `R$ 0,00` para mês futuro (`9499-9571`).
- Rateio da luz: considera dias de entrega em segunda, quarta e sexta e distribui o custo proporcionalmente no intervalo (`9528-9571`).
- Rateio por cliente: Estar e combustível são proporcionais à quantidade de baldes do cliente no grupo; luz é rateada por baldes no dia (`11624-11650`).

### Resumo

Para a lista filtrada:

- faturamento = soma de `valor`;
- pago = soma dos valores com `status === "Pago"`;
- em aberto = soma dos demais status;
- quantidade = soma de `quantidade`;
- custo de baldes = soma de `quantidade * custoDoBalde(data)`;
- lucro bruto = faturamento - custo de baldes;
- lucro líquido = lucro bruto - Estar - combustível - luz;
- margem bruta = lucro bruto / faturamento * 100;
- margem líquida = lucro líquido / faturamento * 100;
- custo médio por balde = custo completo / quantidade;
- preço médio de venda por balde = faturamento / quantidade;
- lucro líquido por balde = lucro líquido / quantidade.

Essas regras estão em `13310-13378`, com variantes para comparativos em `12334-12580` e dashboard premium em `12952-13309`.

## 9. Histórico, filtros, buscas e ordenações

- Busca de cliente: normaliza o texto e procura por inclusão no nome formatado.
- Status: `Todos`, `Pago` e `Não Pago`.
- Períodos: dia, semana, mês, todos e range interno.
- Histórico: seleção de ano/mês, datas disponíveis derivadas das entregas e agrupamento mês → dia → entrega.
- Financeiro: seleção de dia/semana/mês/ano para gráficos e resumo.
- Fábrica: `mes` ou `todos`, com mês atual como referência.
- Rota: data atual, data selecionada no histórico ou lista filtrada.
- Ordenação de entregas: data decrescente e, em empates, nome do cliente em ordem `pt-BR` (`11497-11505`).
- Ordenação de pagamentos pendentes: data decrescente.
- Ranking: faturamento decrescente, depois quantidade decrescente e nome.
- Fábrica: data decrescente.
- Clientes disponíveis: união das tabelas de preço, clientes personalizados e clientes das entregas, deduplicada por chave normalizada e ordenada em `pt-BR`.
- Dropdowns de cliente e busca exibem no máximo 30 resultados (`10978-11043`).

O comparativo mensal não usa simplesmente o mesmo dia do mês anterior: conta dias trabalhados de segunda, quarta e sexta e compara o mesmo número de dias trabalhados (`12334-12389`).

## 10. Navegação e rotas

Não existe React Navigation, Angular Router ou roteamento por URL para as abas. A navegação é feita por estado global `abaAtual`, classes no `body`, seções visíveis e botões desktop/mobile (`10076-10184`).

Abas presentes no menu principal:

- `painel`;
- `financeiro`;
- `entrega`;
- `mapa`;
- `historico`.

Há suporte a swipe/toque no menu mobile, restauração de posição de scroll por aba e transições. A única rota URL explícita é a subpágina de pagamentos via hash `#pagamentos`, sincronizada por `hashchange` e `popstate` (`24209-24222`).

## 11. Estado global e compartilhado

O estado é composto por variáveis globais no mesmo script (`9387-9405`), incluindo:

- identidade: `usuarioId`;
- dados: `entregas`, `gastosDiarios`, `gastosMensais`, `recebimentosFabrica`, `clientesCustom`;
- filtros: `periodoSelecionado`, `anoHistoricoSelecionado`, `filtroGraficoFinanceiro`, `filtroPeriodoFabrica`, `mesSelecionado`, `diaSelecionado`, `dataInicioSelecionada`, `dataFimSelecionada`;
- UI: `abaAtual`, `idEditando`, `diasExpandidos`, `abaScrollPositions`, `detalhesExpandidosFabrica`;
- subpágina: `subpaginaAtiva`, `selectedPagamentoIds`;
- controle de carregamento/animação: `isLoading`, tokens/frames/timers de renderização e transição.

Não existe store global formal. A migração precisará separar estado remoto, estado derivado de filtros e estado efêmero de UI.

## 12. Armazenamento local e offline

### `localStorage`

- `theme-preference`: preferência `light`, `dark` ou `system`.
- `system-theme-last`: último estado detectado do tema do sistema.
- `valores-ocultos-pref`: `1` ou `0` para esconder/mostrar valores.
- `pwa_faturamento_cache_{uid}`: cache SWR com entregas, gastos, recebimentos, clientes e timestamp.
- `migration_backup_data`: backup temporário para migração entre contas.
- `migration_backup_source_uid`: UID de origem do backup temporário.

O carregamento usa cache local imediatamente e depois revalida no Firebase (`10489-10699`). Existe ainda Cache Storage via `public/sw.js`, com cache-first para assets e network-first para HTML; o cache exclui Realtime Database e APIs Google.

## 13. Firebase e infraestrutura

### Authentication

- Firebase Auth com persistência local no navegador.
- E-mail/senha com `signInWithEmailAndPassword`.
- Google via popup no web/PWA.
- Google via `@capacitor-firebase/authentication` no nativo, convertendo o `idToken` para credencial Firebase (`public/index.html:154-243`).
- Logout com `signOut`.

### Realtime Database

O projeto usa exclusivamente Realtime Database. Não foram encontradas chamadas de Firestore, collections, documents ou subcollections.

Árvore observada:

```text
/usuarios/{uid}/
├── entregas: Entrega[]
├── gastosDiarios: { [YYYY-MM-DD]: GastoDiario }
├── gastosMensais: { [YYYY-MM]: number | { luz: number } }
├── recebimentoBaldes: RecebimentoFabrica[]
├── clientesCustom: { [nomeOficial]: ClienteCustom }
└── pushToken: string
```

Leituras principais: cinco `get` paralelos para `entregas`, `gastosDiarios`, `gastosMensais`, `recebimentoBaldes` e `clientesCustom` (`10651-10668`).

Gravações principais: `set` do nó inteiro de cada lista/mapa (`10794-10830`). Não há listener `onValue`; o app faz leituras sob demanda e após alterações atualiza a UI local.

### Regras de segurança

`database.rules.json` permite que cada usuário leia/escreva seu próprio nó. Há uma exceção para um UID específico: leitura permitida também a outro UID, mas escrita somente pelo UID proprietário. Essa exceção e os UIDs codificados devem ser confirmados antes da migração.

### Cloud Functions

`functions/index.js` contém quatro endpoints:

1. `notificarNovaEntrega`: trigger `onValueCreated` em `/usuarios/{usuarioId}/entregas/{entregaId}`; lê `pushToken` e envia notificação com quantidade e cliente.
2. `testarPush`: HTTP manual com `?usuarioId=`.
3. `lembreteCobranca`: agendado de segunda a sexta às 15:00 em `America/Sao_Paulo`; soma entregas `Não Pago` por cliente e envia total a cobrar.
4. `testarLembreteCobranca`: HTTP manual para executar a rotina.

O lembrete considera `status === "Não Pago"`, soma `valor` numérico ou convertido e agrupa por `cliente` (`functions/index.js:101-151`).

### Push e service workers

O token FCM é solicitado no navegador, salvo em `/usuarios/{uid}/pushToken` e usado pelo service worker de mensagens (`public/index.html:224-243`, `public/firebase-messaging-sw.js`).

## 14. Operações de criação, leitura, edição e exclusão

| Domínio | Criar | Ler | Editar | Excluir |
|---|---|---|---|---|
| Entrega | Sim, adiciona ao array | `get` do array | Individual e em lote | Sim, remove do array e regrava tudo |
| Cliente customizado | Sim | Carrega o mapa completo | Sobrescreve pela chave | Não há UI |
| Gasto diário | Cria chave de data | Carrega mapa | Atualiza campo da data | Não há UI |
| Luz mensal | Cria/sobrescreve chave do mês | Carrega mapa | Atualiza `luz` | Não há UI |
| Recebimento fábrica | Sim, adiciona ao array | Carrega array | Pagamentos/conclusão | Registro e pagamento podem ser excluídos |
| Pagamento de entrega | Não é entidade separada | Derivado da entrega | Muda status/método | Não há exclusão independente |
| Push token | Sim | Lido pelas Functions | Sobrescrito ao renovar | Não há exclusão explícita |

Todas as alterações usam `set` do nó completo. Não há transações, `push` do Realtime Database, `update`, `remove` ou controle de concorrência.

## 15. Validações observadas

- Login: e-mail e senha obrigatórios; mensagens específicas para credenciais inválidas, popup bloqueado e conexão.
- Entrega: cliente obrigatório; quantidade mínima 1; valor mínimo 0; data obrigatória; status selecionável; endereço manual opcional.
- Edição: data obrigatória, quantidade maior que zero, valor numérico e não negativo.
- Fábrica: quantidade maior que zero e data obrigatória.
- Pagamento da fábrica: data obrigatória, valor numérico maior que zero.
- Cliente customizado: nome e endereço obrigatórios, preço maior que zero.
- Importação: JSON válido; aceita array de entregas ou objeto com `entregas`, `gastosDiarios`, `gastosMensais` e `recebimentoBaldes`.
- Rota: origem obrigatória, entregas disponíveis e geocodificação necessária; quando o geocoder falha para um destino, o código usa coordenada aleatória aproximada em Curitiba.
- Exclusões: usam `confirm()` antes de remover entrega, pagamento ou registro de fábrica.

Não há validação de esquema após leitura do Firebase; a aplicação apenas força alguns arrays para `[]` e aplica normalização parcial.

## 16. Integração de rota e mapa

O mapa usa Google Maps JavaScript API, geocoder, geometry e Routes API. Há:

- endereço base fixo;
- origens pré-configuradas `Depósito` e `PLAV Transportadora`;
- mapa fixo de endereços de clientes;
- endereço customizado do cliente como prioridade;
- origem/base, primeira parada obrigatória e retorno à base;
- otimização por menor distância ou menor tempo;
- tratamento especial para `Viana`: a rota é dividida em dois trechos, ida até Viana e retorno à base;
- marcadores, polyline, distância, duração e sequência de paradas;
- gravação automática da distância arredondada em quilômetros em `gastosDiarios[data].km`.

A rota não é persistida como entidade própria; somente a quilometragem é salva.

## 17. Dependências entre funcionalidades

```text
Auth
  -> uid atual
  -> leitura dos nós do Realtime Database
  -> cache local e estado global
  -> clientes/preços + entregas + gastos
  -> filtros e cálculos financeiros
  -> dashboard/histórico/pagamentos/rota
  -> notificações e Cloud Functions
```

Dependências críticas:

- entregas dependem da autenticação, clientes/preços e persistência;
- valor da entrega depende de cliente, data e quantidade;
- histórico, pagamentos, dashboard e rota dependem da lista de entregas;
- financeiro depende de entregas, gastos diários, gastos mensais e datas de corte;
- ranking depende dos filtros ativos;
- rota depende de endereço customizado/mapa fixo e da lista filtrada de entregas;
- lembrete de cobrança depende do formato e do texto exato de `status`;
- cache e importação/exportação dependem dos mesmos nomes de campos do Firebase.

## 18. Ordem recomendada de migração

1. Confirmar as ambiguidades listadas na seção seguinte e congelar o contrato do Firebase.
2. Criar tipos e normalizadores compatíveis com os formatos existentes, sem renomear campos.
3. Implementar Auth e infraestrutura Firebase em services/repositories, incluindo regras de segurança e logout.
4. Implementar cache local e carregamento SWR.
5. Implementar catálogo de clientes, tabelas históricas de preço e cadastro de clientes customizados.
6. Implementar entregas: criação, leitura, edição individual/em lote, exclusão, status, entregue e nota fiscal.
7. Implementar gastos diários, gastos mensais e editor de luz.
8. Implementar filtros, histórico agrupado, buscas, ordenações e seleção de período.
9. Implementar camada de cálculos financeiros e testes de preços, custos, margens, rateios e comparativos.
10. Implementar dashboard, ranking, alertas e gráficos derivados.
11. Implementar fábrica e pagamentos parciais.
12. Implementar importação/exportação e compatibilidade de backups.
13. Implementar notificações FCM e validar as Cloud Functions.
14. Implementar rota/mapa e confirmar a estratégia de chaves, geocodificação e fallback.
15. Por último, migrar navegação, tema, responsividade, animações e detalhes visuais.

Essa ordem reduz o risco de construir telas sem o contrato de dados e sem os cálculos que alimentam as telas.

## 19. Riscos e comportamentos ambíguos

1. O projeto é chamado de Ionic, mas a UI é uma SPA vanilla; é necessário confirmar o nível de equivalência visual esperado no React Native.
2. Não há models/interfaces oficiais; os tipos desta análise são inferidos.
3. O schema usa arrays inteiros em Realtime Database e gravações `set`, com risco de perda em concorrência.
4. Não há listeners realtime; mudanças externas só aparecem após nova leitura.
5. `status` depende exatamente dos textos `Pago` e `Não Pago`, inclusive acentuação.
6. O alerta e a subpágina de pagamentos consideram `Não Pago` somente quando `entregue === true`, mas o resumo financeiro soma todo status diferente de `Pago`.
7. `invoiceStatus` é independente de `status` de pagamento.
8. A quitação múltipla usa fallback `Pix` porque o seletor de método não é renderizado no modal atual.
9. `MEDIA_KM_POR_LITRO = 5.2` existe, mas não é usado pelo cálculo vigente, que usa 5.6/7.4.
10. O fallback de geocodificação cria coordenadas aleatórias; isso pode produzir rotas incorretas.
11. Existem chaves de API e configuração Firebase no frontend. O escopo, restrições e rotação dessas chaves precisam ser confirmados.
12. Endereços de clientes e endereço base estão hardcoded no frontend e também podem vir de `clientesCustom` ou da entrega.
13. A luz padrão de `R$ 100,00`, dias trabalhados segunda/quarta/sexta e cortes de data são regras de negócio, mas não há documentação externa explicando sua origem.
14. O custo de combustível anterior a `2026-05-01` usa `gasolina` como valor total; depois dessa data, `precoGasolina` é preço por litro. A compatibilidade precisa ser testada com dados reais.
15. Ao carregar, entregas passadas não marcadas como entregues são alteradas automaticamente.
16. Há fluxo de migração específico para UIDs fixos e backup entre contas; não deve ser generalizado sem confirmação.
17. O cadastro customizado sobrescreve por nome e não tem exclusão/renomeação.
18. O valor automático é recalculado durante a edição, mas o usuário ainda pode salvar um valor manual diferente do preço calculado.
19. A importação aceita `recebimentoBaldes`, enquanto o cache local usa `recebimentosFabrica`; são formatos de transporte diferentes que precisam ser preservados.
20. Não há testes, linter ou typechecker no projeto original (`ionic-reference/AGENTS.md`).

## 20. Pontos que precisam de confirmação antes de implementar

- O estado lógico `geral` ainda deve existir como uma tela separada ou deve ser consolidado no Dashboard/Financeiro?
- O método de pagamento das entregas deve permitir escolha real no modal? Quais opções são válidas?
- O campo `entregue` deve continuar sendo marcado automaticamente para datas passadas?
- A regra de dias trabalhados é definitivamente segunda, quarta e sexta para luz e comparativos?
- Os cortes de preço, custo do balde, combustível e custo médio continuam válidos?
- O campo `gasolina` legado representa valor total diário ou preço por litro?
- O fallback aleatório de geocodificação deve ser mantido, substituído por erro ou exigir endereço manual?
- Os endereços hardcoded e a origem base podem ser migrados para configuração segura/administrável?
- A exceção de leitura entre UIDs no `database.rules.json` ainda é necessária?
- O contrato deve continuar usando arrays em `entregas` e `recebimentoBaldes`, ou há autorização para normalização estrutural?
- Deve existir exclusão/edição de clientes customizados e remoção de gastos/luz?
- O campo `invoiceStatus` será mantido mesmo sem fluxo fiscal completo?
- O push e os lembretes de cobrança serão migrados agora ou em uma etapa posterior?
- A migração precisa manter o comportamento de cache, backup entre contas e importação/exportação exatamente como está?

Até essas dúvidas serem respondidas, não é seguro implementar funcionalidades que possam criar novos campos, alterar cálculos ou modificar o contrato do Firebase.
