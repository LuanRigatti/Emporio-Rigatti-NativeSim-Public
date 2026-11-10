# Estado atual do projeto

# Snapshot operacional atual

Este é o primeiro bloco a ser consultado por qualquer nova conversa ou agente
de IA. Ele representa o estado operacional deste checkout; as seções posteriores
preservam o histórico técnico e as decisões acumuladas.

## Branches e checkouts oficiais

O projeto possui cinco branches oficiais, cada uma com seu checkout local:

- `Codex` — `C:\Projetos\emporiorigatti-Codex`
- `ajustes-codex` — `C:\Projetos\PAReact-App-Codex\Emporio-Rigatti-App-Codex`
- `Antigravity` — `C:\Projetos\emporiorigatti-Antigravity`
- `opencode` — `C:\Projetos\emporiorigatti-opencode`
- `main` — `C:\Projetos\emporiorigatti-main`

`Codex` foi criada a partir do commit `8c5092e`; a tag `sdk57-pre-sdk58`
preserva o baseline anterior à migração. As versões atuais verificadas em
`package.json` são Expo SDK 58 (`expo ~58.0.23`), React `19.3.0`, React Native
`0.88.1`, Expo Router `~58.0.30`, `@expo/ui ~58.0.27` e `expo-widgets
~58.0.27`. Confirme o HEAD e o estado do working tree diretamente no Git; este
documento não fixa o SHA atual.

## Estado operacional atual (consolidado em 2026-11-09)

- O usuário informou que o cache de apresentação v2 foi validado no iPhone e
  publicado. Ele restaura em conjunto os seis cards e comparações, enquanto as
  consultas remotas existentes continuam revalidando os dados. AsyncStorage não
  é criptografado; o registro contém somente agregados e comparações exibidos.
- A Etapa 2.2.13 remove os eventos `[STAGE2_BASELINE]`, spans e contadores
  temporários de telas, hooks e datasources. As seções históricas abaixo mantêm
  os resultados e evidências coletados antes da remoção, não a instrumentação
  ativa do checkout atual.
- Permanecem os listeners de transição, foco, estado e gesto usados pelo ciclo
  funcional das intenções pendentes de navegação. Eles continuam protegendo a
  navegação e não emitem logs de baseline.
- A atualização do Expo SDK 58 foi consolidada na Etapa 2.3.3. Em 2026-11-09,
  `package.json` e a instalação foram conferidos: Expo `~58.0.23`, React
  `19.3.0`, React Native `0.88.1`, Expo Router `~58.0.30`, `@expo/ui ~58.0.27`
  e `expo-widgets ~58.0.27`. `npm ls --depth=0`, `npx expo install --check` e
  `npx expo-doctor` (20/20) passaram. A documentação oficial consultada
  apresentava o SDK 58 como a versão estável atual; a compatibilidade do SDK
  não significa que cada dependência de terceiros seja a versão mais recente.
  Nenhuma atualização de dependências foi feita nesta revisão documental.
- A auditoria npm registrada nas Etapas 2.3.2–2.3.3 é de 2026-11-07 e aponta
  40 avisos (1 crítico); não foi reexecutada em 2026-11-09. A validação física
  nativa continua pendente até haver Mac e assinatura Apple Developer. O fluxo
  financeiro, o cache v2, cálculos, consultas, animações, navegação e layout
  permanecem conforme as seções operacionais abaixo.

## Etapa 2.3.1 — atualização de dependências Expo SDK 58 (2026-11-07)

- Atualizada a matriz aprovada de 30 dependências Expo/React Native para o SDK
  58.0.23, incluindo React Native `0.88.1`, Expo Router `~58.0.30`,
  `@expo/ui ~58.0.27` e `expo-widgets ~58.0.27`. `jest-expo` foi alinhado a
  `~58.0.14`; o peer `@react-native/jest-preset` foi atualizado adicionalmente
  de `0.88.0` para `0.88.1`, pois a versão nova do `jest-expo` exige `^0.88.1`.
- Cinco módulos que já estavam resolvendo para a versão recomendada passaram a
  declarar esses mínimos no manifesto: `@expo/metro-runtime ~58.0.17`,
  `expo-constants ~58.0.15`, `expo-file-system ~58.0.13`, `expo-font ~58.0.11`
  e `expo-widgets ~58.0.27`.
- O `postinstall` havia falhado porque `@expo/ui` 58.0.27 renomeou o conteúdo da
  closure de sheet para `presentedContent`. O localizador de
  `scripts/patch-expo-ui-bottom-sheet.js` agora aceita os nomes anterior e
  atual, preservando o mesmo `.ignoresSafeArea(.container, edges: .bottom)`.
  Os plugins CNG continuam aplicando as mesmas transformações; seus guardas de
  versão e o teste de template foram alinhados a `expo-widgets 58.0.27` após
  verificar que os templates Swift e a ordem das transformações continuam
  compatíveis.
- `npx expo install --check`, `npx expo-doctor` (20/20), `npm ls --depth=0`,
  TypeScript, ESLint direcionado e `git diff --check` passaram. Os testes
  direcionados de widgets e Live Activities passaram: 12 suítes e 90 testes.
  A seleção ampliada passou 27 de 30 suítes (261 de 272 testes); dez falhas
  correspondem às duas dívidas de mocks já documentadas na validação anterior.
  Uma falha adicional em `RegistrarDailyDataSheetPresentation.test.ts` compara
  texto LF com dois arquivos CRLF que estão byte-equivalentes ao HEAD; não houve
  alteração neles nesta atualização.
- A instalação reportou 40 entradas de pacotes vulneráveis no npm audit (1
  crítica) e avisou que quatro scripts de instalação transitivos não estavam
  na allow-list local. A triagem da Etapa 2.3.2 confirmou que o aviso crítico
  `shell-quote` está no grafo do React Native/DevTools, mas o consumidor
  instalado não referencia a API vulnerável; os demais alertas concentram-se
  em ferramentas, CNG e caminhos Node que não fazem parte do bundle Firestore
  React Native. Nenhuma correção automática ou aprovação de scripts foi feita;
  os advisories continuam registrados para uma correção de dependências
  avaliada separadamente.
- Uma nova iOS Development Build será necessária antes da validação física:
  houve atualização de React Native, Expo Modules, `@expo/ui`, widgets e
  dependências Swift/Hermes. Nenhum build ou prebuild foi executado nesta etapa.
  A revisão automatizada não substitui a verificação no iPhone de Bottom Sheets,
  NativeTabs, widgets, Live Activities, Login Google e animações SwiftUI.

## Etapa 2.3.2 — triagem de segurança e preparação iOS (2026-11-07)

- `npm audit` reportou 40 entradas de pacotes vulneráveis: 1 crítica, 8 altas,
  30 moderadas e 1 baixa. `npm audit --omit=dev` reportou 13 entradas no grafo
  sem dependências de desenvolvimento: 1 crítica, 7 altas e 5 moderadas. São
  entradas afetadas do grafo npm, não 40 CVEs distintos nem prova de que todos
  os pacotes sejam incluídos no IPA.
- `shell-quote@1.10.0` chega por `react-devtools-core@6.1.5` →
  `react-native@0.88.1`. O advisory GHSA-pqg4-j6r4-53mv afeta `quote()` quando
  um token de comentário é seguido por uma string controlada por atacante com
  quebra de linha e o resultado é enviado a um shell. A busca no pacote
  instalado encontrou só a declaração no `package.json`, sem chamada à API
  vulnerável. O alerta crítico permanece no grafo; não foi corrigido nesta
  etapa.
- Os alertas de `@grpc/grpc-js` descrevem configuração de servidor mTLS; a
  entrada React Native do Firestore não referencia gRPC, e o app importa
  `firebase/firestore` modular, sem uso de `firebase/compat`. Os alertas de
  `@xmldom/xmldom`, `glob`, `minimatch`, `brace-expansion` e `js-yaml` estão
  ligados a parsing/XML ou padrões de ferramentas e configuração, não a
  operações financeiras do app. Os alertas adicionais exclusivamente de
  desenvolvimento incluem Jest, ESLint/typescript-eslint, `zod` e `deepmerge`.
- Os quatro scripts transitivos foram inspecionados e não foram aprovados nem
  executados: `@firebase/util` gera configuração Firebase opcional a partir de
  `FIREBASE_WEBAPP_CONFIG` e pode consultar a API de configuração Web se essa
  variável contiver um projeto não demo; `@parcel/watcher` só compila de source
  com `npm_config_build_from_source=true`; `protobufjs` verifica compatibilidade
  de versão do consumidor; `unrs-resolver` prepara o binding N-API opcional da
  plataforma. O lockfile contém bindings Darwin opcionais para o build Mac; os
  outros scripts não são necessários para o CNG do app nas condições
  observadas. O `.npmrc` do projeto não existe e nenhuma allow-list foi
  alterada.
- `npx expo install --check` passou. A validação anterior da Etapa 2.3.1
  registra Expo Doctor 20/20; nesta etapa, TypeScript e duas suítes sintéticas
  de plugins CNG passaram (12 testes). ESLint direcionado sinalizou apenas
  `__dirname` como `no-undef` no script CommonJS de patch; essa referência já
  existia no HEAD. O audit npm continua com advisories não corrigidos.
- O perfil `development` em `eas.json` usa `developmentClient: true` e
  `distribution: internal`, adequado à Development Build física. O checkout
  usa CNG e não contém `ios/`; o EAS Build gerará o projeto nativo a partir de
  `app.config.js` e dos plugins. `expo-widgets@58.0.27` coincide com a versão
  recomendada na documentação do SDK 58; os plugins próprios verificam essa
  versão e o patch de `@expo/ui@58.0.27` tem testes sintéticos aprovados.
  Nenhum prebuild ou build foi iniciado nesta etapa.
- O SDK 58 requer iOS 16.4+ e Xcode 26.4+; o perfil não fixa imagem iOS, então
  o EAS escolhe automaticamente uma imagem compatível com SDK/RN. A próxima
  validação física deve usar o perfil `development`, confirmar dispositivo e
  credenciais Apple no EAS e verificar o destino Firebase antes de testar
  operações que gravem dados. A configuração padrão aponta para
  `GoogleService-Info.plist`; seu conteúdo não foi aberto nesta triagem.

## Etapa 2.3.3 — consolidação Expo SDK 58 (2026-11-07)

- O manifesto e o lockfile contêm as 30 atualizações aprovadas para Expo SDK
  58.0.23; `@react-native/jest-preset` foi adicionalmente alinhado a `0.88.1`
  por exigência do `jest-expo`. React `19.3.0`, Firebase `12.16.0`, navegação,
  código funcional e cache financeiro v2 não foram alterados nesta atualização.
- `npx expo install --check`, `npx expo-doctor` (20/20), `npm ls --depth=0`,
  TypeScript e `git diff --check` passaram. As 12 suítes direcionadas de CNG,
  widgets e Live Activities passaram: 94 testes. A suíte
  `FirestoreDeliveryLiveActivitySnapshots.test.ts` permanece com 7 de 8 casos
  falhando: os mocks omitem `metadata.hasPendingWrites`, necessário para o
  datasource classificar a consulta como completa; esse problema já está
  documentado e não foi alterado nesta etapa. ESLint direto ainda relata
  `__dirname` como `no-undef` no script CommonJS, embora a linha já existisse
  no HEAD; a verificação dirigida passou ao declarar o global Node `__dirname`.
- Permanecem os 40 alertas npm (1 crítico), conforme triagem da Etapa 2.3.2.
  Não foram executados `npm audit fix`, overrides ou atualizações adicionais.
- O desenvolvimento continua no Windows para alterações JS/TS e validações
  locais. Nenhum build, prebuild ou deploy iOS foi executado. O usuário ainda
  não possui Mac nem assinatura Apple Developer; a Development Build será
  iniciada quando houver acesso ao Mac e aos requisitos de assinatura. Ela
  será necessária antes da validação nativa completa no iPhone. Até lá, o
  projeto está pronto para continuar o desenvolvimento normal no Windows.

## Etapa 2.3.4 — pagamento nos cards do Histórico Atacado (2026-11-07)

- O documento canônico continua sendo `users/{uid}/deliveries/{deliveryId}`.
  `totalValue` continua sendo o valor da entrega, `date` continua sendo a data
  original da entrega e `paymentMethod` mantém o método real (`Pix` ou
  `Dinheiro`) quando conhecido. O novo campo opcional `paymentDate` guarda a
  data efetiva do recebimento em `YYYY-MM-DD`; no domínio ele é exposto como
  `dataPagamento` e trafega também pelos caches existentes de Delivery. Uma
  futura Finanças poderá ler esses campos no mesmo documento e agrupar por
  `paymentDate` e `paymentMethod`, usando `totalValue` como valor recebido.
- Os registros antigos sem método/data permanecem sem esses campos. O Histórico
  os identifica como “Não informado”; corrigir o método não inventa a data. A
  implementação em lote registra a data, mas não infere método; essa alteração
  de Cloud Function ainda precisa ser implantada para valer no ambiente remoto.
  Sua confirmação informa que o método pode ser completado pelo Histórico. Não
  há coleção de pagamentos redundante nem alteração em cálculos, lucro, Retail
  ou relatórios.
- O Histórico usa `@expo/ui/swift-ui` BottomSheet com `fitToContents`, Picker
  segmentado e ConfirmationDialog. O material de apresentação permanece o
  material nativo do sistema (Liquid Glass no iOS 26), sem fundo RN simulado.
- `npm run typecheck`, ESLint direcionado, 62 testes em quatro suítes de Jest,
  o teste direcionado de `DeliveryServices`, os 13 testes da Cloud Function e
  `git diff --check` passaram. A suíte completa de `DeliveryServices` ainda tem
  uma falha preexistente de expectativa de ordenação de boleto: espera
  `legacy-open` antes de `custom-boleto-open`, enquanto o sort atual ordena pelo
  nome do cliente. O teste e o serviço de ordenação não foram alterados nesta
  etapa. ESLint foi executado com a regra Prettier desabilitada devido às
  terminações CRLF presentes em arquivos rastreados; os arquivos LF revisados
  também passaram no Prettier.
- A verificação visual em iPhone permanece pendente. A Development Build já é
  necessária por causa da atualização SDK 58 descrita acima; esta mudança não
  adiciona módulos nativos nem altera plugins. A mudança local da Cloud
  Function ainda não foi implantada. Nenhum build, prebuild ou deploy foi
  iniciado.

## Etapa 2.2.8 — validação do pacote local (2026-11-06)

- A revisão comparou os 11 arquivos locais das Etapas 2.2.4–2.2.7 com o
  HEAD `5a8205c44645aaa6f7fd10d261abe4b0c68e3078` da branch `Codex`.
  A Etapa 2.2.8 acrescentou este registro e dois ajustes somente na
  instrumentação existente de Finanças. As revisões sobre a abertura fria e a
  carga paginada do Histórico continuam documentadas nas etapas abaixo.
- Os mesmos dez casos falharam com as mesmas mensagens no checkout atual e em
  uma exportação isolada do HEAD, usando as mesmas dependências. Os três casos
  de `HistoryBucketTotal.test.ts` falham porque o mock de providers omite
  `useAuth`. Sete casos de `FirestoreDeliveryLiveActivitySnapshots.test.ts`
  dependem de uma data completa, mas o mock de query omite `hasPendingWrites` e
  o datasource exige o valor explícito `false`. Um caso dessa suíte passou em
  ambos os ambientes. As falhas já existiam no HEAD e os mocks foram preservados.
- Em Finanças Atacado, somente o recorte mensal recebe a prévia confirmada.
  Ela exige entregas com proveniência exata, cobertura completa, origem remota
  e ausência de escritas pendentes. O hook também valida usuário, sessão,
  requisição e gerações de carga e invalidação. Sem resumo visível, a tela pode
  mostrar o Faturamento com a fórmula existente enquanto as demais leituras
  prosseguem. Um mês confirmado sem entregas pode mostrar zero. Quando existe
  resumo visível, seu Faturamento tem precedência. O Lucro Líquido atual exige
  snapshot estável, cobertura remota, rotas e combustível. O preview por si só
  não habilita gráficos nem publica o widget.
- Os eventos `[STAGE2_BASELINE]` são emitidos somente em `__DEV__` e registram
  identificadores de diagnóstico, estados, contagens e dimensões. Os callbacks
  de `View.onLayout` e `ScrollView.onContentSizeChange` agora também só são
  passados à tela em desenvolvimento; o listener do ScrollView deixa de ser
  instalado em release. A assinatura da geração diagnóstica usa o período
  selecionado e a chave da requisição, que já inclui UID, sessão, consulta e
  filtros. Ela não inclui mais `snapshotSessionScopeKey`, que era inicialmente
  indefinida e mudava quando chegava o primeiro snapshot, reiniciando a medição
  da prévia confirmada. Isso corrigia a métrica, sem alterar o estado ou os
  cálculos financeiros. A confirmação visual continua exigindo vídeo e eventos
  de prontidão; callbacks de layout não confirmam o primeiro frame físico.
- TypeScript, `git diff --check` e três suítes financeiras/performance
  direcionadas passaram após os ajustes diagnósticos (48 testes). Dez outras
  suítes direcionadas passaram, com 331 testes sintéticos. O ESLint dos dez
  arquivos alterados passou com a regra Prettier desativada; na execução estrita,
  oito passaram e os dois restantes (`HomeSearchDataSource.ts` e
  `ResumoFinanceiroSnapshotCoordinator.ts`) apresentaram somente diferenças de
  CRLF. As duas ocorrências `import/namespace` em `NotificationService.ts` foram
  reproduzidas também no HEAD isolado.
- A coleta física ainda está pendente. O pacote local usa somente TS, TSX e
  Markdown e pode ser testado com a Development Build instalada via Fast
  Refresh. Esta revisão usou dados sintéticos e não acessou Firebase de
  produção ou Emulator.

## Etapa 2.2.9A — auditoria de cache financeiro persistente (2026-11-06)

- Auditoria e proposta somente; nenhum código funcional, cache, Firebase,
  teste, build ou publicação foi alterado/executado nesta etapa.
- O cache mensal v1 persiste snapshots amplos e `cachedAt`, mas não persiste a
  prova remota por consulta. `sessionVersion` e `requestScopeKey` ficam apenas
  em memória; ao hidratar uma entrada do AsyncStorage, essa associação é
  removida. `useFinancialData` usa `exact_session_memory_only` para a entrada
  inicial, então uma entrada mensal persistida não é elegível após reiniciar o
  processo. Cache de Home, widgets, histórico, custos ou ledger não substitui
  essa prova nem pode ser promovido a confirmação financeira.
- A cobertura remota mensal atual confirma somente as consultas de entregas e
  custos. O Lucro Líquido também depende do ledger de rotas, combustível,
  Cost Settings e Car Settings. O loader do ledger retorna resumos sem contrato
  de cobertura/proveniência e pode reconciliar pendências com escrita remota;
  a prontidão hidratada das configurações pode incluir cache local. Portanto,
  o estado atual não prova que um painel completo possa ser persistido como
  confirmado. A confirmação atual é por consulta; não é um snapshot atômico
  entre coleções.
- Proposta para a Etapa 2.2.9B: criar namespace e envelope independentes do v1,
  inicialmente em modo sombra ou limitado ao Faturamento se a cobertura exata
  dos seus dados for suficiente. O envelope deve vincular ambiente/projeto,
  UID, seleção, período civil, filtros/limites, versões de schema e regras,
  métricas derivadas, cobertura e proveniência por dependência, ausência de
  dados vindos do cache (`fromCache === false`), ausência de escritas pendentes
  (`hasPendingWrites === false`) e horários de confirmação por consulta.
  Não hidratar esse registro em `remoteComplete`, snapshots autoritativos,
  gráficos ou widgets; apresentá-lo somente como último valor confirmado
  anteriormente enquanto ocorre revalidação. Expandir ao painel completo
  somente depois de contratos verificáveis para ledger e combustível.
- Persistência futura deve usar um único envelope versionado, validação estrita
  e serialização de leitura/escrita/invalidação por identidade e geração; dado
  inválido ou incompatível vira cache miss. Invalidações precisam cobrir os
  intervalos comparativos e mudanças de configurações globais. AsyncStorage é
  armazenamento local não criptografado; a política de retenção/logout e a
  proteção em repouso precisam ser decididas antes de expor valores financeiros
  persistidos. As operações de escrita e invalidação v1 não têm serialização
  persistente por chave, então a nova camada deve impedir que uma resposta antiga
  restaure um envelope após uma invalidação. Firebase continua sendo a fonte
  remota de verdade.

## Etapa 2.2.9B — cache dos indicadores bloqueado por proveniência (2026-11-06)

- Não foi implementado cache, flag, teste funcional ou alteração de UI nesta
  etapa. O Faturamento poderia ser derivado de entregas confirmadas, mas o
  requisito é restaurar Faturamento e Lucro Líquido juntos, sem misturar fontes;
  a fatia parcial de Faturamento foi deliberadamente descartada.
- `isNetProfitReady` usa `routesLoaded` e `fuelCostsReady` além da cobertura
  remota de entregas/custos. `routesLoaded` também pode vir de memória/cache;
  `fuelCostsReady` representa hidratação, não confirmação remota. O hook de
  combustível aceita configurações iniciais em cache e não expõe proveniência
  dos valores efetivamente calculados. Cost Settings pode mesclar alterações
  locais ao resultado remoto; Car Settings pode expor campos editados/drafts.
- O loader do ledger retorna somente resumos, não cobertura/proveniência
  estruturada. Ele pode ignorar documentos remotos inválidos, engolir falha de
  reconciliação de pendências e então produzir a lista sem esses pendentes.
  Essa saída não pode ser usada como prova de Lucro Líquido completo.
- Não há armazenamento genérico criptografado reutilizável no app: o manifesto
  declara AsyncStorage 2.2.0, que não criptografa os dados. O Keychain encontrado
  no plugin nativo serve a fluxos específicos de widget e não expõe contrato
  reutilizável para Finanças. Assim, qualquer protótipo que persista valores
  reais fica restrito a testes isolados com armazenamento falso até aprovação de
  política de proteção local ou adoção de um mecanismo seguro apropriado.
- Menor pré-requisito para retomar: os loaders de rotas, Cost Settings e Car
  Settings devem expor confirmação do servidor, cobertura/escopo exatos e estado
  de escritas/drafts para os valores realmente usados; pendências ou documentos
  inválidos devem impedir a classificação como completo. Depois, uma única
  geração de cálculo poderá persistir um envelope pareado de Faturamento, Lucro
  Líquido e comparações, separado de `remoteComplete`, sob identidade de
  ambiente/UID/período/filtros/regras. A política de armazenamento, logout e
  retenção precisa ser aprovada antes de habilitar dados reais.
- Sem mudanças funcionais para testar: TypeScript, ESLint e testes não foram
  executados nesta decisão de bloqueio. `git diff --check` foi executado e
  passou; não houve acesso ao Firebase, Emulator, build, commit ou push.

## Situação atual — Etapa 2.2.4B (2026-11-06)

- Os loaders mensais de custos e entregas expõem a resposta exata da consulta e
  sua proveniência (`uid`, `sessionVersion`, escopo/filtros, `fromCache`,
  `hasPendingWrites`, origem, cobertura e confirmação remota). Os métodos
  legados continuam disponíveis para os consumidores atuais.
- Finanças só classifica custos e entregas como completos quando ambas as
  consultas correspondem ao usuário, sessão e filtros pedidos, cobrem o escopo
  completo, vieram sem cache e não têm escritas pendentes. Respostas fora de
  ordem ou com identidade divergente não são publicadas como resultado atual.
- Resultados locais/em cache são provisórios e não renovam o cache financeiro.
  Uma consulta vazia só pode produzir indicadores zerados quando sua cobertura
  exata foi confirmada. O cache persistido v1 continua sem proveniência,
  cobertura, sessão ou filtros. `useFinancialData` só reutiliza entradas de
  memória associadas à sessão e consulta exatas da execução atual; entradas v1
  hidratadas do AsyncStorage não são tratadas como dados da sessão atual. O
  formato persistido permanece inalterado; cache v2 depende de contrato de
  identidade, validade e cobertura. Consumidores legados do cache v1 fora desse
  hook ainda exigem auditoria específica antes de uma migração de cache.
- Fórmulas, schema Firestore, ledger de rotas, combustível, operações de escrita
  e formato persistido atual não foram alterados. A confirmação é específica às
  consultas observadas e não representa uma barreira global contra escritas
  pendentes fora do escopo consultado. Custos e entregas são consultas
  independentes: `remoteComplete` confirma cada resposta exata, mas não prova
  que ambas observaram uma única transação/snapshot global.
- Validação sintética local: TypeScript, ESLint direcionado e
  `git diff --check` passaram; 6 suítes direcionadas passaram (130 testes),
  usando apenas mocks/dados sintéticos. Nenhum Firebase de produção ou Emulator
  foi acessado. Não houve medição física de desempenho no iPhone. Alterações
  somente TS/TSX/Markdown; Fast Refresh basta, sem nova Development Build.

## Etapa 2.2.7 — avaliação do adiamento da carga paginada do Histórico Atacado (2026-11-06)

- A rota `historico/index` renderiza `HistoryScreen` no modo Atacado.
  `useDeliveries` agenda uma carga com `setTimeout(..., 0)` na montagem. O
  escopo `historical` chama `loadAllHistorical` com `revalidate: true`.
  O foco chama `reload` e pode se juntar à mesma requisição em andamento.
  O datasource usa `getDocs` em páginas de 250 e publica os resultados no
  estado compartilhado de entregas.
- **Experimento bloqueado pelo acoplamento do estado compartilhado.** O
  carregamento pode mesclar registros do cache. Uma resposta remota completa
  substitui `records` e publica uma revisão. Os hooks da Home assinam essa
  revisão e leem o mesmo mapa para entregas do dia, documentos e pagamentos
  em aberto. A Busca da Home pode consultar o histórico por conta própria e
  também recorrer ao mapa em caso de falha. Adiar a publicação pode mudar os
  dados visíveis ou a ordem de atualização antes da primeira visita ao Histórico.
- Finanças Atacado no recorte mensal confirma a resposta exata de
  `loadWithMetadata` e pode iniciar a própria leitura sem esperar pelo
  Histórico. No recorte `Tudo`, `useFinancialData` chama
  `loadAllHistoricalWithMetadata` com `revalidate: true`. O datasource usa a
  mesma chave de deduplicação do Histórico para a mesma sessão e o mesmo modo
  de revalidação. Adiar uma das chamadas muda a possibilidade de reutilizar a
  requisição em andamento e o momento de sua conclusão.
- Uma consulta filtrada registra `historicalApplyVersion` quando começa. Se
  o histórico completo foi aplicado enquanto ela estava em andamento, a
  consulta preserva os registros do histórico. Essa precedência também afeta
  a publicação ou invalidação do snapshot diário confirmado que o widget de
  entregas e a Live Activity consomem. O widget financeiro tem hidratação
  própria de resumos persistidos e as notificações usam o serviço Expo e o
  repositório de tokens. Nenhum desses dois fluxos chama diretamente a carga
  paginada auditada.
- O isolamento exigido não pode ser demonstrado com um gate no consumidor.
  Nenhuma flag, mudança de execução ou evento foi adicionado. A instrumentação
  existente `[STAGE2_BASELINE]` permite correlacionar `screen_mount`,
  `screen_focus`, `delivery_hook_load`, `firestore_delivery_history_page_read`
  e os marcos de consulta, prontidão e layout de Finanças. Ela não atribui cada
  página a um único consumidor quando há compartilhamento e não mede leituras
  faturadas nem ganho no iPhone.
- Um A/B do adiamento fica condicionado ao isolamento dessa carga. Em um
  ambiente isolado com dados sintéticos, usar a mesma Development Build,
  dispositivo, rede, recorte, estado inicial de cache e ordem de navegação.
  Alternar pelo menos três cold starts por variante. Abrir Finanças pela Home
  sem visitar Histórico, depois abrir Histórico e incluir uma verificação de
  abertura direta. Comparar páginas efetivamente iniciadas antes de Finanças,
  seleção JS até consultas e prontidão por indicador, callback de layout,
  primeiro frame visível e tempo da primeira abertura do Histórico. Reportar
  mediana e intervalo mínimo–máximo por variante. Com o código atual, a
  coleta é somente de controle. A atualização documental dispensa Fast
  Refresh e nova Development Build.
- TypeScript e `git diff --check` passaram. Em dez suítes direcionadas com
  mocks, 291 testes passaram e 10 falharam em dois arquivos sem alteração.
  `HistoryBucketTotal` não fornece `useAuth` no mock. Os snapshots simulados
  em `FirestoreDeliveryLiveActivitySnapshots` omitem `hasPendingWrites`,
  necessário para confirmar uma data. O ESLint estrito passou no datasource,
  na Home, no hook financeiro e na instrumentação. A rota e a tela do
  Histórico, o hook de entregas e o coordenador do widget passaram sem a
  regra Prettier, que apontou CRLF e formatação preexistente. O lint do
  serviço de notificações também apontou duas referências `import/namespace`
  preexistentes. A validação local usou dados sintéticos e não envolveu
  Firebase de produção, Emulator, build ou teste no iPhone.

## Etapa 2.2.6 — comparação de abertura fria de Finanças Atacado (2026-11-06)

Medições fornecidas pelo usuário no iPhone. A abriu Finanças assim que a
Home apareceu no cold start. B também partiu de um cold start e aguardou
8 s na Home antes de selecionar Finanças.

| Marco | A — entrada imediata | B — após 8 s na Home |
| --- | ---: | ---: |
| Seleção recebida no JS → callback de layout | 4,70 s | 0,51 s |
| Duração da leitura de custos diários | 3,40 s | 276 ms |
| Duração da leitura de custos mensais | 4,36 s | 275 ms |
| Duração da leitura de entregas | 4,32 s | 249 ms |
| Seleção recebida no JS → início da leitura do ledger | ~2,67 s | ~129 ms |
| Duração da leitura do ledger | 1,85 s | 320 ms |
| Espera percebida ao abrir Finanças | ~8 s | ~1 s |

- As leituras reportaram `fromCache: false` em A e B. Os spans registram
  a espera entre a chamada do SDK e a resposta ao JavaScript. Eles não
  separam fila do SDK, token, conexão, processamento remoto e despacho da
  resposta. O callback de layout também não mede o primeiro frame físico.
- A sessão do app é resolvida antes da Home. O SplashGate aguarda o estado
  da sessão e a hidratação local do bootstrap, que inclui o cache de rotas.
  O Firestore usa uma instância compartilhada, inicializada sob demanda.
  Sessão autenticada na UI e disponibilidade do transporte Firestore são
  marcos distintos. As amostras não medem a duração do token ou da conexão.
- Ao receber foco, Finanças dispara base local, entregas e custos do período
  em paralelo. O `useFocusEffect` inicia o fluxo de rotas separadamente. O
  ledger aguarda primeiro os registros em memória ou AsyncStorage e depois
  os resumos pendentes em AsyncStorage, com validação de sessão entre as
  duas etapas. Só então chama `getDocsFromServer`. A fila nativa iOS do
  AsyncStorage é serial. A medição de seleção até o início da consulta
  agrega foco, execução JS e essas esperas locais. Ela não distribui os
  ~2,67 s entre essas etapas. Após a leitura, o ledger ainda pode persistir
  o cache e reconciliar pendências por transação. O blur impede atualizar o
  estado da tela, mas o fluxo do serviço pode continuar na mesma sessão.
- Home inicia suas consultas de entregas, clientes, notas, pagamentos e
  compras de fábrica ao montar. A NativeTabs instalada permite montar abas
  fora de foco. O Histórico Atacado pode ler o cache e revalidar todas as
  entregas em páginas de 250 desde o mount. O refresh de foco se junta à
  mesma operação se ela estiver em andamento. A publicação de uma resposta
  completa revisa o estado compartilhado e pode refiltrar entregas na Home.
  Adiar a primeira leitura para o foco mudaria a disponibilidade dos dados ao
  abrir Histórico e poderia exibir o estado vazio até a resposta.
- As configurações de custos e carro da aba Finanças também podem revalidar
  ao montar sem esperar o foco. O histórico de custos usado para combustível
  tem escopo diferente do recorte de Finanças. O widget financeiro e o
  bootstrap hidratam resumos locais do ledger. A autorização do widget de
  entregas pode usar token e uma chamada própria. A sobreposição é possível,
  mas sua contribuição para a latência A/B não foi medida.
- O Lucro Líquido depende de snapshot confirmado, rotas prontas e combustível.
  Se os resumos de rota já estiverem em memória, o gate de rotas pode estar
  pronto antes da revalidação remota. Os tempos agregados não demonstram se
  o ledger foi a última dependência antes do layout nas duas amostras.
- A etapa registra o diagnóstico sem alteração de execução. Uma próxima
  coleta em ambiente isolado com conta sintética deve repetir A e B nas
  mesmas condições, alternar a ordem e correlacionar `js_monotonic_ms`, `trace_id`,
  `open_intent_id`, `finance_visit_id` e `finance_scope_generation`. Comparar
  a seleção JS, `finance_route_summaries_total`, `firestore_route_ledger_read`,
  as leituras de custos/entregas, as páginas do Histórico, os commits de
  prontidão e o callback de layout com o vídeo do toque e do frame. Os spans
  existentes delimitam o fluxo total de rotas, mas não as duas leituras
  locais individualmente nem as fases internas do SDK. As leituras de custos
  do período e do histórico para combustível usam o mesmo nome de span.
- TypeScript, `git diff --check` e 9 suítes com mocks ou dados sintéticos
  passaram (138 testes). ESLint estrito passou em 8 arquivos do recorte.
  A regra Prettier apontou CRLF no coordenador do widget, na busca da Home
  e no ledger, além da formatação de um import do ledger. Os três passaram
  com essa regra desativada. A validação não acessou Firebase de produção
  nem Emulator e não incluiu nova medição física. A alteração documental
  dispensa Fast Refresh e nova Development Build.

## Etapa 2.2.5 — revisão do caminho crítico de Finanças Atacado (2026-11-06)

- Os dois cold starts documentados registraram cerca de 1,15 s da seleção
  recebida pelo JavaScript até custos e entregas remotos, 1,35–1,77 s até o
  lucro confirmado e 1,42–1,84 s até o callback de layout. Os 3,90–4,07 s
  anteriores à seleção recebida pelo JavaScript são outro intervalo. Essas
  amostras não medem o toque nem o primeiro frame físico e não registram os
  marcos por visita, escopo e indicador adicionados na Etapa 2.2.4B.
- O caminho do período já inicia entregas, custos e base local em paralelo.
  O leitor de entregas já junta consultas idênticas em andamento por sessão e
  filtros. As consultas diária e mensal de custos são de coleções diferentes e
  já rodam em paralelo. A leitura do histórico de custos para combustível tem
  escopo diferente da leitura financeira do período. Não há evidência de
  leitura remota duplicada na abertura da aba nessas amostras.
- O Faturamento mensal com entregas exatas e confirmadas já pode aparecer
  antes do resumo. O Lucro Líquido depende do snapshot estável, da cobertura
  remota e da prontidão de rotas e combustível. O ledger lê dados locais e
  reconcilia rotas pendentes dentro do fluxo de foco. Os tempos disponíveis
  não isolam o custo dessas etapas nem justificam mudar sua ordem.
- A etapa registrou a auditoria no documento, sem mudança de execução. Não
  houve redução aplicada nas leituras nem medição de ganho no iPhone. A
  hipótese de competição com tarefas do bootstrap continua em aberto.
- Para comparar no iPhone, registrar vídeo do toque e da tela, o estado do
  Metro e os eventos `[STAGE2_BASELINE]` de uma abertura fria e de um retorno
  à aba já aquecida. Correlacionar `trace_id`, `finance_visit_id` e
  `finance_scope_generation` e separar seleção JS, consultas, prontidão dos
  cards, callback de layout e frame visível. Se houver alerta, registrar
  mensagem e momento conforme a Etapa 2.2.4C. A Development Build instalada
  é suficiente para o código da instrumentação já existente. A alteração
  documental não requer Fast Refresh nem nova build.
- Validação local: TypeScript e `git diff --check` passaram. Oito suítes
  direcionadas passaram (150 testes com mocks/dados sintéticos). ESLint
  passou no recorte principal. O ledger, que já tinha divergências de CRLF e
  formatação, passou com a regra Prettier desativada. Nenhum Firebase de
  produção, Emulator ou iPhone foi usado na validação desta etapa.

## Etapa 2.2.4B — instrumentação da demora visual (2026-11-06)

- Os dois cold starts enviados pelo usuário registraram 3,90–4,07 s entre início
  JS e `native_tab_press_js`, ~1,15 s até custos/entregas remotos, 1,35–1,77 s
  até lucro confirmado e 1,42–1,84 s até callback de layout. Esses intervalos
  descrevem os eventos registrados; não localizam o primeiro toque físico nem o
  primeiro frame visto na gravação.
- `native_tab_press_js` é mantido para compatibilidade, mas agora declara no log
  `input_boundary=native_tab_selection_js_receipt` e
  `physical_touch_start_measured=false`. No código instalado, o controlador
  nativo já trata a seleção do UIKit antes de o Expo Router emitir `tabPress` e
  navegar no JavaScript. `startup_app_root_module_evaluated` identifica quando
  o módulo raiz do app começa a executar; `js_monotonic_ms` dá uma referência
  monotônica comum aos eventos `[STAGE2_BASELINE]` da mesma execução. Esse marco
  ocorre após o bundle começar a executar módulos do app e não mede compilação,
  transferência do Metro nem o início físico do runtime. Fast Refresh pode
  reavaliar o módulo raiz; não trate esse evento isolado como um novo cold start.
- A linha `Carregando Finanças Atacado...` é renderizada enquanto
  `showHeroCards` é falso e o hook ainda informa carregamento. Quando a consulta
  mensal exata de entregas libera o preview confirmado, os cards entram e a
  mensagem muda para `Carregando demais indicadores...` abaixo deles. Quando
  `summary` está disponível, as quatro seções também são montadas; lucro líquido
  continua em gate separado que exige snapshot estável, cobertura remota, rotas
  e combustível. O `memory_miss` inicial é da consulta síncrona exata em memória
  de `useFinancialData`; a mensalidade não hidrata AsyncStorage nesse caminho.
  Leituras persistentes v1 são feitas pela busca da Home e pelo coordenador do
  widget, não liberam os indicadores confirmados de Finanças e agora levam
  `consumer=home_search` ou `consumer=finance_widget` no span. O cache mensal v1
  guarda UID/mês/snapshots/horário, sem `sessionVersion`, escopo exato da query
  nem proveniência remota; portanto, um `cache_hit` persistente não equivale a
  snapshot confirmado. Cache persistente v1 segue inelegível como confirmação.
- Nova instrumentação, somente em `__DEV__`: `finance_visit_focus/blur` e
  `finance_scope_diagnostic_generation_change` identificam visita e geração
  opacas; início da visita e prontidão usam efeitos passivos, após o trace da
  tela registrar seu contexto; `finance_loading_presentation_commit` registra
  o ramo do carregamento;
  `finance_region_branch_commit` registra commits de montagem/remoção dos ramos;
  `finance_target_ready_commit` separa Faturamento, Lucro Líquido, resumo e
  árvore completa; `finance_all_indicators_ready_commit` indica quando todos
  os indicadores financeiros principais passaram seus gates; os cards usam
  `View.onLayout` e o conteúdo rolável usa `ScrollView.onContentSizeChange`, com
  dimensões em unidades lógicas do React Native. Se Faturamento usou preview
  remoto confirmado, `finance_revenue_advance_basis=ready_commit` compara sua
  prontidão com a prontidão de todos os indicadores; `layout_callback` compara
  o `View.onLayout` de Faturamento com `ScrollView.onContentSizeChange` do
  conteúdo completo. Ambos exigem a mesma visita/escopo e não representam um
  frame visível.
- O callback de layout continua sendo evidência de cálculo/relato de layout do
  React Native, não de que um frame SwiftUI foi fisicamente apresentado. Os
  cards permanecem com `NativeAnimatedNumber` e sua identidade/layout atuais;
  não foi adicionada instrumentação ao interior do Host SwiftUI. Medir o frame e
  o toque percebidos requer vídeo sincronizado do dedo e da tela. A renderização
  progressiva de Faturamento da Etapa 2.2.4 não pode ser quantificada pelos dois
  logs antigos: não havia marcos por alvo e visita. Seu ganho continua
  indeterminado até nova coleta.
- Metro, JavaScript, callbacks de navegação, dados e layout agora ficam
  separáveis: o módulo raiz e os eventos app usam o relógio monotônico JS; os
  eventos de tela preservam os próprios campos de visita/escopo; `iOS Bundled`
  continua sendo saída do servidor Metro em outro relógio. Registre o estado do
  Metro por execução e use vídeo para anotar toque físico e mudança visual. Não
  subtraia timestamps de relógios diferentes sem sincronização comprovada.
- Home mantém consultas próprias de clientes, entregas, compras e pagamentos;
  app root também inicia hidratação, restauração de rotas e atualizações de
  widgets/Live Activities. Expo Router pré-carrega placeholders das tabs nesta
  configuração instalada. Isso torna possível competição por rede ou thread JS,
  mas não comprova que ela causou a demora. A política de montagem e os
  carregamentos não foram alterados.
- Validação desta instrumentação: TypeScript passou; 7 suítes sintéticas
  direcionadas passaram (272 testes), incluindo `stage2Baseline`,
  `useFinancialData`, `FinanceHeroNumberSafeArea`, cálculos financeiros, cache,
  widget e busca da Home. ESLint passou nos demais arquivos; os dois arquivos
  chamadores com CRLF preexistente passam sem regra de formatação e também no
  Prettier configurado para preservar CRLF. O ESLint com configuração padrão
  aponta somente essas terminações de linha (`Delete ␍`); o script global
  `npm run lint` já havia falhado pelo mesmo conflito CRLF/LF no checkout, e
  nenhum arquivo foi normalizado em massa. `git diff --check` passou. Nenhum
  Firebase/Emulator, build ou teste físico foi usado.
  A atualização é somente JS/TSX/Markdown: Fast Refresh basta na Development
  Build já instalada; validar toque/frame e os novos logs no iPhone continua
  pendente.

## Etapa 2.2.4C — diagnóstico de valores provisórios (2026-11-06)

- A sequência relatada no iPhone (indicadores em zero/indisponíveis durante um
  alerta e valores corretos depois de fechá-lo) não prova que o alerta causou a
  recuperação. Não havia gravação de Metro ou eventos `[STAGE2_BASELINE]`
  sincronizados com esse alerta. O `firestore-debug.log` local disponível é
  anterior ao teste e não contém um código de erro Firebase comum pesquisável;
  a mensagem completa permanece desconhecida.
- A tela Financeira não chama `Alert.alert` para erros Firebase. O único alerta
  de inicialização encontrado é o de Face ID em `SplashGate`. Falhas das
  consultas de custos/entregas são capturadas por `useFinancialData`, que mantém
  fallback/proveniência e, em desenvolvimento, emite `console.warn` com o erro;
  esse aviso pode aparecer no LogBox/Metro, mas não foi possível provar que seja
  o alerta visto no aparelho.
- Um snapshot local com registros pode alimentar `summary` antes de cobertura
  remota completa; seus indicadores, inclusive Faturamento `0`, são provisórios
  e a tela possui aviso explícito de falta de confirmação. O Lucro Líquido segue
  bloqueado até haver cobertura remota completa, rotas e combustível prontos.
  Portanto, o zero observado não está comprovado como resultado financeiro
  confirmado nem como erro de cálculo. Também pode corresponder a uma consulta
  remota vazia que ainda não havia sido atualizada; só a sequência de eventos
  pode distinguir os casos.
- `finance_scope_generation` é somente um contador diagnóstico: sua assinatura
  combina seleção, chave da consulta e escopo da sessão/snapshot. Mudanças limpam
  conjuntos de eventos medidos e emitem `finance_scope_diagnostic_generation_change`;
  não alteram a geração de carregamento, não iniciam consulta e não modificam
  valores financeiros. Na primeira abertura, chaves inicialmente ausentes podem
  ser preenchidas em renders posteriores; os logs atuais não identificam qual
  campo mudou na ocorrência relatada.
- O hook não possui retry explícito imediato após uma consulta de custos ou
  entregas rejeitada. Nova leitura pode ocorrer em foco/entrada na aba, após
  transição offline→online enquanto focado, por mudança externa de cache ou por
  recarga manual. Fechar um alerta não é um gatilho de recuperação identificado
  no código.
- Próxima coleta: vídeo com tempo do alerta, título/texto/código completos e
  eventos `[STAGE2_BASELINE]` antes e depois de fechá-lo, correlacionados pelo
  `trace_id`, `finance_visit_id` e `finance_scope_generation`; incluir o aviso
  Metro `[useFinancialData] Firestore ... fallback local` e seu `FirebaseError`
  (removendo UID, caminhos de documentos e outros dados pessoais). Até essa
  evidência, nenhuma alteração funcional é recomendada e a causa dos valores
  tardios permanece indeterminada.

## Etapa 2.2.4 — apresentação progressiva segura de Finanças (2026-11-06)

- A mensagem `Carregando Finanças Atacado...` substituía os cards quando ainda
  não existia `summary` nem Lucro Líquido confirmado reutilizável. Para formar o
  primeiro snapshot mensal, `useFinancialData` aguardava em um `Promise.all` a
  base local, a consulta de entregas e a consulta de custos diários/mensais.
  Com `ENABLE_FIREBASE_APP_DATA=false`, essa base vem do modo mock/local,
  não da leitura de app-data no Firestore. Entregas e custos já eram iniciados
  em paralelo; o ramo mais lento determina a barreira, sem somar suas durações.
  A prontidão de rotas/ledger e combustível
  tem um gate separado para Lucro Líquido e métricas derivadas e não bloqueia o
  primeiro `summary` depois que um snapshot é publicado.
- O card Faturamento pode aparecer antes das outras leituras somente quando a
  consulta mensal exata de entregas já foi confirmada pelo servidor, está
  completa, não veio do cache e não tem escritas pendentes. O hook também exige
  UID, sessão, filtros, período e geração de invalidação atuais. O valor usa
  `filterDeliveries` e `calculateFaturamento` existentes para o mês selecionado;
  nenhuma fórmula foi alterada. Uma consulta confirmada vazia pode apresentar
  zero. Cache, escritas pendentes, resposta incompleta ou obsoleta não liberam
  o preview.
- Nesse estágio, Faturamento é mostrado com o mesmo card nativo. Lucro Líquido
  permanece em “Aguardando confirmação”; comparações e os demais resumos só
  aparecem com o snapshot requerido. A indicação de carregamento fica depois
  dos cards para informar que as demais leituras continuam. Gráficos e widget
  continuam bloqueados até os gates anteriores de snapshot estável.
- O ganho é somente visual e condicional: se entregas terminarem antes de custos
  ou da base local, o Faturamento aparece antes. Isso não acelera a leitura que
  estiver mais lenta nem garante redução dos 3–4 segundos vistos nos vídeos. As
  capturas fornecidas não compartilham relógio com os logs instrumentais; no
  segundo vídeo não há compilação do Metro visível, mas isso não comprova uma
  comparação controlada com Metro aquecido. A causa do tempo completo observado
  no iPhone permanece pendente de gravação e logs correlacionados.
- `cache_hit` persistente e `memory_miss` financeiro não são o mesmo teste. A
  leitura v1 por AsyncStorage é usada por consumidores como o fluxo do widget;
  o hook mensal exige memória associada à sessão e consulta exatas. A leitura v1
  não contém essa prova e não se qualifica como snapshot mensal da tela. Nenhuma
  regra foi relaxada nem novo cache foi introduzido.
- Home, Histórico, widgets e Live Activities iniciam alguns trabalhos próprios
  em paralelo durante a inicialização. Eles não são aguardados pelo render de
  Finanças; eventual competição por rede ou thread JS não foi comprovada nas
  gravações e exige medir sob o mesmo `trace_id`/`open_intent_id`. O evento
  `[STAGE2_BASELINE] finance_confirmed_revenue_preview_layout_ready` mede o
  callback de layout do Faturamento antecipado em desenvolvimento, não um frame
  físico do iPhone.
- Validação local desta etapa: testes direcionados usam somente mocks e dados
  sintéticos; 3 suítes financeiras direcionadas passaram (67 testes). Nenhum
  Firebase de produção ou Emulator foi acessado. TypeScript, ESLint direcionado
  e `git diff --check` passaram. A suíte completa não foi executada nesta etapa;
  as 10 suítes/17 falhas preexistentes permanecem sem reclassificação. Não houve
  build nem medição física. As alterações são TS/TSX/Markdown, portanto Fast
  Refresh basta para testar a apresentação; a Development Build existente basta
  no aparelho.

## Correção prioritária — estabilidade do Lucro Líquido (2026-11-06)

- A confirmação exata do período podia virar provisória durante uma leitura de
  foco: o hook recuperava a entrada de memória da mesma consulta, marcava a
  cobertura atual como provisória enquanto revalidava, e a tela escondia Lucro
  Líquido até `remoteComplete` voltar a `true`. O card ainda recebia texto vazio
  nesse intervalo. Agora um valor só é mantido quando há prova anterior para o
  mesmo UID, sessão, período e consulta; os dados continuam provisórios até uma
  nova confirmação remota.
- A composição original do card foi restaurada: cabeçalho e um único
  `NativeAnimatedNumber`, sem linha fixa de status. A revalidação online normal
  não mostra mensagem. Avisos necessários de offline ou resposta não confirmada
  aparecem no aviso já existente após os cards, sem aumentar nem deslocar o card.
  Quando não há lucro confiável, o mesmo componente mostra “Aguardando
  confirmação” ou “Lucro líquido indisponível”, nunca um valor inventado.
- A comparação mensal confirmada é conservada junto ao lucro, identificada por
  UID, sessão, período e consulta. Durante revalidação, a porcentagem anterior
  continua visível; só é substituída por uma nova comparação quando o lucro e a
  nova consulta estão confirmados. A troca de sessão/período/consulta impede
  reutilizar lucro e porcentagem anteriores.
- Quando uma gravação invalida o snapshot do período e a nova leitura ainda não
  foi confirmada, o card mantém em memória o último lucro e comparação que já
  exibiu para a mesma consulta. O aviso externo identifica esse valor como o
  último confirmado. A revalidação comum permanece silenciosa. Somente a nova
  confirmação remota atualiza o número e a comparação no card.
- A identidade do texto SwiftUI de Lucro Líquido segue o UID, sessão, período e
  consulta solicitados. A troca de estado entre indisponível, aguardando e
  confirmado não recria o texto no mesmo card. A mudança de disponibilidade
  solicita a transição de entrada SwiftUI no texto já montado. O texto passa do
  status para o primeiro valor real, inclusive quando esse valor é zero. Um novo
  valor confirmado no mesmo escopo atualiza o texto existente pela transição
  numérica. Validação física informada pelo usuário em 2026-11-06 confirmou que
  o valor e a porcentagem ficam estáveis durante revalidações, a geometria
  original foi restaurada e a animação numérica nativa funciona após alterar
  Dados Diários.
- A invalidação do período agora avança uma geração síncrona e notifica o hook;
  respostas de leitura iniciadas antes da invalidação não podem republicar o
  snapshot invalidado. A lógica não grava dados financeiros nem altera cálculos,
  schema, ledger, combustível ou o formato persistido.
- Eventos `[STAGE2_BASELINE]` de prontidão financeira e estado do card são
  exclusivos de desenvolvimento e registram apenas estados/flags agregados, sem
  valores, UID ou dados pessoais. O evento de prontidão agora inclui se a
  comparação mensal está pronta ou foi reutilizada; a origem do cache inicial
  informa que somente memória da sessão/consulta exata é elegível.
- O motivo dos ~10 segundos até a primeira apresentação ainda não está
  comprovado. A validação anterior do iPhone mediu leituras financeiras na
  ordem de ~1 segundo, mas não separou com o mesmo relógio abertura do app,
  SplashGate, preparação, intenção de abrir Finanças e frame visível. O cache
  persistido v1 não foi promovido porque não prova sessão, consulta e cobertura.
  A comparação com `da43eb5` não encontrou uma nova leitura serializada: snapshot
  local, custos e entregas continuam aguardados em `Promise.all`, e o ledger
  segue em sua leitura independente. A Etapa 2.2.3A tornou a confirmação mais
  estrita e deixou de apresentar o cache persistido v1 como resultado atual;
  isso pode estender a espera por um lucro comprovado, mas não explica por si só
  os 10 segundos. Os eventos existentes de splash/hidratação, navegação,
  intenção de aba, consultas, ledger e layout permitem separar a sequência na
  próxima coleta. Não há alegação de redução de tempo sem nova medição física.
- Validação sintética anterior desta correção: 7 suítes direcionadas passaram
  (149 testes), com mocks/dados sintéticos. Nesta revisão do card, TypeScript,
  ESLint direcionado, `git diff --check` e 6 suítes financeiras direcionadas
  passaram (101 testes). Nenhum teste acessou Firebase de produção ou Emulator. As
  alterações são somente TS/TSX/Markdown; Fast Refresh basta e não exige nova
  Development Build.

## Navegação dos gráficos de Finanças Atacado (2026-11-06)

- Os cards de Faturamento e Lucro Líquido abriam seus gráficos no Root Stack
  com `router.push` a cada toque. Agora usam `router.navigate`, uma reserva
  local até a saída de Finanças e o mecanismo de intenção pendente das etapas
  2.1–2.1.3. Um toque durante o retorno nativo aguarda foco e fim da transição.
  O `gestureCancel` de cada gráfico cancela a intenção de retorno associada.
  Um toque atrasado de Finanças é ignorado se outra aba já estiver selecionada.
- `[STAGE2_BASELINE]` distingue as duas rotas e registra a intenção, a pilha JS
  e a decisão, sem registrar o período nem valores. TypeScript, ESLint
  direcionado e seis suítes com 109 testes passaram. Validação física informada
  pelo usuário em 2026-11-06: navegação rápida dos gráficos melhorou e não houve
  novas duplicações observadas.
- A causa dos ~10 s na abertura inicial segue em aberto. Compare, em uma mesma
  captura com timestamps, `splash_gate_ready`, `startup_local_hydration_complete`,
  `startup_navigation_replace_*` e o primeiro `screen_commit` da Home. Em uma
  ação separada, acompanhe o mesmo `open_intent_id` até
  `finance_first_indicators_layout_ready`. As medidas partem de relógios de
  fluxo diferentes, e o callback de layout não confirma um frame físico.

## Etapa 2.2 — baseline e responsividade de Finanças Atacado (2026-11-06)

- Baseline físico informado pelo usuário: `screen_focus` 3.267 ms, primeiro
  faturamento disponível 4.391 ms e lucro líquido disponível 4.393 ms. São
  aproximadamente 1.124 ms entre foco e faturamento e 1.126 ms entre foco e
  lucro. As leituras de custos (~917 ms), entregas (~900 ms) e ledger de rotas
  (~979 ms) ocorreram parcialmente em paralelo; não somar as durações. O
  snapshot local derivado (~16 ms) e o cálculo principal (~1,4 ms) não explicam
  sozinhos a espera. Nenhuma medição posterior no iPhone foi feita nesta etapa.
- `[STAGE2_BASELINE]` agora registra a seleção da aba Financeiro entregue ao
  JavaScript, correlaciona `tabPress` → foco → commit JS → disponibilidade dos
  dados → callback de layout dos cards. Os tempos começam no evento JS da aba,
  não no toque físico. `native_layout_callback` comprova callback de layout com
  a tela focada e indicadores válidos; `physical_frame_confirmed=false` deixa
  explícito que isso não mede o frame físico apresentado pelo iPhone.
- Os eventos de primeiro faturamento/lucro agora exigem tela focada, snapshot
  do período pedido e chave de sessão ativa. O diagnóstico identifica a
  cobertura `remoteComplete` como valor reportado pelo hook, sem tratá-la como
  confirmação independente da origem Firestore.
- Otimização segura aplicada no Histórico: revisões globais que criam um novo
  array, mas preservam os mesmos objetos e ordem das 651 entregas, mantêm a
  referência estável e não repetem a conversão dessas entregas para o modelo de
  apresentação. A suíte sintética valida a identidade; o ganho físico ainda
  precisa de comparação no iPhone.
- O caminho de Finanças, cálculos, persistência, queries e ledger não foi
  alterado. No cache miss, o hook aguarda a barreira do snapshot base e das
  leituras de entregas/custos do período; a leitura remota do ledger continua
  no foco. As métricas resumidas não identificam qual ramo termina por último.
- Ponto de atenção para qualquer otimização futura de cache: no caminho mensal,
  `useFinancialData` usa os métodos `load` para custos e entregas. O método de
  custos descarta o `remoteComplete`/`source` retornado por
  `loadWithMetadata`, e a leitura de entregas não expõe sua origem ao hook.
  Portanto, a resolução dessas Promises não basta para provar cobertura remota
  canônica. Não foi adicionado caminho cache-first nem alterado o estado atual;
  a origem/cobertura precisa ser corrigida e testada antes de reutilizar dados
  provisórios como definitivos.
- `StaleCostSettingsOperationError` é produzido quando `canRun` detecta que a
  operação local ficou obsoleta após cleanup/troca de sessão. Os logs fornecidos
  não identificam o chamador, então esta execução não classifica o aviso
  específico do iPhone como cancelamento esperado ou falha funcional e não
  alterou Cost Settings.
- Validação desta etapa: TypeScript, ESLint direcionado, `git diff --check` e 3
  suítes sintéticas direcionadas (41 testes) passaram. Não foram acessados
  Firebase, Emulator, builds ou dispositivo. Sem alterações nativas; Metro /
  Fast Refresh basta para testar a nova instrumentação na Development Build
  existente. A comparação final de tempos e o frame visual continuam pendentes
  no iPhone.

## Etapa 2.2.1 — otimização segura e caminho crítico (2026-11-06)

- Baseline físico fornecido pelo usuário: seleção da aba → foco 37 ms; custos e
  entregas prontos 934 ms; ledger de rotas pronto 1.053 ms; lucro líquido
  1.138 ms; callback de layout dos indicadores 1.197 ms. Custos e entregas
  ocorreram em paralelo: não somar. O ledger terminou 119 ms depois dos dados
  de período e o lucro 85 ms depois do ledger. App aquecido: lucro 186 ms e
  callback de layout 188 ms, com origem reportada como cache. Esses números
  foram fornecidos pelo usuário; não houve nova medição física nesta execução.
- O baseline de 1.197 ms começa na seleção recebida pelo JavaScript, não no
  toque físico nem na abertura do app. Ele não explica sozinho a espera
  subjetiva aproximada de 3 s; o intervalo app aberto → toque e a apresentação
  efetiva do frame ainda não foram medidos com o mesmo relógio.
- `finance_initial_snapshot_source` distingue agora `memory_hit` de
  `memory_miss`. O span `financial_cache_hydration` informa separadamente se a
  hidratação consultou memória ou AsyncStorage. O evento inicial anterior
  refletia apenas o mapa em memória e não provava ausência de cache persistente.
- Não foi promovido cache financeiro ao caminho confirmado. A entrada mensal
  persiste UID e mês de exibição, mas não sessão, cobertura confirmada,
  proveniência ou validade temporal; a leitura não rejeita entradas antigas por
  idade. O hook mensal começa `remoteDataComplete=true` e usa `load` para custos
  e entregas: custos descartam `source`/`remoteComplete`, e entregas não expõem
  `fromCache` nem `hasPendingWrites` ao hook. Uma Promise resolvida pode, assim,
  marcar a fotografia mesclada como completa e persistir dados de origem
  provisória. Também é preciso incluir invalidação do mês de comparação e
  revisar consumidores do cache (widget e busca). O cache atual recebe
  `remoteComplete=false` na cobertura da UI, mas pode ser exibido enquanto
  revalida; precisa de tratamento explícito antes de ser apresentado como atual.
- A leitura de `loadForFinance` permanece no foco. Ela reconcilia resumos locais
  pendentes com operações remotas; deslocá-la para o bootstrap anteciparia esses
  efeitos. A janela seleção → foco medida foi 37 ms, sem evidência para justificar
  iniciar consultas no cold start antes da intenção de abrir Finanças.
- O Histórico agora compara, por ID, os campos consumidos por
  `toHistoryDelivery`. Itens sem mudança de conteúdo reutilizam a linha
  convertida; inclusão, remoção, alteração e ordem são preservadas. O cache do
  projetor é recriado por UID/sessionVersion. `formatCurrency` reutiliza uma
  única instância lazy de `Intl.NumberFormat` com as mesmas opções BRL. Em
  microbenchmark sintético Node v26.4.0, 651 valores e 15 repetições, mediana da
  formatação caiu de 9,3703 ms (formatador por valor) para 0,1854 ms (instância
  compartilhada); todas as strings foram equivalentes. O teste do projetor
  sintético confirma zero conversões em nova lista com os mesmos valores e
  reconversão quando qualquer campo mapeado muda. Isso mede processamento JS,
  não o tempo total do Histórico nem o carregamento de Finanças no iPhone.
- `StaleCostSettingsOperationError` pode chegar por persistência local ou sync
  remoto em `useCostSettings`; ambos descartam operações obsoletas. Sem prefixo
  ou stack do aviso recorrente do iPhone, o chamador daquela ocorrência não foi
  determinado. Nenhum comportamento de Cost Settings foi alterado.
- Aceleradores de cache para o lucro líquido continuam pendentes de contrato
  seguro que inclua snapshots exatos de entregas/custos, confirmação sem cache
  nem escritas pendentes, sessão, período e compatibilidade com o ledger e os
  parâmetros de combustível. Não houve alteração em Firebase, regras, schema,
  persistência, cálculo financeiro ou ledger.
- Validação sintética desta etapa: TypeScript passou; 9 suítes direcionadas
  passaram (99 testes), incluindo `useFinancialData`, cache financeiro,
  cálculo, ledger, projeção do Histórico e equivalência do formatador. Os testes
  existentes cobrem cache ausente/presente, falha de revalidação, sessão e
  respostas fora de ordem. Não há teste financeiro que injete
  `hasPendingWrites=true`: os loaders mensais atuais não expõem essa metadata ao
  hook, então essa condição permanece sem validação e impede promover o cache.
  ESLint direcionado passou com a regra Prettier desativada para preservar CRLF;
  Prettier passou nos arquivos de código/teste com `endOfLine=auto` e
  `git diff --check` passou. Não foram acessados Firebase ou Emulator. O usuário
  informa que validou no iPhone as otimizações apresentadas, mas não incluiu
  novos logs ou tempos nesta finalização.
  Como as mudanças são TS/TSX/Markdown, Fast Refresh basta; nova Development
  Build não é necessária. Não houve redução comprovada do carregamento inicial
  de Finanças. A próxima investigação depende de um contrato seguro de cobertura
  e proveniência das leituras de custos e entregas.

## Etapa 2.2.3A — proveniência e cobertura financeira (2026-11-06)

- A lacuna descrita acima foi corrigida sem criar cache v2 nem mudar o formato
  persistido. `FirestoreDailyMonthlyDataSource.loadWithMetadata` e
  `FirestoreDeliveryDataSource.loadWithMetadata` agora devolvem a fotografia
  exata da consulta separada do estado acumulado/compatível dos stores, junto a
  UID, `sessionVersion`, filtros/intervalo, `scopeKey`, `fromCache`,
  `hasPendingWrites`, origem, cobertura e `remoteConfirmed`. O método legado
  `load()` continua disponível e mantém seu retorno para os consumidores
  existentes. A leitura paginada de histórico também agrega metadata de todas as
  páginas antes de confirmar a cobertura.
- `useFinancialData` só marca um período como remoto completo se custos e
  entregas corresponderem ao UID, sessão, consulta e filtros solicitados, e se
  ambos os snapshots reportarem `fromCache=false` e `hasPendingWrites=false`.
  Resultados unidos ao store não servem como confirmação. Respostas de sessão,
  usuário ou consulta diferentes são rejeitadas antes de serem publicadas.
- Cache Firestore local e snapshots com escritas pendentes são classificados
  como provisórios; ausência de metadata vira `unknown`. Um resultado vazio só
  produz valores financeiros zerados quando a consulta exata é confirmada. Se
  não houver confirmação e não existir snapshot anterior ou dado local útil, o
  hook mantém os indicadores indisponíveis em vez de publicar uma fotografia
  vazia. O cache mensal v1 do AsyncStorage não tem identidade de sessão nem
  filtros: `useFinancialData` não o reutiliza como dado da sessão atual. Só pode
  reutilizar uma entrada de memória criada por confirmação remota na mesma
  sessão e consulta; essa entrada continua provisória até nova confirmação.
  Lucro líquido fica indisponível até custos, entregas, ledger e combustível
  estarem prontos conforme os contratos atuais.
- A confirmação de `hasPendingWrites=false` descreve os snapshots/consultas
  exatos considerados. Ela não é uma barreira global contra escritas pendentes
  fora desse escopo; custos e entregas também não formam uma leitura atômica
  conjunta. O cache financeiro v1 não contém proveniência, cobertura,
  sessão ou filtros e permanece no formato atual; consumidores legados fora de
  `useFinancialData` ainda precisam de análise própria. Essa etapa não ativa
  cache-first nem grava novo formato persistente.
- Fórmulas, ledger de rotas, combustível, schemas, regras financeiras e
  operações de escrita do ledger permaneceram inalterados. A cobertura do
  histórico total agora pode ser confirmada com metadata agregada; custo ou
  entrega com metadata ausente/cache/pending continua provisório e não renova o
  cache financeiro de período.
- Validação sintética local: TypeScript passou e 6 suítes direcionadas passaram
  (130 testes), incluindo proveniência, custos, entregas, cache de período,
  `useFinancialData` e `FinancialCalculationService`. Os mocks cobrem confirmação de servidor,
  cache, escritas pendentes, ausência de metadata, consulta vazia confirmada,
  falha de rede, UID/sessão, respostas fora de ordem e compatibilidade dos
  métodos legados. Nenhum teste acessa Firebase de produção. ESLint direcionado,
  `git diff --check` e TypeScript passaram. Nenhuma medição física no iPhone foi
  feita; não há ganho de desempenho declarado. Como as mudanças são TS/TSX e
  Markdown, Fast Refresh basta; não há alteração nativa nem nova Development
  Build necessária.

## Estabilização pré-commit — estado para publicação (2026-11-05)

- Cost Settings: mutações não usam mais `setDoc(..., { merge: true })` para
  atualizar registros conhecidos. Updates de registros que já existiam falham
  claramente se o documento desaparecer; criações são feitas por transação
  somente quando a operação representa criação. A exclusão seguida de uma nova
  edição aguarda o ACK da exclusão, não recria se ela falhar e serializa as
  operações concorrentes para o mesmo registro. Dados antigos não são enviados
  como substituição completa do documento.
- Car Settings: snapshots `cache` ou com `hasPendingWrites` não são tratados
  como confirmação remota. Updates de documentos existentes mantêm o `updateDoc`
  parcial do SDK (incluindo a fila offline); seu ACK é tratado apenas como patch
  e aplicado sobre a base em cache mais recente, nunca como fotografia completa
  fabricada a partir de uma leitura antiga. A criação após ausência confirmada
  continua transacional e exige edição explícita. Edições locais são mantidas
  como patches da sessão e sobrepostas a novas confirmações. Se uma edição
  chegar antes da hidratação, sua gravação local aguarda a leitura da base para
  não substituir o campo não editado por default. Gravações de cache local são
  serializadas por UID; transações de criação também são serializadas por UID.
  Updates parciais existentes continuam sem esperar o ACK de outros updates,
  mas aguardam transações de criação anteriores para preservar a ordem da última
  edição. Uma nova hidratação aguarda a fila local; confirmações antigas são
  rejeitadas antes de atualizar UI/cache. Revisões exatas de drafts são
  resolvidas após ACK mesmo quando a releitura de concorrência falha ou retorna
  dados provisórios. Após desmontagem do editor, uma confirmação ainda pode
  atualizar o cache somente se o UID/sessionVersion ativo corresponder; logout
  ou troca de sessão bloqueia o resultado antigo. A invalidação local por
  ausência remota confirmada também termina após a desmontagem da tela enquanto
  a sessão permanece ativa. Ausência confirmada não cria documento remotamente.
  A chave legada sem UID continua ignorada e não é migrada automaticamente.
- Navegação: `gestureCancel` agora restaura o ciclo da tela revelada e cancela
  intenção pendente mesmo quando o listener do destino não tinha intenção
  própria. A Web libera as rotas após um ciclo real de blur/focus, pois não
  recebe o mesmo `transitionEnd` do Native Stack. O caminho de eventos e as
  animações nativas do iOS foram preservados; nenhum timer foi introduzido.
- Instrumentação `[STAGE2_BASELINE]`: contagens, snapshots e fornecedores de
  detalhes usados exclusivamente nos diagnósticos só são calculados em
  `__DEV__`; as medições não incluem UID, nomes ou valores financeiros.
- Validação local: `npm run typecheck` passou. As 3 suítes focadas em Finanças,
  navegação de Clientes e Live Activity passaram (37 testes). ESLint direcionado
  passou; ESLint nos TS/TSX alterados passou com `prettier/prettier` desligado
  para preservar finais CRLF existentes. `git diff --check` passou.
- Revisão final de Car Settings e sessão: 4 suítes sintéticas passaram (61 testes),
  cobrindo ACK de patch e criação, snapshots pendentes e confirmação posterior,
  rejeição, UID/sessionVersion obsoletos, ausência remota, fallback offline,
  edição antes da hidratação, updates concorrentes enquanto uma criação aguarda,
  drafts reconhecidos após releitura provisória/falha e após desmontagem, e
  prevenção de persistência depois de logout. A execução ampliada, incluindo
  regressões de Finanças e Route Tracking, passou 6 suítes e 86 testes. TypeScript passou; ESLint
  direcionado passou com `prettier/prettier` configurado para `endOfLine: auto`;
  `git diff --check` passou. Foram usados mocks; nenhum Firebase ou Emulator foi
  acessado.
- Última execução completa sem Firebase registrada: `npm test -- --silent
--testPathIgnorePatterns=tests/integrity/Stage1Persistence.emulator.test.ts`
  executou 237 suítes: 227 passaram e 10 falharam; 1.823 testes passaram e 17
  falharam. As 10 suítes/17 falhas foram reproduzidas no HEAD original
  `9cd0be9`; a suíte completa não foi repetida após as alterações finais de
  Car Settings. Os dois erros em arquivos cobertos por uma rodada anterior foram corrigidos
  sem mudar lógica de produto: o mock de Finanças agora fornece `coverage`, e
  o teste de Clientes simula o retorno nativo antes de iniciar a navegação
  seguinte. As 10 suítes restantes são de áreas sem mudança funcional nesta
  etapa: `DailyDataDataSource`, `RetailOrderPaymentSheet`,
  `NativeContextMenuPreviewIntegration`, `FinanceSelectorAnimation`,
  `FirebaseActivationGate`, `RegistrarDailyDataSheetPresentation`,
  `DeliveryServices`, `RegistrarWholesaleIconPresentation`,
  `MockAuthDataSource` e `FirebaseReadinessGate`. Permanecem como falhas do
  baseline pendente; seus testes não foram alterados para fazê-los passar.
  Nenhum Emulator, Firebase de produção, build ou dispositivo foi acessado.
- A suíte manual `tests/integrity/Stage1Persistence.emulator.test.ts` foi
  inspecionada, mas não executada nesta etapa. Ela fixa o projeto
  `demo-emporio-integrity-stage1`, exige Auth/Firestore em `127.0.0.1` nas
  portas do `firebase.emulator.json`, faz preflight TCP/HTTP e restringe o
  `fetch` aos endpoints locais permitidos; os SDKs são conectados aos
  Emulators antes de criar usuários sintéticos. Isso permite uma execução
  isolada quando os Emulators forem iniciados localmente, mas não substitui a
  validação ainda pendente desta etapa.
- Live Activity: a nova apresentação da barra da tela bloqueada mantém marca,
  progresso real de entregas concluídas/total e o contador; não apresenta mais
  categoria, data sempre visível, baldes nem total de entregas pendentes. Na
  Dynamic Island, o layout expandido remove a data trailing, arredonda os
  números, amplia a marca de 42 para 48 pt e troca o Gauge azul por verde
  claro. A barra agora volta a mostrar `Dados desatualizados · DD/MM/AAAA`
  somente quando `isObsolete` ou `environment.isStale` sinalizar conteúdo
  antigo. Isso preserva o desenho novo e mantém a distinção entre snapshot
  atual e obsoleto. A descrição histórica de 2026-10-21 foi mantida identificada
  como tal e a implementação vigente foi documentada abaixo.
- A alteração TSX da apresentação pode receber Fast Refresh no app, mas a
  extensão da Live Activity usa o bundle independente `ExpoWidgets.bundle`.
  Para validar a barra da Tela Bloqueada e a Dynamic Island no iPhone com o
  código atual, é necessária uma nova iOS Development Build; Metro/Fast Refresh
  sozinho não atualiza esse bundle. Essa validação ainda não foi executada.
- Quatro PNGs novos em `assets/branding/` (`novologin.png`, `novologin2.png`,
  `splashnovo.png`, `splashnovo1.png`) não têm referências funcionais no
  código ou testes consultados e contêm metadados XMP. Foram copiados para
  `C:\Projetos\emporiorigatti-assets-review\`; os quatro SHA256 das cópias
  foram comparados com os originais antes de retirar os arquivos do projeto.
  As cópias externas não devem ser publicadas com os metadados identificáveis;
  futuras referências no app devem usar cópias sanitizadas.
- `firestore-debug.log` existe localmente e foi preservado. A regra específica
  `/firestore-debug.log` em `.gitignore` o mantém fora do status/commit.
- O escopo desta estabilização preserva as alterações das Etapas 2.0–2.1.3,
  seus testes e a instrumentação `[STAGE2_BASELINE]`. Os quatro PNGs continuam
  preservados fora do repositório, e `firestore-debug.log` permanece apenas
  local e ignorado.

## Etapa 2.1.3 — intenção de navegação durante retorno nativo (2026-11-05)

- A causa do toque perdido está na diferença entre o ciclo nativo e o estado
  JavaScript: `react-native-screens` notifica o início visual em
  `viewWillAppear`; o Native Stack emite `transitionStart(closing=false)`.
  `transitionEnd` vem de `viewDidAppear`, enquanto foco depende da mudança do
  estado JS da rota e de seus pais. Nesse intervalo, o `onPress` pode chegar
  com a tela visível e `navigation.isFocused()`/topo ainda desatualizados. Os
  guards anteriores retornavam sem preservar a intenção.
- As telas Landing e Clientes agora guardam uma intenção única somente durante
  uma transição nativa de entrada reconhecida. Toques repetidos ao mesmo destino
  são consolidados; execução espera fim da transição, foco da origem e rota JS
  ativa. Clientes reconhece retorno tanto do formulário de entrega quanto do
  cadastro de cliente. Mudança de destino, nova transição, saída, rota
  inesperada, blur, unmount ou `gestureCancel` cancela a intenção. Quando o gesto é revertido, o
  evento real restaura a fase local ao estado estável; isso cobre o caminho em
  que o Native Stack não emite o `transitionEnd` esperado. A rota que recebe
  `gestureCancel` também cancela a intenção pendente da tela revelada e limpa o
  ciclo compartilhado da Home, sem depender de timer.
- A Home está dentro de Native Tabs e não recebe os eventos do Root Stack
  direcionados à rota `(tabs)`. O layout `(tabs)` observa esses eventos e
  compartilha um ciclo pequeno com Home; a Home usa o mesmo critério de
  conclusão antes de navegar. A navegação estática continua usando
  `router.navigate`, preservando a prevenção de rota duplicada. Landing e
  Clientes continuam usando os pushes originais e os guards de saída da etapa
  2.1.2 permanecem ativos.
- Os logs `[STAGE2_BASELINE]` agora mostram intenção `pending`, `consolidated`,
  `executed` ou `cancelled` e motivo, além de `navigation_gesture_cancel`,
  inclusive quando o contexto da tela já perdeu foco. Eventos de intenção da
  Home usam snapshot do Root Stack, não do navegador de abas. Os campos
  continuam limitados a IDs de interação e rótulos permitidos; nenhum UID,
  cliente, valor ou parâmetro de rota é registrado.
- Handler e guard fazem leituras pequenas de foco/estado e navegação; Home não
  executa consulta ou cálculo no handler. Clientes ainda processa/faz filtro e
  ordenação no render, sob as medições existentes. Isso é oportunidade para a
  próxima etapa de perfil, mas não explica o toque desta evidência, pois o
  handler JavaScript já havia recebido o toque e então o descartava. Nenhuma
  medição adicional de custo JS em iPhone foi possível nesta etapa.
- Testes com mocks e dados sintéticos cobrem cinco toques, retorno com foco
  antes/depois do fim nativo, Home aninhada, Landing → Clientes, Clientes →
  formulário, toque após gesto cancelado, troca de destino, cancelamento de
  gesto/rota, transição sobreposta e unmount. TypeScript passou; 4 suites
  direcionadas passaram (45/45). ESLint padrão passou nos arquivos novos. Nos
  arquivos preexistentes com CRLF, ESLint passou com somente a regra Prettier
  desativada; a execução padrão apontou diferenças de finais de linha, sem erro
  das outras regras.
  `git diff --check` passou. Nenhum acesso ou mutação foi feito em Firebase,
  produção ou dados locais.
- Limitação fora do fluxo iOS validado: os guards de saída preservados da etapa
  2.1.2 liberam via `transitionEnd`; o Native Stack Web instalado não emite esse
  evento. A reabertura repetida dessas rotas na Web requer correção e teste
  específicos de foco, fora desta correção de retorno nativo.
- A validação de timing e animação ainda requer iPhone físico com Development
  Build. Mudanças apenas TypeScript/TSX: Fast Refresh basta para a validação
  inicial e não exige nova compilação nativa. Nenhuma build ou teste físico foi
  iniciado pelo Codex.

## Etapa 2.1.2 — duplicações de navegação do Root Stack (2026-11-05)

- As capturas do iPhone confirmaram cinco instâncias de `registrar-entrega`
  após toques rápidos na Home e duas instâncias de `registrar-entrega/clientes`
  quando o handler da landing foi aceito com Clientes já no topo. A entrada da
  Home usava `router.push` sem verificar foco ou estado raiz; cada `PUSH`
  enfileirado cria nova rota. O guard da landing era liberado no
  `transitionEnd(closing=true)` ao sair, mas não verificava se a instância
  ainda estava focada.
- A Home agora verifica o foco da tela e `(tabs)` no topo do Root Stack e usa
  `router.navigate` para o destino estático. A semântica `NAVIGATE` do Stack
  reutiliza a rota ativa quando ações rápidas são processadas em sequência.
  Landing e seleção de cliente também consultam `navigation.isFocused()` no
  próprio handler; isso bloqueia callbacks de rotas cobertas após a liberação
  do guard sem esperar um novo evento `focus`. O mesmo padrão comprovado na
  seleção Clientes → formulário recebeu a verificação de foco.
- Os guards existentes e os eventos de transição do Native Stack foram
  preservados. Não houve mudança em Firebase, dados, regras de negócio,
  persistência, animações ou componentes nativos.
- Validação sintética: 3 suítes direcionadas, 29 testes aprovados; TypeScript
  passou. As regras ESLint passaram nos arquivos alterados; a regra Prettier
  precisou ser excluída nos arquivos preexistentes em CRLF para não normalizar
  seus finais de linha. `git diff --check` passou; a suíte encerrou normalmente
  sem `--forceExit`.
- Ainda falta repetir cold start, toque imediato após voltar por botão/gesto e
  contagem da pilha no iPhone físico. As mudanças são somente TypeScript/TSX:
  Fast Refresh na Development Build existente basta para a validação inicial;
  não é necessária nova compilação nativa.

## Finanças, navegação de entregas e operação offline — auditoria (2026-11-04)

- O carregamento de Finanças Atacado é local à tela focada; o estado `loading`
  de `useFinancialData` não é usado como gate global nem pela exclusão no
  Histórico. Ao carregar um período sem snapshot persistido, a UI ainda depende
  das leituras remotas específicas para confirmar os dados; as consultas de
  entregas e custos, e as leituras diária e mensal, agora começam em paralelo.
- Snapshots de período financeiros existentes são exibidos antes da
  revalidação. A paralelização reduz esperas em série, mas ainda não foi medida
  em iPhone físico e não elimina a dependência de rede quando não há snapshot.
- A navegação para seleção de cliente e detalhe de entrega continua usando
  Native Stack/`router.push`, com proteção síncrona contra toques repetidos;
  a proteção é liberada ao recuperar foco. A criação bloqueia uma segunda
  submissão enquanto o primeiro pedido aguarda confirmação.
- A inicialização local do Firestore não configura cache persistente nativo;
  o SDK usa sua configuração padrão em memória. O app tem caches AsyncStorage
  próprios em fluxos específicos, mas não existe fila durável geral de mutações
  de entregas. Criação, edição e exclusão só são confirmadas após resposta do
  Firestore; suporte a gravações offline com reconciliação exige projeto
  separado, sem migração automática.
- Não foi possível medir cold start, latência de rede, renderização ou
  comportamento offline em iPhone neste ambiente. Os testes locais comprovam
  início concorrente das leituras e proteção contra duplicatas, não os tempos
  percebidos em aparelho.

## Integridade de Cost Settings e Car Settings — Etapa 1 (2026-11-04)

- `Cost Settings` agora considera somente mudanças locais explicitamente
  pendentes e válidas para gravação. Dados locais antigos não recriam registros
  diários ou mensais ausentes no Firestore; alterações em registros existentes
  usam atualização parcial sem recriar um documento removido em concorrência.
  Um snapshot Firestore vindo do cache local ou com gravações pendentes não é
  tratado como autoridade completa para sincronização.
- `Car Settings` usa chave local versionada e vinculada ao UID, além de estado
  em memória por UID e `sessionVersion`. A chave legada sem proprietário fica
  intacta e é ignorada; não há migração automática. A confirmação remota de
  ausência não transforma cache antigo em criação remota.
- Testes unitários focados passaram para cache antigo, ausência/exclusão remota,
  escopo entre contas, callbacks tardios, gravações concorrentes, transação de
  criação, falha remota e falha de persistência. A integração sintética no
  Firebase Emulator foi preparada, mas não executou porque o processo Java do
  emulador falhou ao criar loopback neste ambiente. Nenhuma chamada ou mutação
  foi feita no Firebase de produção; equivalência no Emulator e validação em
  iPhone permanecem pendentes.

### Encerramento da validação local (2026-11-04)

- Atualização posterior à tentativa inicial acima: o usuário executou
  `Stage1Persistence.emulator.test.ts` no Windows, contra os Emulators locais de
  Auth e Firestore, com 5 testes aprovados, 0 falhas e exit code 0. Os cenários
  cobriram exclusões remotas, cache antigo, isolamento por UID, logout/login e
  operações concorrentes. O resultado encerra a validação da Etapa 1 nos
  cenários sintéticos cobertos pela suíte; não equivale a validar dados reais,
  regras em produção, todos os estados de recuperação ou comportamento em iPhone.
- Risco residual conhecido: `FirestoreDailyMonthlyDataSource` dispara a
  invalidação de snapshots financeiros com `void financialPeriodSnapshotCache.invalidate`.
  Se `AsyncStorage.removeItem` rejeitar no app real, a rejeição pode ficar sem
  tratamento e a chave persistida pode permanecer desatualizada. A falha
  `removeItem is not a function` da primeira execução vinha do mock incompleto;
  a suíte passou após completar o mock. Nenhuma alteração funcional foi feita
  para este risco residual.

### Etapa 2 — desempenho e responsividade (auditoria estática, 2026-11-04)

- Esta etapa foi somente leitura do código atual. Não foram executados testes,
  Firebase/Emulator, build, NativeSim ou perfil em iPhone; tempos percebidos,
  jank e causa exata dos toques relatados ainda exigem medição no aparelho.
- Em Registrar Entrega → Clientes, os dois pontos de entrada encontrados
  protegem o `router.push` com um ref local: depois do primeiro toque, os
  próximos handlers retornam até a tela recuperar foco
  (`RegistrarDeliveryLandingScreen.tsx:17-30`,
  `(tabs)/registrar/index.tsx:127-140`). Isso comprova que toques repetidos
  podem ser descartados durante a transição; não comprova que o primeiro
  `onPress` esteja sendo recebido nem que o guard explique todos os casos.
- A rota Clientes reutiliza a tela de Registrar, que ainda consulta entregas do
  dia, converte, ordena e soma dados mesmo com a seção Hoje oculta; também monta
  as opções de todos os clientes de uma vez
  (`registrar-entrega/clientes.tsx:1-4`,
  `(tabs)/registrar/index.tsx:528-614,1051-1064`). O detalhe abre outro hook
  de catálogo e entregas de hoje embora a operação principal seja criar uma
  entrega (`registrar-entrega/[clientId].tsx:28-40,62-91`).
- Home → Em aberto não possui lock no handler; chama `router.push` diretamente
  (`(tabs)/dashboard/index.tsx:84-87`). Porém, Home usa o hook que também
  consulta entregas pagas, calcula rankings e monta prévias, apesar de exibir
  somente o total aberto (`useOpenPaymentClients.ts:19-67`). A tela Em aberto
  repete o hook; as prévias filtram e ordenam o histórico pago para cada cliente
  (`openPaymentClientPreview.ts:22-33`). Todos os cards, ações e menus são
  construídos por `map`, sem virtualização da lista
  (`OpenPaymentClientCards.tsx:198-260`).
- Os hooks de entregas observam uma revisão global do datasource e refazem a
  leitura do cache em memória e o filtro ao mudar a revisão
  (`useDeliveries.ts:54-58,123-138`; publicação em
  `FirestoreDeliveryDataSource.ts:1349`). O datasource compartilha uma consulta
  idêntica enquanto ela está em andamento, mas não mantém essa deduplicação
  depois que a Promise termina (`FirestoreDeliveryDataSource.ts:450-508`).
  Trabalho de filtro, formatação, ranking e cálculo ocorre sincronamente no
  JavaScript; seu custo real depende do volume de dados e requer perfil.
- Finanças Atacado inicia a carga no foco. Se não há snapshot persistido válido,
  lê a base local, entregas do período e custos do período em paralelo e espera
  as três Promises antes de publicar o snapshot; não há waterfall serial entre
  essas leituras (`useFinancialData.ts:521-605`). Com snapshot, exibe-o antes
  da revalidação. O cálculo do resumo e do comparativo é síncrono no JavaScript
  (`financeiro/index.tsx:196-254`); o comparativo mensal calcula os dois
  períodos. A carga de configurações de combustível e de rotas também pode
  causar recálculos; lucro líquido espera disponibilidade de snapshot, rotas,
  hidratação de combustível e completude remota conforme cobertura
  (`useFinancialFuelCosts.ts:14-50`,
  `financeiro/index.tsx:203-254`). Esses caminhos são candidatos a custo,
  mas o relato de aproximadamente três segundos não pode ser atribuído a uma
  Promise ou cálculo específico sem perfil por etapa no iPhone.
- Criação, edição, exclusão e alterações de status pelo datasource aguardam a
  operação remota antes de resolver; a tela de criação só volta após sucesso
  (`useDeliveries.ts:153-216`,
  `FirestoreDeliveryDataSource.ts:901-1034`,
  `registrar-entrega/[clientId].tsx:62-90`). O Histórico dispara exclusão sem
  estado local pendente ou tratamento de erro visível junto ao toque
  (`HistoryScreen.tsx:107-130`). O código confirma o caminho de espera e a
  lacuna de feedback, mas a latência e o comportamento do SDK offline não foram
  medidos nesta auditoria.
- A inspeção não encontrou um bloqueio global comum aos dois atalhos: Home usa
  handler sem lock, os guards são locais às telas de Registrar, e os overlays
  globais só aparecem nos estados próprios. A hipótese de bloqueio compartilhado
  deve ser testada com marcações de `onPressIn`, handler, decisão do guard,
  `router.push`, foco, primeiro commit e primeiro controle acionável, junto com
  duração do frame/event-loop no mesmo iPhone.
- Próxima ordem de investigação/execução proposta: (1) medir os caminhos e
  registrar baseline; (2) reduzir o trabalho comprovadamente excedente da Home
  e da seleção de clientes, preservando Native Stack e regras de negócio;
  (3) adicionar feedback por item enquanto mutações aguardam confirmação remota;
  (4) agrupar leituras e cálculos financeiros apenas onde o perfil mostrar
  duplicação/custo, mantendo comparação e cobertura histórica; (5) avaliar
  virtualização com contagens e perfil, preservando ContextMenu e previews
  nativos. Nenhuma otimização foi implementada nesta etapa.
- Mudanças exclusivamente TypeScript/TSX podem ser verificadas via Fast Refresh
  em Development Build compatível. Ajustes em controles SwiftUI/`@expo/ui`,
  módulos nativos, configuração/plugin ou opções nativas que alterem o Native
  Stack exigem nova Development Build. A medição final de transições e jank
  deve ocorrer no iPhone físico com o build de referência.

### Etapa 2.1 — guard de navegação de Registrar Entrega (2026-11-05)

- O log do iPhone confirmou `handler_start` → `navigation_guard_blocked` na
  rota `/registrar-entrega`, antes do `screen_focus` de retorno. A causa era o
  ref síncrono da trava continuar `true` até o `useFocusEffect` da tela voltar;
  o handler válido que chegava durante essa janela era descartado.
- Nas rotas irmãs do Native Stack raiz `/registrar-entrega` e
  `/registrar-entrega/clientes`, a trava agora é liberada no `transitionEnd`
  com `closing === true` da própria tela que iniciou o push. Isso mantém a
  proteção síncrona durante a transição de saída e libera a próxima tentativa
  antes do retorno/foco; o reset posterior por foco foi removido nesses dois
  caminhos para não abrir uma segunda janela de duplicação.
- A guarda da seleção na aba Registrar permanece sem alteração: a evidência
  fornecida confirma a falha na landing do Stack raiz, não na rota aninhada da
  aba. Nenhuma animação, regra de negócio, persistência, Firebase ou componente
  nativo foi alterado.
- Testes sintéticos simulam toque repetido antes da conclusão da transição,
  `transitionEnd` não conclusivo (`closing === false`) e o primeiro toque após
  a saída antes de novo evento de foco; o push segue único por tentativa.
  TypeScript e ESLint direcionado passaram; testes direcionados: 3 suites,
  28 testes aprovados. A sequência real de transições, gesto de voltar e toque
  imediato ainda precisa ser confirmada no iPhone. Fast Refresh com a
  Development Build existente basta; não houve mudança nativa.

### Etapa 2.1.1 — diagnóstico residual de cold start (2026-11-05)

- A captura mais recente fornecida contém 5 `handler_start`, 4 decisões
  `navigation_guard_allowed`, 1 `navigation_guard_blocked`, 4 chamadas
  `router.push` e 4 montagens de Clientes. Isso é compatível com um push por
  handler aceito; não comprova telas duplicadas porque a captura não contém
  transições Native Stack nem o estado/quantidade de rotas no momento de cada
  evento. Houve ainda foco, blur e unmount sem identidade estável por instância.
- Causa confirmada da ambiguidade de diagnóstico: o baseline guardava um único
  contexto de trace por tipo de fluxo. `startStage2Flow` podia substituí-lo e o
  cleanup de outra instância consultava o contexto mais recente pelo fluxo,
  atribuindo foco/blur/unmount ao trace errado. A instrumentação agora mantém
  identidade e contexto por instância; isso corrige a correlação, não o guard.
- Instrumentação temporária, somente em desenvolvimento, registra handler,
  origem/destino com rótulos permitidos, decisão do guard, ID de interação,
  `transitionStart/End`, foco, blur, mount, unmount, contagem de listeners
  instrumentados e um retrato sanitizado do estado de navegação JS. O retrato
  não inclui params, chaves ou estado nativo interno e não deve ser tratado como
  prova isolada da profundidade real do Native Stack. Também registra cada
  tarefa de hidratação do cold start e a liberação/saída do SplashGate, sem UID,
  nome, valor financeiro ou payload.
- A hidratação inicial observada em `AppShell` chama caches próprios de clientes,
  entregas e rotas, AsyncStorage de Cost/Car Settings e carregamento de fonte;
  essas tarefas não consultam servidor Firestore. Leituras remotas de dados da
  tela podem ocorrer em paralelo depois do foco. Não há evidência de que essas
  leituras causem as duplicações; a relação com atrasos de toque ainda requer
  duração dos eventos e perfil do iPhone na mesma execução.
- `StaleCostSettingsOperationError` permanece classificado como cancelamento
  local esperado quando uma operação perde validade (sessão/operação obsoleta),
  capturado pelo hook sem rejeição não tratada. A condição também pode se tornar
  falsa no cleanup do efeito; o hook converte a rejeição em `false`, e o gate
  `beforeWrite` então pula a mutação remota. O aviso de desenvolvimento usa uma
  mensagem genérica de falha de gravação local; a captura não distingue
  invalidação por sessão de cleanup do efeito nem prova se a edição local foi
  gravada/reapresentada. Nenhuma persistência ou mensagem de erro foi alterada
  nesta etapa.
- Nenhuma causa funcional nova foi comprovada, então guards, navegação e
  transições da Etapa 2.1 foram preservados sem alterações de comportamento.
  Testes sintéticos direcionados: 3 suites, 24 testes aprovados; TypeScript
  passou; ESLint direcionado passou com `endOfLine: auto`, preservando as
  terminações CRLF existentes. Nenhum Firebase, Emulator, build ou iPhone foi
  executado. A validação real exige repetir o cold start e o retorno por gesto
  e botão na Development Build do iPhone, enviando somente logs
  `[STAGE2_BASELINE]`. Fast Refresh basta; nenhuma mudança nativa foi feita.

A validação parcial no NativeSim informada pelo usuário refere-se somente ao
checkpoint histórico `5dfc143`; não valida o HEAD auditado nem comprova
comportamento em iPhone físico. Este registro vale para o checkout `Codex`; as
demais branches não foram alteradas nesta tarefa e suas versões devem ser
verificadas em seus próprios manifests.

A Skill global `$sync-codex-antigravity-main-opencode` sincroniza manualmente
somente `ajustes-codex`, `Antigravity`, `opencode` e `main`, usando
`ajustes-codex` por padrão ou `Antigravity`/`opencode` quando uma dessas origens
for escolhida explicitamente. `main` é destino nessa Skill, nunca origem.
`Codex` ainda não participa desse processo; sua incorporação à sincronização
será feita posteriormente em uma tarefa específica. A sincronização atual é
manual; não existe automação equivalente por GitHub Actions implementada.

Antes de alterar arquivos, cada agente deve verificar no Git a raiz do checkout,
a branch ativa e o estado do working tree. Não deduza a branch pelo nome da
pasta, pelo agente ou por este snapshot. Mantenha a documentação operacional
consistente entre os checkouts oficiais, sem variantes específicas por ambiente.
As menções às branches nas seções posteriores deste documento registram o
histórico das entregas e devem ser preservadas como histórico.

## Home, Configurações e Histórico — apresentação atual (2026-10-21)

- Os títulos grande e compacto das Homes Atacado e Varejo exibem `Home` e são
  texto estático, sem affordance ou semântica de botão. A troca de modo é aberta
  pelo controle da toolbar e continua usando `modeSelector.open` e o `NativeSheet`
  compartilhado. O título grande usa `37 pt` tanto no SwiftUI quanto no fallback;
  o tamanho do título compacto permanece inalterado.
- Configurações alinha o título grande e o conteúdo inicial dos cards ao mesmo
  inset vertical usado por Home e Finanças, sem alterar o layout compartilhado
  de `ProgressiveCollapsibleScreen`.
- O `(tabs)` conserva a `UINavigationBar`/`Stack.Toolbar` compartilhada, a
  âncora leading nativa de `44×44 pt`, o shared background e o morph Liquid Glass.
  No Atacado, o slot direito contém uma cápsula nativa de `100×44 pt` com duas
  ações SwiftUI independentes de `44×44 pt`: `cube` para modo e `magnifyingglass`
  para `/pesquisa`. Os símbolos têm `22 pt`, centros separados por `56 pt` e
  `12 pt` de espaçamento. No Varejo, o slot contém somente o controle de modo de
  `44×44 pt`, sem espaço reservado para busca.
- O seletor de modo mantém o `NativeSheet` existente e seu detent de `0.4`. Atacado
  e Varejo são cards SwiftUI independentes, de largura igual, altura mínima de
  `72 pt`, gap de `12 pt` e raio de `22 pt`; a altura pode crescer com Dynamic
  Type. Cada card inteiro é selecionável e preserva o haptic existente.
- No Histórico Atacado, Dia/Mês/Ano agora aparecem sob um único item nativo de
  toolbar com shared background. O menu da data mantém as opções nativas de dia,
  mês e ano; o Histórico Varejo mantém seu `NativePeriodActionGroup`.
- Os ajustes visuais descritos aqui são TS/TSX, foram aprovados pelo usuário no
  iPhone e não acrescentam código nativo; atualizações do app usam Fast Refresh
  e não exigem nova iOS Development Build. A cápsula aprovada mantém sua
  geometria de `100×44 pt`.

## Widget iOS de entregas do dia — estado publicado em 2026-10-20

- A conclusão pelo widget usa o App Intent `RigattiDeliveryCompletionIntent`.
  Antes da chamada de rede, o estado `pending` e o identificador da ação são
  gravados no App Group e o WidgetKit é solicitado a recarregar a timeline; o
  item só sai da lista depois da confirmação canônica de
  `deliveryWidgetActions`. Falhas restauram o item como tentativa disponível
  com indicador de erro. A atualização da timeline do app preserva ações em
  andamento e confirmações locais para evitar regressões por snapshots antigos.
- O protocolo `responseVersion: 2` retorna somente a confirmação da entrega e
  evita reler a lista completa do dia na transação. A função mantém resposta
  completa para widgets já instalados que usam o protocolo anterior; a
  otimização passa a valer após publicar `deliveryWidgetActions`.
- A função ainda precisa de deploy separado e a mudança do config plugin gera
  código nativo Swift, portanto testar o fluxo exige uma nova iOS Development
  Build. A publicação deste snapshot não inclui deploy, prebuild, compilação ou
  validação em dispositivo.

## Live Activity iOS Atacado e Dynamic Island — ciclo automático (2026-10-21) e apresentação vigente (2026-11-05)

Este bloco registra o comportamento presente no código da branch `Codex`,
incluindo as alterações de ciclo automático e encerramento pelo widget. Ele
descreve implementação e testes automatizados; não afirma validação física.

- A Live Activity de Atacado é implementada em
  `src/features/deliveries/liveActivity/` com `expo-widgets` e
  `createLiveActivity('WholesaleDeliveryLiveActivity', ...)`. No iOS, o pacote
  gera a integração nativa com ActivityKit/WidgetKit. Ela é separada dos
  widgets da Tela de Início (`widgets[]`) e do App Intent de conclusão de
  entrega.
- O coordenador é conectado no layout raiz e associa a atividade à sessão e ao
  UID autenticado. O início é automático quando há entregas pendentes no dia,
  somente depois de existir um snapshot remoto completo e enquanto o app está
  ativo. Cache, consulta parcial ou filtrada não habilitam o início. Ao abrir
  ou retomar o app, o coordenador recupera a atividade existente, reconcilia o
  dia e evita duplicatas. A ação manual de iniciar/encerrar foi removida da
  toolbar de `/registrar-entrega`.
- `LiveActivityProjection` é a projeção canônica: `deliveryCount` e
  `bucketCount` representam entregas e baldes pendentes;
  `completedDeliveryCount` conta entregas concluídas e `totalDeliveryCount`
  conta todas as entregas do dia. Baldes seguem
  `financialCalculationService.calculateQuantidade`. A mesma projeção alimenta
  os dados do widget Entregas do Dia.
- Visual histórico de 2026-10-21: no modo compacto, `leading` usa a marca branca
  do Splash atual em 25 pt, compartilhada com a extensão pelo App Group, e
  `trailing` exibe somente o número reativo de entregas pendentes. O modo minimal
  usa a mesma marca em 24 pt. Na expansão, `leading` usa a marca em 42 pt,
  alinhada à direita de sua região nativa; `trailing` mostra a data discreta
  curta, sem ano; `center` apresenta números em negrito para entregas e baldes
  pendentes lado a lado com os labels `Entregas` e `Baldes`; e `bottom` usa um
  Gauge linear azul com `concluídas / total`. O Gauge usa o estilo nativo
  `linearCapacity` em tamanho extra grande, com espaçamento horizontal padrão.
  A fração é concluídas dividido pelo total,
  atualizada pela projeção; com total zero, a barra vale zero e o texto é
  `0 / 0`. A composição usa as regiões nativas `expandedLeading`,
  `expandedTrailing`, `expandedCenter` e `expandedBottom`, sob o fundo preto
  nativo. O banner da Tela Bloqueada mantém o ícone, Atacado, data, Baldes e
  Entregas; agora ocupa a largura disponível e alinha esses itens pela borda
  leading, sem mudar ordem ou espaçamento interno.
- Apresentação vigente, atualizada em 2026-11-05: a barra da Tela Bloqueada usa
  a marca do app à esquerda e, à direita, o título `Entregas`, Gauge de
  progresso concluídas/total e fração `concluídas/total`. Ela não mostra mais
  o rótulo Atacado, a data em estado atual, baldes nem o total pendente. Quando
  `props.isObsolete` ou `environment.isStale` for verdadeiro, uma legenda
  discreta aparece abaixo do progresso: `Dados desatualizados · DD/MM/AAAA`,
  usando a data do snapshot. Em estado atual, essa legenda não ocupa espaço.
  No Dynamic Island compacto e minimal, a marca e o contador pendente são
  mantidos. Na expansão, a data trailing foi removida, os números passaram à
  fonte rounded, a marca foi ampliada de 42 para 48 pt, e o Gauge inferior
  passou de azul para verde claro; contagens e cálculo de progresso não mudaram.
- Snapshots completos e mutações do app confirmadas remotamente — adicionar,
  editar, excluir e marcar/desmarcar como entregue — atualizam a atividade sem
  reiniciá-la. As alterações nos contadores pendentes, concluídas ou total
  também publicam novo conteúdo quando só o progresso mudou. Quando a última
  entrega pendente é confirmada, o app envia o conteúdo final e encerra a
  Live Activity imediatamente. Se ActivityKit rejeitar o encerramento, o
  estado final permanece e uma reconciliação posterior tenta novamente.
- Após o encerramento normal por conclusão, o ownership é limpo; se outra
  entrega pendente for adicionada depois, uma nova atividade pode iniciar. Se a
  atividade for dispensada manualmente pelo sistema, o ownership local fica
  como tombstone para impedir que o app a recrie para os mesmos IDs naquele
  UID/dia. Um novo ID de entrega pendente permite reativá-la.
- A conclusão acionada no widget usa `RigattiDeliveryCompletionIntent`, que
  conforma `LiveActivityIntent` e não abre a interface. Depois do ACK remoto e
  da persistência da timeline confirmada no App Group, o intent solicita o
  reload final de `EntregasDoDia` e atualiza ActivityKit pela projeção
  compartilhada. Se não restarem entregas pendentes, encerra a atividade
  imediatamente; caso contrário, atualiza os contadores. O reload inicial de
  `pending` preserva a resposta visual imediata. Esse caminho não depende do
  processo JavaScript ativo nem de APNs; o WidgetKit controla quando a timeline
  recarregada é efetivamente renderizada.
- A atividade guarda somente o identificador opaco da sessão para validar a
  conta; UID e dados financeiros não são copiados para seu estado. Não há
  listener Firestore `onSnapshot` nem push remoto habilitado
  (`enablePushNotifications: false` em `app.config.js`); mudanças externas aos
  fluxos do app/widget podem aguardar a próxima consulta completa. Se um
  snapshot pendente chega quando o app está em background/inativo, o coordenador
  aguarda o primeiro plano para iniciar. Ao retomar, consulta o dia atual.
- `staleDate` aponta para a próxima meia-noite local. Isso marca os dados como
  stale, mas não encerra a ActivityKit automaticamente; a reconciliação ao
  voltar ao primeiro plano pode marcá-la obsoleta e publicar dados atuais.
  No banner da Tela Bloqueada, ambas as condições agora têm indicação visível
  de dados desatualizados; a barra de progresso ainda representa o último
  snapshot disponível e não deve ser interpretada como dado atualizado.
  Logout/troca de UID encerra as instâncias, e a recuperação remove atividades
  sem ownership válido e duplicatas. A autorização de Live Activities do iOS
  pode rejeitar o início automático.
- O toque na atividade abre o deep link `/historico?mode=wholesale`, que entra
  no Histórico em modo Atacado. A URL é convertida com `expo-linking` pelo
  adaptador iOS.
- `supported` indica disponibilidade do driver nativo; a autorização do
  sistema para Live Activities é verificada pelo módulo nativo ao iniciar. Se
  estiver desativada, a toolbar ainda pode parecer disponível e a ação retorna
  erro genérico. Também pode haver erro reportado depois que ActivityKit já
  encerrou a atividade se a limpeza do ownership local falhar.
- As instrumentações temporárias de diagnóstico de toolbar morph, rendering,
  conclusão, snapshots, sincronização e runtime de widgets foram removidas.
  Permanecem logs nativos de falhas operacionais, sem tracing de fluxo normal.
- A implementação visual/projeção anterior registrou 5 suítes direcionadas (38
  testes). No ajuste visual de 2026-10-21, passaram 4 suítes direcionadas (32
  testes). Para o ciclo automático, passaram 4 suítes direcionadas (40 testes),
  TypeScript e ESLint nos arquivos alterados. Essas verificações automatizadas
  não comprovam a apresentação ou o ciclo real no iPhone. A validação física
  ainda está pendente; o config plugin Swift exige nova iOS Development Build
  para validar a conclusão pelo widget e o encerramento ActivityKit. Nenhuma
  build ou validação física foi feita nesta atualização. A afirmação histórica
  de que Live Activities/Dynamic Island não haviam sido adicionadas vale
  somente para o checkpoint histórico correspondente.

## Live Activity iOS do Rastreamento GPS — implementação em 2026-10-21

- O rastreamento GPS possui a atividade independente
  `RouteTrackingLiveActivity`, criada com `expo-widgets` e ActivityKit. Ela usa
  fábrica, coordenador e ownership próprios; não encerra nem atualiza a Live
  Activity Atacado, cujo contrato permanece em
  `src/features/deliveries/liveActivity/`.
- O início é automático depois que a sessão local da rota foi confirmada e
  `expo-location` confirmou o início das atualizações. A identidade local da
  ActivityKit associa UID, `routeId`, `startTimestamp` e ID da atividade.
  Repetições do início são idempotentes. A reconciliação ocorre ao autenticar e
  ao retomar o app, sem iniciar uma rota GPS por conta própria. Logout/troca de
  UID encerra somente atividades GPS desta fábrica.
- A fonte exclusiva dos quilômetros é `accumulatedDistanceMeters` do registro
  ativo produzido por `RouteTrackingRepository` e `routeTrackingMath`. O
  `LocationTrackingTask` chama o coordenador somente depois que
  `appendLocationSamplesForBackground()` retorna a rota aceita e persistida.
  A atividade recebe distância acumulada, timestamps e `routeId`; não recebe
  coordenadas. A tela Localização não é necessária para esse caminho.
- O app já solicita localização por distância e usa lotes/deferimento do
  serviço GPS existente (`distanceInterval: 25` e
  `deferredUpdatesDistance: 50`). A atividade publica quando um lote persistido
  altera o valor exibido em décimos de quilômetro; lotes repetidos e mudanças
  menores que não alteram esse valor são coalescidos. Ao parar, sempre envia o
  snapshot final. Não foi adicionado timer JS, consulta Firestore ou aumento da
  frequência de GPS. O iOS pode adiar/suspender execuções e limitar quando
  ActivityKit renderiza atualizações; não há intervalo garantido. Se o usuário
  encerrar o app, o Expo Location para as atualizações em background; ao abrir
  novamente, o app reconcilia a rota ativa e pode retomar o serviço se as
  permissões permitirem. A distância na Activity não avança enquanto nenhuma
  tarefa de localização é executada; a rota local continua sendo a fonte
  persistida.
- O tempo usa `Text(timerInterval:)` do SwiftUI, ancorado no
  `startTimestamp` persistido e sem `setInterval` JavaScript. Ao parar, a
  apresentação recebe o `endTimestamp` confirmado como pausa final. A faixa
  ativa é limitada a oito horas, em alinhamento com o limite documentado de
  atividade ativa pelo ActivityKit; a plataforma pode encerrar a atividade e
  controlar sua permanência na Tela Bloqueada.
- Compacta: asset original ER do splash dark à esquerda e seta de navegação
  branca à direita; a apresentação minimal usa somente a seta. Expandida: ER em
  `expandedLeading`, seta em `expandedTrailing`, status discreto em
  `expandedCenter` e quilômetros/tempo em duas colunas em `expandedBottom`.
  A Tela Bloqueada usa os mesmos dados e timer. O fundo da Dynamic Island é
  nativo; textos, símbolo e opacidade do monograma se adaptam a
  `isLuminanceReduced`. O layout não aplica offsets sobre a área dos sensores.
  O toque abre `/configuracoes/localizacao`. Quando Atacado e GPS coexistem, o ActivityKit
  decide qual atividade destacar; o código não força prioridade.
- Falhas, indisponibilidade ou desativação da Live Activity não desfazem o
  início, a gravação ou a conclusão da rota. Encerrar a rota publica o snapshot
  local final confirmado e encerra imediatamente somente a atividade GPS
  correspondente. Rotas novas usam distância e tempo próprios. Um tombstone
  local evita recriar a mesma atividade se ela foi dispensada pelo usuário ou
  sistema.
- A validação automatizada desta implementação passou: TypeScript, ESLint
  direcionado, formatação Prettier dos novos módulos e 4 suítes direcionadas
  (84 testes). Esses resultados validam tipos e regras de coordenação; não
  comprovam atualização real de ActivityKit em background, layout nativo ou
  escolha de apresentação do iOS. A validação em iPhone físico está pendente.
  Como o novo `createLiveActivity` integra a extensão
  `expo-widgets` ao app iOS, validar o runtime requer nova iOS Development
  Build. Não foi executada build nesta implementação.

## Histórico — manutenção e validações do Expo SDK 57 (2026-10-03)

Este bloco registra o estado do checkout `ajustes-codex` naquele checkpoint.
Foi mantido como histórico e não descreve as versões atuais do checkout `Codex`.

- A manutenção de dependências do Expo SDK 57 foi concluída e checkpointada
  na branch `ajustes-codex`. `npx expo install --check` retorna zero
  divergências. Consulte o Git para o HEAD e o estado de publicação atuais;
  este snapshot não fixa o SHA do próprio documento.
- Versões estruturais: Expo `57.0.26`; React Native `0.86.3`; Expo Router
  `57.0.24`; expo-modules-core `57.0.20`; expo-modules-jsi `57.1.1`;
  expo-modules-autolinking `57.0.13`; react-native-screens `4.26.2`;
  @expo/ui `57.0.21`; expo-glass-effect `57.0.4`.
- Navegação: @react-navigation/native `7.5.0`, core `7.23.0`, elements
  `2.9.44` e react-native-drawer-layout `4.2.11`.
- Módulos nativos relevantes: expo-location `57.0.20`,
  expo-task-manager `57.0.21`, expo-notifications `57.0.21`,
  expo-maps `57.0.3`, expo-splash-screen `57.0.9`,
  expo-file-system `57.0.7`, expo-camera `57.0.6`,
  expo-media-library `57.0.5`, expo-document-picker `57.0.3`,
  expo-sharing `57.0.22`, expo-haptics `57.0.3`,
  expo-local-authentication `57.0.3`, expo-blur `57.0.3`,
  expo-font `57.0.4`, expo-linear-gradient `57.0.2`,
  expo-image `57.0.5`, expo-crypto `57.0.3`, expo-web-browser
  `57.0.3` e expo-dev-client `57.0.19`. O Dev Launcher está em
  `57.0.20` e o Dev Menu em `57.0.18`.
- O usuário executou uma build iOS Simulator pelo perfil EAS
  `cloud-simulator`; a compilação terminou com sucesso e o app foi aberto
  no Appetize sem Metro. Esse resultado valida a build de simulador e o smoke
  test realizado, mas não substitui a validação de uma Development Build com
  Metro ou em iPhone físico.
- O smoke test no Appetize não observou regressão funcional ou visual evidente
  em startup/splash, navegação, NativeTabs, Native Stack, push/pop, swipe-back,
  toolbar/Search/Avatar, títulos Atacado/Varejo, sheets/BottomSheet,
  Liquid Glass/UI e mapas/fluxos acessíveis no simulador.
- Permanecem preservados o coordinator nativo da toolbar compartilhada em
  `plugins/withRNScreensHideBottomBarWhenPushed.js`, o large title da Home
  com `Host matchContents` e
  `ignoreSafeArea={isHomeLargeTitle ? 'container' : undefined}`, o patch do
  BottomSheet com `.ignoresSafeArea(.container, edges: .bottom)`, o patch
  versionado de expo-backdrop e NativeTabs/Native Stack/Stack.Toolbar.

### NativeTabs com quatro abas — atualizado em 2026-10-09

- `src/app/(tabs)/_layout.tsx` mantém Expo Router `NativeTabs`, SF Symbols,
  labels ocultos, toolbar compartilhada e sizing nativo. A ordem agora é Home,
  Finanças, Histórico e Configurações; o gatilho Registrar foi removido. Não
  houve ajuste manual de dimensões ou implementação RN da barra.
- A Home Atacado preserva os quatro cards existentes; Registrar Entrega segue
  para `/registrar-entrega`. A Home Varejo preserva Registrar Pedido e o fluxo
  de sucesso agora retorna para `/(tabs)/dashboard`, sem navegar para a aba
  removida.
- Dados Diários continuam acessíveis por Configurações e pela rota `/dados`,
  com `CostsEditorScreen`, `useCostSettings` e as telas/sheets de registro
  preservados. Rotas raiz e Quick Actions continuam registrados.
- O indicador selecionado continua sob controle da NativeTabs/UIKit. Com
  quatro itens, a cápsula deve ser redistribuída pelo sistema; a aparência real
  e a largura resultante ainda precisam de validação no iPhone.
- A mudança é somente TSX e não exige nova Development Build para Fast Refresh.
  A validação física deve usar a nova Development Build descrita abaixo, pois a
  instalada no iPhone é anterior à manutenção do SDK 57.

### Validação que permanecia pendente em iPhone físico naquele checkpoint

A Development Build instalada anteriormente no iPhone foi compilada antes
desta manutenção e não valida as novas versões nativas. Uma nova Development
Build para iPhone e Metro continua necessária. Permanecem pendentes no aparelho:

- localização em background por período prolongado e transição de permissão
  When In Use para Always;
- retomada/restauração real do tracking após suspensão ou encerramento do app;
- APNs e push remoto;
- Face ID;
- câmera e fototeca;
- haptics físicos;
- lifecycle real de suspensão/encerramento do iOS;
- inicialização do Dev Client, conexão/reload do Metro e Dev Menu na nova build.

### Baselines automatizados conhecidos

As falhas abaixo já eram conhecidas na manutenção e não foram classificadas
como regressões do update:

- react-native-worklets/loadUnpackers;
- ExpoModulesCoreJSLogger / `Cannot log after tests are done`;
- mock de `@/theme` sem `getInsetSurfaceColor` em
  RetailOrderPaymentSheet;
- divergências de `useFinancialData`;
- flags em FirebaseActivationGate/FirebaseReadinessGate;
- seleção de MockAuthDataSource;
- expectativa textual antiga em PremiumScreenCollapsibleTitle;
- asserções textuais de RegistrarWholesaleIconPresentation;
- Firebase ESM em DailyDataDataSource.

Essas falhas permanecem sem correção nesta rodada.

## Atualização funcional validada no iPhone — 2026-09-29

### Seletor de categorias de Finanças iOS

- Atacado e Varejo usam o seletor SwiftUI de categorias dentro do fluxo rolável
  React Native. Seu `Host` mantém `ignoreSafeArea="all"` para que a composição
  SwiftUI/Liquid Glass acompanhe o scroll e saia da viewport junto do conteúdo.
- A validação física confirmou que, sem essa configuração, o frame do Host
  acompanhava o scroll enquanto a representação SwiftUI ficava retida; com
  `ignoreSafeArea="all"`, o desacoplamento desapareceu.
- A alteração é TSX e usa a API já disponível no `@expo/ui` instalado; não exige
  nova Development Build.

## Seletor de períodos — estado publicado em 2026-10-02

- `NativeRetailFinanceCategorySelectorSwiftUI.ios.tsx` mantém o modo `native`
  como padrão e permite ativar explicitamente `slidingBubble` por consumidor.
  Finanças Atacado, Finanças Varejo e Histórico Atacado optam por esse modo;
  Histórico Varejo continua usando `NativeSegmentedControl`.
- No caminho `fillAvailableWidth`, os slots e a cápsula usam
  `containerRelativeFrame` com `count: items.length`; a cápsula persistente tem
  a largura de um slot e sua posição deriva do índice selecionado, inclusive
  quando `scrollable={false}`. A animação usa `easeInOut(0.22s)` e Reduce Motion
  usa `easeOut(0.18s)`.
- A publicação passou TypeScript, ESLint direcionado, Prettier e os testes
  direcionados de Finanças e Histórico. A validação visual física da animação
  do Histórico Atacado foi confirmada no iPhone. A alteração é TS/TSX e pode ser
  conferida por Metro/Fast Refresh; não exige nova Development Build.

## Snapshot operacional validado no working tree — 2026-09-27

Este bloco registra o estado funcional validado no working tree a partir do
HEAD de referência do snapshot base acima. A migração foi publicada depois em
`2fc6bfe`; o código/Git atual continua sendo a fonte da verdade em caso de
divergência com seções históricas deste documento.

### Finanças Atacado — primeiro carregamento do Lucro Líquido (2026-09-28)

- No cold start, o bootstrap autenticado hidrata dos caches locais existentes as
  configurações de custos, as configurações do veículo e o resumo financeiro das
  rotas antes de liberar a tela raiz.
- Finanças inicia com os resumos de rota já disponíveis em memória e permite que
  o cálculo do combustível use as configurações em cache. Assim, o card
  `Lucro Líquido` pode apresentar o valor no primeiro frame, junto de
  `Faturamento`.
- A ausência de snapshot local de rotas permanece como dado ainda não carregado;
  não vira lista vazia considerada completa. A revalidação remota existente
  continua, sem leitura Firestore adicional. Fórmulas e demais cards não mudam.

### Variantes iOS — estado confirmado em 2026-09-28

- Dev/standard usa `com.pareact.mobile`. O profile `development` não define
  `APP_VARIANT`, e `cloud-simulator` define `APP_VARIANT=standard`; ambos caem
  na configuração padrão do `app.config.js`.
- O Release usa `com.pareact.mobile.release`. O profile EAS `production` fixa
  `APP_VARIANT=release` no ambiente `production`; `app.config.js` seleciona
  `GoogleService-Info.release.plist`, `Empório Rigatti` e o scheme
  `pareact-release`. `src/config/appVariant.ts` reconhece a variante para
  Google Sign-In, navegação raiz e notificações.
- O Firebase iOS app `Empório Rigatti Release`
  (`1:83092109834:ios:c5754801f9d9ebda163df3`) foi registrado no projeto
  existente `venda-e-faturamento`, para o bundle
  `com.pareact.mobile.release`. Seu plist foi obtido do Firebase e confirma
  `PROJECT_ID=venda-e-faturamento`; o plist `.final` não é reutilizado.
- Dev/standard permanece em `com.pareact.mobile` e
  `GoogleService-Info.plist`. A variante `.final` e seu plist/script permanecem
  como configuração legada separada; não são selecionados pelo profile
  `production`. As referências `.final` nas seções históricas abaixo descrevem
  esse estado legado e foram preservadas.

### Pesquisa e composer

- `/pesquisa` usa `HomeSearchAttachmentsComposer` com `TextInput` e
  `OverKeyboardView` de `react-native-keyboard-controller`. O tap no `+`
  preserva o menu tradicional Câmera/Fotos/Data/Arquivos; o long press usa um
  gesto exclusivo e abre o `PhotoHoldMenu` com até quatro fotos recentes,
  permitindo hover por arraste e seleção no release. O hold não abre a grade
  completa nem o `AttachmentPanel`.
- O loading da busca usa `NativeThinkingOrb` no estado `searching`, por meio do
  módulo Expo local `native-thinking-orb`, com fallback `ActivityIndicator`.
  Os fontes incorporados mantêm a licença MIT e `THIRD_PARTY_NOTICES.md`.
- O controle de intensidade usa o módulo Expo/SwiftUI local
  `native-model-intensity-slider`. O arraste visual é contínuo e nativo; os
  steps semânticos permanecem discretos. Soltar aplica snap e atualiza o step,
  mas não fecha o overlay. O fechamento é separado e ocorre por dismiss
  externo, pedido nativo/Escape, toggle explícito ou exclusividade com os
  attachments/fotos. O parser, a busca e o submit não são controlados pelo
  slider.
- Os dois hosts SwiftUI dos intensity pickers podem estar em
  `UIRemoteKeyboardWindow`, enquanto os botões de origem ficam na `UIWindow` do
  app. `IntensityCoordinateConverter` converte pela coordinate space da tela
  entre as janelas, após validar compatibilidade geométrica do display; não
  exige identidade entre objetos `UIScreen` e continua rejeitando displays
  geometricamente incompatíveis.
- `expo-backdrop@0.1.1` permanece compatível com `expo-blur` por patch-package
  versionado que renomeia somente a classe Swift interna do backdrop; a API JS
  e o nome de módulo exposto permanecem preservados. Como o patch altera código
  nativo iOS, sua inclusão exige uma nova Development Build.

### Toolbar da Home

- O `(tabs)` preserva uma única `UINavigationBar`/`Stack.Toolbar` compartilhada
  no Stack raiz e o coordinator nativo de sincronização entre tabs. NativeTabs,
  Native Stack, navegação e morph Liquid Glass não foram substituídos por uma
  toolbar React Native.
- A Home mantém um `Stack.Toolbar.View` real de `44×44 pt` no slot esquerdo,
  neutro e não interativo, com `hidesSharedBackground`. Ele é uma âncora de
  materialização necessária ao reveal inicial nativo; um `Spacer`/fixed-space
  de mesma largura não preservou esse efeito, e a âncora oculta o background
  compartilhado para não desenhar uma cápsula vazia.
- No Atacado, `NativeHomeToolbarActions` fornece uma cápsula compartilhada de
  `100×44 pt`, com `cube`/modo à esquerda e `magnifyingglass`/`/pesquisa` à
  direita. Cada botão tem hit area de `44×44 pt`; os símbolos têm `22 pt`, os
  centros ficam a `56 pt` e o espaçamento é `12 pt`. No Varejo, o mesmo slot
  mostra somente `cube`/modo, em `44×44 pt`, sem espaço para busca. A ação de
  modo reutiliza `modeSelector.open`; a busca continua navegando para
  `/pesquisa`. O perfil permanece no slot direito de Configurações.
- A cápsula continua dentro do `Stack.Toolbar.View` nativo, com shared background
  e morph Liquid Glass. O estado de Varejo mantém o shared background sem
  adicionar uma segunda área visual. Os ajustes de dimensões e títulos são
  TS/TSX e não exigem nova iOS Development Build.

### Apresentação dos Bottom Sheets

- `NativeBottomSheet` e `NativeDailyDataSheet` aceitam configuração por
  consumidor para a cor nativa da apresentação e
  `presentationBackgroundInteraction`. O default compartilhado continua
  `enabled`; não se deve habilitar dimming globalmente.
- Modo de venda, Perfil, Registrar Entrega e Dados Diários optam pela superfície
  sólida nativa (`#F3F4F5` no Light Mode e `#1C1C1E` no Dark Mode) e por
  `presentationBackgroundInteraction="disabled"`, deixando o iOS escurecer a
  tela atrás do sheet. Os controles e materiais internos continuam
  independentes da superfície externa.
- O seletor de modo da Home usa detent de `0.4`; cada opção Atacado/Varejo
  mantém uma linha SwiftUI nativa de largura completa e altura mínima de `56 pt`.
- O Bottom Sheet de Detalhes da compra da Fábrica não faz parte desse conjunto
  de mudanças e mantém a composição que consta no código atual.

### ProgressiveCollapsibleScreen

- `ProgressiveCollapsibleScreen` é a abstração compartilhada canônica das
  superfícies migradas. Ela compõe título grande no conteúdo, fixed compact
  header, `Animated.ScrollView` com um único `scrollY` Reanimated e Progressive
  Blur usando `AnimatedBlurView`, `MaskedView`, `LinearGradient` e
  `easeGradient`.
- O pipeline base mantém offset estrutural `T - 28 pt` com compensação `+28 pt`
  no content top inset, Progressive Blur de `150 pt`, fixedHeader de `100 pt`,
  thresholds do upstream, `ScrollView` com `flex: 1`, content container com
  `flexGrow: 1`, `alwaysBounceVertical` no iOS e layers visuais que não capturam
  gestures. `fixedHeader` e Progressive Blur compartilham a mesma origem
  geométrica. A dependência usada pelo gradiente de easing é
  `react-native-easing-gradient@1.1.1`.
- As Stack routes usam a adaptação `nativeHeader` para o header nativo. As
  raízes da NativeTabs usam `nativeTabRoot`, cuja origem dinâmica é
  `B = max(0, insets.top + 44 - 70)`: o pipeline usa `B - 28 pt` e o content top
  inset recebe a compensação correspondente. Assim, fixedHeader e Progressive
  Blur movem juntos enquanto o título grande, o primeiro conteúdo/cards e as
  toolbars mantêm suas posições.
- Compact titles das Tab roots usam `18 pt`; as Stack routes continuam no
  sizing padrão de `17 pt`.
- Superfícies migradas e validadas: Home Atacado/Varejo, Finanças
  Atacado/Varejo, Registrar principal, Registrar → Dados Diários, Histórico
  Atacado/Varejo, Configurações, Pesquisa, Em aberto, Registrar Entrega,
  Documentos e Fábrica.
- Na Home, os títulos grande e compacto são estáticos e exibem `Home` nos dois
  modos. O título grande continua SwiftUI/Host; o compacto usa
  `HomeModeTitleCompactRN` com `AppText`, sem `Pressable` ou handler de modo.
  `compactTitleAccessibilityManaged` mantém a alternância de exposição
  acessível entre título grande e compacto; camadas fixas não capturam toques.
  A seleção Atacado/Varejo pertence à toolbar. O compact slot não usa Host
  SwiftUI nem `compactTitleAboveBlur`.
- A remoção do wrapper interativo/animado do título grande mantém o Host
  SwiftUI diretamente no wrapper de layout da Home, preservando o sizing nativo
  durante o retorno pela navegação. Não se adicionaram delays, offsets ou
  compensações nos cards. O pipeline de Progressive Blur e scroll permanece
  compartilhado.
- O opt-in `nativeTabRoot` do Registrar Varejo está implementado e foi validado
  fisicamente no iPhone após a correção. O usuário aprovou o alinhamento e o
  tamanho de `18 pt` do compact title, o morph/Progressive Blur e o scroll, com
  large title e primeiro conteúdo preservados.
- A implementação desta migração é TS/TSX e não exige nova Development Build.

### Pipeline legado de título colapsável

- `PremiumScreen.collapsibleTitle` não é o pipeline atual das superfícies acima.
  A API e o contexto de `NativeGlassHeader` permanecem por compatibilidade com
  o fallback legado de `RegistrarDeliveryScreen`; a rota `/registrar-entrega`
  usa `ProgressiveCollapsibleScreen`. `RegistrarDailyDataScreen` também usa
  `ProgressiveCollapsibleScreen` com `nativeHeader` e tamanho Stack padrão de
  `17 pt`; a migração foi validada fisicamente no iPhone. A remoção estrutural
  do legado exige tarefa separada.

### Builds de simulator e validação pendente

- `eas.json` contém o profile `cloud-simulator`, separado do profile de
  simulator de desenvolvimento: usa `ios.simulator: true`,
  `developmentClient: false`, ambiente `preview` e `APP_VARIANT=standard`.
  `app.config.js` seleciona a configuração padrão Empório Rigatti. Comando:
  `eas build --platform ios --profile cloud-simulator`.
- O profile está configurado, mas não há confirmação de execução em EAS,
  Appetize ou Sauce Labs neste checkpoint.
- As revisões recentes do `native-model-intensity-slider` alteraram Swift e
  requerem uma nova iOS Development Build para validar o estado final. Não
  considerar essa validação concluída apenas com testes TypeScript.
- A validação física final do pipeline de títulos descrito acima foi confirmada
  pelo usuário no iPhone; ela não substitui validações futuras de mudanças
  nativas não relacionadas a esta migração.

## Baseline funcional Retail — 2026-09-21

Os itens abaixo registram decisões de domínio e comportamento Retail já
confirmadas naquele checkpoint. Eles permanecem úteis quando não forem
contraditos pelo snapshot operacional acima.

### Custos e composição Retail

- Novas entradas de custo usam `effectiveDate` com padrão igual a hoje. Uma
  entrada existente pode ter somente sua vigência corrigida, preservando
  quantidade, valor, unidade, custo unitário normalizado e fornecedor.
- O resolver histórico escolhe o último custo com
  `effectiveDate <= referenceDate`; não usa custo futuro nem fallback
  silencioso para custo atual. Quantidade comprada serve somente para
  normalizar custo e não representa estoque.
- Versões de composição expõem `Vigente desde` por `effectiveFrom`. Uma nova
  versão pode valer desde data passada sem sobrescrever versões históricas; o
  resolver continua escolhendo a versão válida na data da venda.
- Pedidos já persistidos preservam seus snapshots e não são recalculados por
  alterações posteriores em custos ou composições.

### Finanças Retail

- As visões por categoria distribuem `deliveryCost` e `deliveryFee` reconhecidos
  por receita líquida positiva reconhecida dos produtos. Uma categoria recebe
  100%; pedidos mistos usam rateio proporcional com alocação determinística em
  centavos.
- O seletor Retail apresenta `Geral | Cestas | Salgados | Baldes`. Cada filtro
  de categoria usa o snapshot histórico da categoria do pedido.
- Pagamentos parciais, `posted`, `paidAt`, `voided` e filtros de período
  preservam as regras existentes. `deliveryCost` reduz o lucro da categoria;
  `deliveryFee` soma receita; somente a parcela reconhecida no período entra no
  rateio; `voided` não entra e `paymentFee` por categoria permanece inalterado.
- Categoria única recebe 100% de `deliveryCost` e `deliveryFee`; pedidos mistos
  usam rateio proporcional e a visão Geral permanece integralmente agregada.
- A visão Geral e `calculateRetailOrderFinancials` não foram alterados.

### Catálogo, Home e pedidos Retail

- Novo produto, Editar produto e Composição do Catálogo Varejo são páginas do
  Root Native Stack. Create e edit permanecem em formulários inline, Composição
  permanece em cards inline e `NativeRetailProductFormSheet` não participa do
  fluxo de runtime.
- A Home é contextual ao `AppMode`: `wholesale` exibe a experiência Atacado e
  `retail` exibe a experiência Varejo; ambos mostram o título estático `Home`.
  O seletor de modo fica na toolbar, e a busca `/pesquisa` permanece disponível
  somente no Atacado. A rota `/pesquisa` inicia sem sugestões visíveis e usa o
  botão nativo da própria rota para alternar o conteúdo de ajuda existente.
- O método de pagamento selecionado aparece no trigger do fluxo Retail. Em
  pedidos `created`, `deliveryCost` pode ser alterado isoladamente mesmo com
  pagamento `posted`; `discount`, `deliveryFee` e alterações comerciais
  continuam protegidos, e `completed`/`cancelled` permanecem somente leitura.

### Validação do baseline de 2026-09-21

- TypeScript, ESLint direcionado, Prettier direcionado, 35 suítes/235 testes e
  `git diff --check` passaram antes da publicação.
- `AGENTS.md`, código nativo, configuração, dependências, schema e regras do
  Firestore permaneceram inalterados.

## Fechamento da sincronização nativa das toolbars das tabs — 2026-09-17

Este bloco registra a correção do micro-delay entre o conteúdo e os controles
superiores ao trocar entre Home, Registrar, Finanças, Histórico e Configurações.
O NativeSim Public foi usado somente como ambiente auxiliar de compilação e
validação; este repositório continua sendo a fonte da verdade.

### Causa raiz e tentativas

- Na arquitetura original, o NativeTabs selecionava o conteúdo, um callback
  chegava ao JavaScript, o `activeTabStore` mudava e o `Stack.Toolbar`
  compartilhado no Stack raiz reaplicava a configuração. Os
  `UIBarButtonItem`s eram recriados depois de o conteúdo da tab já poder ser
  revelado, introduzindo o frame perceptível de atraso da toolbar.
- A tentativa intermediária moveu header e toolbar para um Native Stack próprio
  de cada tab. Isso eliminou o delay porque a toolbar passou a acompanhar o
  stack da tab, mas removeu a continuidade da mesma `UINavigationBar`; por
  isso, o morph Liquid Glass entre tabs deixou de ocorrer. O morph dentro de
  um mesmo stack, como em Configurações, permaneceu funcionando.

### Solução híbrida final

- O `(tabs)` voltou a possuir uma única `UINavigationBar`/`Stack.Toolbar`
  compartilhada no Stack raiz. Os NativeTabs, Native Stacks, estado de
  navegação independente das tabs, push/pop, swipe-back e
  `hidesBottomBarWhenPushed` permanecem preservados; a tab bar continua
  reservada às telas raiz.
- O coordinator nativo no `RNSTabBarController` prepara a toolbar da tab de
  destino antes da seleção visual: cobre `shouldSelectViewController` para
  toque físico e `setSelectedIndex`/`setSelectedViewController` para seleção
  programática. O fluxo também sincroniza novamente depois que o
  `RNSScreenStackHeaderConfig` materializa ou reaplica os itens.
- A toolbar é obtida dos `UIBarButtonItem`s reais do `navigationItem` raiz do
  stack da tab de destino e reaplicada no `navigationItem` do controller
  compartilhado. Os itens e seus `customView`s, handlers, menus, avatar, lupa
  e seletores continuam nativos; não há toolbar fake em React Native nem
  duplicação permanente de itens.
- A preparação nativa remove o round-trip pelo JavaScript do caminho crítico:
  os itens corretos já estão no `navigationItem` compartilhado antes de o
  `UITabBarController` revelar a nova tab. A continuidade dessa mesma
  `UINavigationBar`, inclusive com shared background, é o que permite
  preservar o morph Liquid Glass cross-tab.

### Config plugin e contrato de manutenção

- `plugins/withRNScreensHideBottomBarWhenPushed.js` aplica, durante o prebuild,
  o patch reproduzível ao `react-native-screens` instalado. Ele integra o
  coordinator ao `RNSTabBarController`, expõe a sincronização para o
  `RNSScreenStackHeaderConfig` e preserva o suporte a
  `hidesBottomBarWhenPushed`.
- O plugin usa marcadores, é idempotente e falha quando a estrutura esperada
  da versão instalada não está presente; não depende de edição manual de
  `node_modules`. Dependências e o próprio plugin não foram alterados neste
  fechamento documental.
- O mecanismo não deve ser removido ou substituído em futuras refatorações
  sem reproduzir e validar conjuntamente os dois critérios: ausência do frame
  atrasado na troca de tab e morph Liquid Glass entre tabs.

### Validação

- A implementação funcional foi compilada e validada no NativeSim iOS: o
  micro-delay foi eliminado, o morph Liquid Glass cross-tab foi restaurado e
  a troca repetida de conteúdo e toolbar ocorreu sem o frame atrasado
  anterior. NativeTabs, Native Stack, Stack.Toolbar, UINavigationBar
  compartilhada e handlers existentes permaneceram ativos.
- A validação em iPhone físico ainda não foi realizada. Ela permanece como a
  validação nativa final da correção; este fechamento documental não executa
  prebuild nem altera código funcional.

## Consolidação da Fase 5C.2A — 2026-09-17

Este bloco registra o contrato operacional atual de pedidos Retail após a
publicação do checkpoint 5C.2A-2.

### Histórico e navegação Retail

- A aba Histórico compartilha uma entrada, mas separa os domínios por
  `AppMode`: Atacado continua usando `HistoryScreen`/Delivery e Varejo usa
  `RetailOrderHistoryScreen`/RetailOrder.
- `orderDate` é a data comercial usada para agrupar o Histórico Varejo por Dia,
  Semana e Mês. `deliveryDate` permanece a data de entrega, e timestamps de
  criação/atualização são técnicos.
- A aba Registrar Varejo mantém o card `Registrar pedido`, que abre
  `/registrar-pedido-varejo`. Essa rota reúne busca local de clientes ativos e
  seleção de produtos; itens podem ser adicionados antes do cliente. Limpar a
  seleção remove somente `clientId` e preserva produtos e os demais campos do
  draft.
- O Root Native Stack mantém `/registrar-pedido-varejo` como página combinada,
  `/registrar-pedido-varejo/novo-cliente` como cadastro auxiliar e as etapas
  `/registrar-pedido-varejo/detalhes`, `/registrar-pedido-varejo/resumo` e
  `/registrar-pedido-varejo/pagamento`. A rota antiga `/produtos` redireciona
  para a página combinada. `RetailOrderFlowProvider` preserva o draft dentro
  desse fluxo, inclusive ao abrir o cadastro auxiliar, e o limpa ao sair do
  prefixo ou mudar para Atacado; Back, morph, push/pop e swipe-back permanecem
  nativos.
- O detalhe de pedido usa a rota Root `/pedido-varejo/[orderId]`, recebe apenas
  `orderId` e mantém o domínio Retail isolado de Delivery.

### Pagamento posterior

- O detalhe Retail mantém o CTA de adicionar pagamento e usa o
  `RetailOrderPaymentSheet` na primeira composição funcional restaurada, com
  `NativeSheet`, `NativeTextField`, `NativeDropdown`, `NativeDatePicker` e
  `NativeButton`.
- Pagamentos posteriores referenciam o mesmo `orderId`, usam status `posted` e
  nunca criam outro RetailOrder. Pagamento parcial e total são permitidos;
  overpayment é bloqueado; pedidos `cancelled` não recebem pagamento e pedidos
  `completed` podem receber pagamento.
- `calculateRetailOrderFinancials` permanece a fonte única das fórmulas e dos
  status `unpaid`, `partially_paid` e `paid`. Somente `posted` entra em
  `paidAmount`; `voided` não altera os totais.

### Resumo financeiro e sincronização pontual

- O resumo financeiro do Histórico usa cache por UID, `sessionVersion`,
  `orderId` e assinatura financeira, com prewarm local, cache-first,
  stale-while-revalidate e concorrência limitada somente para pedidos visíveis.
- `RetailOrderHistoryFinancialSummaryService.updateForOrder()` recalcula
  somente o pedido afetado usando o snapshot local completo de pagamentos,
  publica aos listeners e não executa leitura Firestore nem `clear` global.
  Resumos prontos permanecem prontos e respostas de sessões obsoletas são
  descartadas.
- A sincronização local após o pagamento é tolerante a falha: a persistência do
  pagamento não é convertida em erro por falha posterior de atualização do
  resumo.

### Limitações preservadas

- A composição visual dos controles `@expo/ui`/SwiftUI durante o scroll do
  wizard permanece uma pendência conhecida: os frames acompanham o ScrollView,
  mas o material Liquid Glass pode atravessar visualmente a região do
  ProgressiveBlur RN de forma diferente das Views RN.
- O overpayment concorrente multi-device ainda não usa transação Firestore e
  permanece fora desta fase.
- Google Sign-In na variante Release/Final permanece fora deste checkpoint.

### Validação do checkpoint

- TypeScript, ESLint direcionado, Prettier check, 14 suítes/86 testes de Retail
  Orders e 5 suítes/20 testes de History passaram antes da publicação.
- Não houve alteração de dependências, schema/rules/indexes, configuração
  nativa ou Atacado neste checkpoint.

## Consolidação desta sessão — 2026-09-12

- O experimento temporário do micro-delay da toolbar foi encerrado. A
  instrumentação `[TOOLBAR-PERF]`, `toolbarPerf.ts` e a memoização experimental
  não fazem parte do estado atual; os arquivos foram restaurados exatamente ao
  HEAD deste checkpoint.
- Não houve alteração funcional nova nesta sessão nem novo teste no iPhone.
  A validação física anterior do estado de navegação permanece registrada nas
  seções abaixo; esta sessão apenas preservou o checkpoint já aprovado.

## Aplicativo

- `expo.name`/nome interno do projeto iOS: `emporiorigatti`. O nome exibido é
  independente e vem de `CFBundleDisplayName`: `Empório Rigatti` na variante
  padrão e `Empório Rigatti Final` na variante Final. Slug, EAS projectId e
  bundle identifiers são configurações separadas.
- Nome exibido da variante padrão: `Empório Rigatti`.
- Variante Final: `Empório Rigatti Final`, com `APP_VARIANT=final`, bundle ID
  `com.pareact.mobile.final`, scheme `pareact-final` e
  `GoogleService-Info.final.plist`; a variante padrão permanece em
  `com.pareact.mobile`, usa `pareact` e `GoogleService-Info.plist`.
- Expo SDK: `57` (`expo ~57.0.10`).
- Expo Router: `~57.0.10`.
- React Native: `0.86.2`.
- `bundleIdentifier`: `com.pareact.mobile`.
- Alvo principal: iOS Development Build.

## Snapshot funcional histórico — fechamento anterior

Este bloco preserva uma auditoria anterior do checkout. Ele não representa o
estado operacional atual para Pesquisa, Bottom Sheets ou títulos; consulte o
Snapshot operacional de 2026-09-26 no topo. As descrições abaixo permanecem
como histórico técnico e não devem substituir a inspeção do código/Git atual.

### Cold start offline, sessão e sincronização

- O cold start autenticado não depende mais de leituras Firestore de dados de
  negócio para liberar `isCacheHydrated`/`SplashGate`. `hydrateFromCache` é
  estritamente local, e `factoryReceiptDataSource.restore()` não faz parte do
  gate.
- Ausência de cache permite revelar a UI com estado seguro e dados marcados
  como indisponíveis, sem transformar ausência em mocks ou valores reais. As
  sincronizações remotas continuam depois da UI e atualizam os dados quando
  disponíveis.
- Fontes e operações assíncronas de dados são isoladas por UID e
  geração/sessionVersion. Logout e novo login com o mesmo UID invalidam a
  sessão anterior; respostas e mutações obsoletas são descartadas.
- Consultas equivalentes são coalescidas por escopo válido. O histórico
  completo é distinguido de memória parcial e fica protegido contra respostas
  filtradas antigas; mutações de clientes não podem ser sobrescritas por
  leituras anteriores.
- Snapshots `metadata.fromCache` são tratados de forma não destrutiva: dados
  válidos existentes são preservados e uma resposta vazia/parcial não confirma
  histórico remoto completo. O cache diário só aceita gravações que não
  substituam dados mais recentes (`savedAt`).
- A validação local final passou em 10 suítes / 229 testes. Não houve alteração
  nativa; o código pode ser validado via Metro/Fast Refresh sem nova
  Development Build, mas a Release instalada precisa ser substituída por uma
  nova Release para validar o cold start offline real.

### Cost Settings

- Edições manuais de custos e quilometragem são local-first: atualizam a UI e
  persistem no AsyncStorage sem aguardar Firestore; o storage e o cache em
  memória são isolados por UID.
- Hidratação e sincronização usam UID + sessionVersion/generation. Logout,
  troca de UID ou novo login invalidam operações e respostas antigas, sem
  permitir que falhas locais/remotas apaguem silenciosamente uma edição válida.
- Mutações remotas do mesmo UID + registro usam fila serial compartilhada para
  create/update/delete. Firestore recebe patches com merge não destrutivo,
  preservando campos remotos desconhecidos e permitindo exclusões explícitas.
- A validação relacionada passou em 7 suítes / 57 testes, incluindo leituras e
  mutações assíncronas obsoletas, relogin com o mesmo UID, fila de exclusão e
  persistência local.

### Route Tracking

- Novas rotas autenticadas usam exclusivamente storage v2 e cache em memória
  isolados pelo UID; a rota ativa persiste `ownerUid`, que continua sendo usado
  por foreground, background, restauração e finalização.
- O tracking em background permanece vinculado ao `ownerUid` persistido e não
  consulta o Auth atual para redirecionar pontos. Operações de UI e preload usam
  UID + generation/sessionVersion para descartar callbacks e respostas antigas;
  pontos anteriores ao `startTimestamp` da rota atual também são ignorados.
- O preload carrega somente o histórico v2 do UID autenticado, sem Firestore e
  sem reintroduzir dependência remota no cold start. O histórico v2 continua
  deduplicado por `routeId` pela leitura canônica.
- As chaves v1 globais permanecem intactas, em quarentena e fora de mapas,
  `routeCount` e Finanças. A importação/claim do legado exige confirmação
  explícita do usuário em Localização e Rotas; é UID-scoped, idempotente e
  protegida contra concorrência e troca de sessão. O histórico v2 atual e o
  legado são combinados pela deduplicação canônica por `routeId`, com staging,
  read-back, validação e rollback em falhas. O marcador só é gravado após a
  persistência confirmada, e as chaves v1 não são apagadas nem regravadas.

### Home

- A Home mantém a pílula nativa de ações, `Entregas de hoje` e os dados e
  handlers existentes. Os quatro atalhos `Registrar Entrega`, `Em aberto`,
  `Documentos` e `Fábrica` agora ficam em um único card agrupado, com quatro
  linhas inteiras clicáveis, ícone em círculo `54x54`, título, informação
  secundária e `chevron.right`, sem separadores internos.
- O card agrupado usa a margem lateral padrão
  `theme.layout.screenHorizontalPadding` (`16 pt`) em cada lado, com largura
  centralizada. O botão de pesquisa navega para `/pesquisa` sem abrir teclado ou
  campo editável na Home.
- O header da Home mantém o avatar no slot esquerdo do `Stack.Toolbar`
  compartilhado do Stack raiz `(tabs)`, sincronizado nativamente antes da troca
  de tab. No Wholesale/Atacado, a ação Search ocupa o slot direito; no
  Retail/Varejo, o slot direito não possui Search. O título grande
  `Atacado`/`Varejo` é a entrada atual do seletor de AppMode. O avatar mantém
  hit area, haptic, Profile Sheet e comportamento nativos; Search navega para
  `/pesquisa` quando disponível.
- No caminho iOS com `@expo/ui`, a cápsula visível usa o shared background
  nativo do `Stack.Toolbar`, como o seletor de período de Finanças. A Home não
  usa `hidesSharedBackground`, tint, background manual ou `glassEffect` custom
  nessa composição. O HStack mantém controles de `44 pt`, gap de `4 pt`, foto
  de `34 pt`, padding nativo assimétrico `leading: 0`/`trailing: 2 pt` e frame
  efetivo de `94 pt`; o fallback não nativo permanece separado.
- O card agrupado foi deslocado `4 pt` para baixo por margem local, sem alterar
  safe area, título, toolbar ou conteúdo restante da Home.
- O fundo da Home permanece no background original, sem gradientes, glows ou
  camadas BlurView experimentais.
- O card `Registrar Entrega` navega para `/registrar-entrega`; não abre um
  Bottom Sheet diretamente sobre a Home. A rota de destino passa
  `inlineClientSelection` e usa exatamente o mesmo fluxo de um único
  `RegistrarDeliverySheet` da rota `/registrar/entrega`, sem auto-open adicional.
- `Entregas de hoje` mantém layout final explícito em largura total para a row e
  o `NativeCardContextMenu`, com transições Reanimated e sem logs de startup,
  cores diagnósticas ou instrumentação `[TodayCardStartup]` residual.
- As linhas de `Entregas de hoje` usam o padrão compartilhado de clientes:
  círculo `54x54`, ícone de cliente, nome, quantidade como texto secundário e
  badge de status. O preview do long press passa o card completo ao
  `NativeCardContextMenu`, com a mesma superfície, raio e clipping do Histórico;
  o card normal e seus handlers permanecem iguais.
- Ao abrir Sugestões ou resultados pela Search Bar, o fundo da Home permanece
  nítido; o `BlurView` de fundo e sua animação de opacidade foram removidos.
  O Liquid Glass do próprio sheet, o no-dimming e a apresentação nativa
  permanecem inalterados.
- O empty state de `Entregas de hoje` usa a altura mínima compactada atual
  (`theme.spacing.xxl * 5`), sem alterar os cards com dados.

### Pesquisa dedicada

- `/pesquisa` é uma tela dedicada no Native Stack, com botão voltar nativo,
  título `Pesquisa` e título/conteúdo dentro do padrão rolável com Progressive
  Blur superior.
- Sugestões e resultados reutilizam parser, datasource, serviço, ações e rotas
  existentes; as sugestões são apresentadas dentro de um card visual próprio.
- O campo atual usa `HomeSearchAttachmentsComposer` e o composer portado de
  `react-native-motion`, com `TextInput` e `OverKeyboardView` de
  `react-native-keyboard-controller`. Esse é o caminho que posiciona a barra
  acima do teclado nas telas atuais; o antigo `native-search-field` com
  `keyboardAccessory` não é mais usado por `HomeSearchScreen`.
- A rota removeu o reposicionamento artificial do teclado; o foco aguarda a
  transição nativa da entrada e o cleanup dispensa o teclado ao sair.

### Registrar Entrega e Dados Diários

- A aba Registrar agora possui um Native Stack aninhado em
  `src/app/(tabs)/registrar/_layout.tsx`, com as telas `index`, `entrega` e
  `dados`. Os destinos usam `Stack.Screen.BackButton displayMode="minimal"`;
  as rotas/layouts antigos de `src/app/registrar` foram removidos e a
  declaração raiz duplicada de `registrar` deixou de ser necessária.
- A Home abre `/registrar-entrega`, uma página inteira `Entrega` com
  `ProgressiveCollapsibleScreen` e um único card `Clientes`. A ação global de
  Live Activity permanece na toolbar dessa página e usa o snapshot completo
  das entregas do dia, sem depender de cliente selecionado.
- `/registrar-entrega/clientes` reutiliza a lista existente de clientes e
  cards, sem busca inferior nem CTA `Adicionar`; `Novo cliente` permanece na
  toolbar. Tocar em um cliente navega diretamente para
  `/registrar-entrega/[clientId]` com haptic. A busca local continua disponível
  em `/registrar/entrega`.
- A tela de detalhe da entrega mantém formulário, validações e persistência
  atuais; após salvar, `router.back()` retorna à lista de clientes.
- O card de Entrega na tab Registrar, `/registrar/entrega`, Quick Action,
  deep link de Live Activity e redirect `(home-shortcuts)` abrem diretamente
  `/registrar-entrega/clientes`. Só o card da Home abre a página intermediária.
- As páginas de entrada, clientes e formulário continuam no Root Native Stack,
  com Back e swipe-back nativos. O `RegistrarDeliverySheet` e o pager antigo
  não participam desse fluxo.
- O Bottom Sheet de Dados Diários usa detent `0.46`, drag indicator nativo e
  conteúdo sem botão `X` no iOS. A página principal mostra quatro linhas sem
  separadores, com círculos `54x54`, SF Symbols `21 pt`, descrição secundária,
  `chevron.right` simples e a linha inteira clicável.

### Cards e linhas de clientes

- `Em aberto` usa o padrão compartilhado de círculo `54x54`, ícone de cliente,
  nome, descrição `Cliente` e valor à direita; o total da tela permanece no
  badge do título e os valores financeiros continuam inalterados.
- Home → `Hoje`, Entregas, Histórico e Documentos usam o mesmo ícone circular,
  hierarquia de nome/texto secundário e espaçamento. Documentos mantém os
  títulos `Notas fiscais` e `Boletos` fora dos cards, com o conteúdo agrupado
  abaixo de cada título. Entregas e Histórico compartilham o `DeliveryCard`;
  os status, valores, quantidades, ações e regras financeiras permanecem
  intactos.
- Os cards de Documentos reservam desde o primeiro layout a altura da linha
  baseada no círculo `54x54` e no padding, mantendo o preview/context menu na
  mesma geometria e evitando o salto de altura do primeiro mount.
- O `OpenPaymentClientIcon` tem fallback React Native e implementação
  SwiftUI/@expo/ui no iOS, reutilizando o círculo nativo dos sheets.

### Perfil

- O Bottom Sheet de Perfil permanece no detent único `0.5`, com o conteúdo e o
  shell nativos atuais.
- O e-mail não aparece mais abaixo do nome; continua disponível no card de
  informações da conta.
- O nome exibido pode ser tocado para abrir a edição nativa com `TextField`,
  `Cancelar` e `Salvar`. O salvamento normaliza o texto e usa somente Firebase
  Auth `updateProfile(user, { displayName })`; não altera documentos Firestore,
  UID, e-mail, provider Google, tokens ou configuração de autenticação.
- O botão `Sair` usa a mesma cápsula sólida do `Confirmar`, com toda a área
  clicável por `contentShape(.capsule())`; a ação de logout e seu estado de
  loading permanecem os mesmos.

### Finanças

- `NativeAnimatedNumber` mantém `horizontalSizing: 'intrinsic' | 'fill'`, com
  padrão `intrinsic`. O modo `fill` é usado somente pelo wrapper direito do
  `FinancialDayDetailCard`; os labels/ícones da esquerda permanecem fora desse
  wrapper e o texto SwiftUI fica trailing dentro do espaço restante.
- Faturamento Mensal e Lucro Líquido Mensal permanecem dentro do mesmo Native
  Stack da aba `financeiro`, com `Stack.Screen.BackButton`, swipe-to-back nativo
  e `FinancePeriodToolbar` preservado.
- No detalhe diário, Faturamento exibe somente Faturamento, Baldes vendidos e
  Entregas; custos e quilometragem permanecem nas métricas que dependem deles,
  especialmente Lucro Líquido.
- A estrutura `Stack.Toolbar` com `separateBackground={false}` permanece
  responsável pelo seletor Mês/Ano e pelo morph Liquid Glass nativo entre a
  tela principal e os detalhes. Nenhuma animação custom foi adicionada.
- A tab bar mantém o comportamento atual confirmado no código: continua
  visível nos detalhes financeiros; não foi aplicado hack para ocultá-la.
- A agregação de combustível considera a união normalizada e deduplicada de
  `gastosDiarios`, rotas GPS e datas diárias válidas do Cost Settings. Km
  manual isolado participa do custo, enquanto `routeCount` continua contando
  somente sessões GPS.
- O histórico local de rotas é deduplicado defensivamente por `routeId` na
  leitura canônica; duplicatas persistidas não inflam km, `routeCount` nem
  custos derivados. O legado v1 permanece preservado fora do fluxo normal e só
  participa das Finanças após claim explícito e persistência no histórico v2;
  Finanças nunca lê v1 diretamente.

### Bottom Sheets nativos e tint escuro

- O tint `rgba(0, 0, 0, 0.30)` é opt-in, não global, e está aplicado aos sheets
  de Registrar Entrega, Perfil, resultados da Home Search, Sugestões/Ajuda,
  Dados Diários e Detalhes da compra da Fábrica.
- Esses fluxos continuam usando `glassSurface`/`glassEffect`, blur,
  translucidez, detents, drag indicator e gestos nativos. Não foram mantidos
  contornos, strokes, gradientes ou reflexos custom descartados.
- O `NativeClientFormSheet` permanece com seu background opaco próprio e não
  usa essa abstração compartilhada de tint Liquid Glass.
- O `PurchaseDetailsSheet` permanece estruturalmente com a composição atual;
  as tentativas descartadas de `hostSizing`, `maxHeight`, `ignoreSafeArea` e
  máscaras do corte inferior não fazem parte do estado final.

### Autenticação e persistência do perfil

- Com `ENABLE_FIREBASE_AUTH = true`, a edição de nome usa `FirebaseAuthDataSource`
  → `AuthService` → `FirebaseAuthRepository.updateDisplayName`.
- O Firestore continua reservado aos dados de negócio existentes; nenhum write
  de documento é disparado pela edição do nome. O caminho mock, quando
  explicitamente habilitado, persiste somente a sessão mock no AsyncStorage.

### Validação e instrumentação

- Não há `[TodayCardStartup]`, `performance.now()` de diagnóstico, traces de
  dismiss, cores diagnósticas ou helpers temporários no estado atual.
- Logs operacionais existentes de fallback, rota e integração Apple Intelligence
  permanecem porque fazem parte dos fluxos reais e não são instrumentação deste
  fechamento.
- A instrumentação temporária de lifecycle da Pesquisa foi removida; não há
  contadores, listeners ou helpers de diagnóstico desse fluxo.

## Estado nativo registrado no snapshot histórico

### VALIDADO NO NATIVESIM IOS — 2026-09-17

- A correção híbrida de sincronização das toolbars foi compilada e validada no
  NativeSim: o coordinator nativo prepara os itens da tab de destino antes da
  seleção, elimina o round-trip JS do caminho crítico e preserva o morph
  Liquid Glass da `UINavigationBar` compartilhada.
- Esta validação confirma a troca sem frame atrasado, mas não substitui o teste
  no iPhone físico, que ainda está pendente.

### VALIDADO NO IPHONE

- NativeTabs e Native Stacks com navegação nativa, BackButtons, toolbar,
  swipe-back, ProgressiveBlur e interações Liquid Glass nos fluxos reais já
  validados.
- Home Search com Bottom Sheet nativo, pager/preview de rotas e correções de
  ghosting documentadas nas validações de Development Build.
- Bottom Sheets nativos e cards de Registrar com Context Menu nativo conforme
  o comportamento validado no histórico deste documento.
- Home Screen Quick Actions: os quatro atalhos fixos foram compilados,
  instalados e testados manualmente no iPhone físico.
- Nome de exibição `Empório Rigatti`: incluído na compilação, instalado e
  confirmado visualmente abaixo do ícone no iPhone.

### IMPLEMENTADO, MAS EXIGE NOVA DEVELOPMENT BUILD

- Apple Intelligence/Foundation Models: a implementação inicial foi compilada
  e testada no iPhone; buscas estruturadas antigas funcionavam, mas o teste
  revelou resultado vazio para linguagem natural. A correção posterior do
  roteamento/bridge Swift ainda não foi recompilada no iPhone e exige uma nova
  Development Build para validação. Até essa validação, Apple Intelligence não
  deve ser considerado validado.
- O antigo módulo `native-search-field` permanece no repositório como
  implementação nativa histórica, mas não é uma pendência da tela atual. Uma
  alteração futura nesse módulo ainda exigiria Development Build; o caminho
  atual da Pesquisa já está coberto pela build que contém o composer e o
  `react-native-keyboard-controller`.

### IMPLEMENTADO, PENDENTE DE VALIDAÇÃO VISUAL NO IPHONE

- `NativeBottomSheet` e `NativeSheet` aceitam e aplicam
  `presentationBackgroundInteraction="enabled"` por padrão, removendo o dimming
  dos Bottom Sheets reais sem alterar dialogs, menus ou telas full-screen.
- Registrar Entrega mantém shell, detents, drag e seleção nativos; as rotas
  atuais usam diretamente o detalhe de um único sheet, a seleção exibe somente
  os nomes, e os controles, haptics e cards internos permanecem preservados.
- Registrar Dados mantém o detent `0.46`, uma lista nativa sem card interno,
  círculos de ícone, chevrons simples, pager horizontal para o detalhe,
  controles e ação `Adicionar`, além da ausência de dimming.
- Home Search mantém Search Field nativo; o botão `?` desfoca o campo e aguarda
  os eventos nativos do teclado, enquanto a Home fecha o sheet de sugestões ao
  perder foco ou navegar para outra rota. Os sheets de resultados e Sugestões
  continuam nativos, sem BlurView aplicado à tela de fundo.
- A Home exibe os atalhos em carrossel horizontal, na ordem Registrar Entrega,
  Em aberto, Documentos e Fábrica. O atalho Em aberto mostra o total real e
  mantém somente o ícone semântico vermelho quando há saldo; seus clientes e
  `NativeCardContextMenu` ficam na rota `/em-aberto`.
- Perfil da Home mantém somente o detent `0.5`, sem expansão; o card de
  Nome/E-mail/Método usa `BlurView` com tratamento light/dark, o nome é editável
  via Firebase Auth e o logout usa a cápsula nativa compartilhada.
- Configurações → Sistema mantém apenas os fluxos funcionais de Modo Teste e
  Backup; os botões, cards e conteúdos experimentais de Liquid Glass e Bottom
  Sheet Glass foram removidos, sem alterar os demais itens de Sistema.
- Faturamento Mensal e Lucro Líquido Mensal voltaram para
  `src/app/(tabs)/financeiro/`, no mesmo Native Stack da tela principal. O
  `FinancePeriodToolbar` continua usando `Stack.Toolbar` nativo com
  `separateBackground={false}`, e os detalhes mantêm `BackButton` e swipe-back
  nativos; essa estrutura restaura o caminho necessário para o morph Liquid
  Glass nativo entre o seletor combinado e os controles Mês/Ano. A tab bar
  permanece visível no detalhe por enquanto: embora o SDK 57 ofereça
  `NativeTabs hidden`, a ocultação dinâmica pode remontar o navigator e resetar
  estado, então não foi aplicada sem uma solução segura para este fluxo.
- A sessão Firebase só deixa de estar em `loading` após o primeiro estado real
  de autenticação. Com usuário autenticado, o gate inicial aguarda somente
  hidratações locais e a prontidão visual necessárias para revelar a Home;
  leituras Firestore de dados de negócio ficam fora desse gate.
- O `FirestoreDeliveryDataSource` hidrata somente os caches locais disponíveis
  no bootstrap. Quando não há cache, a Home abre com estado seguro e a
  sincronização remota posterior pode atualizar os dados; o cache continua
  sendo somente cache do Firestore.
- Os cards clicáveis da Home mantêm o feedback de pressão restaurado, sem
  alterar os handlers ou a navegação.
- Os cards de Entregas de hoje na Home, Registrar Entrega e Histórico usam
  transições suaves de entrada/saída e layout com Reanimated, respeitando
  Reduce Motion; conteúdo, context menus, dados e handlers permanecem iguais.
- Entregas de hoje exibe um empty state quando não há entregas e troca para os
  cards reais de forma reativa quando uma entrega é criada.
- Não há instrumentação `[HomeStartupTrace]`, blobs, `Card Glass`, `Card Blur` ou
  outros experimentos visuais descartados no estado final.

O repositório ainda contém o módulo iOS local `native-search-field` e seu
podspec autolinkável, mas a rota atual `/pesquisa` usa o composer de anexos e o
`react-native-keyboard-controller`. Não há uma nova Development Build pendente
somente por causa do antigo keyboard accessory.

### Componentes e módulos nativos relevantes

- `@expo/ui`/SwiftUI, Native Stack e NativeTabs.
- `NativeAppleIntelligence`, `NativeQuickActions`, `NativeStartupSplash`,
  `NativeInteractivePager`, `NativeCardContextMenu` e
  `NativeTrackedRouteMap`, além do novo `NativeSearchField`.
- `NativeGlassHeader`, `NativeDateToolbar`, `NativeAnimatedNumber` e controles
  Liquid Glass compartilhados, além de `NativeSegmentedControl`.
- Widgets, App Groups, Live Activities e Dynamic Island não foram adicionados.

## Estado funcional registrado no snapshot histórico

- Home Search: rota `/pesquisa` dedicada, parser fast path somente para
  consultas válidas, caminho semântico Apple Intelligence, prewarm, suporte
  pt-BR, cancelamento de gerações obsoletas e sugestões/resultados dentro do
  fluxo rolável da tela, preservando ações e rotas existentes.
- Quick Actions: Registrar entrega, Registrar dados, Modo Teste e Histórico;
  a ação é enfileirada até autenticação, hidratação e router estarem prontos.
- NativeTabs/Native Stack: fluxos reais isolados sem UINavigationBar global
  sobre as tabs; BackButtons, toolbars, swipe-back e morphs nativos preservados.
- Registrar: entrega e dados preservados; o atalho da Home navega para
  `/registrar-entrega` e a tela usa o mesmo Bottom Sheet de detalhe compartilhado
  por Entregas, sem auto-open e sem pager horizontal; a lista de Entregas usa cards individuais com
  `PremiumCard` e `NativeCardContextMenu`, com entrada/saída suave dos cards.
  O primeiro Bottom Sheet de entrega
  mantém shell nativo interativo, lista em `0.48 ↔ 0.78`, formulário em
  `0.48`, seleção minimalista de clientes, cards internos e ausência de dimming.
- Registrar Dados: Bottom Sheet nativo com shell Liquid Glass interativo,
  detent `0.46`, lista de quatro opções sem separadores/card interno, círculos
  `54x54`, chevrons simples, pager horizontal de duas páginas e botão
  `Adicionar` com hit area integral.
- Fábrica: o Bottom Sheet de detalhes mantém os cards opacos originais; o fluxo
  continua usando a abstração nativa compartilhada e não contém o experimento de
  translucidez descartado.
- Perfil: sheet fixo em `0.5`, card de conta fosco com `BlurView`, e-mail removido
  da área sob o nome, edição de `displayName` via Firebase Auth e logout em
  cápsula nativa com hit area integral.
- Histórico: barra nativa `Dia | Semana | Mês`, `NativeDateToolbar` sensível ao
  modo com seleção de dia, mês e semana interna do mês, dados derivados do
  mesmo cache de entregas e mini-cards compactos em três colunas nos modos
  Semana/Mês. O modo Dia preserva os cards originais; não há filtro no toolbar.
- Em aberto: cards por cliente usam a mesma fonte real de recebimentos, sombra
  no light mode, context menu nativo para marcar entregas como pagas e total
  em um pequeno card alinhado abaixo da lista.
- Finanças: cards estáveis ao retornar de detalhes, `NativeAnimatedNumber` para
  mudanças reais e gráfico animado no UI thread sem o stutter anterior; a
  comparação mensal usa os mesmos N primeiros dias reais com entrega em cada
  mês, mantendo as fórmulas e o tratamento de denominador zero. O detalhe
  financeiro usa `NativeAnimatedNumber` com sizing horizontal opt-in somente
  no `FinancialDayDetailCard`, sem alterar o comportamento padrão dos demais
  consumidores.
- Finanças: os detalhes mensais pertencem novamente ao Stack de
  `src/app/(tabs)/financeiro`, preservando o BackButton, swipe-back e o morph
  nativos do toolbar; a tab bar continua visível nos detalhes até existir uma
  solução oficial segura que não remonte o navigator.
- Configurações: Native Stack dedicado para Clientes, Estoque, Localização,
  Sistema e demais fluxos; Modo Teste permanece local e não ativa por Quick
  Action.
- Sistema: os laboratórios visuais `Teste Liquid Glass` e `Teste Bottom Sheet
Glass` foram removidos; Modo Teste e Backup permanecem disponíveis.
- Localização/GPS: tracking, histórico e mapa preservados; montagem pesada do
  mapa ocorre após `transitionEnd`.

## Validações no iPhone registradas no snapshot histórico

### VALIDADO NO IPHONE

- Navegação NativeTabs/Native Stack, BackButtons, swipe-back e interações
  Liquid Glass dos fluxos reais registrados nas seções históricas.
- Home Search nativo, pager/preview de rotas e cenários de ghosting registrados
  como validados em Development Build.
- Estabilidade visual dos cards e controles de Registrar conforme a última
  validação documentada.
- Home Screen Quick Actions: os quatro atalhos foram compilados e validados
  manualmente no iPhone físico.
- Nome exibido `Empório Rigatti`: confirmado visualmente no iPhone.

### IMPLEMENTADO MAS AINDA NÃO VALIDADO

- Correção mais recente do roteamento/bridge do Apple Intelligence/Foundation
  Models, ainda pendente de recompilação e validação no iPhone.
- Ajustes finais de Bottom Sheets, transparência da Home Search, detents,
  Perfil, Registrar, empty state da Home e transições dos cards desta
  atualização: TypeScript, lint funcional, testes direcionados e
  `git diff --check` foram validados localmente, mas ainda não há nova
  confirmação visual desses ajustes no iPhone.
- A migração da pílula avatar+lupa para o background compartilhado do toolbar
  nativo e os últimos ajustes de largura/foto da Home foram validados com
  TypeScript, ESLint, testes direcionados e `git diff --check`; a confirmação
  visual final desses últimos valores no iPhone permanece pendente.
- A reorganização das rotas de detalhe financeiro foi validada localmente com
  TypeScript, ESLint direcionado, testes financeiros e `git diff --check`; a
  confirmação visual de swipe-back no iPhone continua pendente. A alteração é
  TS/TSX e pode ser atualizada via Metro/Fast Refresh, sem nova Development
  Build.

### PROBLEMAS CONHECIDOS / EM INVESTIGAÇÃO

- Foundation Models depende de dispositivo, versão do iOS, disponibilidade do
  recurso e suporte de locale; indisponibilidade deve seguir o fallback seguro.
- A validação visual final dos ajustes recentes de composição e detents dos
  sheets ainda precisa ser repetida no iPhone Development Build.
- Alguns detalhes visuais de módulos nativos, como a máscara UIKit do Context
  Menu, continuam condicionados à versão efetivamente compilada do Development
  Build.
- O teste automatizado de `tests/factory/PurchaseDetailsSheet.test.ts` não inicia
  neste ambiente por `react-native-worklets` (`loadUnpackers` indefinido); nenhum
  teste é executado antes dessa falha de infraestrutura.
- Avisos de normalização LF/CRLF podem aparecer em `git diff --check` e no
  Prettier/ESLint sem representar mudança funcional do app.

## Trabalho registrado no snapshot histórico

Nenhuma tarefa ativa registrada.

## Regras de leitura

- Este snapshot representa o estado operacional atual.
- As seções posteriores são histórico técnico e decisões acumuladas.
- Em caso de divergência, código e Git atuais são a fonte da verdade.
- Não assumir que um status antigo “não commitado” ainda seja verdadeiro apenas
  porque aparece em uma seção histórica.

Este documento é a referência operacional para novas tarefas. O material
histórico da migração que descreve o Ionic, o Realtime Database ou o schema
antigo permanece no histórico Git e não deve orientar novas implementações,
salvo quando a tarefa pedir uma auditoria histórica explícita.

## Identidade do aplicativo

- Branch de trabalho: `ajustes-codex`.
- Commit base do snapshot: `0dff9c6` (`feat(retail): support historical costs and category delivery allocation`).
- Expo SDK 57 e Development Build iOS.
- Nome exibido configurado: `Empório Rigatti`.
- `slug`: `PAReact`.
- `bundleIdentifier`: `com.pareact.mobile`.
- Google Sign-In + Firebase Auth continuam sendo a autenticação da conta.
- Face ID é somente um gate local do dispositivo; não substitui o Firebase Auth
  e não armazena tokens ou credenciais.

## Fonte de dados

O Cloud Firestore novo é a persistência de negócio atual. O Realtime Database
legado e a pasta `ionic-reference` não são usados pelo runtime e não devem ser
consultados ou migrados automaticamente.

Os dados Firestore são separados por usuário:

```text
users/{uid}/clients/{clientId}
users/{uid}/deliveries/{deliveryId}
users/{uid}/factoryReceipts/{receiptId}
users/{uid}/factoryReceipts/{receiptId}/payments/{paymentId}
users/{uid}/dailyData/{yyyy-MM-dd}
users/{uid}/monthlyData/{yyyy-MM}
users/{uid}/settings/factory
users/{uid}/settings/car
users/{uid}/settings/company
```

Não criar arrays crescentes de entregas ou pagamentos, nem coleções para
Finanças, Estoque, gráficos ou outros dados derivados.

## Áreas já implementadas

- Clientes e entregas;
- Pagamentos em aberto;
- Documentos (Notas fiscais e boletos independentes) e elegibilidade por cliente;
- Compras da fábrica e pagamentos parciais;
- Dados diários/mensais e Finanças (com sincronização de prontidão e cache de rotas);
- Registrar Pedido Varejo no Root Native Stack;
- Histórico Retail separado de Delivery, com detalhe de pedido e pagamentos posteriores/parciais;
- Catálogo Varejo com categorias, produtos, custo direto e custo por composição;
- Custos Retail com histórico de vigência e resolução por data;
- Finanças Retail com filtros `Geral`, `Cestas`, `Salgados` e `Baldes`;
- Estoque derivado de compras menos entregas;
- FactorySettings, CarSettings e CompanyProfile;
- Home Search (busca universal, resumos de rotas, preview de mapas e suporte a múltiplas rotas sem ghosting);
- Backup, validação/dry-run e Restore seguro.

## Sincronização e Prontidão de Lucro Líquido Mensal

### Funcionalidade implementada

Eliminação do flash visual, do recálculo tardio e da interrupção de animações no card **Lucro Líquido Mensal** da aba de Finanças e no gráfico de barras diário da tela **MonthlyFinancialDetailScreen**:

- Criação de cache síncrono em memória no `RouteTrackingRepository` (`memoryHistory` e `getMemoryRouteHistory()`).
- Pré-carregamento assíncrono do histórico de rotas disparado na inicialização global do app (`src/app/_layout.tsx`).
- Hidratação e inicialização de estado síncrona em `financeiro.tsx` e `MonthlyFinancialDetailScreen.tsx` a partir da memória, com controle de prontidão via `routesLoaded` e `isDataReady = !loading && routesLoaded`.

### Comportamento final

- O card de **Lucro Líquido Mensal** em Finanças renderiza o valor definitivo desde o primeiro frame visível, sem flash, sem placeholder/skeleton e no mesmo instante do Faturamento Mensal.
- A tela `MonthlyFinancialDetailScreen` inicializa com as sessões de rotas locais prontas, evitando o reinício da animação Reanimated no gráfico de barras causado pela transição tardia de `routeSessions: []` para as sessões reais.

### Arquivos principais

- `src/services/routes/RouteTrackingRepository.ts`
- `src/app/_layout.tsx`
- `src/app/(tabs)/financeiro.tsx`
- `src/features/finance/components/MonthlyFinancialDetailScreen.tsx`

### Flags e schema afetados

- Nenhuma flag ou schema alterado. Rotas continuam persistidas exclusivamente no `AsyncStorage` local e carregadas em memória.

### Validações executadas

- TypeScript (`npx tsc --noEmit`): passou com 0 erros.
- ESLint direcionado: passou com 0 erros.
- `git diff --check`: passou.

### Limitações conhecidas

- Se o usuário navegar imediatamente em cold start extremo antes do primeiro tick de leitura do `AsyncStorage`, o estado aguarda `routesLoaded` para renderizar os dados derivados de combustível sem valores provisórios.

### Commit e publicação

- Branch: `ajustes-antigravity`.
- Commit: `6c7e798`.
- Mensagem: `fix(finance): synchronize route history memory cache and readiness for monthly net profit`.

## Documentos (Notas Fiscais e Boletos Independentes) e Card da Home

### Funcionalidade implementada

- Separação completa do ciclo de vida e dos status entre **Nota Fiscal** (`invoiceStatus`) e **Boleto** (`boletoStatus`) no domínio, persistência do Cloud Firestore, hooks, formulários e tela de Documentos.
- Atualização do card da Home de "Notas fiscais/boletos" para "Documentos", com contagem unificada, destaque semântico de pendências e altura estabilizada espelhada no card "Recebimentos em aberto".

### Comportamento final

- **Emissão independente:** Marcar um Boleto como emitido grava exclusivamente `boletoStatus: 'emitido'`, mantendo a Nota Fiscal aberta (`invoiceStatus: 'a_emitir'`). Marcar a Nota Fiscal como emitida altera apenas `invoiceStatus: 'emitido'`, mantendo o Boleto aberto.
- **Fallback legado seguro:** Registros antigos sem `boletoStatus` utilizam o fallback `effectiveBoletoStatus = delivery.boletoStatus ?? delivery.invoiceStatus ?? 'a_emitir'`, garantindo que boletos antigos emitidos no passado não reapareçam como pendentes.
- **Novas entregas:** Entregas criadas para clientes que utilizam boleto gravam explicitamente `boletoStatus: 'a_emitir'`, eliminando a dependência do fallback.
- **Tela de Documentos (`InvoicesScreen`):** Listas `invoiceDeliveries` e `boletoDeliveries` são filtradas e manuseadas independentemente por `handleInvoiceSwipe` e `handleBoletoSwipe`.
- **Card Documentos da Home:**
  - `0` pendências $\rightarrow$ exibe `"Documentos"` (altura preservada idêntica ao card "Recebimentos em aberto");
  - `1` pendência $\rightarrow$ exibe `"1 documento em aberto"`;
  - `N` pendências $\rightarrow$ exibe `"${N} documentos em aberto"`.

### Arquivos principais

- `src/types/data/delivery.ts`
- `src/types/data/index.ts`
- `src/utils/data/validators.ts`
- `src/utils/data/normalizers.ts`
- `src/services/deliveries/FirestoreDeliveryDataSource.ts`
- `src/services/deliveries/DeliveryMutationService.ts`
- `src/services/deliveries/deliveryRecord.ts`
- `src/services/deliveries/DeliveryQueryService.ts`
- `src/hooks/useDeliveries.ts`
- `src/screens/deliveries/DeliveryForm.tsx`
- `src/features/invoices/components/InvoicesScreen.tsx`
- `src/features/invoices/utils/invoiceCountUtils.ts`
- `src/app/(tabs)/dashboard.tsx`
- `tests/invoices/InvoicesDocumentCount.test.ts`
- `tests/deliveries/DeliveryServices.test.ts`

### Flags e schema afetados

- Nenhuma flag nova criada (`ENABLE_FIRESTORE_CLIENTS_DELIVERIES = true` mantida).
- Adicionado campo opcional `boletoStatus?: 'emitido' | 'a_emitir'` no documento `users/{uid}/deliveries/{deliveryId}` do Cloud Firestore, gravado de forma incremental sem necessidade de migração massiva dos documentos antigos.

### Validações executadas

- TypeScript (`npx tsc --noEmit`): passou com 0 erros.
- ESLint direcionado: passou com 0 erros.
- Testes unitários Jest: 32 testes passando em 7 suítes (`tests/invoices`, `tests/deliveries`, `tests/clients`).
- `git diff --check`: limpo.

### Limitações conhecidas

- Entregas legadas criadas antes da introdução de `boletoStatus` dependem do fallback compartilhado até sofrerem a primeira mutação de boleto.

### Commit e publicação

- Branch: `ajustes-antigravity`.
- Commit: `26b3864`.
- Mensagem: `feat(invoices): separar estados de nota fiscal e boleto e atualizar widget documentos`.

## Home Search

### Funcionalidade implementada

A Home Search cobre as áreas financeiras e operacionais reais do aplicativo,
sem criar uma segunda fonte de verdade:

- métricas financeiras globais e por cliente, usando os serviços financeiros
  existentes;
- campos cadastrais de cliente: preço atual do balde, endereço, nota fiscal e
  boleto;
- compras e pagamentos da fábrica, incluindo baldes, valor, total pago, saldo,
  progresso e estados pago/parcial/em aberto;
- quilometragem e quantidade de rotas a partir do histórico local;
- autonomia de gasolina/álcool do carro;
- resumos de período compostos por Finanças, Fábrica e Rotas;
- `routeSummary` enriquecido com dados agregados e dados individuais por sessão.

### Comportamento final

- A busca é executada somente no submit da barra.
- Memória/cache continuam sendo priorizados.
- Consultas Firestore são delimitadas por cliente/período; não há leitura global
  a cada caractere nem scan amplo do histórico.
- Períodos de mês, ano e data funcionam para qualquer período existente; período
  sem dados retorna resultado vazio.
- Pagamentos da fábrica são associados à data da compra. Consultas explicitamente
  baseadas na data de pagamento permanecem tipadas como não suportadas.
- Consultas globais de lucro usam a métrica correta; lucro bruto por cliente é
  suportado e lucro líquido por cliente permanece indisponível sem rateio
  inequívoco.
- Rotas permanecem LOCAL-ONLY. O resultado preserva `sessionIds` e não copia
  coordenadas ou samples.
- O `routeSummary` contém quantidade de rotas, início, fim, duração, distância,
  pontos GPS, km considerado no dia/período e sessões individuais. Para várias
  sessões, início/fim são os limites do conjunto, duração e pontos são somados,
  e cada sessão mantém seus próprios valores.
- O Bottom Sheet atual usa o detent grande para os resultados da busca; o
  conteúdo permanece em SwiftUI e não cria um sheet alternativo.

### Prévia nativa de rota

- `routeSummary` exibe uma prévia compacta do trajeto acima da seção de resumo.
- O resultado fornece somente `sessionIds`; `HomeSearchRoutePreview` carrega o
  histórico local pela `locationTrackingService` e seleciona as sessões na
  ordem recebida pelo adaptador.
- Múltiplas sessões são projetadas em um único `AppleMaps.View` no iOS, com
  uma polyline independente por sessão, câmera agregada e annotations de
  início/fim. Não há união artificial entre trajetos.
- A ponte RN/SwiftUI é `VStack -> RNHostView -> container React Native ->
NativeTrackedRoutesMap`; o container possui altura finita e clipping com o
  mesmo radius visual do mapa de Localização.
- A altura da prévia é fixa em 180 pt nos estados do resultado. O mapa não é
  recriado para redimensionamento do sheet; no estado não interativo o gesto
  pertence ao Bottom Sheet, e no estado grande pan/zoom e controles nativos
  permitidos pelo `expo-maps` ficam ativos.
- Loading, sessão ausente, amostras sem projeção e indisponibilidade do mapa
  exibem fallback sem esconder o resumo textual.

### Arquivos principais

- `src/features/home/search/HomeSearchTypes.ts`
- `src/features/home/search/HomeSearchQueryParser.ts`
- `src/features/home/search/HomeSearchDataSource.ts`
- `src/features/home/search/HomeSearchService.ts`
- `src/features/home/search/HomeSearchFinancialMetrics.ts`
- `src/features/home/components/HomeSearchResultsPresentation.ts`
- `src/features/home/components/HomeSearchResultsContent.tsx`
- `src/features/home/components/HomeSearchResultsContent.ios.tsx`
- `src/features/home/components/HomeSearchResultsNative.ios.tsx`
- `src/features/home/components/HomeSearchResultsVisualModel.ts`
- `src/features/home/components/HomeSearchRoutePreview.ios.tsx`
- `src/features/home/components/HomeSearchRoutePreviewAdapter.ts`
- `src/features/home/hooks/useHomeSearch.ts`
- `src/features/home/hooks/HomeSearchPresentationFlow.ts`
- `src/app/(tabs)/dashboard.tsx`
- `src/services/finance/FactoryCalculationService.ts`
- `src/services/factory-purchases/FirestoreFactoryReceiptDataSource.ts`
- `src/services/routes/RouteTrackingRepository.ts` (fonte local reutilizada)
- `src/components/routes/NativeTrackedRouteMap.native.tsx`
- `src/components/routes/NativeTrackedRouteMapDevelopment.tsx`
- `src/components/routes/NativeTrackedRouteMapProjection.ts`
- `src/components/routes/NativeTrackedRouteMap.types.ts`
- `tests/home/HomeSearchService.test.ts`
- `tests/home/HomeSearchResultsPresentation.test.ts`
- `tests/home/HomeSearchResultsVisualModel.test.ts`
- `tests/home/HomeSearchRoutePreviewAdapter.test.ts`
- `tests/routes/NativeTrackedRouteMapProjection.test.ts`

### Flags e schema afetados

- Nenhuma flag nova foi criada ou alterada. As flags atuais permanecem conforme
  a seção abaixo, incluindo `ENABLE_FIREBASE_APP_DATA = false` e as flags
  específicas do Firestore já existentes.
- Nenhuma coleção ou documento novo foi criado.
- O schema ativo continua em `users/{uid}/...`, com `factoryReceipts` e sua
  subcoleção `payments`, `dailyData`, `monthlyData`, configurações e entregas.
- O índice composto existente para a busca cliente + período está registrado em
  `firestore.indexes.json`: coleção `deliveries`, `queryScope: COLLECTION`,
  `clientId ASCENDING` e `date ASCENDING`.
- Rotas continuam armazenadas somente no AsyncStorage pelo
  `RouteTrackingRepository`; a prévia do Home Search resolve sessões existentes
  por `sessionId` sem criar nova fonte de dados.

### Validações executadas

- TypeScript (`npx.cmd tsc --noEmit`): passou.
- ESLint direcionado nos componentes Home Search e mapa: passou.
- Testes do adaptador/projeção/modelo visual da prévia: 9 testes passando
  em 3 suítes.
- Home Search: 124 testes passando.
- Suítes relacionadas de Home, Finanças, Fábrica, Rotas, Despesas e CarSettings:
  251 testes passando em 23 suítes.
- `git diff --check`: passou.
- A suíte completa ainda possui falhas externas ao escopo, relacionadas a
  expectativas antigas de Firebase desativado e à configuração Jest do
  AsyncStorage.

### Limitações conhecidas

- A prévia depende do histórico LOCAL-ONLY disponível no
  `RouteTrackingRepository`; ela não busca sessões novas no Firestore.
- A compatibilidade visual e o comportamento final de interação do
  `AppleMaps.View` ainda precisam ser confirmados no iPhone Development Build.
- Filtros pela data individual de pagamento da fábrica não são suportados sem
  leitura global ou alteração de schema.
- Lucro líquido por cliente não é calculado sem regra de rateio dos custos
  globais.
- O comportamento nativo final ainda depende da confirmação no iPhone
  Development Build; os testes automatizados não substituem essa validação.

### Commit e publicação

- Branch: `upgrade/expo-sdk-57`.
- Commit: `d806c32ac95a89950c8e2e85fc607e2c0cad0af7`.
- Mensagem: `feat: expand Home Search metrics and route summaries`.

## Gráfico Diário de Finanças: Scrubbing Nativo (Gesture.Pan), Isolamento de Swipe-Back e Números Animados

### Funcionalidade implementada

1. **Priorização e Isolamento de Gestos com `Gesture.Pan()` (`react-native-gesture-handler`):**
   - Substituição do `PanResponder` JavaScript por `Gesture.Pan()` nativo encapsulado em `<GestureDetector>` no [FinancialSeriesChart](file:///c:/Projetos/PAReact%20Antigravity/pwa-ios-2026/src/components/Charts/index.tsx).
   - Configuração de ativação imediata no eixo horizontal com `minDistance(0)`, `activeOffsetX([-2, 2])` e `cancelsTouchesInView(true)`.
   - Eliminação completa do conflito de gestos onde o arraste horizontal esquerda $\leftrightarrow$ direita da linha do gráfico disparava concorrentemente o `interactivePopGestureRecognizer` (swipe-back) da navegação nativa UIKit (`react-native-screens` / Expo Router).
   - Preservação estrita do swipe-back nativo do iOS em 100% da área externa aos limites físicos do gráfico.
2. **Integração de `NativeAnimatedNumber` no Cabeçalho e Linhas de Métricas:**
   - **Cabeçalho:** Substituição do `<Text>` estático em [MonthlyFinancialDetailScreen.tsx](file:///c:/Projetos/PAReact%20Antigravity/pwa-ios-2026/src/features/finance/components/MonthlyFinancialDetailScreen.tsx) pelo componente reutilizável [NativeAnimatedNumber](file:///c:/Projetos/PAReact%20Antigravity/pwa-ios-2026/src/components/native/NativeAnimatedNumber/NativeAnimatedNumberSwiftUI.ios.tsx).
   - **Extensão Canônica:** Adição de suporte a `alignment?: 'leading' | 'trailing' | 'center'` (padrão `'leading'`) e dimensionamento intrínseco `<Host matchContents>` em `NativeAnimatedNumber`.
   - **Linhas do Card Diário:** Em [FinancialDayDetailCard.tsx](file:///c:/Projetos/PAReact%20Antigravity/pwa-ios-2026/src/features/finance/components/FinancialDayDetailCard.tsx), todos os valores à direita (Faturamento, Lucro Líquido, Baldes, Entregas, Km total/automático/manual, Estar, Combustível, Outros, Luz) utilizam `NativeAnimatedNumber alignment="trailing"`, animando a troca numérica com `contentTransition('numericText')` do SwiftUI.
3. **Animação de Altura Contínua e Transição de Linhas no Card Diário:**
   - **Altura do Card:** Transição de layout estritamente monótona e desacelerada via `LinearTransition.duration(200).easing(Easing.out(Easing.quad))` no container do card, eliminando totalmente qualquer bounce ou overshoot na expansão/contração de altura entre dias com quantidades diferentes de métricas.
   - **Entrada e Saída das Linhas:** Linhas inseridas entram suavemente com `FadeInDown.duration(200).springify().damping(30).stiffness(220)` e linhas removidas saem com `FadeOutUp.duration(180)`.
4. **Interpolação de Curva e Snap na UI Thread:**
   - Desacoplamento arquitetural entre a posição contínua de arraste (`scrubX`, `scrubY` em `SharedValue` na UI thread) e o dia selecionado (`selectedIndex` em React state).
   - Interpolação matemática contínua da altura $Y$ ao longo dos segmentos da curva (`interpolateYOnCoordinates`).
   - Renderização da linha vertical pontilhada e do marcador em overlay nativo acelerado por hardware (`Animated.View` com `transform: [{ translateX }, { translateY }]`), rodando a 120fps/60fps na GPU sem re-renderizar o SVG.
   - Feedback tátil sutil (`triggerSelectionHaptic`) e atualização de dados no cabeçalho/card inferior acionados exclusivamente ao cruzar o limiar de um novo dia (`nearestIndex !== selectedIndex`).
   - Snap suave com curva easing (`withTiming`, 160ms) em direção ao ponto selecionado ao soltar o dedo (`onEnd`/`onFinalize`).

### Comportamento final

- O usuário pode tocar em qualquer parte do gráfico ou arrastar livremente o dedo na horizontal (incluindo da esquerda para a direita a partir do início da curva) para percorrer os dias do mês: o gesto pertence 100% ao gráfico e não inicia o retorno de tela.
- Fora da área do gráfico (cabeçalho, cards de resumo, margens e rodapé), o gesto de swipe-back do iOS permanece totalmente funcional e nativo.
- O valor principal no cabeçalho e todos os valores numéricos das linhas do card inferior realizam transição fluida com blur suave e troca de dígitos numéricos sincronizados.
- A altura do card inferior expande e contrai de forma perfeitamente suave e contínua sem balanço residual ou overshoot.

### Arquivos principais

- `src/components/Charts/index.tsx`
- `src/features/finance/components/MonthlyFinancialDetailScreen.tsx`
- `src/features/finance/components/FinancialDayDetailCard.tsx`
- `src/components/native/NativeAnimatedNumber/NativeAnimatedNumber.types.ts`
- `src/components/native/NativeAnimatedNumber/NativeAnimatedNumberSwiftUI.ios.tsx`
- `src/components/native/NativeAnimatedNumber/NativeAnimatedNumber.native.tsx`
- `src/components/native/NativeAnimatedNumber/NativeAnimatedNumber.tsx`
- `src/components/native/index.ts`
- `src/utils/haptics.ts`

### Flags e schema afetados

- Nenhuma flag ou schema alterado.

### Validações executadas

- TypeScript (`npx tsc --noEmit`): 0 erros.
- ESLint: 0 erros e 0 warnings.
- Jest (`npm test -- tests/finance`): 12 suítes / 88 testes passando com 100% de sucesso.
- `git diff --check`: limpo.
- Teste interativo via Fast Refresh no iPhone em Development Build.

### Limitações conhecidas

- Nenhuma. O gesto é tratado diretamente pelo subsistema de `UIGestureRecognizer` do RNGH no iOS e a animação numérica utiliza a API oficial SwiftUI no iOS com fallback síncrono para Web/Android.

### Commit e publicação

- Alterações validadas localmente via Fast Refresh no dispositivo físico; sem commit/push realizado.

## Bottom Sheets Nativos (Home Search e Registrar Entrega) e NativeInteractivePager

### Funcionalidade implementada

1. **Eliminação de Faixas Inferiores e Gap de Safe Area:**
   - Patch nativo reproduzível e idempotente no `@expo/ui` (`BottomSheetView.swift`) aplicando `.ignoresSafeArea(.container, edges: .bottom)` no UIHostingController da apresentação nativa de sheets, removendo o espaçamento inferior de 34pt do UIKit.
   - Script automatizado `scripts/patch-expo-ui-bottom-sheet.js` e hook `postinstall` no `package.json` (`npm run patch:expo-ui`) para assegurar compilação determinística no Mac/Xcode após `npm install`.
   - Ajuste de dimensionamento e preenchimento no Registrar Entrega (`src/app/(tabs)/registrar.tsx` com `hostSizing="viewport"`, e `src/components/native/NativeBottomSheet/NativeBottomSheetSwiftUI.ios.tsx` com `frame(maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading')`, `fillWidth` no pager e `padding({ bottom: 0 })`).

2. **Correções Preventivas Swift nos Módulos Locais:**
   - `NativeInteractivePagerView.swift`: Limpeza de interpolação e escapes de string.
   - `NativeStartupSplashView.swift`: Limpeza de sintaxe.

3. **Remoção Completa da Instrumentação de Geometria de Diagnóstico:**
   - Remoção de todos os modifiers `onGeometryChange` e do hook `useScrollGeometryChange` de `HomeSearchResultsNative.ios.tsx` e `NativeBottomSheetSwiftUI.ios.tsx`.
   - Desconexão da prop `onGeometry` do `NativeInteractivePager`.
   - Remoção de todos os 3 `GeometryReader` de background (`tab-view`, `pager`, `page`), leituras de `frame(in: .global)`, método `reportGeometry` e logs `[bottom-sheet-geometry]` em `NativeInteractivePagerView.swift`.

### Comportamento final

- O Home Search e o Registrar Entrega preenchem integralmente a área inferior dos Bottom Sheets até a base da tela no iPhone, sem barras ou recortes inferiores.
- Os containers e o pager nativo funcionam sem observadores de geometria contínuos ou enfileiramento repetitivo de medições na bridge JS durante a rolagem.

### Arquivos principais

- `scripts/patch-expo-ui-bottom-sheet.js`
- `package.json`
- `src/app/(tabs)/registrar.tsx`
- `src/components/native/NativeBottomSheet/NativeBottomSheetSwiftUI.ios.tsx`
- `src/features/home/components/HomeSearchResultsNative.ios.tsx`
- `modules/native-interactive-pager/ios/NativeInteractivePagerView.swift`
- `modules/native-startup-splash/ios/NativeStartupSplashView.swift`

### Flags e schema afetados

- Nenhuma flag ou schema do Cloud Firestore alterado.

### Validações executadas

- TypeScript (`npx tsc --noEmit`): passou com 0 erros.
- ESLint: passou com 0 erros nos arquivos afetados.
- Testes automatizados Jest (`npm test -- tests/home`): 5 suítes / 132 testes passando.
- `git diff --check`: passou sem erros de whitespace.

### Limitações conhecidas

- A alteração em `node_modules/@expo/ui/ios/BottomSheetView.swift` depende da execução do script `postinstall` (`node scripts/patch-expo-ui-bottom-sheet.js`) após qualquer `npm install` no ambiente macOS/Xcode antes do build nativo.

### Commit e publicação

- Branch: `ajustes-antigravity`.
- Commits relacionados:
  - `8f829dc` (`fix(native): remocao de barras inferiores do bottom sheet`)
  - `c50983d` (`test(native): teste de correcao ghosting que requer compilacao`)
  - `335e619` (`test(native): Remocao de instrucoes swift, requer compilacao para testar se sumiu ghosting`)

## Sincronização, Registro e Ordenação Determinística da Aba Fábrica

### Funcionalidade implementada

Correção de carregamento, concorrência e ordenação de compras na tela **FactoryPurchasesScreen** (`fabrica-compras`):

- **Subscrição Reativa e Cache sem Invalidação Destrutiva:** Implementação de padrão `subscribe`/`publish` no `FirestoreFactoryReceiptDataSource` e `MockFactoryReceiptDataSource`. O `restore()` não executa mais `clear()` indiscriminado da memória, reconciliando apenas o período consultado e reutilizando `cachedReceipt.pagamentos`, eliminando consultas N+1 repetidas à subcoleção `/payments`.
- **Sincronização Imediata no Hook:** `useFactoryPurchases` deriva `receipts` síncrono a partir da memória via `useMemo` na troca de filtros, exibindo os dados em cache no frame inicial sem flash ou tela vazia provisória.
- **Proteção contra Múltiplos Registros:** Adição da trava `isRegistering` e desativação do botão "Registrar" enquanto a persistência estiver em andamento. O formulário é limpo somente após confirmação real da gravação e preserva o input em caso de falha.
- **Ordenação Determinística Estável:** Adição do campo `createdAt?: string` em `FactoryReceipt` e `Purchase`, com gravação de timestamp no Firestore e memória. A ordenação é unificada em `right.data.localeCompare(left.data)` decrescente, com desempate por `right.createdAt.localeCompare(left.createdAt)` decrescente e fallback determinístico por `right.id.localeCompare(left.id)` para registros legados sem `createdAt`. Compras recém-criadas aparecem imediatamente no topo da lista.

### Comportamento final

- Ao abrir ou trocar de mês na Fábrica, os dados em cache carregam instantaneamente e atualizam em background sem travar a UI.
- Ao tocar em Registrar, a compra entra no topo no frame seguinte e a gravação assíncrona é aguardada sem permitir duplo toque.
- A ordem dos cards permanece idêntica após fechar e reabrir a aba Fábrica.

### Arquivos principais

- `src/types/data/factory.ts`
- `src/features/factory-purchases/types.ts`
- `src/services/factory-purchases/FactoryReceiptPurchaseAdapter.ts`
- `src/services/finance/FactoryReceiptQueryService.ts`
- `src/services/factory-purchases/FactoryPurchaseCalculationService.ts`
- `src/services/factory-purchases/FactoryReceiptDataSource.ts`
- `src/services/factory-purchases/FirestoreFactoryReceiptDataSource.ts`
- `src/hooks/useFactoryPurchases.ts`
- `src/features/factory-purchases/components/FactoryPurchasesScreen.tsx`
- `tests/factory/FactoryReceiptDataSource.test.ts`
- `tests/finance/FactoryReceiptService.test.ts`

### Flags e schema afetados

- Nenhuma flag ou schema alterado (`createdAt` já era suportado nos documentos do Firestore e agora é explicitamente mapeado no domínio).

### Validações executadas

- TypeScript (`npx tsc --noEmit`): 0 erros.
- ESLint direcionado: 0 erros e 0 warnings.
- Jest (`npm test -- tests/factory tests/finance tests/stock tests/home`): 22 suítes / 246 testes passando.
- `git diff --check`: passou sem erros de formatação.

### Limitações conhecidas

- Compras legadas criadas antes da introdução explícita de `createdAt` utilizam o fallback determinístico por `id` decrescente no desempate de compras do mesmo dia.
- O cache em memória persiste durante a sessão do app; no encerramento do processo em cold start extremo, os dados são recarregados do Firestore preservando a ordem idêntica.

### Commit e publicação

- Branch: `ajustes-antigravity`.
- Commit: `c84f3ac`.
- Mensagem: `fix(factory): sincronizacao de carregamento, registro e ordenacao deterministica das compras`.

As telas devem reutilizar repositories/services/hooks existentes, consultar
apenas o período ou entidade necessário e atualizar a UI imediatamente após
uma operação confirmada.

## Padronização de Haptic Feedback e Lifecycle do Shimmer na Home Search

### Funcionalidade implementada

1. **Padronização de Haptic Feedback:**
   - Reutilização exclusiva do helper `triggerLightImpactHaptic()` de `src/utils/haptics.ts` (`Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)`) em todos os pontos de entrada de toque das abas e telas principais:
     - **Finanças:** Cards de _Faturamento Mensal_ e _Lucro Líquido Mensal_.
     - **Home / Dashboard:** Widgets de _Recebimentos em aberto_ e _Documentos_, além do foco na barra de busca (_Search Bar_).
     - **Registrar:** Cards de _Registrar Entrega_ e _Registrar Dados Diários_, e botão _Adicionar_ da tela de Dados Diários.
     - **Configurações e Subtelas:** Centralização no componente `SettingItem` (cobrindo todas as 18+ linhas da raiz, Dados, Fábrica, Backup e lista de Clientes), botões de ação e rotas de histórico de localização.
2. **Lifecycle e Refinamento Visual do Shimmer no Placeholder da Home Search:**
   - Eliminação da trava estática `startedEntryKey` que congelava a animação após o campo perder o foco (blur).
   - Execução de animação `Animated.timing` single-shot (2800ms) governada pelo ciclo de visibilidade (`wasVisibleRef`, `hasAnimatedForCurrentVisibilityRef` e `lastEntryKeyRef`):
     - Executa exatamente uma passagem ao abrir a Home e ao retornar de uma sessão de busca.
     - Interrompe e reseta com segurança ao focar ou digitar.
     - Re-renders com `visible === true` não reiniciam indevidamente a animação.
   - **Degradê Metálico com 9 Stops e Núcleo Central Alargado:**
     - Alargamento da faixa de varredura (`waveWidth` para 75% da largura do texto).
     - Correção da cor base no Light Mode para a cor semântica do sistema (`PlatformColor('placeholderText')`).
     - Degradê com 9 stops (`[0, 0.14, 0.28, 0.40, 0.50, 0.60, 0.72, 0.86, 1]`): transição suave de prata/cinza para núcleo central amplo de alto contraste (branco/prata no Dark Mode e cinza escuro metálico no Light Mode).

### Comportamento final

- Toque nos cards e linhas de navegação aciona imediatamente um feedback tátil leve e firme, sem atrasar transições nem gerar disparos duplicados.
- Ao entrar em foco na barra de busca da Home, o haptic dispara uma única vez no evento nativo de foco.
- O shimmer do placeholder da Home executa uma única passagem por ciclo de visibilidade e para de forma suave, sem loop contínuo, com acabamento metálico amplo e elegante em ambos os temas.

### Arquivos principais

- `src/app/(tabs)/financeiro.tsx`
- `src/app/(tabs)/dashboard.tsx`
- `src/app/(tabs)/registrar.tsx`
- `src/app/clientes.tsx`
- `src/features/settings/components/SettingItem.tsx`
- `src/features/factory-purchases/components/FactoryPurchasesScreen.tsx`
- `src/features/location/components/LocationTrackingScreen.tsx`
- `src/components/native/NativeSearchField/NativeSearchFieldSwiftUI.ios.tsx`
- `src/components/native/NativeSearchField/NativeSearchField.expo.tsx`
- `src/components/native/NativeSearchField/NativeSearchPlaceholderShimmer.tsx`

### Flags e schema afetados

- Nenhuma flag ou schema alterado.

### Validações executadas

- TypeScript (`npx tsc --noEmit`): 0 erros.
- ESLint direcionado nos arquivos alterados: 0 erros.
- Jest (`tests/finance`, `tests/invoices`, `tests/deliveries`, `tests/costs`, `tests/clients`, `tests/firestore`, `tests/routes`, `tests/home`): todos os testes passando.
- `git diff --check`: limpo.

### Limitações conhecidas

- Haptic feedback físico é executado exclusivamente em dispositivos iOS/Android com suporte ao motor háptico (no web é no-op seguro).

### Commit e publicação

- Branch: `ajustes-antigravity`.
- Commit: `58e373c`.
- Mensagem: `feat(ui): padronizar haptic feedback no app e ajustar lifecycle do shimmer na home search`.

## Context Menu Nativo e Preview sem Rebarbas em Recebimentos em Aberto

### Funcionalidade implementada

1. **Transformação dos itens em cards individuais com Context Menu Nativo:**
   - Substituição do container de swipe por cards `GlassCard` independentes para cada entrega pendente na tela **Recebimentos em aberto** (`OpenPaymentsScreen.tsx`).
   - O long-press agora responde em 100% da área física do card (nome, quantidade, valor, bordas e espaço vazio), sem reflow de layout ou salto de textos.
2. **Criação do módulo nativo UIKit `modules/native-card-context-menu`:**
   - Implementação de `NativeCardContextMenuView` (`ExpoView`) com `UIContextMenuInteraction` e `UIContextMenuInteractionDelegate` direto no UIKit.
   - Fornecimento de `UITargetedPreview` com `UIPreviewParameters` configurado com `visiblePath = UIBezierPath(roundedRect: bounds, cornerRadius: cornerRadius)` e `backgroundColor = .clear` tanto para o highlight inicial (`contextMenuInteraction(_:previewForHighlightingMenuWithConfiguration:)`) quanto para o fechamento (`contextMenuInteraction(_:previewForDismissingMenuWithConfiguration:)`).
   - Eliminação completa das rebarbas e cantos retos (90º) causados pelo snapshot retangular padrão do UIKit nos primeiros frames da animação de lift.
3. **Ponte React Native e Fallback:**
   - Componente `NativeCardContextMenu.ios.tsx` consome o módulo nativo com suporte a `cornerRadius`, repassa as ações nativas do iOS (SF Symbol `checkmark.circle.fill` / "Concluído") e provê fallback gracioso para `@expo/ui` caso o Development Build ainda não tenha sido recompilado.

### Comportamento final

- Toque longo em qualquer ponto do card aciona imediatamente o lift nativo do iOS com haptic do sistema operacional.
- O preview do card mantém a geometria com cantos perfeitamente arredondados desde o frame 0 do lift até o fechamento.
- A ação "Concluído" aciona o callback `handlePaymentSwipe(deliveryId)` preservando a mutação no Firestore, o total em aberto e os agrupamentos por data.

### Arquivos principais

- `modules/native-card-context-menu/package.json`
- `modules/native-card-context-menu/expo-module.config.json`
- `modules/native-card-context-menu/ios/NativeCardContextMenu.podspec`
- `modules/native-card-context-menu/ios/NativeCardContextMenuModule.swift`
- `modules/native-card-context-menu/ios/NativeCardContextMenuView.swift`
- `modules/native-card-context-menu/src/NativeCardContextMenuView.ios.tsx`
- `modules/native-card-context-menu/src/NativeCardContextMenuView.tsx`
- `modules/native-card-context-menu/src/index.ts`
- `modules/native-card-context-menu/index.ts`
- `src/components/native/NativeCardContextMenu/NativeCardContextMenu.types.ts`
- `src/components/native/NativeCardContextMenu/NativeCardContextMenu.ios.tsx`
- `src/features/open-payments/components/OpenPaymentsScreen.tsx`
- `tsconfig.json`

### Flags e schema afetados

- Nenhuma flag ou schema afetado.

### Validações executadas

- TypeScript (`npx tsc --noEmit`): 0 erros.
- ESLint direcionado nos arquivos criados e modificados: 0 erros e 0 warnings.
- Jest (`npm test -- tests/deliveries tests/invoices`): 3 suítes / 23 testes passando.
- `git diff --check`: limpo.

### Limitações conhecidas

- A ativação do `UIContextMenuInteractionDelegate` customizado no UIKit com `visiblePath` arredondado passa a surtir efeito no iPhone após a recompilação do Development Build no Mac/Xcode. Antes da recompilação, a aplicação opera através do fallback em `@expo/ui`.

### Commit e publicação

- Branch: `ajustes-antigravity`.
- Commit: `1967736`.
- Mensagem: `feat(ui): implementar modulo UIKit nativo de context menu com visiblePath arredondado para cards`.

## Padronização de Context Menu (NativeCardContextMenu) e Exclusão Sincronizada de Dados Diários

### Funcionalidade implementada

1. **Padronização completa de Context Menu em todas as áreas de cards:**
   - **Histórico (`HistoryScreen` / `DeliveryCard`):** Card individual consome `NativeCardContextMenu` com ação `Excluir` (`trash`, destrutiva) e `cornerRadius` ajustado ao layout.
   - **Home (`TodayDeliveriesCard`):** Cada linha de entrega de hoje opera com `NativeCardContextMenu` cobrindo 100% da área física de toque com ação `Excluir`.
   - **Documentos (`InvoicesScreen`):** Substituição de `NativeSwipeActionsList` por cards com `NativeCardContextMenu`, disponibilizando a ação `Emitido` (`checkmark.seal.fill`) em cada nota fiscal e boleto.
   - **Registrar (`RegistrarDeliveryScreen`):** Substituição de `NativeSwipeActionsList` por itens de entrega com `NativeCardContextMenu` e ação `Excluir` (`trash`).
2. **Exclusão Completa e Sincronizada de Dados Diários (`RegistrarDailyDataScreen`):**
   - Adição de `NativeCardContextMenu` no card de Dados Diários com ação `Excluir` (`trash`, destrutiva).
   - Implementação de `deleteDaily(uid, date)` no `FirestoreDailyMonthlyDataSource` com `deleteDoc` no caminho `users/{uid}/dailyData/{date}`, remoção do mapa em memória e invalidação de cache de snapshot financeiro.
   - Atualização de `saveSettingsDiff` para reconciliar chaves deletadas entre `previous` e `next`.
   - Implementação de `deleteDailyData` no hook `useCostSettings` com atualização otimista local, persistência em `AsyncStorage`, exclusão no Firestore e rollback automático de estado em caso de falha remota com alerta amigável e trava `isDeleting` contra duplo toque.
3. **Aprimoramento do Fallback Nativo com `<ContextMenu.Preview>` (`@expo/ui/swift-ui`):**
   - Atualização de `NativeCardContextMenu.ios.tsx` para renderizar `<ContextMenu>` com `<ContextMenu.Trigger>`, `<ContextMenu.Items>` e `<ContextMenu.Preview>`, eliminando o escurecimento indesejado de linhas transparentes e recortes quadrados.
   - **Home (`TodayDeliveriesCard`):** Fornecimento de preview opaco com `backgroundColor: theme.colors.surfaceElevated` e `borderRadius: theme.radius.lg`.
   - **Registrar (`RegistrarDeliveryScreen`):** Manutenção do recorte arredondado real do card de entrega no preview.
   - **Histórico (`DeliveryCard`):** Fornecimento de preview dedicado e individualizado para a linha selecionada com `backgroundColor: surfaceElevated`, `borderRadius: xl + sm` e largura integral, mantendo o `GlassCard` pai da lista agrupada intacto no fundo.

### Comportamento final

- Toque longo em qualquer ponto dos cards nas 5 áreas aciona o menu de contexto nativo com haptic nativo e sem reflow de texto.
- Durante o long press, o card/linha selecionado permanece opaco, arredondado e destacado contra o fundo escurecido.
- Exclusão de Dados Diários remove o registro da persistência real e local, sem reaparecer ao reabrir a tela ou o app.

### Arquivos principais

- `src/components/native/NativeCardContextMenu/NativeCardContextMenu.types.ts`
- `src/components/native/NativeCardContextMenu/NativeCardContextMenu.ios.tsx`
- `src/features/home/components/TodayDeliveriesCard.tsx`
- `src/features/history/components/DeliveryCard.tsx`
- `src/features/invoices/components/InvoicesScreen.tsx`
- `src/app/(tabs)/registrar.tsx`
- `src/hooks/useCostSettings.ts`
- `src/services/costs/FirestoreDailyMonthlyDataSource.ts`
- `tests/costs/FirestoreDailyMonthlyDataSource.test.ts`

### Flags e schema afetados

- Nenhuma flag ou schema alterado.

### Validações executadas

- TypeScript (`npx tsc --noEmit`): 0 erros.
- ESLint direcionado: 0 erros e 0 warnings.
- Jest (`npm test -- tests/costs tests/deliveries tests/invoices tests/history tests/home tests/finance tests/factory`): 29 suítes / 286 testes passando.
- `git diff --check`: limpo.

### Limitações conhecidas

- No Development Build atual (antes da recompilação do módulo UIKit no Mac/Xcode), a apresentação opera através do fallback SwiftUI (`@expo/ui/swift-ui`) com `<ContextMenu.Preview>`. A aplicação da máscara UIKit com `visiblePath` pré-cortado desde o frame 0 do lift entrará em vigor automaticamente após o próximo build nativo.

### Commit e publicação

- Branch: `ajustes-antigravity`.
- Status: Validado localmente com 0 erros e 286 testes passando; aguardando autorização para commit.

## Enriquecimento do Resultado de Cliente na Home Search com Histórico Global Paginado, Cache Local e Escopo Temporal Unificado

### Funcionalidade implementada

1. **Enriquecimento completo do card Resumo de Cliente:**
   - Ampliação do resultado de busca por cliente na Home Search para exibir 7 métricas reais formatadas em padrão monetário e percentual (`pt-BR`):
     - `Entregas` (ex: `12 entregas`)
     - `Baldes` (ex: `23`)
     - `Valor do balde` (ex: `R$ 49,80`)
     - `Faturamento total` (ex: `R$ 1.145,40`)
     - `Lucro líquido total` (ex: `R$ 327,20`)
     - `Participação no faturamento` (ex: `16,2%`)
     - `Participação no lucro` (ex: `14,8%`)
2. **Reutilização canônica de regras financeiras e preços:**
   - **Valor do balde:** Exclusivamente `client.currentPrice` de `ClientModel` (sem multiplicar por baldes para receita).
   - **Faturamento total:** `FinancialCalculationService.calculateFaturamento` com a soma real de cada entrega válida no período.
   - **Lucro líquido total:** Dedução do custo histórico de baldes via `ExpenseCalculationService.calculateBucketCost` (cortes R$ 32 vs R$ 35) e rateio proporcional de custos (combustível, estar, luz) via `ExpenseCalculationService.calculateClientAllocation` e `FinancialCalculationService.calculateLucroLiquido`.
3. **Histórico Global Paginado no Firestore e Cache Local Persistente:**
   - Implementado método paginado `FirestoreDeliveryDataSource.loadAllHistorical(uid)` com lotes determinísticos de 250 documentos (`orderBy('date', 'desc')`, `limit(250)`, `startAfter(lastDoc)`).
   - Novo serviço `FirestoreHistoricalDeliveryCache` persistindo o histórico completo em `AsyncStorage` sob a chave `@pareact/historical-deliveries-cache-v1:${uid}` com camada em memória e isolamento estrito por `uid`.
   - Invalidação automática do cache histórico em todas as mutações (`create`, `update`, `remove`, `toggleDelivered`, `updateInvoiceStatus`, `updateBoletoStatus`, `settle`, `editMany`).
   - 0 leituras ao Firestore em buscas subsequentes com cache válido.
4. **Escopo Temporal Unificado para Numerador e Denominador:**
   - Aplicação da função canônica `matchesPeriod(delivery.data, query.period)` em memória tanto para `scopedClientDeliveries` quanto para `scopedGlobalDeliveries`.
   - **Busca sem período (ex: `Luciano`):** cliente e global utilizam todo o histórico disponível.
   - **Busca por mês (ex: `Luciano agosto`):** numerador e denominador utilizam estritamente as entregas de agosto de 2026.
   - **Busca por dia (ex: `Luciano 14/08`):** numerador e denominador utilizam estritamente as entregas da data correspondente.
   - Proteções determinísticas contra divisão por zero, `NaN`, `Infinity` e `-Infinity` (`0%`).
5. **Padronização visual e elevação de layout:**
   - Alinhamento de largura horizontal padronizado em 16 pt (`SEARCH_RESULT_HORIZONTAL_INSET = 16`).
   - Remoção do label secundário duplicado em cinza (`hideQueryContext: true`) mantendo apenas o título principal com ícone (ex: `◉ André`).
   - Elevação compacta com `COMPACT_CLIENT_EXTRA_TOP_INSET = 0` (`topPadding = 32 pt`).
   - Zero cálculos financeiros ou acessos a Firestore no JSX.

### Comportamento final

- Ao pesquisar o nome de qualquer cliente na Home Search (com ou sem período temporal), o Bottom Sheet exibe imediatamente nos estados compacto e expandido o card "Resumo" com as 7 métricas financeiras reais formatadas.
- O escopo temporal é estritamente simétrico: a busca sem período compara o cliente contra todo o histórico global, enquanto buscas com mês ou dia comparam o cliente contra o faturamento e lucro de todos os clientes no mesmo período solicitado.
- A alternância entre buscas (`Luciano` $\rightarrow$ `Luciano agosto` $\rightarrow$ `Luciano 14/08`) executa o recorte temporal 100% em memória, reutilizando o cache local sem novas consultas de rede ao Firestore.

### Arquivos principais

- `src/services/deliveries/FirestoreHistoricalDeliveryCache.ts` (novo)
- `src/services/deliveries/FirestoreDeliveryDataSource.ts`
- `src/services/deliveries/index.ts`
- `src/features/home/search/HomeSearchTypes.ts`
- `src/features/home/search/HomeSearchDataSource.ts`
- `src/features/home/search/HomeSearchService.ts`
- `src/features/home/components/HomeSearchResultsVisualModel.ts`
- `src/features/home/components/HomeSearchResultsNative.ios.tsx`
- `tests/deliveries/FirestoreHistoricalDeliveryCache.test.ts` (novo)
- `tests/deliveries/FirestoreDeliveryDataSource.test.ts` (novo)
- `tests/home/HomeSearchService.test.ts`
- `tests/home/HomeSearchResultsVisualModel.test.ts`
- `tests/home/HomeSearchPresentationFlow.test.ts`
- `tests/home/HomeSearchResultsPresentation.test.ts`

### Flags e schema afetados

- Nenhuma flag ou schema alterado.

### Validações executadas

- TypeScript (`npx tsc --noEmit`): 0 erros.
- ESLint: 0 erros e 0 warnings.
- Jest (`npm test -- tests/deliveries tests/home tests/finance tests/clients tests/routes tests/invoices tests/stock tests/costs tests/factory tests/firestore`): 48 suítes / 376 testes passando com 100% de sucesso.
- `git diff --check`: limpo.

### Limitações conhecidas

- Nenhuma. O cálculo é totalmente determinístico, opera sob demanda e utiliza cache local persistente com invalidação automática em mutações.

- Commit: `17a0e28` (`feat: improve client metrics and historical search scope`).
- Status: Commit e push realizados na branch `ajustes-antigravity`.

## Padronização visual dos cabeçalhos e elevação compacta na Home Search

### Funcionalidade implementada

- **Simplificação e padronização de cabeçalhos:** Em resultados financeiros (`financialMetric` sem cliente explícito), resumos gerais de período (`periodSummary`) e resumos da fábrica com período (`factorySummary`), foi removido o texto redundante cinza (_eyebrow context_) e o ícone anterior à data/período. O cabeçalho passa a exibir diretamente o período/data em tipografia `headline bold rounded`, seguido pelo valor principal e pelo card _"Base do cálculo"_.
- **Elevação do bloco no Bottom Sheet compacto:** Introduzido `COMPACT_FINANCIAL_EXTRA_TOP_INSET = 4` em [HomeSearchResultsNative.ios.tsx](file:///c:/Projetos/PAReact%20Antigravity/pwa-ios-2026/src/features/home/components/HomeSearchResultsNative.ios.tsx), elevando o bloco completo (período + valor + card) em 16 pt no Bottom Sheet compacto (`topPadding = 36 pt` vs `52 pt` padrão), preservando rigorosamente o layout expandido em `32 pt` (`spacing.xxl`).
- **Preservação de outros tipos de resultado:** Resultados de cliente (`Luciano`, `André`), rotas com mapa/GPS, entregas individuais, compras da fábrica, configurações do carro e métricas com cliente explícito (`Faturamento Luciano agosto`) mantiveram suas estruturas e cabeçalhos intactos.

## Botão contextual e Bottom Sheet nativo de ajuda da Home Search

### Funcionalidade implementada

- **Botão nativo de ajuda na Search Bar:** Adicionado botão nativo discreto (`questionmark.circle`, cor `#8B8B93`, 18 pt) integrado no canto direito de [NativeSearchFieldSwiftUI.ios.tsx](file:///c:/Projetos/PAReact%20Antigravity/pwa-ios-2026/src/components/native/NativeSearchField/NativeSearchFieldSwiftUI.ios.tsx) (e propagado aos fallbacks). O botão é exibido **exclusivamente** quando a Search Bar possui foco e o campo de texto está vazio (`focused && !value`). Ao digitar qualquer caractere, ao perder o foco ou com a Home em repouso, o botão fica 100% oculto, preservando integralmente o layout, altura, largura, lupa e shimmer.
- **Catálogo tipado centralizado de pesquisas:** Criado [HomeSearchHelpData.ts](file:///c:/Projetos/PAReact%20Antigravity/pwa-ios-2026/src/features/home/help/HomeSearchHelpData.ts) com 6 categorias e 23 exemplos reais auditados (Clientes, Finanças, Fábrica, Rotas e GPS, Carro, Resumos).
- **Bottom Sheet nativo de ajuda (`HomeSearchHelpSheet`):** Apresentado via [NativeBottomSheet](file:///c:/Projetos/PAReact%20Antigravity/pwa-ios-2026/src/components/native/NativeBottomSheet) com detents `[{ fraction: 0.65 }, 'large']` e renderização nativa SwiftUI em [HomeSearchHelpContent.ios.tsx](file:///c:/Projetos/PAReact%20Antigravity/pwa-ios-2026/src/features/home/help/HomeSearchHelpContent.ios.tsx).
- **Design e Responsividade:**
  - Cards internos agrupadores com curvatura contínua Apple de **`36 pt`** (`roundedCornerStyle: 'continuous'`), idêntica ao card de resultados de cliente (`Luciano`);
  - Títulos de categoria limpos (sem ícones prévios), alinhados com `padding({ leading: spacing.sm })` (12 pt) e tipografia `caption semibold` (12 pt);
  - Respiro horizontal de **`24 pt`** (`spacing.xl`) à esquerda do texto dos exemplos;
  - **100% da área da linha interativa** através de `<Button>` com largura total, `<HStack>` com `contentShape(shapes.rectangle())` e `<Spacer />` central;
  - Elevação do bloco de conteúdo do sheet com `top: spacing.md` (16 pt).
- **Integração de busca:** Ao selecionar um exemplo, o Help Sheet fecha, o texto é inserido na Search Bar e a busca é submetida exclusivamente pelo fluxo canônico `handleSearchSubmit`, abrindo o resultado correspondente no `HomeSearchResultsSheet`. Fechar o sheet sem selecionar nada não submete nenhuma busca.

### Arquivos principais

- `src/components/native/NativeSearchField/NativeSearchField.types.ts`
- `src/components/native/NativeSearchField/NativeSearchFieldSwiftUI.ios.tsx`
- `src/components/native/NativeSearchField/NativeSearchField.expo.tsx`
- `src/components/premium/SearchBar.tsx`
- `src/features/home/components/HomeSearchResultsVisualModel.ts`
- `src/features/home/components/HomeSearchResultsNative.ios.tsx`
- `src/features/home/help/HomeSearchHelpTypes.ts` (novo)
- `src/features/home/help/HomeSearchHelpData.ts` (novo)
- `src/features/home/help/HomeSearchHelpContent.ios.tsx` (novo)
- `src/features/home/help/HomeSearchHelpContent.tsx` (novo)
- `src/features/home/help/HomeSearchHelpSheet.tsx` (novo)
- `src/app/(tabs)/dashboard.tsx`
- `tests/home/HomeSearchResultsVisualModel.test.ts`
- `tests/home/HomeSearchHelpData.test.ts` (novo)

### Flags e schema afetados

- Nenhuma flag ou schema afetado.

### Validações executadas

- TypeScript (`npx tsc --noEmit`): 0 erros.
- ESLint: 0 erros e 0 warnings.
- Jest (`npm test -- tests/home tests/deliveries tests/finance tests/clients tests/routes tests/invoices tests/stock tests/costs tests/factory tests/firestore`): 49 suítes / 382 testes passando com 100% de sucesso.
- `git diff --check`: limpo.

### Limitações conhecidas

- O catálogo de ajuda contém os 23 comandos/exemplos auditados e suportados pelo parser atual. Formatos como datas relativas ("ontem", "amanhã") e intervalos livres continuam reservados para futuras expansões do parser.

### Commit e publicação

- Commit: `189f293` (`feat: add home search native help sheet and header styling`).
- Status: Commit e push realizados na branch `ajustes-antigravity`.

## Expansão canônica do parser temporal da Home Search

### Funcionalidade implementada

- **Dias relativos:** Suporte nativo e determinístico para `ontem` (data atual - 1 dia) e `amanhã` (data atual + 1 dia), preservando `hoje`.
- **Meses relativos:** Suporte para `este mês`/`mês atual`, `mês passado`/`último mês` e `próximo mês`, com transição segura de ano (ex: janeiro -> mês passado = dezembro do ano anterior).
- **Semanas relativas:** Suporte para `esta semana`/`semana atual`, `semana passada`/`última semana` e `próxima semana`, calculando o intervalo fechado canônico de Segunda-feira (`startDate`) a Domingo (`endDate`).
- **Intervalos de datas explícitos:** Suporte para formatos de range como `01/08 a 15/08`, `01/08 até 15/08`, `de 01/08 a 15/08`, `20/12/2025 a 10/01/2026` e `2026-08-01 a 2026-08-15`, com resolução para o ano de referência quando não especificado e validação estrita anti-inversão (`startDate <= endDate`).
- **Tipo canônico `range`:** Estendido `HomeSearchPeriod` com `{ kind: 'range', startDate: string, endDate: string }` e `matchesPeriod` canônico utilizado de ponta a ponta em clientes, métricas financeiras, fábrica, resumos e rotas.
- **Catálogo de ajuda atualizado:** Adicionados 4 exemplos de períodos relativos e ranges no catálogo [HomeSearchHelpData.ts](file:///c:/Projetos/PAReact%20Antigravity/pwa-ios-2026/src/features/home/help/HomeSearchHelpData.ts) (totalizando 27 exemplos auditados).

### Arquivos principais

- `src/features/home/search/HomeSearchTypes.ts`
- `src/features/home/search/HomeSearchQueryParser.ts`
- `src/features/home/search/HomeSearchDataSource.ts`
- `src/features/home/search/HomeSearchService.ts`
- `src/features/home/components/HomeSearchResultsPresentation.ts`
- `src/features/home/help/HomeSearchHelpData.ts`
- `tests/home/HomeSearchHelpData.test.ts`
- `tests/home/HomeSearchService.test.ts`

### Flags e schema afetados

- Nenhuma flag ou schema afetado.

### Validações executadas

- TypeScript (`npx tsc --noEmit`): 0 erros.
- ESLint: 0 erros e 0 warnings.
- Jest (`npm test`): 49 suítes / 404 testes passando com 100% de sucesso.
- `git diff --check`: limpo.

### Limitações conhecidas

- Nenhuma. O parser opera em $O(1)$, com expressões regulares estritas e testes de regressão temporal.

## Consolidação canônica de quilometragem (GPS + Manual) na Home Search

### Funcionalidade implementada

- **Unificação canônica de quilometragem:** Centralizada a regra de composição aditiva do app através da função `summarizeConsolidatedKilometers(sessions, dailyExpenses, isDateInPeriod)` em [routeTrackingDistance.ts](file:///c:/Projetos/PAReact%20Antigravity/pwa-ios-2026/src/services/routes/routeTrackingDistance.ts):
  $$\text{totalKilometers} = \text{manualKilometers (gastosDiarios.km)} + \text{automaticKilometers (GPS)}$$
- **Resumos por período (`periodSummary`):** A distância exibida em `resumo hoje`, `resumo ontem`, `resumo semana passada`, `resumo agosto`, `resumo 01/08 a 15/08`, etc. consolida a quilometragem do GPS com os lançamentos manuais de `gastosDiarios` do período.
- **Consultas diretas de km (`routeMetric`):** Consultas como `km 14/08`, `quilometragem agosto`, `km semana passada` e `km 01/08 a 15/08` utilizam exatamente a mesma consolidação unificada.
- **Carregamento otimizado de dados:** Em `AppHomeSearchDataSource.load`, consultas de `routeMetric` carregam em paralelo as rotas locais e os dados financeiros/gastos diários com cache em memória/disco (`financialPeriodSnapshotCache`) e consulta Firestore delimitada sem N+1.
- **Preservação estrita da contagem de rotas:** A linha `Rotas` (`routeCount`) preserva estritamente a quantidade de sessões GPS gravadas (`sessions.length`). Lançamentos manuais de km em Dados do Dia não inflam a quantidade de rotas.
- **Padronização do rótulo da métrica:** No card _Operação_ dos resumos, o rótulo foi atualizado de `Distância das rotas` para **`Quilometragem total`** em [HomeSearchResultsVisualModel.ts](file:///c:/Projetos/PAReact%20Antigravity/pwa-ios-2026/src/features/home/components/HomeSearchResultsVisualModel.ts).

### Arquivos principais

- `src/services/routes/routeTrackingDistance.ts`
- `src/services/routes/index.ts`
- `src/features/home/search/HomeSearchDataSource.ts`
- `src/features/home/search/HomeSearchService.ts`
- `src/features/home/components/HomeSearchResultsPresentation.ts`
- `src/features/home/components/HomeSearchResultsVisualModel.ts`
- `tests/home/HomeSearchService.test.ts`
- `tests/home/HomeSearchResultsVisualModel.test.ts`

### Flags e schema afetados

- Nenhuma flag ou schema afetado.

### Validações executadas

- TypeScript (`npx tsc --noEmit`): 0 erros.
- ESLint: 0 erros e 0 warnings.
- Jest (`npm test`): 49 suítes / 412 testes passando com 100% de sucesso.
- `git diff --check`: limpo.

### Limitações conhecidas

- Nenhuma. O cálculo é determinístico, compartilhado entre todas as telas e protegido contra dupla contagem ou ausência de rotas GPS.

### Commit e publicação

- Status: Commit e push realizados na branch `ajustes-antigravity`.

## Botão Nativo de Status de Rastreamento (NativeTrackingStatusButton) com Liquid Glass e Animação Breathe

### Funcionalidade implementada

- **Criação do componente nativo reutilizável `NativeTrackingStatusButton`:**
  - Substituição do `NativeGlassIconButton` pelo novo controle nativo de cápsula na tela de **Localização e Rotas** ([LocationTrackingScreen.tsx](file:///c:/Projetos/PAReact%20Antigravity/pwa-ios-2026/src/features/location/components/LocationTrackingScreen.tsx)).
  - **SwiftUI nativo com Liquid Glass:** Renderização via `@expo/ui/swift-ui` com `Host`, `Button`, `HStack`, `Image`, `Text`, `buttonStyle('plain')` e `glassEffect({ glass: { interactive: true, variant: 'regular' }, shape: 'capsule' })`.
  - **Sincronização reativa de estado nativo:** Binding direto e transparente entre `route?.active` (do `locationTrackingService.getRoute()`) e o `ObservableState<boolean>` nativo via `useNativeState`, sem duplicação de estado nem polling extra.
  - **Animação Apple Nativa (Breathe):** Aplicação do modificador nativo `symbolEffect({ effect: 'breathe' }, { isActive: isTrackingActive })` exclusivamente no indicador circular à esquerda. A cápsula do botão permanece com geometria e dimensões 100% estáveis (não pulsa nem escala).
  - **Refinamento visual iOS:** Tipografia `18 pt` semibold SF Pro Rounded, indicador circular ampliado (`16 pt` / frame `18 x 18 pt`), espaçamento balanceado de 9 pt e largura de cápsula em `132 pt` com altura fixa em `56 pt`.
  - **Cores semânticas do sistema:** Uso de `PlatformColor('secondaryLabel')` para o indicador inativo (`circle` ○) e `PlatformColor('systemGreen')` para o indicador ativo (`circle.fill` ●).
  - **Fallback robusto:** `GlassSurface` e `Animated.loop` suave com easing para Web, Android e Expo Go.

### Comportamento final

- **Estado Parado / Inativo (`active = false`):**
  - Exibe `○ Iniciar` com círculo discreto e texto semibold.
  - Nenhuma animação em execução.
- **Ao Iniciar Rastreamento:**
  - `route?.active` passa para `true`;
  - O indicador alterna instantaneamente para `● Ao vivo` em verde nativo (`systemGreen`) e inicia a animação suave de respiração (`breathe`) acelerada por GPU a 120fps.
  - O botão é protegido contra duplo toque via trava `busy`.
- **Durante Rastreamento Ativo:**
  - A respiração do indicador continua contínua e estável enquanto a gravação de rota estiver ativa.
- **Ao Parar Rastreamento:**
  - `route?.active` passa para `false`;
  - A animação cessa imediatamente e o botão retorna ao estado `○ Iniciar`.

### Arquivos principais

- `src/components/native/NativeTrackingStatusButton/NativeTrackingStatusButton.types.ts` (novo)
- `src/components/native/NativeTrackingStatusButton/NativeTrackingStatusButtonSwiftUI.ios.tsx` (novo)
- `src/components/native/NativeTrackingStatusButton/NativeTrackingStatusButtonFallback.tsx` (novo)
- `src/components/native/NativeTrackingStatusButton/NativeTrackingStatusButton.native.tsx` (novo)
- `src/components/native/NativeTrackingStatusButton/NativeTrackingStatusButton.tsx` (novo)
- `src/components/native/NativeTrackingStatusButton/index.ts` (novo)
- `src/components/native/index.ts`
- `src/features/location/components/LocationTrackingScreen.tsx`
- `tests/home/HomeSearchService.test.ts`

### Flags e schema afetados

- Nenhuma flag ou schema do Cloud Firestore alterado. Toda a camada de persistência local (`RouteTrackingRepository`), permissões e background GPS foi preservada integralmente.

### Validações executadas

- TypeScript (`npx tsc --noEmit`): 0 erros.
- ESLint direcionado: 0 erros e 0 warnings.
- Jest (`npm test -- tests/routes tests/native tests/home tests/history`): 15 suítes / 219 testes passando com 100% de sucesso.
- `git diff --check`: limpo.

### Limitações conhecidas

- A animação nativa `symbolEffect('breathe')` requer iOS 18+ / iOS 26 (presente no Development Build iOS SDK 57 atual). Em ambientes de fallback (Android/Web/Expo Go), utiliza-se o loop animado JS do fallback.

### Commit e publicação

- Status: Validado localmente com 0 erros; aguardando autorização para commit.

## Limpeza do antigo card Última Rota da Home

O antigo atalho `Última rota` foi removido na limpeza geral porque `LastRouteCard` e
`useLatestCompletedRoute` não possuíam consumidores de runtime. A remoção não altera o
tracking de rotas, a persistência local, a tela Localização ou os cálculos de combustível.

- Removidos: `src/features/home/components/LastRouteCard.tsx` e
  `src/features/home/hooks/useLatestCompletedRoute.ts`.
- Mantidos: `src/features/home/utils/lastRouteFormatUtils.ts` e seu teste de formatação,
  sem integração com a UI da Home.
- Nenhuma flag ou schema do Cloud Firestore foi alterado.

## Padronização do Long Press e Context Menu nos Cards

### Funcionalidade implementada

Padronização e polimento visual do Long Press / Context Menu nativo com `@expo/ui/community/menu` (`MenuView` nativo + `shouldOpenOnLongPress`), eliminando platters quadrados, flashes e atrasos de interação:

- Propagação de `borderRadius: theme.radius.xl + theme.spacing.sm` (~36 pt) e `width: '100%'` tanto no wrapper `<NativeCardContextMenu>` (`MenuView`) quanto na `View` filha capturada.
- Ajuste de `backgroundColor` nas linhas internas para coincidir perfeitamente com os containers pais (`theme.colors.surface` no `PremiumCard` e `#131417` / `glassSurface` no `GlassCard`), garantindo que listas agrupadas permaneçam visualmente unificadas quando estáticas.
- Adição de `overflow: 'hidden'` nos containers pais de listas agrupadas (`TodayDeliveriesCard`, `RegistrarDeliveryScreen`, `InvoicesScreen`), impedindo que o fundo opaco das linhas filhas vaze sobre os cantos arredondados externos.
- Preservação da arquitetura 100% nativa sem dependência do módulo Swift customizado regressivo nem de nós artificiais `ContextMenu.Preview`.

### Comportamento final

- **Estado Normal (Parado)**: Os grandes containers externos (Home, Registro, Documentos, Recebimentos) mantêm seu acabamento original com cantos arredondados contínuos de 36 pt. As linhas internas permanecem integradas e visualmente indistinguíveis do bloco principal.
- **Durante o Long Press (Lift)**: A resposta ao toque longo é instantânea em toda a largura da linha (`width: '100%'`). Apenas o item tocado levanta com corpo opaco e cantos arredondados suaves (~36 pt), sem piscar e sem distorcer o container que permanece ao fundo.
- **Fechamento**: Ao soltar ou cancelar, a tela retorna com fluidez total ao estado estático original.

### Arquivos principais

- `src/features/history/components/DeliveryCard.tsx` (referência canônica)
- `src/features/home/components/TodayDeliveriesCard.tsx`
- `src/app/(tabs)/registrar.tsx` (`RegistrarDeliveryScreen` e `RegistrarDailyDataScreen`)
- `src/features/open-payments/components/OpenPaymentsScreen.tsx`
- `src/features/invoices/components/InvoicesScreen.tsx`
- `src/features/location/components/LocationTrackingScreen.tsx`
- `src/components/native/NativeCardContextMenu/NativeCardContextMenu.ios.tsx`

### Flags e schema afetados

- Nenhuma flag de funcionalidade ou schema do Cloud Firestore alterado. Modificação estritamente de UI e integração de eventos nativos iOS.

### Validações executadas

- TypeScript (`npx tsc --noEmit`): 0 erros.
- ESLint direcionado nos arquivos afetados: 0 erros e 0 warnings.
- Jest: 19 suítes e 240 testes passando nas áreas de histórico, home, entregas, faturas e custos.
- `git diff --check`: limpo.
- Teste visual interativo: validado via Fast Refresh no iPhone em Development Build.

### Limitações conhecidas

- O snapshot de platter e lift com cantos arredondados contínuos é uma característica nativa do `UIContextMenuInteraction` no iOS. Plataformas com fallback (Web/Android) utilizam seus respectivos diálogos e menus contextuais padrão.

### Commit e publicação

- Branch: `ajustes-antigravity`.
- Commit: `5f8e18c`.
- Mensagem: `revert: reversao para estado anterior ao segurar para apagar`.
- Status: Validado e publicado na branch `ajustes-antigravity`.

## Home Search: Correção de Ghosting e Paginação Horizontal de Múltiplas Rotas

### Funcionalidade implementada

Resolução definitiva do problema de ghosting/rastro visual no Bottom Sheet da Home Search e restauração da navegação horizontal entre múltiplas rotas:

- **Eliminação do ghosting em buscas individuais e clientes**: Identificado que o caminho condicional `!shouldEnableScroll` baseado em `ZStack` com `clipped()` e `Spacer` sem `ScrollView` causava retenção de frames durante o arraste da sheet. Unificada a hierarquia para utilizar `<ScrollView axes="vertical">` diretamente em todos os resultados padrão.
- **Isolamento e eliminação do ghosting em rotas**: Identificado que o `NativeInteractivePager` / `TabView` do SwiftUI retinha frames durante rolagem/arraste do Bottom Sheet no iOS. O pager SwiftUI foi descontinuado nesse fluxo.
- **Restauração da paginação horizontal (`HomeSearchRoutePagerRN`)**: Para buscas com 2 ou mais rotas (ex.: `rotas agosto`), criado componente com `<ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} nestedScrollEnabled>` em React Native, hospedado via `<RNHostView matchContents={false}>`.
- **Ajustes de layout no detent compacto**:
  - No detent compacto (`isLarge === false`), o `topPadding` para rotas individuais e múltiplas rotas foi ajustado para 20pt (`COMPACT_ROUTE_PAGER_TOP_PADDING`), elevando o bloco completo (título, mapa, dados/seções) mais próximo do topo do sheet.
  - A tipografia do título de rota foi ajustada para `subheadline` (15pt negrito arredondado no SwiftUI) e `headline` (17pt negrito no pager React Native), mantendo peso, cor e ícones proporcionais.
  - No detent expandido (`isLarge === true`), layout e espaçamentos permanecem 100% inalterados (32pt).

### Comportamento final

- **Buscas sem rota (clientes, métricas, finanças, entregas)**: Renderização vertical estável em `<ScrollView axes="vertical">` nativo com zero ghosting.
- **Rotas individuais (`rota hoje`, `rota ontem`, `rota 13/08`)**: Renderização vertical fluida com preview do mapa nativo (`NativeTrackedRoutesMap`), título compacto no detent inicial e zero ghosting.
- **Múltiplas rotas (`rotas agosto`)**: Swipe horizontal fluido entre sessões de rota com snap de página e visualização de mapa nativo por página, permitindo rolagem vertical do conteúdo e arraste do sheet sem interferência ou rastros visuais.

### Arquivos principais

- `src/features/home/components/HomeSearchResultsNative.ios.tsx`
- `src/features/home/components/HomeSearchRoutePagerRN.tsx`
- `src/features/home/components/HomeSearchRoutePreview.ios.tsx`
- `src/features/home/components/HomeSearchResultsContent.ios.tsx`
- `src/features/home/components/HomeSearchResultsVisualModel.ts`

### Flags e schema afetados

- Nenhuma flag ou schema do Cloud Firestore alterado. Modificações estritamente de UI nativa e orquestração de scroll/pager.

### Validações executadas

- TypeScript (`npx tsc --noEmit`): 0 erros.
- ESLint: 0 erros e 0 warnings.
- Testes Jest (`tests/home`): 7 suítes e 180 testes passando com 100% de sucesso.
- `git diff --check`: limpo.
- Teste interativo via Fast Refresh no iPhone em Development Build: validada ausência de ghosting em 1 rota, 2+ rotas, buscas de cliente, mapa e arraste entre detents.

### Limitações conhecidas

- A paginação horizontal de rotas utiliza `ScrollView` com `pagingEnabled` do React Native encapsulado via `RNHostView` dentro da hierarquia SwiftUI do Bottom Sheet, mantendo isolamento de contexto de toque entre eixos vertical e horizontal.

### Commit e publicação

- Branch: `ajustes-antigravity`.
- Commit: `004ee00`.
- Mensagem: `fix: resolve Search Bar Bottom Sheet ghosting and refine route results`.
- Status: Validado e publicado na branch `ajustes-antigravity`.

## Registro de Entrega: Correção de Ghosting no Bottom Sheet

### Funcionalidade implementada

Resolução definitiva do problema de ghosting/rastro visual no Bottom Sheet da aba de Registrar entrega:

- **Eliminação do `NativeInteractivePager` / `TabView`**: Identificado que o container de paginação horizontal SwiftUI `NativeInteractivePager` causava retenção de frames durante scroll da lista de clientes e arraste do sheet.
- **Renderização direta de etapas**: O fluxo foi unificado para renderizar diretamente a etapa ativa (`{selectedItem ? detailView : listView}`) dentro do container do sheet.
- **Preservação integral do fluxo de registro**: A seleção de cliente no `listView` continua abrindo o formulário de entrega (`detailView`) e a desmarcação retorna à lista de clientes sem perda de estado.
- **Limpeza de código**: Removidos imports de `NativeInteractivePager`, `NativeInteractivePagerPage` e estados/efeitos vinculados a IDs de requisição de página (`pageRequestID`).

### Comportamento final

- **Lista de clientes**: Rolagem fluida da `List` SwiftUI nativa e arraste entre detents (pequeno e grande) com zero ghosting, zero duplicação de texto e zero travamentos visuais.
- **Formulário de entrega (`detailView`)**: Exibição limpa do `DatePicker`, stepper de quantidade de baldes, `Button` nativo e cálculo de valor sem interferência de paginação ou artefatos gráficos.

### Arquivos principais

- `src/components/native/NativeBottomSheet/NativeBottomSheetSwiftUI.ios.tsx`

### Flags e schema afetados

- Nenhuma flag de funcionalidade ou schema do Cloud Firestore alterado. Modificação estritamente de UI nativa e orquestração de transição de telas no Bottom Sheet.

### Validações executadas

- TypeScript (`npx tsc --noEmit`): 0 erros.
- ESLint: 0 erros e 0 warnings.
- Testes Jest (`tests/deliveries`, `tests/clients`, `tests/home`): 15 suítes e 206 testes passando com 100% de sucesso.
- `git diff --check`: limpo.
- Teste interativo via Fast Refresh no iPhone em Development Build: validada rolagem da lista de clientes, seleção de cliente, abertura do formulário e arraste entre detents com zero ghosting.

### Limitações conhecidas

- Nenhuma. A transição entre seleção de cliente e formulário de entrega é instantânea e nativa.

### Commit e publicação

- Status: Alteração local validada via Fast Refresh no dispositivo físico; aguardando autorização para commit/push.

## Registrar Entrega: Pager Horizontal RN com Páginas SwiftUI Nativas

### Funcionalidade implementada

- Substituição controlada da troca direta entre lista e detalhes por um pager privado React Native específico do Registrar.
- Uso de `ScrollView` horizontal com `pagingEnabled`, hospedado via `RNHostView` dentro do Bottom Sheet SwiftUI.
- Cada página mantém um `Host` SwiftUI próprio: a primeira contém a `List` nativa de clientes e a segunda contém o formulário nativo com `DatePicker`, stepper, Liquid Glass e botão de confirmação.
- A largura das páginas é medida pelo `onLayout` do pager; não há largura fixa baseada na tela.
- A seleção de cliente solicita o avanço animado para a página de detalhes. O retorno para a lista só sincroniza `selectedItem` após `onMomentumScrollEnd` confirmar a página 0.

### Comportamento final

- O mesmo Bottom Sheet, detents, drag indicator, Safe Area e correção da barra inferior são preservados.
- O eixo horizontal é controlado pelo `ScrollView` RN, permitindo acompanhar o dedo, interromper, retornar ou completar o gesto.
- `List`, `DatePicker`, stepper, botões e demais controles continuam nativos SwiftUI.
- Não são usados `SwiftUI.TabView` nem `NativeInteractivePager` neste fluxo.
- A lógica de registro, seleção de cliente, quantidade, data, validações e regras de negócio permanece inalterada.

### Arquivos principais

- `src/components/native/NativeBottomSheet/RegistrarDeliveryPagerRN.tsx`
- `src/components/native/NativeBottomSheet/NativeBottomSheetSwiftUI.ios.tsx`
- `src/app/(tabs)/registrar.tsx`
- `src/features/home/components/HomeSearchRoutePagerRN.tsx` (referência estrutural, sem alteração)

### Flags e schema afetados

- Nenhuma flag de funcionalidade alterada.
- Nenhum schema, regra ou leitura do Cloud Firestore alterado.
- Swift, Pods, `patch-expo-ui-bottom-sheet.js` e o módulo `NativeInteractivePager` não foram alterados.

### Validações executadas

- TypeScript (`npm run typecheck`): passou.
- ESLint do novo pager: passou.
- ESLint direcionado dos arquivos alterados, com a regra Prettier isolada: passou.
- `git diff --check`: passou.
- Não houve recompilação do Development Build.

### Limitações conhecidas

- A validação interativa no iPhone Development Build ainda é necessária para confirmar ausência de ghosting e a convivência entre swipe horizontal, scroll vertical da `List` e arraste vertical do Bottom Sheet.
- O pager usa `RNHostView` externo e `Host` SwiftUI em cada página, aumentando a profundidade de composição nativa em relação à troca direta anterior.

### Commit e publicação

- Não commitado.
- HEAD de referência: `883a060023793b84faade1db0136fff59eaa6b01` (`feat(ui): atualizar fluxo de compras e ajustes visuais`).
- Nenhum commit ou push adicional realizado.

## Custo de Combustível nos Cards de Rota e Ajustes na Tela de Detalhes da Rota

### Funcionalidade implementada

- Integração do cálculo canônico de custo de combustível nos cards de rota da aba Localização (`RouteHistoryCard`), reutilizando exclusivamente o serviço `FuelCostCalculationService` (`useRouteFuelCost`). A antiga integração no card `Última rota` da Home foi removida na limpeza geral.
- Na tela de detalhes da rota (`RouteDetailsScreen` e `RouteSummaryCard`):
  - Inclusão da linha `Valor gasto` com o valor canônico formatado (`formatCurrency(fuelCost)`) e SF Symbol `fuelpump`.
  - Atualização do formato da linha `Data` para `${weekday} ${day}/${month}/${year}` (ex: `quarta-feira 19/08/26`).
  - Remoção completa da linha `Pontos GPS`.
  - Aumento refinado do arredondamento dos cantos do mapa para `theme.radius.xl + theme.spacing.sm` (34pt), harmonizado ao design system.

### Comportamento final

- **Cards de rotas (Localização):** cada card do histórico do mês exibe os horários de início/fim e no rodapé `26,37 km` à esquerda com `R$ 18,42` à direita.
- **Tela de detalhes da rota:** exibe o mapa com cantos arredondados suaves (34pt) e o card de resumo com Data (`quarta-feira 19/08/26`), Início, Fim, Duração, Distância, Valor gasto e Km considerado no dia (quando aplicável), sem a linha de Pontos GPS.
- Todos os cálculos utilizam os dados reais da sessão (`session.distanceMeters / 1000`), a autonomia configurada do carro (`useCarSettings`) e o preço/tipo de combustível correspondente à data da rota (`useCostSettings`), sem duplicar lógica matemática nem usar km consolidado.

### Arquivos principais

- `src/hooks/useRouteFuelCost.ts`
- `src/features/location/components/LocationTrackingScreen.tsx`
- `src/features/location/components/RouteDetailsScreen.tsx`
- `src/features/location/components/RouteSummaryCard.tsx`
- `src/app/(tabs)/dashboard.tsx`
- `tests/routes/useRouteFuelCost.test.ts`

### Flags e schema afetados

- Nenhuma flag ou schema do Cloud Firestore alterado.

### Validações executadas

- TypeScript (`npx tsc --noEmit`): 0 erros.
- ESLint direcionado: 0 erros e 0 warnings.
- Testes automatizados Jest (`tests/home`, `tests/routes`, `tests/costs`, `tests/finance`): 29 suítes e 323 testes passando com 100% de sucesso.
- `git diff --check`: limpo.

### Limitações conhecidas

- Se a rota não possuir preço de combustível registrado na data e nenhum preço anterior tiver sido configurado, o valor exibido permanece `R$ 0,00`.

### Commit e publicação

- Status: Alterações validadas localmente via Fast Refresh no dispositivo físico; sem commit/push realizado.

## Padronização do Cabeçalho com Logo nas Abas Principais

### Funcionalidade implementada

- Padronização visual dos cabeçalhos principais de **Finanças**, **Registrar**, **Histórico** e **Configurações** usando a Home como referência canônica.
- Reutilização de `NativeGlassHeader.leftActions` com `AppLogo variant="splash"`, preservando a seleção automática dos assets Light/Dark já existente no `AppLogo`.
- Cópia dos valores finais da Home:
  - logo `size={200}`;
  - slot fixo de `44×44`, centralizado e com `overflow: 'visible'`;
  - `marginLeft: -theme.spacing.xs`;
  - `marginRight: theme.spacing.xl`;
  - deslocamento vertical `theme.spacing.xs + theme.spacing.xxs`;
  - título `System`, `32pt`, `fontWeight: '700'` e `marginLeft: -(theme.spacing.xxs * 2)`.
- Preservação do `includeTopSafeArea` e da estrutura própria de cada tela.
- Alteração restrita aos cabeçalhos principais; subcabeçalhos, filtros, menus, cards, listas, navegação, handlers e lógica permaneceram intactos.

### Comportamento final

- Finanças, Registrar, Histórico e Configurações exibem logo à esquerda do título, na mesma linha, com alinhamento vertical central e espaçamento consistente com a Home.
- A logo acompanha automaticamente Light/Dark por meio do `AppLogo` existente.
- O slot mantém a altura do cabeçalho em `44pt`, sem criar deslocamento vertical desnecessário no conteúdo abaixo.
- Safe Area continua sendo controlada pela configuração original de cada cabeçalho.

### Arquivos principais

- `src/app/(tabs)/dashboard.tsx` (referência visual canônica)
- `src/app/(tabs)/financeiro.tsx`
- `src/app/(tabs)/registrar.tsx`
- `src/features/history/components/HistoryScreen.tsx`
- `src/features/settings/components/SettingsScreen.tsx`
- `src/components/layout/NativeGlassHeader/NativeGlassHeader.tsx` (abstração reutilizada, sem alteração)
- `src/components/branding/AppLogo.tsx` (seleção Light/Dark reutilizada, sem alteração)

### Flags e schema afetados

- Nenhuma flag alterada.
- Nenhum schema, documento ou coleção do Cloud Firestore alterado.
- Nenhum asset, tema ou dependência alterado.

### Validações executadas

- TypeScript (`npx.cmd tsc --noEmit`): passou com 0 erros.
- ESLint direcionado nos cinco arquivos de cabeçalho: passou com 0 erros usando as regras de lint; `prettier/prettier` foi desativado na execução por avisos CRLF preexistentes do checkout.
- `git diff --check`: passou; apenas avisos de normalização LF/CRLF foram emitidos pelo Git.

### Limitações conhecidas

- A confirmação visual final de alinhamento, overflow do símbolo e Safe Area em diferentes modelos de iPhone ainda depende de teste no iPhone Development Build.
- O cabeçalho mantém `includeTopSafeArea` específico de cada tela; diferenças estruturais existentes entre as abas permanecem intencionais.

### Commit e publicação

- Alteração não commitada.
- `HEAD` atual: `614ab2b` (`feat: refine finance chart interactions and metric animations`), commit anterior.
- Nenhum commit ou push adicional realizado.

## Fluxo de Compras da Fábrica e tela de Compras Efetuadas

### Funcionalidade implementada

- Criação de uma página intermediária de **Compras e Fábrica** com duas linhas no mesmo card: **Registrar compra** e **Compras efetuadas**.
- Reutilização de `SettingItem` e `SettingsSection` para manter o padrão visual e o haptic das Configurações.
- Separação visual dos fluxos existentes de registro e consulta por meio dos modos `register` e `purchases` de `FactoryPurchasesScreen`.
- Remoção do título do cabeçalho da tela de Compras efetuadas, mantendo botão voltar, filtro mensal e cards.

### Comportamento final

- O título **Fábrica** da Home abre diretamente a tela de compras efetuadas.
- O acesso de Fábrica pelas Configurações abre primeiro o card com as duas opções.
- **Registrar compra** abre somente o card de registro existente, preservando data, quantidade, cálculo, validações e gravação atuais.
- **Compras efetuadas** abre os cards existentes das compras, com pagamentos, exclusão por menu contextual, resumo e filtro mensal no cabeçalho.
- A tela de Compras efetuadas não exibe título no cabeçalho; o filtro mensal permanece disponível.

### Arquivos principais

- `src/app/(tabs)/dashboard.tsx`
- `src/app/fabrica.tsx`
- `src/app/fabrica-compras-menu.tsx`
- `src/app/fabrica-compras-registrar.tsx`
- `src/app/fabrica-compras.tsx`
- `src/features/factory-purchases/components/FactoryPurchasesScreen.tsx`
- `src/features/settings/components/SettingItem.tsx`
- `src/features/settings/components/SettingsSection.tsx`

### Flags e schema afetados

- Nenhuma flag alterada.
- Nenhum schema, coleção, documento ou regra do Cloud Firestore alterado.
- O fluxo continua usando `users/{uid}/factoryReceipts` e `payments` por meio de `useFactoryPurchases` e dos serviços existentes.

### Validações executadas

- TypeScript (`npm.cmd run typecheck`): passou.
- ESLint direcionado: regras do projeto passaram; arquivos legados modificados ainda emitem ruído `prettier/prettier` de normalização CRLF, separado das regras semânticas.
- Testes de Fábrica: 17 testes passaram em `FactoryReceiptDataSource` e `FactoryPurchaseCalculationService`.
- `git diff --check`: passou.

### Limitações conhecidas

- `tests/factory/PurchaseDetailsSheet.test.ts` não iniciou por erro ambiental de `react-native-worklets` (`loadUnpackers` indefinido), sem relação com esta alteração.
- A nova hierarquia de navegação ainda precisa de validação visual no iPhone Development Build.

### Commit e publicação

- Branch: `ajustes-codex`.
- Alteração não commitada.
- `HEAD` atual: `1c3ffcf8f1cc30a36669d04ca47859d4108cfa52` (`feat(ui): padronizar branding nos cabecalhos principais`).
- Nenhum commit ou push adicional realizado.

## Flags atuais

Valores presentes em `src/config/featureFlags.ts`:

```text
ENABLE_FIREBASE_AUTH = true
ENABLE_FIREBASE_APP_DATA = false
ENABLE_FIREBASE_WRITES = false
ENABLE_MOCK_CLIENT_DATA = true
ENABLE_FIRESTORE_CLIENTS_DELIVERIES = true
ENABLE_FIRESTORE_FACTORY_RECEIPTS = true
ENABLE_FIRESTORE_DAILY_MONTHLY = true
ENABLE_FIRESTORE_FACTORY_SETTINGS = true
ENABLE_FIRESTORE_CAR_SETTINGS = true
ENABLE_FIRESTORE_COMPANY_PROFILE = true
ENABLE_BIOMETRIC_UNLOCK = true
```

`ENABLE_FIREBASE_APP_DATA` controla uma camada legada/global separada e deve
permanecer desligada. As áreas Firestore atuais usam suas próprias fontes e
flags. `ENABLE_FIREBASE_WRITES` permanece desligada por padrão; qualquer nova
escrita precisa ser investigada e autorizada explicitamente.

## Dados locais permitidos

AsyncStorage e storage local podem continuar sendo usados para:

- cache e hidratação inicial;
- fallback quando o Firestore não estiver disponível;
- preferências exclusivas do dispositivo, como a ativação local do Face ID;
- dados derivados ou de apresentação que não precisam ser sincronizados.

Não transformar cache local em nova fonte de verdade nem persistir novamente
Finanças, Estoque, gráficos ou resumos calculados.

## Regras de implementação

- Investigar a arquitetura e a causa raiz antes de editar.
- Preservar regras de negócio, histórico, valores históricos e IDs.
- Componentes visuais não acessam Firebase diretamente.
- Preferir SwiftUI/@expo/ui e SF Symbols no iOS Development Build.
- Não substituir controles nativos por réplicas React Native sem necessidade.
- Não adicionar dependências nativas sem autorização.
- Não acessar `ionic-reference` ou o Firebase legado em novas funcionalidades.
- Validar TypeScript, ESLint, testes relacionados e `git diff --check`.
- Não fazer commit ou push salvo solicitação explícita.

## Segurança do Firestore

As regras atuais permitem acesso somente quando `request.auth.uid` é igual ao
`{uid}` do caminho `users/{uid}`. Não criar caminhos fora dessa hierarquia sem
atualizar a auditoria de segurança e as regras de forma explícita.

## Padronização de Long Press e Context Menu dos Cards

### Funcionalidade implementada

Padronização dos cards com Long Press/Context Menu usando como referência o
card funcional de **Em aberto** (`OpenPaymentsScreen`). A composição visual
agora separa o card real do elemento capturado pelo menu:

- container externo opaco, com largura, radius, padding e clipping do card;
- Trigger interno transparente;
- Preview explícito, opaco e arredondado, com o mesmo conteúdo visual e
  dimensões do card real.

### Comportamento final

- O lift do Context Menu preserva o formato arredondado do card.
- A transição de início e encerramento do long press não exibe a rebarba
  retangular perceptível observada anteriormente.
- Ações existentes de excluir, pagar e concluir permanecem inalteradas,
  incluindo handlers, haptics, SF Symbols e regras de negócio.
- O padrão foi aplicado aos cards de Fábrica, Rotas, Registrar, Invoices e
  Entregas de hoje.
- `DeliveryCard` permanece como referência validada; `OpenPaymentsScreen`
  permanece como referência canônica.

### Arquivos principais

- `src/features/factory-purchases/components/FactoryPurchasesScreen.tsx`
- `src/features/location/components/LocationTrackingScreen.tsx`
- `src/app/(tabs)/registrar.tsx`
- `src/features/invoices/components/InvoicesScreen.tsx`
- `src/features/home/components/TodayDeliveriesCard.tsx`
- `src/features/history/components/DeliveryCard.tsx` (referência validada)
- `src/features/open-payments/components/OpenPaymentsScreen.tsx` (referência
  canônica)

### Flags e schema afetados

- Nenhuma flag alterada.
- Nenhum schema, documento, coleção ou regra do Cloud Firestore alterado.
- Nenhum asset, dependência, Swift, UIKit ou módulo nativo alterado.
- `NativeCardContextMenu.ios.tsx` não foi alterado nesta padronização.

### Validações executadas

- TypeScript (`npm.cmd run typecheck`): passou com 0 erros.
- ESLint direcionado nos arquivos envolvidos: passou com 0 erros.
- `git diff --check`: passou; apenas avisos de normalização LF/CRLF foram
  emitidos pelo Git.
- A validação visual final nos demais cards ainda depende do teste no iPhone
  Development Build.

### Limitações conhecidas

- A confirmação de ausência de flash em todos os modelos e estados do iPhone
  requer validação visual no Development Build.
- `clientes.tsx` mantém seu `SettingItem` contextual, pois não é um card visual
  equivalente aos cards padronizados nesta alteração.

### Commit e publicação

- Branch: `ajustes-codex`.
- HEAD de referência: `448683a` (`fix(home): filter open payments by delivered status`).
- Alteração ainda não commitada.
- Nenhum commit ou push adicional realizado.

## Alinhamento vertical do título e cards de Finanças

### Funcionalidade implementada

Restaurado o offset vertical do conteúdo principal da aba Finanças para
`marginTop: -theme.spacing.md`, recuperando o posicionamento aprovado do
cabeçalho e dos cards em relação à Home e às demais abas principais.

### Comportamento final

- O título **Finanças** fica alinhado verticalmente com o título **Home**.
- Os cards de Faturamento, Lucro Líquido e demais resumos sobem junto com o
  conteúdo, sem alterar seus tamanhos, cálculos, filtros ou navegação.
- O cabeçalho de período e o progressive blur permanecem inalterados.

### Arquivos principais

- `src/app/(tabs)/financeiro.tsx`
- `src/components/layout/NativeGlassHeader/NativeGlassHeader.tsx` (referência,
  sem alteração)
- `src/components/premium/PremiumScreen.tsx` (referência, sem alteração)

### Flags e schema afetados

- Nenhuma flag alterada.
- Nenhum schema, documento, coleção ou regra do Cloud Firestore alterado.
- Nenhuma lógica financeira ou fonte de dados alterada.

### Validações executadas

- TypeScript (`npm.cmd run typecheck`): passou com 0 erros.
- ESLint direcionado em `financeiro.tsx`: passou.
- `git diff --check`: passou; apenas avisos de normalização LF/CRLF foram
  emitidos pelo Git.

### Limitações conhecidas

- A confirmação visual precisa ser feita no iPhone Development Build para
  verificar o alinhamento exato em diferentes tamanhos de tela.

### Commit e publicação

- Branch: `ajustes-codex`.
- HEAD de referência: `427a364` (`fix(ui): remove context menu platter flicker on cards`).
- Esta alteração ainda não foi commitada.
- Nenhum commit ou push adicional realizado.

## Altura determinística dos cards do Histórico

### Funcionalidade implementada

- Correção da geometria inicial do `DeliveryCard` do Histórico após a evidência
  de que o `Host`/`RNHostView` com `matchContents` iniciava o card em `174pt` e
  depois reportava o conteúdo final em `87pt`.
- O caminho contextual do card agora reserva uma altura local determinística de
  `87pt`, mantendo largura responsiva (`width: '100%'`).
- O `Host` ocupa `100%` do container externo, sem permitir que a composição
  intrínseca altere a altura externa do card.

### Comportamento final

- O `DeliveryCard` deve nascer com `height: 87pt`, sem espaços temporários entre
  clientes causados pelo reflow do Host.
- Trigger transparente, Preview explícito, long press, haptics, ações,
  background, clipping e cantos arredondados permanecem preservados.
- A instrumentação DEV `[history-layout]` permanece ativa temporariamente para
  confirmar no iPhone que não ocorre mais a transição `174pt -> 87pt`.

### Arquivos principais

- `src/features/history/components/DeliveryCard.tsx`
- `src/utils/historyLayoutDiagnostics.ts` (diagnóstico temporário)
- `src/components/native/NativeCardContextMenu/NativeCardContextMenu.ios.tsx`
  (instrumentação existente, sem alteração funcional)

### Flags e schema afetados

- Nenhuma flag alterada.
- Nenhum schema, documento, coleção ou regra do Cloud Firestore alterado.
- Nenhum componente Swift/UIKit, Host global ou componente de outras telas
  alterado.

### Validações executadas

- TypeScript (`npx.cmd tsc --noEmit`): passou.
- ESLint direcionado: passou.
- `git diff --check`: passou; o Git emitiu apenas avisos de normalização
  LF/CRLF já presentes no working tree.

### Limitações conhecidas

- A confirmação final da geometria e da ausência de espaços durante o primeiro
  frame ainda depende da reprodução no iPhone Development Build com os logs
  `[history-layout]`.
- A altura de `87pt` foi derivada do tamanho final observado nos logs e deve
  ser reavaliada caso o conteúdo visual do card seja alterado.

### Commit e publicação

- Branch: `ajustes-codex`.
- Não commitado.
- HEAD atual: `36208a2` (`fix(ui): aplicar ajustes visuais recentes`).
- Nenhum commit ou push adicional realizado.

## Ajustes finais de posicionamento vertical das abas principais

### Funcionalidade implementada

- Foram refinados os offsets verticais dos blocos principais de Home,
  Registrar, Finanças, Histórico e Configurações usando os tokens de
  espaçamento já existentes.
- Home, Registrar, Finanças e Configurações passaram a iniciar com seus
  títulos e conteúdos principais no novo posicionamento aprovado, mantendo o
  conteúdo de cada tela agrupado como um bloco.
- No Histórico, o bloco de cards manteve sua posição e somente o título foi
  deslocado para baixo, preservando o espaçamento visual entre título, filtro e
  lista.

### Comportamento final

- O título e os conteúdos de cada aba permanecem estáveis no layout final,
  sem alteração de navegação, handlers, dados ou regras de negócio.
- Home preserva Search Bar, cards, mapa, logo, scroll e espaço inferior para a
  tab bar.
- Registrar, Finanças, Histórico e Configurações preservam seus componentes,
  headers, filtros e listas; apenas o posicionamento vertical solicitado foi
  refinado.

### Arquivos principais

- `src/app/(tabs)/dashboard.tsx`
- `src/app/(tabs)/registrar.tsx`
- `src/app/(tabs)/financeiro.tsx`
- `src/features/history/components/HistoryScreen.tsx`
- `src/features/settings/components/SettingsScreen.tsx`
- `src/theme/spacing.ts` foi apenas reutilizado como fonte dos tokens; não foi
  alterado.

### Flags e schema afetados

- Nenhuma flag de runtime foi alterada.
- Nenhum schema, documento, coleção, regra ou leitura do Cloud Firestore foi
  alterado.
- Nenhum asset, dependência, componente nativo ou regra financeira foi
  alterado por este ajuste.

### Validações executadas

- TypeScript (`npx.cmd tsc --noEmit`): passou sem erros.
- ESLint direcionado nos arquivos alterados: passou.
- `git diff --check`: passou; os avisos observados são apenas de normalização
  LF/CRLF do working tree.

### Limitações conhecidas

- A confirmação visual final dos offsets ainda depende do teste no iPhone
  Development Build, especialmente em diferentes tamanhos de tela e valores
  de Safe Area.
- Há instrumentações DEV e outras alterações anteriores no working tree; elas
  não fazem parte deste registro documental nem foram modificadas nesta
  atualização.

### Commit e publicação

- Branch atual: `ajustes-codex`.
- HEAD atual: `4465513351c04158ef9f2a4a498ab241b7fa8a39`
  (`fix: stabilize initial native UI rendering`).
- Os ajustes verticais descritos nesta seção ainda não foram commitados.
- Nenhum commit ou push adicional foi realizado.

## Atalhos da Home para Documentos e Fábrica no Native Stack

### Funcionalidade implementada

- Os atalhos `Documentos em aberto` e `Fábrica` da Home usam rotas raiz do
  Native Stack, sem selecionar outra aba do `NativeTabs`.
- `Documentos em aberto` reutiliza `InvoicesScreen` em
  `/notas-fiscais-boletos`.
- `Fábrica` reutiliza `FactoryPurchasesRoute` em `/fabrica-compras`, com o
  seletor de período nativo compartilhado já usado no fluxo financeiro.
- As duas rotas usam `Stack.Screen.BackButton displayMode="minimal"` e
  `gestureEnabled: true`.

### Comportamento final

- Home → Documentos e Home → Fábrica executam push no Stack raiz e não trocam
  visualmente para outra tab.
- O botão voltar e o swipe-back retornam para a Home.
- Consultas, documentos, compras, pagamentos, período, cards, ProgressiveBlur,
  Light/Dark Mode e lógica Firestore permanecem preservados.
- A comparação com Finanças confirmou que o morph Liquid Glass de maior
  expressão ocorre quando a origem e o destino estão no mesmo Native Stack e
  mudam estruturalmente de 1 para 2 itens nativos compartilhando background.
- Na origem Home não existe toolbar nativo correspondente; portanto os atalhos
  produzem a entrada/saída nativa do BackButton, mas não um morph cross-screen
  equivalente ao 1→2 de Finanças.

### Arquivos principais

- `src/app/_layout.tsx`
- `src/app/(tabs)/dashboard.tsx`
- `src/app/notas-fiscais-boletos.tsx`
- `src/app/fabrica-compras.tsx`
- `src/features/invoices/components/InvoicesScreen.tsx`
- `src/features/factory-purchases/components/FactoryPurchasesScreen.tsx`
- `src/features/finance/components/FinancePeriodToolbar.tsx` (referência
  reutilizada)
- `src/app/(tabs)/financeiro/_layout.tsx` (referência arquitetural)

### Flags e schema afetados

- Nenhuma flag de runtime foi criada ou alterada.
- `experimental_userInterfaceStyle` continua sendo aplicado somente à
  configuração nativa dos Stacks, conforme o tema resolvido.
- Nenhum schema, documento, coleção, regra, cache ou dado do Cloud Firestore
  foi alterado.
- Nenhuma dependência, API Swift ou prebuild foi alterado/executado.

### Validações executadas

- TypeScript (`npm.cmd run typecheck`): passou.
- ESLint direcionado nos layouts, rotas e componentes envolvidos: passou.
- `git diff --check`: passou; os avisos apresentados são apenas de
  normalização LF/CRLF do working tree.
- A auditoria estrutural não substitui a validação visual no iPhone Development
  Build.

### Limitações conhecidas

- O efeito C de morph cross-screen não pode ser reproduzido nesses atalhos sem
  uma origem nativa correspondente no header da Home.
- Colocar Home, Fábrica e Documentos no mesmo Native Stack exigiria uma
  reorganização estrutural do fluxo da tab Home; ainda assim, um morph real
  exigiria um item nativo de origem. Nenhuma dessas alterações foi aplicada.
- Não há commit específico para esta auditoria/registro documental.

### Commit e publicação

- Branch atual: `ajustes-codex`.
- HEAD no momento da documentação: `4cf668de1873de6335452910ca165dcf9cd8c642`.
- A alteração documentada não foi commitada adicionalmente.
- Nenhum commit ou push foi realizado.

## Estado vazio do Histórico em card

### Funcionalidade implementada

- O estado vazio da aba Histórico passou a reutilizar `GlassCard`, seguindo o
  padrão visual de superfície já usado na tela “Em aberto”.
- O texto `Nenhuma entrega encontrada` permanece centralizado dentro do card.

### Comportamento final

- Dias sem entregas exibem um card com background, radius e padding do padrão
  `GlassCard`.
- Dias com entregas continuam exibindo a lista normal, sem alteração de filtro,
  consulta ou ações.
- O Histórico continua usando permanentemente o `ScrollView` do `PremiumScreen`,
  sem `ScrollView` interno.
- Progressive Blur, header, filtro, seletor de data, Safe Area e espaçamento
  inferior permanecem preservados.

### Arquivos principais

- `src/features/history/components/HistoryScreen.tsx`
- `src/components/premium/GlassCard.tsx` (padrão visual reutilizado)
- `src/features/history/components/EmptyState.tsx`

### Flags e schema afetados

- Nenhuma flag de runtime foi criada ou alterada.
- Nenhum schema, coleção, regra, cache ou dado do Cloud Firestore foi alterado.
- Nenhuma dependência, API nativa ou asset foi adicionado.

### Validações executadas

- TypeScript (`npm.cmd run typecheck`): passou.
- ESLint direcionado em `HistoryScreen.tsx`: passou.
- `git diff --check`: passou; o aviso apresentado refere-se apenas à
  normalização LF/CRLF do working tree.

### Limitações conhecidas

- A confirmação visual final do card, do scroll e do Progressive Blur depende
  do teste no iPhone Development Build.
- O estado vazio continua dependente dos dados/filtros atuais do Histórico;
  nenhuma fonte de verdade foi alterada.

### Commit e publicação

- Branch atual: `ajustes-codex`.
- Esta alteração ainda não foi commitada.
- HEAD de referência: `606f29a4439d79411428494d4d4af941ea948ace`
  (`fix(ui): stabilize registrar rows and button labels`).
- Nenhum commit ou push adicional foi realizado.

## Estabilização das rows de Registrar Entrega com NativeCardContextMenu

### Funcionalidade implementada

- Restaurada a composição nativa `NativeCardContextMenu` nas rows de Registrar
  Entrega após o teste controlado com RN puro confirmar que o glitch vinha da
  medição intrínseca do `Host`/`RNHostView`.
- Cada row passou a possuir altura determinística calculada a partir do padding
  e das alturas tipográficas já existentes.
- O container externo RN mantém a geometria, enquanto o Context Menu nativo
  preenche `width` e `height` disponíveis.

### Comportamento final

- O estado vazio e o primeiro cliente preservam a altura já corrigida.
- Ao adicionar o segundo, terceiro ou quarto cliente, o card cresce somente
  pela nova row na parte inferior, sem snapshots intermediários, ghosts ou
  piscadas nas rows existentes.
- Preview, long press e exclusão continuam nativos e funcionais.
- O título “Hoje”, o estado vazio, Bottom Sheets, navegação e lógica de
  registro permanecem preservados.
- Registrar Dados não foi alterado porque não utiliza o mesmo caminho de
  `NativeCardContextMenu` por row.

### Arquivos principais

- `src/app/(tabs)/registrar.tsx`
- `src/components/native/NativeCardContextMenu/NativeCardContextMenu.ios.tsx`
  (componente auditado; não alterado)
- `src/features/history/components/DeliveryCard.tsx` (referência estrutural
  validada; não alterado)

### Flags e schema afetados

- Nenhuma flag de runtime foi criada ou alterada.
- Nenhum schema, documento, coleção, regra, cache ou dado do Cloud Firestore
  foi alterado.
- Nenhuma API nativa, Pod, dependência ou asset foi alterado.
- O bypass RN e a instrumentação DEV `[registrar-delivery-layout]` foram
  removidos após o diagnóstico.

### Validações executadas

- Teste controlado no iPhone: o bypass sem `NativeCardContextMenu` eliminou o
  glitch, confirmando a causa no sizing/composição nativa.
- TypeScript (`npm.cmd run typecheck`): passou.
- ESLint direcionado em `src/app/(tabs)/registrar.tsx`: passou com a regra de
  Prettier desativada para isolar as regras funcionais.
- `git diff --check`: passou; os avisos apresentados são apenas de
  normalização LF/CRLF do working tree.

### Limitações conhecidas

- A validação de gestos e composição visual nativa continua dependente do
  iPhone Development Build.
- O componente compartilhado `NativeCardContextMenu` continua usando
  `Host/RNHostView matchContents`; a estabilidade desta tela depende da
  geometria determinística fornecida pelo container RN.

### Commit e publicação

- Branch atual: `ajustes-codex`.
- A alteração está apenas no working tree e ainda não foi commitada.
- HEAD de referência: `2f5becff5fe0c19fb1e596c255b70acf6701cb53`.
- Não há commit/hash específico para esta alteração.
- Nenhum commit ou push adicional foi realizado.

## Botão voltar nativo nos atalhos da Home

### Funcionalidade implementada

- Restaurado o botão circular nativo com `chevron.left` nas três primeiras
  rotas do Native Stack `(home-shortcuts)`:
  `/registrar-entrega`, `/fabrica-compras` e `/notas-fiscais-boletos`.
- O controle é declarado diretamente dentro de cada `Stack.Screen` usando
  `Stack.Toolbar placement="left"` e `Stack.Toolbar.Button`, seguindo o padrão
  validado no fluxo nativo de toolbar do app.

### Comportamento final

- Cada atalho aberto pela Home exibe somente o chevron, sem texto.
- O toque no botão executa `router.back()` e retorna à Home.
- O swipe-back continua sendo tratado pelo Stack pai, com a primeira rota do
  Stack filho impedindo apenas um pop interno inexistente.
- O isolamento `(home-shortcuts)` e a correção anterior do micro-shift foram
  preservados.
- Fábrica, Registrar entrega, Documentos, Histórico, Finanças e demais fluxos
  não tiveram sua lógica alterada.

### Arquivos principais

- `src/app/(home-shortcuts)/_layout.tsx`
- `src/app/(home-shortcuts)/registrar-entrega.tsx`
- `src/app/(home-shortcuts)/fabrica-compras.tsx`
- `src/app/(home-shortcuts)/notas-fiscais-boletos.tsx`
- `src/app/_layout.tsx`

### Flags e schema afetados

- Nenhuma flag de runtime foi criada ou alterada.
- Nenhum schema, documento, coleção, regra, cache ou dado do Cloud Firestore
  foi alterado.
- Nenhuma dependência, Swift ou prebuild foi alterado.

### Validações executadas

- TypeScript (`npm.cmd run typecheck`): passou.
- ESLint direcionado em `(home-shortcuts)`: passou.
- `git diff --check`: passou; os avisos apresentados são apenas de
  normalização LF/CRLF do working tree.

### Limitações conhecidas

- A confirmação visual final do botão e do swipe-back continua dependendo do
  teste no iPhone Development Build.
- A alteração permanece sem commit adicional.

### Commit e publicação

- Branch atual: `ajustes-codex`.
- HEAD de referência: `5804b4c2a020b8383928f3abf867e738c95bf3aa`
  (`feat: expand native navigation and toolbar interactions`).
- A correção do botão voltar ainda não foi commitada nem publicada.

## Cards individuais de Entregas de hoje na Home

### Funcionalidade implementada

- Removido o `PremiumCard` externo que agrupava todas as entregas do dia na
  Home.
- Cada entrega agora é renderizada em seu próprio container visual com
  `NativeCardContextMenu`, seguindo o princípio já usado no Histórico.

### Comportamento final

- Uma entrega corresponde a um card independente; várias entregas aparecem
  empilhadas verticalmente.
- O espaçamento entre os cards usa o token existente de spacing.
- Nome, quantidade, status, ações de toque, long press, exclusão, Modo Teste e
  demais informações foram preservados.
- O restante da Home, incluindo Search Bar, Progressive Blur e navegação, não
  foi alterado.

### Arquivos principais

- `src/features/home/components/TodayDeliveriesCard.tsx`

### Flags e schema afetados

- Nenhuma flag de runtime foi alterada.
- Nenhum schema, documento, coleção, regra, cache ou dado do Cloud Firestore
  foi alterado.

### Validações executadas

- TypeScript (`npm.cmd run typecheck`): passou.
- ESLint direcionado em `TodayDeliveriesCard.tsx`: passou.
- `git diff --check`: passou; os avisos apresentados são apenas de
  normalização LF/CRLF do working tree.

### Limitações conhecidas

- A validação visual final do empilhamento dos cards depende de teste no iPhone
  Development Build com múltiplas entregas no dia.

### Commit e publicação

- Esta alteração ainda não foi commitada.
- Não há commit/hash específico para ela.
- Nenhum commit ou push adicional foi realizado.

## Títulos principais das abas em 36 pt

### Funcionalidade implementada

- Aumentado somente o `fontSize` dos títulos principais de Home, Finanças,
  Registrar, Histórico e Configurações de 34 para 36.

### Comportamento final

- Os cinco títulos ficam levemente maiores e visualmente consistentes.
- Peso, cor, posição, Safe Area, altura dos headers, espaçamentos, controles,
  navegação e demais conteúdos permanecem inalterados.
- O `NativeGlassHeader` compartilhado não foi alterado.

### Arquivos principais

- `src/app/(tabs)/dashboard.tsx`
- `src/app/(tabs)/financeiro.tsx`
- `src/app/(tabs)/registrar.tsx`
- `src/features/history/components/HistoryScreen.tsx`
- `src/features/settings/components/SettingsScreen.tsx`

### Flags e schema afetados

- Nenhuma flag de runtime foi criada ou alterada.
- Nenhum schema, documento, coleção, regra, cache ou dado do Cloud Firestore
  foi alterado.

### Validações executadas

- TypeScript (`npx.cmd tsc --noEmit`): passou.
- ESLint direcionado nos cinco arquivos: passou.
- `git diff --check`: passou; os avisos apresentados são apenas de
  normalização LF/CRLF do working tree.

### Limitações conhecidas

- A confirmação visual final do tamanho dos títulos depende de teste no iPhone
  Development Build.

### Commit e publicação

- Branch atual: `ajustes-codex`.
- Esta alteração ainda não foi commitada.
- HEAD de referência: `e9ea68237aadc1bf92b1dcad6723d5c56a72bc7c`.
- Nenhum commit ou push adicional foi realizado.

## Ajuste de cor do status Em aberto nos cards da Fábrica

### Funcionalidade implementada

- Ajustada somente a cor textual do status `Em aberto` nos cards de compras da
  tela Fábrica aberta pela Home.

### Comportamento final

- No Light Mode, `Em aberto` permanece preto.
- No Dark Mode, `Em aberto` usa `theme.colors.textPrimary`, mantendo leitura
  clara sobre o card escuro.
- O status `Pago` permanece verde.
- Layout, valores, cálculos, pagamentos, ações e navegação permanecem
  inalterados.

### Arquivos principais

- `src/features/factory-purchases/components/FactoryPurchasesScreen.tsx`

### Flags e schema afetados

- Nenhuma flag de runtime foi criada ou alterada.
- Nenhum schema, documento, coleção, regra, cache ou dado do Cloud Firestore
  foi alterado.

### Validações executadas

- TypeScript (`npx.cmd tsc --noEmit`): passou.
- ESLint direcionado no `FactoryPurchasesScreen.tsx`: passou.
- `git diff --check`: passou; os avisos apresentados são apenas de
  normalização LF/CRLF do working tree.

### Limitações conhecidas

- A confirmação visual final depende de teste no iPhone Development Build.
- A alteração é visual e não muda regras financeiras ou persistência.

### Commit e publicação

- Branch atual: `ajustes-codex`.
- Esta alteração ainda não foi commitada.
- HEAD atual: `e883e14b32179aaa0e056776beb9281e90574852`
  (`fix(ui): refine home and factory presentation`).
- Nenhum commit ou push adicional foi realizado.

## Refinamento do card agrupado Em aberto/Fábrica na Home

### Funcionalidade implementada

- Refinado o card único da Home que reúne as ações `Em aberto` e `Fábrica`.
- As duas linhas mantêm seus ícones, títulos, chevrons, separador, ações de
  toque e navegação existentes.

### Comportamento final

- O card continua sendo uma única superfície, com `Em aberto` na primeira
  linha e `Fábrica` na segunda.
- O conteúdo das linhas foi deslocado levemente para a direita.
- O respiro vertical do card foi ajustado sem alterar os demais cards da Home.
- O deslocamento vertical é aplicado à linha completa, mantendo ícone, texto e
  chevron juntos: `Em aberto` fica levemente mais abaixo e `Fábrica`
  levemente mais acima.
- Não houve alteração de layout global, lógica, navegação ou comportamento de
  outras telas.

### Arquivos principais

- `src/app/(tabs)/dashboard.tsx`

### Flags e schema afetados

- Nenhuma flag de runtime foi criada ou alterada.
- Nenhum schema, documento, coleção, regra, cache ou dado do Cloud Firestore
  foi alterado.
- Nenhuma dependência, API nativa ou asset foi adicionado.

### Validações executadas

- TypeScript (`npx.cmd tsc --noEmit`): passou.
- ESLint direcionado em `src/app/(tabs)/dashboard.tsx`: passou.
- `git diff --check`: passou; os avisos apresentados são apenas de
  normalização LF/CRLF do working tree.

### Limitações conhecidas

- A confirmação visual final do refinamento depende de teste no iPhone
  Development Build.
- As demais alterações já existentes no working tree não fazem parte deste
  refinamento documental.

### Commit e publicação

- Branch atual: `ajustes-codex`.
- Esta alteração visual ainda não foi commitada.
- HEAD atual: `a91204488fa4289408108bf3e39d9a45eff36382`
  (`fix(ui): refine home cards and native glass actions`).
- Nenhum commit ou push adicional foi realizado.

## Fundo Light Mode da Splash e Login

### Funcionalidade implementada

- O fundo da Splash Screen nativa do iOS passou a usar `#FAF8F7` no Light
  Mode, alinhado ao fundo atual do aplicativo.
- A configuração Dark Mode da Splash nativa foi preservada em `#0B0F14`.
- A Splash React/SplashGate e a tela de Login já consumiam
  `theme.colors.background`, portanto não exigiram alterações de código.

### Comportamento final

- Splash nativa iOS, SplashGate/Splash React e Login apresentam o mesmo fundo
  Light Mode `#FAF8F7`.
- Logo, ícones, tamanhos, posições, animações, fluxo de autenticação e Dark
  Mode permanecem inalterados.

### Arquivos principais

- `app.config.js`
- `src/features/splash/components/SplashFallback.tsx` (referência existente,
  sem alteração)
- `src/features/splash/SplashGate.tsx` (fluxo existente, sem alteração)
- `src/features/login/components/LoginScreen.tsx` (referência existente, sem
  alteração)

### Flags e schema afetados

- Alterada somente a opção `expo-splash-screen.backgroundColor` do Light Mode.
- Nenhum schema, documento, coleção, regra, cache ou dado do Cloud Firestore
  foi alterado.
- Nenhuma dependência foi adicionada.

### Validações executadas

- TypeScript (`npx.cmd tsc --noEmit`): passou.
- ESLint direcionado em `app.config.js`: passou.
- `git diff --check`: passou; os avisos são apenas de normalização LF/CRLF.

### Limitações conhecidas

- A alteração da Splash nativa é aplicada pelo config plugin e exige
  recompilação do Development Build/iOS para aparecer no dispositivo.
- A confirmação visual final ainda depende da execução no iPhone Development
  Build.

### Commit e publicação

- Branch atual: `ajustes-codex`.
- Esta alteração ainda não foi commitada.
- HEAD atual: `4f1a3208bf2cd78e1e79437ac78f4c121068fdad`
  (`feat: add local test mode for safe app demos`).
- Nenhum commit ou push adicional foi realizado.

## Token compartilhado de tint Liquid Glass

### Funcionalidade implementada

- Centralização da opacidade do tint branco usado pelos controles Liquid Glass
  nativos já aprovados no Light Mode em `GLASS_LIGHT_TINT_OPACITY = 0.6`.
- `lightModeLiquidGlassTint` passou a ser derivado desse token, eliminando a
  duplicação do valor `0.6`.

### Comportamento final

- Seletor de mês/ano de Finanças, filtro do Histórico, menu de Configurações,
  botões Voltar e seletor equivalente das telas financeiras continuam usando
  `glassEffect` nativo com tint branco de 60% no Light Mode.
- Dark Mode permanece sem alteração.
- Tab bar, Search Bar, Bottom Sheets e outros controles Liquid Glass não listados
  não passaram a consumir o token.
- Geometria, tamanhos, ações, navegação e comportamento nativo foram preservados.

### Arquivos principais

- `src/theme/colors.ts`
- `src/theme/index.ts`
- Consumidores existentes de `lightModeLiquidGlassTint`:
  `src/app/(tabs)/financeiro.tsx`,
  `src/features/finance/components/MonthlyFinancialDetailScreen.tsx`,
  `src/features/history/components/HistoryScreen.tsx`,
  `src/features/settings/components/SettingsScreen.tsx` e
  `src/components/native/NativeGlassBackButton/NativeGlassBackButton.tsx`.

### Flags e schema afetados

- Nenhuma flag de runtime foi alterada.
- Nenhum schema, coleção, regra ou dado do Cloud Firestore foi alterado.
- Nenhuma dependência, API nativa, asset ou componente novo foi criado.

### Validações executadas

- TypeScript (`npx.cmd tsc --noEmit`): passou sem erros.
- ESLint direcionado em `src/theme/colors.ts` e `src/theme/index.ts`: passou.
- `git diff --check`: passou; os avisos apresentados são apenas de normalização
  LF/CRLF do working tree.

### Limitações conhecidas

- O token é intencionalmente limitado aos controles que já receberam o tint
  branco de 60%; novos controles Liquid Glass não o recebem automaticamente.
- A validação visual final continua dependente do iPhone Development Build.

### Commit e publicação

- Esta alteração ainda não foi commitada.
- Não há commit/hash específico para ela.
- Nenhum commit ou push adicional foi realizado.

## Modo Teste / Modo Apresentação local

### Funcionalidade implementada

- Adicionado o Modo Teste em Configurações, com tela própria e o mesmo
  `NativeToggle` nativo usado pelo Face ID.
- Criado `TestModeProvider` central com estado persistido somente no
  `AsyncStorage` local do dispositivo.
- O `SplashGate` aguarda a leitura da preferência local antes de liberar a
  interface principal.
- Criado helper central de apresentação para mascarar valores numéricos e
  sensíveis sem alterar os dados reais.
- Campos numéricos editáveis ficam visualmente zerados e bloqueados enquanto o
  modo está ativo; ações de gravação relacionadas também são protegidas contra
  o envio de valores mascarados.

### Comportamento final

- Com o modo ativo, valores aparecem como `R$ 0,00`, `0 km`, `0 baldes`, `0%`
  ou equivalente ao formato original.
- Dados reais continuam sendo usados internamente por cálculos, gráficos,
  linhas, curvas e animações.
- Ao desativar o modo, os valores reais reaparecem imediatamente.
- Nenhum dado de negócio, cache Firestore, schema ou serviço financeiro é
  substituído por zero; a única persistência nova é a preferência local do
  dispositivo.
- Home Search, Home, Finanças, Registrar, Histórico, Fábrica, Estoque, Custos,
  Clientes, Localização, pagamentos em aberto, documentos e formulários
  nativos usam a mesma camada de apresentação quando exibem valores cobertos
  pelo modo.

### Arquivos principais

- `src/app/_layout.tsx`
- `src/app/modo-teste.tsx`
- `src/providers/TestModeProvider.tsx`
- `src/hooks/useTestMode.ts`
- `src/services/preferences/TestModeStorage.ts`
- `src/utils/presentation/testModeValues.ts`
- `src/features/splash/SplashGate.tsx`
- `src/features/settings/components/SettingsScreen.tsx`
- `src/features/settings/components/TestModeScreen.tsx`
- `src/components/native/NativeTextField/NativeTextField.native.tsx`
- `src/components/native/NativeAnimatedNumber/NativeAnimatedNumber.native.tsx`
- Componentes de apresentação das telas Home, Finanças, Histórico, Fábrica,
  Estoque, Custos, Clientes, Localização, pagamentos e documentos.

### Flags e schema afetados

- Preferência local: `@pareact/test-mode-enabled-v1` no AsyncStorage.
- Nenhuma flag remota foi alterada.
- Nenhum schema, documento, coleção, regra ou cálculo do Cloud Firestore foi
  alterado.
- Nenhuma dependência ou API nativa nova foi adicionada.

### Validações executadas

- TypeScript (`npx.cmd tsc --noEmit`): passou.
- ESLint direcionado nos arquivos alterados: passou com a regra de Prettier
  desativada para isolar as regras funcionais; a execução normal apresenta
  ruído preexistente de normalização CRLF.
- `git diff --check`: passou; os avisos emitidos são de normalização LF/CRLF.
- Nenhum commit ou push adicional realizado.

### Limitações conhecidas

- A validação visual final dos controles nativos, campos SwiftUI e gráficos
  ainda depende de teste no iPhone Development Build.
- O mascaramento cobre a apresentação das telas e componentes atualmente
  ativos; novos componentes numéricos devem consumir
  `useTestModePresentation()` para aderir ao modo.

### Commit e publicação

- Branch atual: `ajustes-codex`.
- A implementação está apenas no working tree e ainda não foi commitada.
- HEAD de referência: `5647928a7a59b39a6542f9f29c487034e4eeb6c4`
  (`fix(ui): stabilize safe area startup and glass tint`).
- Nenhum commit ou push adicional foi realizado.

## Tint Liquid Glass nos botões de ação de Registrar

### Funcionalidade implementada

- Aplicado o mesmo `lightModeLiquidGlassTint` compartilhado, com opacidade
  branca de 60%, aos dois botões nativos `Adicionar` dos fluxos de Registrar:
  Registro de Entrega e Dados Diários.
- O tint é enviado ao `glassEffect` nativo do `NativeGlassIconButton`, sem
  criar cor ou opacidade local.

### Comportamento final

- No Light Mode, os dois botões inferiores `Adicionar` exibem o material
  Liquid Glass nativo com tint branco de 60%.
- No Dark Mode, o tint permanece indefinido e o visual atual é preservado.
- Tamanho, posição, texto, estado enabled/disabled, haptics, ações,
  validações e fluxo de registro permanecem inalterados.
- Os fallbacks e demais controles Liquid Glass não solicitados não foram
  alterados.

### Arquivos principais

- `src/app/(tabs)/registrar.tsx`
- `src/components/native/NativeGlassIconButton/NativeGlassIconButtonSwiftUI.ios.tsx`
- `src/theme/colors.ts`
- `src/theme/index.ts`

### Flags e schema afetados

- Nenhuma flag de runtime foi criada ou alterada.
- Nenhum schema, documento, coleção, regra, cache ou dado do Cloud Firestore
  foi alterado.
- Nenhuma dependência, API nativa ou asset foi adicionado.

### Validações executadas

- TypeScript (`npx.cmd tsc --noEmit`): passou.
- ESLint direcionado nos arquivos dos controles e do fluxo Registrar: passou.
- `git diff --check`: passou; os avisos apresentados são apenas de
  normalização LF/CRLF do working tree.

### Limitações conhecidas

- A confirmação visual final do tint depende de teste no iPhone Development
  Build.
- A alteração usa a implementação nativa já compilada do `@expo/ui`; não há
  mudança Swift/Pods prevista.

### Commit e publicação

- Branch atual: `ajustes-codex`.
- Esta alteração ainda não foi commitada.
- HEAD de referência: `be5b6ff4e1aec0713ba1fe37dee03d78d1fb8959`
  (`fix: align splash background and bottom scroll spacing`).
- Não há commit/hash específico para esta alteração.
- Nenhum commit ou push adicional foi realizado.

## Correção do roteamento e bridge do Apple Intelligence na Home Search

### Funcionalidade implementada

- O fast path do parser agora encerra a busca somente quando produz uma
  consulta/intenção executável.
- Consultas parcialmente interpretadas, como perguntas em linguagem natural,
  seguem para o caminho semântico do Apple Intelligence.
- O bridge nativo do Foundation Models retorna o resultado estruturado como
  objeto compatível com Expo Modules, sem serialização obrigatória para JSON
  string.
- A camada JavaScript mantém compatibilidade com JSON string de builds
  anteriores e faz fallback seguro para respostas inválidas.
- A confiança mínima aceita para uma interpretação válida é `0.6`.
- Logs DEV de diagnóstico distinguem `parser-success`,
  `parser-failed -> semantic`, `semantic-start`, `semantic-success` e
  `semantic-fallback`, sem registrar valores financeiros ou dados sensíveis.

### Comportamento final

- Consultas estruturadas realmente resolvidas pelo parser continuam rápidas e
  não chamam o Apple Intelligence.
- Consultas naturais ou parcialmente resolvidas são interpretadas pelo caminho
  semântico antes de chegar ao `SearchService`.
- Respostas estruturadas nativas e JSON strings válidas são normalizadas para
  `SearchIntent`; respostas inválidas seguem fallback seguro em vez de serem
  tratadas como resultado vazio silencioso.
- Bottom Sheet imediato, prewarm, suporte pt-BR, cancelamento de gerações
  obsoletas e a UI/resultados existentes foram preservados.

### Arquivos principais

- `modules/native-apple-intelligence/ios/NativeAppleIntelligenceModule.swift`
- `src/features/home/search/AppleIntelligenceSearchInterpreter.ts`
- `src/features/home/search/HomeSearchService.ts`
- `tests/home/AppleIntelligenceSearchInterpreter.test.ts`
- `tests/home/HomeSearchService.test.ts`

### Flags e schema afetados

- Nenhuma flag de runtime foi criada ou alterada.
- Nenhum schema, documento, coleção, regra, cache ou dado do Cloud Firestore
  foi alterado.
- Nenhuma dependência foi adicionada.
- O contrato do bridge nativo foi ajustado para transportar o objeto
  estruturado; não há alteração no contrato de persistência da busca.

### Validações executadas

- TypeScript (`npm.cmd run typecheck`): passou.
- ESLint direcionado nos cinco arquivos da correção, com a regra de Prettier
  desativada: passou.
- Testes da Home Search (`npx.cmd jest tests/home --runInBand`): 8 suítes e
  192 testes passando.
- `git diff --check`: passou.

### Limitações conhecidas

- A alteração do bridge Swift exige uma nova compilação do Development Build
  para ser instalada no iPhone; o restante do roteamento TypeScript pode ser
  validado pelo Metro/Fast Refresh.
- A disponibilidade efetiva do Foundation Models continua dependente do
  dispositivo, versão do iOS e suporte de locale; indisponibilidade mantém o
  fallback seguro.

### Commit e publicação

- Branch: `ajustes-codex`.
- Commit: `12ee841edc6af1c76f366e2c6cc033f0b8f84ef4` (`fix: correct Apple
Intelligence search routing and bridge`).
- Publicado em `origin/ajustes-codex`.

## Registrar — Entregas em cards individuais

### Funcionalidade implementada

- A tela Registrar → Entregas deixou de envolver todas as entregas em um único
  card externo.
- Cada entrega agora é renderizada em seu próprio `PremiumCard`, com o mesmo
  padrão de superfície, raio, espaçamento e tema usado pelo app.
- O título de seção `Hoje` permanece fora dos cards.
- O `NativeCardContextMenu` continua envolvendo cada entrega individualmente,
  preservando a ação nativa de exclusão.

### Comportamento final

- Uma entrega aparece como um card individual; várias entregas aparecem como
  cards separados com espaçamento uniforme.
- Nome e quantidade permanecem à esquerda, e o valor permanece alinhado à
  direita.
- O estado vazio continua usando um único card de estado vazio.
- Ordenação, seleção de cliente, criação, exclusão, mascaramento de valores,
  botão Adicionar, scroll e navegação permanecem inalterados.
- Light Mode e Dark Mode continuam consumindo os tokens do tema através do
  `PremiumCard`.

### Arquivos principais

- `src/app/(tabs)/registrar/index.tsx`
- Componentes reutilizados: `PremiumCard`, `NativeCardContextMenu` e
  `PremiumScreen`.

### Flags e schema afetados

- Nenhuma flag de runtime foi criada ou alterada.
- Nenhum schema, documento, coleção, regra, cache, serviço, cálculo ou dado do
  Cloud Firestore foi alterado.
- Nenhuma dependência foi adicionada.

### Validações executadas

- TypeScript (`npm.cmd run typecheck`): passou.
- ESLint direcionado no fluxo Registrar, com a regra de Prettier desativada
  para o ruído LF/CRLF existente: passou.
- Testes relacionados a entregas: 4 suítes e 18 testes passando.
- `git diff --check`: passou; apenas avisos de normalização LF/CRLF foram
  emitidos.

### Limitações conhecidas

- A lista continua sendo uma `View` dentro do `ScrollView` existente, sem
  virtualização adicional; não foi introduzida uma alteração estrutural de
  performance.
- A confirmação visual final nos estados sem entregas, com muitas entregas e
  em Light/Dark Mode ainda depende de validação no iPhone Development Build.

### Commit e publicação

- Esta alteração ainda não foi commitada nem publicada.
- Não há commit/hash específico para esta alteração.

## Consolidação da sessão atual — Native Sheets e Home Search

### Funcionalidades implementadas

- Bottom Sheet de Registrar Entrega com shell SwiftUI separado e
  `glassEffect(interactive: true)`, lista nos detents `0.48 ↔ 0.78`, formulário
  em `0.48`, transição nativa, scroll e drag/dismiss preservados.
- Bottom Sheet de Registrar Dados com a mesma superfície nativa interativa,
  detent `0.45`, dois cards internos neutros e controles de salvamento
  preservados.
- Bottom Sheets de sugestões e resultados da Home Search com apresentação
  externa transparente; conteúdo interno sólido, cinco sugestões, cores e
  espaçamentos finais preservados.
- Search Bar continua nativa e sem tint customizado. Os experimentos isolados
  `Teste Liquid Glass` e `Teste Bottom Sheet Glass` foram removidos de
  Configurações → Sistema.
- Os cards reais da Home e da aba Registrar permanecem na implementação
  anterior com `PremiumCard`/`AnimatedPressable`; não receberam Liquid Glass
  nesta consolidação.

### Arquivos principais

- `src/components/native/NativeBottomSheet/NativeBottomSheetSwiftUI.ios.tsx`
- `src/components/native/NativeBottomSheet/RegistrarDeliveryPagerRN.tsx`
- `src/components/native/NativeDailyDataSheet/NativeDailyDataSheetSwiftUI.ios.tsx`
- `src/components/native/NativeSearchField/NativeSearchFieldSwiftUI.ios.tsx`
- `src/features/home/components/HomeSearchResultsSheet.tsx`
- `src/features/home/components/HomeSearchResultsNative.ios.tsx`
- `src/features/home/help/HomeSearchHelpSheet.tsx`
- `src/features/home/help/HomeSearchHelpContent.ios.tsx`
- `src/features/settings/components/SystemSettingsScreen.tsx`

### Flags, schema e validações

- Nenhuma flag, dependência, capability, schema, documento, coleção ou regra
  do Cloud Firestore foi alterada.
- TypeScript (`npm.cmd run typecheck`): passou.
- ESLint direcionado nos arquivos da sessão: passou.
- Testes relacionados de Home, entregas e custos: 16 suítes / 230 testes
  passando.
- `git diff --check`: passou; os avisos observados foram somente de
  normalização LF/CRLF.

### Estado de dispositivo e publicação

- Não foi executada nova validação manual no iPhone durante esta consolidação;
  a confirmação visual dos ajustes deste commit deve ser repetida no
  Development Build existente.
- Não houve alteração de Swift, config plugin, dependência ou capability nova;
  os ajustes podem ser testados via Metro/Fast Refresh na Development Build
  atual.
- Commit publicado: `b7c22af4717b671adb88b68d1b208119cf9eb117`
  (`feat: refine native sheets and search interactions`) na branch
  `ajustes-codex`, sincronizada com `origin/ajustes-codex`.

## Etapa 2.2.9C — últimos números apresentados em Finanças Atacado

- Esta etapa substitui, para apresentação dos cards de Faturamento e Lucro
  Líquido, o bloqueio conceitual da 2.2.9B. O registro não comprova a
  atualidade nem a completude contábil dos dados: é somente o último par de
  números finais que a interface já apresentou após o caminho normal de dados.
- Um envelope pequeno e separado guarda Faturamento, Lucro Líquido e as
  comparações efetivamente disponíveis para ambos. O contrato inclui versão do
  cache, versão das regras, ambiente de build, projeto Firebase, UID e uma chave
  canônica da seleção/período e filtros. Não guarda entregas, custos, rotas,
  clientes, snapshots v1, horários, nem estados de loading/erro.
- A restauração acontece somente na tela Atacado focada, com sessão autenticada
  e Test Mode pronto e desativado. O par inteiro é aplicado apenas aos props dos
  dois cards e indicadores de tendência. Não alimenta `useFinancialData`,
  `remoteComplete`, cálculos, gráficos, widgets ou consultas; o caminho remoto
  existente segue sem alterações.
- O primeiro par vivo só substitui o registro quando as condições já usadas
  pela tela permitem apresentar o resumo e o Lucro Líquido. Valores e
  comparações são trocados juntos. Se os números não mudarem, os valores e a
  referência de comparação são preservados para não reiniciar
  `NativeAnimatedNumber`/SwiftUI `numericText` desnecessariamente.
- Leituras e gravações são vinculadas ao UID, `sessionVersion`, seleção e
  filtros em memória. Respostas assíncronas antigas são descartadas. O logout
  e a troca de UID invalidam a geração de gravação e tentam remover o registro;
  uma gravação serializada não pode recriar o registro depois dessa limpeza.
  Escopo ou versão incompatível é cache miss.
- O registro usa AsyncStorage, que não criptografa os dados. O conteúdo limita-se
  a totais agregados e comparações, mas esses números ainda podem ser vistos por
  quem tiver acesso aos dados locais do aplicativo. Isso é uma limitação aceita
  explicitamente para este cache de apresentação. O Firebase segue como fonte
  de verdade; os valores persistidos podem estar temporariamente desatualizados
  e não recebem aviso visual conforme solicitado.
- A validação desta etapa usa somente storage falso e dados sintéticos; não
  acessa produção nem Emulator. Fast Refresh basta para carregar as mudanças
  JS/TS na Development Build existente. Para conferir restauração persistente,
  encerre o processo do app sem limpar os dados locais e abra novamente; nenhuma
  nova compilação nativa é necessária.
- TypeScript, ESLint direcionado e `git diff --check` passaram. Quatro suítes
  direcionadas passaram com 61 testes sintéticos, cobrindo restauração após
  nova instância do cache, miss por UID/projeto/ambiente/escopo/versão, valores
  finitos e negativos, gravação sem alteração, falha de storage, leitura tardia,
  gravação concorrente e limpeza no logout. Não foi executada a suíte completa
  nem validação visual física nesta etapa.
- A limpeza tenta remover o registro e, se `removeItem` falhar, gravar um valor
  inválido para impedir restauração em outro processo. Se ambas as operações de
  AsyncStorage falharem, a sessão atual continua bloqueando o cache em memória,
  mas a remoção persistente não pode ser garantida; isso permanece como risco
  residual da API local.

## Etapa 2.2.9D — painel visual completo em cache (2026-11-06)

- Causa comprovada da exibição tardia dos cards inferiores: a 2.2.9C só
  persistia Faturamento, Lucro Líquido e suas comparações; os quatro `SummaryCard`
  continuavam ligados exclusivamente ao `summary` ao vivo. A tela inteira não
  tinha dados salvos para esses quatro cards. A leitura do cache também esperava
  a tela Atacado receber foco, em vez de começar assim que a rota autenticada
  estivesse montada.
- Os logs anteriores não identificavam motivo de cache miss nem resultado da
  gravação. Portanto, a causa exata de um miss dos dois cards superiores nos
  testes anteriores continua indeterminada. A instrumentação nova registra
  `presentation_cache_write`, `presentation_cache_hit`/`miss`,
  `presentation_cache_hydrated`, `presentation_cache_rendered` e
  `presentation_cache_replaced_by_live`, somente em `__DEV__`, sem valores,
  UID, período, filtros ou erros brutos. `rendered` indica commit JS/layout do
  painel; não comprova que um frame físico já foi exibido.
- O envelope agora é versão 2 e guarda os dois valores superiores, comparações
  exibidas e somente os 14 campos numéricos usados pelos quatro cards inferiores.
  Não guarda documentos brutos, nomes, entregas, custos individuais, rotas,
  widgets ou resultados dos hooks. A allowlist deixa de fora campos agregados
  que não aparecem nesses seis cards. O envelope v1 é recusado como
  `cache_version_mismatch` e será substituído quando uma apresentação completa
  for salva; não há conversão automática de dados incompletos.
- A consulta local começa assim que UID autenticado, período/filtros e Test Mode
  pronto permitem definir a chave, sem aguardar foco. A tela escolhe um painel
  completo de apresentação: cache elegível enquanto a informação ao vivo não
  estiver completa, ou o painel atual quando estiver pronto. Os seis cards
  trocam juntos. A leitura remota segue normal; o registro não alimenta
  `useFinancialData`, `remoteComplete`, fórmulas, gráficos, widgets ou Firestore.
  Valores iguais mantêm o número nativo e sua chave estável durante a mesma
  conta/sessão/seleção; valores diferentes chegam pelo fluxo existente e podem
  usar `numericText`.
- Escopo continua isolado por projeto/ambiente, UID, período/filtros, versões,
  `sessionVersion`, geração da leitura e sessão do snapshot ao vivo. Fallbacks
  em memória de Faturamento e Lucro Líquido também foram vinculados a UID e
  sessão; uma sessão de snapshot diferente invalida o fallback ao vivo. Logout
  continua chamando `clearForUser`; a chave física do registro foi mantida para
  que o envelope v2 sobrescreva o antigo e a limpeza existente alcance ambos.
- Testes sintéticos cobrem reinício (instância nova do cache), painel com seis
  cards restaurado antes da conclusão remota, revalidação offline, valores
  iguais e alterados, identidade do `NativeAnimatedNumber`, mudança de período
  e UID, envelope v1, resumo incompleto, falha de storage, sessão e concorrência.
  TypeScript, ESLint direcionado, `git diff --check` e as duas suítes
  direcionadas passaram, com 41 testes sintéticos. Nenhum teste acessou
  Firebase/Emulator. O diff-check emitiu somente avisos de normalização
  LF/CRLF já associados ao working tree do Windows.
- AsyncStorage permanece sem criptografia. O envelope limita-se a agregados e
  comparações, mas esses valores podem ser vistos por alguém com acesso aos
  dados locais do aplicativo. Essa limitação de privacidade segue explícita.
  Fast Refresh basta para testar TS/JS; não houve build, commit, push nem acesso
  ao Firebase de produção. No iPhone ainda é necessário verificar: uma abertura
  completa após esta versão gera `presentation_cache_write`; após encerrar o
  processo e reabrir com o mesmo usuário/período/filtros, aparece cache hit e os
  seis cards são montados antes de `remoteComplete`; depois, `replaced_by_live`
  ocorre uma vez quando a resposta atual completa chega.

## Etapa 2.2.10 — consolidação e preparação local (2026-11-06)

- A revisão manteve 17 entradas locais: 15 arquivos rastreados e os dois novos
  `FinancialPresentationCache.ts` e `FinancialPresentationCache.test.ts`. Todos
  pertencem à implementação financeira, seus testes, instrumentação ou este
  histórico. Não foram encontrados arquivos temporários, credenciais ou dados
  brutos de clientes; `package.json` e lockfile não mudaram.
- Foi confirmado um risco de sessão na tela Atacado: os resumos de rotas e a
  flag `routesLoaded` ficam em estado React da tela, enquanto a pilha autenticada
  pode permanecer montada durante uma troca direta de UID. Isso poderia
  combinar rotas da conta anterior com o resumo da conta nova e gravar esse
  resultado no cache visual sob o UID novo. A tela Atacado agora recebe uma
  chave React derivada de UID e `sessionVersion`, descartando esse estado na
  fronteira de sessão. O teste de regressão confirma que a conta nova não grava
  até concluir a própria leitura de rotas e só então grava sob seu UID. Os hooks
  de custos e veículo já validam UID/sessão e são remontados junto com a tela.
- Os logs de cache agora distinguem restauração persistente de valor anterior
  mantido apenas em memória. `presentation_cache_hydrated`,
  `presentation_cache_rendered` e `presentation_cache_replaced_by_live` são
  emitidos somente para a origem persistente; `rendered` continua significando
  commit/layout JS, não confirmação de frame físico. A mudança não altera a UI.
- O cache visual segue como um único envelope de seis cards e comparações,
  limitado a agregados permitidos e isolado por ambiente/projeto Firebase, UID,
  período/filtros e versões. Leituras e gravações em execução também validam
  sessão e geração. Ele não alimenta hooks, cálculos, `remoteComplete`, gráficos,
  widgets nem Firestore. AsyncStorage não é criptografado; valores salvos podem
  estar desatualizados até a atualização silenciosa, e a remoção persistente
  após logout não pode ser garantida se as operações locais de remoção e
  fallback falharem.
- TypeScript passou. ESLint direcionado aos arquivos TypeScript/TSX alterados
  passou com `prettier/prettier` desativado. `npm ls --depth=0` não encontrou
  dependências ausentes e os manifests não foram alterados. `git diff --check`
  passou, com avisos de normalização LF/CRLF do checkout Windows. O lint global
  não passou: 96.683 erros, quase todos `prettier/prettier` por CRLF em arquivos
  do checkout, além de duas falhas `import/namespace` em
  `NotificationService.ts`; também houve um aviso de variável não usada fora
  dos arquivos modificados. Não foi feita formatação em massa.
- As seis suítes direcionadas de cache, tela financeira, hook, snapshot, sessão
  e instrumentação passaram: 97 testes. A suíte completa foi executada: 11
  suítes falharam, uma foi ignorada e 230 passaram; 26 testes falharam, cinco
  foram ignorados e 1.932 passaram. As falhas abrangem: três casos cujo mock de
  providers não exporta `useAuth`; sete snapshots de Firestore cujo mock omite
  `metadata.hasPendingWrites=false`; oito casos cujo mock de tema não exporta
  `getInsetSurfaceColor`; expectativas de flags Firebase desativadas apesar da
  configuração atual habilitada (três casos); um fixture que usa a chave antiga
  do ledger de rotas; uma expectativa de ordenação de entregas; e três
  assertions textuais/estruturais frágeis. Os arquivos desses testes e dos
  módulos associados não fazem parte deste diff; não foram alterados para
  mascarar falhas. As categorias históricas de `useAuth` e `hasPendingWrites`
  permanecem identificadas separadamente das demais incompatibilidades de
  mocks/expectativas no HEAD atual.
- O usuário informou que a restauração dos seis cards e a atualização silenciosa
  foram consideradas satisfatórias no iPhone. Não houve nova medição física
  nesta consolidação. Não foi acessado Firebase de produção ou Emulator; não
  houve build, commit, push ou deploy. `AI_CONTEXT.md` e `design-system.md` não
  precisaram de alteração: os contratos de cálculo, navegação, armazenamento e
  apresentação não foram redesenhados nesta consolidação.
- Na Etapa 2.2.11, as 11 suítes que falharam foram executadas também em uma
  worktree temporária, detached no HEAD original
  `5a8205c44645aaa6f7fd10d261abe4b0c68e3078`. A cópia usou o mesmo blob do
  `package-lock.json`, o mesmo diretório de dependências instalado e as mesmas
  flags Jest (`--runInBand --silent`); Jest não carrega `.env.local` pela
  configuração ou setup do projeto. A worktree estava limpa antes da remoção e
  foi removida após a comparação. HEAD e arquivos do checkout principal não
  foram alterados por essa operação.
- A seleção de 11 suítes no HEAD e no checkout atual produziu exatamente os
  mesmos 26 casos falhos e 35 aprovados. Portanto, as 11 falhas são baseline do
  HEAD, não regressões do cache v2; as duas categorias já registradas (`useAuth`
  ausente no mock e `hasPendingWrites` ausente no mock) foram reproduzidas junto
  com os outros desalinhamentos de mock, configuração e assertions estáticas.
- O lint global falha nos dois estados. HEAD registrou 110.045 erros e um aviso;
  o checkout atual registrou 96.683 erros e um aviso. A diferença de volume é
  de diagnósticos `prettier/prettier` associados à representação CRLF dos
  checkouts Windows, não de novas regras de lint: os dois erros
  `import/namespace` em `NotificationService.ts` e o aviso de `resolvedMode`
  não usado em `RetailOrderStepScreen.tsx:452` existem também no HEAD. Nos dois
  arquivos alterados que mantêm CRLF, o coordenador de widget tem 304 avisos de
  formatação tanto no HEAD quanto agora; `HomeSearchDataSource.ts` tem quatro
  ocorrências adicionais, correspondentes às linhas novas no mesmo arquivo
  CRLF. O lint direcionado com `prettier/prettier` desativado passa sem erros ou
  avisos. Nenhuma conversão em massa foi feita.
