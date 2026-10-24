# O Mestre dos Papéis — demonstração

Demonstração navegável do sistema **O Mestre dos Papéis** (assessoria documental no Paraguai).

- Site: [/mestre-dos-papeis-demo/](/mestre-dos-papeis-demo/)
- Painel da equipe: [/mestre-dos-papeis-demo/admin/](/mestre-dos-papeis-demo/admin/)
- Área do cliente: [/mestre-dos-papeis-demo/cliente/](/mestre-dos-papeis-demo/cliente/)

**Ambiente de demonstração.** Clientes, documentos e pagamentos são fictícios. Não há servidor:
o mesmo código do sistema roda dentro do navegador (service worker + SQLite em WebAssembly) e os
dados ficam só no navegador de quem abre. O login é demonstrativo e **não é proteção real**.
Cada aparelho tem a sua própria cópia dos dados.

Acessos fictícios: painel `daniel@demo.invalid` / `demo-mestre-2026`;
área do cliente `juliana@demo.invalid` ou `carlos@demo.invalid` / `demo-cliente-2026`.

Conteúdo gerado automaticamente a partir do código-fonte (repositório privado).
SQLite em WebAssembly: [sql.js](https://github.com/sql-js/sql.js), licença MIT (vendor/LICENSE-sql.js.txt).
