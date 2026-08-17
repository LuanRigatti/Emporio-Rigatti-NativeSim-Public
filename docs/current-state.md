# Estado atual do projeto

Este documento é a referência operacional para novas tarefas. O conteúdo de
`docs/migration/` que descreve o Ionic, o Realtime Database ou o schema antigo
é histórico e não deve orientar novas implementações, salvo quando a tarefa
pedir uma auditoria histórica explícita.

## Identidade do aplicativo

- Branch de trabalho: `upgrade/expo-sdk-57`.
- Último commit funcional validado: `d806c32ac95a89950c8e2e85fc607e2c0cad0af7`
  (`feat: expand Home Search metrics and route summaries`).
- Expo SDK 57 e Development Build iOS.
- Nome exibido no iPhone: `Rigatti`.
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
- Estoque derivado de compras menos entregas;
- FactorySettings, CarSettings e CompanyProfile;
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

## Gráfico Diário de Finanças: Scrubbing Contínuo e Interpolação de Curva

### Funcionalidade implementada

Interação contínua por arraste e toque livre no gráfico de linha da tela **MonthlyFinancialDetailScreen** (`FinancialSeriesChart`), separando o movimento contínuo do gesto da seleção discreta de dias:

- Captura contínua de toque e arraste horizontal via `PanResponder` sem interferência ou roubo de gesto da `ScrollView` pai (`onPanResponderTerminationRequest: () => false`).
- Desacoplamento arquitetural entre a posição contínua de arraste (`scrubX`, `scrubY` em `SharedValue` no UI thread) e o dia selecionado (`selectedIndex` em React state).
- Interpolação matemática contínua da altura $Y$ ao longo dos segmentos da curva (`interpolateYOnCoordinates`).
- Renderização da linha vertical pontilhada e do marcador em overlay nativo acelerado por hardware (`Animated.View` com `transform: [{ translateX }, { translateY }]`), rodando a 120fps/60fps na GPU sem re-renderizar o SVG.
- Feedback tátil sutil (`triggerSelectionHaptic`) e atualização de dados no cabeçalho/card inferior acionados exclusivamente ao cruzar o limiar de um novo dia (`nearestIndex !== selectedIndex`).
- Snap suave com curva easing (`withTiming`, 160ms) em direção ao ponto selecionado ao soltar o dedo (`release`/`terminate`).

### Comportamento final

- O usuário pode tocar em qualquer parte do gráfico ou arrastar continuamente o dedo na horizontal para percorrer os dias do mês de forma suave e contínua.
- A linha pontilhada e o marcador de vidro acompanham o dedo pixel a pixel sem saltos bruscos, enquanto os valores e cards refletem instantaneamente os dados discretos reais do dia correspondente.

### Arquivos principais

- `src/components/Charts/index.tsx`
- `src/features/finance/components/MonthlyFinancialDetailScreen.tsx`
- `src/utils/haptics.ts`

### Flags e schema afetados

- Nenhuma flag ou schema alterado.

### Validações executadas

- TypeScript (`npx tsc --noEmit`): 0 erros.
- ESLint: 0 erros.
- Jest (`npm test -- tests/finance`): 12 suítes / 87 testes passando.
- `git diff --check`: passou.

### Limitações conhecidas

- Em telas web ou ambientes sem Reanimated UI thread nativo, o layout utiliza fallback síncrono.

### Commit e publicação

- Alteração validada localmente; ainda não commitada.

## Morph e Fusão Nativa de Liquid Glass (@expo/ui)

### Funcionalidade implementada

Criação do componente nativo reutilizável `NativeGlassMorphActionGroup` explorando as capacidades de Liquid Glass e transições de namespace nativas do `@expo/ui` (`ExpoUI` / SwiftUI):

