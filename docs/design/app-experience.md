# Experiência do aplicativo

## Objetivo

Este documento define a experiência desejada para o aplicativo React Native antes da implementação de novas telas. Ele transforma as funcionalidades já existentes em uma experiência de produto coerente para iPhone, preservando dados, regras de negócio, cálculos e fluxos operacionais.

A direção visual é premium e nativa, mas não é uma reprodução do PWA. O PWA e o `ionic-reference` são fontes de comportamento e de conteúdo; a composição da experiência React Native deve privilegiar foco, contexto, navegação por pilhas, ações rápidas e uso confortável com uma mão.

Este documento não autoriza implementação. Não cria telas, componentes, rotas, estados ou regras novas.

## Princípios de experiência

1. A pessoa deve entender o estado da operação em poucos segundos.
2. Cada tela deve ter uma ação principal clara e poucas ações secundárias visíveis.
3. Detalhes e edições pertencem a uma stack; decisões rápidas pertencem a modais ou bottom sheets.
4. Listas extensas devem permitir busca, filtros e agrupamento sem transformar a tela em um painel congestionado.
5. A tela nunca recalcula valores financeiros: ela apresenta dados e resultados fornecidos pela camada de serviços e cálculos.
6. Componentes visuais não acessam Firebase diretamente.
7. O botão voltar nativo e o gesto de voltar do iOS devem funcionar em todas as stacks.
8. Erros, carregamento, estado vazio, conexão offline e confirmação de ações destrutivas devem ser estados explícitos.
9. Valores financeiros podem ser ocultados globalmente sem mudar o layout, os cálculos ou a ordenação.
10. A interface deve continuar legível com tema claro, tema escuro, Dynamic Type, VoiceOver e Reduce Motion.

## Arquitetura de informação

### Entrada do aplicativo

O aplicativo inicia em um estado de carregamento enquanto a sessão é determinada.

- Sem sessão: tela de autenticação.
- Com sessão válida: shell principal.
- Erro de sessão ou rede: estado de erro recuperável, sem criar dados vazios.
- Deep link de uma notificação: aguarda a sessão e então abre o destino solicitado.

### Shell principal

A experiência principal é organizada em quatro destinos de alta frequência:

1. **Dashboard** — visão geral e decisões do dia.
2. **Finanças** — resultados, custos, comparativos e fábrica.
3. **Registrar** — operação diária, entregas, rota e gastos.
4. **Histórico** — consulta e auditoria de entregas anteriores.

Clientes, configurações, backup e notificações continuam disponíveis. Eles são módulos secundários acessados por ações contextuais, menus da conta, seletores de cliente e detalhes de registros, sem ocupar necessariamente um destino primário.

Essa decisão mantém a funcionalidade de Clientes e Mais sem tornar a barra inferior um catálogo de módulos. A árvore antiga com cinco abas — incluindo Clientes e Configurações — deve ser tratada como referência histórica da navegação, não como obrigação para a nova experiência.

### Módulos secundários

- Clientes e preços.
- Rota e mapa.
- Gastos e custos.
- Fábrica e recebimentos.
- Notificações.
- Backup.
- Configurações, conta e logout.

## Contratos de interação

| Necessidade | Padrão de experiência | Uso previsto |
|---|---|---|
| Ir para uma nova área de trabalho | Tab principal | Dashboard, Finanças, Registrar e Histórico |
| Ver detalhes de um registro | Stack | Entrega, cliente, pagamento, recebimento, indicador e rota |
| Criar ou editar com vários campos | Stack em tela completa | Nova entrega, cliente, gasto, configuração complexa |
| Escolher entre poucas opções | Bottom Sheet | Período, status, método de pagamento, preset de rota |
| Confirmar uma ação irreversível | Confirmation Dialog | Excluir cliente, excluir entrega, logout, importar backup |
| Executar uma ação rápida contextual | Swipe ou context menu | Quitar, editar, marcar entrega, abrir rota |
| Criar o registro mais frequente | FAB | Nova entrega, dentro de Registrar e Clientes quando aplicável |
| Procurar em uma coleção grande | Search | Clientes, entregas, histórico, pagamentos e registros da fábrica |
| Atualizar dados remotos | Pull to Refresh | Dashboard, Finanças, Registrar, Histórico, Clientes e Fábrica |
| Expor uma explicação sem interromper o contexto | Bottom Sheet | Fórmula/indicador financeiro, custo, alerta e motivo de bloqueio |

