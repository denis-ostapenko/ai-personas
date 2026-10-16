# AI Personas: aplicativos complementares

Três aplicativos locais de Denis Ostapenko acompanham o livro *AI Personas: Character, Memory, and Development*. Os três conversam em inglês e português brasileiro.

- [Persona 0.5.0](apps/companion/README.pt-BR.md): personalidade autoral, temperamento ajustável e memória com fontes.
- [Home Repair Advisor 0.4.0](apps/home-repair-advisor/README.pt-BR.md): evidências organizadas por caso e orientação prática sobre reparos.
- [Mara 0.3.0](apps/mara/README.pt-BR.md): experiências registradas e mudanças delimitadas em hábitos e opiniões.

Instale o Node.js 24 ou posterior. Não é preciso instalar dependências npm nem compilar. Na pasta do aplicativo escolhido, copie `.env.example` para `.env` e configure seu próprio acesso à API. O software é gratuito, sob licença MIT; os provedores de modelos e busca podem cobrar pelo uso.

No macOS, use o arquivo `Start [application].command` correspondente. No Windows, use o arquivo `.cmd`. Pelo terminal:

```sh
node scripts/start-app.mjs persona
node scripts/start-app.mjs advisor
node scripts/start-app.mjs mara
```

Depois de iniciar, abra http://127.0.0.1:4346 para Persona, http://127.0.0.1:4317 para Advisor ou http://127.0.0.1:4351 para Mara. Os iniciadores não instalam programas, não leem um arquivo pessoal de chaves e não fazem chamadas ao modelo por conta própria.

[Configuração](docs/CONFIGURATION.md) · [Configuração de Mara](apps/mara/docs/SETUP.md) · [Laboratório](laboratory/README.md) · [Livro e materiais](https://denisostapenko.com/books/ai-personas/companion)

Os testes de software e os testes delimitados com diálogos sintéticos não demonstram benefício para pessoas, fidelidade geral de personalidade ou continuidade ampla de desenvolvimento. O controlador independente completo descrito no livro ainda não está implementado. O laboratório usa bancos temporários e dados sintéticos, sem chamadas ao modelo.

[MIT](LICENSE), copyright (c) 2026 Denis Ostapenko. Materiais de terceiros mantêm seus próprios avisos e licenças. O livro tem termos separados.
