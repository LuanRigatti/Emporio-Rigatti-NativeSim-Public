# Arquitetura de componentes nativos

## Objetivo

O aplicativo possui uma camada única de componentes nativos com três apresentações:

- Expo Go: componentes fallback compatíveis com o cliente instalado;
- iOS Development Build: componentes SwiftUI de `@expo/ui/swift-ui` quando o módulo `ExpoUI` está disponível;
- Web: componentes acessíveis compatíveis com teclado e mouse.

As ações, callbacks, estados e tipos são compartilhados. Somente a camada de apresentação varia por ambiente.

## Detecção de ambiente

`src/platform/runtimeEnvironment.ts` é a fonte única de verdade.

- `web`: `Platform.OS === 'web'`;
- `expo-go`: `isRunningInExpoGo()` ou `Constants.executionEnvironment === ExecutionEnvironment.StoreClient`;
- `development-build`: plataforma nativa que não é Expo Go.

`src/platform/nativeCapabilities.ts` expõe:

- `canUseExpoUI`;
- `canUseNativeMenu`;
- `canUseNativeSheet`;
- `canUseNativePicker`;
- `canUseNativeTabs`;
- `canUseLiquidGlass`.

`canUseExpoUI` só é verdadeiro em Development Build iOS quando `requireOptionalNativeModule('ExpoUI')` encontra o módulo nativo.

## Isolamento do `@expo/ui`

Os componentes SwiftUI ficam em arquivos separados com sufixo `SwiftUI.ios.tsx`.

Os arquivos públicos `Native*.native.tsx` não importam `@expo/ui/swift-ui` no topo. Eles:

1. verificam a capacidade centralizada;
2. carregam a implementação SwiftUI sob demanda somente quando a capacidade é verdadeira;
3. retornam imediatamente ao fallback quando o módulo não existe.

No Expo Go, o módulo `ExpoUI` não está disponível e a implementação SwiftUI não é executada nem registrada. O fallback permanece ativo.

## Componentes

| Componente               | Development Build iOS                                                                                 | Expo Go                                                              | Web                                 |
| ------------------------ | ----------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- | ----------------------------------- |
| `NativeMenu`             | SwiftUI `ContextMenu`, SF Symbols e transição nativa                                                  | `Link.Menu` quando há `href`; caso contrário `ActionSheetIOS`/alerta | Menu acessível para teclado e mouse |
| `NativeSheet`            | SwiftUI `BottomSheet`                                                                                 | fallback `BottomSheet` existente                                     | painel com `Modal` acessível        |
| `NativeDialog`           | `Alert`/`ConfirmationDialog` não estão expostos na versão beta instalada do SDK 54; usa `Alert.alert` | `Alert.alert`                                                        | diálogo acessível                   |
| `NativePicker`           | SwiftUI `Picker` com variante `menu`                                                                  | `ActionSheetIOS` ou alerta                                           | controle acessível de fallback      |
| `NativeSegmentedControl` | SwiftUI `Picker` com variante `segmented`                                                             | controle do Design System                                            | fallback acessível                  |
| `NativeList`             | SwiftUI `List` para listas pequenas                                                                   | `FlatList`                                                           | `FlatList`                          |
| `NativeDatePicker`       | SwiftUI `DatePicker`                                                                                  | `@react-native-community/datetimepicker`                             | campo de data compatível            |
| `NativeButton`           | SwiftUI `Button` com variante `glass`                                                                 | `GlassButton`                                                        | `GlassButton`                       |
| `NativeToggle`           | SwiftUI `Switch`                                                                                      | React Native `Switch`                                                | React Native `Switch`               |
| `NativeTextField`        | SwiftUI `TextField`                                                                                   | React Native `TextInput`                                             | React Native `TextInput`            |

## Regras de uso

- Não colocar Firebase, repositories ou regras de negócio nesses componentes.
- Não duplicar callbacks entre plataformas.
- Não usar `__DEV__` para identificar Expo Go ou Development Build.
- Não substituir componentes SwiftUI por animações Reanimated no Development Build.
- Não alterar a Native Tab Bar.
- Usar `NativeList` SwiftUI apenas em listas pequenas; dados financeiros extensos permanecem em `FlatList` ou `SectionList`.
- Respeitar tema, acessibilidade e estados desabilitados nos fallbacks.

## Showcase

A rota temporária é:

`/dev/native-components-showcase`

Ela é acessível pelo link temporário `Native Components Showcase` na Home durante o desenvolvimento e não foi adicionada à Native Tab Bar.

## Limitações do SDK 54

- `@expo/ui/swift-ui` exige Development Build no SDK 54.
- `Stack.Toolbar` não foi usado porque não está disponível no SDK 54.
- `NativeDialog` usa `Alert.alert` também no Development Build porque os wrappers SwiftUI de alerta não estão disponíveis na versão `@expo/ui@0.2.0-beta.9` instalada.
- O `Link.Menu` exige um trigger associado a `Link`; triggers arbitrários usam `ActionSheetIOS` no Expo Go.
- A validação visual real do SwiftUI, Liquid Glass e `ContextMenu` depende de um iPhone com Development Build.
