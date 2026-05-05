/**
 * Fetch with timeout and retry logic
 * Prevents hanging requests that cause "connection closed" errors
 */

interface FetchOptions extends RequestInit {
  timeout?: number;
  retries?: number;
  retryDelay?: number;
}

export async function fetchWithTimeout(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    timeout = 35000, // FIX: 35s client timeout — longer than server's 25s so errors surface cleanly
    retries = 0,       // FIX: No retries by default — retrying a timeout triples server load
    retryDelay = 1000,
    ...fetchOptions
  } = options;

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      // Create abort controller for timeout
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      try {
        const response = await fetch(url, {
          ...fetchOptions,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);

        // If response is not ok, don't retry server errors (500+)
        if (!response.ok && response.status >= 500 && attempt < retries) {
          console.warn(`Request failed with status ${response.status}, retrying... (${attempt + 1}/${retries})`);
          throw new Error(`HTTP ${response.status}`);
        }

        return response;
      } catch (error) {
        clearTimeout(timeoutId);

        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error(`Request timeout after ${timeout}ms`); // FIX: AbortError = timeout, do NOT retry
        }

        throw error;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry if it's the last attempt
      if (attempt === retries) break;
      // FIX: Never retry timeouts — the server is overloaded, hammering it again makes it worse
      if (lastError?.message?.includes('timeout')) break;

      // Wait before retrying
      console.log(`Retry attempt ${attempt + 1}/${retries} after ${retryDelay}ms...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay * (attempt + 1)));
    }
  }

  throw lastError || new Error('Request failed');
}
