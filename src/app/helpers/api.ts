/**
 * Type definition for parameters required by the makeApiCall function.
 * This includes both the API request parameters and state management callbacks.
 */
export type ApiCallParams = {
  /** The search query to be sent to the API */
  searchQuery: string;
  /** Optional previous response for context in follow-up queries */
  previousC1Response?: string;
  /** Callback to update the response state */
  setC1Response: (response: string) => void;
  /** Callback to update the loading state */
  setIsLoading: (isLoading: boolean) => void;
  /** Current abort controller for cancelling ongoing requests */
  abortController: AbortController | null;
  /** Callback to update the abort controller state */
  setAbortController: (controller: AbortController | null) => void;
};

/**
 * Makes an API call to the /api/ask endpoint with streaming response handling.
 * Supports request cancellation and manages loading states.
 *
 * @param params - Object containing all necessary parameters and callbacks
 */
export const makeApiCall = async ({
  searchQuery,
  previousC1Response,
  setC1Response,
  setIsLoading,
  abortController,
  setAbortController,
}: ApiCallParams) => {
  try {
    // Cancel any ongoing request before starting a new one
    if (abortController) {
      abortController.abort();
    }

    // Create and set up a new abort controller for this request
    const newAbortController = new AbortController();
    setAbortController(newAbortController);
    setIsLoading(true);

    // Check if the request was cancelled before we even started
    if (newAbortController.signal.aborted) {
      return;
    }

    // Make the API request with the abort signal
    const response = await fetch("/api/ask", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: searchQuery,
        previousC1Response,
      }),
      signal: newAbortController.signal,
    });

    // Set up stream reading utilities
    const decoder = new TextDecoder();
    const stream = response.body?.getReader();

    if (!stream) {
      throw new Error("response.body not found");
    }

    // Initialize accumulator for streamed response
    let streamResponse = "";

    // Read the stream chunk by chunk with timeout protection
    const timeoutId = setTimeout(() => {
      stream.cancel();
    }, 30000); // 30 second timeout

    try {
      while (true) {
        const { done, value } = await stream.read();
        
        // Decode the chunk, considering if it's the final chunk
        const chunk = decoder.decode(value, { stream: !done });

        // Accumulate response and update state
        streamResponse += chunk;
        setC1Response(streamResponse);

        // Break the loop when stream is complete
        if (done) {
          break;
        }
      }
    } finally {
      clearTimeout(timeoutId);
    }
  } catch (error) {
    // Don't log abort errors as they are expected when cancelling requests
    if (error instanceof Error && error.name !== 'AbortError') {
      console.error("Error in makeApiCall:", error);
    }
  } finally {
    // Clean up: reset loading state and abort controller
    setIsLoading(false);
    setAbortController(null);
  }
};
