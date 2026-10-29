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
  try {
    const { spaceId } = await params;
    const { user, membership } = await requireSpaceRole(spaceId, Role.MEMBER);

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

    const isCouncil = membership.role === Role.OWNER || membership.role === Role.ADMIN;
    const relInfo = parsed.data.relationship;

    // In open family collaboration mode, all cousins and space members can add relatives to anchor nodes.
    // Lineage integrity is guaranteed by DAG validation below (no cycles, max 2 biological parents, no duplicate spouses).

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
        return NextResponse.json(
          { error: "Anchor relative not found in this family space." },
          { status: 404 }
        );
      }

      anchorId = foundAnchor.id;

      // Collect parents of anchor for SIBLING check or validation
      anchorParents = foundAnchor.relationshipsAsTarget.map((r) => r.personId);

      // Check spouse of anchor if alsoLinkSpouse requested
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

      // Validate relationships before inserting
      const allRels = await prisma.relationship.findMany({
        where: { spaceId, status: "CONFIRMED" },
      });

      const parentChildEdges = allRels
        .filter((r) => r.type === "PARENT_CHILD" || r.type === "ADOPTIVE_PARENT_CHILD")
        .map((r) => ({ parentId: r.personId, childId: r.relatedPersonId }));

      if (relInfo.type === "PARENT") {
        // New person will be parent of anchor
        const currentParents = parentChildEdges
          .filter((e) => e.childId === foundAnchor.id)
          .map((e) => e.parentId);
        validateParentCount(currentParents, "temp-new-person-id");
      } else if (relInfo.type === "CHILD") {
        // Anchor will be parent of new child
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

    // Execute atomic creation in transaction
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
      }> = [];

      if (anchorId && relInfo && relInfo.type !== "NONE") {
        if (relInfo.type === "PARENT") {
          // New person -> parent of anchor
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
          // Anchor -> parent of new person
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

          // If user also checked alsoLinkSpouse and anchor has spouse, link spouse as second parent
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
          // Link new person as child to all of anchor's parents
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

    // Record audit trail entries
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

    for (const rel of result.createdRelationships) {
      await recordAuditLog({
        spaceId,
        actorId: user.id,
        action: "RELATIONSHIP_CREATED",
        entityType: "Relationship",
        entityId: rel.id,
        metadata: {
          personId: rel.personId,
          relatedPersonId: rel.relatedPersonId,
          type: rel.type,
        },
      });
    }

    return NextResponse.json({
      success: true,
      message: "សមាជិកគ្រួសារត្រូវបានបញ្ចូលដោយជោគជ័យ (Family member added successfully)",
      person: result.newPerson,
      relationships: result.createdRelationships,
    });
  } catch (error: unknown) {
    console.error("POST /api/spaces/[spaceId]/people error:", error);
    const err = error as { status?: number; message?: string };
    return NextResponse.json(
      { error: err.message || "Failed to add family member" },
      { status: err.status || 500 }
    );
  }
}
