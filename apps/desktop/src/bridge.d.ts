import type { Settings, Command } from "@rift/shared";
declare global {
  interface Window {
    rift?: {
      getSettings(): Promise<Settings>;
      saveSettings(s: Settings): Promise<Settings>;
      overlay(v: boolean): Promise<boolean>;
      publish(v: unknown): void;
      action(v: Command): void;
      onState(cb: (v: any) => void): () => void;
      onAction(cb: (v: Command) => void): () => void;
      onSafety(cb: (v: boolean) => void): () => void;
      safety(): Promise<boolean>;
      version(): Promise<string>;
    };
  }
}
