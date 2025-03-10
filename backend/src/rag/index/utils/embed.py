from mistralai import Mistral
from typing import List
import time
from ....config import config
import threading

# Initialize the Mistral AI client
mistral_client = Mistral(api_key=config.mistral_api_key)
model = "mistral-embed"

# Rate limiting variables
call_timestamps = []
rate_limit_lock = threading.Lock()


def rate_limit():
    """
    Implements rate limiting to ensure we don't exceed MAX_CALLS_PER_MINUTE.
    Blocks until it's safe to make another API call.
    """
    current_time = time.time()

    with rate_limit_lock:
        # Remove timestamps older than 1 minute
        while call_timestamps and call_timestamps[0] < current_time - 60:
            call_timestamps.pop(0)

        # If we've reached the limit, wait until we can make another call
        if len(call_timestamps) >= config.embedding_config.max_calls_per_minute:
            sleep_time = 60 - (current_time - call_timestamps[0])
            if sleep_time > 0:
                time.sleep(sleep_time)

        # Record this call
        call_timestamps.append(time.time())


def generate_embeddings_batch(chunks: List[str]) -> List[List[float]]:
    """
    Uses the Mistral Embed model to generate embeddings in batch.
    Each input chunk is embedded into a vector of size 1024.
    Rate limited to MAX_CALLS_PER_MINUTE API calls per minute.

    Args:
        chunks (List[str]): A list of text chunks to embed.

    Returns:
        List[List[float]]: A list of embedding vectors, one per input chunk.
    """
    # Process in batches of 50 (or another appropriate batch size)
    all_embeddings = []

    for i in range(0, len(chunks), config.embedding_config.batch_size):
        # Apply rate limiting before making API call
        rate_limit()

        batch = chunks[i : i + config.embedding_config.batch_size]
        response = mistral_client.embeddings.create(model=model, inputs=batch)
        # Extract embeddings from response
        batch_embeddings = [data.embedding for data in response.data]
        all_embeddings.extend(batch_embeddings)

    return all_embeddings
