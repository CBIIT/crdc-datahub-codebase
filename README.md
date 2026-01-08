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
    let headerParsed = false;
    let currentSessionId = null;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      const chunk = decoder.decode(value, { stream: true });

      // Parse the initial JSON header once
      if (!headerParsed) {
        const endOfJson = chunk.indexOf("}");
        if (endOfJson !== -1) {
          try {
            const header = JSON.parse(chunk.substring(0, endOfJson + 1));
            currentSessionId = header.sessionId;
            headerParsed = true;
            // Log the text after the header
            const text = chunk.substring(endOfJson + 1);
            if (text) console.log(text);
          } catch (e) {
            continue;
          }
        }
      } else {
        // Header already parsed, log everything immediately
        console.log(chunk);
      }
    }

    return currentSessionId;
  } catch (error) {
    console.error("Error:", error);
  }
}
```
