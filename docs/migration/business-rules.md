# Regras de negócio e cálculos do Ionic

## Escopo

Este documento registra as regras observadas no projeto original em `ionic-reference`, sem corrigir, simplificar ou reinterpretar comportamentos. Ele é uma referência para a migração React Native e não autoriza alteração de fórmulas, datas de corte, valores históricos ou do contrato atual do Firebase.

Fontes principais:

- `ionic-reference/public/index.html`;
- `ionic-reference/functions/index.js`;
- `docs/migration/ionic-analysis.md`;
- `docs/migration/confirmed-decisions.md`;
- `docs/migration/firebase-map.md`.

As linhas citadas referem-se ao arquivo Ionic consultado durante esta análise e servem para localização técnica; a implementação React Native deverá preservar o comportamento, mesmo que a organização futura em services, repositories, hooks e utils seja diferente.

## Convenções observadas

- Datas persistidas normalmente usam `YYYY-MM-DD`.
- Comparações de datas e meses frequentemente são lexicográficas sobre strings ISO.
- `dataLocal(data)` cria `new Date(data + "T00:00:00")`, evitando a interpretação UTC usada por `new Date("YYYY-MM-DD")`.
- Números passam por `numeroSeguro`: remove `R$` e espaços; converte formatos com ponto e vírgula; valores ausentes, inválidos ou não finitos resultam em `0`.
- Valores de entrega são armazenados em `item.valor`; quantidades em `item.quantidade`.
- O status de pagamento persistido é comparado literalmente com `"Pago"`. Qualquer outro valor é tratado como não pago em vários resumos.
- Não há autorização para substituir as regras por arredondamentos, índices, IDs ou fórmulas mais simples.

## 1. Normalização numérica

**Nome:** `numeroSeguro`.

**Origem no Ionic:** `ionic-reference/public/index.html:10833-10846`, utilizado por praticamente todos os cálculos.

**Entradas:** número, string monetária, string decimal, valor nulo, vazio, indefinido ou inválido.

**Fórmula/processamento:** números finitos permanecem iguais; `null`, `undefined` e vazio viram `0`; remove `R$` e espaços; quando há ponto e vírgula, remove pontos de milhar e troca vírgula por ponto; quando há apenas vírgula, troca por ponto; converte com `Number`.

**Resultado:** número finito ou `0`.

**Datas de corte:** não se aplica.

**Casos especiais:** uma string inválida não gera erro de validação nessa função; ela vira `0`. Isso pode mascarar entrada inválida se uma camada de formulário não validar antes.

**Dependências:** todos os cálculos financeiros, pagamentos, quantidades e custos.

**Exemplo:** `"R$ 1.234,56"` resulta em `1234.56`; `"abc"` resulta em `0`.

**Teste esperado:** `numeroSeguro("R$ 1.234,56") === 1234.56`, `numeroSeguro(null) === 0` e `numeroSeguro("abc") === 0`.

## 2. Normalização dos nomes de clientes

**Nome:** chave normalizada e formatação de nome.

**Origem no Ionic:** `nomeChave`, `corrigirNomeCliente` e `formatarNomeCliente`, `ionic-reference/public/index.html:10878-10893`.

**Entradas:** nome digitado, nome persistido, nome de tabela de preço ou nome de cliente personalizado.

**Fórmula/processamento:** `nomeChave` aplica `trim`, minúsculas, normalização Unicode NFD e remove marcas de acento. `formatarNomeCliente` aplica aliases, converte para minúsculas, divide por espaços, remove tokens vazios e capitaliza a primeira letra de cada token.

**Resultado:** nome para exibição e chave sem acentos para comparação.

**Datas de corte:** não se aplica.

**Casos especiais:** a divisão é feita por espaço simples; nomes compostos são mantidos como tokens separados depois do filtro de vazios. A normalização não cria um `clientId`.

**Dependências:** seleção de cliente, preço, agrupamento financeiro, ranking, filtros, alertas e migração de dados.

**Exemplo:** `"  márcia  "` é exibido como `Márcia` e sua chave é `marcia`.

**Teste esperado:** nomes com maiúsculas, espaços laterais e acentos devem agrupar-se com o mesmo cliente; não deve ser criado um novo registro apenas por diferença de caixa ou acento.

## 3. Aliases de clientes

**Nome:** correção de aliases históricos.

**Origem no Ionic:** `corrigirNomeCliente`, `ionic-reference/public/index.html:10882-10888`.

**Entradas:** nome bruto do cliente.

**Fórmula:** após `nomeChave`, aplica exatamente:

- `santos` → `Elias`;
- `vianna` → `Viana`;
- `adri guilhem`, `adriguilhem`, `adri guilherme` ou `adri guilhen` → `Adri`;
- demais nomes → valor original, posteriormente formatado.

**Resultado:** nome canônico usado em novas gravações, agrupamentos e consultas.

**Datas de corte:** não se aplica.

**Casos especiais:** os aliases são comparados sem acentos e sem diferenciação de maiúsculas; a regra não prova que qualquer outro nome semelhante seja alias.

**Dependências:** normalização, tabelas de preço, ranking, alertas, migração de entregas e clientes personalizados.

**Exemplo:** `SANTOS` e `santos` convergem para `Elias`; `Adri Guilherme` converge para `Adri`.

**Teste esperado:** os quatro formatos de Adri devem produzir a mesma chave oficial; `Santos` não deve permanecer como um quinto cliente.

## 4. Tabelas históricas de preço

**Nome:** preço por cliente conforme a data da entrega.

**Origem no Ionic:** tabelas e constantes em `ionic-reference/public/index.html:9494-9501`; seleção em `obterTabelaPrecosPorData`, `:10895-10898`.

**Entradas:** cliente e data de referência da entrega.

**Fórmula:**

1. se `data < 2025-05-05`, usar `precosClientes2024_2025`;
2. senão, se `data < 2026-04-05`, usar `precosClientesAntigos`;
3. caso contrário, usar `precosClientesAtuais`.

As comparações são inclusivas no lado novo: a própria data de corte já pertence à tabela posterior.

**Resultado:** preço unitário do cliente ou `null` quando o cliente não existe na tabela selecionada.

**Datas de corte:** `2025-05-05` e `2026-04-05`.

**Casos especiais:** se não houver data, `obterTabelaPrecosPorData` cai na tabela atual. A tabela de 2024/2025 contém `Didi`, mas as tabelas posteriores não; isso deve ser preservado e tratado como ausência quando a data não estiver no primeiro período.

**Dependências:** normalização de nomes, preço personalizado, valor automático de entrega e recebimento da fábrica.

**Valores observados:**

