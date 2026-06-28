import { prismadb } from "@/lib/prisma";
import { NextResponse } from "next/server";

function parseProbabilityScore(value: unknown) {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : NaN;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed || !/^-?\d+(\.\d+)?$/.test(trimmed)) return NaN;
    return Number(trimmed);
  }
  return NaN;
}

export async function POST(req: Request) {
  if (req.headers.get("content-type") !== "application/json") {
    return NextResponse.json(
      { message: "Invalid content-type" },
      { status: 400 }
    );
  }

  const body = await req.json();
  const headers = req.headers;

  if (!body) {
    return NextResponse.json({ message: "No body" }, { status: 400 });
  }
  if (!headers) {
    return NextResponse.json({ message: "No headers" }, { status: 400 });
  }

  const {
    firstName,
    lastName,
    account,
    job,
    email,
    phone,
    lead_source,
    probability_score,
  } = body;
  const probabilityScore = parseProbabilityScore(probability_score);

  //Validate auth with token from .env.local
  const token = headers.get("authorization");

  if (!token) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  if (!process.env.NEXTCRM_TOKEN) {
    return NextResponse.json(
      { message: "NEXTCRM_TOKEN not defined in .env.local file" },
      { status: 401 }
    );
  }

  if (token.trim() !== process.env.NEXTCRM_TOKEN.trim()) {
    console.log("Unauthorized");
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  } else {
    if (!lastName) {
      return NextResponse.json(
        { message: "Missing required fields" },
        { status: 400 }
      );
    }
    if (
      probabilityScore !== undefined &&
      (!Number.isInteger(probabilityScore) ||
        probabilityScore < 0 ||
        probabilityScore > 100)
    ) {
      return NextResponse.json(
        { message: "Probability score must be a whole number between 0 and 100" },
        { status: 400 }
      );
    }
    try {
      await prismadb.crm_Leads.create({
        data: {
          v: 1,
          firstName,
          lastName,
          company: account,
          jobTitle: job,
          email,
          phone,
          probability_score: probabilityScore,
        },
      });

      return NextResponse.json({ message: "New lead created successfully" });
      //return res.status(200).json({ json: "newContact" });
    } catch (error) {
      console.log(error);
      return NextResponse.json(
        { message: "Error creating new lead" },
        { status: 500 }
      );
    }
  }
}
