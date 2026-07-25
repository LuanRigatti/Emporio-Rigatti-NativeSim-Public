# Auditoria final da migração Ionic → React Native

## Escopo e método

Esta auditoria é estática e somente de leitura. Foram comparados o contrato e as regras documentados em `ionic-reference`, principalmente `ionic-reference/public/index.html`, com a implementação atual em `src/`, `functions/` e os documentos de migração.

Nenhuma correção foi aplicada durante a auditoria. “Resultado encontrado” significa o comportamento observado no código atual; não representa validação em aparelho físico, produção ou com uma base real do Firebase.

Gravidade usada:

- **Crítica:** pode causar perda de dados, exposição de dados ou quebra de uma regra financeira essencial.
- **Alta:** funcionalidade principal ausente ou comportamento incompatível com impacto operacional.
- **Média:** paridade incompleta, risco de divergência em casos específicos ou dependência de validação externa.
- **Baixa:** diferença de interface, documentação ou cobertura que não altera o contrato principal.
- **Informativa:** diferença intencional, confirmada ou futura.

## Resultado executivo

O React Native já possui uma base de dados, serviços, repositories, mappers, cálculos puros e navegação para a maior parte dos módulos. Preços, normalização, entregas passadas, pagamento explícito por Dinheiro/Pix, bloqueio de pagamentos da fábrica acima do saldo, backup com formato legado e a nova arquitetura de rotas estão representados no código.

Ainda não é possível declarar paridade total. Os principais pontos pendentes são:

1. **Configurações:** corrigido nesta etapa; `MoreSettings` agora usa uma tela funcional com tema, privacidade, notificações, backup, conta e logout.
2. **Valores ocultos:** corrigido nesta etapa; a preferência agora é global e persistida localmente, embora a cobertura visual de todas as telas ainda dependa de validação manual.
3. **Notificações:** a integração Expo está estruturada, mas a equivalência entre os gatilhos atuais das Cloud Functions e os gatilhos originais, além da validação em iOS/Android, ainda não foi comprovada.
4. **Financeiro:** as fórmulas estão centralizadas, porém é necessária uma bateria de fixtures idênticas ao Ionic para fechar a equivalência de rateios, combustível e comparativos.
5. **Mapas:** a regra de coordenadas aleatórias foi removida e o proxy seguro foi preparado, mas a execução depende de Development Build, chaves/configuração de produção e aparelho físico.

## Resultado da Etapa 33A

### Itens corrigidos

- `MoreSettings` deixou de usar `NavigationPlaceholder`.
- A preferência de tema `system`, `light` e `dark` ficou acessível pela tela de Configurações.
- A preferência de ocultação financeira passou a ter uma única fonte de verdade em `FinancialPrivacyProvider`/`useFinancialPrivacy`.
- A preferência de ocultação é persistida em AsyncStorage e não altera Firebase, valores persistidos ou cálculos.
- Dashboard, Financeiro, Clientes, Entregas, Histórico e Fábrica passaram a consumir o estado global de privacidade nas apresentações financeiras.
- Foram adicionados fixtures históricas para cortes de preço, custo do balde, combustível, luz, aliases, clientes personalizados, pagamentos, rateios e comparativos.

### Validação controlada executada

Foram usados somente fixtures e mocks locais. Nenhuma conta, base Firebase ou dado real foi utilizado.

- Autenticação: testes de serviço para login correto, credenciais inválidas, usuário inexistente, indisponibilidade de conexão, Google, sessão restaurada e logout.
- Dados e mappers: testes de normalização, validação, carregamento compatível e formatos legados.
- Clientes/preços: catálogo, aliases, configuração personalizada, precedência e cortes históricos.
- Entregas: preço automático, filtros, marcação automática de entregas passadas e ordenação.
- Financeiro/gastos: cortes, combustível legado, etanol, gasolina, luz, rateios, dias trabalhados, pagamentos, valores inválidos e comparação mensal.
- Fábrica: pagamentos parciais, saldo, tolerância, conclusão, remoção e reabertura.
- Backup: exportação/validação lógica, formatos legados, conflitos e integridade.
- Privacidade: ausência de preferência, persistência local e restauração da preferência.

Resultado automatizado desta etapa: **17 suítes aprovadas, 89 testes aprovados**.

### Divergências restantes

- A validação executada é de services, mappers, cálculos e armazenamento local; não substitui um teste integrado com Firebase controlado.
- A preferência global foi conectada aos fluxos financeiros principais, mas ainda deve ser revisada visualmente em cada tela e estado de loading/erro.
- A equivalência completa de todos os cálculos do Ionic ainda requer fixtures de produção reproduzíveis para cada agrupamento financeiro.
- A operação real de Share Sheet do backup e a sessão real persistida precisam de validação em plataforma nativa.
- A origem dos gatilhos de notificações, o token Expo e o proxy de rotas continuam sem validação operacional de produção.

