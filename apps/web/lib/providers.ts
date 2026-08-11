export const PROVIDER_LABELS:
  Record<string, string> = {
    openrouter: "OpenRouter",
    openai: "OpenAI",
    anthropic: "Anthropic",
    ollama: "Ollama",
    custom: "Custom"
  };

export function providerLabel(
  provider: string
) {
  return (
    PROVIDER_LABELS[
      provider.toLowerCase()
    ] ||
    provider
  );
}
