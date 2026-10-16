# Home Repair Advisor

Versão 0.4.0

Home Repair Advisor é um consultor de conversa para reparos domésticos nos Estados Unidos. Descreva o serviço, acrescente fotos e um ZIP code, e ele ajuda a definir o escopo, estimar o orçamento e comparar prestadores locais com base em fontes publicadas. Ele conversa em inglês e português brasileiro, mantém os detalhes do serviço atual e incorpora correções à resposta seguinte. Seu jeito é calmo, direto e atento ao tempo e ao orçamento do cliente.


A persona permanece no estado externo mantido pelo aplicativo e é interpretada pelo modelo configurado. Esta versão acrescenta busca independente nas mensagens originais, com identificação das fontes. [Personalidade e memória](docs/PERSONA.pt-BR.md).

## Pontos fortes

- Reúne fotos, a descrição do cliente e os detalhes já informados em uma única conversa.
- Mantém as correções e separa um novo serviço do trabalho anterior.
- Calcula orçamentos com tarifas publicadas, quantidades informadas e valores previstos para materiais.
- Vincula dados dos prestadores, preços e trechos de avaliações às respectivas fontes.

## Limitações atuais

- A busca atende ZIP codes dos Estados Unidos, com estimativas em dólares americanos.
- Páginas incompletas podem deixar lacunas em preços, contatos ou avaliações.
- Fotos não mostram condições ocultas nem medidas exatas.
- Agendamento, disponibilidade confirmada e uma tela de histórico de serviços ainda não estão incluídos; os rótulos da interface permanecem em inglês.

## Executar

Use Node.js 24, configure as variáveis de [.env.example](.env.example) e execute:

```sh
npm start
```

Home Repair Advisor: http://127.0.0.1:4317. OPENAI_API_KEY, TAVILY_API_KEY.

[Notas da versão](CHANGELOG.pt-BR.md) | [Próximas versões](ROADMAP.pt-BR.md) | [English](README.md)

[Arquitetura](docs/ARCHITECTURE.md) e [dados e restauração](docs/DATA.md), em inglês.

MIT. Copyright (c) 2026 Denis Ostapenko. [LICENSE](LICENSE).

[Crédito da fotografia](tests/fixtures/ATTRIBUTION.md).
