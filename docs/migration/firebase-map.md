# Mapa do Firebase

Data da análise: 2026-07-24  
Escopo: somente a integração Firebase existente em `ionic-reference`. Nenhum arquivo de `ionic-reference` foi alterado.

Fontes principais consultadas:

- `ionic-reference/public/index.html`;
- `ionic-reference/database.rules.json`;
- `ionic-reference/functions/index.js`;
- `ionic-reference/public/firebase-messaging-sw.js`;
- `ionic-reference/public/sw.js`;
- `ionic-reference/firebase.json`;
- `ionic-reference/capacitor.config.json`;
- `ionic-reference/package.json` e `ionic-reference/functions/package.json`;
- `docs/migration/ionic-analysis.md`;
- `docs/migration/confirmed-decisions.md`.

Este documento descreve o contrato observado. Inferências estão marcadas como riscos ou decisões pendentes e não autorizam alteração estrutural.

## 1. Configuração do Firebase

O cliente web inicializa Firebase com os módulos CDN versão `10.12.0` em `public/index.html` e no service worker de mensagens. A configuração observada pertence ao projeto `venda-e-faturamento`:

| Campo               | Valor observado                                           |
| ------------------- | --------------------------------------------------------- |
| `authDomain`        | `venda-e-faturamento.firebaseapp.com`                     |
| `databaseURL`       | `https://venda-e-faturamento-default-rtdb.firebaseio.com` |
| `projectId`         | `venda-e-faturamento`                                     |
| `storageBucket`     | `venda-e-faturamento.firebasestorage.app`                 |
| `messagingSenderId` | `83092109834`                                             |
| `appId`             | `1:83092109834:web:7fd7d2b43771aeb3163df3`                |
| `apiKey`            | Presente no código cliente; não reproduzida aqui.         |

O `firebase.json` configura Hosting em `public` e Cloud Functions em `functions`. O `storageBucket` está configurado, mas não foram encontradas chamadas de Firebase Storage. Também não foram encontradas chamadas de Firestore.

Dependências observadas:

- cliente: `firebase` `12.16.0` no `package.json`, embora os módulos usados diretamente no HTML sejam CDN `10.12.0`;
- Functions: `firebase-admin` `^12.1.0`, `firebase-functions` `^5.0.0`, Node `20`;
- iOS/Capacitor: `@capacitor-firebase/authentication` com Google habilitado.

O mesmo objeto de configuração está duplicado no HTML e no service worker. A configuração web está exposta no frontend, como é usual para Firebase Web, mas a proteção real depende das regras e da configuração do projeto.

## 1.1 Separacao de projetos Firebase e Google Maps Platform

A separacao entre os projetos e intencional e nao representa uma inconsistencia:

- **`venda-e-faturamento`** e o projeto Firebase da aplicacao. Ele hospeda Authentication, Realtime Database, Cloud Functions e o Secret Manager usado pela `routeProxy`.
- **`Meu Otimizador`** e o projeto Google Cloud das APIs Google Maps Platform. Nele estao ativas a **Geocoding API** e a **Routes API**, com faturamento habilitado.
- A chave server-side pertence a `Meu Otimizador`, possui restricao de API somente para Geocoding API e Routes API e nao e enviada ao aplicativo.
- O valor dessa chave e armazenado como `GOOGLE_MAPS_SERVER_API_KEY` no Secret Manager de `venda-e-faturamento`. A `routeProxy` le o secret somente no backend.
- A `routeProxy` permanece uma Cloud Function v2 em `venda-e-faturamento`, regiao `us-central1`, com timeout de 30 segundos.

Assim, o projeto que executa a funcao e o projeto que licencia/fatura as APIs Maps podem ser diferentes. Nenhuma chave Maps server-side deve ser colocada em `EXPO_PUBLIC_*`, no bundle ou em logs.

## 2. Firebase Authentication

O app usa Firebase Authentication diretamente no cliente:

- `getAuth(app)`;
- `setPersistence(auth, browserLocalPersistence)`;
- `onAuthStateChanged` para controlar a transição login/aplicativo;
- `signOut(auth)` para logout.

