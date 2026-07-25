# Validação nativa local — Etapa 33B

## Objetivo

Esta etapa prepara o PAReact para uma Development Build iOS compilada localmente em um Mac com Xcode e instalada diretamente em um iPhone.

A estratégia adotada é local:

```bash
npx expo run:ios --device
```

Não foram configurados EAS Build, EAS Submit, perfis EAS ou envio de artefatos para servidores EAS.

## Configuração aplicada

- `expo-dev-client` instalado na versão compatível com o Expo SDK do projeto.
- `app.config.js` passou a ser a fonte única da configuração Expo; o `app.json` duplicado foi removido.
- `userInterfaceStyle` definido como `automatic` para permitir a preferência `system` do Design System.
- Bundle Identifier iOS definido como `com.pareact.mobile`.
- `ios.buildNumber` definido como `1`.
- Scheme existente preservado: `pareact`.
- Plugin `expo-notifications` preservado com notificações remotas em background.
- Plugin `expo-maps` preservado.
- `expo-haptics`, `expo-auth-session`, `expo-document-picker`, `expo-file-system` e `expo-sharing` reutilizados.
- Contrato do Firebase preservado.
- Nenhum segredo adicionado ao código-fonte.

## Requisitos do Mac

- macOS compatível com a versão instalada do Xcode;
- Xcode 26.4 ou superior para a linha atual do Expo SDK 57;
- SDK iOS 16.4 ou superior;
- Command Line Tools do Xcode;
- Node.js compatível com o Expo SDK instalado;
- CocoaPods disponível no ambiente;
- Apple Account adicionada ao Xcode;
- iPhone conectado por USB e desbloqueado.

## Build local

No Mac, a sequência esperada é:

```bash
npm install
npx expo run:ios --device
npx expo start --dev-client
```

O primeiro comando `expo run:ios` pode gerar os diretórios nativos, instalar os Pods, compilar e instalar a aplicação no dispositivo. Se houver mudanças posteriores em plugins ou permissões nativas, a Development Build deverá ser recompilada.

Se o CocoaPods não for executado automaticamente:

```bash
cd ios
pod install
cd ..
npx expo run:ios --device
```

## Assinatura no Xcode

1. Abrir o workspace iOS gerado pelo Expo.
2. Selecionar o target da aplicação.
3. Confirmar `com.pareact.mobile` no Bundle Identifier.
4. Selecionar o Team Apple.
5. Ativar gerenciamento automático de assinatura.
6. Conectar o iPhone e selecioná-lo como destino.
7. Ativar Developer Mode no iPhone.
8. Autorizar o Mac e confiar no certificado, se solicitado.

Uma Apple Account gratuita permite teste pessoal no dispositivo, mas os App IDs, dispositivos e perfis de provisionamento expiram periodicamente. O Apple Developer Program pago é necessário para capacidades avançadas, distribuição, TestFlight e uso estável de credenciais de desenvolvimento.

## Configurações nativas previstas

### Mapas

- Apple Maps no iOS por `expo-maps`;
- Google Maps nativo somente no Android;
- abertura do Apple Maps por URL;
- abertura do Google Maps quando disponível;
- rotas e geocodificação por `routeProxy`;
- chave da Google Routes API somente em Cloud Functions;
- nenhum fallback de coordenadas aleatórias;
- ponto manual mantido apenas na sessão da rota.

### Notificações

- permissão nativa;
- token Expo/APNs;
- gravação em `/usuarios/{uid}/pushToken`;
- foreground;
- background;
- aplicativo encerrado;
- abertura de deep link ao tocar na notificação;
- nova entrega;
- lembrete de cobrança.

Notificações remotas reais exigem dispositivo físico e configuração válida de APNs/Firebase.

### Google Auth

- Firebase Google Provider habilitado;
- Client ID iOS associado ao Bundle Identifier;
- scheme `pareact` preservado;
- redirect nativo do `expo-auth-session`;
- sem popup WebView.

### Deep links

O prefixo nativo permanece:

```text
pareact://
```

Serão validados links provenientes de notificações, autenticação Google, entregas, clientes, financeiro e rotas.

### Arquivos e Share Sheet

