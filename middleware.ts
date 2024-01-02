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
    limiter: Ratelimit.tokenBucket(5, "10 s", 10),
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
    const now = Date.now();
    const rateLimitReset = Math.max(Math.ceil((reset - now) / 1000), 0);
    const headers = {
        /** the requests quota in the time window */
        "RateLimit-Limit": limit.toString(),
        /** the remaining requests quota in the current window */
        "RateLimit-Remaining": remaining.toString(),
        /** the time remaining in the current window, specified in seconds. */
        "RateLimit-Reset": rateLimitReset.toString(),
    };
    if (success) {
        return next({ headers });
    }

    return new Response(JSON.stringify(body), {
        status,
        headers: {
            "Content-Type": "application/json",
            "Retry-After": new Date(reset).toUTCString(),
            ...headers,
        },
    });
}
