# Decisões confirmadas de negócio e arquitetura

Este documento registra decisões permanentes para a migração do projeto original para React Native/Expo.

Nenhuma decisão abaixo autoriza implementação automática nesta etapa. Funcionalidades somente devem ser implementadas após localização dos arquivos relacionados, documentação das regras, apresentação de plano e autorização explícita.

## 1. Métodos de pagamento das entregas

Os únicos métodos permitidos são:

- Dinheiro;
- Pix.

Ao quitar uma entrega, o usuário deverá escolher explicitamente um dos dois métodos. Não utilizar Pix automaticamente como fallback silencioso.

## 2. Entregas passadas

Entregas com data anterior ao dia atual continuarão sendo marcadas automaticamente como entregues quando:

```ts
entregue === false;
```

Esse comportamento deve ser preservado, documentado e coberto por testes.

## 3. Dias trabalhados

Os dias usados nos rateios, comparativos e cálculos relacionados continuam sendo:

- segunda-feira;
- quarta-feira;
- sexta-feira.

## 4. Regras e cortes históricos

Continuam válidos e devem ser preservados:

- preços históricos por cliente;
- datas de corte das tabelas de preço;
- alterações históricas do custo do balde;
- regras históricas do combustível;
- regra histórica do custo médio;
- valores e regras históricas da luz.

Não alterar datas, valores ou fórmulas sem autorização explícita.

## 5. Geocodificação

Deve ser removido completamente qualquer fallback que gere coordenadas aleatórias.

Quando um endereço não puder ser localizado, o fluxo deverá:

1. mostrar um erro claro;
2. permitir corrigir o endereço;
3. permitir selecionar manualmente um ponto no mapa;
4. impedir que uma coordenada inventada seja adicionada à rota.

Uma rota só poderá usar coordenadas confirmadas pelo geocodificador ou selecionadas manualmente pelo usuário.

## 6. Clientes personalizados

Clientes personalizados poderão ser:

- editados;
- renomeados;
- excluídos.

Antes de renomear ou excluir um cliente, o fluxo deverá:

1. verificar entregas relacionadas;
2. verificar pagamentos relacionados;
3. verificar histórico relacionado;
4. apresentar o impacto da operação;
5. exigir confirmação explícita;
6. gerar backup preventivo;
7. impedir perda de histórico.

Como os registros atuais se relacionam pelo nome do cliente, não é permitido renomear diretamente sem atualizar todas as referências relacionadas. A operação deve ser transacional do ponto de vista do usuário: ou todas as referências são atualizadas com sucesso, ou a alteração não é concluída.

A arquitetura deve ser preparada para uso futuro de `clientId`, mas o contrato atual do Firebase não deve ser alterado sem uma etapa específica de migração.

## 7. Estrutura atual do Firebase

Na primeira versão React Native:

- manter compatibilidade com os arrays completos existentes;
- não alterar automaticamente a estrutura dos dados;
- continuar lendo e gravando no formato atual;
- encapsular o acesso em `repositories`;
- preparar mappers para uma migração estrutural futura.

Uma migração futura para registros indexados por ID deverá possuir, obrigatoriamente:

- backup;
- conversão;
- validação;
- verificação de integridade;
- rollback.

## 8. Notificações

As notificações serão migradas na primeira versão.

O escopo inclui:

- notificação de nova entrega;
- lembretes de cobrança;
- registro e atualização do token;
- compatibilidade com iOS;
- validação das Cloud Functions existentes.

A implementação deverá usar Expo Notifications ou outra solução compatível com Expo e React Native.

## 9. Backup

Importação e exportação de backup serão migradas na primeira versão.

Requisitos obrigatórios:

- manter compatibilidade com os arquivos JSON existentes;
- validar o arquivo antes da importação;
- mostrar uma prévia dos dados;
- informar quantos registros serão importados;
- gerar backup automático dos dados atuais;
- solicitar confirmação;
- permitir cancelamento;
- apresentar o resultado da importação;
- não sobrescrever silenciosamente dados válidos.

Toda operação de importação deve ser cancelável antes da confirmação e deve deixar claro o que será criado, atualizado ou ignorado.

## 10. Pagamentos parciais da fábrica

Pagamentos de recebimentos da fábrica não podem ultrapassar o saldo restante.

- o valor deve ser maior que zero;
- o valor deve ser menor ou igual ao saldo restante;
- a comparação deve considerar a tolerância monetária de R$ 0,01;
- pagamentos acima do saldo não devem ser persistidos;
- a interface deve informar o saldo máximo permitido e manter o formulário aberto;
- não criar saldo negativo, crédito ou valor excedente nesta versão;
- pagamento igual ao saldo conclui automaticamente o recebimento;
- remover uma parcela deve recalcular o total pago, o saldo e a conclusão.

## 11. Compatibilidade de tokens de notificação

Na primeira versão React Native, o campo Firebase `/usuarios/{uid}/pushToken` continuará sendo
utilizado sem alteração estrutural.

- iOS e Android registrarão o Expo Push Token nesse campo;
- Web continuará compatível com o token FCM usado pelo Ionic;
- as Cloud Functions deverão identificar o formato do token e encaminhar pela integração
  correspondente;
- não será criada uma coleção de tokens por dispositivo nesta etapa;
- portanto, permanece a limitação histórica de um único token por usuário, com o último
  dispositivo registrado prevalecendo;
- a migração futura para múltiplos dispositivos exigirá uma etapa própria, com backup,
  conversão, validação, integridade e rollback.
