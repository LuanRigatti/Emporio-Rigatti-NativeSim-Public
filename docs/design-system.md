# Design System

Status: fundação RN consolidada e congelada após a Etapa 18D.

Este documento é o contrato público da camada visual do aplicativo. A fundação RN consolidada na Etapa 18D continua congelada: novas telas devem compor as abstrações existentes, e a criação de um novo componente visual genérico, token ou variação pública exige uma nova decisão arquitetural antes da implementação. As camadas `native`, `premium` e demais abstrações reutilizáveis já existentes também fazem parte do sistema visual aceito. Evoluções nativas baseadas em APIs oficiais da Apple ou do Expo são permitidas quando forem auditadas e reutilizáveis.

## Objetivo do Design System

Oferecer uma linguagem visual única, acessível e consistente, com sensação próxima de um aplicativo iOS moderno, preservando a identidade do aplicativo original. A camada visual não conhece Firebase, repositories, autenticação, regras financeiras ou regras de negócio.

## Estrutura de pastas

```text
src/components/
├── buttons/       # ações primárias e secundárias
├── cards/         # agrupamentos de informação
├── feedback/      # carregamento, estados, status e mensagens
├── forms/         # entrada e seleção de dados
├── layout/        # telas, cabeçalhos, seções e espaçamento
├── lists/         # itens, listas agrupadas e gestos
├── native/        # controles nativos e adaptadores com fallback
├── overlays/      # modal, sheet, confirmação e ações
├── premium/       # composições visuais e materiais reutilizáveis
├── routes/         # mapas e componentes visuais de rotas
├── typography/    # AppText e variantes tipográficas
├── types.ts       # tipos compartilhados da API visual
└── index.ts       # barrel público canônico

src/theme/
├── ThemeProvider.tsx  # preferência e tema resolvido
├── useAppTheme.ts     # acesso aos tokens em componentes
├── lightTheme.ts      # composição do tema claro
├── darkTheme.ts       # composição do tema escuro
└── *.ts               # tokens semânticos
```

O import público preferencial é `@/components`. Os sub-barrels oficiais `@/components/native`, `@/components/premium`, `@/components/layout` e `@/components/routes` também são entradas válidas para abstrações especializadas existentes. `@/theme` é a entrada dos tokens e do tema. A pasta `src/navigation` contém os navegadores do aplicativo e não é uma segunda API de componentes visuais.

## Organização

- Componentes recebem dados e ações por props.
- Componentes utilizam `useAppTheme()` e nunca definem cores, fontes, espaçamentos, radius ou sombras de produto localmente.
- A lógica de negócio pertence a features, hooks, services e repositories.
- Os componentes podem conter apenas comportamento visual, acessibilidade, interação de apresentação e estados de UI.
- `PaymentMethodSelector` é o seletor visual específico para quitação e aceita
  somente `Dinheiro` e `Pix`. Isso não define os métodos do pagamento de
  `RetailOrder`, que usa seu próprio fluxo e suporta `Pix`, `Dinheiro`,
  `Crédito`, `Débito` e `Outro`.
- Valores ocultos continuam ocupando espaço por meio dos tokens de layout; ocultação não altera dados.
- Componentes RN podem usar os providers de ícones atuais (`@expo/vector-icons` ou `theme.icons`). Controles nativos iOS devem preferir SF Symbols quando apropriado. Emojis e caracteres Unicode não são ícones de navegação.

## Camadas visuais atuais

O sistema visual atual é composto por três camadas complementares:

1. Componentes RN tradicionais, organizados nas categorias canônicas deste documento.
2. Componentes RN com materiais e efeitos, como superfícies Liquid Glass, blur e fallbacks de plataforma.
3. Controles nativos SwiftUI/UIKit via `@expo/ui`, Expo Router/Stack Toolbar ou módulos nativos locais.

Todas as camadas recebem dados e ações da funcionalidade, mas não contêm regras de negócio. Controles nativos devem preservar comportamento, sizing intrínseco, interação e animações nativas sempre que possível. Não recriar em RN um comportamento que já possui implementação nativa oficial adequada.

## Componentes disponíveis

