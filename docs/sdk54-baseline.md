# PAReact — baseline do Expo SDK 54

Snapshot somente para referência antes da migração para o Expo SDK 57.

- Data do levantamento: 2026-07-31
- Projeto: `PAReact`
- Expo SDK declarado: `~54.0.0`
- Expo resolvido no ambiente: `54.0.36`
- Node local: `v26.4.0`
- Pastas nativas versionadas: não existem `ios/` nem `android/`; o projeto usa CNG/Prebuild.
- Arquivo de configuração: `app.config.js`
- Nenhum arquivo nativo foi alterado neste levantamento.

## Runtime principal

| Pacote | Versão declarada |
| --- | --- |
| `expo` | `~54.0.0` |
| `react` | `19.1.0` |
| `react-dom` | `19.1.0` |
| `react-native` | `0.81.5` |
| `expo-router` | `~6.0.24` |
| `@expo/metro-runtime` | `~6.1.2` |
| `@expo/ui` | `0.2.0-beta.9` |

## Dependências Expo

| Pacote | Versão declarada |
| --- | --- |
| `expo-auth-session` | `~7.0.11` |
| `expo-blur` | `~15.0.8` |
| `expo-constants` | `~18.0.13` |
| `expo-crypto` | `~15.0.9` |
| `expo-dev-client` | `~6.0.21` |
| `expo-document-picker` | `~14.0.8` |
| `expo-file-system` | `~19.0.23` |
| `expo-font` | `~14.0.12` |
| `expo-glass-effect` | `~0.1.10` |
| `expo-haptics` | `~15.0.8` |
| `expo-linear-gradient` | `~15.0.8` |
| `expo-linking` | `~8.0.12` |
| `expo-maps` | `~0.12.10` |
| `expo-notifications` | `~0.32.17` |
| `expo-sharing` | `~14.0.8` |
| `expo-status-bar` | `~3.0.9` |
| `expo-task-manager` | `~14.0.9` |
| `expo-web-browser` | `~15.0.11` |
| `@expo/vector-icons` | `^15.0.2` |

## React Native e componentes nativos

| Pacote | Versão declarada |
| --- | --- |
| `react-native-reanimated` | `~4.1.1` |
| `react-native-worklets` | `0.5.1` |
| `react-native-gesture-handler` | `~2.28.0` |
| `react-native-screens` | `~4.16.0` |
| `react-native-safe-area-context` | `~5.6.0` |
| `react-native-svg` | `15.12.1` |
| `@react-native-async-storage/async-storage` | `2.2.0` |
| `@react-native-community/datetimepicker` | `8.4.4` |
| `@react-native-community/netinfo` | `11.4.1` |
| `@react-native-masked-view/masked-view` | não declarado |
| `@gorhom/bottom-sheet` | `^5.2.14` |
| `expo-glass-effect` | `~0.1.10` |

`@gorhom/bottom-sheet` está instalado, mas o fluxo `GorhomBottomSheetFlow` permanece desativado/comentado em Registro.

## Navegação

O projeto contém duas camadas de navegação que devem ser revalidadas durante a migração:

- Expo Router com `expo-router/entry`;
- NativeTabs experimental em `src/app/(tabs)/_layout.tsx`.

O `NativeTabs` está com `labelVisibilityMode="unlabeled"` e cada trigger usa `<Label hidden />`. Não há, neste baseline, uma feature flag ativa para ocultar dinamicamente a barra de tabs.

## Configuração Expo

Arquivo: `app.config.js`

- `userInterfaceStyle`: `automatic`
- iOS bundle identifier: `com.pareact.mobile`
- iOS build number: `1`
- `supportsTablet`: `true`
- Android `predictiveBackGestureEnabled`: `false`
- Experimento ativo: `tsconfigPaths: true`
- Plugins: `expo-router`, `expo-font`, `expo-web-browser`, DateTimePicker, Notifications e Maps.
- `newArchEnabled`: não declarado.

No SDK54 a New Architecture é habilitada por padrão, mas ainda pode ser desativada. No SDK55+ ela é obrigatória e não pode ser desativada. Portanto, todos os componentes nativos atuais devem ser tratados como dependentes da New Architecture antes do upgrade.