Não foi encontrado cadastro de usuário, recuperação de senha, MFA, refresh de perfil ou autorização de domínio dentro do repositório. A existência e a configuração dos provedores no console Firebase não podem ser confirmadas apenas pelos arquivos.

## 3. Login por e-mail e senha

Fluxo observado em `public/index.html`:

1. Usuário informa e-mail e senha.
2. O cliente valida apenas que ambos estejam preenchidos.
3. Chama `signInWithEmailAndPassword(window.firebaseAuth, email, senha)`.
4. Em erro, mostra mensagem genérica de e-mail/senha inválidos.
5. O listener `onAuthStateChanged` recebe o usuário, define `usuarioId = user.uid` e inicia a leitura dos dados.

Não há validação de formato de e-mail no frontend. Não há tratamento específico para todos os códigos de erro do Auth.

## 4. Login Google

O comportamento varia por plataforma:

- Web/PWA: cria `GoogleAuthProvider` e chama `signInWithPopup`.
- Capacitor nativo: chama `FirebaseAuthentication.signInWithGoogle()`, extrai `idToken`, cria `GoogleAuthProvider.credential(idToken)` e conclui com `signInWithCredential` no Firebase Web Auth.

O `capacitor.config.json` habilita o provedor `google.com`. O código trata popup bloqueado, popup fechado/cancelado, plugin ausente e ausência de `idToken` com mensagens de erro.

Não foi encontrada implementação nativa de Apple, Facebook ou outros provedores.

## 5. Logout

`deslogar()` chama `window.signOutUser()` e recarrega a página após sucesso. O listener de autenticação esconde o app, remove `usuarioId` e exibe a tela de login quando o usuário fica nulo.

Não existe limpeza explícita do cache por logout. O cache permanece associado ao UID e pode ser reutilizado em um login futuro do mesmo usuário.

## 6. Persistência da sessão

No cliente web, a persistência é `browserLocalPersistence`. A sessão é observada por `onAuthStateChanged`. Existe ainda um intervalo de 50 ms que tenta garantir que o monitor de autenticação esteja ativo; esse mecanismo é estado de infraestrutura legado e não uma segunda sessão.

No login Google nativo, o plugin Capacitor participa da autenticação, mas o repositório não contém uma especificação independente sobre a persistência nativa. Isso deve ser validado no dispositivo iOS/Android antes da migração.

## 7. Realtime Database

O banco usado pelo app é exclusivamente Realtime Database, com `get`, `ref` e `set`.

Não foram encontradas:

- Firestore;
- listeners `onValue`, `onChildAdded` ou equivalentes no cliente;
- `update` parcial;
- `remove` no Database;
- transações;
- `push` do Realtime Database para gerar chaves.

As alterações são feitas localmente nos arrays/mapas e depois gravadas no nó inteiro com `set`.

## 8. Todos os nós existentes e contrato atual

O contrato observado é:

```text
/usuarios/{uid}/entregas
/usuarios/{uid}/gastosDiarios
/usuarios/{uid}/gastosMensais
/usuarios/{uid}/recebimentoBaldes
/usuarios/{uid}/clientesCustom
/usuarios/{uid}/pushToken
```

O único nó raiz observado nas regras é `/usuarios`. Não foram identificados outros nós persistidos pelo cliente ou pelas Functions.

### `/usuarios/{uid}/entregas`

Array completo de entregas. Campos observados ou compatíveis com registros legados:

```text
id: string
cliente: string
quantidade: number
valor: number ou string legada
status: "Pago" | "Não Pago" | outros valores legados
entregue: boolean
data: string, normalmente YYYY-MM-DD; registros antigos podem usar DD/MM/YYYY
invoiceStatus?: "emitido" | "a_emitir"
endereco?: string
metodoPagamento?: string, gravado na quitação
observacao?: string, observada em registros antigos
```

O formulário atual cria `id`, `cliente`, `quantidade`, `valor`, `status`, `entregue`, `data`, `invoiceStatus` e `endereco`. `metodoPagamento` é adicionado no fluxo de quitação; `observacao` é consumida na subpágina de pagamentos, mas não é preenchida pelo formulário atual.

### `/usuarios/{uid}/gastosDiarios`

Mapa indexado por data, normalmente `YYYY-MM-DD`:

