# Persona

Versão 0.5.0

Persona é uma personagem de conversa com voz própria, temperamento ajustável e uma história compartilhada que continua entre conversas. Seis controles definem seu humor, acolhimento, independência, iniciativa, estilo intelectual e serenidade. Ela pode discutir uma ideia, discordar, retomar um assunto ou lembrar uma piada compartilhada em inglês ou português brasileiro. Sua identidade, suas memórias e seu estado emocional são mantidos separadamente.


A persona permanece no estado externo mantido pelo aplicativo e é interpretada pelo modelo configurado. Esta versão acrescenta busca independente nas mensagens originais, com identificação das fontes. [Personalidade e memória](docs/PERSONA.pt-BR.md).

## Pontos fortes

- Seis controles ajustam o jeito da personagem sem descartar a história compartilhada.
- A memória preserva fatos atribuídos, correções, episódios e assuntos pendentes entre conversas.
- As reações emocionais mudam com os acontecimentos e o tempo; mudanças na relação dependem de quem fez o quê.
- Armazenamento local, esquecimento seletivo e cópias completas dão ao usuário controle sobre os dados salvos.

## Limitações atuais

- Mensagens com várias pessoas podem ser reduzidas a uma interpretação incompleta.
- Uma troca comum usa chamadas separadas de interpretação e diálogo, aumentando o tempo de resposta e o custo da API.
- O esquecimento pode deixar passar paráfrases nas transcrições mantidas.
- A interface está em inglês, e o acesso aos perfis salvos depende do cookie do navegador.

## Executar

Use Node.js 24, configure as variáveis de [.env.example](.env.example) e execute:

```sh
npm start
```

Persona: http://127.0.0.1:4346. OPENAI_API_KEY.

[Notas da versão](CHANGELOG.pt-BR.md) | [Próximas versões](ROADMAP.pt-BR.md) | [English](README.md)

[Arquitetura](docs/ARCHITECTURE.md) e [dados e restauração](docs/DATA.md), em inglês.

MIT. Copyright (c) 2026 Denis Ostapenko. [LICENSE](LICENSE).
