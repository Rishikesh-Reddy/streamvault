export type UserRole = "admin" | "user";

export type Video = {
  id: number;
  title: string;
  description: string;
  poster_url: string;
  stream_url: string;
  category: string;
  year: number;
  rating: number;
  trending: boolean;
  /** Approximate runtime label for UI (public demos; not probed from file). */
  runtime_label?: string;
};

/** Email + password pair from environment (never commit real values). */
export type AccountPair = {
  email: string;
  password: string;
};