## Funcionalidades temporariamente desativadas

### ProgressiveBlur

Arquivos relacionados:

- `src/components/ui/progressive-blur.tsx`
- `src/app/(tabs)/dashboard.tsx`

O uso na Home está comentado. A implementação depende de `expo-blur`, `expo-linear-gradient` e `@react-native-masked-view/masked-view`; este último não está declarado no `package.json`. Não habilitar durante a migração.

### Fluxo futuro de dois Bottom Sheets

Arquivos relacionados:

- `src/components/native/GorhomBottomSheetFlow.tsx`
- `src/app/(tabs)/registrar.tsx`

O fluxo está fora da renderização ativa. Depende de `@gorhom/bottom-sheet`, Reanimated, Worklets e Gesture Handler. Deve continuar desativado até existir um Development Build SDK57 validado.

### Face ID

Não há `expo-local-authentication`, plugin ou implementação ativa de Face ID no baseline. A funcionalidade não está preparada nem deve ser habilitada durante o upgrade.

### Ocultação da NativeTabs

Não foi encontrada API, estado ou feature flag ativa para ocultar a NativeTabs. A preparação temporária anterior não está presente no estado atual; manter essa decisão até o SDK/API adequado.

## Pontos de atenção para o SDK57

1. `@expo/ui 0.2.0-beta.9` é o maior risco. Os componentes SwiftUI atuais usam APIs beta e precisam ser comparados com `@expo/ui ~57.0.8`.
2. React Native deve avançar de `0.81.5` para `0.86.2`, com React `19.2.3`.
3. Reanimated e Worklets devem ser atualizados juntos; não atualizar apenas um deles.
4. Gesture Handler, Screens e Safe Area precisam acompanhar as versões do SDK57.
5. Expo Router, NativeTabs e seus tipos experimentais precisam ser revisados após a atualização.
6. `@gorhom/bottom-sheet` deve ser testado contra RN0.86, Reanimated e Gesture Handler novos, mesmo permanecendo desativado.
7. O plugin de Notifications, Maps e DateTimePicker deve ser revalidado contra o novo schema de configuração.
8. `@react-native-masked-view/masked-view` precisa ser declarado caso ProgressiveBlur seja reativado no futuro.

## Rebuild nativo

A migração exigirá um novo Prebuild/Development Build. Não será uma alteração somente JavaScript, porque muda React Native, Expo Modules, `@expo/ui`, Reanimated, Worklets, Gesture Handler, Screens e NativeTabs.

O SDK57 exige toolchain compatível, incluindo iOS mínimo 16.4 e Xcode 26.4. Como o projeto não possui pastas nativas, a regeneração deverá ocorrer via CNG/Prebuild no ambiente Mac autorizado.

## Ordem recomendada

1. Criar um commit/backup deste baseline e validar o estado SDK54 atual.
2. Migrar incrementalmente SDK54 → SDK55 → SDK56 → SDK57.
3. Alinhar todas as dependências Expo com `expo install`/`expo install --fix` da versão alvo.
4. Atualizar `@expo/ui` e revisar cada wrapper SwiftUI nativo.
5. Atualizar Reanimated + Worklets em conjunto.
6. Atualizar Gesture Handler, Screens, Safe Area e demais módulos nativos.
7. Regenerar o projeto nativo e criar Development Build novo.
8. Validar NativeTabs, Liquid Glass, Bottom Sheets, navegação e todas as telas.
9. Manter ProgressiveBlur, Face ID, ocultação de NativeTabs e fluxo Gorhom desativados.
10. Reativar funcionalidades futuras somente em etapas separadas e após validação nativa.

## Referências oficiais

- [Expo SDK reference](https://docs.expo.dev/versions/latest/)
- [Expo SDK upgrade guide](https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/)
- [New Architecture no Expo](https://docs.expo.dev/guides/new-architecture/)
- [Expo UI no SDK57](https://docs.expo.dev/versions/v57.0.0/sdk/ui/)
- [Módulos nativos agrupados no SDK57](https://raw.githubusercontent.com/expo/expo/sdk-57/packages/expo/bundledNativeModules.json)
