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
- Notas fiscais/boletos e elegibilidade por cliente;
- Compras da fábrica e pagamentos parciais;
- Dados diários/mensais e Finanças;
- Estoque derivado de compras menos entregas;
- FactorySettings, CarSettings e CompanyProfile;
- Backup, validação/dry-run e Restore seguro.

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
- Este é o último commit conhecido; a atualização desta documentação e as
  alterações de trabalho relacionadas ainda não foram commitadas.
- Nenhum commit ou push adicional foi feito.

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
