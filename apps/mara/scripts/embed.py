"""Local, offline multilingual embeddings. JSON lines on stdin/stdout only."""
import json
import os
import sys
os.environ['HF_HUB_OFFLINE'] = '1'
os.environ['TOKENIZERS_PARALLELISM'] = 'false'
from fastembed import TextEmbedding
model = TextEmbedding(model_name='sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2', local_files_only=True, cache_dir=os.environ.get('MARA_EMBED_CACHE'))
for line in sys.stdin:
    request = {}
    try:
        request = json.loads(line)
        result = [v.tolist() for v in model.embed(request['texts'])]
        print(json.dumps({'id': request['id'], 'vectors': result}), flush=True)
    except Exception:
        print(json.dumps({'id': request.get('id'), 'error': 'Local embedding failed'}), flush=True)