## Estados compartilhados por todas as áreas

Cada lista ou resumo deve distinguir os seguintes estados:

- **Carregando inicial:** Skeleton com a forma aproximada do conteúdo real.
- **Atualizando:** conteúdo existente preservado e indicador discreto de atualização.
- **Salvando:** ação principal bloqueada contra duplo envio, sem apagar o formulário.
- **Vazio:** EmptyState orientado à próxima ação, sem gráficos ou registros inventados.
- **Erro:** ErrorState com causa compreensível e ação de tentar novamente.
- **Offline:** dados em cache identificados como possivelmente desatualizados; gravações inválidas não são aceitas silenciosamente.
- **Sem permissão:** instrução para conceder a permissão necessária, sem falha genérica.
- **Dados parciais legados:** registros válidos continuam visíveis; itens inválidos são isolados e informados em desenvolvimento.

As animações devem ser curtas e discretas. Transições de stack podem deslizar; expansões de grupos podem usar altura/opacidade; troca de tab pode usar o movimento nativo disponível. Tudo deve respeitar Reduce Motion.

# Aba Dashboard

## Objetivo

Responder rapidamente: “Como está a operação e o dinheiro neste momento?”. O Dashboard não é uma segunda tela de Financeiro. Ele mostra contexto, alertas e atalhos; o aprofundamento ocorre em stacks específicas.

## O que aparece primeiro

1. Período selecionado e ano, com leitura humana.
2. Resumo do dia ou do período: faturamento, recebido, pendente e lucro líquido.
3. Próxima decisão operacional: entregas do dia, pagamentos em aberto ou alerta importante.
4. Atalhos de nova entrega, rota do dia e dados/gastos do dia.
5. Resumos secundários: custos, margens, quantidade de baldes e fábrica.

O usuário não deve receber uma grade de pequenos indicadores sem hierarquia. O primeiro cartão deve estabelecer o estado financeiro; os blocos seguintes devem responder perguntas operacionais.

## Fluxo principal

1. A pessoa abre o Dashboard.
2. O sistema apresenta dados em cache, quando disponíveis, e atualiza em segundo plano.
3. A pessoa muda o período em um Bottom Sheet, se necessário.
4. Toca em um indicador ou alerta para ver os registros relacionados.
5. Retorna pela stack sem perder o período selecionado.

## Ações rápidas

- Nova entrega.
- Abrir rota do dia.
- Registrar gasto/dados do dia.
- Ver pagamentos pendentes.
- Abrir clientes relacionados a uma pendência.
- Atualizar o resumo com Pull to Refresh.

## Telas e destinos

- `Dashboard`: tela raiz da aba.
- `DashboardIndicatorDetails`: registros que compõem um indicador.
- `DashboardAlerts`: alertas de cobrança, nota fiscal/boletos e operação.
- `DashboardRecentDeliveries`: entregas recentes, com acesso ao detalhe.
- `DashboardPendingPayments`: pagamentos pendentes e clientes relacionados.
- `DashboardPeriodSelector`: Bottom Sheet, não uma tela permanente.

## Padrões de apresentação

- Tocar em um card financeiro abre stack de detalhes, não um modal empilhado sobre outro modal.
- Período, ano e comparação abrem Bottom Sheet.
- Alertas simples podem abrir Bottom Sheet; um conjunto de registros abre stack.
- O FAB, quando exibido, cria uma nova entrega e deve existir somente quando não competir com a ação principal do shell.
- Busca não é necessária no Dashboard raiz; aparece nos destinos de registros.
- Pull to Refresh é obrigatório.
- Skeleton deve preservar a estrutura dos cards e listas.
- Números podem usar animação de entrada discreta, sem alterar o resultado nem sugerir precisão inexistente.

# Aba Finanças

## Objetivo

Permitir entender resultado, recebimentos, pendências e custos por período, com acesso aos registros que explicam cada número.

## O que aparece primeiro