| Tabela | Valores persistidos no Ionic |
|---|---|
| 2024/2025 | Guilherme 40,5; Lu 44,5; Luciano 43,3; Sandro 44,5; Elias 42,9; Viana 44,6; Helder 44,5; Márcia 44,70; Aldo 44,9; Andre 44,5; Vaticano 45; Monique 43,4; Didi 44,5 |
| Antigos | Adri 44,5; Aldo 48,9; Andre 48,5; Escola 48; Familia 55; Gilson 44,5; Guilherme 44,5; Helder 48,5; Lu 48,5; Luciano 47,3; Márcia 49; Monique 47,4; Particular 55; Particular Antigo 55; Sandro 48,5; Elias 46,9; Vaticano 49; Viana 48,6 |
| Atuais | Adri 48,5; Aldo 52; Andre 49,8; Escola 48; Familia 60; Gilson 48,5; Guilherme 48,5; Helder 50; Lu 50; Luciano 49,8; Márcia 52; Monique 49,8; Particular 60; Particular Antigo 55; Sandro 49,8; Elias 49,8; Vaticano 52; Viana 49,8 |

**Exemplo:** uma entrega de `Aldo` em `2026-04-04` usa `48,90`; em `2026-04-05` usa `52,00` se não houver preço customizado.

**Teste esperado:** testar o dia anterior, o próprio dia e o dia posterior a cada corte; validar todos os clientes presentes em cada tabela.

## 5. Datas de corte e precedência de preço customizado

**Nome:** preço personalizado por cliente prevalece sobre tabela histórica.

**Origem no Ionic:** `obterPrecoCliente`, `ionic-reference/public/index.html:10912-10920`; decisão histórica em `clientesCustom`.

**Entradas:** nome do cliente, data de referência, mapa `clientesCustom` e tabelas históricas.

**Fórmula:** normaliza o nome; procura primeiro uma chave em `clientesCustom` cuja chave normalizada seja igual; se encontrada, retorna `numeroSeguro(clientesCustom[chave].preco)`. Somente se não encontrada consulta a tabela escolhida pela data.

**Resultado:** preço unitário customizado, preço histórico ou `null`.

**Datas de corte:** a tabela só é consultada depois da tentativa de preço customizado; portanto o preço customizado não é limitado pelos cortes na função observada.

**Casos especiais:** o preço customizado não é combinado com a tabela, não é multiplicado nessa etapa e não é validado como positivo nessa função. A confirmação de negócio exige preservar a relação atual e não inventar precedência adicional.

**Dependências:** aliases, nome oficial, cálculo do valor da entrega e clientes personalizados.

**Exemplo:** se `clientesCustom["Aldo"].preco = 51`, uma entrega de Aldo em qualquer corte retorna `51` antes de consultar as tabelas.

**Teste esperado:** com preço customizado presente, alterar a data entre todas as faixas não pode alterar o preço unitário retornado; sem customização, a data deve selecionar a tabela correta.

## 6. Cálculo do valor automático da entrega

**Nome:** valor da entrega por cliente, quantidade e data.

**Origem no Ionic:** `calcularValorPorDataClienteQuantidade` e `calcularValorAutomatico`, `ionic-reference/public/index.html:10925-10945`.

**Entradas:** cliente, quantidade, data, preço unitário resolvido e valor padrão.

**Fórmula:** quando há preço e `numeroSeguro(quantidade) > 0`, `valor = Number((preço × quantidade).toFixed(2))`; caso contrário, retorna `numeroSeguro(valorPadrao)`. No formulário, cliente ou quantidade ausentes limpam o campo visível.

**Resultado:** valor monetário calculado e exibido no formulário.

**Datas de corte:** a data seleciona a tabela histórica, salvo preço customizado.

**Casos especiais:** cliente sem preço retorna o valor padrão; quantidade zero ou inválida não calcula; o arredondamento é feito no total da entrega para duas casas.

**Dependências:** `numeroSeguro`, aliases, tabelas, cortes e formulário de entrega.

**Exemplo:** `Aldo`, `3` baldes em `2026-04-04`, sem customização: `48,90 × 3 = 146,70`.

**Teste esperado:** validar cálculo com quantidade decimal conforme a entrada aceita pelo campo, cliente desconhecido, quantidade zero e mudança de data através dos cortes.

## 7. Alteração manual do valor da entrega

**Nome:** valor manual substitui o valor automático no registro.

**Origem no Ionic:** submissão do formulário em `ionic-reference/public/index.html:14001-14037` e `salvarEdicao`/`salvarEdicaoDia` na mesma página.

**Entradas:** valor exibido ou editado, cliente, quantidade, data, status e endereço.

**Fórmula:** o cálculo automático apenas preenche o campo; na criação o valor persistido é `Number(valorInput.value)`. Na edição, o valor persistido é `Number(vEd.toFixed(2))` e não é recalculado automaticamente no salvamento.

**Resultado:** valor manual preservado no registro da entrega.

**Datas de corte:** a alteração manual não muda a data nem a tabela histórica usada para o próximo cálculo automático.

**Casos especiais:** criação valida cliente, quantidade positiva, data, valor numérico e não negativo; edição valida data, quantidade positiva, valor numérico e não negativo. O valor manual pode divergir da tabela sem que a regra observada o impeça.

**Dependências:** formulário, edição, cálculo automático, resumo financeiro e backup.

**Exemplo:** o cálculo sugere `146,70`, o usuário edita para `150,00`; o registro deve guardar `150,00`.

**Teste esperado:** depois de editar manualmente o valor, salvar e recarregar não deve recalcular silenciosamente para o preço tabelado.

## 8. Custo histórico do balde

**Nome:** custo unitário do balde por data.

**Origem no Ionic:** `obterCustoBaldePorData`, `ionic-reference/public/index.html:10922-10923` e uso na fábrica em `:14899-14907`.

**Entradas:** data do custo, entrega ou recebimento da fábrica.

**Fórmula:** se `data` existe e `data < 2026-03-20`, custo unitário `R$ 32,00`; caso contrário, `R$ 35,00`.

**Resultado:** custo unitário histórico do balde.

**Datas de corte:** `2026-03-20` pertence ao custo novo de `R$ 35,00`.

**Casos especiais:** data vazia, malformada ou posterior resulta em `35` pela expressão observada; a função não sinaliza erro de data.

**Dependências:** custo total das entregas, lucro bruto, custo médio, lucro líquido por balde e recebimentos da fábrica.

**Exemplo:** `10` baldes em `2026-03-19` custam `R$ 320,00`; em `2026-03-20`, `R$ 350,00`.

**Teste esperado:** testar `2026-03-19`, `2026-03-20`, data vazia e formato legado.

## 9. Custo de combustível legado

**Nome:** custo de combustível anterior ao modelo de quilometragem.

**Origem no Ionic:** `calcularCustoCombustivelDia`, `ionic-reference/public/index.html:11507-11537`.

**Entradas:** data e registro diário de gastos.

