import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export async function GET() {
    try {
        const interests = await prisma.interest.findMany({
            orderBy: {
                name: "asc",
            },
        });

        return NextResponse.json(interests);
    } catch (error) {
        console.error("Error fetching interests:", error);
        return new NextResponse("Internal Server Error", { status: 500 });
    }
}