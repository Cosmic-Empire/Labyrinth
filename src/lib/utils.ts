import { cn as merge } from "cn";

export function cn(...inputs: Parameters<typeof merge>) {
  return merge(...inputs);
}