- seleção JSON com `expo-document-picker`;
- leitura com `expo-file-system`;
- compartilhamento com `expo-sharing`;
- preservação dos formatos legados;
- cancelamento sem importação;
- validação e prévia antes da confirmação.

### Feedback tátil

O projeto já possui `expo-haptics`. Os usos serão validados em ações de sucesso, erro, seleção, confirmação, quitação e avanço de rota.

## Variáveis de ambiente

As variáveis públicas existentes continuam sendo usadas:

- `EXPO_PUBLIC_FIREBASE_*`;
- `EXPO_PUBLIC_GOOGLE_*_CLIENT_ID`;
- `EXPO_PUBLIC_EXPO_PROJECT_ID`;
- `EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY`;
- `EXPO_PUBLIC_ROUTE_FUNCTION_URL`.

Não colocar em `EXPO_PUBLIC_*`:

- `GOOGLE_MAPS_SERVER_API_KEY`;
- chaves privadas APNs;
- certificados;
- service accounts;
- credenciais administrativas;
- secrets de Cloud Functions.

## EAS futuro — opcional

EAS permanece uma alternativa futura para builds em nuvem, distribuição interna, TestFlight, EAS Submit, EAS Update e CI/CD.

Nesta etapa não foram executados nem configurados:

- `eas build:configure`;
- `eas build`;
- `eas submit`;
- perfis EAS;
- projeto EAS;
- envio de builds para servidores EAS.

## Matriz de validação

Os testes abaixo devem ser executados no Mac/iPhone após a configuração da conta Apple, Firebase, Google Cloud e APNs. Nenhum resultado de dispositivo é inventado neste documento.

