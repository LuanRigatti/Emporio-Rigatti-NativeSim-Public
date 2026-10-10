# Recuperar e analisar OSLog do NativeSim

O script `collect-oslog.ps1` baixa, valida e descriptografa no Windows o artifact OSLog criptografado produzido pelo workflow do repositório auxiliar `LuanRigatti/Emporio-Rigatti-NativeSim-Public`. O mesmo fluxo atende qualquer categoria OSLog configurada para a sessão; não é específico do Peek & Pop.

## Requisitos locais

- Windows PowerShell 5.1 (`powershell.exe`).
- GitHub CLI `gh`, autenticado na conta com acesso de leitura aos Actions/artifacts do repositório Public. Para pedir encerramento controlado, a conta também precisa poder criar commit statuses (`statuses:write`).
- `age.exe`; o padrão é `%USERPROFILE%\Tools\age\age.exe`.
- Identidade privada age correspondente ao recipient configurado no GitHub Actions, em `%USERPROFILE%\.config\age\native-sim-identity.txt`.
- A chave privada fica somente no computador. Nunca a copie para o repositório, GitHub, NativeSim, artifact, terminal ou conversa.

O diretório padrão de saída é `%LOCALAPPDATA%\EmporioRigatti\NativeSim\OSLog`, fora do repositório. Ele guarda o artifact cifrado baixado, `manifest.json`, `decrypted.log`, o relatório geral `analysis-report.md` e, quando selecionadas no manifest, os relatórios `analysis-peek-pop.md` e `analysis-widget.md`. Cada execução usa uma nova pasta por run/attempt/horário; arquivos existentes nunca são sobrescritos. `-OutputRoot` pode escolher outro caminho local, mas o script recusa caminhos dentro deste checkout Git.

## Recuperar uma sessão

Com um Run ID conhecido:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\native-sim\collect-oslog.ps1 -RunId 38060942687
```

Para recuperar uma attempt específica, inclusive uma attempt histórica ainda retida, informe os dois identificadores:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\native-sim\collect-oslog.ps1 -RunId 38060942687 -Attempt 1
```

Sem `-Attempt`, somente a attempt atual é considerada. `-Stop` só pode encerrar a attempt atual; uma attempt histórica é recuperável sem `-Stop`, mas nunca pode receber um sinal de encerramento.

Para seleção automática, omita `-RunId`. O script examina as páginas recentes do workflow até cobrir dois dias (o artifact atual retém por um dia) e escolhe somente quando encontra exatamente uma sessão `in_progress` elegível ou exatamente uma sessão concluída com artifact OSLog da attempt atual ainda disponível. Se houver mais de uma, se uma execução ativa não puder ser identificada com segurança ou se a enumeração não puder ser completada, nenhuma é escolhida e a mensagem pede o `-RunId` correto. Execuções em fila não são escolhidas automaticamente.

Antes de baixar, ele verifica o repositório, o caminho do workflow `.github/workflows/native-sim.yml`, o tipo de execução, SHA, run attempt e estado no GitHub. Uma execução concluída pode ser recuperada sem pedir novo encerramento. Artifacts de attempts anteriores não são selecionados automaticamente; use `-Attempt` para escolher uma explicitamente.

## Solicitar graceful-stop

Quando a pessoa terminou de testar e autoriza encerrar a sessão, use `-Stop`:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\native-sim\collect-oslog.ps1 -RunId 38060942687 -Stop -TimeoutSeconds 2400
```

O script confirma que a captura OSLog iniciou e que o workflow ainda está ativo. Em seguida publica no SHA real do workflow o commit status `native-sim-stop/{run_id}` com `success` / `stop requested`, aguarda a finalização e o upload criptografado. Um pedido repetido no mesmo attempt é idempotente. Um status antigo de outra attempt é tratado como ambíguo e bloqueia o novo pedido.

Sem `-Stop`, a sessão nunca é encerrada pelo script. Se ainda estiver ativa, ele apenas aguarda até concluir ou até `-TimeoutSeconds`; timeout não envia stop, não cancela a execução e não chama `native-sim down`. O padrão é 1800 segundos; o intervalo de consulta pode ser alterado com `-PollIntervalSeconds`.

## Ferramentas e caminhos personalizados

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\native-sim\collect-oslog.ps1 `
  -RunId 38060942687 `
  -AgePath 'D:\Tools\age\age.exe' `
  -IdentityPath 'D:\Private\age\identity.txt' `
  -OutputRoot 'D:\Private\NativeSimLogs'
```

`-GhPath` também aceita um caminho alternativo para `gh`. Os parâmetros mudam somente os caminhos locais; não alteram a categoria da captura já executada.

## Filtro e conteúdo capturado

O modo padrão captura por subsistema, limitado ao prefixo `com.pareact.mobile` (app e extensões; atualmente o WidgetKit usa `com.pareact.mobile.ExpoWidgetsTarget`) e ao subsistema app-owned `NativeAppleIntelligence`. Isso recebe categorias futuras dentro desses subsistemas sem alterar Actions variables e exclui subsistemas não relacionados do iOS. Logger novo deve usar o bundle identifier do app/extension como subsystem; se uma integração futura tiver um subsystem estático próprio, o seletor app-owned precisa ser ampliado de modo explícito e restrito.

