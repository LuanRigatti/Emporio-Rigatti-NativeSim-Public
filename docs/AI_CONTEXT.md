
# AI_CONTEXT.md

> Documento mestre para qualquer agente de IA (Codex, Gemini, Claude, Continue, Cursor, etc.)

Para o estado atual do produto, schema, flags e áreas já validadas, consulte
`docs/current-state.md`. O histórico da migração anterior permanece no histórico Git e não é contexto operacional.

# Objetivo do Projeto

Este é o aplicativo React Native atual, construído originalmente a partir de uma migração Ionic/Angular. A migração histórica não é mais a fonte principal de contexto.

O objetivo atual é manter um aplicativo funcional, rápido e com experiência de iOS nativo moderno, preservando compatibilidade com Android, Web e Expo Go quando possível.

# Stack

- Expo SDK 57
- React Native
- TypeScript
- Expo Router
- expo-router/unstable-native-tabs
- @expo/ui 0.2.0-beta.9
- Development Build para iOS

## Documentação do Expo

Antes de escrever qualquer código, consulte a documentação oficial versionada do Expo SDK 57:

https://docs.expo.dev/versions/v57.0.0/

O projeto utiliza o Expo SDK 57. Para decisões sobre APIs, componentes, configuração e compatibilidade do Expo neste checkout, use exclusivamente a documentação versionada do SDK 57. Não use documentação de outras versões como referência para a implementação.

# Plataformas

Prioridade:

1. iOS Development Build
2. Android
3. Web
4. Expo Go (fallback)

Toda funcionalidade nativa deve possuir fallback seguro.

# Arquitetura

- Navegação com Expo Router.
- Utilizar expo-router/unstable-native-tabs.
- Não migrar para React Navigation.
- Preservar a arquitetura existente.
- `AppModeProvider` é a fonte do modo atual (`wholesale`/Atacado ou
  `retail`/Varejo). O modo influencia as entradas e telas de Home, Registrar,
  Histórico, Catálogo e Finanças; os dados, serviços e regras dos dois domínios
  devem permanecer isolados.

## Retail Orders

- O Histórico usa uma entrada compartilhada e roteia por `AppMode`: Atacado permanece em `HistoryScreen`/Delivery; Varejo usa `RetailOrderHistoryScreen`/`RetailOrder`. As coleções e serviços dos dois domínios não devem ser misturados.
- O wizard Registrar Varejo participa do Root Native Stack nas rotas `/registrar-pedido-varejo`, `/registrar-pedido-varejo/produtos`, `/registrar-pedido-varejo/detalhes`, `/registrar-pedido-varejo/resumo` e `/registrar-pedido-varejo/pagamento`. Não criar Stack aninhado para esse fluxo; Back, morph, push/pop e swipe-back permanecem nativos, e `RetailOrderFlowProvider` compartilha o draft.
- O detalhe Retail usa a rota Root `/pedido-varejo/[orderId]` e recebe somente `orderId`. Deve priorizar snapshot/cache disponível, revalidar sem apagar o conteúdo visível e carregar pagamentos apenas do pedido atual; não deve acessar Delivery no ramo Retail.
- `calculateRetailOrderFinancials` é a única fonte das fórmulas e dos status financeiros. Somente pagamentos `posted` entram nos totais; `voided` pode ser exibido para auditoria, mas não altera o valor pago. Pagamentos posteriores referenciam o mesmo `orderId`; pedidos cancelados bloqueiam novos pagamentos e pedidos completed podem recebê-los.
- O resumo financeiro do Histórico Retail usa cache isolado por UID, `sessionVersion`, `orderId` e assinatura financeira, com prewarm local, cache-first/stale-while-revalidate e concorrência limitada, restrito aos pedidos visíveis. `updateForOrder()` atualiza somente o pedido afetado a partir do snapshot local completo, publica aos listeners e não faz leitura Firestore nem `clear` global; respostas obsoletas são descartadas.
- Em pedidos com status `created`, `deliveryCost` pode ser alterado isoladamente mesmo com pagamentos `posted`, pois é custo interno e não altera o valor cobrado. `discount`, `deliveryFee` e alterações comerciais/lineItems continuam bloqueados quando há pagamento `posted`; um patch combinado com `deliveryCost` também é bloqueado. `completed` e `cancelled` permanecem somente leitura.