| Recurso | Ambiente | Pré-requisito | Procedimento | Resultado esperado | Resultado encontrado | Status | Evidência | Correção necessária |
|---|---|---|---|---|---|---|---|---|
| Compilação local | Mac + Xcode | Xcode, CocoaPods e Node configurados | Executar `npx expo run:ios --device` | Build compila sem erro | Não executado neste ambiente Windows | Bloqueado | Mac/iPhone necessários | Executar no Mac |
| Instalação | iPhone físico | Developer Mode e assinatura | Instalar pelo Expo CLI | App aparece no iPhone | Não executado | Bloqueado | Captura do Xcode | Executar no iPhone |
| Bottom Tabs | iPhone | Build instalada | Abrir cada aba | Todas as abas navegam | Não executado | Aguardando execução | Não disponível | Nenhuma conhecida |
| Botão voltar | iPhone | Build instalada | Abrir detalhe e voltar | Retorna à tela anterior | Não executado | Aguardando execução | Não disponível | Nenhuma conhecida |
| Gesto de voltar | iPhone | Build instalada | Deslizar da borda esquerda | Retorna à tela anterior | Não executado | Pendente — Mac/iPhone | Não disponível | Validar em iPhone real |
| Safe Area | iPhone | Build instalada | Verificar notch, barra superior e inferior | Conteúdo não fica cortado | Não executado | Pendente — Mac/iPhone | Não disponível | Validar em iPhone real |
| Teclado | iPhone | Build instalada | Focar campos de login e formulários | Campo permanece visível | Não executado | Pendente — Mac/iPhone | Não disponível | Validar em iPhone real |
| Tema claro | iPhone | Build instalada | Selecionar tema claro | Contraste e cores corretos | Não executado | Aguardando execução | Não disponível | Nenhuma conhecida |
| Tema escuro | iPhone | Build instalada | Selecionar tema escuro | Contraste e valores legíveis | Não executado | Aguardando execução | Não disponível | Nenhuma conhecida |
| Sessão persistente | iPhone + Firebase | Conta de teste | Login, fechar e reabrir | Sessão permanece válida | Não executado | Bloqueado | Firebase necessário | Executar com conta controlada |
| Login por e-mail | iPhone + Firebase | Provider habilitado | Informar credenciais válidas | Usuário autenticado | Não executado | Bloqueado | Firebase necessário | Executar com conta controlada |
| Google Auth nativo | iPhone + Firebase/Google | OAuth iOS e provider | Iniciar login Google | Retorna autenticado ao app | Não executado | Pendente — Mac/iPhone | OAuth necessário | Validar client ID e redirect nativos |
| Notificação foreground | iPhone + APNs | APNs, Firebase e token | Receber notificação com app aberto | Banner/feedback correto | Não executado | Pendente — Mac/iPhone | Dispositivo/APNs necessários | Validar APNs |
| Notificação background | iPhone + APNs | Payload e capability | Receber com app em background | Notificação entregue | Não executado | Pendente — Mac/iPhone | Dispositivo/APNs necessários | Validar payload |
| Notificação com app fechado | iPhone + APNs | APNs e função implantada | Encerrar app e tocar notificação | App abre e navega | Não executado | Pendente — Mac/iPhone | Dispositivo/APNs necessários | Validar deep link |
| Geocodificação | iPhone + Cloud Functions | `routeProxy` e secret | Informar endereço válido | Coordenada válida retornada | Não executado | Pendente — Mac/iPhone | Function necessária | Validar proxy no dispositivo |
| Endereço inválido | iPhone | Proxy disponível | Informar endereço inválido | Erro e correção manual | Não executado | Pendente — Mac/iPhone | Não disponível | Validar fluxo nativo |
| Ponto manual | iPhone | Mapa nativo | Selecionar ponto no mapa | Ponto usado apenas na sessão | Não executado | Pendente — Mac/iPhone | iPhone necessário | Validar sessão |
| Apple Maps | iPhone | `expo-maps` e build nativa | Abrir tela de rota | Mapa Apple renderiza | Não executado | Pendente — Mac/iPhone | iPhone necessário | Compilar Development Build |
| Google Maps externo | iPhone | Google Maps instalado ou Web | Abrir ação externa | App ou fallback Web abre | Não executado | Pendente — Mac/iPhone | Não disponível | Validar Linking no dispositivo |
| Importação JSON | iPhone | Arquivo de teste | Selecionar, validar e confirmar | Prévia e resultado corretos | Não executado | Aguardando execução | Arquivo controlado | Nenhuma conhecida |
| Exportação JSON / Share Sheet | iPhone | Dados de teste | Exportar e usar Share Sheet | Arquivo compartilhado | Não executado | Pendente — Mac/iPhone | iPhone necessário | Validar Share Sheet |
| Feedback tátil | iPhone | Haptics disponível | Executar ações suportadas | Feedback discreto ocorre | Não executado | Pendente — Mac/iPhone | iPhone necessário | Validar intensidade |
| Permissão negada do iOS | iPhone | Sistema disponível | Negar notificações | Mensagem e instrução claras | Não executado | Pendente — Mac/iPhone | iPhone necessário | Validar estado |
| Permissão concedida do iOS | iPhone | Sistema disponível | Conceder notificações | Token registrado | Não executado | Pendente — Mac/iPhone | APNs/Firebase necessários | Validar `/pushToken` |

## Pendências obrigatórias para validação completa

- acesso ao Mac;
- Xcode compatível;
- iPhone físico;
- Developer Mode;
- assinatura Apple;
- APNs;
- Firebase e Cloud Functions implantadas;
- Google OAuth iOS;
- Google Routes/Geocoding e secret do proxy;
- dados controlados para testes;
- evidências de execução.

## Recomendação

A preparação local está concluída no código/configuração Expo, mas a Etapa 33B não deve ser considerada validada até que a Development Build seja compilada no Mac e os testes bloqueados sejam executados no iPhone.

## Auditoria da Etapa 34 — código e Expo Web

### Itens aprovados por análise estática

- `app.config.js` é a fonte única da configuração Expo.
- Bundle Identifier iOS `com.pareact.mobile` está configurado.
- Scheme `pareact` está configurado para deep links.
- Plugins de notificações, mapas, compartilhamento e Web Browser estão declarados.
- `expo-dev-client` e `expo-haptics` estão instalados.
- O mapa nativo está separado do fallback Web e não há fallback de coordenadas aleatórias.
- `SafeAreaProvider`, `SafeAreaView`, `KeyboardAvoidingView` e `useSafeAreaInsets` estão presentes no código.
- O tema do sistema está configurado como `automatic` e o `ThemeProvider` suporta `system`, `light` e `dark`.
- Haptics são ignorados no Web e não causam falha de renderização.
- O acesso a notificações, mapas, Firebase e arquivos permanece fora dos componentes visuais principais.
- Nenhum `eas.json`, perfil EAS ou configuração de EAS foi criado.