**Fórmula:** normaliza `DD/MM/YYYY` para ISO quando necessário. Para data anterior a `2026-05-01`, retorna `numeroSeguro(gastoDia.gasolina)`.

**Resultado:** custo diário legado de combustível.

**Datas de corte:** `2026-05-01` já usa o modelo atual.

**Casos especiais:** registro ausente retorna `0`; o campo histórico considerado é `gasolina`, mesmo que outros campos existam.

**Dependências:** gastos diários, resumo financeiro, rateios e comparativos.

**Exemplo:** gasto com `{gasolina: "R$ 180,00"}` em `2026-04-30` retorna `180`.

**Teste esperado:** datas antes, na e depois do corte devem seguir modelos diferentes; `DD/MM/YYYY` e ISO equivalente devem produzir o mesmo resultado.

## 10. Custo de combustível atual

**Nome:** custo por quilometragem, preço da gasolina e média de km/l.

**Origem no Ionic:** `calcularCustoCombustivelDia`, `ionic-reference/public/index.html:11514-11537`.

**Entradas:** data, `gastoDia.km`, `gastoDia.precoGasolina`, `gastoDia.tipoCombustivel`.

**Fórmula:** se a data for `>= 2026-05-01` e `km > 0` e `precoGasolina > 0`, `custo = (km / mediaKm) × precoGasolina`. Com `tipoCombustivel` informado, `etanol` usa `5,6 km/l`; qualquer outro valor usa `7,4 km/l`. Sem tipo informado, datas até `2026-06-30` usam `5,6`; depois usam `7,4`.

**Resultado:** custo atual diário de combustível; zero quando os dados mínimos não existem.

**Datas de corte:** mudança do modelo em `2026-05-01`; mudança da média histórica sem tipo após `2026-06-30`.

**Casos especiais:** apesar da constante `MEDIA_KM_POR_LITRO = 5.2`, a função atual utiliza `5.6` ou `7.4`; a constante não participa do cálculo observado. Qualquer tipo diferente de exatamente `"etanol"` é tratado como gasolina.

**Dependências:** gastos diários, média de entrega, custo mensal, rateio por cliente e financeiro.

**Exemplo:** `km=74`, `precoGasolina=6`, tipo `gasolina`: `(74 / 7,4) × 6 = R$ 60,00`. Sem tipo em `2026-06-30`, `(74 / 5,6) × 6 ≈ R$ 79,29`.

**Teste esperado:** testar gasolina, etanol, tipo desconhecido, tipo ausente antes/depois de `2026-06-30`, km zero e preço zero.

## 11. Custo médio de combustível por entrega

**Nome:** custo médio da entrega.

**Origem no Ionic:** `custoMedioEntregaValidoPorData`, `calcularCustoMedioEntregaDia` e `calcularCustoMedioEntregaPeriodo`, `ionic-reference/public/index.html:11539-11560`.

**Entradas:** data, lista de entregas e gastos diários.

**Fórmula:** só considera datas `>= 2026-05-01`. Por dia: `custoCombustivelDia / quantidade de registros de entrega na mesma data`. No período: soma custos diários das datas elegíveis e divide pelo total de registros dessas datas.

**Resultado:** custo médio de combustível por registro de entrega, não por quantidade de baldes.

**Datas de corte:** início em `2026-05-01`.

**Casos especiais:** a contagem usa o número de entregas, não a soma de baldes; sem entrega retorna `0`.

**Dependências:** combustível diário, filtros financeiros e gráficos/resumos.

**Exemplo:** custo diário `R$ 60` e duas entregas no dia resultam em `R$ 30` por entrega.

**Teste esperado:** três registros e dez baldes devem dividir por três; datas anteriores ao corte devem retornar zero.

## 12. Custo Estar

**Nome:** gasto de Estar por grupo de período.

**Origem no Ionic:** `obterCustoEstarPorGrupo`, `ionic-reference/public/index.html:11585-11593`.

**Entradas:** `gastosDiarios`, tipo (`dia`, `semana` ou `mes`) e chave do grupo.

**Fórmula:** soma `numeroSeguro(gastoDia.estar)` para chaves que correspondem exatamente ao dia, à semana ou ao mês.

**Resultado:** custo total de Estar do grupo.

**Datas de corte:** não há corte específico observado.

**Casos especiais:** semanas usam `obterChaveSemana`, definida como mês e semana do mês (`S1`, `S2` etc.), não semana ISO. Dia sem gasto contribui com zero.

**Dependências:** rateio por cliente, gastos do período, lucro líquido e filtros.

**Exemplo:** dois registros de Estar de `20` e `15` no mesmo mês resultam em `35` para o grupo mensal.

**Teste esperado:** validar agrupamento por dia, semana do mês e mês; não usar semana ISO sem confirmação.

## 13. Normalização de meses

**Nome:** chave mensal de despesas.

**Origem no Ionic:** `normalizarChaveMes`, `ionic-reference/public/index.html:9506-9510`.

**Entradas:** chave de mês ou valor livre.

**Fórmula:** aceita o prefixo inicial que corresponde a `YYYY-MM`; caso contrário, usa o mês atual em `obterISOHoje().substring(0, 7)`.

**Resultado:** chave mensal `YYYY-MM`.

**Datas de corte:** não se aplica, mas o fallback depende do relógio atual.

**Casos especiais:** entradas com texto depois de `YYYY-MM` ainda podem ser reduzidas ao prefixo; uma chave inválida não causa erro.

**Dependências:** luz mensal e gastos mensais.

**Exemplo:** `2026-07-extra` vira `2026-07`; ` julho` inválido cai no mês atual.

**Teste esperado:** validar mês válido, mês inválido e impacto do relógio do sistema.

## 14. Luz mensal

**Nome:** valor de luz por mês com compatibilidade legada.

**Origem no Ionic:** `obterCustoLuzMes` e `GASTO_FIXO_LUZ`, `ionic-reference/public/index.html:9503-9520`.

**Entradas:** mês `YYYY-MM`, `gastosMensais[mes]`, campo `luz` quando o registro é objeto.

**Fórmula:** usa `registro.luz` se o registro for objeto; caso contrário usa o próprio registro. Se não houver valor salvo: mês futuro retorna `0`; mês atual ou passado retorna `GASTO_FIXO_LUZ = 100`. Valor existente passa por `numeroSeguro` e `Math.max(0, ...)`.

**Resultado:** custo mensal de luz não negativo.

**Datas de corte:** não há corte histórico numérico; há distinção mês futuro versus atual/passado.

**Casos especiais:** valores negativos salvos viram zero; o fallback de `R$ 100` é uma regra de compatibilidade legada.

**Dependências:** rateio, resumos, comparativos e dados mensais.