1. Seletor de período visível: Hoje, mês específico, ano, Todos e intervalo personalizado quando suportado pelo comportamento original.
2. Resumo de faturamento, recebido, pendente, lucro bruto, lucro líquido e margens.
3. Custos separados por Estar, combustível, luz, rateios e demais gastos.
4. Evolução mensal e rankings somente quando houver dados suficientes.
5. Fábrica e pagamentos parciais em seção própria, sem misturar o saldo da fábrica com o total aberto das entregas.

O mês não deve ser fixado silenciosamente no mês atual. Ao escolher “Mês”, a pessoa deve selecionar mês e ano, e essa escolha deve permanecer ao navegar por Resumo, Relatório, Gráficos e Ranking.

## Fluxo principal

1. A pessoa abre Finanças e vê o último período selecionado.
2. Abre o seletor de período para trocar Hoje, mês/ano, Todos ou intervalo.
3. Usa o filtro de custos para alternar Estar, combustível, luz e rateios.
4. Toca em um indicador.
5. A aplicação abre os registros que compõem o resultado, mantendo o mesmo período.
6. Volta para Resumo, Relatório, Gráficos ou Ranking sem perder filtros.

## Telas e destinos

- `FinanceOverview`: resumo financeiro.
- `FinanceReport`: relatório por período.
- `FinanceCharts`: evolução por mês e métrica.
- `FinanceRanking`: ranking com período e critérios preservados.
- `FinanceIndicatorDetails`: registros relacionados ao indicador.
- `CostBreakdown`: custos do período.
- `DailyExpenses`: gastos diários, com edição.
- `MonthlyLight`: luz mensal e explicação do rateio.
- `FactoryOverview`: recebimentos da fábrica.
- `FactoryDetails`: detalhe, parcelas, saldo e histórico.

## Padrões de interação

- Período, métrica e subfiltro de custos: Bottom Sheet.
- Explicação de uma fórmula ou indicador: Bottom Sheet informativo.
- Registros de origem de um valor: stack.
- Adição rápida de gasto: modal de formulário curto; edição completa: stack.
- Adição de pagamento da fábrica: Bottom Sheet quando for uma ação curta; edição ou remoção: stack/confirmation dialog.
- Busca: disponível em registros financeiros, fábrica e gastos históricos; não precisa ficar na primeira dobra do resumo.
- Pull to Refresh: resumo, relatórios, gastos e fábrica.
- Skeleton: cards, listas e gráficos; nunca desenhar uma linha falsa para representar um único período.
- Sem dados: EmptyState explica que não há registros no intervalo, sem preencher pontos artificiais.
- Animações: transição entre métricas e expansão de custos, sempre com respeito a Reduce Motion.

## Regras de experiência financeira

- O valor de luz mensal persistido não é alterado pelo rateio.
- Um período sem entregas apresenta luz rateada geral igual a zero.
- Rateio por cliente sem cliente informado é ausência (`null`), não valor zero.
- Cliente informado sem participação pode apresentar zero.
- Ocultação de valores é global e apenas visual.
- Valores mais recentes aparecem primeiro nas listas cronológicas de custos e registros.

# Aba Registrar

## Objetivo

Ser o centro operacional do trabalho diário: consultar as entregas do dia/data escolhida, criar uma entrega, quitar, editar e iniciar a rota sem atravessar telas financeiras desnecessárias.

## O que aparece primeiro

1. Data operacional selecionada, inicialmente o dia atual.
2. Resumo do dia: quantidade de entregas, baldes, faturamento e pendências.
3. Entregas do dia com cliente, endereço, quantidade, valor e status.
4. Ações claras para Nova entrega, Rota e Dados do dia.

“Registrar” não deve duplicar o Histórico. Ele prioriza o dia escolhido e a operação; consultas antigas e agrupamentos ficam em Histórico.

## Fluxo de nova entrega

1. Tocar em Nova entrega.
2. Selecionar o cliente.
3. Confirmar o endereço obrigatoriamente.
4. Informar quantidade.
5. Receber o valor calculado pela camada financeira.
6. Ajustar manualmente o valor, quando permitido.
7. Selecionar data e status.
8. Selecionar explicitamente Dinheiro ou Pix quando o pagamento se aplicar.
9. Revisar todos os campos.
10. Salvar e retornar ao dia da entrega com feedback claro.

Não existe fallback silencioso para Pix. Endereço ausente não permite concluir o cadastro/edição de uma entrega.