```text
gastosDiarios[YYYY-MM-DD] = {
  estar?: number,
  gasolina?: number,          // formato histórico
  km?: number,
  precoGasolina?: number,
  tipoCombustivel?: "etanol" | "gasolina" | string
}
```

Ao criar uma nova data, o código inicializa `estar`, `gasolina`, `km` e `precoGasolina` com zero. `tipoCombustivel` pode ser texto vazio ou um dos valores usados na UI.

### `/usuarios/{uid}/gastosMensais`

Mapa indexado por `YYYY-MM`. O valor aceita formatos legados diferentes:

```text
gastosMensais[YYYY-MM] = number
gastosMensais[YYYY-MM] = { luz: number, outrosCamposLegados?: ... }
```

O editor atual grava/sobrescreve `luz` preservando outros campos quando o valor já é um objeto.

### `/usuarios/{uid}/recebimentoBaldes`

Array completo de recebimentos da fábrica:

```text
[
  {
    id: string,
    quantidade: number,
    data: string,
    valorTotal: number,
    concluido: boolean,
    pagamentos: [
      {
        id: string,
        data: string,
        valor: number
      }
    ]
  }
]
```

O identificador do recebimento usa o prefixo `fab_`; o identificador da parcela usa `pay_`. O saldo é derivado da soma das parcelas e `valorTotal`.

### `/usuarios/{uid}/clientesCustom`

Mapa indexado pelo nome oficial do cliente:

```text
clientesCustom[NomeOficial] = {
  preco: number,
  endereco: string
}
```

O nome é normalizado por regras de nomes/aliases antes da gravação. O contrato atual relaciona entregas ao cliente por nome, não por `clientId`.

### `/usuarios/{uid}/pushToken`

String contendo um único token de push do dispositivo/ambiente que gravou por último. Não é array nem mapa por dispositivo.

## 9. Campos persistidos e tipos observados

O Realtime Database não possui validação de schema no código cliente. A aplicação aplica apenas normalizações parciais:

- força `entregas` e `recebimentoBaldes` para arrays quando a leitura não retorna array;
- usa `{}` como fallback para mapas;
- converte alguns valores com `numeroSeguro` durante cálculos;
- normaliza datas `DD/MM/YYYY` para `YYYY-MM-DD` dentro de `migrarDados()`;
- normaliza nomes de clientes e pode persistir a alteração.

Os tipos acima são um mapa de compatibilidade, não autorização para remover campos desconhecidos. Mappers React Native devem preservar campos não reconhecidos ao gravar, quando isso for necessário para não perder histórico.

## 10. Leituras

Após autenticação, o cliente lê em paralelo:

```text
usuarios/{uid}/entregas
usuarios/{uid}/gastosDiarios
usuarios/{uid}/gastosMensais
usuarios/{uid}/recebimentoBaldes
usuarios/{uid}/clientesCustom
```

Cada leitura usa `get(ref(...))`. O `pushToken` não é lido pelo cliente durante o carregamento principal; ele é escrito pelo fluxo de notificações e lido pelas Cloud Functions.

O cliente primeiro tenta o cache local e depois faz revalidação no Realtime Database. Não há sincronização realtime contínua.

## 11. Gravações e atualizações

As funções observadas são:

| Nó                  | Operação atual                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `entregas`          | `set` do array completo após criar, editar, pagar, alterar entregue, alterar nota fiscal, excluir ou migrar dados. |
| `gastosDiarios`     | `set` do mapa completo após alterar gasto do dia.                                                                  |
| `gastosMensais`     | `set` do mapa completo após alterar luz mensal.                                                                    |
| `recebimentoBaldes` | `set` do array completo após criar/remover recebimento, adicionar/remover parcela ou alterar concluído.            |
| `clientesCustom`    | `set` do mapa completo após cadastrar/sobrescrever cliente.                                                        |
| `pushToken`         | `set` da string após obter permissão e token FCM.                                                                  |
| `/usuarios/{uid}`   | `set` do objeto completo no fluxo especial de duplicação entre contas.                                             |

Não há escrita parcial nem controle de versão. O cache local é salvo antes ou junto das operações de rede.

## 12. Exclusões

Exclusões observadas na UI:

- entrega: remove do array e regrava `entregas`;
- recebimento da fábrica: remove o registro e todas as parcelas;
- parcela da fábrica: remove a parcela e recalcula `concluido`;
- não há exclusão de cliente personalizado;
- não há exclusão de gasto diário, gasto mensal ou push token;
- pagamento de entrega não é entidade separada e não possui exclusão independente.

As exclusões de entrega e fábrica usam `confirm()` no navegador. O código não cria backup preventivo antes dessas exclusões.

## 13. Regras de segurança

Arquivo: `ionic-reference/database.rules.json`.

Regra geral:

```text
/usuarios/$uid
  .read  = auth != null && auth.uid == $uid
  .write = auth != null && auth.uid == $uid
```

Exceção específica:

```text
/usuarios/u6wFaaJmjaaJLLBUAt8q66mb7wE3
  .read  = auth.uid == u6wFaaJmjaaJLLBUAt8q66mb7wE3
        ou auth.uid == EF95Y7DwsFH4jsd64oxCgj9Hko53
  .write = auth.uid == u6wFaaJmjaaJLLBUAt8q66mb7wE3
```

As regras exigem usuário autenticado. Não há regras específicas por campo ou por operação dentro dos seis nós.

## 14. Exceções entre UIDs

O UID proprietário `u6wFaaJmjaaJLLBUAt8q66mb7wE3` pode ser lido também por `EF95Y7DwsFH4jsd64oxCgj9Hko53`. O segundo UID não pode escrever no nó do primeiro.

O cliente também contém um fluxo especial de migração/duplicação entre contas baseado em `migration_backup_data` e `migration_backup_source_uid`. Esse fluxo não deve ser tratado como autorização genérica entre UIDs: ele é condicionado a UIDs fixos e à conta destino estar sem entregas.

As Cloud Functions usam Admin SDK e, portanto, executam leituras administrativas que não refletem a permissão do cliente comum.

## 15. Push token

No Web/PWA:

1. `Notification.requestPermission()` solicita permissão.
2. O app registra `/firebase-messaging-sw.js` como service worker módulo.
3. `getToken()` usa VAPID key embutida e o registro do service worker.
4. Se houver usuário autenticado, grava a string em `/usuarios/{uid}/pushToken`.

O token é sobrescrito quando um novo token é obtido. Não há rotação, lista de tokens, remoção no logout ou suporte explícito a múltiplos dispositivos no contrato atual.

O `firebase-messaging-sw.js` usa a mesma configuração Firebase e `onBackgroundMessage`. O comentário informa que o payload com `notification` é exibido automaticamente; o worker não chama `showNotification`.

O código original comprova push Web/FCM, mas não comprova token nativo Expo/iOS. A compatibilidade iOS da primeira versão React Native exige validação específica.

## 16. Cloud Functions

Arquivo: `ionic-reference/functions/index.js`.

### `routeProxy` na primeira versao React Native

Na arquitetura React Native, `routeProxy` e uma Cloud Function v2 publicada em
`venda-e-faturamento` (`us-central1`). Ela usa o secret
`GOOGLE_MAPS_SERVER_API_KEY` desse projeto, cujo valor e a chave dedicada do projeto
Google Cloud `Meu Otimizador`. As chamadas server-side sao feitas para Geocoding API e
Routes API, ambas habilitadas em `Meu Otimizador`. A separacao nao altera o contrato do
Realtime Database.

### `notificarNovaEntrega`

- Trigger Realtime Database `onValueCreated` em `/usuarios/{usuarioId}/entregas/{entregaId}`.
- Lê `/usuarios/{usuarioId}/pushToken` com Admin SDK.
- Se houver token, envia FCM com quantidade e cliente da nova entrega.
- Inclui payload `webpush` com ícone `/icon-192.png` e link para o Hosting.
- Retorna `null` quando não há token ou em erro, registrando logs.

### `testarPush`

- HTTP Function.
- Recebe `?usuarioId=`.
- Lê o token do usuário e envia uma notificação manual de teste.
- Responde `400` sem UID, `404` sem token, `200` em sucesso e `500` em erro.

### `lembreteCobranca`