### Itens aprovados no Expo Web

- `npx expo export --platform web`: aprovado.
- Bundle Web gerado com sucesso, incluindo 922 módulos.
- Tela de login renderizada em `http://localhost:8083/login`.
- Campos de e-mail e senha visíveis.
- Botão de login visível.
- Interação de preenchimento do e-mail executada sem erro de aplicação.
- Nenhum overlay de erro do Metro/Expo foi observado.
- Console sem erros de aplicação.

O console exibiu somente o aviso esperado de que o listener de renovação de token push não produz efeito no Web. O Google Login apareceu desabilitado porque o `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` não estava configurado nesta execução; isso é uma pendência de ambiente, não uma aprovação do fluxo Google.

### Itens ainda pendentes de Mac/iPhone

Os seguintes itens continuam pendentes e não foram declarados aprovados:

- Safe Area em iPhone real;
- botão e gesto de voltar;
- comportamento do teclado nativo;
- haptics;
- notificações em foreground, background e aplicativo fechado;
- mapas nativos;
- geocodificação e ponto manual;
- Google Login nativo;
- Share Sheet;
- permissões do iOS;
- Dynamic Island, VoiceOver, Dynamic Type e Reduce Motion em dispositivo real;
- restauração de rota após encerramento ou deep link nativo.

### Correções obrigatórias antes da Etapa 35

1. Obter acesso a um Mac com Xcode compatível e a um iPhone físico.
2. Confirmar assinatura para `com.pareact.mobile` e ativar Developer Mode.
3. Configurar e validar os Client IDs OAuth iOS.
4. Configurar APNs, Firebase e Cloud Functions para notificações.
5. Confirmar as variáveis públicas necessárias sem expor secrets.
6. Executar `npx expo run:ios --device` somente quando o Mac estiver disponível.
7. Reexecutar a matriz de testes nativos desta documentação.
8. Anexar evidências reais: logs, screenshots, modelo do iPhone e versão do iOS.
9. Corrigir somente divergências confirmadas no dispositivo, sem alterar regras de negócio, cálculos ou contrato Firebase.

## Achados para aprovação antes de qualquer ajuste visual

| Problema | Gravidade | Melhoria proposta | Risco | Arquivos afetados |
|---|---|---|---|---|
| A detecção do Google Maps via `Linking.canOpenURL('comgooglemaps://')` exigia declaração em `LSApplicationQueriesSchemes`. | Média | Aplicado: `app.config.js` declara `LSApplicationQueriesSchemes: ['comgooglemaps']`. Validar o comportamento final no iPhone. | Baixo; altera somente a consulta permitida de URL externa. | `app.config.js` |
| Os testes de Safe Area, teclado, gesto de voltar, haptics, notificações, mapas, Google Login nativo, Share Sheet e permissões permanecem sem evidência física. | Alta para a validação nativa | Executar a matriz no Mac/iPhone antes de considerar a Etapa 35 pronta. | Declarar aprovação sem teste real pode ocultar falhas específicas do iOS. | `docs/migration/native-validation.md` |

O primeiro item foi aplicado após autorização: `app.config.js` agora declara `LSApplicationQueriesSchemes: ['comgooglemaps']`. A validação do comportamento com o aplicativo Google Maps instalado continua pendente de iPhone real. A documentação da Apple confirma que esquemas usados com `canOpenURL` devem estar declarados em `LSApplicationQueriesSchemes`. ([Apple — `LSApplicationQueriesSchemes`](https://developer.apple.com/documentation/uikit/uiapplication/canopenurl%28_%3A%29))

### Status da Etapa 34

A auditoria estática e o smoke test Web foram concluídos. A validação nativa permanece pendente. O aplicativo não deve ser considerado pronto para a Etapa 35 até que os testes de Mac/iPhone acima sejam executados e registrados.
