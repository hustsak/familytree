import { NextRequest, NextResponse } from "next/server";
import { requireSpaceRole, recordAuditLog } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { Role, Gender } from "@prisma/client";
import { z } from "zod";
import { verifyCsrfOrigin } from "@/lib/security";
import {
  validateNoCycle,
  validateParentCount,
  validateNoDuplicateRelationship,
} from "@/lib/validation/dag";
import {
  fetchSpaceFromRTDB,
  savePersonToRTDBRest,
} from "@/lib/firebase/rtdb-server";
import type { TreePerson, TreeRelationship } from "@/lib/tree-layout";

const addPersonSchema = z.object({
  firstName: z.string().min(1, "First name is required").max(60),
  lastName: z.string().min(1, "Last name is required").max(60),
  khmerName: z.string().max(100).optional().nullable(),
  gender: z.enum(["MALE", "FEMALE", "OTHER", "UNKNOWN"]).default("UNKNOWN"),
  birthYear: z.number().int().min(1000).max(new Date().getFullYear() + 10).optional().nullable(),
  deathYear: z.number().int().min(1000).max(new Date().getFullYear() + 10).optional().nullable(),
  isLiving: z.boolean().default(true),
  photoUrl: z.string().max(2000).optional().nullable(),
  biography: z.string().max(3000).optional().nullable(),
  relationship: z
    .object({
      type: z.enum(["PARENT", "CHILD", "SPOUSE", "SIBLING", "NONE"]),
      anchorPersonId: z.string().optional().nullable(),
      alsoLinkSpouse: z.boolean().optional(),
    })
    .optional()
    .nullable(),
});

