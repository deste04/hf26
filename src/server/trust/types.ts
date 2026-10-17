// One entry of a project's VOUCHED.td, as shown in the graph and tables.
export type TrustEdge = {
  project: string; // owner/repo
  login: string;
  status: "vouched" | "denounced";
  note: string | null;
  voucher: string | null; // GitHub author of the commit that added the line; null = unknown, never guessed
  occurred_at: string | null;
  commit_sha: string | null;
  /** Person view only: other repos whose VOUCHED.td is a copy of this project's list (forks, re-uploads). */
  copies?: string[];
};
