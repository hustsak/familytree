import { NextRequest, NextResponse } from "next/server";
import { requireSpaceRole } from "@/lib/auth";
import { Role } from "@prisma/client";
import {
  validateFileContent,
  generatePrivateStoragePath,
  uploadPrivateMedia,
  getSignedMediaUrl,
} from "@/lib/storage";
import { checkRateLimit, verifyCsrfOrigin } from "@/lib/security";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params;
    const { user } = await requireSpaceRole(spaceId, Role.MEMBER);

    // Rate limiting: 20 file uploads per minute per user
    const rateCheck = checkRateLimit(`upload:${user.id}`, 20, 60 * 1000);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        { error: "Too many upload requests. Please wait a moment before trying again." },
        { status: 429 }
      );
    }

    // CSRF verification
    const origin = req.headers.get("origin");
    const referer = req.headers.get("referer");
    if (!verifyCsrfOrigin(origin, referer)) {
      return NextResponse.json(
        { error: "Forbidden: Cross-site request rejected." },
        { status: 403 }
      );
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "No file provided in form data." }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // Deep magic bytes content inspection
    const validation = validateFileContent(buffer, file.type, file.size);
    if (!validation.valid) {
      return NextResponse.json(
        { error: validation.error || "Invalid file content." },
        { status: 400 }
      );
    }

    const storagePath = generatePrivateStoragePath(spaceId, file.name);
    const uploadResult = await uploadPrivateMedia(
      spaceId,
      storagePath,
      buffer,
      validation.detectedMime || file.type
    );

    if (!uploadResult.success) {
      return NextResponse.json(
        { error: uploadResult.error || "Failed to store media securely." },
        { status: 500 }
      );
    }

    const signedUrl = await getSignedMediaUrl(spaceId, storagePath, 3600);

    return NextResponse.json({
      storagePath,
      originalFileName: file.name,
      fileSize: file.size,
      mimeType: validation.detectedMime || file.type,
      signedUrl,
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to process media upload." },
      { status: err.status || 500 }
    );
  }
}