## Pendências obrigatórias de validação nativa

Estas pendências não são consideradas falhas da Etapa 33A porque exigem Development Build, aparelho físico, configuração Apple ou infraestrutura implantada:

- mapa nativo `expo-maps` em iOS/Android;
- geocodificação, Google Routes API, quota, custos e proxy seguro implantado;
- notificações em foreground, background e aplicativo fechado;
- token Expo, APNs, credenciais Android e Cloud Functions implantadas;
- Share Sheet e importação/exportação de arquivos em iOS;
- persistência real de autenticação em reinicialização do aplicativo;
- layout/VoiceOver/Dynamic Type e ocultação global em aparelhos físicos;
- validação da regra especial de Viana em rota real.

### Recomendação

É seguro avançar para a próxima etapa de validações não nativas, mantendo as pendências nativas bloqueadas até a criação de Development Build e a disponibilização de aparelho/configuração. Não é recomendado declarar a migração finalizada nem iniciar mudanças estruturais no Firebase antes de concluir essa validação nativa e a comparação financeira integral.

## 1. Autenticação

**1. Comportamento original:** login por e-mail e senha, login Google, persistência local da sessão, mensagens de erro e logout. No Web/PWA o Google usava fluxo popup; no ambiente nativo dependia do plugin Capacitor.

**2. Comportamento React Native:** `FirebaseAuthRepository`, `AuthService`, `AuthProvider` e `useAuth` cobrem e-mail/senha, Google via credencial obtida por `expo-auth-session`, persistência com AsyncStorage, observação da sessão e logout.

**3. Resultado esperado:** preservar a sessão, os contratos de erro e os dois métodos de login sem popup Web na versão nativa.

**4. Resultado encontrado:** estrutura compatível e separada da UI. A compatibilidade depende de client IDs Google, configuração Expo/EAS e validação em cada plataforma.

**5. Divergência:** não há evidência de validação final em aparelho físico, reinicialização real e todas as configurações Google de produção.

**6. Gravidade:** Média.

**7. Correção necessária:** executar a matriz de testes de autenticação em Web, iOS e Android; conferir client IDs, redirect URIs, persistência e mensagens antes do aceite final.

## 2. Clientes

**1. Comportamento original:** clientes históricos vinham das tabelas de preço; clientes personalizados eram armazenados em `clientesCustom`, indexados pelo nome, com preço e endereço. O Ionic não possuía uma exclusão completa de cliente personalizado.

**2. Comportamento React Native:** `ClientCatalogService` reúne clientes históricos, personalizados e observados nas entregas. `ClientMutationService` implementa cadastro, edição, renomeação, backup preventivo, impacto, atualização de referências e remoção apenas da configuração personalizada.

**3. Resultado esperado:** permitir editar, renomear e excluir a configuração personalizada, preservar entregas/pagamentos/histórico e bloquear duplicidades por alias ou nome equivalente.

**4. Resultado encontrado:** o comportamento aprovado está representado: renomeação atualiza os nomes nas entregas e exclusão remove somente `clientesCustom`. O endereço é obrigatório em cadastro/edição; registros antigos sem endereço podem ser identificados como incompletos.

**5. Divergência:** pagamentos e histórico não são collections separadas; são derivados das entregas e dos registros existentes. A confirmação final dos impactos depende de testar uma base com nomes, aliases e entregas antigas.

**6. Gravidade:** Média.

**7. Correção necessária:** criar/rodar fixtures de colisão, renomeação, rollback, exclusão e registros antigos sem endereço; não alterar o Firebase automaticamente.

## 3. Preços

**1. Comportamento original:** três tabelas históricas: `precosClientes2024_2025`, `precosClientesAntigos` e `precosClientesAtuais`. Cortes: antes de 05/05/2025, de 05/05/2025 até antes de 05/04/2026, e a partir de 05/04/2026. Preço personalizado tem precedência.

**2. Comportamento React Native:** `priceTables.ts` e `ClientCatalogService` preservam tabelas, cortes e precedência do `clientesCustom`.

**3. Resultado esperado:** resolver exatamente o mesmo preço para cliente e data, sem alterar valores históricos.

**4. Resultado encontrado:** os valores e datas observados estão alinhados com o Ionic e há testes de serviço para os cortes.