A variável legada `NATIVE_SIM_LOG_CATEGORIES` não restringe o modo padrão. Para aplicar categorias específicas, escolha `log_filter_mode=category` no dispatch do workflow; então o valor configurado é validado como 1–8 categorias OSLog e o manifesto registra `filter_mode=category`, lista e predicado exatos. Não é aceito texto de predicate fornecido pelo usuário.

Exemplos de captura configurada no NativeSim Public:

```text
log_filter_mode=subsystem (padrão; variável legada de categorias ignorada)
log_filter_mode=category + NATIVE_SIM_LOG_CATEGORIES=RigattiWidgetSync,NativeSimSyntheticSecondary
log_filter_mode=category + NATIVE_SIM_LOG_CATEGORIES=UIKitNavigation,NativeSwiftUI
```

Manifestos schema 3 identificam `filter_mode` e armazenam o predicado efetivo mais os seletores de subsystem ou a lista de categorias. O coletor Windows valida que o filtro por subsystem permanece na allowlist app-owned. Schema 2 anterior continua aceito como categoria explícita. Uma categoria pode não aparecer como rótulo em cada linha compacta; o relatório marca atribuição desconhecida, sem inventar contagens.

Esse mecanismo captura mensagens **OSLog** dos subsistemas/categorias selecionados. `console.log` de JavaScript e logs de build do Xcode não são capturados automaticamente.

## Relatório e privacidade

O script não imprime mensagens brutas dos logs. `analysis-report.md` contém metadados técnicos, horários reconhecidos, contagens, rótulos curtos de eventos reconhecidos e alertas de ausência, divergência, captura parcial ou possível truncamento. Em modo automático, descobre categorias somente em registros cujo subsystem bate com a allowlist e pode criar o relatório do widget quando `RigattiWidgetSync` aparece. Em modo direcionado, analisa as categorias do manifest. O total de registros permanece separado das contagens explicitamente atribuídas. Ausência de rótulo produz atribuição desconhecida, não zero; zero não prova que o código não executou. Não repete mensagens, nomes de clientes ou valores financeiros. O coletor não declara causa raiz automaticamente.

`decrypted.log` é o arquivo completo e pode conter informação sensível. Ele e o artifact baixado ficam somente no diretório local privado escolhido. Revise e proteja esse diretório conforme as políticas do computador; não o versione nem o envie a serviços externos sem autorização.

## Erros comuns

- **Não há seleção inequívoca:** passe somente `-RunId <id>` da sessão desejada.
- **Run/workflow/repositório não confere:** o script interrompe antes de publicar status ou baixar arquivos.
- **Captura desabilitada ou finalizer/upload falhou:** consulte os passos `Finalize PeekPop OSLog capture` e `Upload encrypted PeekPop logs`; sucesso geral do workflow, sozinho, não prova que existe artifact.
- **Artifact ausente/expirado:** confirme o run ID, attempt e retenção. O script não escolhe artifact de outra attempt sem autorização explícita.
- **Hash inválido:** a descriptografia não começa; o artifact é rejeitado.
- **Falha do age:** confira se a identidade local corresponde ao recipient público configurado no NativeSim Public. Nunca envie a chave privada para diagnosticar.
- **Nenhum evento ou captura parcial:** o relatório sinaliza contagem zero, divergência ou `capture_outcome` parcial. A recuperação não transforma ausência de dados em evidência.
- **Timeout:** a execução continua ativa. Reexecute com timeout maior ou use `-Stop` somente quando o encerramento estiver autorizado.
- **Sem acesso à chave neste ambiente:** não envie a chave. Execute a ferramenta em um Windows local que já possua a identidade privada.

## Uso pelo Codex

Quando o pedido for “Terminei os testes no NativeSim. Encerre a sessão e analise os logs.”, isso autoriza o graceful-stop daquela sessão: o Codex deve identificar o único run seguro ou pedir somente o Run ID se houver ambiguidade, então executar este script com `-Stop`, aguardar o artifact, ler o relatório sanitizado e analisar localmente o log completo sem reproduzir mensagens sensíveis no chat. Se estiver em um ambiente remoto sem acesso à identidade privada, deve explicar essa limitação sem pedir a chave.

Para uma sessão que já terminou, executar o mesmo script sem `-Stop`, usando o Run ID ou seleção automática inequívoca. Não é necessário iniciar outra build, sessão NativeSim ou workflow para recuperar um artifact ainda retido.

## Testes locais do utilitário

O smoke test com mocks pode ser executado no PowerShell 5.1:

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File .\scripts\native-sim\tests\collect-oslog.Tests.ps1
```

Ele usa fixtures sintéticas e executáveis mock; verifica relatórios separados, sanitização, recuperação de attempt histórica explícita, bloqueio de encerramento em attempt antiga, sessão ativa, encerramento controlado, timeout, artifacts ausentes/expirados/de outra attempt, manifesto incompatível, hash incorreto e falha do age. Não acessa GitHub, não lê a identidade privada e não inicia build/simulador/workflow.
