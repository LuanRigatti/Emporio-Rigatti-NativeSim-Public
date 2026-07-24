# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

## Regras permanentes de migração

1. A pasta `ionic-reference` contém o projeto Ionic original e deve ser utilizada somente para consulta.

2. Nunca altere, mova, renomeie, formate ou exclua arquivos dentro de `ionic-reference`.

3. Todas as implementações devem ser feitas exclusivamente no projeto React Native atual.

4. A migração não deve incluir apenas o layout. Para cada funcionalidade, analise também:
   - HTML;
   - CSS ou SCSS;
   - TypeScript;
   - services;
   - models;
   - interfaces;
   - Firebase;
   - cálculos;
   - validações;
   - filtros;
   - ordenações;
   - navegação;
   - regras de negócio.

5. Não invente regras que não estejam confirmadas no projeto original.

6. Quando algum comportamento não puder ser determinado, pare e informe claramente a dúvida.

7. Componentes visuais não devem acessar Firebase diretamente.

8. Componentes visuais não devem conter regras financeiras ou cálculos complexos.

9. Organize cada funcionalidade em `components`, `hooks`, `services`, `repositories`, `types` e `utils` conforme necessário.

10. Preserve os nomes e formatos dos campos já existentes no Firebase.

11. Antes de implementar uma funcionalidade:
    - localize os arquivos relacionados;
    - documente as regras encontradas;
    - apresente um plano;
    - aguarde minha autorização.

12. Depois de implementar:
    - execute TypeScript;
    - execute ESLint;
    - execute testes;
    - informe todos os arquivos alterados.

## Decisões de negócio e arquitetura confirmadas

As decisões detalhadas e permanentes estão documentadas em `docs/migration/confirmed-decisions.md` e devem ser respeitadas em todas as implementações futuras.

1. Os métodos permitidos para quitar entregas são somente `Dinheiro` e `Pix`. O usuário deverá escolher um deles. Nunca usar `Pix` como fallback silencioso.

2. Entregas com data anterior ao dia atual e `entregue === false` devem continuar sendo marcadas automaticamente como entregues. Esse comportamento deve ser documentado e testado.

3. Os dias trabalhados usados em rateios, comparativos e cálculos relacionados são segunda-feira, quarta-feira e sexta-feira.

4. Devem ser preservados os preços históricos por cliente, datas de corte, alterações históricas do custo do balde, regras históricas de combustível, regra histórica de custo médio e valores/regras históricas da luz. Datas, valores e fórmulas não podem ser alterados sem autorização explícita.

5. A geocodificação nunca pode gerar coordenadas aleatórias. Quando um endereço não for localizado, a aplicação deve mostrar erro claro, permitir corrigir o endereço ou selecionar manualmente um ponto no mapa, e impedir coordenadas inventadas na rota.

6. Clientes personalizados poderão ser editados, renomeados e excluídos. Antes de renomear ou excluir, deve-se verificar entregas, pagamentos e histórico relacionados, apresentar o impacto, exigir confirmação, gerar backup preventivo e impedir perda de histórico. Como os registros atuais usam o nome do cliente, todas as referências relacionadas devem ser atualizadas. A arquitetura deve ficar preparada para `clientId` no futuro, sem alterar o contrato atual do Firebase sem uma etapa específica de migração.

7. A primeira versão React Native deve manter compatibilidade com os arrays completos atuais do Firebase, sem reestruturar dados automaticamente. O acesso deve ser encapsulado em repositories e preparado com mappers para futura migração estrutural. Qualquer conversão futura por ID deve incluir backup, conversão, validação, verificação de integridade e rollback.

8. Notificações serão migradas na primeira versão, incluindo nova entrega, lembretes de cobrança, registro/atualização de token, compatibilidade com iOS e validação das Cloud Functions existentes. Usar Expo Notifications ou solução compatível com Expo e React Native.

9. Importação e exportação de backup serão migradas na primeira versão. Devem manter compatibilidade com JSON existente, validar e pré-visualizar o arquivo, informar a quantidade de registros, gerar backup automático atual, solicitar confirmação, permitir cancelamento, apresentar o resultado e nunca sobrescrever silenciosamente dados válidos.
