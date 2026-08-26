# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Regras permanentes do projeto

1. A pasta `ionic-reference` contém o projeto Ionic original e deve ser utilizada somente para consulta.

2. Nunca altere, mova, renomeie, formate ou exclua arquivos dentro de `ionic-reference`.

3. Todas as implementações devem ser feitas exclusivamente no projeto React Native atual.

4. O aplicativo atual é a fonte de comportamento. Para cada funcionalidade, analise os arquivos atuais de UI, hooks, services, repositories, tipos, Firebase, cálculos, validações, filtros, ordenações, navegação e regras de negócio.

5. Não invente regras. Use o comportamento atual validado, `docs/AI_CONTEXT.md` e o Snapshot operacional no topo de `docs/current-state.md` como referência.

6. Quando algum comportamento não puder ser determinado, pare e informe claramente a dúvida.

7. Componentes visuais não devem acessar Firebase diretamente.

8. Componentes visuais não devem conter regras financeiras ou cálculos complexos.

9. Organize cada funcionalidade em `components`, `hooks`, `services`, `repositories`, `types` e `utils` conforme necessário.

10. Preserve o schema atual do Cloud Firestore. Não leia, migre ou adapte automaticamente o Realtime Database legado.

11. Antes de implementar uma funcionalidade:
    - localize os arquivos relacionados;
    - documente as regras encontradas;
    - apresente um plano;
    - aguarde minha autorização.

12. Depois de implementar:
    - execute TypeScript;
    - execute ESLint;
    - execute testes;
    - informe todos os arquivos alterados.

## Estado atual e decisões de negócio/arquitetura confirmadas

`docs/AI_CONTEXT.md` e o Snapshot operacional no topo de `docs/current-state.md` são as fontes atuais de contexto e decisões. Quando a tarefa envolver UI ou design, consulte também `docs/design-system.md`. O histórico da migração anterior permanece apenas no histórico Git e não orienta novas implementações.

O projeto atual usa Google/Firebase Auth e Cloud Firestore como persistência de negócio. O schema ativo é por usuário em `users/{uid}/...`, com documentos independentes e consultas granulares. O Firebase legado não é fonte de verdade e não deve ser acessado em novas funcionalidades, salvo solicitação explícita de auditoria.

Áreas já implementadas e preservadas: Clientes, Entregas, Pagamentos em aberto, Notas fiscais/boletos, Fábrica e pagamentos parciais, Dados Diários/Mensais, Finanças, Estoque, FactorySettings, CarSettings, CompanyProfile e Backup/Restore.

AsyncStorage/local storage pode permanecer somente para cache, fallback offline ou preferências específicas do dispositivo. Finanças, Estoque, gráficos e outros índices derivados não devem ganhar uma segunda persistência própria.

1. Os métodos permitidos para quitar entregas são somente `Dinheiro` e `Pix`. O usuário deverá escolher um deles. Nunca usar `Pix` como fallback silencioso.

2. Entregas com data anterior ao dia atual e `entregue === false` devem continuar sendo marcadas automaticamente como entregues. Esse comportamento deve ser documentado e testado.

3. Os dias trabalhados usados em rateios, comparativos e cálculos relacionados são segunda-feira, quarta-feira e sexta-feira.

4. Devem ser preservados os preços históricos por cliente, datas de corte, alterações históricas do custo do balde, regras históricas de combustível, regra histórica de custo médio e valores/regras históricas da luz. Datas, valores e fórmulas não podem ser alterados sem autorização explícita.

5. A geocodificação nunca pode gerar coordenadas aleatórias. Quando um endereço não for localizado, a aplicação deve mostrar erro claro, permitir corrigir o endereço ou selecionar manualmente um ponto no mapa, e impedir coordenadas inventadas na rota.

6. Clientes possuem identidade própria no Firestore. Edições, renomeações e exclusões devem preservar o histórico, verificar referências relacionadas, apresentar impacto, exigir confirmação e evitar perda de dados. Não usar nome como identidade quando houver `clientId` disponível.

7. Não criar compatibilidade nova com arrays do Firebase legado nem executar migração automática. Novos dados devem seguir o schema Firestore atual, encapsulados em repositories e services. Qualquer alteração estrutural futura exige plano explícito, backup, validação, integridade e rollback.

8. Notificações e tokens não devem ser alterados incidentalmente. Uma nova etapa de notificações somente deve ser criada após auditoria do código atual, das regras Firebase e da configuração nativa.

9. Backup/Restore já existe. Qualquer alteração deve preservar validação, checksum, UID, dry-run, confirmação explícita, IDs, timestamps, conflitos e a regra de nunca sobrescrever ou excluir silenciosamente dados válidos.

# Engineering Workflow

## Primary Objective

The primary objective is not to generate code quickly.

The primary objective is to understand the project, identify the root cause of problems, and produce the smallest correct implementation while preserving the existing architecture.

Never optimize for speed over correctness.

---

# Investigation First

For every task:

1. Understand the request.

2. Read AGENTS.md.

3. Read docs/AI_CONTEXT.md if necessary.

4. Read ONLY the files directly related to the task.

5. Build a complete mental model before editing.

Never edit code before understanding the affected architecture.

---

# Root Cause Analysis

For every bug, layout issue or unexpected behavior:

Never implement a fix before identifying the exact root cause.

Always investigate:

