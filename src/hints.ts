/**
 * Client for the hints-api Cloudflare Worker.
 *
 * The Worker holds the Anthropic API key server-side; the browser only ever
 * talks to the Worker. Deploy the Worker (see the hints-api repo), then paste
 * its URL below as HINTS_API.
 */

import type { Technique } from "./game.ts";

// ▼▼▼  SET THIS to your deployed Worker URL (from `wrangler deploy` output).  ▼▼▼
//      e.g. "https://hints-api.your-subdomain.workers.dev"
// For local testing you can override without editing this file:
//      localStorage.setItem("hintsApi", "http://localhost:8787")
const DEFAULT_HINTS_API = "https://hints-api.sahilparekh1212.workers.dev";

export function hintsApiUrl(): string {
  return localStorage.getItem("hintsApi") || DEFAULT_HINTS_API;
}

export interface SudokuHintRequest {
  cells: number[];
  index: number;
  value: number;
  technique: Technique;
}

/** Ask the Worker to explain a pre-computed deduction. Throws on any failure. */
export async function fetchSudokuHint(payload: SudokuHintRequest): Promise<string> {
  const res = await fetch(`${hintsApiUrl()}/hint/sudoku`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = (await res.json().catch(() => ({}))) as { hint?: string; error?: string };
  if (!res.ok || !data.hint) throw new Error(data.error || `Hint failed (${res.status})`);
  return data.hint;
}
