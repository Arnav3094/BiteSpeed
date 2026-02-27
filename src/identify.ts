import { Request, Response } from "express";
import prisma from "./db.js";

async function createNewPrimaryContact(emailVal: string | null, phoneVal: string | null) {
  const newContact = await prisma.contact.create({
    data: {
      email: emailVal,
      phoneNumber: phoneVal,
      linkPrecedence: "primary",
    },
  });
  return {
    contact: {
      primaryContatctId: newContact.id,
      emails: newContact.email ? [newContact.email] : [],
      phoneNumbers: newContact.phoneNumber ? [newContact.phoneNumber] : [],
      secondaryContactIds: [],
    },
  };
}

async function collectPrimaryIds(matchingContacts: any[]) {
  const primaryIdSet = new Set<number>();
  for (const c of matchingContacts) {
    if (c.linkPrecedence === "primary") {
      primaryIdSet.add(c.id);
    } else if (c.linkedId !== null) {
      primaryIdSet.add(c.linkedId);
    }
  }
  return primaryIdSet;
}

async function mergePrimaries(primaries: any[]) {
  if (primaries.length <= 1) return;
  
  const truePrimary = primaries[0];
  const otherPrimaries = primaries.slice(1);
  
  for (const p of otherPrimaries) {
    await prisma.contact.update({
      where: { id: p.id },
      data: { linkPrecedence: "secondary", linkedId: truePrimary.id, updatedAt: new Date() },
    });
    await prisma.contact.updateMany({
      where: { linkedId: p.id, deletedAt: null },
      data: { linkedId: truePrimary.id, updatedAt: new Date() },
    });
  }
}

async function createNewSecondaryIfNeeded(
  emailVal: string | null,
  phoneVal: string | null,
  clusterEmails: Set<any>,
  clusterPhones: Set<any>,
  truePrimaryId: number,
  cluster: any[]
) {
  const hasNewEmail = emailVal !== null && !clusterEmails.has(emailVal);
  const hasNewPhone = phoneVal !== null && !clusterPhones.has(phoneVal);

  if (hasNewEmail || hasNewPhone) {
    const newSecondary = await prisma.contact.create({
      data: {
        email: emailVal,
        phoneNumber: phoneVal,
        linkedId: truePrimaryId,
        linkPrecedence: "secondary",
      },
    });
    cluster.push(newSecondary);
  }
}

function buildResponse(truePrimary: any, cluster: any[]) {
  const secondaries = cluster.filter((c) => c.id !== truePrimary.id);

  const emails = [
    ...(truePrimary.email ? [truePrimary.email] : []),
    ...secondaries.map((c) => c.email).filter((e): e is string => e !== null),
  ];
  const phoneNumbers = [
    ...(truePrimary.phoneNumber ? [truePrimary.phoneNumber] : []),
    ...secondaries.map((c) => c.phoneNumber).filter((p): p is string => p !== null),
  ];

  return {
    contact: {
      primaryContatctId: truePrimary.id,
      emails: [...new Set(emails)],
      phoneNumbers: [...new Set(phoneNumbers)],
      secondaryContactIds: secondaries.map((c) => c.id),
    },
  };
}

export async function identifyHandler(req: Request, res: Response) {
  const { email, phoneNumber } = req.body as {
    email?: string | null;
    phoneNumber?: string | number | null;
  };

  const emailVal = email ?? null;
  const phoneVal = phoneNumber != null ? String(phoneNumber) : null;

  if (!emailVal && !phoneVal) {
    res.status(400).json({ error: "At least one of email or phoneNumber is required" });
    return;
  }

  const orConditions: Array<{ email: string } | { phoneNumber: string }> = [];
  if (emailVal) orConditions.push({ email: emailVal });
  if (phoneVal) orConditions.push({ phoneNumber: phoneVal });

  const matchingContacts = await prisma.contact.findMany({
    where: {
      OR: orConditions,
      deletedAt: null,
    },
  });

  if (matchingContacts.length === 0) {
    const response = await createNewPrimaryContact(emailVal, phoneVal);
    res.json(response);
    return;
  }

  const primaryIdSet = await collectPrimaryIds(matchingContacts);

  const primaries = await prisma.contact.findMany({
    where: { id: { in: Array.from(primaryIdSet) }, deletedAt: null },
    orderBy: { createdAt: "asc" },
  });

  const truePrimary = primaries[0];

  await mergePrimaries(primaries);

  const cluster = await prisma.contact.findMany({
    where: {
      OR: [{ id: truePrimary.id }, { linkedId: truePrimary.id }],
      deletedAt: null,
    },
    orderBy: { createdAt: "asc" },
  });

  const clusterEmails = new Set(cluster.map((c) => c.email).filter(Boolean));
  const clusterPhones = new Set(cluster.map((c) => c.phoneNumber).filter(Boolean));

  await createNewSecondaryIfNeeded(emailVal, phoneVal, clusterEmails, clusterPhones, truePrimary.id, cluster);

  const response = buildResponse(truePrimary, cluster);
  res.json(response);
}