**Exemplo:** sem registro para o mês atual: `R$ 100`; sem registro para um mês futuro: `R$ 0`; registro `luz: -10`: `R$ 0`.

**Teste esperado:** testar registro numérico legado, objeto com `luz`, ausência, vazio, negativo e mês futuro.

## 15. Rateio da luz por intervalo

**Nome:** rateio mensal da luz pelos dias trabalhados selecionados.

**Origem no Ionic:** `calcularCustoLuzParaIntervalo`, `ionic-reference/public/index.html:9541-9573`.

**Entradas:** data inicial, data final e custo de luz de cada mês.

**Fórmula:** normaliza início/fim ao meio-dia; percorre o intervalo inclusivo; considera somente segunda, quarta e sexta. Para cada mês: `custoMensal × (dias selecionados do mês / total de segundas, quartas e sextas do mês)`. Soma as parcelas mensais; se um mês não tiver dias calculados, usa o custo integral daquele mês.

**Resultado:** custo de luz proporcional ao intervalo.

**Datas de corte:** não há corte monetário; dias trabalhados são sempre segunda, quarta e sexta.

**Casos especiais:** o intervalo atravessando meses divide cada mês independentemente; início e fim são inclusivos.

**Dependências:** luz mensal, dias trabalhados e filtro de período.

**Exemplo:** luz mensal `100`, mês com `13` dias de trabalho, intervalo contendo `2` deles: parcela `100 × 2/13`.

**Teste esperado:** intervalo de um dia útil, intervalo em fim de semana, intervalo atravessando mês e intervalo com todos os dias úteis do mês.

## 16. Dias trabalhados

**Nome:** calendário de rateios e comparativos.

**Origem no Ionic:** `contarDiasEntregaNoMes` e uso no cálculo da luz, `ionic-reference/public/index.html:9528-9538`.

**Entradas:** ano e mês.

**Fórmula:** percorre todos os dias do mês e conta `Date.getDay() === 1 || 3 || 5`.

**Resultado:** quantidade de segundas, quartas e sextas no mês.

**Datas de corte:** não se aplica.

**Casos especiais:** domingo é `0`; sábado é `6`; não são considerados feriados. A decisão confirmada determina que segunda, quarta e sexta permanecem válidos.

**Dependências:** rateio da luz, comparação mensal e qualquer cálculo baseado em dias trabalhados.

**Exemplo:** o denominador mensal da luz é a quantidade de ocorrências de segunda, quarta e sexta, não todos os dias do mês.

**Teste esperado:** validar meses de 28, 29, 30 e 31 dias e verificar que somente os três dias da semana entram.

## 17. Rateio de despesas para um cliente

**Nome:** despesas rateadas por cliente e baldes.

**Origem no Ionic:** `obterGastosRateadosParaCliente`, `ionic-reference/public/index.html:11621-11650`.

**Entradas:** lista de entregas do cliente, busca de cliente, filtro de status, período, gastos diários e luz mensal.

**Fórmula:**

- sem busca de cliente, retorna `null`, habilitando o total geral;
- agrupa entregas do cliente por dia, semana do mês ou mês conforme o período selecionado;
- calcula `proporcaoCliente = baldesClienteDoGrupo / baldesTotaisDoGrupo`;
- Estar: `EstarDoGrupo × proporcaoCliente`;
- combustível: `combustivelBaseDoGrupo × proporcaoCliente`;
- luz: para cada dia do cliente, `(luzMensal / diasDeTrabalhoDoMês) × (baldesClienteDoDia / baldesTotaisDoDia)`.

**Resultado:** `{ estar, combustivel, luz }` rateado.

**Datas de corte:** combustível e balde mantêm seus próprios cortes; luz usa o mês de cada entrega.

**Casos especiais:** combustível de grupo diário é o custo mensal dividido pelos dias do mês; semanal é o custo mensal dividido pelas semanas de sete dias do mês. O total de baldes do denominador respeita o filtro de status.

**Dependências:** filtros, Estar, combustível, luz, dias trabalhados e normalização de datas.

**Exemplo:** cliente possui `2` de `10` baldes no grupo e Estar do grupo é `50`; parcela do cliente é `10`.

**Teste esperado:** comparar rateio com e sem busca de cliente; validar denominadores com filtro de status e grupos atravessando meses.

## 18. Faturamento

**Nome:** faturamento bruto do período.

**Origem no Ionic:** `atualizarResumo` e `obterDadosResumoAtual`, `ionic-reference/public/index.html:13310-13327` e `:12073-12100`.

**Entradas:** entregas filtradas, `item.valor`.

**Fórmula:** `faturamento = Σ numeroSeguro(item.valor)`.

**Resultado:** total faturado no período filtrado, independentemente de estar pago.

**Datas de corte:** depende do período selecionado; o valor manual persistido é a entrada.

**Casos especiais:** valores inválidos viram zero; não recalcula o preço histórico.

**Dependências:** filtros de período, cliente e status; valor da entrega.

**Exemplo:** entregas de `100` e `80`: faturamento `180`.

**Teste esperado:** conferir soma após filtro de data, busca e status; verificar que status não pago ainda compõe faturamento.

## 19. Valores pagos

**Nome:** faturamento com status quitado.

**Origem no Ionic:** `atualizarResumo`, `ionic-reference/public/index.html:13313-13318`.

**Entradas:** entregas filtradas e `item.status`.

**Fórmula:** soma `item.valor` somente quando `item.status === "Pago"`.

**Resultado:** total pago.

**Datas de corte:** não há.

**Casos especiais:** comparação literal; caixa, acento ou status diferente não são normalizados. O pagamento permitido na decisão atual é Dinheiro ou Pix, escolhido explicitamente ao quitar uma entrega, mas o contrato legado do resumo guarda principalmente o status.

**Dependências:** status da entrega, quitação e alertas.

**Exemplo:** valores `100` Pago e `80` Não Pago: pagos `100`.

**Teste esperado:** somente o literal `Pago` entra; `Não Pago`, vazio e outros status ficam fora.

## 20. Valores pendentes

**Nome:** faturamento não quitado.

**Origem no Ionic:** `atualizarResumo` e `atualizarAlertaNaoPagoGeral`, `ionic-reference/public/index.html:13313-13318` e `:12222-12245`.

**Entradas:** entregas filtradas e status.

**Fórmula:** para o resumo, soma todos os valores cujo status não seja exatamente `Pago`; para o alerta, filtra adicionalmente `status === "Não Pago"` e `entregue === true`.

**Resultado:** pendência financeira do resumo ou valor aberto do alerta.

**Datas de corte:** período do resumo/alerta.

**Casos especiais:** resumo e alerta não têm exatamente o mesmo conjunto: um trata qualquer status diferente de Pago como pendente; o outro exige `Não Pago` e entrega realizada.

**Dependências:** status, entregue, filtros, alertas e lembretes de cobrança.