**5. Divergência:** ainda não existe um comparador automatizado que execute todos os nomes e datas de corte contra os dois aplicativos.

**6. Gravidade:** Média.

**7. Correção necessária:** gerar fixtures de fronteira (`04/05`, `05/05`, `04/04`, `05/04`) e comparar saída por cliente antes de declarar paridade financeira.

## 4. Aliases

**1. Comportamento original:** normalização por caixa/acentuação e aliases como Santos→Elias, Vianna→Viana e variantes de Adri→Adri. A resolução de preço e endereço usava a chave normalizada.

**2. Comportamento React Native:** normalizadores e mappers centralizam a comparação; `ClientMutationService` bloqueia nome que colida com alias e aceita configuração personalizada complementar para cliente histórico.

**3. Resultado esperado:** nenhuma duplicidade por alias e nenhuma regra espalhada com comparação literal de nomes.

**4. Resultado encontrado:** os aliases documentados estão contemplados e o clientId interno está preparado sem ser persistido.

**5. Divergência:** a cobertura completa de todos os aliases reais e de todas as referências legadas não foi executada contra uma base representativa.

**6. Gravidade:** Baixa/Média.

**7. Correção necessária:** consolidar uma tabela de casos de normalização e comparar catálogo, preço, endereço, histórico e renomeação.

## 5. Entregas

**1. Comportamento original:** array em `/entregas`, com cliente, quantidade, valor, status, entregue, data, invoiceStatus, endereço e campos opcionais. Havia CRUD, edição em lote, exclusão, filtros, busca e quitação.

**2. Comportamento React Native:** `DeliveryQueryService`, `DeliveryPricingService`, `DeliveryNormalizationService` e `DeliveryMutationService` cobrem consulta, preço, normalização, criação, edição, exclusão, lote, quitação, filtro e busca. O formulário exige endereço confirmado.

**3. Resultado esperado:** preservar campos e regras, com fluxo nativo de cliente → endereço confirmado → quantidade → valor → data → status → método → revisão → gravação.

**4. Resultado encontrado:** o fluxo principal e o contrato atual estão preservados; Firebase não é acessado pelos componentes.

**5. Divergência:** a confirmação obrigatória do endereço é uma decisão aprovada para o React Native e é mais restritiva que a tela Ionic original. A equivalência detalhada da edição em lote ainda precisa de fixture.

**6. Gravidade:** Média, sendo a obrigatoriedade do endereço uma divergência intencional.

**7. Correção necessária:** validar todos os campos opcionais e a edição em lote contra arrays reais; manter a exigência aprovada de endereço confirmado.

## 6. Valores das entregas

**1. Comportamento original:** valor automático a partir do preço do cliente e quantidade, com possibilidade de ajuste manual. O preço depende da data, das tabelas históricas e da configuração personalizada.

**2. Comportamento React Native:** `DeliveryPricingService` concentra a resolução do preço e a `DeliveryMutationService` valida o valor; a tela apenas solicita o cálculo e permite edição manual.

**3. Resultado esperado:** não recalcular em tela com fórmulas próprias e preservar o valor manual salvo.

**4. Resultado encontrado:** não há cálculo financeiro direto nos componentes; a camada de serviço trata valor automático e manual.

**5. Divergência:** falta comparação automatizada de todos os cenários de preço, quantidade, edição manual e mudança de data com as saídas do Ionic.

**6. Gravidade:** Média.

**7. Correção necessária:** executar comparação por fixtures, incluindo quantidade zero, preço ausente, cliente customizado e valor manual.

## 7. Pagamentos

**1. Comportamento original:** pagamento de entrega era representado pelo status `Pago`/`Não Pago` e pelo campo `metodoPagamento`; pagamentos pendentes eram entregas não pagas e já entregues. Fábrica possuía pagamentos parciais em `pagamentos[]`.

**2. Comportamento React Native:** quitação exige entrega entregue, método explícito e atualiza status; fábrica calcula total pago, saldo e conclusão, bloqueando excedente e permitindo remoção/reabertura.

**3. Resultado esperado:** preservar pagamentos, impedir saldo negativo e concluir automaticamente ao atingir o saldo dentro da tolerância de R$ 0,01.

**4. Resultado encontrado:** as regras aprovadas estão implementadas em services e testes da fábrica; não foi criada uma collection de pagamentos incompatível com o Firebase atual.

**5. Divergência:** a cobertura conjunta de pagamentos de entrega, filtros de pendência e pagamentos parciais ainda não foi validada com um snapshot completo do Ionic.

**6. Gravidade:** Média.

**7. Correção necessária:** testar pagamento menor, igual, acima do saldo, remoção, reabertura e tolerância usando dados equivalentes aos originais.

