# Decisões confirmadas de negócio e arquitetura

Este documento registra decisões permanentes de negócio e arquitetura do aplicativo React Native atual.

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

## 6. Clientes e histórico

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

Como os clientes possuem identidade própria no Cloud Firestore, renomeações e exclusões devem verificar referências relacionadas, apresentar impacto, exigir confirmação e preservar o histórico. Excluir ou arquivar um cliente não pode apagar entregas.

O Realtime Database legado e o schema antigo não fazem parte do fluxo normal do aplicativo. Não criar compatibilidade, importação ou migração automática para eles. Qualquer auditoria ou migração futura precisa ser solicitada explicitamente e ter backup, validação de integridade e rollback.

## 7. Persistência atual

O Cloud Firestore é a fonte persistente atual, por usuário, em `users/{uid}/...`. As entidades usam documentos próprios e consultas granulares. Não armazenar arrays crescentes nem criar leituras globais quando a tela precisa de um período ou entidade específica.

AsyncStorage/local storage pode ser usado como cache, fallback local ou preferência exclusiva do dispositivo. Finanças, Estoque, gráficos e outros resumos são derivados e não possuem uma coleção própria.

## 8. Notificações

Notificações e tokens não devem ser alterados incidentalmente. Uma etapa futura de notificações somente deve ser criada após auditoria do código atual, das regras do Firestore e da configuração nativa.

## 9. Backup e Restore

Backup e Restore já estão implementados. As operações devem preservar checksum, `backupVersion`, `schemaVersion`, UID, IDs originais, timestamps, dry-run, confirmação explícita, relatório e detecção de conflitos. Nunca excluir ou sobrescrever silenciosamente documentos válidos.

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

## 11. Autenticação e desbloqueio local

Google/Firebase Auth é a autenticação da conta. Face ID, quando habilitado pela feature flag e pela preferência local do dispositivo, é apenas um gate biométrico local; não substitui o Firebase Auth, não executa novo login Google e não armazena tokens ou credenciais.
