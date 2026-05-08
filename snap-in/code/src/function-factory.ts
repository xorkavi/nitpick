import handle_nitpick_event from "./functions/handle_nitpick_event";

export const functionFactory = {
  handle_nitpick_event,
} as const;

export type FunctionFactoryType = keyof typeof functionFactory;
