import { rewrite, ipAddress, next } from "@vercel/edge";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

const UPSTASH_REDIS_URL = process.env.UPSTASH_REDIS_URL;
const UPSTASH_REDIS_TOKEN = process.env.UPSTASH_REDIS_TOKEN;
if (!UPSTASH_REDIS_URL || !UPSTASH_REDIS_TOKEN) {
    throw new Error(
        `Missing environment variable(s): UPSTASH_REDIS_URL and/or UPSTASH_REDIS_TOKEN`
    );
}

const redis = new Redis({
    url: UPSTASH_REDIS_URL,
    token: UPSTASH_REDIS_TOKEN,
});

const ratelimit = new Ratelimit({
    redis,
    // 5 requests from the same IP in 10 seconds
    limiter: Ratelimit.slidingWindow(5, "10 s"),
});

export default async function middleware(request: Request) {
    const ip = ipAddress(request) || "127.0.0.1";
    const { success, pending, limit, reset, remaining } = await ratelimit.limit(ip);

    const status = 429;
    const message = "Too Many Requests";
    const body = {
        error: {
            status,
            message,
        },
        limit,
        reset,
        remaining,
    };
    return success
        ? next()
        : new Response(JSON.stringify(body), {
              status,
              headers: {
                  "Content-Type": "application/json",
                  "Retry-After": new Date(reset).toUTCString(),
              },
          });
}