## Telas e destinos

- `Register`: lista operacional do dia/data escolhida.
- `DeliveryDetails`: detalhes da entrega.
- `NewDelivery`: formulário em stack, com apresentação de tela completa em iPhone.
- `EditDelivery`: formulário em stack.
- `DeliveryReview`: revisão antes de salvar.
- `DeliverySettlement`: quitação curta em Bottom Sheet.
- `DeliveryBulkEdit`: edição em lote, com modo de seleção.
- `RouteForDate`: rota da data escolhida.
- `DailyData`: dados e gastos do dia.

## Ações e gestos

- FAB: Nova entrega.
- Swipe: editar, quitar, marcar como entregue ou abrir rota, conforme o estado; ações destrutivas exigem confirmação.
- Context menu: editar, duplicar como rascunho se o fluxo aprovado suportar, excluir, abrir cliente e abrir mapa.
- Seleção múltipla: ativada por ação contextual, não por pressão longa obrigatória.
- Busca: clientes/entregas quando a lista do dia for grande.
- Filtros: Bottom Sheet para status, pago/não pago, data e cliente.
- Pull to Refresh: lista e resumo do dia.
- Skeleton: resumo e cards de entrega.
- Animações: inserção/remoção de linha e mudança de status, sem mover o usuário de forma inesperada.

## Quitação

A quitação abre um Bottom Sheet com valor, método e confirmação. O método deve ser escolhido entre Dinheiro e Pix. A entrega passada continua sendo marcada automaticamente conforme a regra legada quando `entregue === false`; essa transição deve ser apresentada de forma compreensível, sem reescrever o cálculo na tela.

# Aba Histórico

## Objetivo

Permitir auditoria e recuperação de qualquer entrega sem competir com a operação diária.

## O que aparece primeiro

1. Busca e filtros de ano, mês, dia e status.
2. Período ativo claramente identificado.
3. Resumo do período.
4. Agrupamento por mês e, dentro dele, por dia.
5. Entregas com status, cliente, quantidade e valor.

O filtro de ano deve limitar de fato os registros ao ano escolhido. A correção de filtragem não pode alterar cálculos ou regras de negócio.

## Fluxo principal

1. Abrir Histórico.
2. Pesquisar ou abrir o Bottom Sheet de filtros.
3. Escolher ano, mês, dia, status e, quando aplicável, cliente.
4. Expandir um mês.
5. Expandir um dia e revisar o resumo.
6. Abrir uma entrega em stack.
7. Editar individualmente ou iniciar edição em lote.

## Telas e padrões

- `History`: `SectionList` ou lista equivalente agrupada.
- `HistoryPeriodFilters`: Bottom Sheet.
- `HistoryDeliveryDetails`: stack.
- `HistoryBulkEdit`: stack em modo de seleção.
- `HistoryRanking`: stack ou seção derivada do período.

Swipe pode oferecer editar, quitar ou marcar como entregue. Excluir não deve ocorrer por um gesto sem confirmação. Context menu é apropriado para ações menos frequentes e para preservar a densidade da lista.

Search fica no topo. Pull to Refresh atualiza a coleção. Skeleton reproduz cabeçalhos mensais e linhas. Expansão de mês/dia usa animação curta; em Reduce Motion, a mudança deve ser instantânea ou apenas usar realce.

# Clientes e preços

## Objetivo

Oferecer uma visão confiável da relação com cada cliente e de sua configuração de preço/endereço, sem perder o histórico que ainda está relacionado pelo nome.

## Fluxo

1. Acessar Clientes por atalho, seletor de cliente ou menu secundário.
2. Buscar por nome normalizado ou alias.
3. Abrir o detalhe.
4. Revisar saldo, entregas, pagamentos, endereço e configuração personalizada.
5. Editar dados permitidos ou abrir um fluxo de renomeação/exclusão.

## Telas

- `Clients`: lista.
- `ClientDetails`: resumo financeiro, endereço, entregas e pagamentos.
- `ClientDeliveries`: entregas relacionadas.
- `ClientPayments`: pagamentos relacionados.
- `NewClient` e `EditClient`: stack em tela completa.
- `RenameClientReview`: impacto da renomeação e confirmação.
- `DeleteClientReview`: impacto, backup e confirmação destrutiva.