## Retail Catalog

- Novo produto, Editar produto e Composição usam páginas do Root Native Stack, com
  push/pop, Back e swipe-back nativos. Não criar navigator aninhado para esse
  fluxo.
- Create e edit compartilham o formulário inline da página de produto. A
  Composição usa cards inline para item, quantidade e remoção. O antigo
  `NativeRetailProductFormSheet` não participa do runtime do Catálogo.
- O Catálogo possui categorias e produtos Retail. Produtos podem usar custo
  `direct` ou `composition`; composições são versionadas e resolvidas
  historicamente pela data da venda.
- Rotas devem receber identificadores simples, não objetos serializados. A
  persistência de produto e composição continua centralizada nos data sources e
  nas versões históricas existentes.

## Retail Cost History and Finance

- Entradas de custo têm `effectiveDate`, com padrão hoje para novas entradas.
  Uma entrada existente pode ter somente sua data de vigência corrigida
  retroativamente, preservando valor, quantidade, unidade, fornecedor e custo
  unitário normalizado.
- A resolução histórica seleciona o custo mais recente com
  `effectiveDate <= referenceDate`. Nunca usar custo futuro ou fallback
  silencioso para custo atual. Quantidade comprada só normaliza custo unitário;
  não criar estoque, baixa por venda ou bloqueio por quantidade.
- Versões de composição usam `effectiveFrom` e podem ser criadas com vigência
  passada sem sobrescrever versões anteriores. Pedidos persistidos mantêm
  `unitCostSnapshot`/`lineCostTotal` e não são recalculados por mudanças futuras
  no catálogo, nos custos ou nas composições.
- O Retail Finance distribui `deliveryCost` e `deliveryFee` reconhecidos nas
  visões `Geral | Cestas | Salgados | Baldes`. O filtro de categoria usa o
  snapshot histórico da categoria do pedido. Uma categoria recebe o total;
  pedidos mistos usam receita líquida positiva reconhecida e rateio proporcional
  determinístico em centavos. `deliveryCost` reduz lucro, `deliveryFee` aumenta
  receita, somente a parcela reconhecida no período entra no rateio, `voided`
  não entra e `paymentFee` por categoria permanece fora dessa distribuição. A
  visão Geral e `calculateRetailOrderFinancials` continuam canônicas e
  inalteradas.

## Persistência atual

- Google/Firebase Auth é a autenticação real da conta.
- Cloud Firestore é a persistência de negócio atual.
- Os dados são separados por usuário em `users/{uid}/...`.
- Clientes, entregas, fábrica, pagamentos, dados diários/mensais e configurações usam documentos próprios e queries granulares.
- O Realtime Database legado não é fonte de verdade e não deve ser lido ou migrado automaticamente.
- AsyncStorage/local storage permanece apenas como cache, fallback local ou preferência específica do dispositivo; o histórico GPS é a exceção local-only mantida pelo `RouteTrackingRepository`.
- Finanças, Estoque, gráficos e índices são derivados em memória; não criar uma segunda fonte de verdade para eles.
- O cold start autenticado deve liberar a aplicação usando somente o estado local necessário e os caches disponíveis; leituras Firestore de dados de negócio, inclusive da Fábrica, não podem ser requisito do gate visual. A sincronização remota ocorre depois que a UI está disponível.
- Toda operação assíncrona vinculada a dados deve capturar UID e geração/sessionVersion no início e descartar respostas ou mutações obsoletas após logout, troca de UID ou nova sessão com o mesmo UID.
- Em Cost Settings, mutações remotas do mesmo UID + registro devem ser serializadas na mesma fila para create/update/delete; gravações usam patches/merge não destrutivos e preservam campos remotos não editados.
- `metadata.fromCache` não confirma uma leitura remota completa: respostas vazias/parciais devem preservar cache válido, e histórico parcial nunca deve ser tratado como histórico global completo.
- Novas rotas autenticadas são locais e usam storage v2/cache isolados por UID; a rota ativa persiste `ownerUid` para manter o vínculo no foreground, no background e na restauração. As chaves globais v1 permanecem em quarentena, fora do runtime normal, até um claim explícito.

