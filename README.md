# Introduction

TODO

# Getting Started

TODO

```JavaScript
async function askQuestion(question, sessionId = null) {
  const functionUrl = "https://function-url-goes-here"; // Replace with your function URL
  try {
    const response = await fetch(functionUrl, {
      method: "POST",
      body: JSON.stringify({ question, sessionId }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let currentSessionId = null;
    let isFirstChunk = true;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");

      // Keep the last incomplete line in the buffer
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.trim()) continue;

        try {
          const parsed = JSON.parse(line);

          // First chunk contains sessionId
          if (isFirstChunk && parsed.sessionId !== undefined) {
            currentSessionId = parsed.sessionId;
            isFirstChunk = false;
            continue;
          }

          // Subsequent chunks contain output
          if (parsed.output) {
            console.log(parsed.output);
          }

          // Handle citations if present
          if (parsed.citation && Object.keys(parsed.citation).length > 0) {
            console.log("Citations:", parsed.citation);
          }

          // Handle errors
          if (parsed.error) {
            console.error("Error:", parsed.error);
          }
        } catch (e) {
          console.warn("Failed to parse line:", line, e);
        }
      }
    }

    return currentSessionId;
  } catch (error) {
    console.error("Error:", error);
  }
}
```
