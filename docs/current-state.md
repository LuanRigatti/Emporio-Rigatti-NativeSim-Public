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

- Branch: `ajustes-antigravity`.
- Mensagem: `fix(native): sincronizar animacao inicial do morph de liquid glass`.

## Laboratório Cross-Screen de Liquid Glass Morph Nativo (iOS 26 / SwiftUI)

### Funcionalidade implementada

Evolução e consolidação do laboratório experimental de Liquid Glass Morph cross-screen entre telas distintas (`/teste-morph` ⇄ `/teste-1`), eliminando intermediários frágeis e integrando a deformação contínua de malha do SwiftUI/Metal:

- **Host Persistente Único no Shell:** Centralização de um único container persistente no layout raiz (`TransientGlassMorphHost.tsx` em `_layout.tsx`), encapsulando o `NativeCrossScreenMorphView` em `<Host matchContents>` de `@expo/ui/swift-ui` para montagem UIKit válida no Expo SDK 57, mantendo uma única árvore SwiftUI com `@Namespace` e `GlassEffectContainer(spacing: 8)` ativa durante toda a navegação.
- **Implementação Swift Canônica com `matchedGeometry`:** No módulo local `modules/native-liquid-glass/ios/NativeLiquidGlassView.swift` (`nativeCrossScreenMorph`), aplicação do padrão oficial Apple com `.glassEffect(glassMaterial, in: .circle / .capsule)`, `glassEffectID(props.glassIdentity, in: namespace)` compartilhado e `.glassEffectTransition(.matchedGeometry)`.
- **Eliminação de Hacks e Tint Branco:** Removidas medições manuais de coordenadas no JS, delays e manipulações de `opacity`. Removido `tint` explícito da lâmina de vidro no TSX para preservar o material `Glass.regular.interactive()` neutro e translúcido (sem fundo branco opaco).
- **Botões Interativos com Material `.regular.interactive()`:** Ambos os ramos (círculo 44×44 com `ellipsis` e cápsula 100×44 com `plus` + `xmark`) utilizam botões nativos que respondem a toques e transmitem eventos à aplicação.
- **Mola Nativa Apple com Overshoot Orgânico:** Animação governada por `.spring(duration: 0.46, bounce: 0.36)` dentro de `withAnimation` no Swift, produzindo estiramento contínuo com refração, leve overshoot elástico na expansão e acomodação fluida no retorno.
- **Timing Imediato e Sincronizado:** O início do morph ocorre no mesmo tick de execução do `router.push('/teste-1')` e `router.back()`, transformando a geometria no topo enquanto a tela desliza por baixo.

### Comportamento final

1. **Tela A (`Teste Morph`)**:
   - Cabeçalho canônico com botão Back nativo e o botão circular Liquid Glass 44×44 no topo direito (`ellipsis`) translúcido.
   - Placeholder transparente no cabeçalho para garantir alinhamento e respiro sem renderizar Hosts conflitantes.
2. **Ao tocar em `Teste 1` (Ida)**:
   - `setMorphState('capsule')` e `router.push('/teste-1')` disparam instantaneamente.
   - O botão de vidro deforma organicamente de círculo (44×44) para cápsula (100×44) com refração líquida, overshoot elástico e transição de ícones (`ellipsis` ⇄ `xmark` + `plus`).
   - A tela `/teste-1` desliza suavemente por baixo sem cortar ou piscar o vidro.
3. **Tela B (`Teste 1`) e Retorno (Volta)**:
   - Exibe a cápsula de vidro ativa (100×44) translúcida.
   - Ao tocar no botão de voltar (Back), `setMorphState('circle')` e `router.back()` disparam no mesmo tick.
   - O vidro executa o morph reverso (cápsula $\rightarrow$ círculo) com undershoot elástico suave.

### Arquivos principais

- `modules/native-liquid-glass/ios/NativeLiquidGlassView.swift`
- `modules/native-liquid-glass/src/NativeLiquidGlass.tsx`
- `src/components/native/CrossScreenGlassMorph/CrossScreenGlassMorphContext.tsx`
- `src/components/native/CrossScreenGlassMorph/CrossScreenGlassMorphTarget.tsx`
- `src/components/native/CrossScreenGlassMorph/TransientGlassMorphHost.tsx`
- `src/components/native/CrossScreenGlassMorph/index.ts`
- `src/app/teste-morph.tsx`
- `src/app/teste-1.tsx`
- `src/app/_layout.tsx`
- `src/features/settings/components/SettingsScreen.tsx`

### Flags e schema afetados

- Nenhum schema Firestore afetado.
- Nenhuma flag alterada.

### Validações executadas

- TypeScript (`npx tsc --noEmit`): 0 erros.
- ESLint direcionado: 0 erros e 0 warnings.
- Jest (`npm test`): 39 suítes e 374 testes passando com 100% de sucesso.
- `git diff --check`: limpo.

### Limitações conhecidas