Áreas já validadas: Clientes, Entregas, Pagamentos em aberto, Notas fiscais/boletos, Fábrica e pagamentos parciais, Dados Diários/Mensais, Finanças, Estoque, Registrar Varejo, Histórico Varejo, FactorySettings, CarSettings, CompanyProfile e Backup/Restore.

## Componentes nativos

Sempre preferir:

- Host
- Button
- ContextMenu
- Label
- SF Symbols
- buttonStyle("glass")
- buttonStyle("glassProminent")
- controlSize
- tint

Evitar simulações usando Pressable, Animated.View, BlurView ou GlassSurface quando existir um componente SwiftUI equivalente.

## Componentes existentes

Preservar abstrações existentes como:

- NativeButton
- NativeMenu
- NativeGlass*
- HistorySymbolIcon
- carregamento dinâmico por plataforma
- fallbacks para Android/Web/Expo Go

# Convenções

Nunca:

- alterar lógica de negócio;
- alterar handlers;
- alterar rotas;
- atualizar o SDK sem solicitação;
- instalar bibliotecas nativas sem necessidade.

Sempre:

- reutilizar componentes;
- evitar duplicação;
- manter TypeScript consistente;
- explicar decisões técnicas.

# Objetivo Visual

O aplicativo deve parecer um aplicativo iOS nativo.

Priorizar:

- Liquid Glass verdadeiro;
- componentes SwiftUI;
- SF Symbols;
- animações nativas;
- consistência visual.

# Limitações Conhecidas

- Permanecer no Expo SDK 57.
- @expo/ui 0.2.0-beta.9 utiliza ContextMenu no lugar de Menu.
- Evitar wrappers com overflow:hidden ao redor de componentes SwiftUI.
- Não envolver Button SwiftUI com Pressable.
- O overpayment de pagamentos Retail é validado contra a leitura corrente, sem transação Firestore; concorrência multi-device continua sendo uma limitação conhecida.
- No wizard Retail, controles @expo/ui/SwiftUI podem acompanhar corretamente o ScrollView, mas o material Liquid Glass pode ser composto de forma diferente ao atravessar o ProgressiveBlur RN. Essa pendência visual não deve ser corrigida globalmente sem nova evidência física.

# Fluxo de Desenvolvimento

Windows:

    npx expo start --dev-client

Mac apenas quando houver recompilação nativa.

Mudanças apenas em TS/TSX/JS normalmente utilizam Fast Refresh.

## Auditoria proporcional ao escopo

Antes de qualquer alteração:

1. Leia este documento por completo.
2. Leia o bloco `Snapshot operacional atual` no topo de
   `docs/current-state.md`.
3. Verifique o Git atual (`git status`, branch e `HEAD`) sem modificar o
   histórico.
4. Localize a funcionalidade solicitada e audite todos os arquivos,
   componentes, hooks, services, tipos, providers, tokens, APIs nativas e
   dependências diretamente relacionados.
5. Expanda a auditoria para outras áreas somente quando houver evidência de
   dependência estrutural, contrato compartilhado, persistência, navegação ou
   impacto de plataforma.

Não faça uma análise completa do projeto por padrão. O tamanho da auditoria
deve acompanhar o risco e o alcance da tarefa.

Exemplos de escopo:

- Bug visual em um card: audite a tela, o componente compartilhado, os tokens
  e os componentes nativos envolvidos; não mapeie o Firestore inteiro.
