import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

async function main() {
  console.log("Reading data from PostgreSQL database...");
  const space = await prisma.familySpace.findFirst({
    orderBy: { createdAt: "asc" },
  });

  if (!space) {
    console.error("No family space found in database!");
    return;
  }

  const people = await prisma.person.findMany({
    where: { spaceId: space.id },
  });

  const relationships = await prisma.relationship.findMany({
    where: { spaceId: space.id },
  });

  console.log(`Found space: "${space.name}" (${space.id})`);
  console.log(`Found ${people.length} people and ${relationships.length} relationships.`);

  // Build Firebase Realtime Database structure
  const peopleRecord: Record<string, unknown> = {};
  for (const p of people) {
    peopleRecord[p.id] = {
      id: p.id,
      firstName: p.firstName,
      lastName: p.lastName,
      khmerName: p.khmerName || null,
      gender: p.gender,
      birthYear: p.birthYear || null,
      birthDate: p.birthDate ? p.birthDate.toISOString() : null,
      birthPlace: p.birthPlace || null,
      deathYear: p.deathYear || null,
      deathDate: p.deathDate ? p.deathDate.toISOString() : null,
      deathPlace: p.deathPlace || null,
      isLiving: p.isLiving,
      photoUrl: p.photoUrl || null,
      biography: p.biography || null,
      isVerified: p.isVerified,
      isRestricted: p.isRestricted,
      createdById: p.createdById || null,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    };
  }

  const relationshipsRecord: Record<string, unknown> = {};
  for (const r of relationships) {
    relationshipsRecord[r.id] = {
      id: r.id,
      personId: r.personId,
      relatedPersonId: r.relatedPersonId,
      type: r.type,
      status: r.status,
      confidence: r.confidence,
      notes: r.notes || null,
      createdById: r.createdById || null,
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    };
  }

  const rtdbPayload = {
    spaces: {
      [space.id]: {
        space: {
          id: space.id,
          name: space.name,
          slug: space.slug,
          description: space.description || "",
        },
        people: peopleRecord,
        relationships: relationshipsRecord,
      },
    },
  };

  const outputPath = path.join(process.cwd(), "firebase-rtdb-export.json");
  fs.writeFileSync(outputPath, JSON.stringify(rtdbPayload, null, 2), "utf8");

  console.log(`\nSuccessfully exported Firebase Realtime Database payload to:`);
  console.log(outputPath);
  console.log(`\nYou can import this file directly into Firebase Console:`);
  console.log(`1. Go to Firebase Console -> Build -> Realtime Database`);
  console.log(`2. Click the 3 dots (⋮) in the top right of the data view`);
  console.log(`3. Click "Import JSON" and select this file: firebase-rtdb-export.json`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