## 8. Métodos de pagamento

**1. Comportamento original:** o Ionic permitia gravar `metodoPagamento`, mas o modal de quitação não renderizava corretamente o seletor e podia cair silenciosamente em Pix.

**2. Comportamento React Native:** tipos e validators aceitam somente `Dinheiro` e `Pix`; a quitação exige uma escolha explícita.

**3. Resultado esperado:** não usar Pix como fallback silencioso.

**4. Resultado encontrado:** a decisão confirmada foi aplicada e representa uma correção intencional de comportamento legado.

**5. Divergência:** existe divergência em relação ao fallback defeituoso do Ionic, mas não em relação à decisão de negócio aprovada.

**6. Gravidade:** Informativa; a mudança é desejada.

**7. Correção necessária:** manter testes de ausência de método, método inválido e seleção explícita de Dinheiro/Pix.

## 9. Status

**1. Comportamento original:** entregas tinham status de pagamento, `entregue` independente e `invoiceStatus` independente, com estados de nota emitida/a emitir e filtros por status.

**2. Comportamento React Native:** tipos, mappers, validators, formulário, detalhes e filtros preservam status, entregue e invoiceStatus separados.

**3. Resultado esperado:** não inferir quitação somente de `entregue` e não misturar nota fiscal com pagamento.

**4. Resultado encontrado:** a separação está presente; a tela de entrega permite alterar entregue e invoiceStatus separadamente.

**5. Divergência:** status persistido desconhecido pode ser apresentado pela UI como não pago, pois o formulário oferece apenas os estados suportados oficialmente.

**6. Gravidade:** Média para bases legadas com status fora do conjunto esperado.

**7. Correção necessária:** decidir e testar a apresentação de status legados desconhecidos sem sobrescrevê-los silenciosamente.

## 10. Marcação automática de entrega

**1. Comportamento original:** ao carregar dados, uma entrega com data anterior ao dia atual e `entregue === false` era marcada automaticamente como entregue e persistida.

**2. Comportamento React Native:** `DeliveryNormalizationService` e `DeliveryMutationService.normalizePastDeliveries` preservam essa regra.

**3. Resultado esperado:** manter exatamente a marcação automática e documentá-la/testá-la.

**4. Resultado encontrado:** a normalização ocorre na leitura/uso das entregas e há cobertura específica no módulo de entregas.

**5. Divergência:** nenhuma divergência de regra foi encontrada; falta apenas comprovação com dados reais em uma execução de integração.

**6. Gravidade:** Baixa.

**7. Correção necessária:** manter teste de data anterior, data igual ao dia atual e entrega já marcada.

## 11. Gastos

**1. Comportamento original:** gastos diários registravam Estar, quilometragem, gasolina legada, preço do combustível e tipo de combustível; gastos mensais registravam luz.

**2. Comportamento React Native:** há telas e services para gasto diário, histórico, luz mensal, custos do período e detalhes de cálculo. A camada de dados preserva os campos legados.

**3. Resultado esperado:** ler/gravar o formato atual e manter custos históricos sem cálculo na tela.

**4. Resultado encontrado:** o acesso está separado em repositories/services e os cálculos estão em `ExpenseCalculationService`/`FinancialCalculationService`.

**5. Divergência:** não foi concluída uma comparação registro a registro de todos os campos opcionais e datas históricas.

**6. Gravidade:** Média.

**7. Correção necessária:** testar importação, edição e gravação de registros com combustível legado e atual, sem remover campos desconhecidos.

## 12. Luz

**1. Comportamento original:** valor mensal salvo em `gastosMensais`, com defaults históricos e rateio apenas nos dias trabalhados: segunda, quarta e sexta. Período sem entregas não deveria receber rateio.

**2. Comportamento React Native:** `calculateLightForPeriod` retorna zero sem entregas; `calculateRateioLuzPorCliente` retorna `null` sem cliente, `0` para cliente informado sem participação e usa os dias confirmados.

**3. Resultado esperado:** separar luz geral de rateio por cliente, evitar divisão por zero e não alterar o valor mensal persistido.

**4. Resultado encontrado:** a distinção e os casos nulo/zero estão representados e cobertos por testes específicos.

**5. Divergência:** a equivalência dos valores históricos completos ainda depende da execução com os mesmos registros e cortes usados pelo Ionic.

**6. Gravidade:** Média.

**7. Correção necessária:** comparar mês, semana, cliente com participação, cliente sem participação e período vazio; preservar o valor mensal original.

## 13. Combustível

