# Estratégia de `clientId`

## Objetivo

Preparar o React Native para trabalhar com um identificador interno estável de cliente sem alterar o contrato atual do Firebase. Nesta etapa, o banco continua usando exatamente os arrays de entregas e o mapa `clientesCustom` indexado por nome.

## Por que o contrato atual usa nome

O projeto Ionic relaciona entregas e configurações personalizadas pelo campo textual `cliente`. O nó atual é:

```text
/usuarios/{uid}/clientesCustom/{nomeOficial}
```

As entregas permanecem em um array completo em `/usuarios/{uid}/entregas`. Aliases, acentos e diferenças de capitalização são tratados por normalização antes de agrupamentos e consultas.

## Riscos da abordagem por nome

- alterações de grafia podem separar registros do mesmo cliente;
- renomeações exigem atualizar todas as referências históricas;
- aliases podem produzir duplicidades aparentes;
- chaves textuais são frágeis para URLs, notificações e integrações;
- não existe uma identidade compartilhada entre tabelas históricas, entregas e `clientesCustom`.

## Vantagens do `clientId`

Um `clientId` interno permite que modelos, navegação, componentes e regras de domínio trabalhem com uma identidade única. A camada de persistência continua traduzindo essa identidade para o nome exigido pelo Firebase, o que reduz o acoplamento da aplicação ao contrato legado.

## Identidade interna nesta versão

Os modelos de aplicação expõem `clientId`, `canonicalName` e `normalizedName`. Para dados legados sem ID persistido, o adapter gera uma identidade determinística com namespace `legacy:` a partir do nome canônico normalizado. Um registro local de identidade mantém o mesmo ID durante uma renomeação, sem escrever esse registro no Firebase. A normalização e os aliases são centralizados em `src/utils/data/normalizers.ts` e no adapter de identidade de clientes.

Essa identidade não é enviada ao Firebase e não é adicionada aos registros de entrega ou às entradas de `clientesCustom`.

O adapter também possui uma fronteira própria para, futuramente, substituir a identidade determinística por um registro de identidade compartilhado gerado durante a migração. Enquanto o banco continuar legado, o registro local preserva o vínculo interno no dispositivo; renomeações continuam sendo operações coordenadas pelo nome no contrato atual.

## Camadas preparadas

- `src/types/data/client.ts`: modelos de cliente com `clientId` somente na aplicação;
- `src/utils/data/normalizers.ts`: comparação, aliases e nome canônico;
- `src/mappers/firebase/dataMappers.ts`: conversão entre mapa legado e modelos internos;
- `src/repositories/CustomClientRepository.ts`: leitura e gravação sem adicionar campos;
- `src/repositories/DeliveryRepository.ts`: arrays legados preservados;
- `src/services/clients/`: catálogo, preços, identidade, impacto e mutações;
- `src/navigation/`: parâmetros usam `clientId` internamente e mantêm o nome apenas como fallback de deep link;
- `src/components/`: recebem modelos de aplicação, não campos crus do Firebase.

## Conversão futura

Uma migração futura poderá:

1. fazer backup dos arrays e mapas atuais;
2. construir um mapa validado `clientId` ↔ nome canônico;
3. converter referências de entregas e configurações;
4. validar duplicidades, aliases, contagens e somas financeiras;
5. gravar a nova estrutura em uma etapa explícita;
6. verificar integridade;
7. manter rollback para o formato legado.

Até essa etapa, nenhuma gravação adicionará `clientId` ao Firebase e nenhum componente dependerá diretamente de uma chave textual quando o modelo interno puder ser usado.

## Compatibilidade

Backups antigos que não possuem `clientesCustom` continuam válidos: o mapper trata o campo ausente como mapa vazio. Backups novos deverão incluir `clientesCustom`, sem remover os campos legados existentes.