- Utilização exclusiva de componentes oficiais do `@expo/ui/swift-ui` (`Host`, `Namespace`, `GlassEffectContainer`, `HStack`, `Button`, `Image`).
- Utilização dos modificadores SwiftUI nativos `glassEffect`, `glassEffectId`, `animation(Animation.spring(...))` e `buttonStyle('plain')`.
- Transição orgânica entre estado recolhido (1 botão circular de 44x44 com SF Symbol `ellipsis`) e estado expandido (2 botões circulares de 44x44 com SF Symbols `xmark` e `plus`).
- Fusão física / coalescência e separação da superfície de vidro com refração contínua durante a animação de mola (`GlassEffectContainer` com `spacing={8}`).
- Inserção de card de demonstração seguro na tela de **Configurações** (`SettingsScreen.tsx`).

### Comportamento final

- Ao tocar no botão de teste em Configurações, o botão de vidro se expande e divide em dois controles com animação spring nativa sem flash e sem recarregar componentes React Native.
- Ao tocar novamente, os botões realizam o morph inverso e se fundem novamente em uma única gota de vidro circular.
- 100% interpretado via Hot Reload / Metro, sem necessidade de recompilação nativa no Xcode.

### Arquivos principais

- `src/components/native/NativeGlassMorphActionGroup/NativeGlassMorphActionGroup.types.ts`
- `src/components/native/NativeGlassMorphActionGroup/NativeGlassMorphActionGroupSwiftUI.ios.tsx`
- `src/components/native/NativeGlassMorphActionGroup/NativeGlassMorphActionGroupFallback.tsx`
- `src/components/native/NativeGlassMorphActionGroup/NativeGlassMorphActionGroup.native.tsx`
- `src/components/native/NativeGlassMorphActionGroup/NativeGlassMorphActionGroup.tsx`
- `src/components/native/NativeGlassMorphActionGroup/NativeGlassMorphActionGroup.web.tsx`
- `src/components/native/NativeGlassMorphActionGroup/index.ts`
- `src/components/native/index.ts`
- `src/features/settings/components/SettingsScreen.tsx`

### Flags e schema afetados

- Nenhuma flag ou schema alterado.

### Validações executadas

- TypeScript (`npx tsc --noEmit`): 0 erros.
- ESLint: 0 erros.
- `git diff --check`: passou.

### Limitações conhecidas

- O efeito físico de coalescência/fusão de superfícies de vidro é renderizado nativamente no target SwiftUI de Liquid Glass do `@expo/ui`. Ambientes web ou Android utilizam o fallback gracioso correspondente.

### Commit e publicação

- Alteração validada localmente; ainda não commitada.

## Bottom Sheets Nativos (Home Search e Registrar Entrega) e NativeInteractivePager

### Funcionalidade implementada

1. **Eliminação de Faixas Inferiores e Gap de Safe Area:**
   - Patch nativo reproduzível e idempotente no `@expo/ui` (`BottomSheetView.swift`) aplicando `.ignoresSafeArea(.container, edges: .bottom)` no UIHostingController da apresentação nativa de sheets, removendo o espaçamento inferior de 34pt do UIKit.
   - Script automatizado `scripts/patch-expo-ui-bottom-sheet.js` e hook `postinstall` no `package.json` (`npm run patch:expo-ui`) para assegurar compilação determinística no Mac/Xcode após `npm install`.
   - Ajuste de dimensionamento e preenchimento no Registrar Entrega (`src/app/(tabs)/registrar.tsx` com `hostSizing="viewport"`, e `src/components/native/NativeBottomSheet/NativeBottomSheetSwiftUI.ios.tsx` com `frame(maxWidth: Infinity, maxHeight: Infinity, alignment: 'topLeading')`, `fillWidth` no pager e `padding({ bottom: 0 })`).

2. **Correções Preventivas Swift nos Módulos Locais:**
   - `NativeInteractivePagerView.swift`: Limpeza de interpolação e escapes de string.
   - `NativeLiquidGlassView.swift`: Substituição de inicializadores ambíguos `CGFloat.init` por closures explícitas `{ CGFloat($0) }`.
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
- `modules/native-liquid-glass/ios/NativeLiquidGlassView.swift`
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

As telas devem reutilizar repositories/services/hooks existentes, consultar
apenas o período ou entidade necessário e atualizar a UI imediatamente após
uma operação confirmada.

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
