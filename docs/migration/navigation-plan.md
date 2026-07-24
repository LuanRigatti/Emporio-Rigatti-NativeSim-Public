# Plano de navegação React Native

Status: proposta aguardando aprovação.  
Escopo: arquitetura de navegação; nenhuma funcionalidade ou código foi implementado.

Base utilizada:

- `docs/migration/ionic-analysis.md`;
- `docs/migration/confirmed-decisions.md`;
- estrutura atual de `src/navigation`, que já possui `RootNavigator`, `MainTabNavigator` e tipos iniciais.

## 1. Princípios da proposta

A navegação será organizada por módulos de negócio, preservando o contrato atual do Firebase e mantendo a diferença entre:

- dados persistidos;
- regras e cálculos derivados;
- estado de tela;
- ações temporárias de UI.

O objetivo é que cada tela tenha uma responsabilidade clara. Listas, detalhes, formulários, filtros, confirmações e operações destrutivas não devem ficar concentrados em uma única tela longa.

A rota será tratada como uma operação de Entregas, porque depende das entregas filtradas, dos endereços e da data selecionada, além de gravar a quilometragem em `gastosDiarios`. O módulo Mais terá um atalho para a rota, mas não uma segunda implementação.

Pagamentos de entregas continuarão sendo alterações nos próprios registros de `entregas`. Não será criado um novo nó/collection de pagamentos na primeira versão.

## 2. Mapa completo das telas

### Fora das abas

| Tela | Responsabilidade |
|---|---|
| Login | Autenticação por e-mail/senha e Google. |
| Loading/Auth transition | Resolver sessão e redirecionar para Login ou App. |
| Modal global de erro | Exibir falhas de autenticação, Firebase, importação, rota ou operação. |
| Modal global de confirmação | Confirmar exclusões, quitações, importação, logout e alterações com impacto. |

### Início

| Tela | Responsabilidade |
|---|---|
| Dashboard | Resumo do período atual, faturamento, lucro líquido, baldes, margem e ações rápidas. |
| Alertas | Pagamentos pendentes, entregas não concluídas e avisos operacionais derivados dos dados existentes. |
| Entregas recentes | Lista curta de entregas recentes com acesso ao detalhe. |
| Pagamentos pendentes | Lista somente de entregas `status === "Não Pago"` e `entregue === true`, com acesso à quitação. |
| Resumo do dia | Quantidade, faturamento, custos e situação das entregas do dia. |

Alertas, entregas recentes, pagamentos pendentes e resumo do dia podem começar como seções do Dashboard. Devem virar telas próprias quando o usuário tocar em “ver todos” ou em um item.

### Entregas

| Tela | Responsabilidade |
|---|---|
| Entregas | Lista com alternância entre “Hoje” e “Todas”, busca, filtro de status e filtro de data. |
| Detalhes da entrega | Exibir campos atuais, endereço, status, entregue, nota fiscal e ações. |
| Nova entrega | Criar entrega com cliente, quantidade, valor, data, endereço e status. |
| Editar entrega | Alterar uma entrega existente com proteção contra perda de alterações. |
| Seleção múltipla | Estado temporário da lista para selecionar entregas pendentes. |
| Quitação | Bottom sheet para escolher Dinheiro ou Pix e confirmar a operação. |
| Rota do dia | Configurar origem, data e critério de otimização. |
| Mapa da rota | Exibir mapa, sequência, distância, duração e marcadores confirmados. |
| Correção de endereço | Corrigir endereço ou selecionar manualmente um ponto quando a geocodificação falhar. |

### Clientes

| Tela | Responsabilidade |
|---|---|
| Clientes | Lista de clientes oficiais, personalizados e clientes encontrados nas entregas, com busca. |
| Detalhes do cliente | Resumo, endereço, preço aplicável, faturamento, quantidade, saldo e ações. |
| Entregas do cliente | Histórico de entregas filtrado pelo nome atual do cliente. |
| Pagamentos do cliente | Entregas pagas e pendentes do cliente; quitação abre o fluxo de Entregas. |
| Formulário de cliente | Cadastrar ou editar preço e endereço personalizado. |
| Revisão de renomeação | Mostrar referências, impacto, backup e confirmação antes de atualizar nomes. |
| Revisão de exclusão | Mostrar impacto, backup e confirmação antes de excluir a configuração personalizada. |