Os exemplos abaixo omitem imports para manter o catálogo legível. Todos os componentes devem estar sob `ThemeProvider`.

### Botões

Todos os botões de texto (`PrimaryButton`, `SecondaryButton`, `DestructiveButton` e `TextButton`) compartilham as props: `children` ou `label`, `onPress`, `disabled`, `loading`, `icon`, `fullWidth`, `size` (`small | medium | large`), `style`, `accessibilityLabel` e `accessibilityHint`. `loading` também desabilita a ação.

| Componente             | Finalidade e exemplo                                                                                       | Estados                             | Usar / não usar                                                                                       |
| ---------------------- | ---------------------------------------------------------------------------------------------------------- | ----------------------------------- | ----------------------------------------------------------------------------------------------------- |
| `PrimaryButton`        | Ação principal: `<PrimaryButton onPress={save}>Salvar</PrimaryButton>`                                     | default, pressed, disabled, loading | Usar para concluir o fluxo principal. Não usar para ações destrutivas ou ações secundárias repetidas. |
| `SecondaryButton`      | Ação alternativa: `<SecondaryButton onPress={cancel}>Cancelar</SecondaryButton>`                           | default, pressed, disabled, loading | Usar para cancelar ou alternativa. Não usar como destaque principal.                                  |
| `DestructiveButton`    | Ação irreversível: `<DestructiveButton onPress={remove}>Excluir</DestructiveButton>`                       | default, pressed, disabled, loading | Usar somente após confirmação quando houver perda ou risco. Não usar para erros comuns.               |
| `TextButton`           | Ação discreta: `<TextButton onPress={open}>Ver detalhes</TextButton>`                                      | default, pressed, disabled, loading | Usar em ações auxiliares. Não usar quando a ação exigir forte destaque.                               |
| `IconButton`           | Ação compacta com `icon` obrigatório: `<IconButton accessibilityLabel="Buscar" icon={<Ionicons ... />} />` | default, pressed, disabled, loading | Usar quando o ícone for inequívoco e sempre fornecer label. Não usar ícone sem acessibilidade.        |
| `FloatingActionButton` | Ação contextual flutuante; aceita as props de `IconButton` e `label` opcional                              | default, pressed, disabled, loading | Usar para uma ação primária contextual. Não usar para ações destrutivas ou várias ações concorrentes. |

### Layout

