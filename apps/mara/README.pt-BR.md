# Mara

**Uma mente com história.**

[English](README.md) · [Guia de uso](docs/USER_GUIDE.pt-BR.md) · [Novidades](CHANGELOG.pt-BR.md)

Mara é uma personagem de conversa que lembra do que vocês discutem e desenvolve hábitos e opiniões a partir da experiência. Ela gosta de pequenas invenções, experimentos práticos e daquele detalhe que muda uma explicação. Pode retomar um assunto de conversas anteriores, reconsiderar uma abordagem que deixou de funcionar e voltar a uma versão anterior de si mesma mantendo a própria história.

Converse em inglês ou português brasileiro. As conversas, memórias e mudanças ficam em um banco SQLite local.

![Tela de conversa da Mara](docs/assets/mara.png)


A persona permanece no estado externo mantido pelo aplicativo e é interpretada pelo modelo configurado. Esta versão acrescenta busca independente nas mensagens originais, com identificação das fontes. [Personalidade e memória](docs/PERSONA.pt-BR.md).

## O que você pode fazer

- **Conversar.** Explorar uma ideia, contar uma experiência ou deixar Mara escolher o assunto.
- **Retomar um assunto.** Abrir conversas anteriores e buscar mensagens originais e resumos.
- **Acompanhar mudanças.** Ver opiniões e hábitos em formação e as experiências que os sustentam.
- **Reconsiderar uma abordagem.** Resultados negativos repetidos podem levar ao abandono de um hábito; um contratempo isolado não basta.
- **Preservar a história.** Fazer backup, restaurar os dados em outro local ou comparar perfis independentes.

## Como iniciar

Instale Node.js 24 ou superior. Não há dependências npm nem etapa de compilação.

```sh
cp .env.example .env
```

Coloque sua chave da API da OpenAI em `.env` e execute:

```sh
npm start
```

Abra [Mara](http://127.0.0.1:4351). Você também pode usar uma variável `OPENAI_API_KEY` já exportada. O uso do modelo é cobrado na sua conta de API. Configure `MARA_MODEL` com um modelo disponível na sua conta antes de criar um perfil.

A busca por palavras funciona desde o início. A busca semântica usa um modelo local opcional; a configuração técnica está em [Setup](docs/SETUP.md), em inglês.

## Na interface

**Conversation** é o espaço principal. **Memory** reúne resumos, busca e mensagens originais. **About Mara** mostra personalidade e desenvolvimento. **Settings** contém conexão, limite de requisições, identidade de conversa e perfis. Os nomes dos controles estão em inglês; Mara conversa nos dois idiomas.

O limite inicial é de 60 requisições. Para consultar ou definir um novo total preservando o histórico:

```sh
npm run budget
npm run budget -- --limit 200
```

Mara funciona hoje como aplicativo de texto para um operador local. As respostas chegam completas. Hospedagem, voz, ações externas e autenticação de contas estão nos planos futuros. A geração de respostas usa a API configurada.

[Guia de uso](docs/USER_GUIDE.pt-BR.md) · [Próximas versões](ROADMAP.pt-BR.md) · [Documentação técnica](docs/ARCHITECTURE.md)

## Licença

[MIT](LICENSE). Copyright (c) 2026 Denis Ostapenko. Componentes externos mantêm suas próprias licenças, conforme [THIRD_PARTY_NOTICES](THIRD_PARTY_NOTICES.md).