### Financeiro

| Tela | Responsabilidade |
|---|---|
| Financeiro | Resumo financeiro e acesso aos submódulos. |
| Relatório do período | Faturamento, pagos, pendentes, custos, lucro, margens e comparativos. |
| Receitas | Entregas e faturamento derivados do período selecionado. |
| Pagamentos pendentes | Visão financeira de pendências; ações de quitação seguem para Entregas. |
| Gastos diários | Estar, quilometragem, combustível e tipo de combustível por data. |
| Luz mensal | Consulta e edição da luz por mês/ano. |
| Fábrica | Recebimento de baldes, total pago, saldo aberto e quantidade. |
| Detalhes do recebimento | Parcelas pagas, inclusão/exclusão de pagamento e conclusão. |
| Gráficos | Evolução por dia, semana, mês ou ano, usando os cálculos existentes. |

### Mais

| Tela | Responsabilidade |
|---|---|
| Mais | Acesso a funções secundárias e conta. |
| Histórico | Histórico agrupado por ano/mês/dia, busca e filtros. |
| Notificações | Permissão, estado do token e configuração de notificações; não inventar inbox de notificações. |
| Backup | Exportação e início da importação de JSON. |
| Prévia do backup | Validar, contar registros, mostrar impacto e pedir confirmação. |
| Configurações | Tema, ocultação de valores e preferências locais. |
| Conta | Sessão atual, logout e informações de autenticação. |
| Rota e mapa | Atalho que abre `Entregas > Rota do dia`; não duplicar o fluxo. |

## 3. Árvore dos navegadores

```text
RootStack
├── AuthStack
│   └── Login
└── AppTabs
    ├── HomeStack
    │   ├── HomeDashboard
    │   ├── HomeAlerts
    │   ├── HomeRecentDeliveries
    │   ├── HomePendingPayments
    │   └── HomeDaySummary
    ├── DeliveriesStack
    │   ├── DeliveriesHome
    │   ├── DeliveryDetails
    │   ├── NewDelivery
    │   ├── EditDelivery
    │   ├── RouteDay
    │   ├── RouteMap
    │   └── RouteAddressCorrection
    ├── ClientsStack
    │   ├── ClientsHome
    │   ├── ClientDetails
    │   ├── ClientDeliveries
    │   ├── ClientPayments
    │   ├── ClientForm
    │   ├── ClientRenameReview
    │   └── ClientDeleteReview
    ├── FinanceStack
    │   ├── FinanceHome
    │   ├── FinancePeriodReport
    │   ├── FinanceDailyExpenses
    │   ├── FinanceMonthlyLight
    │   ├── FactoryReceipts
    │   ├── FactoryReceiptDetails
    │   └── FinanceCharts
    └── MoreStack
        ├── MoreHome
        ├── History
        ├── NotificationSettings
        ├── BackupCenter
        ├── BackupImportPreview
        ├── AppSettings
        └── Account

Root-level overlays
├── DeliverySettlementSheet
├── BulkSettlementSheet
├── FilterSheet
├── PeriodSheet
├── ConfirmationModal
├── OperationImpactModal
└── FeedbackModal
```

O `RootStack` deve alternar entre `AuthStack` e `AppTabs` conforme o estado de autenticação. O `AppTabs` deve usar cinco Bottom Tabs: Início, Entregas, Clientes, Financeiro e Mais.

## 4. Nomes das rotas e parâmetros

Os parâmetros abaixo usam os identificadores existentes no contrato atual. Enquanto o Firebase continuar relacionando entregas pelo nome, a referência de cliente será `clientName`; `clientId` fica reservado para uma migração estrutural futura.

