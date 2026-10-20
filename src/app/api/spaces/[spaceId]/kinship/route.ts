import { NextRequest, NextResponse } from "next/server";
import { requireSpaceRole } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { calculateKinship, KinshipPerson, KinshipRelationship } from "@/lib/kinship";
import { Role, Gender } from "@prisma/client";
import { z } from "zod";

const kinshipRequestSchema = z.object({
  person1Id: z.string().min(1, "Person 1 ID is required"),
  person2Id: z.string().min(1, "Person 2 ID is required"),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  try {
    const { spaceId } = await params;
    await requireSpaceRole(spaceId, Role.MEMBER);

    const body = await req.json();
    const parsed = kinshipRequestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.format() },
        { status: 400 }
      );
    }

    const { person1Id, person2Id } = parsed.data;

    // Fetch all relatives and relationships in this space
    const dbPeople = await prisma.person.findMany({
      where: { spaceId },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        khmerName: true,
        gender: true,
        birthYear: true,
      },
    });

    const dbRelationships = await prisma.relationship.findMany({
      where: { spaceId, status: "CONFIRMED" },
      select: {
        id: true,
        personId: true,
        relatedPersonId: true,
        type: true,
        status: true,
      },
    });

    const people: KinshipPerson[] = dbPeople.map((p) => ({
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      khmerName: p.khmerName,
      gender: p.gender as Gender,
      birthYear: p.birthYear,
    }));

    const relationships: KinshipRelationship[] = dbRelationships.map((r) => ({
      id: r.id,
      personId: r.personId,
      relatedPersonId: r.relatedPersonId,
      type: r.type,
      status: r.status,
    }));

    const result = calculateKinship(person1Id, person2Id, people, relationships);

    return NextResponse.json({ result });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to calculate kinship" },
      { status: err.status || 500 }
    );
  }
}