**Exemplo:** uma entrega com status desconhecido entra no total não pago do resumo, mas não entra no alerta específico `Não Pago`.

**Teste esperado:** testar a diferença entre status não `Pago` e status exatamente `Não Pago`; testar entrega não realizada no alerta.

## 21. Custo total dos baldes

**Nome:** custo direto dos baldes vendidos.

**Origem no Ionic:** `atualizarResumo`, `calcularLucroLiquidoListaPeriodo` e comparativos.

**Entradas:** quantidade e data de cada entrega.

**Fórmula:** `custoTotal = Σ numeroSeguro(quantidade) × obterCustoBaldePorData(data)`.

**Resultado:** custo direto total.

**Datas de corte:** custo unitário muda em `2026-03-20`.

**Casos especiais:** a quantidade é somada conforme os registros filtrados; não há filtro implícito por `entregue` nesses resumos.

**Dependências:** custo histórico do balde, quantidade e filtros.

**Exemplo:** dois baldes antes do corte e três depois: `2×32 + 3×35 = 169`.

**Teste esperado:** testar entregas em ambos os lados do corte e quantidade inválida convertida por `numeroSeguro`.

## 22. Lucro bruto

**Nome:** lucro antes de Estar, combustível e luz.

**Origem no Ionic:** `atualizarResumo`, `calcularLucroLiquidoListaPeriodo` e comparativos.

**Entradas:** faturamento e custo total dos baldes.

**Fórmula:** `lucroBruto = faturamento - custoTotal`.

**Resultado:** lucro bruto do conjunto filtrado.

**Datas de corte:** herda o corte do custo do balde.

**Casos especiais:** pode ser negativo; não aplica limite inferior.

**Dependências:** faturamento e custo direto.

**Exemplo:** faturamento `500` e custo de baldes `350`: lucro bruto `150`.

**Teste esperado:** validar resultado negativo quando custo supera faturamento.

## 23. Lucro líquido

**Nome:** lucro após despesas variáveis e luz.

**Origem no Ionic:** `atualizarResumo`, `calcularLucroLiquidoListaPeriodo` e `calcularLucroLiquidoIntervaloComparativo`.

**Entradas:** lucro bruto, Estar, combustível e luz.

**Fórmula:** `gastosVariaveis = estar + combustivel`; `lucroLiquido = lucroBruto - gastosVariaveis - luz`.

**Resultado:** lucro líquido do período.

**Datas de corte:** herda cortes de balde, combustível e luz.

**Casos especiais:** pode ser negativo. Para cliente buscado, despesas podem ser rateadas; sem busca, usa despesas do período completo. Em alguns cálculos de lista, a luz pode ser calculada pelo intervalo entre menor e maior data da lista.

**Dependências:** todas as regras de custo, rateio e filtros.

**Exemplo:** bruto `150`, Estar `20`, combustível `30`, luz `10`: líquido `90`.

**Teste esperado:** validar cálculo geral e rateado para cliente, lista vazia e lucro negativo.

## 24. Margem bruta

**Nome:** percentual de lucro bruto sobre faturamento.

**Origem no Ionic:** `atualizarResumo`, `ionic-reference/public/index.html:13320-13327`.

**Entradas:** lucro bruto e faturamento.

**Fórmula:** se faturamento `> 0`, `margemBruta = (lucroBruto / faturamento) × 100`; caso contrário, `0`.

**Resultado:** percentual.

**Datas de corte:** herda os cálculos de faturamento e balde.

**Casos especiais:** faturamento zero retorna zero, mesmo se houver custo.

**Dependências:** lucro bruto e faturamento.

**Exemplo:** bruto `150` sobre faturamento `500`: `30%`.

**Teste esperado:** faturamento zero, margem negativa e arredondamento apenas na exibição.

## 25. Margem líquida

**Nome:** percentual de lucro líquido sobre faturamento.

**Origem no Ionic:** `atualizarResumo`, `ionic-reference/public/index.html:13320-13327`.

**Entradas:** lucro líquido e faturamento.

**Fórmula:** se faturamento `> 0`, `margemLiquida = (lucroLiquido / faturamento) × 100`; caso contrário, `0`.

**Resultado:** percentual.

**Datas de corte:** herda todas as regras de custo.

**Casos especiais:** pode ser negativa; faturamento zero resulta em zero.

**Dependências:** lucro líquido e faturamento.

**Exemplo:** líquido `90` sobre faturamento `500`: `18%`.

**Teste esperado:** validar luz/combustível que levem margem abaixo de zero.

## 26. Custo médio completo

**Nome:** custo médio por balde.

**Origem no Ionic:** `atualizarResumo`, `ionic-reference/public/index.html:13320-13327`.

**Entradas:** custo dos baldes, Estar, combustível, luz e quantidade total.

**Fórmula:** `custoCompletoTotal = custoTotal + estar + combustivel + luz`; se quantidade `> 0`, `custoMedioBalde = custoCompletoTotal / quantidade`; caso contrário, `0`.

**Resultado:** custo médio completo por balde.

**Datas de corte:** herda todos os custos.

**Casos especiais:** não é o mesmo que o custo médio de combustível por entrega; inclui custos rateados e luz.

**Dependências:** custo total, despesas e quantidade.

**Exemplo:** custo completo `400` e `10` baldes: `R$ 40,00` por balde.

**Teste esperado:** distinguir divisão por baldes da divisão por registros de entrega.

## 27. Preço médio de venda

**Nome:** venda média por balde.

**Origem no Ionic:** `atualizarResumo`, `ionic-reference/public/index.html:13320-13327`.

**Entradas:** faturamento e quantidade.

**Fórmula:** se quantidade `> 0`, `mediaVendaBalde = faturamento / quantidade`; caso contrário, `0`.

**Resultado:** preço médio de venda por balde.

**Datas de corte:** valores históricos já estão refletidos em `item.valor`; não recalcula os registros.

**Casos especiais:** inclui entregas pagas e não pagas presentes no filtro.

**Dependências:** faturamento, quantidade e filtros.

**Exemplo:** faturamento `500` e `10` baldes: `R$ 50,00`.

**Teste esperado:** quantidade zero deve retornar zero; valor manual deve ser usado como armazenado.

## 28. Lucro líquido por balde

**Nome:** resultado líquido unitário.

**Origem no Ionic:** `atualizarResumo`, `ionic-reference/public/index.html:13320-13327`.

**Entradas:** lucro líquido e quantidade total.

**Fórmula:** se quantidade `> 0`, `lucroLiquidoPorBalde = lucroLiquido / quantidade`; caso contrário, `0`.

**Resultado:** lucro líquido médio por balde.

**Datas de corte:** herda todos os componentes do lucro líquido.