**1. Comportamento original:** antes de 01/05/2026 usava o custo legado de gasolina; a partir do corte calculava por quilometragem, média de 5,6 km/l para etanol ou 7,4 km/l para gasolina e preço registrado. Sem tipo, havia regra histórica de etanol até 30/06/2026 e gasolina depois.

**2. Comportamento React Native:** `ExpenseCalculationService` preserva corte, combustível legado, médias e escolha histórica do tipo.

**3. Resultado esperado:** reproduzir o custo por período e o rateio sem substituir dados históricos.

**4. Resultado encontrado:** as regras principais estão centralizadas; o custo por entrega/período não é calculado em telas.

**5. Divergência:** o rateio de combustível em agrupamentos precisa de comparação fixture a fixture; não é possível declarar que todos os agrupamentos produzem exatamente o mesmo resultado apenas pela inspeção estática.

**6. Gravidade:** Alta para divergência financeira não detectada; Média enquanto não houver divergência comprovada.

**7. Correção necessária:** executar comparação antes/depois dos cortes, etanol, gasolina, tipo ausente, quilometragem zero e agrupamentos mensal/semanal.

## 14. Financeiro

**1. Comportamento original:** dashboard financeiro calculava faturamento, recebido, pendente, quantidade, custo dos baldes, combustível, Estar, luz, lucro bruto/líquido, margens, médias, ranking e comparativos.

**2. Comportamento React Native:** `FinancialCalculationService` concentra funções de resumo, margens, médias, ranking, agrupamentos e comparativos; Dashboard e Financeiro consomem a camada de cálculo.

**3. Resultado esperado:** uma única fonte de fórmulas, com indicadores detalháveis, valores ocultáveis e filtros coerentes.

**4. Resultado encontrado:** a arquitetura atende à separação e os cards permitem ocultar valores localmente; há telas de período e detalhes.

**5. Divergência:** a ocultação global e persistente foi corrigida nesta etapa. Ainda falta a comparação completa de todos os indicadores/gráficos com fixtures do Ionic e a revisão visual de todos os estados.

**6. Gravidade:** Alta para paridade funcional de ocultação; Média para a equivalência numérica ainda não fechada.

**7. Correção necessária:** manter a preferência global implementada e executar comparação completa de fórmulas, rankings, comparativos e períodos vazios.

## 15. Histórico

**1. Comportamento original:** histórico oferecia busca, status, ano, mês, dia, agrupamento por mês/dia, expansão, edição, lote, ranking e ordenação por data decrescente/nome.

**2. Comportamento React Native:** `HistoryQueryService` aplica ano, período, busca e status; `HistoryGroupingService` agrupa mês/dia; `HistoryScreen` usa lista agrupada e navegação para detalhes/ranking.

**3. Resultado esperado:** o filtro de ano deve limitar de fato os registros, mesmo que o Ionic contenha o bug legado; a correção não altera regras financeiras.

**4. Resultado encontrado:** o filtro de ano é aplicado antes do filtro de período em `matchesDate`, conforme decisão aprovada. Há filtros, agrupamento e estados de lista.

**5. Divergência:** a correção intencional faz o RN diferir do comportamento incorreto do Ionic. A ordem de todos os empates e a edição em lote ainda precisam de comparação com fixtures.

**6. Gravidade:** Baixa/Média.

**7. Correção necessária:** preservar o filtro corrigido e validar ordenação, agrupamento, expansão, lote e ranking com dados de anos diferentes.

## 16. Fábrica

**1. Comportamento original:** `recebimentoBaldes` era um array de recebimentos com quantidade, data, valor total, pagamentos parciais, saldo, conclusão, remoção, reabertura, exclusão, filtros e histórico.

**2. Comportamento React Native:** `FactoryReceiptMutationService`, hooks e telas cobrem CRUD, pagamentos, remoção, reabertura, saldo, progresso, confirmação e histórico.

**3. Resultado esperado:** pagamento maior que zero, no máximo o saldo restante, tolerância de R$ 0,01 e conclusão automática ao quitar.

**4. Resultado encontrado:** a validação de excedente, recálculo após edição/exclusão e tolerância estão implementados na camada de serviço e testes.

**5. Divergência:** nenhuma divergência de regra foi encontrada; falta validar o fluxo completo em dispositivo e com registros legados.

**6. Gravidade:** Baixa/Média.

**7. Correção necessária:** executar a matriz aprovada de pagamentos, inclusive recebimento já quitado e remoção do último pagamento.

## 17. Notificações

**1. Comportamento original:** FCM/Web Push, token persistido em `pushToken`, nova entrega, lembrete de cobrança em dia útil às 15h, service worker, foreground/background e abertura por link.