| Rota | Parâmetros |
|---|---|
| `HomeDashboard` | Nenhum. |
| `HomeAlerts` | `initialAlert?: "pendingPayments" | "undelivered"`. |
| `HomeRecentDeliveries` | `date?: string`, `limit?: number`. |
| `HomePendingPayments` | `clientName?: string`, `date?: string`. |
| `HomeDaySummary` | `date: string` no formato `YYYY-MM-DD`. |
| `DeliveriesHome` | `mode?: "today" | "all"`, `date?: string`, `clientName?: string`, `status?: "Todos" | "Pago" | "Não Pago"`. |
| `DeliveryDetails` | `deliveryId: string`, `focus?: "summary" | "payment" | "address"`. |
| `NewDelivery` | `date?: string`, `clientName?: string`, `source?: "dashboard" | "client" | "deliveries"`. |
| `EditDelivery` | `deliveryId: string`. |
| `RouteDay` | `date?: string`, `source?: "deliveries" | "dashboard" | "more"`. |
| `RouteMap` | `date: string`, `deliveryIds: string[]`, `origin: string`, `optimization: "distance" | "time"`. |
| `RouteAddressCorrection` | `deliveryId?: string`, `address: string`, `returnTo: "route" | "delivery"`. Não transportar coordenada inventada. |
| `ClientsHome` | `initialQuery?: string`. |
| `ClientDetails` | `clientName: string`, `focus?: "summary" | "deliveries" | "payments"`. |
| `ClientDeliveries` | `clientName: string`, `status?: "Todos" | "Pago" | "Não Pago"`, `period?: string`. |
| `ClientPayments` | `clientName: string`, `onlyPending?: boolean`. |
| `ClientForm` | `mode: "create" | "edit"`, `clientName?: string`. |
| `ClientRenameReview` | `oldName: string`, `newName: string`. |
| `ClientDeleteReview` | `clientName: string`. |
| `FinancePeriodReport` | `period: "day" | "week" | "month" | "year" | "all" | "range"`, `date?: string`, `startDate?: string`, `endDate?: string`, `clientName?: string`, `status?: string`. |
| `FinanceDailyExpenses` | `date?: string`. |
| `FinanceMonthlyLight` | `month: string` no formato `YYYY-MM`. |
| `FactoryReceiptDetails` | `receiptId: string`. |
| `FinanceCharts` | `period: "day" | "week" | "month" | "year"`, `date?: string`. |
| `History` | `year?: string | "todos"`, `month?: string`, `day?: string`, `clientName?: string`, `status?: string`. |
| `BackupImportPreview` | Referência temporária ao arquivo selecionado; o conteúdo não deve ser colocado em parâmetro de deep link. |

Os nomes dos parâmetros são de navegação. Eles não alteram os nomes dos campos persistidos no Firebase.

## 5. Fluxos principais

### Autenticação

1. `RootStack` inicia em `AuthStack/Login` enquanto a sessão é resolvida.
2. Login por e-mail/senha ou Google.
3. Após autenticação, abrir `AppTabs/HomeStack/HomeDashboard`.
4. Se a sessão expirar ou o usuário sair, limpar estado em memória e retornar a `Login`.

### Início e atalhos

O Dashboard apresenta somente dados derivados e atalhos. Os atalhos devem encaminhar para os módulos responsáveis:

- nova entrega → `DeliveriesStack/NewDelivery`;
- novo cliente → `ClientsStack/ClientForm` com `mode: "create"`;
- gastos do dia → `FinanceStack/FinanceDailyExpenses`;
- pagamentos pendentes → `HomePendingPayments` e, ao quitar, `DeliverySettlementSheet`;
- rota do dia → `DeliveriesStack/RouteDay`.

O Dashboard não deve salvar diretamente no Firebase.

## 6. Fluxos de criação e edição

### Nova entrega

1. Abrir `NewDelivery` em apresentação modal de tela cheia.
2. Selecionar ou digitar cliente.
3. Informar quantidade e data.
4. Aplicar o preço histórico/customizado correspondente à data.
5. Preencher endereço salvo ou permitir endereço manual.
6. Escolher status inicial e indicar se foi entregue.
7. Exibir prévia do valor calculado e permitir revisão.
8. Salvar pelo repository de entregas no formato atual.
9. Atualizar cache, listas e resumos derivados.
10. Exibir feedback de sucesso/erro.

