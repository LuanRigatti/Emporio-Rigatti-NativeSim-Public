# Plano do Design System — React Native

Status: proposta aguardando aprovação.  
Escopo: fundações visuais, componentes, estados e padrões de interação. Nenhum componente foi implementado.

## 1. Objetivo e princípios

O Design System deve levar o aplicativo de vendas e faturamento para uma experiência premium, moderna e nativa, preservando a identidade do projeto original:

- acento mint claro do produto;
- cards com sensação de profundidade;
- destaque para valores financeiros;
- modo claro/escuro;
- leitura rápida de entregas, clientes e indicadores;
- filtros e ações rápidas.

A evolução visual não deve copiar uma aplicação específica da Apple. Deve adotar padrões de plataforma: hierarquia clara, tipografia System, navegação previsível, controles acessíveis, modais contextuais, feedback explícito e adaptação ao sistema.

Princípios:

1. Conteúdo e tarefa vêm antes da decoração.
2. O sistema deve parecer nativo sem apagar a identidade mint do produto.
3. Dados financeiros devem ter hierarquia, legibilidade e proteção visual.
4. Toda ação importante deve produzir feedback visível e acessível.
5. Cor, ícone, texto e haptics nunca devem ser a única forma de comunicar estado.
6. Componentes visuais não calculam, não acessam Firebase e não decidem regras de negócio.
7. Um componente deve ter a mesma semântica em Início, Entregas, Clientes, Financeiro e Mais.

## 2. Referências de plataforma