- Scheduled Function: `0 15 * * 1-5`.
- Timezone: `America/Sao_Paulo`.
- Varre `/usuarios` inteiro com Admin SDK.
- Para cada usuário com `pushToken` e `entregas`, agrupa entregas com `status === "Não Pago"` por `cliente`.
- Soma `valor`, aceitando número ou string parseável.
- Envia total e lista de clientes pendentes.

### `testarLembreteCobranca`

- HTTP Function que executa a mesma rotina imediatamente.
- Responde o número de notificações enviadas ou erro HTTP `500`.

O repositório não informa região de deploy, última versão implantada, logs de produção ou resultado de validação das Functions.

## 17. Cache local

### `localStorage`

| Chave                         | Conteúdo                                                                                                   |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `theme-preference`            | `light`, `dark` ou `system`.                                                                               |
| `system-theme-last`           | Último estado detectado do tema do sistema.                                                                |
| `valores-ocultos-pref`        | `1` ou `0`.                                                                                                |
| `pwa_faturamento_cache_{uid}` | JSON SWR com `entregas`, `gastosDiarios`, `gastosMensais`, `recebimentosFabrica`, `clientesCustom` e `ts`. |
| `migration_backup_data`       | JSON temporário do objeto completo de um UID específico.                                                   |
| `migration_backup_source_uid` | UID de origem do backup temporário.                                                                        |

O cache é lido antes da rede para renderização imediata e revalidado depois. O timestamp é salvo, mas não foi encontrada política de expiração baseada nele.

### Cache Storage e service worker

`public/sw.js` usa cache estático para assets e CDN e network-first para HTML. Ele exclui Realtime Database, APIs Google não estáticas e rotas `/__/`. Portanto, o cache do service worker não é cache de dados do Firebase.

## 18. Backup e importação/exportação

### Exportação atual

O botão exporta um arquivo JSON com o formato:

```json
{
  "entregas": [],
  "gastosDiarios": {},
  "gastosMensais": {},
  "recebimentoBaldes": []
}
```

O arquivo usa o nome `backup-nuvem-vendas-YYYY-MM-DD.json`. `clientesCustom` e `pushToken` não são incluídos na exportação atual.

### Importação atual

O textarea aceita:

- um array antigo de entregas;
- um objeto com `entregas`, `gastosDiarios`, `gastosMensais` e `recebimentoBaldes`.

O código:

- faz `JSON.parse`;
- valida apenas a forma básica dos dados;
- normaliza nome, quantidade, data, valor, status e `entregue` das entregas;
- gera ID quando ausente;
- recalcula o valor pela regra de preço atual/semântica observada;
- concatena entregas e recebimentos ao array existente;
- faz merge superficial dos mapas de gastos;
- grava cada nó com `set`;
- mostra alerta de sucesso ou JSON inválido.

Não há prévia, contagem de registros, confirmação formal, backup automático do estado atual, deduplicação, rollback ou proteção contra sobrescrita/duplicação silenciosa. Isso diverge das decisões confirmadas para a primeira versão React Native e precisa ser tratado como requisito de migração, não como comportamento a copiar literalmente.

### Backup temporário de migração

Para um UID específico, o app lê o objeto completo, grava em `migration_backup_data` e registra o UID de origem. Ao entrar em outra conta sem entregas, pode gravar esse objeto completo no novo UID e remover as chaves locais após sucesso.

Esse fluxo é uma cópia local temporária, não um backup versionado ou criptografado.

## 19. Formatos legados

Formatos observados que precisam continuar legíveis:

1. `entregas` como array completo.
2. Datas de entrega em `DD/MM/YYYY` e `YYYY-MM-DD`.
3. `valor` numérico ou string monetária.
4. `status` baseado em texto, especialmente `Pago` e `Não Pago`.
5. `gastosDiarios.gasolina` como custo histórico direto.
6. `gastosDiarios.precoGasolina` + `km` + `tipoCombustivel` para regra posterior.
7. `gastosMensais[YYYY-MM]` como número ou objeto com `luz`.
8. `recebimentoBaldes` como array com `pagamentos` parciais.
9. Cache local usa `recebimentosFabrica`, enquanto Firebase e backup usam `recebimentoBaldes`.
10. Clientes customizados indexados pelo nome, com aliases e acentos normalizados.
11. Entregas antigas podem conter campos opcionais como `observacao`, `endereco`, `invoiceStatus` e `metodoPagamento`.