**Casos especiais:** pode ser negativo; não usa `mediaVendaBalde - custoMedioBalde` como fórmula independente, embora matematicamente isso possa coincidir quando as mesmas entradas forem usadas.

**Dependências:** lucro líquido e quantidade.

**Exemplo:** lucro líquido `90` e `10` baldes: `R$ 9,00` por balde.

**Teste esperado:** validar consistência com a divisão direta e com lucro negativo.

## 29. Pagamentos parciais da fábrica

**Nome:** pagamentos associados a um recebimento da fábrica.

**Origem no Ionic:** `adicionarPagamentoFabrica`, `excluirPagamentoFabrica` e estrutura criada por `registrarRecebimentoFabrica`, `ionic-reference/public/index.html:14962-15030`.

**Entradas:** recebimento, data do pagamento e valor do pagamento.

**Fórmula:** pagamento válido exige data, valor numérico e valor `> 0`; adiciona `{ id, data, valor }` ao array `pagamentos`. Total pago é `Σ numeroSeguro(p.valor)`.

**Resultado:** saldo implícito `valorTotal - totalPago` e lista de parcelas.

**Datas de corte:** `valorTotal` usa custo do balde por data do recebimento.

**Casos especiais:** não há limite explícito para pagamento acima do total; remoção exige confirmação; ao remover, o estado de conclusão pode ser desmarcado.

**Dependências:** recebimentos da fábrica, custo histórico do balde e persistência Firebase.

**Exemplo:** total `350`, pagamentos `100` e `250`: total pago `350`.

**Teste esperado:** impedir valor zero/negativo, aceitar parcelas válidas, somar parcelas e recalcular conclusão ao excluir.

## 30. Conclusão automática da fábrica

**Nome:** fechamento automático quando o recebimento é integralmente pago.

**Origem no Ionic:** `adicionarPagamentoFabrica` e `excluirPagamentoFabrica`, `ionic-reference/public/index.html:14962-15030`.

**Entradas:** `item.valorTotal` e soma dos pagamentos.

**Fórmula:** após adicionar pagamento, se `Math.abs(valorTotal - totalPago) < 0.01`, define `concluido = true`. Ao excluir, se a diferença for `>= 0.01`, define `concluido = false`.

**Resultado:** estado booleano `concluido`.

**Datas de corte:** valor total depende do custo do balde na data do recebimento.

**Casos especiais:** o usuário também pode alterar manualmente `concluido` por `alternarConcluidoFabrica`; o código não recalcula automaticamente após toda e qualquer alteração manual.

**Dependências:** pagamentos parciais, recebimentos e confirmação manual.

**Exemplo:** diferença de `0,009` conclui; diferença de `0,01` não conclui automaticamente.

**Teste esperado:** validar a tolerância exata de `0,01`, pagamento parcial, pagamento integral, excedente e exclusão de parcela.

## 31. Filtros de período

**Nome:** filtro de entregas e despesas por período.

**Origem no Ionic:** `passaNoFiltroPeriodo`, `passaNoFiltroFinanceiro` e `obterEntregasFiltradas`, `ionic-reference/public/index.html:11417-11460`.

**Entradas:** período selecionado, mês, dia, intervalo, semana-base e data do item.

**Fórmula:**

- `todos`: aceita tudo;
- `mes`: `item.data.startsWith(mesSelecionado)`;
- `dia`: `item.data === diaSelecionado`;
- `range`: `dataInicioSelecionada <= item.data <= dataFimSelecionada`;
- `semana`: compara semanas iniciadas no domingo por `mesmaSemana`.

**Resultado:** item incluído ou excluído do conjunto filtrado.

**Datas de corte:** filtros usam datas persistidas; não alteram cortes de preço/custo.

**Casos especiais:** semana não é ISO; filtros de despesas usam a mesma função de período; na aba de entrega, a lista usa a data do formulário ou o dia atual e ignora os filtros gerais.

**Dependências:** resumo financeiro, ranking, alertas, histórico e rota.

**Exemplo:** em `range`, uma entrega na data inicial e outra na final entram por serem limites inclusivos.

**Teste esperado:** testar todos os modos, limites de range, virada de mês/ano e semana de domingo a sábado.

## 32. Busca e filtro de status

**Nome:** busca textual de cliente e filtro de status.

**Origem no Ionic:** `obterEntregasFiltradas` e `obterEntregasParaResumoFinanceiro`, `ionic-reference/public/index.html:11339-11460`.

**Entradas:** texto de busca, `filtroStatus`, nome formatado e `item.status`.

**Fórmula:** busca usa `toLowerCase().trim()` e verifica `includes`; status aceita todos quando é `"Todos"`, ou igualdade literal.

**Resultado:** lista filtrada.

**Datas de corte:** não se aplica.

**Casos especiais:** a busca usa nome formatado; status não é normalizado. O filtro de status também influencia denominadores de baldes no rateio.

**Dependências:** nomes, status, período e rateio.

**Exemplo:** busca `"ald"` encontra `Aldo`; `pago` minúsculo não equivale a `Pago`.

**Teste esperado:** testar acentos/aliases, caixa do texto, `Todos` e status desconhecido.

## 33. Ordenações

**Nome:** ordenação das entregas, ranking e alertas.

**Origem no Ionic:** `obterEntregasFiltradas`, `atualizarRanqueamentoClientes`, `atualizarRanqueamentoClientesFinanceiro` e `atualizarAlertaNaoPagoGeral`.

**Entradas:** listas filtradas, datas, nomes, valores e quantidades.

**Fórmula:**

- entregas: data decrescente e, em empate, nome formatado crescente com locale `pt-BR`;
- ranking: valor decrescente, quantidade decrescente e nome crescente `pt-BR`;
- alerta de não pagos: valor decrescente e nome crescente `pt-BR`.

**Resultado:** listas apresentadas na ordem observada.

**Datas de corte:** não se aplica.

**Casos especiais:** histórico agrupa primeiro por mês e depois por dia; ranking usa nome oficial normalizado; lista da aba de entrega restringe à data-alvo antes da ordenação.

**Dependências:** normalização de nomes, filtros e renderização.

**Exemplo:** duas entregas do mesmo dia aparecem em ordem alfabética pelo nome formatado.

**Teste esperado:** empates em cada chave devem testar a chave seguinte, inclusive nomes com acentos em locale `pt-BR`.

## 34. Comparação mensal

**Nome:** comparação com período equivalente do mês anterior.

**Origem no Ionic:** `obterPeriodoComparativoMesAnterior` e atualizadores de comparação, `ionic-reference/public/index.html:12334-12600`.

**Entradas:** mês/data selecionado, data atual, entregas, status e busca.

