
# AI_CONTEXT.md

> Documento mestre para qualquer agente de IA (Codex, Gemini, Claude, Continue, Cursor, etc.)

# Objetivo do Projeto

Este projeto é uma migração completa de um aplicativo Ionic/Angular para React Native + Expo + TypeScript.

O objetivo não é apenas migrar funcionalidades.

O objetivo é entregar um aplicativo que tenha aparência, comportamento e experiência equivalentes a um aplicativo iOS nativo moderno, preservando compatibilidade com Android, Web e Expo Go.

# Stack

- Expo SDK 54
- React Native
- TypeScript
- Expo Router
- expo-router/unstable-native-tabs
- @expo/ui 0.2.0-beta.9
- Development Build para iOS

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

- Permanecer no Expo SDK 54.
- @expo/ui 0.2.0-beta.9 utiliza ContextMenu no lugar de Menu.
- Evitar wrappers com overflow:hidden ao redor de componentes SwiftUI.
- Não envolver Button SwiftUI com Pressable.

# Fluxo de Desenvolvimento

Windows:

    npx expo start --dev-client

Mac apenas quando houver recompilação nativa.

Mudanças apenas em TS/TSX normalmente utilizam Fast Refresh.

# Processo Obrigatório Antes de Qualquer Alteração

## Etapa 1 — Estudo do projeto

Antes de modificar qualquer arquivo, faça uma análise completa do projeto.

Mapeie:

- estrutura de pastas;
- navegação;
- componentes compartilhados;
- hooks;
- providers;
- services;
- contextos;
- utilitários;
- tema;
- estilos;
- componentes nativos;
- abstrações existentes.

Não proponha alterações antes de compreender a arquitetura.

## Etapa 2 — Localização da funcionalidade

Identifique todos os arquivos relacionados ao problema.

Nunca altere apenas o primeiro arquivo encontrado.

Analise dependências e impactos.

## Etapa 3 — Planejamento

Antes de escrever código, explique:

- causa do problema;
- abordagem escolhida;
- arquivos que serão alterados;
- possíveis impactos.

## Etapa 4 — Implementação

Durante a implementação:

- reutilize componentes existentes;
- preserve padrões arquiteturais;
- evite duplicação;
- preserve compatibilidade com Android, Web e Expo Go;
- prefira soluções nativas para iOS quando disponíveis.

## Etapa 5 — Validação

Após implementar:

- verificar TypeScript;
- verificar ESLint;
- revisar possíveis regressões;
- explicar tecnicamente todas as alterações.

# Orientação Geral para Agentes de IA

Sempre que receber uma nova tarefa:

1. Leia este documento por completo.
2. Faça um "raio X" do projeto antes de editar qualquer arquivo.
3. Entenda a arquitetura real implementada no código.
4. Respeite os padrões existentes.
5. Só então proponha ou implemente alterações.

Nunca assuma a arquitetura do projeto sem antes analisá-la.
