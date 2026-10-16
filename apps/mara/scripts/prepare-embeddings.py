"""Explicitly download the optional model once; the app itself stays offline for embeddings."""
import os
from fastembed import TextEmbedding
model = TextEmbedding(model_name='sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2', cache_dir=os.environ.get('MARA_EMBED_CACHE'))
next(iter(model.embed(['Memory setup check.'])))
print('Local multilingual memory search is ready.')