Mappers futuros devem ser tolerantes na leitura, preservar os nomes atuais na escrita e não converter automaticamente arrays em registros indexados por ID.

## 20. Riscos de concorrência e integridade

- Dois dispositivos que leem o mesmo array e fazem `set` podem sobrescrever alterações um do outro.
- Importação concatena arrays sem deduplicar IDs.
- Edição em lote e exclusão regravam o nó inteiro.
- `migrarDados()` pode alterar e persistir entregas durante o carregamento.
- Cache local pode mostrar dados antigos e ser usado antes da revalidação.
- Não há timestamp de versão, transação, merge por item ou conflito detectável.
- Um único `pushToken` pode ser substituído por outro dispositivo.
- A Function de nova entrega depende da forma como `onValueCreated` se comporta quando o cliente grava um array completo com `set`.
- A Function de cobrança varre todos os usuários e depende dos textos exatos de status.
- Exclusão não gera backup preventivo.
- O backup temporário por `localStorage` pode ser lido por qualquer código da mesma origem e não é criptografado.
- O fallback de geocodificação aleatória está na integração de rota e pode persistir quilometragem derivada de uma rota inválida; a decisão confirmada exige removê-lo.
- Não há validação de schema após leitura do Firebase; campos ausentes ou tipos inesperados podem entrar nos cálculos.

## 21. Estratégia de compatibilidade para a primeira versão React Native

1. Manter exatamente estes caminhos e nomes de campos:

   ```text
   /usuarios/{uid}/entregas
   /usuarios/{uid}/gastosDiarios
   /usuarios/{uid}/gastosMensais
   /usuarios/{uid}/recebimentoBaldes
   /usuarios/{uid}/clientesCustom
   /usuarios/{uid}/pushToken
   ```

2. Manter arrays completos de `entregas` e `recebimentoBaldes`; não introduzir documentos por ID automaticamente.
3. Encapsular todas as leituras/gravações em repositories, sem acesso Firebase em componentes visuais.
4. Criar mappers separados para leitura legada e escrita compatível, preservando campos desconhecidos quando necessário.
5. Ler números, datas e formatos antigos sem renomear o contrato remoto.
6. Manter as regras de histórico, preços, custos, combustível, luz, status e marcação automática de entregas passadas conforme as decisões confirmadas.
7. Exigir escolha explícita entre `Dinheiro` e `Pix` na quitação; não repetir o fallback silencioso `Pix` observado no legado.
8. Implementar backup com validação, prévia, contagem, backup preventivo, confirmação, cancelamento, resultado e proteção contra sobrescrita.
9. Migrar notificações e validar as Functions existentes, incluindo a compatibilidade iOS, sem presumir que o `pushToken` string atual suporta múltiplos dispositivos.
10. Antes de uma migração estrutural futura para IDs, produzir backup, conversão, validação, integridade e rollback.
11. Não alterar regras de segurança, exceções de UID, valores ou fórmulas sem etapa e autorização específicas.

## 22. Riscos

- Gravação integral com `set` e ausência de transações pode causar perda por concorrência.
- A exceção de leitura entre UIDs está codificada e não possui justificativa no repositório.
- API key, VAPID key, URLs e UIDs estão embutidos no frontend; precisam de revisão de segurança e governança.
- O contrato `pushToken` suporta apenas o último token gravado.
- Não há schema remoto nem validação completa após leitura.
- Cache local não expira e backup local não é criptografado.
- Importação atual pode duplicar dados e recalcular valores com regras atuais.
- O campo `status` usa textos como identificadores de negócio.
- A Function `notificarNovaEntrega` pode não representar corretamente a gravação de arrays completos.
- A Function de cobrança percorre todos os usuários em uma rotina agendada.
- A integração original é Web/FCM; o fluxo nativo de push iOS não está comprovado.

## 23. Inconsistências

