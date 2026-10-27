import type { Settings, Command } from "@rift/shared";
import type { GameUpdate } from "@rift/shared/game-data";
declare global {
  interface Window {
    rift?: {
      getSettings(): Promise<Settings>;
      saveSettings(s: Settings): Promise<Settings>;
      overlay(v: boolean): Promise<boolean>;
      overlayControl(
        action: "toggle-lock" | "center" | "raise",
      ): Promise<Settings>;
      getGame(): Promise<GameUpdate>;
      onGame(cb: (v: GameUpdate) => void): () => void;
      onSettings(cb: (v: Settings) => void): () => void;
      publish(v: unknown): void;
      action(v: Command): void;
      onState(cb: (v: any) => void): () => void;
      onAction(cb: (v: Command) => void): () => void;
      version(): Promise<string>;
    };
  }
}