- component hierarchy
- wrappers
- native hosts
- parent containers
- styles
- layout constraints

Produce the complete hierarchy before changing code.

Example:

Screen
→ Layout
→ Header
→ Wrapper
→ Host
→ Native Component

Identify which level introduces the problem.

---

# Layout Investigation

Whenever a visual issue exists, inspect every ancestor.

Verify:

- width
- height
- min/max width
- min/max height
- flex
- flexGrow
- alignItems
- justifyContent
- padding
- margin
- overflow
- background
- border
- borderRadius
- position
- zIndex
- Host sizing
- matchContents
- controlSize
- intrinsic size

Never assume the visual bug is inside the native component.

Always inspect every React Native wrapper first.

---

# SwiftUI Components

When using @expo/ui:

Never replace SwiftUI controls with React Native replicas.

Always preserve:

- intrinsic size
- native animation
- native interaction
- ContextMenu
- Button
- Toggle
- Label

React Native wrappers must never modify the native control appearance.

---

# Reading Strategy

Never re-read the whole repository for isolated tasks.

Only read:

- affected screen
- related components
- wrappers
- providers if required
- repositories if required
- services if required

Avoid unrelated folders.

Avoid repeated file reads.

---

# Before Implementation

Before changing code always provide:

1. Root cause.

2. Evidence.

3. Files involved.

4. Implementation strategy.

Large changes require explicit user approval.

---

# Implementation Rules

Implement only the minimum required changes.

Never introduce workaround code.

Never compensate layout issues using:

- arbitrary padding
- arbitrary margins
- arbitrary widths
- arbitrary heights

Fix the real cause.

---

# Validation

After every implementation:

Run:

- TypeScript
- ESLint

Verify:

- architecture preserved
- no duplicated code
- no regression

Explain every modified file.

---

# When Uncertain

Never guess.

If the root cause cannot be identified confidently:

Continue investigating.

Do not implement speculative fixes.

# Repository Navigation

Never recursively inspect the entire repository unless explicitly requested.

For every task:

1. Identify the affected feature.
2. Read only the files belonging to that feature.
3. Expand the investigation only if new dependencies are discovered.
4. Stop reading unrelated directories.

The goal is to minimize context usage while maximizing understanding.

## Repository Search

Never ask the user where a component is located if it should exist inside the repository.

Always:

1. Search the repository.
2. Locate the component.
3. Find every import.
4. Find every usage.
5. Trace the complete hierarchy.

Only ask the user if the component cannot be found anywhere in the project.

## Native Components

When working with SwiftUI native controls:

Prefer removing React Native interference instead of modifying the native implementation.

Whenever a native animation is broken:

1. Verify whether React Native wrappers are interfering.
2. Verify whether layout constraints are interfering.
3. Verify whether clipping is interfering.
4. Preserve the native interaction model.
5. Implement the smallest possible change.

The preferred solution is always the one that restores the original native behaviour, not the one that reproduces it manually.

# Native Interaction Rules

When implementing any iOS control using SwiftUI or @expo/ui:

Always preserve the complete native interaction model.

The implementation must preserve:

- native Liquid Glass animations;
- native morphing animations;
- native material transitions;
- native highlight behaviour;
- native pressed state;
- native menu expansion animations;
- native spring animations;
- intrinsic sizing;
- native accessibility;
- native hit testing.

React Native must only orchestrate the layout.

React Native must never replace, simulate or interfere with native interactions.

Avoid:

- React Native Pressable over native controls
- Touchable wrappers
- fake GlassSurface around native controls
- clipping native animations
- fixed frames that restrict native effects
- nested interactive controls
- duplicated gesture handling

Whenever implementing a new native control:

1. Let the native SwiftUI control own the interaction.
2. Keep the React Native hierarchy as thin as possible.
3. Preserve the original iOS behaviour instead of recreating it. 

## Native First Philosophy

When there are two possible implementations:

1. React Native implementation.

2. Native SwiftUI implementation.

Always choose the native implementation unless there is a technical limitation.

If a React Native wrapper is required, it must exist only to integrate with the application.

It must never own:

- animations
- interaction
- pressed states
- gesture feedback
- visual effects

Those responsibilities belong to the native SwiftUI control.

## Preserve Native Behaviour

Whenever a native iOS control already provides the desired animation or interaction:

Never reproduce it manually.

Never wrap it unnecessarily.

Never override it.

Never compensate it.

Always restore the native behaviour instead of recreating it.

## Primary Runtime

The primary UI target is iOS Development Build on a physical iPhone.

Native SwiftUI controls must be selected immediately on iOS Development Build.

Do not degrade the iOS architecture to preserve Expo Go compatibility.

Expo Go may use fallbacks when required, but its limitations must not introduce visible fallback-first rendering, delayed native replacement or reduced native behaviour in Development Build.

Android and Web must preserve graceful fallbacks through platform-specific implementations.
## Native Design System

Before creating any new native UI component, investigate whether the existing NativeButton, NativeDropdown, NativeChip, NativeDateSelector, NativeIconButton or other reusable native components can be extended.

Prefer extending reusable abstractions over creating screen-specific implementations.

Visual styles (glass, glassProminent, primary, bordered, filled, etc.) should be expressed through variants instead of separate component names whenever technically appropriate.

Every new native component should be designed with reuse across the entire application in mind.