- O cliente depende de módulos CDN Firebase `10.12.0`, enquanto o package local declara Firebase `12.16.0`.
- `storageBucket` está configurado, mas não há uso de Storage.
- O cache chama o array de fábrica `recebimentosFabrica`, enquanto o Firebase/exportação chamam `recebimentoBaldes`.
- O backup não exporta `clientesCustom`, embora clientes personalizados façam parte dos dados do usuário.
- O campo `observacao` é renderizado em pagamentos, mas não é criado pelo formulário atual.
- `metodoPagamento` pode ser gravado, mas o modal atual não renderiza o seletor esperado e cai em `Pix`.
- O app aceita formatos financeiros legados diferentes sem um schema formal.
- O cliente lê cinco nós separadamente, mas a cópia de migração grava o nó `/usuarios/{uid}` inteiro.
- O fluxo de cache local e o fluxo de migração usam chaves/nomes diferentes para o mesmo domínio.
- Não foram encontrados testes automatizados ou verificação de deploy das Functions no projeto original.

## 24. Pontos críticos

1. Preservar arrays completos e nomes de campos na primeira versão.
2. Não copiar o fallback silencioso `Pix`.
3. Preservar a marcação automática de entregas passadas e testá-la.
4. Preservar preços, cortes históricos, custos e regras de luz/combustível.
5. Remover coordenadas aleatórias da rota e impedir que dados derivados inválidos sejam persistidos.
6. Proteger renomeação/exclusão de clientes com impacto, backup e atualização de referências.
7. Validar as regras de segurança e a exceção de UID antes de liberar repositories.
8. Validar o comportamento real das Cloud Functions com o formato de arrays completos.
9. Definir estratégia de token para iOS e múltiplos dispositivos sem alterar o contrato silenciosamente.
10. Implementar importação/exportação segura conforme as decisões confirmadas.

## 25. Decisões já confirmadas

As seguintes decisões de `docs/migration/confirmed-decisions.md` prevalecem sobre comportamentos defeituosos ou ambíguos encontrados no original:

- pagamentos de entrega somente por `Dinheiro` ou `Pix`, com escolha explícita;
- nunca usar Pix como fallback silencioso;
- marcar automaticamente entrega passada quando `entregue === false`;
- usar segunda, quarta e sexta nos rateios/comparativos;
- manter preços, cortes, custos de balde, combustível, custo médio e luz históricos;
- remover fallback de coordenadas aleatórias;
- permitir editar, renomear e excluir clientes customizados com impacto, confirmação, backup e preservação do histórico;
- preparar `clientId` sem alterar o contrato atual nesta etapa;
- manter arrays completos e formato atual no primeiro React Native;
- encapsular Firebase em repositories e preparar mappers;
- migrar notificações na primeira versão e validar as Cloud Functions;
- migrar backup/importação/exportação na primeira versão com validação, prévia, contagem, backup preventivo, confirmação, cancelamento, resultado e sem sobrescrita silenciosa.

## 26. Decisões ainda necessárias

Antes de implementar a camada Firebase React Native, ainda precisam ser confirmados:

- a necessidade atual da exceção de leitura entre `u6wFaaJmjaaJLLBUAt8q66mb7wE3` e `EF95Y7DwsFH4jsd64oxCgj9Hko53`;
- os provedores e domínios autorizados realmente ativos no Firebase Console;
- a persistência do login Google nativo em iOS e Android;
- a estratégia de token para múltiplos dispositivos mantendo o contrato atual;
- região, projeto e estado de deploy das Cloud Functions;
- se `onValueCreated` está emitindo exatamente uma notificação por nova entrega quando arrays são gravados com `set`;
- quais campos opcionais desconhecidos precisam ser preservados além dos observados;
- o significado definitivo de `gasolina` histórico versus `precoGasolina` por litro;
- o schema exato aceito para cada versão de backup e a política de deduplicação;
- se `clientesCustom` deve entrar no formato de exportação compatível da primeira versão;
- se `observacao` deve ser tratado como campo oficial ou legado opcional;
- política de expiração/limpeza de cache local e proteção do backup temporário;
- como testar Rules, Auth, Functions e push em ambiente seguro antes do uso com dados reais.

Até essas decisões serem respondidas, não é seguro implementar gravações, migrações estruturais, autenticação produtiva ou notificações que possam alterar o contrato do Firebase.
