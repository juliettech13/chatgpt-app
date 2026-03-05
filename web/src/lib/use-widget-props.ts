import { useEffect, useState } from "react";

import type { OpenAiSetGlobalsEvent, ToolOutputSnapshot } from "../types";

function extractStructuredContentFromToolOutput<T>(
  value: ToolOutputSnapshot | Partial<T> | undefined
): Partial<T> | undefined {
  if (!value || typeof value !== "object") return undefined;

  if ("structuredContent" in value) {
    return value.structuredContent as Partial<T> | undefined;
  }
  return value as Partial<T>;
}

export function useWidgetProps<T extends Record<string, unknown>>(defaults: T): T {
  const [props, setProps] = useState<T>(() => {
    const content = extractStructuredContentFromToolOutput<T>(
      window.openai?.toolOutput as ToolOutputSnapshot | Partial<T> | undefined
    );

    return { ...defaults, ...(content || {}) };
  });

  useEffect(() => {
    function onHostGlobalsUpdated(event: Event) {
      const typedEvent = event as OpenAiSetGlobalsEvent;

      const hostToolOutput = (typedEvent.detail?.globals?.toolOutput ??
        window.openai?.toolOutput) as ToolOutputSnapshot | Partial<T> | undefined;

      const content = extractStructuredContentFromToolOutput<T>(hostToolOutput);

      if (!content) return;

      setProps({ ...defaults, ...content });
    }

    window.addEventListener("openai:set_globals", onHostGlobalsUpdated, { passive: true });
    return () => {
      window.removeEventListener("openai:set_globals", onHostGlobalsUpdated);
    };
  }, [defaults]);

  return props;
}