As decisões seguem as [Human Interface Guidelines da Apple](https://developer.apple.com/design/human-interface-guidelines/), especialmente:

- [Design principles](https://developer.apple.com/design/human-interface-guidelines/design-principles): clareza, consistência e feedback;
- [Color](https://developer.apple.com/design/human-interface-guidelines/color): uso semântico e consistente de cor;
- [Dark Mode](https://developer.apple.com/design/human-interface-guidelines/dark-mode): paletas adaptativas, fundos base/elevated e legibilidade;
- [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility): Dynamic Type, contraste e alvos de toque;
- [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons): papéis, estados e títulos claros;
- [Sheets](https://developer.apple.com/design/human-interface-guidelines/sheets) e [Action sheets](https://developer.apple.com/design/human-interface-guidelines/action-sheets): tarefas contextuais e escolha de ações;
- [Alerts](https://developer.apple.com/design/human-interface-guidelines/alerts): interrupções somente quando necessárias;
- [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback): feedback contextual e multimodal;
- [Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics): haptics curtos e semanticamente consistentes;
- [Motion](https://developer.apple.com/design/human-interface-guidelines/motion): movimento com propósito e respeito a Reduce Motion;
- [Search fields](https://developer.apple.com/design/human-interface-guidelines/search-fields) e [Tab bars](https://developer.apple.com/design/human-interface-guidelines/tab-bars): busca contextual e tabs para navegação.

Regra de contraste do plano: validar no mínimo 4,5:1 para texto normal, 3:1 para texto grande ou bold e buscar 7:1 para textos pequenos e dados críticos.

## 3. Direção visual

### 3.1 Identidade

O mint permanece como assinatura do produto, usado em superfícies de ação, destaques positivos, seleção e detalhes de marca. Não será usado como texto pequeno sobre branco sem validação de contraste.

O azul permanece como cor de ação/foco e acessibilidade, especialmente para links, foco de campo e ações não financeiras. Verde, vermelho e amarelo permanecem semânticos, nunca apenas decorativos.

### 3.2 Profundidade

- usar superfícies agrupadas e cards de baixa elevação;
- reservar translucência para header, tab bar e sheets;
- usar cards opacos em tabelas, formulários e valores financeiros;
- manter sombras discretas e bordas sutis;
- evitar excesso de blur, gradientes e efeitos 3D que prejudiquem contraste ou desempenho;
- em Dark Mode, usar níveis de fundo diferentes para base e conteúdo elevado, sem inverter mecanicamente a paleta clara.

### 3.3 Densidade

- Dashboard: densidade média, com dois ou três níveis de destaque.
- Listas de entregas e clientes: densidade confortável, uma ação principal por linha.
- Financeiro: densidade informacional maior, compensada por grupos e espaçamento.
- Formulários: uma tarefa por tela/modal, campos agrupados por contexto.
- Mapas: controles sobrepostos somente quando não cobrirem marcadores ou etapas.

## 4. Tokens de cor

Os tokens devem ser semânticos. Componentes não devem usar hex diretamente.

### 4.1 Tema claro

| Token | Valor | Uso |
|---|---|---|
| `background.canvas` | `#F7F8FA` | Fundo geral agrupado. |
| `background.surface` | `#FFFFFF` | Cards e listas. |
| `background.elevated` | `#FFFFFF` | Modal, sheet e conteúdo elevado. |
| `background.muted` | `#EEF2F7` | Campos, skeleton e áreas auxiliares. |
| `text.primary` | `#111827` | Títulos e valores principais. |
| `text.secondary` | `#4B5563` | Descrições e valores secundários. |
| `text.tertiary` | `#6B7280` | Metadados e placeholders. |
| `text.inverse` | `#FFFFFF` | Texto em ação escura. |
| `border.subtle` | `#E5E7EB` | Separadores e contornos leves. |
| `border.strong` | `#D1D5DB` | Controles e divisões importantes. |
| `brand.primary` | `#CFEDE3` | Assinatura mint e ação primária clara. |
| `brand.strong` | `#76BFAE` | Mint para estados selecionados e gráficos. |
| `action.primary` | `#0A84FF` | Ação, link, foco e navegação. |
| `feedback.positive` | `#34C759` | Pago, concluído e sucesso. |
| `feedback.warning` | `#FF9F0A` | Atenção, pendência e ação incompleta. |
| `feedback.negative` | `#FF3B30` | Erro, aberto crítico e destruição. |
| `feedback.info` | `#0A84FF` | Informação e estado neutro. |
| `finance.income` | `#168A5B` | Receita e entradas. |
| `finance.expense` | `#C53B36` | Despesas e saídas. |

### 4.2 Tema escuro

| Token | Valor | Uso |
|---|---|---|
| `background.canvas` | `#0B0F14` | Fundo base. |
| `background.surface` | `#161B22` | Cards e listas. |
| `background.elevated` | `#20262F` | Modal, sheet e superfícies elevadas. |
| `background.muted` | `#11161D` | Campos e skeleton. |
| `text.primary` | `#F5F7FA` | Títulos e valores principais. |
| `text.secondary` | `#B8C0CC` | Descrições e valores secundários. |
| `text.tertiary` | `#8E98A8` | Metadados e placeholders. |
| `text.inverse` | `#111827` | Texto sobre mint ou branco. |
| `border.subtle` | `#2A313B` | Separadores leves. |
| `border.strong` | `#3A4350` | Controles e divisões. |
| `brand.primary` | `#CFEDE3` | Mint de marca e destaque. |
| `brand.strong` | `#9DDBC9` | Mint com maior presença. |
| `action.primary` | `#64B5FF` | Ação e foco em fundo escuro. |
| `feedback.positive` | `#30D158` | Sucesso e concluído. |
| `feedback.warning` | `#FFB340` | Atenção. |
| `feedback.negative` | `#FF6961` | Erro e destruição. |
| `feedback.info` | `#64B5FF` | Informação. |
| `finance.income` | `#63D39B` | Receita. |
| `finance.expense` | `#FF817A` | Despesa. |

Os pares precisam ser verificados com Increase Contrast, Bold Text e Dark Mode. Cor não pode ser o único indicador de `Pago`, `Não Pago`, `entregue`, erro ou sucesso.

## 5. Tipografia

Usar a família `System` já prevista no projeto atual, com Dynamic Type e layout que aceite aumento de fonte. A fonte Nunito do PWA original não será usada como fonte principal no React Native; a personalidade será preservada por cor, raio, cards e composição.

| Estilo | Tamanho/linha | Peso | Uso |
|---|---:|---:|---|
| `largeTitle` | 34 / 41 | Bold | `LargeTitleHeader` e títulos de raiz. |
| `title1` | 28 / 34 | Bold | Títulos de tela. |
| `title2` | 22 / 28 | Bold | Seções importantes. |
| `title3` | 20 / 25 | Semibold | Títulos de cards e detalhes. |
| `headline` | 17 / 22 | Semibold | Labels de ação e linhas principais. |
| `body` | 17 / 24 | Regular | Conteúdo principal e campos. |
| `callout` | 16 / 21 | Regular | Descrições e controles. |
| `subheadline` | 15 / 20 | Regular | Metadados legíveis. |
| `footnote` | 13 / 18 | Regular | Informações auxiliares. |
| `caption` | 12 / 16 | Medium | Badges, labels compactos e tab bar. |
| `micro` | 11 / 14 | Medium | Apenas metadata não essencial; nunca para valores críticos. |

Regras:

- valores financeiros usam peso forte e números alinhados de forma consistente;
- preço, total, saldo e lucro não devem depender de fonte pequena;
- textos longos devem quebrar, não truncar informação crítica;
- labels de campo ficam acima do campo; placeholder é ajuda, não substituto de label;
- títulos usam capitalização de frase em português;
- mensagens de erro são diretas, curtas e acionáveis.

## 6. Espaçamento e layout

Usar escala base de 4 pontos:

| Token | Valor | Uso |
|---|---:|---|
| `xxs` | 4 | Separação interna mínima. |
| `xs` | 8 | Ícone/label, chips e itens compactos. |
| `sm` | 12 | Espaço entre controles relacionados. |
| `md` | 16 | Padding padrão e margem horizontal compacta. |
| `lg` | 20 | Separação de grupos. |
| `xl` | 24 | Padding de card e seção. |
| `xxl` | 32 | Separação de blocos e header. |
| `xxxl` | 40 | Espaço de respiro e estados vazios. |

Padrões:

- margem lateral padrão de tela: 16 pt em iPhone compacto, 20–24 pt em telas maiores;
- padding de card: 16–20 pt;
- distância entre seções: 24 pt;
- distância entre label e campo: 8 pt;
- distância entre campos de um mesmo grupo: 12 pt;
- distância entre grupos de formulário: 24 pt;
- lista com separadores: usar inset consistente e não criar borda em todos os lados;
- respeitar safe areas e área inferior da tab bar;
- no iPad ou telas largas, limitar largura de conteúdo para preservar legibilidade.

## 7. Bordas, raios e sombras

| Token | Valor | Uso |
|---|---:|---|
| `border.hairline` | `StyleSheet.hairlineWidth` | Separadores. |
| `border.thin` | 1 pt | Campos, cards selecionados e contornos. |
| `border.focus` | 2 pt | Foco acessível. |
| `radius.sm` | 8 pt | Campos compactos e badges. |
| `radius.md` | 12 pt | Botões e controles. |
| `radius.lg` | 16 pt | Cards e inputs principais. |
| `radius.xl` | 22 pt | Cards de destaque e sheets. |
| `radius.pill` | 999 pt | Chips e segmented controls. |

Sombras:

- `none`: listas planas e separadores;
- `card`: sombra muito sutil para cards sobre o canvas;
- `elevated`: modal, sheet e FAB;
- Dark Mode: reduzir opacidade da sombra e usar diferença de superfície/borda para profundidade;
- não usar sombras fortes em cada item de lista.

## 8. Ícones e ilustrações

- preferir símbolos de plataforma com significado familiar e peso consistente;
- criar uma camada `Icon` para impedir que cada componente escolha um pacote ou tamanho diferente;
- manter ícones de ação entre 20–24 pt dentro de alvos de 44 pt;
- ícones sem texto precisam de `accessibilityLabel`;
- usar ícone e texto para estados críticos;
- não usar ícone de lixeira para ações que não excluem;
- usar ícones de receita/saída, calendário, localização, filtro, busca, usuário, cartão/dinheiro e alerta de forma consistente;
- variantes claras/escuras devem preservar silhueta e contraste;
- ilustrações de `EmptyState` devem ser simples, leves e não competir com a ação principal.

A escolha final entre símbolos nativos e uma biblioteca compatível com Expo fica sujeita à aprovação da dependência técnica. O contrato visual deve ser definido antes da implementação.

## 9. Alvos de toque e estados de interação

Todo controle interativo deve ter pelo menos 44 × 44 pt de área acionável, mesmo quando o ícone visível for menor. Elementos próximos devem ter espaçamento suficiente para evitar toque acidental.

### Pressionado

- botão preenchido: escurecer/clarear semanticamente e reduzir levemente a escala;
- botão textual: alterar cor sem deslocar layout;
- card acionável: elevar contraste e aplicar feedback sutil;
- tab: atualizar indicador e ícone, sem bounce exagerado;
- seleção: mostrar estado persistente, não somente o frame do toque;
- haptic curto somente em ações discretas relevantes.

### Desabilitado

- reduzir contraste visual sem tornar o texto ilegível;
- impedir interação e anunciar `disabled` para VoiceOver;
- explicar a causa quando o controle depende de pré-condição;
- não usar disabled para esconder um erro de validação;
- não manter spinner e estado disabled indefinidamente sem mensagem.

### Foco

- exibir contorno semântico de 2 pt;
- manter foco visível em teclado físico, Switch Control e acessibilidade;
- nunca remover foco somente por animação;
- garantir que o foco não fique coberto por teclado ou sheet.

## 10. Componentes

### Navegação e headers

| Componente | Especificação |
|---|---|
| `AppHeader` | Header compacto com título, voltar, ações contextuais e safe area. Não conter ações de negócio ocultas. |
| `LargeTitleHeader` | Título grande em telas raiz; reduz para header compacto durante scroll quando isso melhorar espaço. |
| `BottomTabs` | Cinco módulos: Início, Entregas, Clientes, Financeiro e Mais. Serve apenas para navegação, preserva estado de cada stack e mostra label + ícone. |

### Ações

| Componente | Especificação |
|---|---|
| `PrimaryButton` | Ação principal da tela, preenchida, um por contexto. Ex.: Salvar, Calcular rota, Confirmar. |
| `SecondaryButton` | Ação alternativa ou de menor prioridade, com superfície ou contorno leve. |
| `DestructiveButton` | Exclusão ou ação irreversível; sempre acompanhado de confirmação quando aplicável. |
| `IconButton` | Ação compacta com label de acessibilidade e alvo mínimo de 44 pt. |
| `FloatingActionButton` | Atalho para criação, somente quando houver uma ação primária clara. Não cobrir tab bar, campos ou itens. |
| `SwipeAction` | Ações de lista como marcar pago ou excluir; repetir a ação em detalhe/menu para acessibilidade e descoberta. |

### Cards e listas

| Componente | Especificação |
|---|---|
| `Card` | Superfície base com variantes `plain`, `elevated`, `outlined` e `interactive`. |
| `MetricCard` | Um indicador principal, label, período e comparação opcional. Não conter formulário. |
| `FinanceCard` | Valor financeiro, contexto, variação e estado de valor oculto. Cálculos vêm prontos do domínio. |
| `DeliveryCard` | Cliente, data, quantidade, valor, status, entregue e ação principal. Não exibir excesso de campos. |
| `ClientCard` | Nome, endereço resumido, faturamento/quantidade derivados e avatar. |
| `PaymentCard` | Cliente, entrega, valor, data, estado aberto e CTA para quitar. |
| `RouteStopCard` | Ordem, cliente/endereço confirmado, distância/tempo do trecho e estado da parada. |
| `ListItem` | Linha base para conteúdo simples, com leading, conteúdo, trailing e ação acessível. |
| `SectionHeader` | Título, descrição opcional e ação “Ver todos” quando existir. |

### Busca e filtros

| Componente | Especificação |
|---|---|
| `SearchBar` | Busca contextual com label/placeholder, limpar, estado de foco e teclado apropriado. Resultados devem atualizar sem esperar submit quando seguro. |
| `FilterBar` | Chips/resumo dos filtros ativos e botão para abrir `FilterSheet`; não ocupar a tela com todos os controles. |
| `SegmentedControl` | Pequeno número de opções mutuamente exclusivas, como Hoje/Todas ou Distância/Tempo. Deve ter seleção visível e labels claros. |

### Formulários

| Componente | Especificação |
|---|---|
| `Input` | Label, valor, placeholder, ajuda, erro, foco e estado disabled. |
| `CurrencyInput` | Entrada BRL com teclado decimal, máscara apenas quando não atrapalhar edição e valor acessível por VoiceOver. |
| `QuantityInput` | Número inteiro positivo, step 1, teclado numérico e validação clara. |
| `DateInput` | Formato local para exibição, valor ISO internamente, picker nativo e indicação de data selecionada. |
| `TimeInput` | Picker nativo quando o horário fizer parte do fluxo; não criar campo se a regra original não usar hora. |
| `ClientSelector` | Busca, sugestões, cliente customizado, preço aplicável e endereço. Deve permitir corrigir nomes sem duplicação acidental. |
| `PaymentMethodSelector` | Escolha obrigatória entre Dinheiro e Pix; nunca selecionar Pix silenciosamente. Deve funcionar em quitação individual e múltipla. |

### Sobreposições e feedback

| Componente | Especificação |
|---|---|
| `Modal` | Contêiner para tarefa focada, com título, conteúdo, ações e dismiss controlado. |
| `BottomSheet` | Tarefa contextual curta, alturas detent, drag indicator, safe area e comportamento correto com teclado. |
| `ConfirmationDialog` | Confirma operações críticas/destrutivas com título específico, impacto, Cancelar e ação nomeada. |
| `Toast` | Feedback não bloqueante e temporário para sucesso/estado simples; não usar para perda de dados ou erro que exige decisão. |
| `Loading` | Spinner ou progresso para espera curta, com label quando a operação não for óbvia. |
| `Skeleton` | Placeholder estrutural durante leitura inicial/SWR; não animar se Reduce Motion estiver ativo. |
| `EmptyState` | Explicar ausência de dados e oferecer a próxima ação útil. |
| `ErrorState` | Informar o que falhou, oferecer tentar novamente e preservar contexto quando possível. |
| `Badge` | Informação curta, semântica neutra ou contagem. |
| `StatusChip` | Estado textual de pago, aberto, entregue, pendente, erro ou concluído, com cor + texto/ícone. |
| `Avatar` | Inicial/identidade do cliente, contraste adaptativo e label acessível. |

## 11. Estados de carregamento

### Inicial

- mostrar `Skeleton` que preserve a geometria do conteúdo;
- não exibir valores zero como se fossem dados reais enquanto o carregamento está indefinido;
- manter header e contexto de navegação estáveis;
- comunicar quando dados vierem do cache e quando estiverem sendo atualizados.

### Ação salva

- desabilitar somente a ação submetida;
- mostrar spinner inline no botão;
- impedir toque duplo;
- ao sucesso, fechar modal/sheet apenas quando a operação tiver sido confirmada;
- ao erro, manter formulário e valores digitados.

### Atualização em background

- preservar conteúdo visível;
- usar indicador discreto no header/lista;
- não bloquear a navegação inteira;
- atualizar derivados somente depois de confirmar a leitura.

## 12. Estados vazios e erros

### Empty State

Cada empty state deve ter:

- título específico, como “Nenhuma entrega hoje”;
- explicação curta;
- ação principal, como “Registrar entrega”;
- ilustração opcional de baixo contraste;
- mensagem acessível equivalente.

### Error State

- dizer o que não foi possível fazer;
- explicar a próxima ação, como “Tentar novamente” ou “Corrigir endereço”;
- não expor stack trace, UID, token ou erro técnico bruto;
- manter dados locais válidos quando possível;
- usar alerta somente quando a falha exigir decisão imediata;
- oferecer retry idempotente e feedback de resultado.

### Toast

- sucesso não destrutivo: “Entrega salva”;
- aviso contextual: “Selecione um método de pagamento”;
- erro recuperável: “Não foi possível salvar. Tentar novamente”;
- duração suficiente para leitura, com possibilidade de acessibilidade;
- não empilhar muitos toasts;
- nunca usar toast como único aviso de exclusão, importação ou perda potencial.

## 13. Modais, sheets e confirmações

### Escolha de ação

Usar `BottomSheet`/action sheet para uma escolha decorrente de uma ação intencional, como selecionar Dinheiro ou Pix. Não usar um alerta genérico para todas as escolhas.

### Operação destrutiva

`ConfirmationDialog` deve:

- usar título específico: “Excluir cliente?”;
- resumir o impacto;
- apresentar `Cancelar` e a ação final nomeada, como `Excluir`;
- destacar a ação destrutiva;
- não usar `Sim`, `Não` ou `OK` como confirmação ambígua;
- permitir dismiss por cancelar, botão voltar e gesto quando seguro;
- exigir etapa de backup/impacto para cliente e importação.

### Cliente

Renomear/excluir exige tela ou sheet de impacto com entregas, pagamentos e histórico relacionados. O Design System não deve sugerir que o cliente desaparece sem explicar a preservação dos registros.

### Backup

Importação é um fluxo de prévia, confirmação e resultado; o seletor de arquivo não pode disparar sobrescrita automática.

## 14. Animações e transições

Usar os tokens de animação já existentes como ponto de partida:

| Token | Duração | Uso |
|---|---:|---|
| `instant` | 0 ms | Estado sem movimento. |
| `fast` | 160 ms | Pressed, foco, chip e microtransição. |
| `standard` | 260 ms | Mudança de conteúdo e seleção. |
| `slow` | 420 ms | Entrada/saída de sheet, modal e transição de tela. |

Regras:

- usar movimento para explicar origem, destino e mudança de estado;
- usar spring em sheets e elementos diretamente manipuláveis;
- não animar cada número financeiro de forma chamativa;
- limitar deslocamento, escala e blur em telas financeiras;
- respeitar Reduce Motion, substituindo movimento por fade curto ou mudança instantânea;
- não usar animação como única indicação de sucesso ou falha;
- evitar loop contínuo fora de carregamento indeterminado.

## 15. Feedback tátil

Planejamento de haptics:

- seleção em segmented control e filtro: feedback de seleção leve;
- toggle entregue/tema/ocultar valores: seleção leve;
- entrega salva, pagamento confirmado e backup concluído: notificação de sucesso curta;
- erro de validação: no máximo feedback de erro discreto, acompanhado de mensagem visual;
- exclusão ou ação destrutiva: feedback somente após confirmação e conclusão;
- drag/seleção de ponto no mapa: feedback de alinhamento quando houver marco confirmado.

Não vibrar em cada toque de navegação. Haptics devem ser consistentes, opcionais quando aplicável e nunca substituir texto, cor ou VoiceOver.

## 16. Acessibilidade

- alvo interativo mínimo de 44 × 44 pt;
- suporte a Dynamic Type com aumento de pelo menos 200% sem cortar valores ou esconder ações;
- labels, hints, roles e values de acessibilidade para cada controle;
- VoiceOver deve ler cliente, data, valor, status e ação em uma ordem útil;
- status sempre combina texto/ícone com cor;
- foco visível e ordem lógica para teclado, Switch Control e leitores de tela;
- contraste validado em claro, escuro, Increase Contrast e Reduced Transparency;
- não depender de gesto de swipe como única forma de acessar uma ação;
- fornecer alternativa a SwipeAction em menu de detalhe;
- respeitar Bold Text, Reduce Motion, Larger Text e preferências de aparência;
- campos financeiros e valores ocultos devem anunciar o estado sem revelar o número;
- erros devem ser associados ao campo e anunciados após validação;
- evitar texto dentro de imagens;
- áreas de mapa devem ter descrição textual da sequência de paradas e métricas.

## 17. Comportamento do teclado

- usar `KeyboardAvoidingView` ou equivalente nas telas de formulário;
- rolar automaticamente até o campo focado;
- manter ações primárias visíveis acima do teclado quando possível;
- usar `decimal-pad` para moeda e `number-pad` para quantidade;
- usar `returnKeyType` coerente: Next entre campos e Done no último;
- oferecer toolbar/ação de concluir quando o teclado numérico não tiver botão Done;
- fechar teclado antes de abrir picker ou sheet conflitante;
- não validar agressivamente a cada tecla de modo que o foco salte;
- preservar valor digitado ao exibir erro ou falha de rede;
- manter o botão de salvar acessível sem cobrir o último campo;
- testar teclado pequeno, Dynamic Type e orientação suportada.

## 18. Valores financeiros ocultos

O comportamento existente de ocultar valores será preservado como preferência global de visualização:

- ocultar faturamento, lucro, margem, custo, preço, saldo, total pago e total pendente;
- manter quantidades e datas visíveis quando não forem dados financeiros;
- usar máscara consistente, como `••••` ou `R$ ••••`, sem revelar comprimento exato desnecessário;
- preservar layout para que a tela não pule ao alternar;
- `IconButton` de visibilidade deve ter label “Mostrar valores”/“Ocultar valores”;
- VoiceOver deve anunciar “valor oculto”, nunca o valor real;
- exportação, backup e logs não devem ser alterados pela preferência visual;
- a preferência não é controle de segurança criptográfica.

## 19. Dados sensíveis

Tratar como sensíveis:

- valores de vendas, custos, lucros, saldos e pagamentos;
- e-mail e identidade da conta;
- token de notificações;
- endereços de clientes e endereço base;
- conteúdo de backups JSON.

Padrões visuais e comportamentais:

- não exibir dados sensíveis em toast ou push quando não forem necessários;
- não colocar tokens, chaves ou dados completos em mensagens de erro;
- evitar mostrar valores completos em previews de app switcher quando houver suporte a proteção de tela;
- não copiar automaticamente valores para clipboard;
- confirmar exportação e importação;
- mostrar somente o mínimo necessário em cards e notificações;
- respeitar a preferência de valores ocultos em todas as telas financeiras;
- não confundir ocultação visual com proteção de armazenamento ou autorização Firebase.

## 20. Tema claro, escuro e sistema

O tema deve suportar `Sistema`, `Claro` e `Escuro` para preservar a preferência já existente, mas o padrão deve seguir o sistema. Todas as superfícies, ícones, gráficos e estados precisam ter tokens para ambos os temas.

### Claro

- canvas quase branco e superfícies brancas;
- mint em áreas de marca, seleção e sucesso não crítico;
- azul para ação/foco;
- sombras discretas;
- separadores claros, sem bordas em excesso.

### Escuro

- canvas azul-preto e superfícies em camadas;
- mint mais claro com texto escuro quando preenchido;
- textos primários quase brancos e secundários acinzentados;
- estados sem saturação excessiva;
- cards de financeiro com superfície elevada e alto contraste;
- evitar branco puro em grandes áreas.

O tema não deve depender de inversão automática de cores. Gráficos precisam de paletas próprias para preservar linhas, pontos, áreas e legendas em ambos os modos.

## 21. Gráficos e dados financeiros

- título, período e unidade devem estar próximos do gráfico;
- sempre exibir unidade: R$, %, km, min ou baldes;
- pontos importantes devem ter legenda textual ou acessível;
- não comunicar lucro negativo somente com vermelho;
- usar linhas e áreas com contraste suficiente;
- permitir visualizar o valor exato em toque/VoiceOver;
- estados sem dados mostram `EmptyState`, não eixo vazio enganoso;
- carregamento usa skeleton de gráfico;
- valores ocultos mascaram legenda, tooltip e resumo;
- a camada de gráfico recebe dados já calculados e não reproduz fórmulas.

## 22. Feedback por domínio

| Domínio | Feedback obrigatório |
|---|---|
| Entrega criada/editada | Loading no botão, sucesso contextual, atualização da lista e erro preservando formulário. |
| Pagamento | Método escolhido visível, confirmação explícita, sucesso somente após persistência. |
| Cliente renomeado/excluído | Impacto, backup, progresso, integridade e resultado. |
| Gasto/luz | Estado salvo no campo/seção e atualização dos derivados. |
| Rota | Progresso por geocodificação, erro corrigível e mapa somente com pontos confirmados. |
| Backup | Validação, prévia, contagem, confirmação, progresso, cancelamento e relatório final. |
| Notificação | Permissão, token atualizado e falha com ação clara; não expor token. |
| Autenticação | Estado de sessão, erro acionável e transição sem tela inconsistente. |

## 23. Organização prevista dos componentes

O plano visual deve ser implementado posteriormente com separação entre:

```text
src/components/ui/          componentes genéricos
src/components/finance/     cards e visualizações financeiras
src/components/delivery/    cards, status e ações de entrega
src/components/client/      clientes e relacionamentos
src/components/route/       paradas, mapa e estados de geocodificação
src/components/forms/       campos e seletores
src/components/feedback/    loading, erro, toast e confirmações
src/theme/                  tokens claros/escuros e semântica
src/utils/                  formatação e acessibilidade auxiliar
```

Componentes de domínio não devem conhecer Firebase. Repositories, services e mappers ficam fora da camada visual.

## 24. Critérios de validação do Design System

Antes de considerar o sistema pronto:

- todos os componentes devem possuir estados normal, pressed, focused, disabled e loading quando aplicável;
- todos os componentes devem funcionar em tema claro e escuro;
- todos os controles devem atender alvo de 44 pt;
- todos os textos devem suportar Dynamic Type sem perda de informação;
- todos os valores financeiros devem respeitar ocultação;
- componentes críticos devem ter VoiceOver labels e valores;
- erros, confirmação e sucesso devem ser testados sem depender apenas de cor;
- sheets, teclado e botão voltar devem ser testados juntos;
- gráficos devem ter fallback textual;
- listas devem suportar vazio, erro, cache e atualização;
- não deve haver hex hardcoded em componentes;
- não deve haver lógica financeira ou acesso Firebase dentro de componente visual.

## 25. Pontos que precisam da aprovação

1. Aprovar a paleta proposta, especialmente o papel do mint como marca e do azul como ação/foco.
2. Aprovar a troca da fonte principal Nunito pela fonte System/Dynamic Type.
3. Aprovar o nível de translucidez e profundidade, mantendo cards financeiros opacos e legíveis.
4. Aprovar a escolha futura de biblioteca de ícones/símbolos compatível com Expo.
5. Aprovar a escolha futura de bottom sheet, já prevista no plano de navegação.
6. Confirmar se o usuário poderá escolher `Sistema`, `Claro` e `Escuro`, apesar da preferência da HIG pelo modo do sistema.
7. Confirmar o formato visual da máscara de valores ocultos: `••••`, `R$ ••••` ou outro.
8. Confirmar se dados sensíveis devem ser ocultados também no app switcher e em screenshots.
9. Aprovar os padrões de haptics e a preferência para desligá-los.
10. Aprovar a escala de tipografia e a exigência de suporte a Dynamic Type até 200%.
11. Aprovar quais componentes serão implementados na primeira etapa e quais ficarão para uma segunda etapa.

Após aprovação, o próximo passo será transformar estes tokens e contratos em uma implementação incremental do Design System, sem alterar regras de negócio ou contrato do Firebase.