## Padrões

- FAB na lista para cadastrar cliente.
- Search sempre disponível.
- Pull to Refresh, Skeleton e EmptyState.
- Bottom Sheet para alternar visão de entregas, pagamentos e saldo ou para ações rápidas.
- Context menu para editar, ver impacto, abrir mapa e configurações de preço.
- Swipe somente para ações não destrutivas ou para revelar “mais”; renomear/excluir nunca deve ser uma ação destrutiva acidental.

Endereço é obrigatório em cadastro e edição. Cliente antigo sem endereço deve ser marcado como incompleto e não pode ser usado para mapa/otimização até correção. Colisão com alias bloqueia duplicidade. Cliente histórico pode receber configuração personalizada sem ser considerado duplicado. Renomear ou excluir exige localizar referências, mostrar impacto, gerar backup e preservar histórico; excluir remove apenas o registro em `clientesCustom` conforme decisão confirmada.

# Rota e mapa

## Objetivo

Preparar e acompanhar a rota de um dia com endereços válidos, ordem explícita e confirmação antes de gravar quilometragem.

## Fluxo

1. A pessoa escolhe a data da rota.
2. Escolhe um fluxo:
   - Flamboyant → Entregas → Francisco Balchak;
   - PLAV → Entregas → Flamboyant → Francisco Balchak;
   - Personalizado.
3. Revisa origem, paradas obrigatórias, entregas e destino final.
4. Escolhe menor distância ou menor tempo.
5. Inicia a otimização.
6. Corrige endereços não localizados ou escolhe um ponto manual apenas para a sessão.
7. Acompanha mapa e lista ordenada.
8. Marca entrega, avança à próxima parada e, ao final, decide se grava a quilometragem.

Rua Francisco Balchak, 83 é o destino final padrão. Flamboyant e PLAV não são fixos fora dos presets. Pontos obrigatórios não podem ser reordenados. Entregas intermediárias podem ser reordenadas. A regra especial de Viana permanece exatamente como no Ionic. Mais de 25 pontos são divididos internamente em trechos, apresentados como uma rota contínua.

## Telas e overlays

- `RouteDateSelection`: Bottom Sheet ou controle no topo.
- `RoutePresetSelection`: Bottom Sheet.
- `RouteConfiguration`: stack para modo personalizado.
- `RouteMap`: stack com mapa, lista ordenada e resumo.
- `RouteStopDetails`: Bottom Sheet sobre o mapa; stack quando houver edição.
- `RouteAddressCorrection`: stack/modal de correção.
- `RouteManualPointSelection`: tela do mapa com confirmação.
- `RouteCompletion`: confirmação e resumo antes da gravação de km.

Não usar coordenadas aleatórias. Endereço inválido bloqueia a otimização, mas oferece correção e ponto manual. Abrir Apple Maps ou Google Maps é ação externa contextual; no Web deve existir um fallback claro.

Loading, API indisponível, permissão negada, rota sem entregas e geocodificação ausente devem aparecer como estados específicos. O mapa nativo depende de Development Build; essa limitação não deve ocultar o resumo ou a lista da rota.

# Gastos e custos

## Objetivo

Registrar e explicar custos operacionais sem misturar entrada de dados com análise financeira.

## Fluxo

1. A partir de Registrar, abrir Dados do dia para registrar quilometragem, Estar, combustível e tipo/preço.
2. A partir de Finanças, abrir histórico de gastos, custos do período ou luz mensal.
3. Tocar em um indicador para abrir a explicação do cálculo em Bottom Sheet.
4. Editar o registro em stack quando houver mais campos ou histórico.

## Padrões

- Dados do dia: stack ou modal de formulário curto.
- Luz mensal: stack; explicação do rateio: Bottom Sheet.
- Histórico de gastos: Search opcional, filtros por período/tipo, registros mais recentes primeiro.
- Pull to Refresh, Skeleton e ErrorState.
- FAB pode existir em Dados do dia para adicionar gasto, nunca no resumo financeiro se houver outra ação principal.
- Não animar fórmulas; animar apenas expansão de detalhes.

As datas de corte, custos históricos, combustível legado/atual, médias de etanol/gasolina, dias trabalhados e luz permanecem na camada de regras e não são reimplementados visualmente.

