import { NextRequest, NextResponse } from "next/server";
import { requireSpaceRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import { getSignedMediaUrl, verifySignedMediaToken } from "@/lib/storage";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params;
    const url = new URL(req.url);
    const path = url.searchParams.get("path");
    const expires = url.searchParams.get("expires");
    const sig = url.searchParams.get("sig");

    if (!path) {
      return NextResponse.json({ error: "Missing media path parameter" }, { status: 400 });
    }

    // Path traversal check
    if (!path.startsWith(`spaces/${spaceId}/`)) {
      return NextResponse.json(
        { error: "Forbidden: Cross-space media path rejected" },
        { status: 403 }
      );
    }

    // Check if valid token was provided
    if (expires && sig) {
      const expiresAt = parseInt(expires, 10);
      const isValid = verifySignedMediaToken(spaceId, path, expiresAt, sig);
      if (!isValid) {
        return NextResponse.json(
          { error: "Forbidden: Signed media token has expired or is invalid." },
          { status: 403 }
        );
      }
    } else {
      // Must be authenticated member of the space
      await requireSpaceRole(spaceId, Role.MEMBER);
    }

    const signedUrl = await getSignedMediaUrl(spaceId, path, 3600);
    return NextResponse.json({ signedUrl });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to generate signed media URL" },
      { status: err.status || 500 }
    );
  }
}
