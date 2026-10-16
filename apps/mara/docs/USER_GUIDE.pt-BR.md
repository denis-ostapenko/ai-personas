# Guia de uso

## Comece uma conversa

Escreva na caixa de mensagem. Enter envia; Shift + Enter cria outra linha. As sugestões preenchem a caixa, sem enviar. **Let Mara start** convida Mara a escolher um assunto.

Converse em inglês ou português brasileiro. Os resumos e registros internos são mantidos em inglês; mensagens originais e citações preservam o idioma em que foram escritas.

## Retome sua história

**New**, ao lado de Conversations, abre um novo chat. As conversas anteriores continuam na barra lateral. Ao abrir uma conversa antiga, você pode ler o histórico; **Back to current conversation** volta ao chat ativo. Um novo chat recebe memórias relevantes e resumos de conversas anteriores.

Em **Settings**, mantenha a mesma identidade para continuar seu histórico. Use letras minúsculas, números e hífens. Identidades diferentes separam as conversas e a busca; a personalidade de Mara continua compartilhada dentro de um perfil. Crie outro perfil para uma trajetória totalmente independente.

## Encontre uma memória

Abra **Memory** e procure por nome, detalhe ou assunto. **Read source** mostra a mensagem original e a resposta de Mara. A organização acontece automaticamente conforme a conversa cresce, ao abrir outro chat e periodicamente enquanto o servidor está funcionando. **Organize memory** inicia uma rodada na hora. As mensagens originais são preservadas.

## Acompanhe o desenvolvimento

Em **About Mara**, você encontra interesses, opiniões, hábitos e temperamento. **Taking shape** indica uma regra provisória; **Practiced**, um hábito estabelecido; **Let go**, um hábito abandonado como padrão. **Supported** e **Reconsidered** descrevem o estado de uma opinião.

Conte o que você tentou e qual foi o resultado. Mara pode associar esse relato a uma sugestão anterior. Resultados negativos repetidos podem levar ao abandono de um hábito, enquanto um único contratempo não basta. Para retomar o hábito, são necessárias novas experiências bem-sucedidas.

## Versões e perfis

**History and earlier versions** permite restaurar a personalidade e as regras de uma versão anterior. Você confirma a escolha antes da restauração. Conversas, memórias e versões permanecem no histórico.

Em **Settings > Advanced**, selecione ou crie outro perfil. **Keep the starting personality fixed** cria um perfil que guarda memórias sem adotar mudanças persistentes na personalidade.

## Limite e backup

Settings mostra a conexão e o limite total de requisições. Para consultar ou alterar o total, preservando o histórico:

```sh
npm run budget
npm run budget -- --limit 200
```

Para fazer backup e restaurar em um diretório novo:

```sh
npm run backup -- ./backup-october
npm run restore -- ./backup-october ./restored-october
```

Use `EVOLVING_DB=./restored-october/personas.sqlite` ao reiniciar para abrir a cópia restaurada. Mais detalhes técnicos: [Setup](SETUP.md) e [Data and backups](DATA.md).