# Fábrica e recebimentos

## Objetivo

Acompanhar recebimentos de baldes, pagamentos parciais, saldo e conclusão com tolerância monetária de R$ 0,01.

## Fluxo

1. Abrir Fábrica a partir de Finanças.
2. Ver lista de recebimentos e saldo restante.
3. Abrir detalhe para histórico e parcelas.
4. Adicionar pagamento.
5. Bloquear valor maior que o saldo restante; aceitar valor igual dentro da tolerância.
6. Concluir automaticamente quando quitado.
7. Editar/remover pagamento e recalcular estado pela camada financeira.

## Padrões

- `FactoryOverview` e `FactoryDetails` em stack.
- Adicionar parcela em Bottom Sheet com formulário curto.
- Edição completa em stack.
- Confirmation Dialog para remover pagamento, excluir recebimento ou reabrir.
- Context menu para ações secundárias; swipe não deve excluir sem confirmação.
- Pull to Refresh, Skeleton, barra de progresso e EmptyState.
- Feedback tátil leve em confirmação e conclusão, respeitando configuração do aparelho.

# Backup

## Objetivo

Importar e exportar dados com segurança, transparência e compatibilidade legada.

## Fluxo de exportação

1. Abrir Backup em Configurações/Mais.
2. Solicitar exportação.
3. Mostrar data e quantidade de registros.
4. Gerar arquivo JSON compatível.
5. Abrir Share Sheet no iOS ou fallback equivalente.

## Fluxo de importação

1. Selecionar arquivo.
2. Validar JSON e estrutura.
3. Mostrar prévia e contagem.
4. Criar backup preventivo dos dados atuais.
5. Pedir confirmação.
6. Importar sem sobrescrever silenciosamente dados válidos.
7. Verificar integridade.
8. Mostrar relatório de sucesso, avisos e falhas.

Prévia e relatório são stacks em tela completa. Escolha de arquivo pode iniciar por modal/Bottom Sheet. A confirmação é um Confirmation Dialog. Skeleton não é necessário para o arquivo local, mas Loading e progresso são obrigatórios durante validação/importação.

# Notificações

## Objetivo

Permitir nova entrega e lembretes de cobrança sem transformar notificações em uma segunda caixa de entrada.

## Fluxo

1. Configurações mostra estado da permissão e do token.
2. A pessoa concede ou recusa a permissão conscientemente.
3. O app registra/atualiza o token por serviço.
4. Tocar em nova entrega abre Registrar ou o detalhe apropriado.
5. Tocar em lembrete de cobrança abre o cliente/pagamento relacionado.

Configuração e diagnóstico usam stack. A solicitação de permissão pode ser modal do sistema. Deep links aguardam autenticação e restauram a rota correta. Foreground, background e aplicativo fechado são comportamentos nativos a validar; não são simulados com uma tela inventada.

# Configurações, conta e Mais

## Objetivo

Concentrar preferências e tarefas administrativas sem competir com a operação.

## O que aparece primeiro

1. Tema: system, light ou dark.
2. Ocultar/mostrar valores financeiros.
3. Notificações.
4. Backup.
5. Conta e logout.

## Telas e padrões

- `Settings`: stack com seções agrupadas.
- `NotificationSettings`: stack.
- `Backup`: stack.
- `Account`: stack.
- Logout: Confirmation Dialog.
- Explicações curtas de preferências: Bottom Sheet quando necessário.

Não há FAB, swipe ou Search em Configurações. Switches e seletores devem ter feedback imediato, persistir localmente e respeitar acessibilidade.

# Autenticação

## Objetivo

Entrar rapidamente, com mensagens claras e persistência segura da sessão.

## Experiência

- Tela de login em stack isolada e tela completa.
- Inputs com teclado adequado, foco previsível, botão de limpar quando aplicável e erro junto ao campo.
- Login e-mail/senha com loading no botão.
- Google com estratégia compatível com a plataforma; no Web, tratar popup bloqueado, cancelamento e conexão.
- Logout exige confirmação.
- Durante a restauração da sessão, mostrar loading sem redirecionar prematuramente.

Não exibir ou registrar tokens. O usuário autenticado é identificado pelo UID retornado pelo Firebase; não mesclar contas automaticamente.