O valor, as datas de corte e as regras de normalização vêm da camada de domínio; a tela apenas apresenta o resultado.

### Editar entrega

1. Abrir `DeliveryDetails`.
2. Escolher editar e abrir `EditDelivery`.
3. Recalcular valor quando cliente, quantidade ou data exigirem isso, preservando a possibilidade e as regras do valor manual existente.
4. Avisar sobre alterações não salvas ao voltar.
5. Salvar a entrega mantendo os nomes dos campos atuais.

### Edição em lote do histórico

A edição de um dia/mês deve permanecer em uma ação explícita da tela `History`, com prévia da quantidade de registros afetados. Não deve dividir a mesma tela com a criação de entregas.

## 7. Fluxos de pagamento

### Quitação individual

1. Usuário abre uma entrega pendente.
2. Seleciona “Quitar”.
3. Abre `DeliverySettlementSheet`.
4. O sheet exibe valor, cliente, data e métodos `Dinheiro` e `Pix`.
5. O usuário é obrigado a escolher um método.
6. A confirmação atualiza `metodoPagamento` e `status: "Pago"` na entrega.
7. O repository salva o array completo atual.
8. A UI atualiza saldo, alertas e resumos.

Não haverá fallback automático para Pix.

### Quitação múltipla

1. Usuário entra em modo de seleção em `DeliveriesHome` ou `HomePendingPayments`.
2. Seleciona uma ou mais entregas elegíveis.
3. O bottom sheet mostra quantidade, clientes envolvidos e total.
4. O usuário escolhe Dinheiro ou Pix.
5. A confirmação atualiza somente os IDs selecionados.
6. Em caso de falha, a seleção permanece disponível e nenhum sucesso falso é exibido.

### Fábrica

Pagamentos parciais de fábrica continuam em `FactoryReceiptDetails`, pois são outra estrutura: `recebimentoBaldes[].pagamentos[]`. Não devem ser misturados ao sheet de quitação das entregas.

## 8. Fluxos de clientes

### Lista e detalhe

`ClientsHome` pesquisa e ordena clientes normalizados. `ClientDetails` exibe dados personalizados e informações derivadas das entregas, incluindo faturamento, quantidade, pagamentos e saldo.

### Cadastro e edição

`ClientForm` cria ou edita somente a configuração personalizada (`preco` e `endereco`) no contrato atual. O fluxo não deve alterar tabelas históricas embutidas sem autorização.

### Renomeação

1. Usuário escolhe renomear em `ClientDetails`.
2. `ClientRenameReview` localiza entregas, pagamentos e históricos derivados pelo nome.
3. Exibir número de referências e impacto.
4. Gerar backup preventivo.
5. Exigir confirmação.
6. Atualizar todas as referências relacionadas e a chave de `clientesCustom`.
7. Validar integridade antes de confirmar sucesso.

### Exclusão

O fluxo deve excluir a configuração personalizada somente de forma que nenhum histórico seja perdido. A semântica final — remover apenas o cadastro customizado, arquivar o cliente ou outra estratégia compatível — depende de aprovação específica, pois o contrato atual não possui `clientId` nem entidade de cliente independente.

## 9. Fluxo financeiro

1. `FinanceHome` apresenta o resumo do período e links para detalhes.
2. `FinancePeriodReport` concentra filtros de período, cliente e status.
3. `FinanceDailyExpenses` grava os campos diários existentes.
4. `FinanceMonthlyLight` grava luz por `YYYY-MM`.
5. `FinanceCharts` consome os mesmos cálculos do relatório, sem duplicar fórmulas.
6. `FactoryReceipts` e `FactoryReceiptDetails` permanecem isolados do resumo geral, mas seus dados podem ser exibidos em cards derivados quando a regra já existir.

Todos os cálculos — custos históricos, combustível, luz, rateios, margens, comparativos e custo médio — devem ficar em `utils`/services de domínio, nunca em componentes visuais.

## 10. Fluxo de rota

