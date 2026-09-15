# Estado atual do projeto

# Snapshot operacional atual

Este é o primeiro bloco a ser consultado por qualquer nova conversa ou agente
de IA. Ele representa o estado operacional deste checkout; as seções posteriores
preservam o histórico técnico e as decisões acumuladas.

## Git

- Branch atual: `ajustes-codex`.
- Este snapshot corresponde à correção de cold start offline e às proteções de
  sessão e concorrência consolidadas nesta branch; consulte `git log -1` para o
  hash do commit publicado.
- Após a publicação deste estado, o working tree deve permanecer limpo e a
  branch local sincronizada com `origin/ajustes-codex`.

## Consolidação desta sessão — 2026-09-12

- O experimento temporário do micro-delay da toolbar foi encerrado. A
  instrumentação `[TOOLBAR-PERF]`, `toolbarPerf.ts` e a memoização experimental
  não fazem parte do estado atual; os arquivos foram restaurados exatamente ao
  HEAD deste checkpoint.
- Não houve alteração funcional nova nesta sessão nem novo teste no iPhone.
  A validação física anterior do estado de navegação permanece registrada nas
  seções abaixo; esta sessão apenas preservou o checkpoint já aprovado.

## Aplicativo

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

## Snapshot funcional auditado — fechamento atual

Este bloco é a fonte resumida do estado atual do código para o fechamento em
`ajustes-codex`. O código e o histórico local foram auditados; artefatos de
apresentação e instrumentação temporária foram removidos. A correção descrita
abaixo é a referência operacional após a publicação deste commit.

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
- O header da Home mantém avatar e lupa juntos em uma única pílula no canto
  superior direito, pertencente ao `Stack.Toolbar` local. Os dois controles
  continuam com hitboxes nativas independentes, haptics, Profile Sheet e
  navegação para `/pesquisa`.
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
- Registrar Entrega mantém o `RegistrarDeliverySheet` compartilhado, seleção de
  cliente pelo Menu nativo, detalhe em um único sheet, detents, gestos, Liquid
  Glass, callbacks e a máquina de estados `closed → presented → dismissing → closed`.
- Na variante Home → `Registrar entrega`, o mesmo Bottom Sheet usa duas páginas
  internas pelo `RegistrarDeliveryPagerRN`: a Page 0 lista clientes com círculo
  `54x54`, ícone de cliente, nome, descrição `Cliente`, `chevron.right` e linha
  inteira clicável; a seleção avança para a Page 1 no mesmo sheet, com swipe
  horizontal interativo e snap. A Page 1 mantém cliente, Data, Baldes, Valor
  total, Confirmar e `chevron.left` simples para voltar. A variante padrão
  continua preservando o Menu nativo de seleção.
- As rotas Home → `Registrar Entrega` e `/registrar/entrega` passam
  `inlineClientSelection` e usam o pager de clientes descrito acima; a
  composição antiga do Menu continua preservada na variante padrão do sheet.
- O botão de data do detalhe reutiliza os itens, formatter e regras de ajuste
  de data compartilhados com `NativeDateToolbar` do Histórico, exibindo a
  forma compacta `dia mês` e mantendo o Menu nativo de mês/ano/dia.
- Os sheets usam o tint escuro opt-in `rgba(0, 0, 0, 0.30)` e preservam a superfície
  nativa; o light mode não recebe esse tint específico.
- O botão `Confirmar` é uma cápsula nativa de `84%` da largura disponível e
  `58 pt` de altura. Seu conteúdo SwiftUI ocupa o frame completo e usa
  `contentShape(.capsule())`, portanto toda a cápsula é clicável.
- A seleção mantém o chevron nativo; toda a área direita `Selecionar/nome +
  chevron` abre o Menu, enquanto o label `Cliente` permanece estático.
- O Bottom Sheet de Dados Diários usa detent `0.46`, drag indicator nativo e
  conteúdo sem botão `X` no iOS. A página principal mostra quatro linhas sem
  separadores, com círculos `54x54`, SF Symbols `21 pt`, descrição secundária,
  `chevron.right` simples e a linha inteira clicável.
- A navegação para o detalhe ocorre dentro do mesmo sheet pelo
  `RegistrarDeliveryPagerRN`, com duas páginas horizontais e swipe preservado.
  O detalhe mantém o botão voltar, título central, campo correspondente e
  botão `Adicionar` em cápsula de `58 pt`.

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
  custos derivados. O storage legado ainda não foi migrado nem isolado por UID.

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

## Estado nativo atual

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

## Estado funcional recente

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

## Validações no iPhone

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

## Trabalho atual

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
- Commit base do snapshot: `7c6c85f` (`feat: refine history and finance flows`).
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