# Regras de navegação e retorno

1. Tocar uma tab preserva a posição e o estado da própria tab quando isso for apropriado.
2. O botão voltar retorna da tela de detalhe para a lista e fecha overlays antes de sair da área.
3. O gesto de voltar do iOS deve funcionar nas stacks, sem ser substituído por um botão visual isolado.
4. Formulários com alterações não salvas exibem confirmação antes de descartar.
5. Bottom Sheets fecham por gesto, botão cancelar ou ação concluída; a altura deve acompanhar o conteúdo.
6. Modais não devem abrir outro modal sem uma razão clara; quando a tarefa crescer, deve virar stack.
7. Deep links de notificações e compartilhamento devem abrir o registro correspondente depois da sessão estar pronta.
8. Ao retornar de um detalhe, o resumo/lista deve atualizar por invalidação ou revalidação, sem perder filtros.

# Linguagem visual e comportamento

## Hierarquia

Usar títulos de sistema, Large Title apenas nas raízes que se beneficiam de contexto, números financeiros como foco da seção e labels auxiliares curtos. O espaço em branco deve separar decisões, não apenas preencher a tela.

## Cards e listas

Cards financeiros e operacionais devem ter uma função clara. Listas devem favorecer leitura rápida, com status e valor em posições estáveis. Ações secundárias ficam em swipe/context menu para evitar excesso de botões.

## Glass e superfícies

Materiais translúcidos ficam restritos ao shell, navegação, overlays e controles flutuantes. Conteúdo financeiro e listas usam superfícies sólidas e contraste estável. No Web, Android e iOS incompatível, há fallback de blur ou superfície sólida sem depender de Liquid Glass nativo.

## Feedback

- Haptic leve: seleção, confirmação de pagamento, entrega marcada e conclusão de operação.
- Toast: resultado breve de salvar, atualizar, copiar ou exportar.
- InlineError: erro do campo.
- ErrorState: falha da área inteira.
- ConfirmationDialog: destruição, logout, importação e gravação irreversível.

## Acessibilidade

- Área mínima de toque de 44 pt.
- Labels e hints para ações com ícone.
- Status não depende somente de cor.
- Textos e valores respeitam escala de fonte.
- Foco segue a ordem de leitura após modal, erro e troca de estado.
- Valores ocultos mantêm a semântica acessível adequada, sem revelar o número visualmente.

# Ordem recomendada para desenhar a experiência

Esta é uma ordem de definição de experiência, não uma autorização de implementação:

1. Estados de autenticação e shell principal.
2. Registrar e detalhe/nova entrega.
3. Dashboard e atalhos de operação.
4. Finanças, período, custos e fábrica.
5. Histórico e edição em lote.
6. Clientes, aliases e preços.
7. Rota, mapa e correção de endereço.
8. Backup, notificações e configurações.
9. Revisão transversal de acessibilidade, privacidade, offline e deep links.

# Pontos que precisam de aprovação antes de implementar telas

1. Confirmar definitivamente o shell de quatro tabs — Dashboard, Finanças, Registrar e Histórico — como experiência principal, mantendo Clientes e Configurações em módulos secundários.
2. Confirmar se Fábrica será acessada exclusivamente por Finanças ou também por um atalho no Dashboard.
3. Confirmar se “Registrar” será o nome final da tab ou se “Entregas” deve aparecer como label público, mantendo a mesma função operacional.
4. Confirmar a prioridade do fluxo de rota na tela Registrar: FAB secundário, atalho superior ou card de resumo.
5. Confirmar se a busca global será apenas contextual por módulo ou se haverá uma busca unificada futura.
6. Confirmar quais indicadores do Dashboard devem abrir registros imediatamente e quais devem abrir apenas uma explicação.
7. Confirmar o comportamento visual de dados offline e da revalidação em segundo plano.

## Resultado esperado

O aplicativo deve parecer uma ferramenta operacional nativa de iPhone: focada, previsível, confortável para uso repetido e capaz de levar cada número até os registros que o explicam. A experiência não deve ser uma cópia da SPA, uma grade de cards genéricos ou uma coleção de telas isoladas. Deve ser uma sequência clara de decisões: entender, registrar, revisar, quitar, analisar e agir.
