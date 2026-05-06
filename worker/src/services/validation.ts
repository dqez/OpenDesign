import { z } from "zod";

export const extractRequestSchema = z.object({
  url: z
    .string()
    .url()
    .transform((value) => new URL(value))
    .refine((url) => url.protocol === "https:" || url.protocol === "http:", {
      message: "URL must use http or https",
    })
    .transform((url) => url.toString()),
  email: z.string().email().max(320),
});