**2. Comportamento React Native:** `NotificationService` usa Expo Notifications nativo, registra/renova token, trata foreground, resposta e notificação inicial; `NotificationProvider` expõe estado e ações. As Cloud Functions enviam nova entrega e lembrete.

**3. Resultado esperado:** suportar iOS/Android, token, nova entrega, cobrança, deep link, foreground, background e app fechado sem expor segredos.

**4. Resultado encontrado:** o fluxo nativo e a tela de configurações de notificações existem; Web é explicitamente tratado como indisponível para Expo Push. O background task está definido, mas não comprova por si só entrega/execução de todos os cenários.

**5. Divergência:** o gatilho atual da Function de nova entrega usa escrita no array completo (`onValueWritten`) e precisa ser confrontado com o gatilho/semântica original. Não há validação operacional documentada em iOS com APNs e em Android físico.

**6. Gravidade:** Alta.

**7. Correção necessária:** comparar trigger, deduplicação, payload, token, deep links e horários; validar Functions implantadas, Expo/EAS, APNs, Android credentials e cenários de app fechado.

## 18. Backup

**1. Comportamento original:** exportava JSON e importava formatos legados, com dados de entregas, gastos e fábrica; havia validação básica, cache e confirmação. O formato original não incluía `clientesCustom` na exportação atual.

**2. Comportamento React Native:** `BackupService`, `BackupValidationService`, `BackupMergeService` e `BackupIntegrityService` validam JSON/estrutura, exibem prévia/contagens, geram backup preventivo, importam sem sobrescrever silenciosamente, verificam integridade e tratam `recebimentoBaldes`, `recebimentosFabrica` e `clientesCustom` legado ausente.

**3. Resultado esperado:** compatibilidade com JSON antigo, backup preventivo, confirmação, cancelamento, relatório e preservação dos dados válidos.

**4. Resultado encontrado:** os requisitos confirmados estão representados na camada de backup; formatos antigos sem `clientesCustom` são tratados como coleção vazia.

**5. Divergência:** a exportação/Share Sheet do iOS e a recuperação após falha ainda exigem validação em aparelho; o fato de `clientesCustom` não existir no backup Ionic é uma diferença necessária para o novo contrato confirmado.

**6. Gravidade:** Média.

**7. Correção necessária:** testar arquivos reais legados, exportação em iOS, cancelamento, falha parcial, rollback e importação repetida.

## 19. Mapas e rotas

**1. Comportamento original:** geocodificação por Google Maps, origem/base, entregas do dia, endereços da entrega/custom/conhecidos, distância, duração, ordem, retorno à base, regra especial de Viana e gravação de quilometragem. Havia fallback aleatório de coordenadas quando a busca falhava.

**2. Comportamento React Native:** `expo-maps` é usado no nativo; a rota possui presets Flamboyant→PLAV→Entregas→Francisco, PLAV→Entregas→Flamboyant→Francisco e modo personalizado. O destino padrão é Rua Francisco Balchak, 83; paradas obrigatórias não são reordenadas; trechos acima de 25 paradas são divididos; coordenadas manuais ficam na sessão; proxy Cloud Function protege a chave.

**3. Resultado esperado:** remover coordenadas inventadas, bloquear otimização com endereço inválido, permitir correção/ponto manual e preservar Viana; manter compatibilidade Web sem prometer mapa nativo.

**4. Resultado encontrado:** o fallback aleatório não está presente no módulo React Native; há tela de correção, testes de endereço inválido, ponto manual, divisão e Viana. Web usa limitação/placeholder e o mapa nativo depende de Development Build.

**5. Divergência:** ainda não há validação em aparelho físico nem confirmação de implantação/funcionamento do proxy Google Routes em produção. Favoritos, histórico, múltiplos depósitos, curva a curva, retomada e reordenação manual são apenas arquitetura futura, conforme escopo aprovado.

**6. Gravidade:** Alta para operação ainda não validada; Informativa para recursos explicitamente futuros.

**7. Correção necessária:** validar API, custos, quota, chaves secretas, geocodificação, rota contínua em trechos, abertura Apple/Google Maps, quilometragem e regra de Viana em dispositivo real.

## 20. Configurações

**1. Comportamento original:** preferência de tema `system/light/dark` persistida em `localStorage`, suporte a tema claro/escuro, ocultação global de valores por `valores-ocultos-pref`, notificações, backup e logout.

**2. Comportamento React Native:** `ThemeProvider` persiste `system/light/dark` e integra o tema do sistema. A tela funcional `MoreSettings` agora expõe tema, ocultação global, backup, notificações, conta e logout.

