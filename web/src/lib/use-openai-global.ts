import { useEffect, useState } from "react";

import type { OpenAiGlobals, OpenAiSetGlobalsEvent } from "../types";

export function useOpenAiGlobal<K extends keyof OpenAiGlobals>(
  key: K,
  defaultValue: OpenAiGlobals[K]
): OpenAiGlobals[K] {
  const [value, setValue] = useState<OpenAiGlobals[K]>(() => window.openai?.[key] ?? defaultValue);

  useEffect(() => {
    function onSetGlobals(event: Event) {
      const typedEvent = event as OpenAiSetGlobalsEvent;
      const nextValue = typedEvent.detail?.globals?.[key] ?? window.openai?.[key] ?? defaultValue;
      setValue(nextValue);
    }

    window.addEventListener("openai:set_globals", onSetGlobals, { passive: true });

    return () => {
      window.removeEventListener("openai:set_globals", onSetGlobals);
    };
  }, [defaultValue, key]);

  return value;
}