**Fórmula:** define o intervalo atual; para o mês atual, termina no dia de hoje; para mês fechado, usa o mês selecionado. Conta dias de segunda/quarta/sexta no intervalo atual. No mês anterior, encontra a data que contém a mesma quantidade de dias trabalhados e fecha o intervalo anterior nela. Para cada indicador: `diferença = atual - anterior`; percentual usa `diferença / anterior × 100` para faturamento e entregas, e `diferença / abs(lucroAnterior) × 100` para lucro líquido. Sem base, usa `100` quando o atual é não zero, senão `0`.

**Resultado:** seta, percentual e valor anterior comparável.

**Datas de corte:** comparação é temporal, mas mantém cortes históricos dos cálculos.

**Casos especiais:** lucro líquido usa valor absoluto como denominador; diferença zero é positiva (`>= 0`); filtros de status e busca são aplicados aos dois intervalos.

**Dependências:** dias trabalhados, filtros, faturamento, entregas e lucro líquido.

**Exemplo:** atual `120`, anterior `100`: `+20%`; anterior zero e atual `50`: `+100%`.

**Teste esperado:** mês atual parcial, mês fechado, transição de ano, nenhum dia de trabalho, base zero e lucro anterior negativo.

## 35. Ranking de clientes

**Nome:** ranking por faturamento do cliente.

**Origem no Ionic:** `atualizarRanqueamentoClientes` e `atualizarRanqueamentoClientesFinanceiro`, `ionic-reference/public/index.html:11902-11945` e `:13380-13420`.

**Entradas:** entregas filtradas por período, status e, no painel financeiro, busca; cliente, valor e quantidade.

**Fórmula:** agrupa por `nomeChave(obterNomeOficialCliente(cliente))`; soma valor, quantidade e número de entregas; ordena por valor desc, quantidade desc, nome `pt-BR` asc. Barra = `max(4, min(100, valor/maiorValor × 100))`, com `maiorValor >= 1`.

**Resultado:** ranking e percentual visual relativo ao maior valor.

**Datas de corte:** valores usam o que está gravado nas entregas.

**Casos especiais:** clientes com aliases são consolidados; a barra mínima é `4%`, mesmo para valor zero.

**Dependências:** normalização, filtros, faturamento e renderização.

**Exemplo:** valores `200`, `100`, `0` geram referências de `100%`, `50%` e no mínimo `4%`.

**Teste esperado:** aliases no mesmo grupo, empate de valor, empate de quantidade, lista vazia e valor zero.

## 36. Marcação automática de entrega realizada

**Nome:** migração de entrega passada para entregue.

**Origem no Ionic:** `migrarDados`, `ionic-reference/public/index.html:11078-11105`; decisão confirmada em `docs/migration/confirmed-decisions.md`.

**Entradas:** entregas, data atual ISO, `item.data` e `item.entregue`.

**Fórmula:** durante `migrarDados`, se `item.data < hojeISO` e `item.entregue === false`, define `entregue = true`; se houver alterações, chama `salvarDados`.

**Resultado:** entrega passada marcada como realizada automaticamente.

**Datas de corte:** comparação é estritamente anterior ao dia atual; a data de hoje não é alterada por essa regra.

**Casos especiais:** a condição confirmada exige `entregue === false`; o relatório não autoriza marcar valores nulos ou ausentes sem confirmar a equivalência. A rotina também normaliza clientes e datas legadas.

**Dependências:** inicialização/migração de dados, persistência de entregas e histórico.

**Exemplo:** hoje `2026-07-24`, entrega de `2026-07-23` com `entregue: false` vira `true`; entrega de `2026-07-24` permanece como está.

**Teste esperado:** testar ontem, hoje, amanhã, `false`, `true` e ausência de campo; confirmar gravação somente quando houver mudança.

## 37. Estado da nota fiscal

**Nome:** emissão de nota/boleto.

**Origem no Ionic:** criação de entrega e `alternarStatusNota`, `ionic-reference/public/index.html:14014-14024` e `:9308-9323`.

**Entradas:** entrega, checkbox de emissão e `invoiceStatus`.

**Fórmula:** novas entregas recebem `invoiceStatus: "a_emitir"`; checkbox marcado grava `"emitido"`; desmarcado grava `"a_emitir"`.

**Resultado:** estado persistido e apresentação `emitido` ou `a emitir`.

**Datas de corte:** painel de notas/bilhetes filtra entregas a partir de `2026-03-12` para clientes `Escola`, `Elias` e `Aldo`.

**Casos especiais:** o painel considera `invoiceStatus === "emitido"`; ausência ou qualquer outro valor é tratado visualmente como `a emitir`. A regra observada chama o conjunto de notas/bilhetes, sem evidência de emissão fiscal externa.

**Dependências:** entregas, clientes oficiais e dashboard.

**Exemplo:** uma nova entrega de Aldo em `2026-03-12` aparece como `a emitir`; marcar o checkbox muda para `emitido`.

**Teste esperado:** criação, marcar, desmarcar, valor ausente e datas/clientes fora do recorte do painel.

## 38. Alertas de cobrança na interface

**Nome:** alerta de valores não pagos.

**Origem no Ionic:** `atualizarAlertaNaoPagoGeral`, `ionic-reference/public/index.html:12222-12320`.

**Entradas:** lista, período do alerta, status, `entregue`, cliente, valor e quantidade.

**Fórmula:** filtra `status === "Não Pago" && entregue === true`; agrupa pelo nome oficial normalizado; soma valor, quantidade e número de entregas; ordena valor desc e nome `pt-BR` asc; total aberto é a soma dos valores agrupados.

**Resultado:** total aberto, lista por cliente, quantidade de baldes e entregas e estado vazio.

**Datas de corte:** período é `dia`, `semana`, `mes` ou todos; os textos usam o período selecionado, sem mudar a regra financeira.

**Casos especiais:** entrega não realizada não aparece; status diferente de `Não Pago` não aparece, mesmo que também seja diferente de `Pago`; painel geral pode usar toda a lista e demais abas a lista filtrada.

**Dependências:** nomes, filtros, status, entrega realizada e faturamento pendente.

**Exemplo:** duas entregas não pagas e realizadas do mesmo cliente, `50` e `70`, resultam em um cliente com `R$ 120`, dois registros e a soma das quantidades.

**Teste esperado:** validar agrupamento por alias, exclusão de não entregue, ordenação e estado vazio.

## 39. Lembretes de cobrança por notificação

**Nome:** lembrete automático de cobranças abertas.

**Origem no Ionic:** `ionic-reference/functions/index.js`, função agendada `executarLembreteCobranca`.

**Entradas:** todos os usuários no Realtime Database, `pushToken`, array de entregas, status, cliente e valor.

**Fórmula:** para cada usuário com token e entregas, percorre as entregas; filtra somente `status === "Não Pago"`; agrupa por cliente; soma `Number(valor)` quando numérico, caso contrário `parseFloat` ou `0`; envia uma notificação se houver pelo menos um cliente aberto.