// POST /api/spaces/[spaceId]/people - Add a new family member to the tree
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ spaceId: string }> }
) {
  const { spaceId } = await params;
  const { user } = await requireSpaceRole(spaceId, Role.MEMBER);

  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");
  if (!verifyCsrfOrigin(origin, referer)) {
    return NextResponse.json(
      { error: "Forbidden: Cross-site request rejected." },
      { status: 403 }
    );
  }

  const body = await req.json();
  if (body && typeof body.birthYear === "string") {
    const parsedNum = parseInt(body.birthYear.replace(/[^\d]/g, ""), 10);
    body.birthYear = !isNaN(parsedNum) ? parsedNum : null;
  }
  if (body && typeof body.deathYear === "string") {
    const parsedNum = parseInt(body.deathYear.replace(/[^\d]/g, ""), 10);
    body.deathYear = !isNaN(parsedNum) ? parsedNum : null;
  }
  const parsed = addPersonSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.format() },
      { status: 400 }
    );
  }

  const relInfo = parsed.data.relationship;

  try {
    let anchorParents: string[] = [];
    let anchorSpouseId: string | null = null;
    let anchorId: string | null = null;

    if (relInfo && relInfo.type !== "NONE" && relInfo.anchorPersonId) {
      const foundAnchor = await prisma.person.findFirst({
        where: { id: relInfo.anchorPersonId, spaceId },
        include: {
          relationshipsAsTarget: {
            where: {
              status: "CONFIRMED",
              type: "PARENT_CHILD",
            },
          },
          relationshipsAsSubject: {
            where: {
              status: "CONFIRMED",
              type: "SPOUSE",
            },
          },
        },
      });

      if (!foundAnchor) {
        throw new Error("ANCHOR_NOT_IN_LOCAL_PG");
      }

      anchorId = foundAnchor.id;
      anchorParents = foundAnchor.relationshipsAsTarget.map((r) => r.personId);

      const spouseRel = foundAnchor.relationshipsAsSubject[0];
      if (spouseRel) {
        anchorSpouseId = spouseRel.relatedPersonId;
      } else {
        const reverseSpouse = await prisma.relationship.findFirst({
          where: {
            spaceId,
            relatedPersonId: foundAnchor.id,
            type: "SPOUSE",
            status: "CONFIRMED",
          },
        });
        if (reverseSpouse) {
          anchorSpouseId = reverseSpouse.personId;
        }
      }

      const allRels = await prisma.relationship.findMany({
        where: { spaceId, status: "CONFIRMED" },
      });

      const parentChildEdges = allRels
        .filter((r) => r.type === "PARENT_CHILD" || r.type === "ADOPTIVE_PARENT_CHILD")
        .map((r) => ({ parentId: r.personId, childId: r.relatedPersonId }));

      if (relInfo.type === "PARENT") {
        const currentParents = parentChildEdges
          .filter((e) => e.childId === foundAnchor.id)
          .map((e) => e.parentId);
        validateParentCount(currentParents, "temp-new-person-id");
      } else if (relInfo.type === "CHILD") {
        validateNoCycle(parentChildEdges, foundAnchor.id, "temp-new-child-id");
      } else if (relInfo.type === "SPOUSE") {
        validateNoDuplicateRelationship(allRels, foundAnchor.id, "temp-new-spouse-id", "SPOUSE");
      } else if (relInfo.type === "SIBLING") {
        if (anchorParents.length === 0) {
          return NextResponse.json(
            {
              error:
                "ដើម្បីបន្ថែមបងប្អូនបង្កើត សូមបន្ថែមឪពុកម្តាយរបស់សាច់ញាតិនេះជាមុនសិន (Anchor relative has no parents in the tree yet. Please add their parents first to link siblings).",
            },
            { status: 400 }
          );
        }
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      const newPerson = await tx.person.create({
        data: {
          spaceId,
          firstName: parsed.data.firstName.trim(),
          lastName: parsed.data.lastName.trim(),
          khmerName: parsed.data.khmerName?.trim() || null,
          gender: parsed.data.gender as Gender,
          birthYear: parsed.data.birthYear,
          deathYear: parsed.data.deathYear,
          isLiving: parsed.data.isLiving,
          photoUrl: parsed.data.photoUrl?.trim() || null,
          biography: parsed.data.biography?.trim() || null,
          createdById: user.id,
          isVerified: true,
        },
      });

      const createdRelationships: Array<{
        id: string;
        personId: string;
        relatedPersonId: string;
        type: string;
        status?: string;
        isDisputed?: boolean;
      }> = [];

      if (anchorId && relInfo && relInfo.type !== "NONE") {
        if (relInfo.type === "PARENT") {
          const rel = await tx.relationship.create({
            data: {
              spaceId,
              personId: newPerson.id,
              relatedPersonId: anchorId,
              type: "PARENT_CHILD",
              status: "CONFIRMED",
              confidence: "DIRECT",
              createdById: user.id,
            },
          });
          createdRelationships.push(rel);
        } else if (relInfo.type === "CHILD") {
          const rel = await tx.relationship.create({
            data: {
              spaceId,
              personId: anchorId,
              relatedPersonId: newPerson.id,
              type: "PARENT_CHILD",
              status: "CONFIRMED",
              confidence: "DIRECT",
              createdById: user.id,
            },
          });
          createdRelationships.push(rel);

          if (relInfo.alsoLinkSpouse && anchorSpouseId) {
            const relSpouse = await tx.relationship.create({
              data: {
                spaceId,
                personId: anchorSpouseId,
                relatedPersonId: newPerson.id,
                type: "PARENT_CHILD",
                status: "CONFIRMED",
                confidence: "DIRECT",
                createdById: user.id,
              },
            });
            createdRelationships.push(relSpouse);
          }
        } else if (relInfo.type === "SPOUSE") {
          const rel = await tx.relationship.create({
            data: {
              spaceId,
              personId: anchorId,
              relatedPersonId: newPerson.id,
              type: "SPOUSE",
              status: "CONFIRMED",
              confidence: "DIRECT",
              createdById: user.id,
            },
          });
          createdRelationships.push(rel);
        } else if (relInfo.type === "SIBLING") {
          for (const parentId of anchorParents) {
            const rel = await tx.relationship.create({
              data: {
                spaceId,
                personId: parentId,
                relatedPersonId: newPerson.id,
                type: "PARENT_CHILD",
                status: "CONFIRMED",
                confidence: "DIRECT",
                createdById: user.id,
              },
            });
            createdRelationships.push(rel);
          }
        }
      }

      return { newPerson, createdRelationships };
    });

    await recordAuditLog({
      spaceId,
      actorId: user.id,
      action: "RELATIVE_CREATED",
      entityType: "Person",
      entityId: result.newPerson.id,
      metadata: {
        firstName: result.newPerson.firstName,
        lastName: result.newPerson.lastName,
        khmerName: result.newPerson.khmerName,
        relationshipType: relInfo?.type || "NONE",
        anchorPersonId: relInfo?.anchorPersonId || null,
        relationshipsCreatedCount: result.createdRelationships.length,
      },
    });

    // Also sync to Cloud Firestore immediately from server
    await savePersonToRTDBRest(
      spaceId,
      result.newPerson as unknown as TreePerson,
      result.createdRelationships as unknown as TreeRelationship[]
    ).catch((err) => console.warn("Server Firestore sync notice:", err));

    return NextResponse.json({
      success: true,
      message: "សមាជិកគ្រួសារត្រូវបានបញ្ចូលដោយជោគជ័យ (Family member added successfully)",
      person: result.newPerson,
      relationships: result.createdRelationships,
    });
  } catch (error: unknown) {
    const err = error as { status?: number; message?: string };
    // If validation error (400/403/404), return it directly
    if (err.status && err.status >= 400 && err.status < 500) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }

    // Fallback to Firebase Realtime Database when PostgreSQL is unavailable (e.g. on Vercel)
    console.warn("POST /api/spaces/[spaceId]/people DB unavailable, saving to Firebase RTDB:", error);
    try {
      const rtdbData = await fetchSpaceFromRTDB(spaceId);
      const nowIso = new Date().toISOString();
      const newPersonId = `person-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const newPerson: TreePerson = {
        id: newPersonId,
        firstName: parsed.data.firstName.trim(),
        lastName: parsed.data.lastName.trim(),
        khmerName: parsed.data.khmerName?.trim() || null,
        gender: parsed.data.gender,
        birthYear: parsed.data.birthYear ?? null,
        deathYear: parsed.data.deathYear ?? null,
        isLiving: parsed.data.isLiving,
        isVerified: true,
        photoUrl: parsed.data.photoUrl?.trim() || null,
        biography: parsed.data.biography?.trim() || null,
      };

      const createdRelationships: TreeRelationship[] = [];
      const anchorId = relInfo?.anchorPersonId || null;

      if (anchorId && relInfo && relInfo.type !== "NONE") {
        const makeRelId = (suffix: string) =>
          `rel-${Date.now()}-${suffix}-${Math.random().toString(36).slice(2, 6)}`;

        if (relInfo.type === "PARENT") {
          createdRelationships.push({
            id: makeRelId("par"),
            personId: newPersonId,
            relatedPersonId: anchorId,
            type: "PARENT_CHILD",
            status: "CONFIRMED",
          });
        } else if (relInfo.type === "CHILD") {
          createdRelationships.push({
            id: makeRelId("ch"),
            personId: anchorId,
            relatedPersonId: newPersonId,
            type: "PARENT_CHILD",
            status: "CONFIRMED",
          });
          if (relInfo.alsoLinkSpouse) {
            const spouseRel = rtdbData.relationships.find(
              (r) =>
                r.status === "CONFIRMED" &&
                r.type === "SPOUSE" &&
                (r.personId === anchorId || r.relatedPersonId === anchorId)
            );
            const spouseId = spouseRel
              ? spouseRel.personId === anchorId
                ? spouseRel.relatedPersonId
                : spouseRel.personId
              : null;
            if (spouseId) {
              createdRelationships.push({
                id: makeRelId("chsp"),
                personId: spouseId,
                relatedPersonId: newPersonId,
                type: "PARENT_CHILD",
                status: "CONFIRMED",
              });
            }
          }
        } else if (relInfo.type === "SPOUSE") {
          createdRelationships.push({
            id: makeRelId("sp"),
            personId: anchorId,
            relatedPersonId: newPersonId,
            type: "SPOUSE",
            status: "CONFIRMED",
          });
        } else if (relInfo.type === "SIBLING") {
          const parentRels = rtdbData.relationships.filter(
            (r) =>
              r.status === "CONFIRMED" &&
              (r.type === "PARENT_CHILD" || r.type === "ADOPTIVE_PARENT_CHILD") &&
              r.relatedPersonId === anchorId
          );
          for (const pr of parentRels) {
            createdRelationships.push({
              id: makeRelId(`sib-${pr.personId.slice(-4)}`),
              personId: pr.personId,
              relatedPersonId: newPersonId,
              type: "PARENT_CHILD",
              status: "CONFIRMED",
            });
          }
        }
      }

      await savePersonToRTDBRest(
        spaceId,
        { ...newPerson, createdAt: nowIso, updatedAt: nowIso } as TreePerson,
        createdRelationships
      );

      return NextResponse.json({
        success: true,
        message: "សមាជិកគ្រួសារត្រូវបានបញ្ចូលដោយជោគជ័យ (Family member added successfully)",
        person: newPerson,
        relationships: createdRelationships,
      });
    } catch (rtdbErr: unknown) {
      const e = rtdbErr as { message?: string };
      return NextResponse.json(
        { error: e.message || "Failed to add family member" },
        { status: 500 }
      );
    }
  }
}
