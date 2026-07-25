# Services

Camada de infraestrutura. As features devem depender dos contratos desta camada, nunca dos módulos `firebase/*` diretamente.

- `firebase/`: inicialização lazy e clientes de baixo nível do Firebase.
- `auth/`: contrato de autenticação e adapter `FirebaseAuthService`.
- `database/`: acesso legado ao Firestore; não é utilizado pelo contrato principal.
- `repositories/`: acesso ao Realtime Database preservando os arrays completos do Firebase.
- `data/`: fachada de carregamento, cache stale-while-revalidate e erros tipados.
- `storage/`: contrato e adapter para arquivos no Firebase Storage.
- `api/`: clientes HTTP e mapeadores de respostas externas.
