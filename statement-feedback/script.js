const form = document.getElementById("feedback-form");
const statementInput = document.getElementById("statement");
const button = document.getElementById("submit-button");
const statusText = document.getElementById("status");
const errorText = document.getElementById("error");
const results = document.getElementById("results");
const categories = ["clarity", "specificity", "structure"];

function showError(message) {
  errorText.textContent = message;
  errorText.hidden = false;
}

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (button.disabled) return;
  errorText.hidden = true;
  errorText.textContent = "";
  results.hidden = true;
  for (const category of categories) document.getElementById(category).textContent = "";
  statusText.textContent = "";
  const statement = statementInput.value;
  if (!statement.trim()) {
    showError("Please enter an artist statement.");
    statementInput.focus();
    return;
  }
  if (Array.from(statement).length > 5000) {
    showError("Keep your statement to 5,000 characters or fewer.");
    statementInput.focus();
    return;
  }
  const baseUrl = window.FEEDBACK_API_URL;
  if (!baseUrl || (window.location.protocol === "https:" && !baseUrl.startsWith("https://"))) {
    showError("The site owner needs to configure the HTTPS backend URL in config.js.");
    return;
  }
  button.disabled = true;
  button.textContent = "Getting feedback…";
  form.setAttribute("aria-busy", "true");
  statusText.textContent = "Reviewing your statement. The service may take a moment to wake up.";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90000);
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ statement }),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok && data && data.code === "insufficient_input") {
      statusText.textContent = "";
      showError(data.error);
      statementInput.focus();
      return;
    }
    if (!response.ok) {
      throw new Error(data && typeof data.error === "string"
        ? data.error : "The server could not complete your request. Please try again.");
    }
    const feedback = data && data.feedback;
    if (!feedback || Object.keys(feedback).length !== 3 ||
        !categories.every(key => typeof feedback[key] === "string" && feedback[key].trim())) {
      throw new Error("The server returned incomplete feedback. Please try again.");
    }
    // Model output is plain text, never executable HTML.
    for (const category of categories) {
      document.getElementById(category).textContent = feedback[category];
    }
    results.hidden = false;
    results.focus();
    statusText.textContent = "Feedback ready: three suggestions.";
  } catch (error) {
    statusText.textContent = "";
    showError(error.name === "AbortError"
      ? "The request timed out. Please try again in a moment."
      : error instanceof TypeError
        ? "Could not reach the backend. Check your connection, backend URL, and CORS settings."
        : error.message);
  } finally {
    clearTimeout(timeout);
    button.disabled = false;
    button.textContent = "Get Feedback";
    form.setAttribute("aria-busy", "false");
  }
});