| Componente         | Props                                                                                                | Estados / exemplo                                | Usar / não usar                                                                                                                                   |
| ------------------ | ---------------------------------------------------------------------------------------------------- | ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Screen`           | `children`, `style`                                                                                  | layout base seguro: `<Screen>{content}</Screen>` | Usar em telas sem rolagem. Não duplicar `SafeAreaView`.                                                                                           |
| `ScrollScreen`     | `children`, `style`, `contentContainerStyle`, `refreshing`, `onRefresh`, `keyboardShouldPersistTaps` | rolagem e pull-to-refresh                        | Usar para listas e conteúdo vertical. Não usar para formulários que precisam de comportamento de teclado específico sem avaliar `KeyboardScreen`. |
| `KeyboardScreen`   | `children`, `style`, `keyboardVerticalOffset`                                                        | teclado com `KeyboardAvoidingView`               | Usar em formulários. Não colocar regras de validação dentro dele.                                                                                 |
| `AppHeader`        | `title`, `subtitle?`, `onBack?`, `leftAction?`, `rightAction?`, `style?`, `titleStyle?`              | header compacto, botão voltar                    | Usar em stacks internas. Não usar para título grande de tela principal.                                                                           |
| `LargeTitleHeader` | props de `AppHeader`                                                                                 | título grande e ações superiores                 | Usar no início de módulos principais. Não empilhar outro título visual redundante.                                                                |
| `Section`          | `children`, `title?`, `style?`                                                                       | agrupamento com espaçamento de seção             | Usar para separar grupos relacionados. Não usar para resolver espaçamento isolado.                                                                |
| `SectionHeader`    | `title`, `description?`, `actionLabel?`, `onActionPress?`, `style?`                                  | título, descrição e ação                         | Usar no topo de seções. Não colocar regras de negócio no componente.                                                                              |
| `Divider`          | `inset?`, `orientation?` (`horizontal                                                                | vertical`)                                       | separador horizontal ou vertical                                                                                                                  | Usar para separar itens. Não usar bordas locais repetidas. |
| `Spacer`           | `size?` com chave de `spacing`                                                                       | espaço tokenizado                                | Usar somente quando composição não for suficiente. Não usar números arbitrários.                                                                  |

### Tipografia

`AppText` aceita todas as props nativas de `Text`, exceto `style` tipado como `TextComponentStyle`, e `variant?`: `largeTitle`, `title1`, `title2`, `title3`, `headline`, `body`, `callout`, `subheadline`, `footnote`, `caption`, `metricLarge`, `metricMedium` e `currency`.

Exemplo: `<AppText variant="headline">Receita</AppText>`.

Usar `AppText` para textos novos, permitir font scaling e escolher a menor variante que preserve a hierarquia. Não definir `fontSize`, `fontFamily` ou `fontWeight` diretamente em telas.

### Cards

| Componente      | Props                                                                                                                                                 | Estados / exemplo                                                                         | Usar / não usar                                                                                          |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| `Card`          | `children`, `onPress?`, `disabled?`, `elevated?`, `style?`                                                                                            | estático, pressionado, desabilitado                                                       | Usar para agrupar conteúdo relacionado. Não transformar toda linha simples em card.                      |
| `MetricCard`    | `label`, `value`, `subtitle?`, `comparison?`, `trend?`, `trendLabel?`, `hidden?`, `loading?`, `icon?`, `onPress?`, `style?`                           | valor, loading, tendência, oculto                                                         | Usar para indicadores. Não recalcular métricas dentro dele.                                              |
| `FinanceCard`   | mesmas props de `MetricCard`                                                                                                                          | valor financeiro, loading, tendência, oculto                                              | Usar para receitas, custos e saldos já calculados. Não acessar Firebase nem formatar regras financeiras. |
| `DeliveryCard`  | `clientName`, `dateLabel`, `quantityLabel`, `totalLabel`, `status`, `delivered`, `onPress?`, `onPrimaryAction?`, `hiddenValue?`, `loading?`, `style?` | status, entregue/pendente, loading, valor oculto                                          | Usar no resumo de entregas. Não marcar entrega nem calcular total internamente.                          |
| `ClientCard`    | `name`, `address?`, `secondaryText?`, `avatar?`, `onPress?`, `loading?`, `style?`                                                                     | loading, estático, pressionado                                                            | Usar em listas de clientes. Não editar ou excluir diretamente no card.                                   |
| `PaymentCard`   | `clientName`, `deliveryLabel?`, `amountLabel`, `dateLabel?`, `status` (`Pago                                                                          | Não Pago`), `methodLabel?`, `hiddenValue?`, `onPress?`, `onSettle?`, `loading?`, `style?` | pago/não pago, loading, oculto                                                                           | Usar para apresentar pagamento já calculado. Não escolher fallback Pix nem quitar sem fluxo explícito. |
| `RouteStopCard` | `order`, `clientName`, `address`, `distanceLabel?`, `durationLabel?`, `status`, `onPress?`, `loading?`, `style?`                                      | status, loading, pressionado                                                              | Usar para uma parada de rota. Não geocodificar nem inventar coordenadas.                                 |

### Listas

| Componente           | Props                                                                                                                         | Estados / exemplo                       | Usar / não usar                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `ListItem`           | `title`, `subtitle?`, `leading?`, `trailing?`, `onPress?`, `disabled?`, `style?`, `accessibilityLabel?`, `accessibilityHint?` | estático, pressed, disabled             | Usar para informação ou ação simples. Não colocar conteúdo financeiro complexo em `trailing`.             |
| `SelectableListItem` | props de `ListItem` sem `onPress`, mais `selected`, `onSelect`                                                                | selecionado/não selecionado             | Usar em seleção múltipla ou escolha de item. Não controlar seleção internamente.                          |
| `SwipeAction`        | `label`, `onPress`, `tone?` (`primary                                                                                         | danger`), `icon?`                       | pressed, primary/danger                                                                                   | Usar como ação lateral em `SwipeableListItem`. Não usar para operação irreversível sem confirmação. |
| `SwipeableListItem`  | `children`, `leftActions?`, `rightActions?`, `onSwipe?`, `style?`                                                             | arraste esquerda/direita, Reduce Motion | Usar em listas onde a ação lateral é descoberta. Não esconder a única forma de executar uma ação crítica. |
| `GroupedList`        | `sections`: `{ key, title?, items }[]`, `style?`                                                                              | grupos com título opcional              | Usar quando a divisão por grupos melhorar a leitura. Não misturar dados de domínios sem seção clara.      |
| `ListSeparator`      | `inset?`                                                                                                                      | separador tokenizado                    | Usar entre itens. Não usar `View` com borda manual.                                                       |

### Formulários

| Componente              | Props principais                                                                                                                                                            | Estados / exemplo                           | Usar / não usar                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------- | -------------------------------------------------------------------------------------- |
| `Input`                 | props nativas de `TextInput`, mais `value`, `onChangeText`, `label?`, `helperText?`, `error?`, `required?`, `disabled?`, `clearable?`, `onClear?`, `style?`, acessibilidade | foco, erro, helper, disabled, clearable     | Usar para texto. Não implementar validação de domínio dentro dele.                     |
| `CurrencyInput`         | props de `Input`, com teclado monetário controlado pelo componente                                                                                                          | foco, erro, loading externo                 | Usar para entrada de valor. Não calcular preço, saldo ou total.                        |
| `QuantityInput`         | props de `Input`, com teclado numérico                                                                                                                                      | foco, erro, disabled                        | Usar para quantidade. Não impor unidade ou regra de baldes.                            |
| `DateInput`             | `label?`, `value?`, `placeholder?`, `onPress?`, `onClear?`, `iconName?`, `helperText?`, `error?`, `required?`, `disabled?`, `style?`, acessibilidade                        | vazio, preenchido, erro, disabled           | Usar para selecionar data. Não converter datas de negócio.                             |
| `TimeInput`             | mesmas props de `DateInput`, com ícone e placeholder de horário                                                                                                             | vazio, preenchido, erro                     | Usar para horário. Não aplicar regras de rota.                                         |
| `SearchBar`             | props de `Input` sem `label`/`keyboardType`, mais `onSubmitEditing?`                                                                                                        | vazio, digitando, clearable                 | Usar para busca. Não filtrar dados dentro do componente.                               |
| `FilterBar`             | `filters`: `{ key, label, active? }[]`, `onPress?`, `onRemove?`, `style?`                                                                                                   | filtros ativos/removíveis                   | Usar para representar filtros já definidos. Não ordenar ou buscar dados.               |
| `SegmentedControl<T>`   | `options`: `{ value, label }[]`, `value`, `onChange`, `disabled?`, `style?`                                                                                                 | selecionado, não selecionado, disabled      | Usar para poucas opções mutuamente exclusivas. Não usar para listas longas.            |
| `ClientSelector`        | `label?`, `value?`, `placeholder?`, `onPress?`, `onClear?`, `helperText?`, `error?`, `required?`, `disabled?`, `style?`, acessibilidade                                     | vazio, selecionado, erro, disabled          | Usar para abrir uma seleção de cliente. Não carregar clientes diretamente.             |
| `PaymentMethodSelector` | `value?`, `onChange`, `label?`, `helperText?`, `error?`, `required?`, `disabled?`, `style?`, acessibilidade                                                                 | Dinheiro/Pix, selecionado, erro, disabled   | Usar exclusivamente para quitação. Não selecionar Pix automaticamente. Não usar como contrato dos métodos de `RetailOrder`. |
| `StatusSelector`        | `value?`, `options?`, `onChange`, `label?`, `helperText?`, `error?`, `required?`, `disabled?`, `style?`                                                                     | seis status públicos, selecionado, disabled | Usar quando o fluxo permitir editar status. Não inventar novos status sem decisão.     |
| `SwitchField`           | `label?`, `helperText?`, `value`, `onValueChange`, `disabled?`, `style?`, acessibilidade                                                                                    | on/off, disabled                            | Usar para preferência binária. Não usar para ação destrutiva.                          |
| `FormField`             | props de campo (`label?`, `helperText?`, `error?`, `required?`, `disabled?`), `children`, `style?`                                                                          | erro/helper/required                        | Usar para agrupar controles que não possuem seu próprio label. Não duplicar mensagens. |
| `FormError`             | `message?`, `style?`                                                                                                                                                        | visível/ausente                             | Usar para erro inline isolado. Não exibir stack trace ao usuário.                      |

### Feedback

| Componente       | Props                                                                        | Estados / exemplo                                     | Usar / não usar                                                                   |
| ---------------- | ---------------------------------------------------------------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------- |
| `Avatar`         | `name`, `imageUri?`, `size?` (`small                                         | medium                                                | large`), `style?`                                                                 | imagem ou iniciais | Usar para identificar cliente/conta. Não colocar informação sensível nas iniciais. |
| `Loading`        | `size?`, `label?`, `tone?`, `style?`                                         | progresso indeterminado                               | Usar em ação ou região pequena. Não bloquear a tela inteira sem `LoadingOverlay`. |
| `LoadingOverlay` | `visible`, props de `Loading`                                                | visível/oculto                                        | Usar quando uma operação bloquear a tela. Não ocultar indefinidamente.            |
| `Skeleton`       | `width?`, `height?`, `radius?`, `animated?`, `style?`                        | animado ou reduzido por Reduce Motion                 | Usar para preservar layout durante carregamento. Não usar como conteúdo real.     |
| `EmptyState`     | `title`, `description?`, `icon?`, `actionLabel?`, `onActionPress?`, `style?` | vazio com ação opcional                               | Usar quando não há registros. Não usar para erro de rede.                         |
| `ErrorState`     | props de `EmptyState` sem ação, mais `retryLabel?`, `onRetry?`               | falha recuperável                                     | Usar para erro recuperável. Não apagar dados automaticamente.                     |
| `InlineError`    | `message?`, `style?`                                                         | visível/ausente                                       | Usar junto ao campo ou região relacionada. Não usar como toast global.            |
| `Toast`          | `visible`, `message`, `tone?`, `duration?`, `onDismiss?`, acessibilidade     | visível, timeout, dismiss                             | Usar para confirmação breve. Não usar para erro que exige leitura ou ação.        |
| `Badge`          | `label`, `tone?` (`success                                                   | warning                                               | danger                                                                            | info               | neutral`), `icon?`, `style?`                                                       | tone e ícone opcionais | Usar para metadado curto. Não colocar frases longas. |
| `StatusChip`     | `status`, `label?`, `style?`                                                 | Pago, Não Pago, Entregue, Pendente, Emitido, A emitir | Usar para status conhecidos. Não depender somente da cor.                         |
| `ProgressBar`    | `progress?` (0–1), `label?`, `indeterminate?`, `tone?`, `style?`             | determinado/indeterminado                             | Usar para progresso mensurável. Não apresentar porcentagem inventada.             |

### Sobreposições

| Componente           | Props                                                                                                                              | Estados / exemplo                       | Usar / não usar                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------ |
| `AppModal`           | `visible`, `title?`, `onRequestClose`, `onDismiss?`, `children`, `footer?`, `style?`, acessibilidade                               | aberto/fechado, fechar, modal acessível | Usar para conteúdo focado. Não aninhar modais sem necessidade.                             |
| `BottomSheet`        | `visible`, `title?`, `onClose`, `children`, `footer?`, `style?`, acessibilidade                                                    | aberto/fechado, arraste, Reduce Motion  | Usar para ações contextuais e seleção. Não colocar fluxo longo de formulário.              |
| `ConfirmationDialog` | `visible`, `title`, `message`, `confirmLabel`, `cancelLabel?`, `destructive?`, `loading?`, `onConfirm`, `onCancel`, acessibilidade | confirmação, loading, destrutivo        | Usar antes de excluir, renomear ou operação irreversível. Não usar para toda ação simples. |
| `ActionSheet`        | `visible`, `title?`, `options`: `{ key, label, onPress, destructive?, disabled?, icon? }[]`, `onClose`, acessibilidade             | aberto, opção disabled/destructive      | Usar para poucas ações relacionadas. Não colocar regras de negócio no componente.          |

### Componentes nativos e premium

As seguintes abstrações já existentes e reutilizadas fazem parte do sistema visual atual. A lista registra responsabilidades e pontos de composição, sem substituir os tipos públicos de cada módulo.

**Controles nativos e adaptadores:** `NativeButton`, `NativeToggle`, `NativeDropdown`, `NativePicker`, `NativeDatePicker`, `NativeBottomSheet`, `NativeSheet`, `NativeDialog`, `NativeSearchField`, `NativeAnimatedNumber`, `NativeCardContextMenu`, `NativeGlassHeader`, `NativeGlassBackButton`, `NativeGlassMenu`, `NativeDateToolbar`, `NativePeriodActionGroup`, `NativeTrackingStatusButton` e `NativeSwipeActionsList`.

**Composições premium:** `PremiumCard`, `PremiumScreen`, `PremiumSection`, `PremiumMetric`, `SummaryCard`, `GlassSurface`, `GlassCard`, `GlassButton`, `GlassHeader`, `GlassSegmentedControl` e `GlassTabBar`.

**Infraestrutura visual e mapas:** `ProgressiveBlur`, `NativeRouteMap` e `NativeTrackedRouteMap`.

Essas abstrações devem ser reutilizadas antes da criação de uma composição específica de tela. Implementações nativas podem ter fallback seguro para Android, Web, Expo Go ou quando uma capability do dispositivo estiver indisponível.

## Tokens e temas

### Cores

Os componentes acessam cores somente por `theme.colors`. Os tokens semânticos são `background`, `backgroundSecondary`, `surface`, `surfaceElevated`, `surfaceMuted`, `textPrimary`, `textSecondary`, `textTertiary`, `textInverse`, `textDisabled`, `separator`, `borderStrong`, `focus`, `primary`, `primaryPressed`, `secondary`, `brand`, `brandStrong`, `success`, `warning`, `danger`, `info`, `paid`, `unpaid`, `delivered`, `pending`, `revenue`, `profit`, `expense` e `overlay`, com valores próprios para tema claro e escuro. As semânticas atuais também incluem `contrastSurface`, `contrastContent`, `selectionSurface`, `selectionContent`, `successSurface`, `warningSurface`, `dangerSurface`, `infoSurface`, `glassSurface` e `glassBorder`.

Não expor nomes de paleta como `blue500` para telas. Contraste, status e significado devem continuar semânticos e não depender apenas da cor.

Materiais Liquid Glass e tint devem usar os tokens e helpers compartilhados, incluindo `getLiquidGlassTint`, `getSearchBarLiquidGlassTint`, `lightModeLiquidGlassTint`, `darkModeLiquidGlassTint` e as opacidades correspondentes. Não duplicar cores ou opacidades localmente.

### Tipografia

As fontes são do sistema e suportam escalonamento. A escala pública é `largeTitle`, `title1`, `title2`, `title3`, `headline`, `body`, `callout`, `subheadline`, `footnote`, `caption`, `metricLarge`, `metricMedium` e `currency`. Use `AppText` ou `theme.typography` em componentes compostos.

### Espaçamento, radius e tamanhos

Use `theme.spacing` (`xxs`, `xs`, `sm`, `md`, `lg`, `xl`, `xxl`, `xxxl`, `screenLarge`, `screen`, `section`, `formGroup`, `safeAreaMinimum`), `theme.radius` (`sm`, `md`, `lg`, `card`, `xl`, `pill`) e `theme.sizes` para toque mínimo, campos, botões, tabs, ícones, avatares, skeleton e valores ocultos. O alvo mínimo de toque é `44` pontos.

### Sombras e bordas

Use `theme.shadows.none`, `theme.shadows.card` e `theme.shadows.elevated`. A implementação adapta-se a iOS/Android e Web. Use `theme.borders` para hairline, espessuras e foco. Não declarar `shadow*`, `elevation`, `borderRadius` ou bordas de produto em telas.

### Animações e feedback

Use `theme.animations.duration`, `easing`, `spring`, `scale` e `reducedMotion`. `ThemeProvider` observa Reduce Motion. Ações de toque relevantes usam `src/utils/haptics.ts` e são silenciosas no Web.

## Acessibilidade

- Forneça `accessibilityLabel` para ícones e ações sem texto.
- Use `accessibilityHint` quando o resultado da ação não for óbvio.
- Preserve `allowFontScaling` e não dependa apenas de cor.
- Mantenha alvos de toque de pelo menos 44 pontos.
- Use `accessibilityRole`, estados de seleção, busy, disabled e progress quando aplicável.
- Use `EmptyState`, `ErrorState`, `InlineError`, `Loading` e `Toast` com mensagens claras.
- Respeite Reduce Motion e mantenha o conteúdo compreensível no tema escuro.
- Não revele valores financeiros ocultos em labels ou acessibilidade.

## Auditoria e relatório de congelamento

### Componentes criados e mantidos

O catálogo público consolidado é composto por:

- 6 componentes de botões;
- 9 componentes de layout;
- 7 componentes de cards;
- 6 componentes de listas;
- 14 componentes de formulários;
- 11 componentes de feedback;
- 4 componentes de sobreposição;
- 1 componente de tipografia (`AppText`).

Não foram criados componentes novos na Etapa 18D. O objetivo foi transformar a implementação existente em contrato público e registrar seus limites.

### Componentes reutilizáveis

Todos os componentes exportados por `src/components/index.ts` são reutilizáveis. As composições internas mais importantes são:

- `MetricCard` e `FinanceCard` usam a mesma base visual de valor;
- `DeliveryCard`, `PaymentCard` e `RouteStopCard` usam `Card` e `StatusChip`;
- `ErrorState` usa `EmptyState`;
- `LoadingOverlay` usa `Loading`;
- `TimeInput` usa `DateInput`;
- `FormError` usa `InlineError`;
- `ConfirmationDialog` usa `AppModal` e botões sem duplicar estilos.

Essas composições preservam nomes semânticos para a API das telas, mesmo quando compartilham implementação.

### Candidatos à remoção

- `src/components/navigation/index.ts`: removido na Etapa 18D por duplicar `AppHeader` e `LargeTitleHeader` de `layout` e não possuir componente próprio.
- `src/components/Charts/index.tsx`: exporta `FinancialSeriesChart`, componente compartilhado para séries financeiras; sua API e seus tokens devem permanecer coerentes com o contrato visual antes de novas variações.
- Componentes legados nas pastas `Button`, `Card`, `Header`, `Input`, `Loading`, `Modal`, `SearchBar`, `BottomNavigation` e `EmptyState`: já removidos anteriormente por duplicarem a API canônica.

### Candidatos à fusão

- `MetricCard` e `FinanceCard`: compartilham a base `ValueCard`; permanecem como aliases semânticos para evitar que telas financeiras percam clareza.
- `FormError` e `InlineError`: compartilham implementação; `FormError` permanece como nome de composição para formulários.
- `DateInput` e `TimeInput`: compartilham implementação; permanecem separados porque representam dados diferentes e têm acessibilidade/placeholder distintos.
- `EmptyState` e `ErrorState`: compartilham estrutura; permanecem separados porque vazio e falha têm semânticas e ações diferentes.

Nenhum desses candidatos deve ser fundido ou removido sem avaliar imports públicos e sem uma mudança de API explícita.

### Resultado

A fundação RN do Design System está congelada. Telas novas devem reutilizar `@/components`, seus sub-barrels oficiais, as camadas `native`/`premium`/`routes` existentes e `@/theme`; não devem criar abstrações genéricas quando uma composição existente resolve o caso. Se uma composição existente não atender ao caso, a lacuna deve ser documentada e uma evolução da API pública exige necessidade comprovada e decisão arquitetural. APIs nativas oficiais Apple/Expo podem justificar evolução controlada da camada `native`, desde que preservem fallback, comportamento nativo e reutilização.
