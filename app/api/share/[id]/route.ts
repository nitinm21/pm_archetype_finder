import { NextResponse } from "next/server";
import { readDb, withDbMutation } from "@/lib/db";
import { getClientIp, jsonError } from "@/lib/http";
import { isRateLimited } from "@/lib/rate-limit";
import { generateShareSlug } from "@/lib/share";

export const dynamic = "force-dynamic";

interface Params {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, context: Params) {
  const { id: sessionId } = await context.params;
  const ip = getClientIp(request.headers);

  if (isRateLimited(`${ip}:share-create`, 20, 60_000)) {
    return jsonError("Too many share creation requests. Try again shortly.", 429);
  }

  const db = await readDb();
  const result = db.results[sessionId];

  if (!result) {
    return jsonError("No completed result exists for this session.", 404);
  }

  const share = await withDbMutation((mutableDb) => {
    let slug = generateShareSlug();

    while (mutableDb.shares[slug]) {
      slug = generateShareSlug();
    }

    mutableDb.shares[slug] = {
      slug,
      sessionId,
      createdAt: new Date().toISOString(),
      views: 0
    };

    return mutableDb.shares[slug];
  });

  return NextResponse.json({
    slug: share.slug,
    sessionId: share.sessionId,
    url: `/share/${share.slug}`
  });
}

export async function GET(request: Request, context: Params) {
  const { id: slug } = await context.params;
  const ip = getClientIp(request.headers);

  if (isRateLimited(`${ip}:share-read`, 120, 60_000)) {
    return jsonError("Too many requests. Slow down and retry.", 429);
  }

  const payload = await withDbMutation((db) => {
    const share = db.shares[slug];

    if (!share) {
      return null;
    }

    share.views += 1;

    const result = db.results[share.sessionId] ?? null;
    const session = db.sessions[share.sessionId] ?? null;

    return {
      share,
      result,
      session
    };
  });

  if (!payload?.share || !payload.result || !payload.session) {
    return jsonError("Share link not found.", 404);
  }

  return NextResponse.json(payload);
}