**Resultado:** mensagem FCM por usuário com quantidade de clientes, total e lista agrupada.

**Datas de corte:** agendada para `0 15 * * 1-5`, timezone `America/Sao_Paulo` — dias úteis de segunda a sexta na função, diferentes do conjunto de rateio segunda/quarta/sexta.

**Casos especiais:** não filtra `entregue === true`; cliente ausente usa `"Desconhecido"`; array completo legado é percorrido por índices. A notificação usa apenas o status literal `Não Pago`.

**Dependências:** Firebase Functions, token push, entregas e status.

**Exemplo:** dois clientes com três entregas não pagas geram um lembrete único para o usuário com total agrupado.

**Teste esperado:** token ausente, nenhuma pendência, status Pago, cliente ausente, valor string e execução nos dias/horário corretos.

## 40. Dependências entre regras

As dependências observadas devem orientar a migração e a ordem dos testes:

1. `numeroSeguro`, parsing de datas, `nomeChave` e aliases;
2. nomes oficiais, clientes customizados e tabelas históricas;
3. cortes de preço, custo do balde e combustível;
4. criação/edição da entrega e preservação do valor manual;
5. filtros, ordenações e agrupamentos;
6. gastos diários, luz mensal, dias trabalhados e rateios;
7. faturamento, pagamentos, custos, lucros e margens;
8. ranking, comparativos, alertas e lembretes;
9. fábrica, parcelas e conclusão automática;
10. nota fiscal, backup e integrações de notificação.

Nenhuma camada visual deve acessar diretamente essas fórmulas ou o Firebase. Na arquitetura React Native, cada regra deverá ser encapsulada em services/utils testáveis, com repositories preservando os arrays e campos atuais.

## 41. Matriz mínima de testes de regressão

Antes de considerar a migração equivalente, devem existir testes para:

- cada data de corte: dia anterior, dia exato e dia posterior;
- cada tabela de preço e cliente disponível em cada faixa;
- aliases com acentos, caixa e espaços;
- customização prevalecendo sobre tabelas;
- valor automático, valor manual e edição sem recálculo silencioso;
- custo de balde de `32` e `35`;
- combustível legado, atual com gasolina/etanol, tipo ausente e média histórica;
- custo médio dividido por registros, não por baldes;
- Estar por dia, semana do mês e mês;
- luz salva, fallback `100`, mês futuro `0`, negativo e rateio entre meses;
- segunda, quarta e sexta como dias de trabalho;
- faturamento, Pago literal, Não Pago e divergência entre resumo e alerta;
- lucro bruto, líquido, margens e indicadores unitários;
- parcelas da fábrica, tolerância de `0,01`, exclusão e conclusão manual;
- filtros todos/mês/dia/semana/range, busca, status e ordenações;
- comparativo com base zero, lucro negativo e mês parcial;
- ranking com aliases e empates;
- marcação automática apenas para datas anteriores com `entregue === false`;
- estado de nota `a_emitir`/`emitido` e recorte de `2026-03-12`;
- alertas de cobrança e lembretes agendados;
- compatibilidade dos arrays completos do Firebase e dos campos legados.

## 42. Riscos, inconsistências e ambiguidades

1. **Combustível:** `MEDIA_KM_POR_LITRO = 5.2` existe, mas não é usada pela função atual; o cálculo efetivo usa `5.6` e `7.4`.
2. **Semanas:** rateio usa semana do mês e filtros gerais usam semana iniciada no domingo; não há evidência de semana ISO.
3. **Rateio de combustível:** em grupos de dia e semana, a base é o total mensal dividido por dias/semanas do calendário, não o gasto exato do grupo. Isso é peculiar e deve ser preservado até autorização explícita.
4. **Status:** o resumo trata qualquer status diferente de `Pago` como pendente, enquanto o alerta e a Cloud Function exigem exatamente `Não Pago`.
5. **Entrega realizada:** a regra confirmada especifica `entregue === false`; campos ausentes ou nulos não devem ser convertidos sem decisão.
6. **Datas inválidas:** várias funções fazem comparação lexicográfica ou caem em valores padrão, sem validação central explícita.
7. **Luz:** existe fallback histórico fixo de `R$ 100`, mês futuro `R$ 0` e rateio por dias de trabalho; substituir por valor médio ou por dias corridos mudaria o contrato.
8. **Fábrica:** pagamentos acima do total não são bloqueados pelo trecho analisado; também existe alteração manual de conclusão.
9. **Preço manual:** não há recálculo final automático ao editar uma entrega; recalcular no React Native alteraria uma regra observada.
10. **Notas fiscais:** o recorte de `Escola`, `Elias` e `Aldo` a partir de `2026-03-12` parece ser uma regra de apresentação; não foi encontrada integração fiscal externa.
11. **Clientes personalizados:** registros atuais se relacionam por nome; renomear ou excluir exige impacto, backup e atualização de referências conforme decisão confirmada. Não criar `clientId` no contrato atual sem etapa específica.
12. **Pagamentos de entrega:** a decisão confirmada exige escolha explícita entre Dinheiro e Pix; o contrato legado de entrega precisa receber essa informação sem fallback silencioso, mas a regra histórica de persistência do método deve ser confirmada antes da implementação.
13. **Notificações:** a Cloud Function usa o token salvo e arrays completos; deve ser validada para iOS e para a versão de runtime adotada, sem alterar a regra de disparo silenciosamente.
14. **Coordenadas:** o fallback aleatório será removido; erro de geocodificação, correção do endereço e seleção manual devem impedir coordenada inventada, mas a fórmula de rota não foi alterada neste documento.

## Decisões confirmadas que este documento preserva

- pagamentos de entrega: somente Dinheiro ou Pix, escolhidos explicitamente;
- não usar Pix como fallback silencioso;
- entregas anteriores ao dia atual continuam sendo marcadas automaticamente como entregues quando `entregue === false`;
- dias de rateio e comparativos: segunda, quarta e sexta;
- preços, custos de balde, combustível, custo médio e luz históricos permanecem válidos;
- não alterar cortes, valores ou fórmulas sem autorização explícita;
- remover fallback aleatório de coordenadas;
- manter arrays completos e o contrato atual do Firebase na primeira versão React Native.

## Decisões ainda necessárias antes da implementação

- forma exata de persistir o método `Dinheiro`/`Pix` no registro atual da entrega;
- comportamento para `entregue` ausente ou nulo na migração;
- validação e tratamento de datas inválidas que hoje caem em defaults;
- política para pagamentos da fábrica acima do valor total;
- confirmação se o recorte de notas deve ser mantido como regra de negócio ou apenas como painel legado;
- comportamento de notificações quando o token está expirado ou inválido;
- campos e modelo da seleção manual de ponto da rota, mantendo o contrato atual.