**3. Resultado esperado:** aba Mais como entrada para configurações reais, com tema, privacidade de valores, notificações, backup e conta/logout, sem alterar dados financeiros.

**4. Resultado encontrado:** a tela de Configurações permite selecionar tema e ocultação. Dashboard, Financeiro, Clientes, Entregas, Histórico e Fábrica consomem o provider persistente de privacidade financeira.

**5. Divergência:** nenhuma ausência estrutural foi encontrada nesta etapa. Continua necessária a validação visual manual em todos os estados e a validação nativa da persistência após reinício.

**6. Gravidade:** Alta.

**7. Correção necessária:** manter a tela e o provider usando os componentes congelados; validar backup, notificações, conta, logout e persistência real em dispositivo.

## Pendências de aceite final

Antes de considerar a migração equivalente ao Ionic, ainda é necessário:

- executar comparação automatizada dos cálculos com fixtures históricas do Ionic;
- validar autenticação, notificações, backup e mapas em aparelhos reais;
- confirmar o deploy e as configurações das Cloud Functions;
- revisar visualmente a preferência global de valores ocultos em todas as telas e estados;
- testar dados legados reais, incluindo aliases, clientes sem endereço, status desconhecidos, pagamentos parciais e campos opcionais;
- registrar correções aprovadas separadamente, sem alterar `ionic-reference`.

## Arquivos consultados principalmente

- `ionic-reference/public/index.html`;
- `docs/migration/ionic-analysis.md`;
- `docs/migration/confirmed-decisions.md`;
- `docs/migration/firebase-map.md`;
- `docs/migration/business-rules.md`;
- `src/repositories/`;
- `src/services/`;
- `src/mappers/`;
- `src/utils/data/`;
- `src/screens/`;
- `src/navigation/`;
- `functions/index.js`;
- `tests/`.

## Atualização da Etapa 34A — Financeiro e gráficos

### Corrigido

- O período financeiro passou a ser compartilhado entre Financeiro, Relatório, Ranking, Gráficos e detalhes de indicadores.
- A seleção suporta Hoje, Semana, Mês com mês/ano explícitos, Ano, Todo o histórico e intervalo personalizado.
- A seleção de Mês não fica limitada silenciosamente ao mês atual; mês e ano ficam visíveis e alteráveis.
- A seleção de Ano é convertida em intervalo explícito de 1º de janeiro a 31 de dezembro, sem alterar fórmulas financeiras.
- As séries são agrupadas por dia, semana, mês ou ano e permitem faturamento, recebido, pendente, lucro líquido, custos e quantidade de baldes.
- As séries usam exclusivamente `FinancialCalculationService`; nenhuma fórmula foi duplicada nas telas.
- Pontos inexistentes não são fabricados.
- Períodos vazios exibem `EmptyState`; um único ponto exibe estado informativo e o valor do período, sem simular evolução.
- Foi adicionada visualização SVG compatível com Expo SDK 57, iOS, Android e Web usando `react-native-svg`.
- Foram adicionados testes para mês, ano, todos, intervalo, período vazio, ponto único, múltiplos pontos, troca de métrica e consistência dos valores agrupados.

### Pendente

- Validação visual com dados reais no Expo Web para todos os indicadores e tamanhos de tela.
- Comparação visual do gráfico React Native com a evolução do Ionic em uma base histórica equivalente.
- Validação de performance com grande volume de entregas.
- Validação nativa em Development Build; isso não é substituído pelo teste Web.

### Polimento futuro

- Tooltip acessível ao tocar em um ponto.
- Navegação horizontal para séries muito longas.
- Exportação de relatórios e gráficos.
- Animações discretas respeitando Reduce Motion.

Este documento é um relatório de divergências e riscos. Ele não autoriza nem aplica correções automaticamente.

## Atualização da Etapa 34A.1 — Filtros e navegação funcional

### Corrigido

