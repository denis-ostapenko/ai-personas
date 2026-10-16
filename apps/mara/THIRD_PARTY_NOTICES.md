# Third-party notices

Mara itself is MIT licensed, copyright (c) 2026 Denis Ostapenko. No third-party JavaScript packages, photographs, fonts or model weights are bundled. The interface uses system fonts and an application screenshot from an empty profile.

| Component or service | Use | Upstream terms |
| --- | --- | --- |
| Node.js | Required local runtime, installed separately | [Node.js license and notices](https://github.com/nodejs/node/blob/main/LICENSE) |
| SQLite | Database supplied through Node.js | [SQLite public-domain statement](https://www.sqlite.org/copyright.html) |
| FastEmbed 0.8.0 | Optional separately installed local embedding library | [Apache License 2.0](https://github.com/qdrant/fastembed/blob/main/LICENSE) |
| sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2 | Optional downloaded multilingual embedding model | [Model card, Apache-2.0](https://huggingface.co/sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2) |
| OpenAI API | Model generation through the user's account | [Service terms](https://openai.com/policies/service-terms/) |

Research papers inform design decisions and are referenced in the documentation; their full texts are not redistributed. Optional Python packages can have their own transitive dependencies and notices. Installing them does not relicense them under Mara's MIT license.