- Bug financeiro: audite o cálculo, o domínio de entrega, o datasource/cache e
  os consumidores relevantes.
- Bug de navegação: audite os layouts, stacks e rotas envolvidas.
- Mudança estrutural ou nativa: amplie a auditoria arquitetural para todos os
  navegadores, contratos e superfícies diretamente afetados.

## Código é fonte da verdade

- A documentação fornece contexto e decisões, mas Git e código atual são a
  fonte da verdade operacional.
- Se houver divergência entre documentação e checkout, informe a divergência
  antes de implementar e use o código/Git atual como referência.
- Não trate uma seção histórica de `docs/current-state.md` como estado atual
  apenas porque ela aparece mais adiante no arquivo.

## Root cause first

- Identifique a causa raiz antes de alterar o código.
- Não aplique workaround visual quando a causa for estrutural.
- Não esconda problemas com delay, zIndex, timeout ou estado duplicado sem
  justificativa técnica comprovada.

## Escopo mínimo

- Altere somente os arquivos necessários para a tarefa.
- Não aproveite a tarefa para limpar, refatorar ou redesenhar código não
  relacionado.
- Preserve alterações locais preexistentes e resolva conflitos por trechos,
  sem sobrescrever trabalho fora do escopo.

## Git

- Nunca faça commit ou push automaticamente; execute-os somente quando o
  usuário pedir explicitamente.
- Antes de um commit autorizado, liste exatamente os arquivos que entrarão e
  revise o diff staged.
- Não faça reset, squash ou revert de histórico publicado sem pedido explícito.
- Preserve alterações locais não relacionadas.

## Native iOS

Preserve a preferência do projeto por APIs nativas e oficiais:

- Expo SDK 57;
- `@expo/ui` / SwiftUI;
- Native Stack e NativeTabs;
- SF Symbols;
- Liquid Glass;
- APIs oficiais da Apple;
- módulo nativo local somente quando realmente necessário.

Evite imitações em React Native quando existir uma implementação nativa
oficial compatível e preserve a interação, o layout intrínseco e as animações
nativas existentes.

## Development Build

Sempre diferencie o tipo de mudança:

- TS/TSX/JS normalmente pode ser validado com Metro/Fast Refresh;
- Swift, config plugin, Info.plist, capabilities ou módulo nativo exigem nova
  Development Build;
- informe explicitamente ao final se uma nova build é necessária.

Não execute prebuild ou compile sem autorização explícita da tarefa.

## Processo antes da implementação

Depois da auditoria proporcional, registre de forma objetiva, antes de editar
quando a tarefa envolver código:

- causa raiz e evidências;
- abordagem escolhida;
- arquivos que serão alterados;
- possíveis impactos e validações.

Durante a implementação:

- reutilize componentes existentes;
- preserve padrões arquiteturais;
- evite duplicação;
- preserve compatibilidade com Android, Web e Expo Go;
- prefira soluções nativas para iOS quando disponíveis.

Após implementar:

- verifique TypeScript;
- verifique ESLint direcionado;
- execute testes relacionados;
- execute `git diff --check`;
- revise possíveis regressões e o Git status.

## Resultado da tarefa

O encerramento deve ser curto e informar:

- causa raiz;
- arquivos alterados;
- comportamento antes/depois;
- validações executadas;
- se exige nova Development Build;
- Git status;
- sem sugestões extras não solicitadas.

# Orientação Geral para Agentes de IA

Em toda nova tarefa:

1. Leia este documento por completo.
2. Consulte o Snapshot operacional atual antes do histórico detalhado.
3. Verifique o Git e localize a funcionalidade.
4. Faça auditoria proporcional ao escopo e amplie somente com evidência.
5. Encontre a causa raiz, respeite os padrões existentes e só então proponha
   ou implemente alterações.

Nunca assuma a arquitetura do projeto sem verificar o código e as
dependências diretamente envolvidas.

O histórico de features pertence a `docs/current-state.md`; este documento
define regras de trabalho e não deve se transformar em um diário de
implementações.
