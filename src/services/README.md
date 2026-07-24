# Services

Camada de infraestrutura. As features devem depender dos contratos desta camada, nunca dos módulos `firebase/*` diretamente.

- `firebase/`: inicialização lazy e clientes de baixo nível do Firebase.
- `auth/`: contrato de autenticação e adapter `FirebaseAuthService`.
- `database/`: acesso genérico ao Firestore através de repositórios.
- `storage/`: contrato e adapter para arquivos no Firebase Storage.
- `api/`: clientes HTTP e mapeadores de respostas externas.