- Gráficos passou a permitir a alteração do período diretamente na própria tela.
- O seletor de Gráficos reutiliza o estado compartilhado de período e mantém consistência com Financeiro, Relatório e Ranking.
- Gráficos passou a expor Hoje, Semana, Mês, Ano, Tudo e intervalo personalizado, incluindo mês e ano explícitos.
- Datas de mês, eixo e interface passaram a usar formatadores centralizados: `Julho 2026`, `Jul/26` e `25/07/2026`.
- O eixo do gráfico mantém todos os pontos, mas reduz os rótulos exibidos de forma proporcional para evitar sobreposição.
- A aba Entregas deixou de oferecer a alternância Hoje/Todas e passou a representar somente a operação do dia.
- O histórico permanece separado em Mais → Histórico.
- A data operacional é apresentada de forma amigável, como `Hoje, 25 de julho`.
- Entregas passou a filtrar pagamento, entrega realizada/não realizada e nota fiscal.
- Chips de filtro são exibidos somente quando representam filtros ativos e podem ser removidos individualmente.
- A seleção múltipla fica oculta quando não há registros e mostra quantidade/cancelamento quando ativa.
- O EmptyState informa a data operacional e oferece Nova entrega ou limpeza dos filtros conforme o caso.
- Foi corrigida a dependência de `toISOString()` para o cálculo do dia operacional, usando a data local.
- Nenhuma fórmula financeira, gravação Firebase ou estrutura persistida foi alterada.

### Testes adicionados ou atualizados

- seleção explícita de mês e ano;
- formatação `Julho 2026`, `Jul/26` e `25/07/2026`;
- período vazio e série com múltiplos períodos;
- seleção inteligente de rótulos em série extensa;
- filtros combinados de pagamento, entrega e nota fiscal;
- comportamento sem filtros ativos.

### Pendente

- validação visual final no Expo Web com dados reais e séries longas;
- validação nativa em Development Build;
- comparação visual dos controles com o Ionic em diferentes tamanhos de tela;
- validação de acessibilidade dos novos filtros em VoiceOver e TalkBack.

### Polimento futuro

- calendário nativo para intervalos personalizados;
- tooltip acessível nos pontos do gráfico;
- navegação horizontal para séries muito extensas;
- seleção de data operacional diferente de hoje, caso esse fluxo seja aprovado futuramente.

## Atualização da Etapa 34A.3 — Paridade funcional do mapa e rotas

### Corrigido

- O mapa Web deixou de ser um placeholder e passou a usar a Google Maps JavaScript API por meio de carregamento assíncrono.
- A tela de rota Web agora exibe marcadores de origem, paradas obrigatórias, entregas e destino final.
- As Polylines decodificadas pela camada de rotas são desenhadas por trecho e o viewport é ajustado à rota.
- A correção de endereço passou a permitir seleção de ponto manual no mapa Web, mantendo a coordenada apenas na sessão.
- A ausência de chave Web, centro ou pontos confirmados produz estado explícito de erro/vazio; nenhuma coordenada aleatória é criada.
- O mapa nativo continua separado por plataforma: Apple Maps no iOS e Google Maps no Android via `expo-maps`.
- O primeiro preset permanece `Flamboyant → Entregas → Francisco`, conforme decisão mais recente; o segundo permanece `PLAV → Entregas → Flamboyant → Francisco`.
- A gravação da quilometragem agora exige confirmação e não ocorre durante a simples visualização do mapa.
- A chave Web é pública apenas no sentido necessário ao navegador e deve ser restrita por domínio; a chave sensível de Routes permanece no proxy.

### Testes

- estado Web sem paradas;
- estado Web sem chave;
- seleção manual com centro inicial;
- montagem do payload de quilometragem;
- rota com uma e múltiplas entregas;
- endereço inválido;
- ponto manual;
- presets;
- mais de 25 paradas;
- regra de Viana.

### Pendente

- validação real do mapa Google Maps Web com uma chave restrita configurada;
- validação de Apple Maps e Google Maps em Development Build;
- validação de toque manual no mapa em iPhone e Android físicos;
- validação real das quotas e respostas de uso do `routeProxy` com dados controlados; o deploy e o vínculo do secret já foram confirmados.

### Confirmacao da separacao de projetos

- Firebase Authentication, Realtime Database, Cloud Functions e Secret Manager permanecem no projeto `venda-e-faturamento`.
- Geocoding API, Routes API, faturamento e a chave server-side pertencem ao projeto Google Cloud `Meu Otimizador`.
- A chave utilizada pelo proxy esta restrita somente a Geocoding API e Routes API.
- O secret `GOOGLE_MAPS_SERVER_API_KEY` foi atualizado no projeto Firebase e a `routeProxy` foi republicada em `us-central1`.
- URL publicada: `https://us-central1-venda-e-faturamento.cloudfunctions.net/routeProxy`.
- Essa separacao e intencional e nao constitui divergencia de arquitetura.

### Riscos mantidos

- Google Maps Platform possui cobrança por evento e limites definidos no projeto Google Cloud `Meu Otimizador`; o faturamento desse projeto está habilitado;
- `expo-maps` continua exigindo Development Build e não foi declarado validado em aparelho físico;
- nenhum contrato Firebase, cálculo financeiro ou estrutura de backup foi alterado.