- Requer recompilação do Development Build no Mac/Xcode (`npx expo run:ios` ou EAS Build) para carregar o módulo Swift local com `.glassEffectTransition(.matchedGeometry)`.
- Swipe-back interativo por gesto contínuo do UIKit requer interceptação do progresso nativo (`onTransitionProgress`), operando atualmente no disparo determinístico de navegação e foco.

### Commit e publicação

- Base commit: `cae55af` (`feat: add native Liquid Glass matched geometry morph`).
- Ajustes de `<Host matchContents>` e remoção de `tint` validados localmente via Fast Refresh; aguardando autorização para novo commit.

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
     - **Finanças:** Cards de *Faturamento Mensal* e *Lucro Líquido Mensal*.
     - **Home / Dashboard:** Widgets de *Recebimentos em aberto* e *Documentos*, além do foco na barra de busca (*Search Bar*).
     - **Registrar:** Cards de *Registrar Entrega* e *Registrar Dados Diários*, e botão *Adicionar* da tela de Dados Diários.
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

- **Simplificação e padronização de cabeçalhos:** Em resultados financeiros (`financialMetric` sem cliente explícito), resumos gerais de período (`periodSummary`) e resumos da fábrica com período (`factorySummary`), foi removido o texto redundante cinza (*eyebrow context*) e o ícone anterior à data/período. O cabeçalho passa a exibir diretamente o período/data em tipografia `headline bold rounded`, seguido pelo valor principal e pelo card *"Base do cálculo"*.
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
- **Padronização do rótulo da métrica:** No card *Operação* dos resumos, o rótulo foi atualizado de `Distância das rotas` para **`Quilometragem total`** em [HomeSearchResultsVisualModel.ts](file:///c:/Projetos/PAReact%20Antigravity/pwa-ios-2026/src/features/home/components/HomeSearchResultsVisualModel.ts).

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

## Card Última Rota na Home (Atalho com Preview de Mapa Apple Maps)

### Funcionalidade implementada

- **Criação do card de atalho `Última rota` na Home:**
  - Posicionado estrategicamente abaixo dos widgets *Recebimentos em aberto* e *Documentos* e acima de *Entregas de hoje* em [dashboard.tsx](file:///c:/Projetos/PAReact%20Antigravity/pwa-ios-2026/src/app/(tabs)/dashboard.tsx).
  - Reutilização integral do componente de mapa nativo [NativeTrackedRouteMap](file:///c:/Projetos/PAReact%20Antigravity/pwa-ios-2026/src/components/routes/NativeTrackedRouteMap.native.tsx) (`AppleMaps.View` no iOS Development Build com polyline nativa, marcadores início/fim, enquadramento automático de câmera e fallback gracioso).
  - Apresentação em [GlassCard](file:///c:/Projetos/PAReact%20Antigravity/pwa-ios-2026/src/components/premium/GlassCard.tsx) elevado com curvatura Apple de `theme.radius.xl + theme.spacing.sm`, altura de prévia de 180 pt e cantos arredondados contínuos.
  - Formatação tipográfica em duas linhas: linha 1 com data por extenso (`16 de agosto de 2026` via `Intl.DateTimeFormat('pt-BR', { day: 'numeric', month: 'long', year: 'numeric' })`) e linha 2 com distância formatada (`91,85 km` ou `0,00 km` em `pt-BR`).
  - Header da seção com título `Última rota` e chevron discreto à direita (`chevron-forward`), com margens horizontais idênticas a `TodayDeliveriesCard` (`16 pt`).
  - Navegação instantânea: toque em qualquer ponto do card ou header aciona `triggerLightImpactHaptic()` e `router.push('/localizacao')`.
- **Seleção canônica da última sessão finalizada:**
  - Adição dos métodos `getLatestCompletedRoute()` e `getMemoryLatestCompletedRoute()` em [RouteTrackingRepository.ts](file:///c:/Projetos/PAReact%20Antigravity/pwa-ios-2026/src/services/routes/RouteTrackingRepository.ts) e [LocationTrackingService.ts](file:///c:/Projetos/PAReact%20Antigravity/pwa-ios-2026/src/services/routes/LocationTrackingService.ts).
  - Seleção estrita da última sessão finalizada da ordenação canônica por data/horário (`history[history.length - 1]`).
  - Sem filtros destrutivos por distância, duração ou quantidade de pontos: sessões com `0,00 km`, curta duração ou apenas o ponto inicial são exibidas normalmente como a última sessão real.
  - Rotas ativas em andamento nunca substituem a última rota finalizada.
  - Na ausência total de rotas finalizadas no histórico (`history.length === 0`), a seção retorna `null` e a Home não reserva nenhum espaço em branco.
- **Performance e Zero Firestore:**
  - Hidratação de frame 0 instantânea a partir da memória via hook [useLatestCompletedRoute.ts](file:///c:/Projetos/PAReact%20Antigravity/pwa-ios-2026/src/features/home/hooks/useLatestCompletedRoute.ts), sem flash e sem layout shift.
  - Sincronização em segundo plano no ciclo de foco (`useFocusEffect`).
  - 0 consultas ao Firestore (rotas são 100% locais via `AsyncStorage` + memória).

### Comportamento final

- Usuário abre a Home: o card `Última rota` aparece imediatamente abaixo dos widgets de recebimentos/documentos, exibindo a rota finalizada mais recente.
- Caso o usuário inicie uma nova rota, o card continua exibindo a rota finalizada anterior até que a nova rota seja parada e concluída.
- Ao tocar no card ou no cabeçalho, o app vibra suavemente e navega diretamente para a tela de Localização.
- Se o usuário não tiver nenhuma rota gravada, a seção não é renderizada e a Home permanece minimalista.

### Arquivos principais

- `src/features/home/components/LastRouteCard.tsx` (novo)
- `src/features/home/utils/lastRouteFormatUtils.ts` (novo)
- `src/features/home/hooks/useLatestCompletedRoute.ts` (novo)
- `src/services/routes/RouteTrackingRepository.ts`
- `src/services/routes/LocationTrackingService.ts`
- `src/app/(tabs)/dashboard.tsx`
- `tests/home/LastRouteCard.test.ts` (novo)
- `tests/routes/RouteTracking.test.ts`

### Flags e schema afetados

- Nenhuma flag ou schema do Cloud Firestore alterado. Persistência local e tracking GPS preservados integralmente.

### Validações executadas

- TypeScript (`npx tsc --noEmit`): 0 erros.
- ESLint direcionado nos arquivos afetados: 0 erros e 0 warnings.
- Jest: 69 suítes e 515 testes passando.
- `git diff --check`: limpo.

### Limitações conhecidas

- Nesta etapa, o toque navega para a tela principal de Localização (`/localizacao`). O foco ou abertura direta de uma rota específica na lista fica reservado para expansões futuras da navegação.

### Commit e publicação

- Branch: `ajustes-antigravity`.
- Mensagem: `feat(home): adicionar card ultima rota com preview de mapa nativo`.
- Status: Validado e publicado na branch `ajustes-antigravity`.

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

## Custo de Combustível nos Cards de Rota e Ajustes na Tela de Detalhes da Rota

### Funcionalidade implementada

- Integração do cálculo canônico de custo de combustível nos cards de rota da Home (`LastRouteCard`) e da aba Localização (`RouteHistoryCard`), reutilizando exclusivamente o serviço `FuelCostCalculationService` (`useRouteFuelCost`).
- Exibição do valor gasto (`R$ 00,00`) na mesma linha dos quilômetros percorridos, alinhado à direita no rodapé dos cards, mantendo rigorosamente a mesma tipografia, cor secundária e altura dos cards.
- Simplificação do formato da data no card `Última rota` da Home para `DD/MM` (ex: `19/08`).
- Navegação direta do toque no card `Última rota` da Home para a tela de detalhes `/localizacao/[routeId]` quando houver uma rota finalizada.
- Na tela de detalhes da rota (`RouteDetailsScreen` e `RouteSummaryCard`):
  - Inclusão da linha `Valor gasto` com o valor canônico formatado (`formatCurrency(fuelCost)`) e SF Symbol `fuelpump`.
  - Atualização do formato da linha `Data` para `${weekday} ${day}/${month}/${year}` (ex: `quarta-feira 19/08/26`).
  - Remoção completa da linha `Pontos GPS`.
  - Aumento refinado do arredondamento dos cantos do mapa para `theme.radius.xl + theme.spacing.sm` (34pt), harmonizado ao design system.

### Comportamento final

- **Card Última rota (Home):** exibe data em formato compacto `19/08` no título e no rodapé `26,37 km` à esquerda com `R$ 18,42` à direita na mesma linha.
- **Cards de rotas (Localização):** cada card do histórico do mês exibe os horários de início/fim e no rodapé `26,37 km` à esquerda com `R$ 18,42` à direita.
- **Tela de detalhes da rota:** exibe o mapa com cantos arredondados suaves (34pt) e o card de resumo com Data (`quarta-feira 19/08/26`), Início, Fim, Duração, Distância, Valor gasto e Km considerado no dia (quando aplicável), sem a linha de Pontos GPS.
- Todos os cálculos utilizam os dados reais da sessão (`session.distanceMeters / 1000`), a autonomia configurada do carro (`useCarSettings`) e o preço/tipo de combustível correspondente à data da rota (`useCostSettings`), sem duplicar lógica matemática nem usar km consolidado.

### Arquivos principais

- `src/hooks/useRouteFuelCost.ts`
- `src/features/home/components/LastRouteCard.tsx`
- `src/features/home/utils/lastRouteFormatUtils.ts`
- `src/features/location/components/LocationTrackingScreen.tsx`
- `src/features/location/components/RouteDetailsScreen.tsx`
- `src/features/location/components/RouteSummaryCard.tsx`
- `src/app/(tabs)/dashboard.tsx`
- `tests/home/LastRouteCard.test.ts`
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