### Configuração

`RouteDay` recebe uma data, lista entregas e origem. A lista pode vir de Entregas, Dashboard ou atalho em Mais.

### Geocodificação

1. Resolver endereços dos destinos.
2. Se um endereço não for localizado, parar o cálculo daquele destino.
3. Mostrar erro claro e abrir `RouteAddressCorrection`.
4. Permitir corrigir o texto ou selecionar manualmente um ponto confirmado.
5. Só continuar quando todas as coordenadas forem confirmadas.

Não usar coordenadas aleatórias.

### Mapa e persistência

`RouteMap` mostra marcadores, sequência, distância e duração. O caso especial de Viana e as opções de menor distância/menor tempo devem ser preservados. Ao finalizar, a quilometragem pode ser gravada no campo diário atual `gastosDiarios[data].km`; a rota em si não vira uma nova entidade Firebase.

## 11. Modais e bottom sheets

### Modais de tela inteira

Usar apresentação modal para fluxos com formulário ou contexto próprio:

- `NewDelivery`;
- `EditDelivery`;
- `ClientForm`;
- `RouteAddressCorrection` quando exigir interação prolongada;
- `BackupImportPreview`.

### Bottom sheets

Usar bottom sheets para ações contextuais e curtas:

- quitação individual;
- quitação múltipla;
- filtros de entregas, clientes e histórico;
- seleção de período/mês/dia;
- ações rápidas de uma entrega;
- resumo/impacto antes de uma operação simples.

O uso de uma biblioteca de bottom sheet compatível com Expo deverá ser aprovado antes da implementação, pois ela ainda não está instalada no projeto atual.

### Confirmações destrutivas

Exclusão de entrega, cliente, pagamento de fábrica, importação e logout devem usar confirmação explícita. Operações de cliente devem usar uma etapa de impacto e backup antes da confirmação final.

## 12. Comportamento do botão voltar

### Android

1. Fechar o bottom sheet ou modal aberto.
2. Sair do modo de seleção múltipla.
3. Fechar filtros temporários.
4. Descartar teclado/dropdowns.
5. Voltar da tela de detalhe para a lista.
6. Voltar entre stacks normalmente.
7. Na raiz de Início, solicitar confirmação antes de sair do aplicativo, se essa política for aprovada.

### iOS

- habilitar gesto nativo de voltar nas telas de stack;
- manter swipe-back em detalhes e formulários quando não houver alteração pendente;
- bloquear ou interceptar o gesto quando houver dados não salvos e apresentar confirmação;
- dispensar sheets/modais pelo gesto ou arraste permitido.

O botão voltar nunca deve salvar ou descartar silenciosamente uma edição.

## 13. Ações principais de cada tela

| Tela | Ações principais |
|---|---|
| Dashboard | Ver alertas, abrir entregas recentes, abrir pendências, nova entrega, rota, novo cliente. |
| Entregas | Buscar, filtrar, alternar hoje/todas, abrir detalhe, criar, selecionar múltiplas, quitar, rota. |
| Detalhe da entrega | Editar, marcar entregue, marcar pago, quitar, excluir, abrir endereço/rota. |
| Clientes | Buscar, abrir detalhe, cadastrar. |
| Detalhe do cliente | Editar, renomear, excluir, ver entregas, ver pagamentos, nova entrega para o cliente. |
| Financeiro | Escolher período, abrir relatório, editar gastos, luz, fábrica e gráficos. |
| Histórico | Escolher ano/mês/dia, buscar, filtrar, expandir, editar registros e abrir detalhes. |
| Rota | Escolher data/origem/critério, calcular, corrigir endereço, selecionar ponto, limpar e salvar km. |
| Mais | Abrir histórico, notificações, backup, configurações, conta e atalho de rota. |
| Backup | Exportar, selecionar JSON, validar, pré-visualizar, confirmar ou cancelar. |
| Conta | Ver sessão e sair com confirmação. |

## 14. Deep linking

Deep linking faz sentido para notificações, abertura de entregas, pendências e rota. Proposta de caminhos:

| Caminho | Destino |
|---|---|
| `/dashboard` | `HomeStack/HomeDashboard` |
| `/entregas` | `DeliveriesStack/DeliveriesHome` |
| `/entregas/hoje` | `DeliveriesHome` com `mode: "today"` |
| `/entregas/:deliveryId` | `DeliveryDetails` |
| `/entregas/pendentes` | `HomePendingPayments` ou lista equivalente |
| `/clientes/:clientName` | `ClientDetails` |
| `/financeiro` | `FinanceHome` |
| `/financeiro/periodo` | `FinancePeriodReport` |
| `/rota` | `DeliveriesStack/RouteDay` |
| `/notificacoes` | `MoreStack/NotificationSettings` |

O link recebido por notificação deve abrir o registro somente após a autenticação e a carga do usuário. `clientName` precisa ser codificado no URL; não criar `clientId` persistido apenas para resolver deep link.

## 15. Melhorias em relação à navegação original

- substituir seções escondidas e classes globais por stacks com histórico real;
- separar módulos por domínio;
- deixar ações curtas em bottom sheets e formulários em modais de tela cheia;
- dar acesso direto a detalhes de entrega e cliente;
- reutilizar uma única tela de quitação a partir de Dashboard, Financeiro, Clientes e Entregas;
- manter uma única implementação de rota, acessível por Entregas e por atalho em Mais;
- manter botão voltar e gesto de iOS com proteção contra dados não salvos;
- usar filtros em sheets, preservando o contexto da lista;
- oferecer feedback consistente de carregamento, sucesso, erro e confirmação;
- corrigir o comportamento de pagamento para exigir Dinheiro ou Pix;
- remover coordenadas aleatórias e transformar falha de endereço em fluxo corrigível;
- preparar operações de cliente com impacto, backup e integridade;
- preservar arrays e nomes atuais do Firebase por meio de repositories/mappers;
- manter identidade visual de cards, tipografia, cores, modo escuro, ocultação de valores e hierarquia financeira sem copiar a estrutura monolítica.

## 16. Funcionalidades que não devem ficar na mesma tela

- Dashboard e edição de dados financeiros;
- lista de entregas e formulário completo de nova entrega;
- detalhe de entrega e edição em lote;
- lista de clientes e confirmação de exclusão/renomeação;
- resumo financeiro e editor de gastos/luz;
- relatório financeiro e cadastro de recebimento de fábrica;
- configuração de rota e mapa detalhado;
- seleção de entregas e confirmação final de quitação;
- seleção de arquivo de backup e importação efetiva;
- configurações de notificações e histórico de notificações, que nem sequer existe no contrato original.

## 17. Pontos que precisam da minha aprovação

1. Confirmar a ordem visual das cinco tabs: Início, Entregas, Clientes, Financeiro e Mais.
2. Confirmar se “Histórico” deve ficar somente em Mais ou também ter atalho dentro de Entregas.
3. Confirmar se “Fábrica” ficará dentro de Financeiro, conforme a dependência atual.
4. Aprovar que a rota tenha implementação canônica em Entregas e apenas atalho em Mais.
5. Aprovar a biblioteca de bottom sheet compatível com Expo.
6. Confirmar se alertas, recentes, pendências e resumo do dia começam como seções do Dashboard e abrem telas completas somente em “ver todos”.
7. Confirmar o comportamento exato de exclusão de cliente personalizado: remover cadastro customizado preservando entregas ou adotar arquivamento.
8. Confirmar o comportamento para nomes duplicados/normalizados durante renomeação.
9. Confirmar o esquema de deep links e o scheme nativo do aplicativo.
10. Confirmar o provedor e a estratégia de seleção manual de ponto no mapa.
11. Confirmar se a tela de pagamentos do cliente será somente leitura com navegação para a quitação em Entregas.
12. Confirmar se a saída do aplicativo pela raiz do Android deverá pedir confirmação.

Após aprovação, o próximo passo deverá ser transformar este plano em uma implementação incremental, começando pelos tipos/rotas tipadas e pela infraestrutura de navegação, sem alterar o contrato do Firebase.
